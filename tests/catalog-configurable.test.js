'use strict';

/**
 * V4.7 — Pruebas del catálogo configurable y de la identificación segura.
 *
 * Demuestra:
 *  - Un cuarto artículo definido SOLO con datos (fixture) se identifica, recibe
 *    stock, calcula servidas/pendientes y genera palets válidos sin tocar el motor.
 *  - Un GIS desconocido NO se reclasifica por coincidencia textual.
 *  - Descripciones ambiguas y artículos inactivos se rechazan.
 *  - Los tres artículos actuales conservan su comportamiento.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const catalog = require(path.join(ROOT, 'src', 'catalog.js'));
const parser = require(path.join(ROOT, 'src', 'parser.js'));
const orchestrator = require(path.join(ROOT, 'src', 'orchestrator.js'));
const palletizer = require(path.join(ROOT, 'src', 'palletizer.js'));
const ui = require(path.join(ROOT, 'src', 'ui.js'));

const BASE = JSON.parse(JSON.stringify(catalog.DEFAULT_CATALOG.articles));

let total = 0;
let passed = 0;
const failures = [];

function check(title, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  PASS  ${title}`);
  } catch (err) {
    failures.push({ title, err });
    console.error(`  FAIL  ${title}`);
    console.error(`        ${err.message}`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function articleFixture(overrides = {}) {
  return {
    id: 'TEST_KIWI',
    status: 'ACTIVE',
    name: 'TOMATE KIWI TEST',
    shortName: 'Kiwi Test',
    hasMonovarietalRestriction: false,
    identification: {
      gisCodes: ['99001'],
      patterns: [{ value: 'KIWI\\s*TEST', flags: 'i' }],
      varietyDetection: { mode: 'NONE' }
    },
    stockAliases: {},
    varieties: [],
    defaultVarietyId: null,
    box: { lengthMm: 500, widthMm: 400, heightMm: 100 },
    palletization: {
      formats: {
        EURO: {
          palletLengthMm: 1200, palletWidthMm: 800, palletHeightMm: 144,
          boxesPerLayer: 4, maxLayers: 12, layerPattern: '4_PER_LAYER',
          isRigid: true, capacitySource: 'TEST_FIXTURE', verified: false,
          name: 'Fixture Kiwi Euro'
        },
        METROCHEP: {
          palletLengthMm: 1200, palletWidthMm: 1000, palletHeightMm: 144,
          boxesPerLayer: 5, maxLayers: 12, layerPattern: '5_PER_LAYER',
          isRigid: true, capacitySource: 'TEST_FIXTURE', verified: false,
          name: 'Fixture Kiwi Metro'
        }
      }
    },
    planning: { allocationStrategy: 'HAMILTON', fifoPriorityVariety: null, varietyPreference: [] },
    ...overrides
  };
}

function catalogWith(extraArticles, mutate) {
  const data = {
    schemaVersion: 1,
    catalogVersion: 'test-fixture',
    globals: { palletWoodHeightMm: 144, maxTowerHeightMm: 2278, maxPalletsPerTower: 3 },
    platforms: clone(catalog.DEFAULT_CATALOG.platforms),
    articles: BASE.concat(extraArticles || [])
  };
  if (typeof mutate === 'function') mutate(data);
  return catalog.buildCatalog(data);
}

const FIXTURE_CATALOG = catalogWith([articleFixture()]);
const INACTIVE_CATALOG = catalogWith([articleFixture({ status: 'INACTIVE' })]);

console.log('\n=== V4.7 · CATÁLOGO CONFIGURABLE E IDENTIFICACIÓN SEGURA ===\n');

// =============================================================================
// 1. CUARTO ARTÍCULO SOLO CON DATOS
// =============================================================================

check('1.1 · el cuarto artículo se identifica por GIS', () => {
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\t99001\tTOMATE KIWI TEST\t50', FIXTURE_CATALOG);
  assert.strictEqual(parsed.lines.length, 1);
  assert.strictEqual(parsed.lines[0].productId, 'TEST_KIWI');
  assert.strictEqual(parsed.lines[0].isValid, true);
});

check('1.2 · el cuarto artículo se identifica por descripción si no hay GIS', () => {
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\tTOMATE KIWI TEST\t30', FIXTURE_CATALOG);
  assert.strictEqual(parsed.lines[0].productId, 'TEST_KIWI');
  assert.strictEqual(parsed.lines[0].isValid, true);
});

check('1.3 · planifica el cuarto artículo: 50 servidas, 0 pendientes', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99001\tTOMATE KIWI TEST\t50',
    stock: { 'TEST_KIWI': 50 },
    catalogConfig: FIXTURE_CATALOG
  });
  assert.deepStrictEqual(result.errors, []);
  const alloc = result.allocations[0];
  assert.strictEqual(alloc.productId, 'TEST_KIWI');
  assert.strictEqual(alloc.allocatedQuantity, 50);
  assert.strictEqual(alloc.missingQuantity, 0);
});

check('1.4 · paletiza el cuarto artículo con SUS reglas (2 palets EURO de 48)', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99001\tTOMATE KIWI TEST\t50',
    stock: { 'TEST_KIWI': 50 },
    catalogConfig: FIXTURE_CATALOG
  });
  assert.strictEqual(result.totalPallets, 2);
  assert.strictEqual(result.totalPalletSlots, 1);
  const group = result.palletSummaries.groups[0];
  assert.strictEqual(group.productId, 'TEST_KIWI');
  assert.strictEqual(group.palletType, 'EURO');
  assert.strictEqual(group.pallets[0].capacity, 48);
  assert.strictEqual(group.pallets[0].boxHeightMm, 100);
});

check('1.5 · el stock del cuarto artículo respeta la variedad por defecto del catálogo', () => {
  const stockMap = orchestrator.normalizeStockInput({ 'TEST_KIWI': 25 }, FIXTURE_CATALOG);
  assert.ok(stockMap.has('TEST_KIWI::STANDARD'));
  assert.strictEqual(stockMap.get('TEST_KIWI::STANDARD').available, 25);
});

check('1.6 · un artículo sin reglas de paletización no genera palets silenciosamente', () => {
  const broken = catalogWith([articleFixture({ id: 'TEST_SIN_REGLAS', identification: {
    gisCodes: ['99002'], patterns: [{ value: 'SIN\\s*REGLAS', flags: 'i' }], varietyDetection: { mode: 'NONE' }
  } })], data => {
    const a = data.articles[data.articles.length - 1];
    a.palletization.formats = {};
  });
  const result = orchestrator.planLoad({
    demandOrders: [{ platform: 'CENTRO', productId: 'TEST_SIN_REGLAS', cajas: 10, fechaEntrega: '20/10/2026' }],
    stock: { 'TEST_SIN_REGLAS': 10 },
    catalogConfig: broken
  });
  assert.strictEqual(result.totalPallets, 0);
  const plan = Object.values(result.plansByDate)[0];
  assert.ok(plan.errors.some(e => e.code === 'INCOMPATIBLE_PALLET_TYPE'));
  assert.strictEqual(result.isPhysicallyFeasible, false);
});

// =============================================================================
// 2. IDENTIFICACIÓN SEGURA
// =============================================================================

check('2.1 · GIS desconocido NO cae a la descripción (antes se asignaba a Pera)', () => {
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\t99999\tTOMATE PERA RAMA\t10', catalog.DEFAULT_CATALOG);
  const line = parsed.lines[0];
  assert.strictEqual(line.productId, 'UNKNOWN');
  assert.strictEqual(line.isValid, false);
  assert.ok(line.parseErrors.some(e => e.code === 'UNKNOWN_PRODUCT'));
});

check('2.2 · GIS conocido manda aunque la descripción no coincida', () => {
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\t14072\tTOMATE KIWI TEST\t10', catalog.DEFAULT_CATALOG);
  assert.strictEqual(parsed.lines[0].productId, 'PERA_RAMA');
  assert.strictEqual(parsed.lines[0].isValid, true);
});

check('2.3 · descripción ambigua se rechaza', () => {
  const ambiguous = catalogWith([
    articleFixture(),
    articleFixture({
      id: 'TEST_KIWI_ALT',
      name: 'TOMATE KIWI ALT',
      identification: {
        gisCodes: ['99002'],
        patterns: [{ value: 'KIWI', flags: 'i' }],
        varietyDetection: { mode: 'NONE' }
      }
    })
  ]);
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\tTOMATE KIWI TEST\t30', ambiguous);
  const line = parsed.lines[0];
  assert.strictEqual(line.productId, 'UNKNOWN');
  assert.strictEqual(line.isValid, false);
  assert.ok(line.parseErrors.some(e => e.code === 'AMBIGUOUS_PRODUCT'));
});

check('2.4 · artículo inactivo no se planifica', () => {
  const inactive = catalogWith([articleFixture({ status: 'INACTIVE' })]);
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\t99001\tTOMATE KIWI TEST\t30', inactive);
  const line = parsed.lines[0];
  assert.strictEqual(line.productId, 'UNKNOWN');
  assert.strictEqual(line.isValid, false);
  assert.ok(line.parseErrors.some(e => e.code === 'INACTIVE_ARTICLE'));
});

check('2.5 · los GIS de los tres artículos actuales siguen resolviendo igual', () => {
  const cases = [
    ['14072', 'PERA_RAMA'],
    ['16228', 'COCKTAIL_ROMANTICO'],
    ['18746', 'CHERRY_RAMA']
  ];
  cases.forEach(([gis, expected]) => {
    const parsed = parser.parseForecast(`CENTRO\t20/10/2026\t${gis}\tDESCRIPCION X\t5`, catalog.DEFAULT_CATALOG);
    assert.strictEqual(parsed.lines[0].productId, expected, `GIS ${gis}`);
    assert.strictEqual(parsed.lines[0].isValid, true, `GIS ${gis}`);
  });
});

check('2.6 · los alias de stock históricos se conservan', () => {
  const map = orchestrator.normalizeStockInput({
    'PERA_RAMA': 1,
    'CHERRY_RAMA': 2,
    'CONSABOR': 3,
    'SAO_PAULO': 4,
    'SUNSTREAM': 5
  });
  assert.strictEqual(map.get('PERA_RAMA::STANDARD').available, 1);
  assert.strictEqual(map.get('CHERRY_RAMA::SUNSTREAM').available, 2);
  assert.strictEqual(map.get('COCKTAIL_ROMANTICO::CONSABOR').available, 3);
  assert.strictEqual(map.get('COCKTAIL_ROMANTICO::SAO_PAULO').available, 4);
  assert.strictEqual(map.get('COCKTAIL_ROMANTICO::SUNSTREAM').available, 5);
});

// =============================================================================
// 2B. ARTÍCULOS INACTIVOS (D2)
// =============================================================================

check('2.7 · un artículo activo por demandOrders se planifica con normalidad', () => {
  const result = orchestrator.planLoad({
    demandOrders: [{ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '20/10/2026' }],
    stock: { 'PERA_RAMA': 10 }
  });
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.allocations.length, 1);
  assert.strictEqual(result.allocations[0].allocatedQuantity, 10);
  assert.ok(result.isPhysicallyFeasible);
});

check('2.8 · un artículo inactivo por demandOrders se rechaza', () => {
  const result = orchestrator.planLoad({
    demandOrders: [{ platform: 'CENTRO', productId: 'TEST_KIWI', cajas: 30, fechaEntrega: '20/10/2026' }],
    stock: { 'TEST_KIWI': 30 },
    catalogConfig: INACTIVE_CATALOG
  });
  assert.strictEqual(result.allocations.length, 0);
  assert.strictEqual(result.totalBoxes, 0);
  assert.ok(result.errors.some(e => e.code === 'INACTIVE_ARTICLE'));
  assert.strictEqual(result.isPhysicallyFeasible, false);
});

check('2.9 · el parser sigue rechazando el artículo inactivo por GIS', () => {
  const parsed = parser.parseForecast('CENTRO\t20/10/2026\t99001\tTOMATE KIWI TEST\t30', INACTIVE_CATALOG);
  assert.strictEqual(parsed.lines[0].isValid, false);
  assert.ok(parsed.lines[0].parseErrors.some(e => e.code === 'INACTIVE_ARTICLE'));
});

check('2.10 · demanda mixta: planifica lo activo y no acepta lo inactivo', () => {
  const result = orchestrator.planLoad({
    demandOrders: [
      { platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '20/10/2026' },
      { platform: 'LEVANTE', productId: 'TEST_KIWI', cajas: 5, fechaEntrega: '20/10/2026' }
    ],
    stock: { 'PERA_RAMA': 10, 'TEST_KIWI': 5 },
    catalogConfig: INACTIVE_CATALOG
  });
  assert.strictEqual(result.allocations.length, 1);
  assert.strictEqual(result.allocations[0].productId, 'PERA_RAMA');
  assert.strictEqual(result.allocations[0].allocatedQuantity, 10);
  assert.ok(result.errors.some(e => e.code === 'INACTIVE_ARTICLE'));
  assert.strictEqual(result.isPhysicallyFeasible, false);
  assert.strictEqual(result.totalBoxes, 10);
});

// =============================================================================
// 3. SELECCIÓN DE FORMATO (REGLA B: SIN UMBRAL OBLIGATORIO)
// =============================================================================

check('3.1 · Pera 77 pasa por el optimizador, sin umbral obligatorio', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t14072\tTOMATE PERA RAMA\t77',
    stock: { 'PERA_RAMA': 77 }
  });
  const group = result.palletSummaries.groups[0];
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(group.palletType, 'EURO');
  assert.strictEqual(result.totalPallets, 2);
  assert.strictEqual(result.totalPalletSlots, 1);
  // El catálogo ya no declara política de umbral ni helper de selección.
  assert.strictEqual(catalog.DEFAULT_CATALOG.products.PERA_RAMA.palletization.policy, undefined);
  assert.strictEqual(catalog.DEFAULT_CATALOG.products.PERA_RAMA.palletization.overrideGuard, undefined);
  assert.strictEqual(typeof palletizer.resolvePalletType, 'undefined');
});

check('3.2 · Pera 81 puede elegir METROCHEP por optimización, no por umbral', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t14072\tTOMATE PERA RAMA\t81',
    stock: { 'PERA_RAMA': 81 }
  });
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.palletSummaries.groups[0].palletType, 'METROCHEP');
  assert.strictEqual(result.totalPallets, 1);
  assert.strictEqual(result.totalPalletSlots, 1);
});

check('3.3 · la salvaguarda de Cherry (≤176 ⇒ EURO aunque se fuerce METROCHEP) se mantiene', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM\t100',
    stock: { 'CHERRY_RAMA::SUNSTREAM': 100 },
    palletConfiguration: { 'CENTRO::CHERRY_RAMA': 'METROCHEP' }
  });
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.palletSummaries.groups[0].palletType, 'EURO');
});

check('3.4 · un catálogo alternativo no hereda las reglas de paletización globales', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99001\tTOMATE KIWI TEST\t50',
    stock: { 'TEST_KIWI': 50 },
    catalogConfig: FIXTURE_CATALOG
  });
  assert.strictEqual(result.palletSummaries.groups[0].pallets[0].capacity, 48);
  assert.notStrictEqual(result.palletSummaries.groups[0].pallets[0].capacity, 76);
});

// =============================================================================
// 4. EQUIVALENCIA CON EL CATÁLOGO POR DEFECTO
// =============================================================================

check('4.1 · pasar DEFAULT_CATALOG explícito produce el mismo 18/09 (522/17/9)', () => {
  const stock = {
    'PERA_RAMA': 320,
    'COCKTAIL_ROMANTICO::CONSABOR': 0,
    'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
    'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
    'CHERRY_RAMA::SUNSTREAM': 100
  };
  const a = orchestrator.planLoad({ rawText: ui.DATASETS['18_SEP'], stock: { ...stock } });
  const b = orchestrator.planLoad({ rawText: ui.DATASETS['18_SEP'], stock: { ...stock }, catalogConfig: catalog.DEFAULT_CATALOG });
  assert.strictEqual(a.totalBoxes, 522);
  assert.strictEqual(a.totalPallets, 17);
  assert.strictEqual(a.totalPalletSlots, 9);
  assert.deepStrictEqual(a.allocations, b.allocations);
  assert.deepStrictEqual(a.palletSummaries, b.palletSummaries);
});

check('4.2 · Carrefour CONSABOR sigue sirviendo 80 completas', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80',
    stock: {
      'PERA_RAMA': 0, 'COCKTAIL_ROMANTICO::CONSABOR': 100,
      'COCKTAIL_ROMANTICO::SAO_PAULO': 0, 'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
      'CHERRY_RAMA::SUNSTREAM': 0
    }
  });
  assert.strictEqual(result.allocations[0].allocatedQuantity, 80);
  assert.strictEqual(result.allocations[0].missingQuantity, 0);
  assert.strictEqual(result.allocations[0].varietyId, 'CONSABOR');
});

// =============================================================================
// RESUMEN
// =============================================================================
console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${total}`);
console.log(`PASADAS CON ÉXITO:    ${passed}`);
console.log(`FALLOS:               ${failures.length}`);
console.log('==================================================\n');

if (failures.length > 0) {
  process.exitCode = 1;
}

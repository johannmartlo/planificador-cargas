'use strict';

/**
 * V4.7 — Pruebas del catálogo declarativo y de su validador.
 *
 * Verifica:
 *  1. El catálogo de producción es válido y el artefacto generado está sincronizado.
 *  2. El validador rechaza duplicados, dimensiones imposibles, reglas incompletas,
 *     variedades incoherentes y solapes de identificación.
 *  3. Las reglas de paletización se derivan del catálogo con la forma histórica.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const schema = require(path.join(ROOT, 'src', 'catalog-schema.js'));
const catalog = require(path.join(ROOT, 'src', 'catalog.js'));
const catalogData = require(path.join(ROOT, 'src', 'catalog-data.js'));

const JSON_PATH = path.join(ROOT, 'catalog', 'catalog.json');
const JSON_TEXT = fs.readFileSync(JSON_PATH, 'utf8');
const BASE = JSON.parse(JSON_TEXT);

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

function codes(result) {
  return result.errors.map(e => e.code);
}

function expectCode(result, code) {
  assert.ok(codes(result).indexOf(code) !== -1,
    `esperaba ${code}; recibidos: ${codes(result).join(', ') || '(ninguno)'}`);
}

console.log('\n=== V4.7 · CATÁLOGO DECLARATIVO Y VALIDADOR ===\n');

// =============================================================================
// 1. CATÁLOGO DE PRODUCCIÓN
// =============================================================================

check('1.1 · catalog/catalog.json es válido', () => {
  const result = schema.validateCatalog(BASE);
  assert.ok(result.valid, schema.formatIssues(result));
});

check('1.2 · el catálogo tiene exactamente los 3 artículos actuales', () => {
  const ids = BASE.articles.map(a => a.id).sort();
  assert.deepStrictEqual(ids, ['CHERRY_RAMA', 'COCKTAIL_ROMANTICO', 'PERA_RAMA']);
});

check('1.3 · src/catalog-data.js está sincronizado con catalog.json', () => {
  assert.deepStrictEqual(catalogData, BASE);
  const hash = crypto.createHash('sha256').update(JSON_TEXT, 'utf8').digest('hex');
  const artifact = fs.readFileSync(path.join(ROOT, 'src', 'catalog-data.js'), 'utf8');
  assert.ok(artifact.indexOf(hash) !== -1,
    'el hash de catalog.json no aparece en el artefacto generado');
});

check('1.4 · DEFAULT_CATALOG conserva la API histórica', () => {
  assert.strictEqual(catalog.DEFAULT_CATALOG.products.PERA_RAMA.id, 'PERA_RAMA');
  assert.strictEqual(catalog.DEFAULT_CATALOG.products.PERA_RAMA.name, 'TOMATE PERA RAMA');
  assert.deepStrictEqual(catalog.DEFAULT_CATALOG.products.PERA_RAMA.gisCodes, ['14072']);
  assert.ok(catalog.DEFAULT_CATALOG.products.CHERRY_RAMA.matchRegex instanceof RegExp);
  assert.strictEqual(catalog.DEFAULT_CATALOG.products.CHERRY_RAMA.varieties.length, 1);
  assert.strictEqual(catalog.DEFAULT_CATALOG.platforms.canonical.length, 6);
  assert.deepStrictEqual(catalog.getProductVarieties('COCKTAIL_ROMANTICO').map(v => v.id),
    ['CONSABOR', 'SAO_PAULO', 'SUNSTREAM']);
});

check('1.5 · las reglas de paletización se derivan del catálogo con la forma histórica', () => {
  const rules = catalog.getPalletRules();
  const peraEuro = rules.PERA_RAMA.EURO;
  assert.strictEqual(peraEuro.boxLength, 600);
  assert.strictEqual(peraEuro.boxWidth, 400);
  assert.strictEqual(peraEuro.boxHeightMm, 95);
  assert.strictEqual(peraEuro.palletWidth, 800);
  assert.strictEqual(peraEuro.boxesPerLayer, 4);
  assert.strictEqual(peraEuro.maxLayers, 19);
  assert.strictEqual(peraEuro.maxStandardBoxes, 76);
  assert.strictEqual(peraEuro.layerPattern, '4_PER_LAYER');
  assert.strictEqual(rules.CHERRY_RAMA.METROCHEP.maxStandardBoxes, 220);
  assert.strictEqual(rules.CHERRY_RAMA.METROCHEP.layerPattern, '10_COMBINED_ORIENTATION');
});

check('1.6 · la capacidad derivada coincide con cajas/capa × capas en todos los formatos', () => {
  const rules = catalog.getPalletRules();
  Object.keys(rules).forEach(productId => {
    Object.keys(rules[productId]).forEach(format => {
      const rule = rules[productId][format];
      assert.strictEqual(rule.maxStandardBoxes, rule.boxesPerLayer * rule.maxLayers,
        `${productId}/${format}`);
    });
  });
});

check('1.7 · index.html carga catalog-data.js antes de catalog.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dataIdx = html.indexOf('<script src="src/catalog-data.js"></script>');
  const catalogIdx = html.indexOf('<script src="src/catalog.js"></script>');
  assert.ok(dataIdx !== -1, 'falta el <script> de catalog-data.js');
  assert.ok(catalogIdx !== -1, 'falta el <script> de catalog.js');
  assert.ok(dataIdx < catalogIdx, 'catalog-data.js debe cargarse antes que catalog.js');
});

// =============================================================================
// 2. VALIDACIONES ESTRUCTURALES
// =============================================================================

check('2.1 · rechaza id de artículo duplicado', () => {
  const data = clone(BASE);
  data.articles.push(clone(data.articles[0]));
  expectCode(schema.validateCatalog(data), 'DUPLICATE_ARTICLE_ID');
});

check('2.2 · rechaza GIS duplicado entre artículos', () => {
  const data = clone(BASE);
  data.articles[2].identification.gisCodes = ['14072'];
  expectCode(schema.validateCatalog(data), 'DUPLICATE_GIS');
});

check('2.3 · rechaza artículo activo sin formatos de paletización', () => {
  const data = clone(BASE);
  data.articles[0].palletization.formats = {};
  expectCode(schema.validateCatalog(data), 'MISSING_PALLET_FORMATS');
});

check('2.4 · rechaza cajas/capa imposibles por área', () => {
  const data = clone(BASE);
  data.articles[0].palletization.formats.EURO.boxesPerLayer = 99;
  expectCode(schema.validateCatalog(data), 'INVALID_LAYER_CAPACITY');
});

check('2.5 · rechaza altura de palet por encima del gálibo', () => {
  const data = clone(BASE);
  data.articles[0].palletization.formats.EURO.maxLayers = 30;
  expectCode(schema.validateCatalog(data), 'PALLET_EXCEEDS_TOWER_HEIGHT');
});

check('2.6 · rechaza dimensiones de caja no positivas', () => {
  const data = clone(BASE);
  data.articles[0].box.lengthMm = 0;
  expectCode(schema.validateCatalog(data), 'INVALID_BOX_DIMENSION');
});

check('2.7 · rechaza defaultVarietyId inexistente', () => {
  const data = clone(BASE);
  data.articles[2].defaultVarietyId = 'NO_EXISTE';
  expectCode(schema.validateCatalog(data), 'UNKNOWN_DEFAULT_VARIETY');
});

check('2.8 · rechaza alias de stock hacia variedad de otro artículo', () => {
  const data = clone(BASE);
  data.articles[0].stockAliases = { PERA_RAMA: 'SUNSTREAM' };
  expectCode(schema.validateCatalog(data), 'UNKNOWN_STOCK_ALIAS_VARIETY');
});

check('2.9 · rechaza fifoPriorityVariety inexistente', () => {
  const data = clone(BASE);
  data.articles[1].planning.fifoPriorityVariety = 'NO_EXISTE';
  expectCode(schema.validateCatalog(data), 'UNKNOWN_FIFO_VARIETY');
});

check('2.10 · rechaza patrón inválido', () => {
  const data = clone(BASE);
  data.articles[0].identification.patterns[0].value = 'PERA(';
  expectCode(schema.validateCatalog(data), 'INVALID_PATTERN_REGEX');
});

check('2.11 · rechaza patrón idéntico duplicado', () => {
  const data = clone(BASE);
  data.articles[1].identification.patterns[0].value = 'PERA\\s*RAMA';
  expectCode(schema.validateCatalog(data), 'DUPLICATE_PATTERN');
});

check('2.12 · rechaza solape de patrón con el nombre de otro artículo', () => {
  const data = clone(BASE);
  data.articles[0].identification.patterns[0].value = 'CHERRY';
  expectCode(schema.validateCatalog(data), 'PATTERN_OVERLAP');
});

check('2.13 · rechaza alias de plataforma hacia plataforma inexistente', () => {
  const data = clone(BASE);
  data.platforms.aliases.CENTRO = 'MADRID';
  expectCode(schema.validateCatalog(data), 'INVALID_PLATFORM_ALIAS');
});

check('2.14 · rechaza alias de stock duplicado entre artículos', () => {
  const data = clone(BASE);
  data.articles[2].stockAliases = { SUNSTREAM: 'SUNSTREAM' };
  expectCode(schema.validateCatalog(data), 'DUPLICATE_STOCK_ALIAS');
});

check('2.15 · rechaza varietyDetection.varietyId inexistente', () => {
  const data = clone(BASE);
  data.articles[2].identification.varietyDetection.varietyId = 'NO_EXISTE';
  expectCode(schema.validateCatalog(data), 'UNKNOWN_VARIETY_DETECTION');
});

check('2.16 · rechaza capacidad METROCHEP inferior a EURO', () => {
  const data = clone(BASE);
  data.articles[0].palletization.formats.METROCHEP.maxLayers = 1;
  data.articles[0].palletization.formats.METROCHEP.boxesPerLayer = 5;
  expectCode(schema.validateCatalog(data), 'INCOMPATIBLE_FORMAT_CAPACITY');
});

check('2.17 · rechaza planning ausente', () => {
  const data = clone(BASE);
  delete data.articles[0].planning;
  expectCode(schema.validateCatalog(data), 'MISSING_PLANNING');
});

check('2.18 · rechaza variedad inexistente en varietyPreference', () => {
  const data = clone(BASE);
  data.articles[1].planning.varietyPreference = ['CONSABOR', 'NO_EXISTE'];
  expectCode(schema.validateCatalog(data), 'UNKNOWN_VARIETY_PREFERENCE');
});

check('2.19 · rechaza overrideGuard con tipo inválido', () => {
  const data = clone(BASE);
  data.articles[2].palletization.overrideGuard = 'sí';
  expectCode(schema.validateCatalog(data), 'INVALID_OVERRIDE_GUARD');
});

check('2.20 · acepta la salvaguarda de override de Cherry', () => {
  const result = schema.validateCatalog(BASE);
  assert.ok(result.valid, schema.formatIssues(result));
});

// =============================================================================
// 3. CUARTO ARTÍCULO DE PRUEBA (solo fixture, no producción)
// =============================================================================

function fixtureData() {
  const data = clone(BASE);
  data.articles.push({
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
    planning: { allocationStrategy: 'HAMILTON', fifoPriorityVariety: null, varietyPreference: [] }
  });
  return data;
}

check('3.1 · el cuarto artículo de prueba es válido para el esquema', () => {
  const result = schema.validateCatalog(fixtureData());
  assert.ok(result.valid, schema.formatIssues(result));
});

check('3.2 · buildCatalog deriva reglas y salvaguarda del cuarto artículo', () => {
  const built = catalog.buildCatalog(fixtureData());
  const article = built.products.TEST_KIWI;
  assert.ok(article, 'no se construyó TEST_KIWI');
  assert.strictEqual(built.palletRules.TEST_KIWI.EURO.maxStandardBoxes, 48);
  assert.strictEqual(built.palletRules.TEST_KIWI.EURO.boxHeightMm, 100);
  assert.strictEqual(built.palletGuards.TEST_KIWI.blockMetrochepBelowEuroCapacity, false);
});

check('3.3 · el catálogo de producción no contiene el artículo de prueba', () => {
  assert.strictEqual(BASE.articles.some(a => a.id === 'TEST_KIWI'), false);
  assert.strictEqual(catalog.DEFAULT_CATALOG.products.TEST_KIWI, undefined);
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

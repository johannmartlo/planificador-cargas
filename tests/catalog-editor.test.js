'use strict';

/**
 * V4.8 — Editor de catálogo: altas, edición, estados, validación y persistencia.
 *
 * Pruebas de lógica pura + integración real con parser/planLoad. No usa DOM.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const editor = require(path.join(ROOT, 'src', 'catalog-editor.js'));
const catalog = require(path.join(ROOT, 'src', 'catalog.js'));
const orchestrator = require(path.join(ROOT, 'src', 'orchestrator.js'));
const ui = require(path.join(ROOT, 'src', 'ui.js'));

const DEFAULT_DATA = editor.catalogDataFromDefault(catalog.DEFAULT_CATALOG);

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

function makeStorage() {
  const map = Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; },
    setItem(key, value) { map[key] = String(value); },
    removeItem(key) { delete map[key]; },
    _map: map
  };
}

function validDraft(overrides = {}) {
  return Object.assign(editor.createDraft(), {
    id: 'TEST_KIWI',
    name: 'TOMATE KIWI',
    shortName: 'Kiwi',
    status: 'ACTIVE',
    gisCodes: '99001',
    pattern: 'KIWI',
    boxLength: 500,
    boxWidth: 400,
    boxHeight: 100,
    euroPalletLength: 1200,
    euroPalletWidth: 800,
    euroBoxesPerLayer: 4,
    euroMaxLayers: 12,
    metroPalletLength: 1200,
    metroPalletWidth: 1000,
    metroBoxesPerLayer: 5,
    metroMaxLayers: 12
  }, overrides);
}

function createArticle() {
  const result = editor.applyDraft(DEFAULT_DATA, validDraft(), null);
  assert.ok(result.ok, JSON.stringify(result.errors));
  return result;
}

function planFor(data, demandOrders, stock) {
  return orchestrator.planLoad({
    demandOrders,
    stock,
    catalogConfig: catalog.buildCatalog(data)
  });
}

console.log('\n=== V4.8 · EDITOR DE CATÁLOGO ===\n');

check('1 · carga el catálogo por defecto sin almacenamiento', () => {
  const loaded = editor.loadCatalog(DEFAULT_DATA, null);
  assert.strictEqual(loaded.source, 'default');
  assert.strictEqual(loaded.data.articles.length, 3);
  assert.strictEqual(loaded.error, null);
});

check('2 · crea un artículo válido con sus datos', () => {
  const result = createArticle();
  const article = result.data.articles.find(a => a.id === 'TEST_KIWI');
  assert.ok(article, 'no se creó el artículo');
  assert.strictEqual(article.name, 'TOMATE KIWI');
  assert.strictEqual(article.status, 'ACTIVE');
  assert.deepStrictEqual(article.identification.gisCodes, ['99001']);
  assert.strictEqual(article.palletization.formats.EURO.boxesPerLayer, 4);
  assert.strictEqual(article.planning.allocationStrategy, 'HAMILTON');
  assert.strictEqual(result.data.articles.length, 4);
});

check('3 · el artículo nuevo se identifica, planifica y paletiza', () => {
  const created = createArticle();
  const config = catalog.buildCatalog(created.data);
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99001\tTOMATE KIWI\t50',
    stock: { 'TEST_KIWI': 50 },
    catalogConfig: config
  });
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.allocations[0].productId, 'TEST_KIWI');
  assert.strictEqual(result.allocations[0].allocatedQuantity, 50);
  assert.strictEqual(result.totalPallets, 2);
  assert.strictEqual(result.palletSummaries.groups[0].palletType, 'EURO');
});

check('4 · rechaza un identificador duplicado', () => {
  const result = editor.applyDraft(DEFAULT_DATA, validDraft({ id: 'PERA_RAMA' }), null);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(e => e.code === 'DUPLICATE_ARTICLE_ID'));
});

check('5 · rechaza un GIS duplicado', () => {
  const result = editor.applyDraft(DEFAULT_DATA, validDraft({ gisCodes: '14072' }), null);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(e => e.code === 'DUPLICATE_GIS'));
});

check('6 · rechaza campos obligatorios ausentes', () => {
  const result = editor.applyDraft(DEFAULT_DATA, editor.createDraft(), null);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(e => e.code === 'MISSING_NAME'));
  assert.ok(result.errors.some(e => e.code === 'MISSING_GIS'));
  assert.ok(result.errors.some(e => e.code === 'INVALID_BOX_DIMENSION'));
  assert.ok(result.errors.some(e => e.code === 'MISSING_PALLET_FORMATS'));
});

check('7 · rechaza capacidades de palet incoherentes', () => {
  const result = editor.applyDraft(DEFAULT_DATA, validDraft({ metroMaxLayers: 1 }), null);
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(e => e.code === 'INCOMPATIBLE_FORMAT_CAPACITY'));
});

check('8 · edita un artículo sin alterar los demás', () => {
  const before = clone(DEFAULT_DATA);
  const cocktail = before.articles.find(a => a.id === 'COCKTAIL_ROMANTICO');
  const draft = editor.draftFromArticle(cocktail);
  draft.name = 'COCKTAIL ROMÁNTICO EDITADO';
  const result = editor.applyDraft(before, draft, 'COCKTAIL_ROMANTICO');
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.strictEqual(result.data.articles[1].name, 'COCKTAIL ROMÁNTICO EDITADO');
  assert.deepStrictEqual(result.data.articles[0], before.articles[0]);
  assert.deepStrictEqual(result.data.articles[2], before.articles[2]);
  assert.deepStrictEqual(result.data.articles[1].varieties, cocktail.varieties);
  assert.deepStrictEqual(result.data.articles[1].planning, cocktail.planning);
});

check('9 · cancelar no muta el catálogo original', () => {
  const snapshot = JSON.stringify(DEFAULT_DATA);
  const result = editor.applyDraft(DEFAULT_DATA, validDraft({ id: 'PERA_RAMA' }), null);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(JSON.stringify(DEFAULT_DATA), snapshot);
});

check('10 · desactivar impide planificar y activar lo restaura', () => {
  const inactive = editor.setStatus(DEFAULT_DATA, 'PERA_RAMA', 'INACTIVE');
  assert.ok(inactive.ok);
  const inactiveResult = planFor(
    inactive.data,
    [{ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '20/10/2026' }],
    { 'PERA_RAMA': 10 }
  );
  assert.strictEqual(inactiveResult.allocations.length, 0);
  assert.ok(inactiveResult.errors.some(e => e.code === 'INACTIVE_ARTICLE'));

  const active = editor.setStatus(inactive.data, 'PERA_RAMA', 'ACTIVE');
  assert.ok(active.ok);
  const activeResult = planFor(
    active.data,
    [{ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '20/10/2026' }],
    { 'PERA_RAMA': 10 }
  );
  assert.strictEqual(activeResult.allocations[0].allocatedQuantity, 10);
  assert.strictEqual(activeResult.errors.length, 0);
});

check('11 · guarda y recarga el catálogo desde almacenamiento local', () => {
  const storage = makeStorage();
  const created = createArticle();
  const saved = editor.saveCatalog(created.data, storage);
  assert.ok(saved.ok);
  const reloaded = editor.loadCatalog(DEFAULT_DATA, storage);
  assert.strictEqual(reloaded.source, 'local');
  assert.strictEqual(reloaded.error, null);
  assert.ok(reloaded.data.articles.some(a => a.id === 'TEST_KIWI'));
});

check('12 · un catálogo local inválido se ignora y se informa', () => {
  const storage = makeStorage();
  storage.setItem(editor.STORAGE_KEY, '{no-json');
  const loaded = editor.loadCatalog(DEFAULT_DATA, storage);
  assert.strictEqual(loaded.source, 'default');
  assert.strictEqual(loaded.error.code, 'INVALID_LOCAL_CATALOG');
});

check('13 · sin almacenamiento no se finge un guardado', () => {
  const saved = editor.saveCatalog(DEFAULT_DATA, null);
  assert.strictEqual(saved.ok, false);
  assert.strictEqual(saved.code, 'STORAGE_UNAVAILABLE');
});

check('14 · restaurar elimina el catálogo local', () => {
  const storage = makeStorage();
  editor.saveCatalog(createArticle().data, storage);
  editor.resetCatalog(storage);
  const loaded = editor.loadCatalog(DEFAULT_DATA, storage);
  assert.strictEqual(loaded.source, 'default');
  assert.strictEqual(loaded.data.articles.length, 3);
});

check('15 · AppState persiste el alta y la recarga en una nueva instancia', () => {
  const storage = makeStorage();
  const state = new ui.AppState();
  state.initializeCatalog(storage);
  const result = state.saveCatalogArticle(validDraft(), null);
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.strictEqual(state.catalogSource, 'local');

  const reloaded = new ui.AppState();
  reloaded.initializeCatalog(storage);
  assert.strictEqual(reloaded.catalogSource, 'local');
  assert.ok(reloaded.getCatalogArticle('TEST_KIWI'));
});

check('16 · regresión del 18/09 con el catálogo por defecto', () => {
  const result = orchestrator.planLoad({
    rawText: ui.DATASETS['18_SEP'],
    stock: {
      'PERA_RAMA': 320,
      'COCKTAIL_ROMANTICO::CONSABOR': 0,
      'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
      'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
      'CHERRY_RAMA::SUNSTREAM': 100
    },
    catalogConfig: catalog.buildCatalog(editor.catalogDataFromDefault(catalog.DEFAULT_CATALOG))
  });
  assert.strictEqual(result.totalBoxes, 522);
  assert.strictEqual(result.totalPallets, 17);
  assert.strictEqual(result.totalPalletSlots, 9);
});

console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${total}`);
console.log(`PASADAS CON ÉXITO:    ${passed}`);
console.log(`FALLOS:               ${failures.length}`);
console.log('==================================================\n');

if (failures.length > 0) {
  process.exitCode = 1;
}

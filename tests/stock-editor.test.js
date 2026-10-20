'use strict';

/**
 * V4.8.2 — Stock dinámico: claves, validación, persistencia e integración.
 *
 * La clave real es (productId, varietyId); en el objeto de UI se conserva la
 * forma histórica sin `::` cuando no hay variedad.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const stock = require(path.join(ROOT, 'src', 'stock-editor.js'));
const editor = require(path.join(ROOT, 'src', 'catalog-editor.js'));
const catalog = require(path.join(ROOT, 'src', 'catalog.js'));
const orchestrator = require(path.join(ROOT, 'src', 'orchestrator.js'));
const ui = require(path.join(ROOT, 'src', 'ui.js'));

const DEFAULT_DATA = editor.catalogDataFromDefault(catalog.DEFAULT_CATALOG);
const DEFAULT_CONFIG = catalog.buildCatalog(DEFAULT_DATA);

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

function makeStorage() {
  const map = Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null; },
    setItem(key, value) { map[key] = String(value); },
    removeItem(key) { delete map[key]; },
    _map: map
  };
}

function draftFor(id, gis, name) {
  return Object.assign(editor.createDraft(), {
    id,
    name,
    shortName: name,
    status: 'ACTIVE',
    gisCodes: gis,
    pattern: name.replace(/\s+/g, '\\s+'),
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
  });
}

function createNewArticle() {
  const created = editor.applyDraft(DEFAULT_DATA, draftFor('TEST_KIWI', '99001', 'TOMATE KIWI'), null);
  assert.ok(created.ok, JSON.stringify(created.errors));
  return created;
}

function planWith(stockObj, rawText, demandOrders = null) {
  const options = {
    rawText,
    stock: stockObj,
    catalogConfig: DEFAULT_CONFIG
  };
  if (demandOrders) options.demandOrders = demandOrders;
  return orchestrator.planLoad(options);
}

console.log('\n=== V4.8.2 · STOCK DINÁMICO ===\n');

check('1 · normaliza la clave real artículo + variedad', () => {
  assert.deepStrictEqual(stock.parseStockKey('PERA_RAMA'), { productId: 'PERA_RAMA', varietyId: null });
  assert.deepStrictEqual(stock.parseStockKey('COCKTAIL_ROMANTICO::SAO_PAULO'),
    { productId: 'COCKTAIL_ROMANTICO', varietyId: 'SAO_PAULO' });
  assert.deepStrictEqual(stock.parseStockKey('TEST_KIWI::STANDARD'),
    { productId: 'TEST_KIWI', varietyId: null });
  assert.strictEqual(stock.canonicalStockKey('PERA_RAMA', null), 'PERA_RAMA::STANDARD');
  assert.strictEqual(stock.makeStockKey('PERA_RAMA', null), 'PERA_RAMA');
  assert.strictEqual(stock.makeStockKey('COCKTAIL_ROMANTICO', 'CONSABOR'), 'COCKTAIL_ROMANTICO::CONSABOR');
});

check('2 · acepta solo cajas enteras no negativas', () => {
  assert.strictEqual(stock.normalizeQuantity(0).value, 0);
  assert.strictEqual(stock.normalizeQuantity('120').value, 120);
  assert.strictEqual(stock.normalizeQuantity('').ok, false);
  assert.strictEqual(stock.normalizeQuantity('1.5').code, 'INVALID_STOCK_DECIMAL');
  assert.strictEqual(stock.normalizeQuantity(-1).code, 'INVALID_STOCK_NEGATIVE');
  assert.strictEqual(stock.normalizeQuantity('x').code, 'INVALID_STOCK_NAN');
  assert.strictEqual(stock.normalizeQuantity(0, { positive: true }).code, 'INVALID_STOCK_NON_POSITIVE');
});

check('3 · valida el objeto completo de stock', () => {
  assert.ok(stock.validateStockObject({ 'PERA_RAMA': 10, 'COCKTAIL_ROMANTICO::CONSABOR': 0 }).ok);
  const invalid = stock.validateStockObject({ '': 1, 'PERA_RAMA': -2 });
  assert.strictEqual(invalid.ok, false);
  assert.ok(invalid.errors.length >= 2);
  const duplicate = stock.validateStockObject({ 'PERA_RAMA': 10, 'PERA_RAMA::STANDARD': 5 });
  assert.strictEqual(duplicate.ok, false);
  assert.ok(duplicate.errors.some(e => e.code === 'DUPLICATE_STOCK_KEY'));
});

check('4 · carga el stock por defecto sin almacenamiento', () => {
  const loaded = stock.loadStock({ 'PERA_RAMA': 0 }, null);
  assert.strictEqual(loaded.source, 'default');
  assert.strictEqual(loaded.data['PERA_RAMA'], 0);
  assert.strictEqual(loaded.error, null);
});

check('5 · guarda y recarga stock desde almacenamiento local', () => {
  const storage = makeStorage();
  const saved = stock.saveStock({ 'PERA_RAMA': 120, 'TEST_KIWI': 50 }, storage);
  assert.ok(saved.ok);
  const loaded = stock.loadStock({ 'PERA_RAMA': 0 }, storage);
  assert.strictEqual(loaded.source, 'local');
  assert.strictEqual(loaded.data['PERA_RAMA'], 120);
  assert.strictEqual(loaded.data['TEST_KIWI'], 50);
});

check('6 · un stock local inválido se ignora y se informa', () => {
  const storage = makeStorage();
  storage.setItem(stock.STORAGE_KEY, '{"PERA_RAMA":-4}');
  const loaded = stock.loadStock({ 'PERA_RAMA': 0 }, storage);
  assert.strictEqual(loaded.source, 'default');
  assert.strictEqual(loaded.data['PERA_RAMA'], 0);
  assert.strictEqual(loaded.error.code, 'INVALID_LOCAL_STOCK');

  const storageDup = makeStorage();
  storageDup.setItem(stock.STORAGE_KEY, '{"PERA_RAMA":4,"PERA_RAMA::STANDARD":2}');
  const loadedDup = stock.loadStock({ 'PERA_RAMA': 0 }, storageDup);
  assert.strictEqual(loadedDup.source, 'default');
  assert.strictEqual(loadedDup.error.code, 'INVALID_LOCAL_STOCK');
  assert.ok(loadedDup.error.errors.some(e => e.code === 'DUPLICATE_STOCK_KEY'));
});

check('7 · sin almacenamiento no se finge un guardado', () => {
  const saved = stock.saveStock({ 'PERA_RAMA': 10 }, null);
  assert.strictEqual(saved.ok, false);
  assert.strictEqual(saved.code, 'STORAGE_UNAVAILABLE');
});

check('8 · acepta una línea de un artículo existente', () => {
  const result = stock.validateNewEntry(
    { productId: 'PERA_RAMA', varietyId: '', quantity: 50 },
    DEFAULT_CONFIG,
    {}
  );
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.strictEqual(result.stockKey, 'PERA_RAMA');
  assert.strictEqual(result.quantity, 50);
});

check('9 · acepta stock para un artículo recién creado', () => {
  const created = createNewArticle();
  const config = catalog.buildCatalog(created.data);
  const result = stock.validateNewEntry(
    { productId: 'TEST_KIWI', varietyId: '', quantity: 50 },
    config,
    {}
  );
  assert.ok(result.ok, JSON.stringify(result.errors));
  assert.strictEqual(result.stockKey, 'TEST_KIWI');
});

check('10 · rechaza artículos inexistentes e inactivos', () => {
  const unknown = stock.validateNewEntry(
    { productId: 'NO_EXISTE', varietyId: '', quantity: 10 },
    DEFAULT_CONFIG,
    {}
  );
  assert.strictEqual(unknown.ok, false);
  assert.strictEqual(unknown.errors[0].code, 'UNKNOWN_ARTICLE');

  const inactiveData = editor.setStatus(DEFAULT_DATA, 'PERA_RAMA', 'INACTIVE');
  const inactiveConfig = catalog.buildCatalog(inactiveData.data);
  const inactive = stock.validateNewEntry(
    { productId: 'PERA_RAMA', varietyId: '', quantity: 10 },
    inactiveConfig,
    {}
  );
  assert.strictEqual(inactive.ok, false);
  assert.strictEqual(inactive.errors[0].code, 'INACTIVE_ARTICLE');
});

check('11 · exige variedad cuando el artículo tiene varias', () => {
  const missing = stock.validateNewEntry(
    { productId: 'COCKTAIL_ROMANTICO', varietyId: '', quantity: 10 },
    DEFAULT_CONFIG,
    {}
  );
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.errors[0].code, 'MISSING_VARIETY');

  const valid = stock.validateNewEntry(
    { productId: 'COCKTAIL_ROMANTICO', varietyId: 'CONSABOR', quantity: 10 },
    DEFAULT_CONFIG,
    {}
  );
  assert.ok(valid.ok, JSON.stringify(valid.errors));
  assert.strictEqual(valid.stockKey, 'COCKTAIL_ROMANTICO::CONSABOR');
});

check('12 · impide duplicados según la clave canónica', () => {
  const duplicate = stock.validateNewEntry(
    { productId: 'PERA_RAMA', varietyId: '', quantity: 10 },
    DEFAULT_CONFIG,
    { 'PERA_RAMA::STANDARD': 5 }
  );
  assert.strictEqual(duplicate.ok, false);
  assert.strictEqual(duplicate.errors[0].code, 'DUPLICATE_STOCK_KEY');

  const duplicateLegacy = stock.validateNewEntry(
    { productId: 'PERA_RAMA', varietyId: '', quantity: 10 },
    DEFAULT_CONFIG,
    { 'PERA_RAMA': 5 }
  );
  assert.strictEqual(duplicateLegacy.ok, false);
  assert.strictEqual(duplicateLegacy.errors[0].code, 'DUPLICATE_STOCK_KEY');
});

check('13 · AppState edita, añade y recarga el stock persistido', () => {
  const storage = makeStorage();
  const state = new ui.AppState();
  state.initializeCatalog(storage);
  state.initializeStock(storage);
  assert.strictEqual(state.setStockItem('PERA_RAMA', 120).persisted, true);
  const duplicate = state.setStockItem('PERA_RAMA::STANDARD', 5);
  assert.strictEqual(duplicate.ok, false);
  assert.ok(duplicate.errors.some(e => e.code === 'DUPLICATE_STOCK_KEY'));
  assert.strictEqual(state.stock['PERA_RAMA'], 120);
  const created = state.saveCatalogArticle(draftFor('TEST_KIWI', '99001', 'TOMATE KIWI'), null);
  assert.ok(created.ok);
  const added = state.addStockLine('TEST_KIWI', '', 50);
  assert.ok(added.ok, JSON.stringify(added.errors));
  assert.strictEqual(added.persisted, true);

  const reloaded = new ui.AppState();
  reloaded.initializeCatalog(storage);
  reloaded.initializeStock(storage);
  assert.strictEqual(reloaded.stock['PERA_RAMA'], 120);
  assert.strictEqual(reloaded.stock['TEST_KIWI'], 50);
  assert.ok(reloaded.getCatalogArticle('TEST_KIWI'));
});

check('14 · el plan no asigna más cajas que el stock disponible', () => {
  const created = createNewArticle();
  const config = catalog.buildCatalog(created.data);
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99001\tTOMATE KIWI\t80',
    stock: { 'TEST_KIWI': 50 },
    catalogConfig: config
  });
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.allocations[0].allocatedQuantity, 50);
  assert.strictEqual(result.allocations[0].missingQuantity, 30);
  assert.strictEqual(result.totalBoxes, 50);
  assert.strictEqual(result.totalPallets, 2);
});

check('15 · editar stock existente se refleja en el motor', () => {
  const result = planWith({ 'PERA_RAMA': 10 }, 'CENTRO\t26/08/2026\t14072\tTOMATE PERA RAMA\t20');
  assert.strictEqual(result.allocations[0].allocatedQuantity, 10);
  assert.strictEqual(result.allocations[0].missingQuantity, 10);
  assert.strictEqual(result.totalBoxes, 10);
});

check('16 · regresión 18/09 con stock persistido y por defecto', () => {
  const storage = makeStorage();
  const stock18 = {
    'PERA_RAMA': 320,
    'COCKTAIL_ROMANTICO::CONSABOR': 0,
    'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
    'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
    'CHERRY_RAMA::SUNSTREAM': 100
  };
  assert.ok(stock.saveStock(stock18, storage).ok);
  const loaded = stock.loadStock({}, storage);
  const result = orchestrator.planLoad({
    rawText: ui.DATASETS['18_SEP'],
    stock: loaded.data,
    catalogConfig: DEFAULT_CONFIG
  });
  assert.strictEqual(result.totalBoxes, 522);
  assert.strictEqual(result.totalPallets, 17);
  assert.strictEqual(result.totalPalletSlots, 9);
});

check('17 · una clave plana hereda la variedad por defecto del catálogo', () => {
  const storage = makeStorage();
  assert.ok(stock.saveStock({ 'CHERRY_RAMA': 5 }, storage, DEFAULT_CONFIG).ok);
  const loaded = stock.loadStock({}, storage, DEFAULT_CONFIG);
  assert.strictEqual(loaded.data['CHERRY_RAMA::SUNSTREAM'], 5);
  assert.strictEqual(loaded.data['CHERRY_RAMA'], undefined);

  const duplicate = stock.validateNewEntry(
    { productId: 'CHERRY_RAMA', varietyId: 'SUNSTREAM', quantity: 10 },
    DEFAULT_CONFIG,
    { 'CHERRY_RAMA': 5 }
  );
  assert.strictEqual(duplicate.ok, false);
  assert.strictEqual(duplicate.errors[0].code, 'DUPLICATE_STOCK_KEY');
});

console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${total}`);
console.log(`PASADAS CON ÉXITO:    ${passed}`);
console.log(`FALLOS:               ${failures.length}`);
console.log('==================================================\n');

if (failures.length > 0) {
  process.exitCode = 1;
}

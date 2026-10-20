'use strict';

/**
 * V4.8.2 — UI del stock dinámico.
 *
 * Monta el index.html completo sobre el mini-DOM y ejercita la tabla, el alta
 * de existencias, la validación, el estado inactivo y la recarga local.
 * No es una comprobación visual real de navegador.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const ROOT = path.join(__dirname, '..');
const ui = require(path.join(ROOT, 'src', 'ui.js'));
const editor = require(path.join(ROOT, 'src', 'catalog-editor.js'));
const stockEditor = require(path.join(ROOT, 'src', 'stock-editor.js'));
const orchestrator = require(path.join(ROOT, 'src', 'orchestrator.js'));
const catalog = require(path.join(ROOT, 'src', 'catalog.js'));
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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

function setup(storage = makeStorage()) {
  const doc = createDocument(INDEX_HTML);
  global.document = doc;
  global.window = {
    location: { search: '' },
    addEventListener() {},
    scrollTo() {},
    requestAnimationFrame: undefined,
    confirm: () => true,
    matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} })
  };
  global.localStorage = storage;
  const state = new ui.AppState();
  const controller = new ui.UIController(state);
  controller.bindDOM();
  return { doc, storage, state, controller };
}

function cleanup() {
  delete global.document;
  delete global.window;
  delete global.localStorage;
}

function draftFor() {
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
  });
}

function editStockInput(doc, id, value) {
  const input = doc.getElementById(id);
  assert.ok(input, `no existe #${id}`);
  input.value = String(value);
  input.dispatchEvent({ type: 'input', target: input });
  return input;
}

console.log('\n=== V4.8.2 · UI DE STOCK DINÁMICO ===\n');

check('1 · renderiza las cinco líneas iniciales y el alta desde catálogo', () => {
  const ctx = setup();
  const expected = ['stock-pera', 'stock-cocktail-consabor', 'stock-cocktail-sp', 'stock-cocktail-sun', 'stock-cherry-sun'];
  expected.forEach(id => assert.ok(ctx.doc.getElementById(id), `falta #${id}`));
  assert.strictEqual(ctx.doc.querySelectorAll('#stock-rows input[data-stock-key]').length, 5);
  assert.ok(ctx.doc.getElementById('stock-add-article').innerHTML.includes('PERA_RAMA'));
  assert.ok(ctx.doc.getElementById('stock-persistence-note').textContent.includes('este navegador'));
  cleanup();
});

check('2 · editar una cantidad actualiza AppState y localStorage', () => {
  const ctx = setup();
  editStockInput(ctx.doc, 'stock-pera', 120);
  assert.strictEqual(ctx.state.stock['PERA_RAMA'], 120);
  const persisted = JSON.parse(ctx.storage.getItem(stockEditor.STORAGE_KEY));
  assert.strictEqual(persisted['PERA_RAMA'], 120);
  cleanup();
});

check('3 · una cantidad inválida muestra error y no sobrescribe el stock', () => {
  const ctx = setup();
  editStockInput(ctx.doc, 'stock-pera', 120);
  editStockInput(ctx.doc, 'stock-pera', '1.5');
  assert.strictEqual(ctx.state.stock['PERA_RAMA'], 120);
  const error = ctx.doc.getElementById('stock-err-stock-pera');
  assert.strictEqual(error.classList.contains('hidden'), false);
  assert.ok(error.textContent.includes('entero') || error.textContent.includes('decimal'));
  cleanup();
});

check('4 · añadir stock de un artículo nuevo desde la UI', () => {
  const ctx = setup();
  const created = ctx.state.saveCatalogArticle(draftFor(), null);
  assert.ok(created.ok, JSON.stringify(created.errors));
  ctx.controller.renderStockRows();
  ctx.controller.renderStockAddOptions();
  assert.ok(ctx.doc.getElementById('stock-add-article').innerHTML.includes('TEST_KIWI'));

  const articleEl = ctx.doc.getElementById('stock-add-article');
  articleEl.value = 'TEST_KIWI';
  ctx.controller.refreshStockVarietyOptions();
  ctx.doc.getElementById('stock-add-quantity').value = '50';
  ctx.doc.getElementById('btn-add-stock-line').click();

  assert.strictEqual(ctx.state.stock['TEST_KIWI'], 50);
  assert.ok(ctx.doc.getElementById('stock-test-kiwi'), 'falta la fila del artículo nuevo');
  const persisted = JSON.parse(ctx.storage.getItem(stockEditor.STORAGE_KEY));
  assert.strictEqual(persisted['TEST_KIWI'], 50);
  cleanup();
});

check('5 · no permite duplicar una línea por la clave canónica', () => {
  const ctx = setup();
  const articleEl = ctx.doc.getElementById('stock-add-article');
  articleEl.value = 'PERA_RAMA';
  ctx.controller.refreshStockVarietyOptions();
  ctx.doc.getElementById('stock-add-quantity').value = '10';
  ctx.doc.getElementById('btn-add-stock-line').click();

  const error = ctx.doc.getElementById('stock-add-error');
  assert.strictEqual(error.classList.contains('hidden'), false);
  assert.ok(error.textContent.includes('Ya existe'));
  assert.strictEqual(ctx.state.stock['PERA_RAMA'], 0);
  cleanup();
});

check('6 · un artículo inactivo conserva su stock pero no admite líneas nuevas', () => {
  const ctx = setup();
  editStockInput(ctx.doc, 'stock-pera', 120);
  const changed = ctx.state.setCatalogArticleStatus('PERA_RAMA', 'INACTIVE');
  assert.ok(changed.ok);
  ctx.controller.renderStockRows();
  ctx.controller.renderStockAddOptions();

  assert.ok(ctx.doc.getElementById('stock-pera'), 'la existencia histórica no debe desaparecer');
  assert.strictEqual(ctx.state.stock['PERA_RAMA'], 120);
  assert.strictEqual(ctx.doc.getElementById('stock-add-article').innerHTML.includes('PERA_RAMA'), false);
  const rejected = ctx.state.addStockLine('PERA_RAMA', '', 5);
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.errors[0].code, 'INACTIVE_ARTICLE');
  cleanup();
});

check('7 · rechaza una referencia a un artículo inexistente', () => {
  const ctx = setup();
  const result = ctx.state.addStockLine('NO_EXISTE', '', 5);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.errors[0].code, 'UNKNOWN_ARTICLE');
  cleanup();
});

check('8 · recargar la aplicación conserva el catálogo y el stock', () => {
  const ctx = setup();
  ctx.state.saveCatalogArticle(draftFor(), null);
  ctx.state.addStockLine('TEST_KIWI', '', 50);
  const reloaded = new ui.AppState();
  assert.ok(reloaded.getCatalogArticle('TEST_KIWI'));
  assert.strictEqual(reloaded.stock['TEST_KIWI'], 50);
  cleanup();
});

check('9 · sin almacenamiento se avisa y no se finge persistencia', () => {
  const ctx = setup();
  ctx.state.saveCatalogArticle(draftFor(), null);
  ctx.state.initializeStock(null);
  const result = ctx.state.addStockLine('TEST_KIWI', '', 50);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.persisted, false);
  assert.ok(ctx.state.stockStorageError);
  ctx.controller.updateStockPersistenceNote();
  assert.ok(ctx.doc.getElementById('stock-persistence-note').textContent.includes('No se pudo guardar'));
  assert.strictEqual(ctx.doc.getElementById('stock-storage-error').classList.contains('hidden'), false);
  cleanup();
});

check('10 · el stock añadido se integra con parser y motor sin exceder existencias', () => {
  const ctx = setup();
  ctx.state.saveCatalogArticle(draftFor(), null);
  assert.strictEqual(ctx.state.addStockLine('TEST_KIWI', '', 50).ok, true);
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99001\tTOMATE KIWI\t80',
    stock: { ...ctx.state.stock },
    catalogConfig: ctx.state.catalogConfig
  });
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.allocations[0].productId, 'TEST_KIWI');
  assert.strictEqual(result.allocations[0].allocatedQuantity, 50);
  assert.strictEqual(result.allocations[0].missingQuantity, 30);
  cleanup();
});

check('11 · la tabla usa el layout responsive existente', () => {
  const ctx = setup();
  const rows = ctx.doc.getElementById('stock-rows');
  assert.ok(rows.innerHTML.includes('grid-cols-12'));
  assert.ok(rows.innerHTML.includes('stock-stepper'));
  assert.ok(rows.innerHTML.includes('data-stock-key'));
  cleanup();
});

console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${total}`);
console.log(`PASADAS CON ÉXITO:    ${passed}`);
console.log(`FALLOS:               ${failures.length}`);
console.log('==================================================\n');

if (failures.length > 0) {
  process.exitCode = 1;
}

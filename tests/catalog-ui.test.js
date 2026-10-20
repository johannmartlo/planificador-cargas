'use strict';

/**
 * V4.8 — UI del catálogo: render, alta, edición, cancelación, estados y reset.
 *
 * Usa el mini-DOM del proyecto. No es un navegador real: valida la lógica de
 * presentación y el cableado de los controles del catálogo.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const ROOT = path.join(__dirname, '..');
const ui = require(path.join(ROOT, 'src', 'ui.js'));
const orchestrator = require(path.join(ROOT, 'src', 'orchestrator.js'));

const BODY = `
  <div id="toast-action-feedback"></div>
  <span id="catalog-source-badge"></span>
  <p id="catalog-persistence-note"></p>
  <p id="catalog-load-error" class="hidden"></p>
  <div id="catalog-articles-list"></div>
  <select id="order-product"></select>
  <button id="btn-catalog-new"></button>
  <button id="btn-catalog-reset"></button>
  <button id="btn-catalog-back"></button>
  <button id="btn-more-catalog"></button>
  <button id="btn-open-catalog-desktop"></button>
  <div id="catalog-editor-panel" class="hidden">
    <h3 id="catalog-form-title"></h3>
    <div id="catalog-form-error" class="hidden"></div>
    <p id="catalog-form-note"></p>
    <input id="catalog-id" />
    <input id="catalog-name" />
    <input id="catalog-short-name" />
    <select id="catalog-status"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select>
    <input id="catalog-gis" />
    <input id="catalog-pattern" />
    <input id="catalog-box-length" />
    <input id="catalog-box-width" />
    <input id="catalog-box-height" />
    <input id="catalog-euro-pallet-length" />
    <input id="catalog-euro-pallet-width" />
    <input id="catalog-euro-boxes-per-layer" />
    <input id="catalog-euro-max-layers" />
    <input id="catalog-metro-pallet-length" />
    <input id="catalog-metro-pallet-width" />
    <input id="catalog-metro-boxes-per-layer" />
    <input id="catalog-metro-max-layers" />
    <button id="btn-catalog-save"></button>
    <button id="btn-catalog-cancel"></button>
  </div>
`;

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

function setup() {
  const doc = createDocument(BODY);
  global.document = doc;
  global.window = { confirm: () => true };
  const storage = makeStorage();
  global.localStorage = storage;
  const state = new ui.AppState();
  state.initializeCatalog(storage);
  const controller = new ui.UIController(state);
  controller.bindCatalogEvents();
  controller.renderCatalog();
  return { doc, storage, state, controller };
}

function setValues(doc, values) {
  Object.keys(values).forEach(id => {
    const el = doc.getElementById(id);
    if (el) el.value = String(values[id]);
  });
}

function fillNewArticle(doc) {
  setValues(doc, {
    'catalog-id': 'TEST_KIWI',
    'catalog-name': 'TOMATE KIWI',
    'catalog-short-name': 'Kiwi',
    'catalog-status': 'ACTIVE',
    'catalog-gis': '99001',
    'catalog-pattern': 'KIWI',
    'catalog-box-length': 500,
    'catalog-box-width': 400,
    'catalog-box-height': 100,
    'catalog-euro-pallet-length': 1200,
    'catalog-euro-pallet-width': 800,
    'catalog-euro-boxes-per-layer': 4,
    'catalog-euro-max-layers': 12,
    'catalog-metro-pallet-length': 1200,
    'catalog-metro-pallet-width': 1000,
    'catalog-metro-boxes-per-layer': 5,
    'catalog-metro-max-layers': 12
  });
}

console.log('\n=== V4.8 · UI DEL CATÁLOGO ===\n');

check('1 · renderiza el catálogo y la fuente por defecto', () => {
  const { doc, controller } = setup();
  const list = doc.getElementById('catalog-articles-list');
  assert.ok(list.innerHTML.includes('PERA_RAMA'));
  assert.ok(list.innerHTML.includes('COCKTAIL_ROMANTICO'));
  assert.ok(list.innerHTML.includes('CHERRY_RAMA'));
  assert.ok(doc.getElementById('catalog-source-badge').textContent.includes('POR DEFECTO'));
  assert.ok(doc.getElementById('catalog-persistence-note').textContent.includes('este navegador'));
  assert.ok(controller);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('2 · el botón Nuevo abre el formulario en modo alta', () => {
  const { doc } = setup();
  doc.getElementById('btn-catalog-new').click();
  const panel = doc.getElementById('catalog-editor-panel');
  assert.strictEqual(panel.classList.contains('hidden'), false);
  assert.strictEqual(doc.getElementById('catalog-id').readOnly, false);
  assert.ok(doc.getElementById('catalog-form-title').textContent.includes('Nuevo'));
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('3 · guardar un artículo válido actualiza lista, estado y almacenamiento', () => {
  const ctx = setup();
  ctx.doc.getElementById('btn-catalog-new').click();
  fillNewArticle(ctx.doc);
  const ok = ctx.controller.handleCatalogSave();
  assert.strictEqual(ok, true);
  assert.ok(ctx.state.getCatalogArticle('TEST_KIWI'));
  assert.strictEqual(ctx.state.catalogSource, 'local');
  assert.ok(ctx.storage.getItem('planificador-catalog-v1'));
  assert.ok(ctx.doc.getElementById('catalog-articles-list').innerHTML.includes('TEST_KIWI'));
  assert.ok(ctx.doc.getElementById('order-product').innerHTML.includes('TEST_KIWI'));
  assert.strictEqual(ctx.doc.getElementById('catalog-editor-panel').classList.contains('hidden'), true);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('4 · cancelar una edición no cambia el artículo original', () => {
  const ctx = setup();
  ctx.controller.openCatalogEditor('PERA_RAMA');
  ctx.doc.getElementById('catalog-name').value = 'PERA CAMBIADA';
  ctx.controller.closeCatalogEditor();
  assert.strictEqual(ctx.state.getCatalogArticle('PERA_RAMA').name, 'TOMATE PERA RAMA');
  assert.strictEqual(ctx.doc.getElementById('catalog-editor-panel').classList.contains('hidden'), true);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('5 · editar y guardar no altera los otros artículos', () => {
  const ctx = setup();
  const beforeCherry = JSON.stringify(ctx.state.getCatalogArticle('CHERRY_RAMA'));
  ctx.controller.openCatalogEditor('PERA_RAMA');
  ctx.doc.getElementById('catalog-name').value = 'PERA EDITADA';
  assert.strictEqual(ctx.controller.handleCatalogSave(), true);
  assert.strictEqual(ctx.state.getCatalogArticle('PERA_RAMA').name, 'PERA EDITADA');
  assert.strictEqual(JSON.stringify(ctx.state.getCatalogArticle('CHERRY_RAMA')), beforeCherry);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('6 · desactivar un artículo lo excluye y el motor no lo planifica', () => {
  const ctx = setup();
  ctx.doc.getElementById('btn-catalog-new').click();
  fillNewArticle(ctx.doc);
  assert.strictEqual(ctx.controller.handleCatalogSave(), true);
  assert.strictEqual(ctx.controller.handleCatalogStatus('TEST_KIWI', 'INACTIVE'), true);
  assert.strictEqual(ctx.state.getCatalogArticle('TEST_KIWI').status, 'INACTIVE');
  assert.strictEqual(ctx.state.getActiveCatalogArticles().some(a => a.id === 'TEST_KIWI'), false);
  assert.strictEqual(ctx.doc.getElementById('order-product').innerHTML.includes('TEST_KIWI'), false);
  const result = orchestrator.planLoad({
    demandOrders: [{ platform: 'CENTRO', productId: 'TEST_KIWI', cajas: 10, fechaEntrega: '20/10/2026' }],
    stock: { 'TEST_KIWI': 10 },
    catalogConfig: ctx.state.catalogConfig
  });
  assert.ok(result.errors.some(e => e.code === 'INACTIVE_ARTICLE'));
  assert.strictEqual(result.allocations.length, 0);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('7 · restaurar vuelve al catálogo por defecto y limpia el almacenamiento', () => {
  const ctx = setup();
  ctx.doc.getElementById('btn-catalog-new').click();
  fillNewArticle(ctx.doc);
  ctx.controller.handleCatalogSave();
  assert.ok(ctx.state.getCatalogArticle('TEST_KIWI'));
  assert.strictEqual(ctx.controller.handleCatalogReset(), true);
  assert.strictEqual(ctx.state.catalogSource, 'default');
  assert.strictEqual(ctx.state.getCatalogArticle('TEST_KIWI'), null);
  assert.strictEqual(ctx.storage.getItem('planificador-catalog-v1'), null);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('8 · recargar la aplicación conserva el catálogo guardado', () => {
  const ctx = setup();
  ctx.doc.getElementById('btn-catalog-new').click();
  fillNewArticle(ctx.doc);
  ctx.controller.handleCatalogSave();
  const reloaded = new ui.AppState();
  reloaded.initializeCatalog(ctx.storage);
  assert.ok(reloaded.getCatalogArticle('TEST_KIWI'));
  assert.strictEqual(reloaded.catalogSource, 'local');
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('9 · cancelar la confirmación no desactiva el artículo', () => {
  const ctx = setup();
  const original = ctx.state.getCatalogArticle('PERA_RAMA').status;
  global.window.confirm = () => false;
  assert.strictEqual(ctx.controller.handleCatalogStatus('PERA_RAMA', 'INACTIVE'), false);
  assert.strictEqual(ctx.state.getCatalogArticle('PERA_RAMA').status, original);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('10 · los errores de validación se muestran sin "undefined"', () => {
  const ctx = setup();
  ctx.doc.getElementById('btn-catalog-new').click();
  assert.strictEqual(ctx.controller.handleCatalogSave(), false);
  const errorBox = ctx.doc.getElementById('catalog-form-error');
  assert.strictEqual(errorBox.classList.contains('hidden'), false);
  assert.ok(errorBox.textContent.length > 0);
  assert.ok(errorBox.textContent.indexOf('undefined') === -1);
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

check('11 · index.html cablea la vista y los módulos en el orden correcto', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ['catalog-section', 'catalog-articles-list', 'btn-more-catalog', 'btn-open-catalog-desktop',
    'stock-rows', 'stock-add-article', 'btn-add-stock-line']
    .forEach(id => assert.ok(html.includes(`id="${id}"`), `falta #${id}`));
  const scripts = ['catalog-data.js', 'catalog.js', 'catalog-schema.js', 'catalog-editor.js', 'stock-editor.js', 'ui.js'];
  let last = -1;
  scripts.forEach(name => {
    const idx = html.indexOf(`src/${name}`);
    assert.ok(idx > last, `orden incorrecto o falta src/${name}`);
    last = idx;
  });
  const build = fs.readFileSync(path.join(ROOT, 'tools', 'build-gas.js'), 'utf8');
  let buildLast = -1;
  scripts.forEach(name => {
    const idx = build.indexOf(`'${name}'`);
    assert.ok(idx > buildLast, `build-gas no incluye o desordena ${name}`);
    buildLast = idx;
  });
});

console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${total}`);
console.log(`PASADAS CON ÉXITO:    ${passed}`);
console.log(`FALLOS:               ${failures.length}`);
console.log('==================================================\n');

if (failures.length > 0) {
  process.exitCode = 1;
}

/**
 * PHASE 19 — §21 PRUEBA FUNCIONAL OBLIGATORIA (pre-push)
 *
 * Caso exigido:
 *   Forecast: CENTRO · 26/08/2026 · 16228 · TOMATE COCKT.ROMANT.CARREFOUR · 80
 *   Stock:    CONSABOR = 100, SUNSTREAM = 0, SAO_PAULO = 0
 *   Esperado: CENTRO -> 80 CONSABOR, 0 pendientes
 *
 * Se comprueba además: TOTAL COCKTAIL = 80, WhatsApp CONSABOR = 80 cjs,
 * monovarietalidad, paletización y replanificación.
 *
 * Se ejecuta contra el MISMO código que se va a subir a Apps Script:
 *   src/parser.js, src/hamilton.js, src/cocktail-solver.js,
 *   src/palletizer.js, src/orchestrator.js, src/ui.js
 *
 * Uso: node tests/gas-functional-check.js
 */
'use strict';

const path = require('path');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const ui = require(path.join(SRC, 'ui.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const FORECAST = [
  'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80'
].join('\n');

const STOCK_CONSABOR_ONLY = {
  'PERA_RAMA': 0,
  'COCKTAIL_ROMANTICO::CONSABOR': 100,
  'COCKTAIL_ROMANTICO::SAO_PAULO': 0,
  'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
  'CHERRY_RAMA::SUNSTREAM': 0
};

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: (e && e.message) || String(e) }); }
}

// ---------------------------------------------------------------------------
// 1. Motor puro (orchestrator.planLoad)
// ---------------------------------------------------------------------------
const result = orchestrator.planLoad({
  rawText: FORECAST,
  stock: { ...STOCK_CONSABOR_ONLY },
  locks: [],
  exclusions: [],
  palletConfiguration: {}
});

const alloc = result.allocations.filter(a => a.allocatedQuantity > 0);
const cockAlloc = result.allocations.filter(a => a.productId === 'COCKTAIL_ROMANTICO');

check('Forecast · el parser reconoce la línea y detecta la fecha', () => {
  assert.strictEqual(result.deliveryDate, '26/08/2026', `fecha detectada: ${result.deliveryDate}`);
  assert.strictEqual(result.demandSummary.totalRequested, 80,
    `demanda total: ${result.demandSummary.totalRequested}`);
});

check('Stock · el plan asigna exactamente 80 cajas a CENTRO', () => {
  assert.strictEqual(result.totalBoxes, 80, `cajas asignadas: ${result.totalBoxes}`);
  assert.strictEqual(alloc.length, 1, `asignaciones con cajas: ${alloc.length}`);
  assert.strictEqual(alloc[0].platform, 'CENTRO');
  assert.strictEqual(alloc[0].allocatedQuantity, 80);
});

check('CONSABOR · CENTRO recibe 80 CONSABOR (variedad de Cocktail)', () => {
  assert.strictEqual(cockAlloc.length, 1, `asignaciones de Cocktail: ${cockAlloc.length}`);
  const a = cockAlloc[0];
  assert.strictEqual(a.productId, 'COCKTAIL_ROMANTICO');
  assert.strictEqual(a.varietyId, 'CONSABOR', `variedad asignada: ${a.varietyId}`);
  assert.strictEqual(a.allocatedQuantity, 80);
});

check('CONSABOR · no se crea un producto CONSABOR', () => {
  const productIds = Array.from(new Set(result.allocations.map(a => a.productId)));
  assert.deepStrictEqual(productIds, ['COCKTAIL_ROMANTICO'],
    `productos presentes: ${productIds.join(', ')}`);
  const summary = ui.computeServedTotalsByArticle(result);
  assert.ok(!summary.totalsList.some(t => t.article === 'CONSABOR'),
    'CONSABOR no debe ser artículo independiente');
});

check('Pendientes · 0 cajas pendientes', () => {
  const missing = result.allocations.reduce((s, a) => s + a.missingQuantity, 0);
  assert.strictEqual(missing, 0, `cajas pendientes: ${missing}`);
});

check('Monovarietalidad · CENTRO recibe una sola variedad de Cocktail', () => {
  const varieties = Array.from(new Set(cockAlloc.map(a => a.varietyId)));
  assert.strictEqual(varieties.length, 1, `variedades en CENTRO: ${varieties.join(', ')}`);
  assert.strictEqual(varieties[0], 'CONSABOR');
});

check('FIFO · SAO_PAULO a 0 no impide servir CONSABOR', () => {
  const sp = result.allocations.find(a => a.varietyId === 'SAO_PAULO');
  assert.ok(!sp || sp.allocatedQuantity === 0, 'no debe servirse SAO_PAULO sin stock');
});

check('Paletización · EURO con palets físicos y slots coherentes', () => {
  assert.strictEqual(result.totalPallets, 1, `palets físicos: ${result.totalPallets}`);
  const groups = result.palletSummaries.groups;
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].palletType, 'EURO', `formato: ${groups[0].palletType}`);
  assert.strictEqual(groups[0].totalBoxes, 80);
  assert.strictEqual(groups[0].palletCount, 1);
});

check('Torres · una torre con altura dentro del gálibo', () => {
  const stacking = result.palletSummaries.stackingPlanByPlatform || {};
  const plan = stacking.CENTRO;
  assert.ok(plan && Array.isArray(plan.towers), 'falta el stacking plan de CENTRO');
  assert.strictEqual(plan.towers.length, 1, `torres: ${plan.towers.length}`);
  const t = plan.towers[0];
  assert.ok(t.towerHeightMm <= t.maxTowerHeightMm,
    `altura ${t.towerHeightMm} > gálibo ${t.maxTowerHeightMm}`);
});

check('TOTAL COCKTAIL = 80 (cajas servidas)', () => {
  const summary = ui.computeServedTotalsByArticle(result);
  const cocktail = summary.totalsList.find(t => t.article === 'COCKTAIL');
  assert.ok(cocktail, 'falta TOTAL COCKTAIL');
  assert.strictEqual(cocktail.servedBoxes, 80, `TOTAL COCKTAIL: ${cocktail.servedBoxes}`);
  assert.strictEqual(summary.grandTotal, 80, `total global: ${summary.grandTotal}`);
  assert.deepStrictEqual(summary.totalsList.map(t => t.formattedText), ['TOTAL COCKTAIL: 80']);
});

check('WhatsApp · el mensaje incluye CONSABOR 80 cjs', () => {
  const msg = ui.formatWhatsAppMessage(result);
  assert.ok(msg.includes('CENTRO'), 'el mensaje no incluye CENTRO');
  assert.ok(/CONSABOR/.test(msg), `el mensaje no rotula CONSABOR:\n${msg}`);
  assert.ok(/80/.test(msg), 'el mensaje no incluye 80 cajas');
  assert.ok(!/TOTAL CONSABOR/i.test(msg), 'el mensaje no debe crear TOTAL CONSABOR');
});

// ---------------------------------------------------------------------------
// 2. Replanificación vía UIController (comportamiento real de la SPA)
// ---------------------------------------------------------------------------
check('Replanificación · stock 100 -> 40 recalcula y conserva la demanda', () => {
  const document = createDocument('<main data-view="plan"></main>');
  global.document = document;
  if (typeof global.window === 'undefined') {
    global.window = { location: { search: '' }, addEventListener() {}, scrollTo() {} };
  }

  const state = new ui.AppState();
  const controller = new ui.UIController(state);

  state.setRawText(FORECAST);
  state.setStock({ ...STOCK_CONSABOR_ONLY });
  const first = controller.generatePlan();
  assert.strictEqual(first.totalBoxes, 80, `primer plan: ${first.totalBoxes}`);
  assert.strictEqual(state.planState, 'PLAN_ACTUALIZADO');

  // Merma de stock -> plan desactualizado
  state.setStockItem('COCKTAIL_ROMANTICO::CONSABOR', 40);
  assert.strictEqual(state.planState, 'PLAN_DESACTUALIZADO', 'el plan debe quedar stale');

  const second = controller.recalculatePlan();
  assert.strictEqual(second.demandSummary.totalRequested, 80,
    'la demanda original debe conservarse');
  assert.strictEqual(second.totalBoxes, 40, `tras recalcular: ${second.totalBoxes}`);
  assert.strictEqual(
    second.allocations.reduce((s, a) => s + a.missingQuantity, 0), 40,
    'deben quedar 40 cajas pendientes');
  assert.strictEqual(state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(state.previousResult, first, 'debe preservarse el plan anterior');
});

// ---------------------------------------------------------------------------
// 3. PDF: la ruta de totales impresos funciona con este dataset
// ---------------------------------------------------------------------------
check('PDF · la cabecera de impresión lista TOTAL COCKTAIL: 80', () => {
  const document = createDocument(
    '<div id="print-articles-totals-list"></div><span id="print-grand-total-boxes"></span>'
  );
  global.document = document;
  const controller = new ui.UIController(new ui.AppState());
  controller.renderPrintHeaderSummary(result);

  const html = document.getElementById('print-articles-totals-list').innerHTML;
  assert.ok(html.includes('TOTAL COCKTAIL: 80'),
    `TOTAL COCKTAIL ausente. Cabecera real: ${JSON.stringify(html)}`);
  const grand = String(document.getElementById('print-grand-total-boxes').textContent);
  assert.strictEqual(grand, '80', `total global impreso: ${JSON.stringify(grand)}`);
  assert.ok(!/TOTAL CONSABOR/i.test(html), 'CONSABOR no debe ser artículo en el PDF');
});

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
let failed = 0;
console.log('\n=== FASE 19 · PRUEBA FUNCIONAL OBLIGATORIA (§21) ===\n');
for (const r of results) {
  if (r.ok) {
    console.log(`  PASS  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
process.exit(failed === 0 ? 0 : 1);

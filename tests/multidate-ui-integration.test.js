'use strict';

/**
 * PLANIFICADOR DE CARGAS V4.6 — PASO 4
 * PRUEBAS DE INTEGRACIÓN UI ↔ MOTOR DE ASIGNACIÓN GLOBAL MULTIFECHA
 *
 * Contratos verificados:
 *  1. La UI entrega TODOS los pedidos activos: una sola bolsa global de stock.
 *  2. Cambiar de fecha NO reejecuta el reparto ni consume stock adicional.
 *  3. La fecha sin pedidos muestra un plan vacío, nunca el de otra fecha.
 *  4. Los pedidos sin fecha tienen contexto propio ("Sin fecha"), visible y
 *     contabilizado una sola vez.
 *  5. PDF, impresión y WhatsApp muestran exclusivamente la fecha seleccionada.
 *  6. `globalAllocation` coincide con la suma de asignaciones de `plansByDate`.
 *  7. warnings/errors no se duplican.
 */

const assert = require('assert');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ui = require(path.join(SRC, 'ui.js'));
const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const { AppState, UIController, formatWhatsAppMessage } = ui;

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

const PRINT_DOM = `
  <div id="consolidated-forecast-container">
    <span id="consolidated-count-badge"></span>
    <div id="delivery-date-selector-container"></div>
    <div id="consolidated-platforms-list"></div>
    <div id="consolidated-orders-table-body"></div>
  </div>
  <span id="badge-delivery-date"></span>
  <span id="badge-delivery-date-desktop"></span>
  <span id="badge-plan-status"></span>
  <div id="results-column">
    <div id="print-doc-header">
      <span id="print-delivery-date"></span>
      <span id="print-emission-time"></span>
      <span id="print-header-servido"></span>
      <span id="print-header-demandado"></span>
      <span id="print-header-pendiente"></span>
      <span id="print-header-rate"></span>
      <div id="print-articles-totals-list"></div>
      <span id="print-grand-total-boxes"></span>
      <span id="print-header-products-summary"></span>
    </div>
    <div id="executive-summary-section"></div>
    <div id="warnings-errors-section"></div>
    <div id="plan-comparison-section"></div>
    <div id="platform-plan-cards-container"></div>
    <div id="palletization-groups-container"></div>
    <div id="print-signatures-block"></div>
    <div id="actions-toolbar"></div>
  </div>
`;

const FULL_DOM = `
  <input id="tsv-input" />
  <div id="consolidated-forecast-container">
    <span id="consolidated-count-badge"></span>
    <div id="delivery-date-selector-container"></div>
    <div id="consolidated-platforms-list"></div>
    <div id="consolidated-orders-table-body"></div>
  </div>
  <span id="badge-delivery-date"></span>
  <span id="badge-delivery-date-desktop"></span>
  <span id="badge-plan-status"></span>
  <span id="badge-plan-sync"></span>
  <div id="plan-desactualizado-banner" class="hidden"></div>
  <span id="plan-action-state-text"></span>
  <span id="plan-calculated-time"></span>
  <div id="results-column">
    <div id="print-doc-header">
      <span id="print-delivery-date"></span>
      <span id="print-emission-time"></span>
      <span id="print-header-servido"></span>
      <span id="print-header-demandado"></span>
      <span id="print-header-pendiente"></span>
      <span id="print-header-rate"></span>
      <div id="print-articles-totals-list"></div>
      <span id="print-grand-total-boxes"></span>
      <span id="print-header-products-summary"></span>
    </div>
    <div id="executive-summary-section"></div>
    <div id="warnings-errors-section"></div>
    <div id="plan-comparison-section"></div>
    <div id="platform-plan-cards-container"></div>
    <div id="palletization-groups-container"></div>
    <div id="print-signatures-block"></div>
    <div id="actions-toolbar"></div>
  </div>
  <div id="plan-global-header">
    <span id="plan-header-delivery-date"></span>
    <span id="plan-header-servido"></span>
    <span id="plan-header-demandado"></span>
    <span id="plan-header-pendiente"></span>
    <span id="plan-header-service-rate"></span>
    <span id="plan-header-rate-dot"></span>
    <span id="plan-header-pendiente-wrap" class="plan-header-kpi-pendiente"></span>
    <span id="plan-header-pendiente-icon"></span>
    <span id="plan-header-products-summary"></span>
  </div>
  <span id="kpi-allocated"></span>
  <span id="kpi-requested"></span>
  <span id="kpi-missing"></span>
  <div id="kpi-stock-details"></div>
  <span id="mkpi-boxes"></span>
  <span id="mkpi-assigned"></span>
  <span id="mkpi-pending"></span>
  <span id="mkpi-platforms"></span>
  <span id="mkpi-pallets"></span>
  <span id="mkpi-towers"></span>
  <span id="mm-delivery-date"></span>
  <span id="mm-status"></span>
  <div id="active-locks-list"></div>
  <div id="active-exclusions-list"></div>
  <div id="active-pallet-overrides-list"></div>
  <div id="lock-conflict-msg"></div>
  <input id="exclusion-type" />
  <input id="exclusion-platform-val" />
  <input id="exclusion-product-val" />
  <input id="exclusion-line-val" />
  <input id="exclusion-reason" />
  <button id="btn-add-exclusion"></button>
  <input id="override-pallet-platform" />
  <input id="override-pallet-product" />
  <input id="override-pallet-type" />
  <button id="btn-add-pallet-override"></button>
  <input id="lock-platform" />
  <input id="lock-product" />
  <input id="lock-type" />
  <input id="lock-qty" />
  <button id="btn-add-lock"></button>
`;

function mountDom(html) {
  const doc = createDocument(html || '');
  globalThis.document = doc;
  globalThis.window = {
    document: doc,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    scrollTo: () => {},
    print: () => { globalThis.__printCalls = (globalThis.__printCalls || 0) + 1; }
  };
  return doc;
}

function controllerWith(stock, orders, selectedDate) {
  const state = new AppState();
  const ctrl = new UIController(state);
  for (const [k, v] of Object.entries(stock || {})) {
    state.setStockItem(k, v);
  }
  for (const o of orders || []) {
    state.addOrder(o);
  }
  if (selectedDate !== undefined) state.selectedDeliveryDate = selectedDate;
  return ctrl;
}

function controllerWithDom(html, stock, orders, selectedDate) {
  const doc = mountDom(html || FULL_DOM);
  const state = new AppState();
  const ctrl = new UIController(state);
  ctrl.bindDOM();
  for (const [k, v] of Object.entries(stock || {})) state.setStockItem(k, v);
  for (const o of orders || []) state.addOrder(o);
  if (selectedDate !== undefined) state.selectedDeliveryDate = selectedDate;
  return { doc, ctrl };
}

function sumAllocated(result) {
  return (result.allocations || []).reduce((s, a) => s + (a.allocatedQuantity || 0), 0);
}

function sumGlobal(result) {
  return (result.globalAllocation || []).reduce((s, a) => s + (a.allocatedQuantity || 0), 0);
}

function sumPlans(result) {
  let totalBoxes = 0;
  for (const key of Object.keys(result.plansByDate || {})) {
    totalBoxes += (result.plansByDate[key].allocations || [])
      .reduce((s, a) => s + (a.allocatedQuantity || 0), 0);
  }
  return totalBoxes;
}

console.log('\n=== V4.6 · INTEGRACIÓN UI ↔ REPARTO GLOBAL MULTIFECHA ===\n');

// =============================================================================
// 1. UNA SOLA BOLSA GLOBAL ENTRE FECHAS
// =============================================================================
console.log('--- 1. Una sola bolsa global ---');

check('1.1 · 120 cjs de stock: 100 (sábado) + 60 (domingo) se sirven 75 + 45, nunca 160', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 120 },
    [
      { id: 'ORD-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
      { id: 'ORD-2', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );

  const planSabado = ctrl.generatePlan();
  assert.strictEqual(sumAllocated(planSabado), 75);
  assert.strictEqual(planSabado.demandSummary.totalRequested, 100);
  assert.strictEqual(planSabado.plansByDate['26/09/2026'] !== undefined, true);
  assert.strictEqual(planSabado.plansByDate['27/09/2026'] !== undefined, true);
  assert.strictEqual(sumGlobal(planSabado), 120, 'el reparto global consume 120, no 160');

  // Invariante: servido + pendiente = demanda aplicable (por fecha y global).
  const missingSabado = planSabado.allocations.reduce((s, a) => s + (a.missingQuantity || 0), 0);
  assert.strictEqual(sumAllocated(planSabado) + missingSabado, planSabado.demandSummary.totalRequested);
  const globalMissing = planSabado.globalAllocation.reduce((s, a) => s + (a.missingQuantity || 0), 0);
  assert.strictEqual(sumGlobal(planSabado) + globalMissing, planSabado.globalDemandSummary.totalRequested);

  const planDomingo = ctrl.selectDeliveryDate('27/09/2026');
  assert.strictEqual(sumAllocated(planDomingo), 45);
  assert.strictEqual(planDomingo.demandSummary.totalRequested, 60);
  assert.strictEqual(sumAllocated(planSabado) + sumAllocated(planDomingo), 120);

  const pera = planDomingo.stockRemaining.find(s => s.productId === 'PERA_RAMA');
  assert.strictEqual(pera.available, 120);
  assert.strictEqual(pera.used, 120);
  assert.strictEqual(pera.remaining, 0);
});

check('1.2 · Alternar sábado/domingo 10 veces no reejecuta el reparto ni altera globalAllocation', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 120 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();

  const globalBefore = JSON.stringify(ctrl.state.globalResult.globalAllocation);
  const remainingBefore = JSON.stringify(ctrl.state.globalResult.stockRemaining);
  ctrl.generatePlan = () => { throw new Error('cambiar de fecha no debe recalcular'); };

  for (let i = 0; i < 10; i++) {
    const date = i % 2 === 0 ? '27/09/2026' : '26/09/2026';
    const view = ctrl.selectDeliveryDate(date);
    assert.strictEqual(view.deliveryDate, date);
    assert.strictEqual(sumAllocated(view), date === '27/09/2026' ? 45 : 75);
  }

  assert.strictEqual(JSON.stringify(ctrl.state.globalResult.globalAllocation), globalBefore);
  assert.strictEqual(JSON.stringify(ctrl.state.globalResult.stockRemaining), remainingBefore);
  assert.strictEqual(sumGlobal(ctrl.state.globalResult), 120);
});

// =============================================================================
// 2. FECHA SIN PEDIDOS
// =============================================================================
console.log('\n--- 2. Fecha sin pedidos ---');

check('2.1 · Una fecha sin pedidos presenta plan vacío, nunca asignaciones de otra fecha', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 50 },
    [{ id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' }],
    '26/09/2026'
  );
  // Texto de previsión "señuelo": jamás debe usarse cuando ya hay sesión de demanda.
  ctrl.state.setRawText('LEVANTE 28/09/2026 PERA RAMA 99');

  const sabado = ctrl.generatePlan();
  assert.strictEqual(sumAllocated(sabado), 40);

  ctrl.state.planningResult = sabado; // el plan existe; cambiar de fecha no recalcula
  const sinPedidos = ctrl.selectDeliveryDate('27/09/2026');
  assert.strictEqual(sinPedidos.deliveryDate, '27/09/2026');
  assert.strictEqual(sinPedidos.allocations.length, 0);
  assert.strictEqual(sinPedidos.demandSummary.totalRequested, 0);
  assert.strictEqual(sinPedidos.totalBoxes, 0);
  assert.strictEqual(sinPedidos.plansByDate['26/09/2026'].allocations.length, 1);
});

check('2.2 · Borrar el último pedido de la fecha genera plan vacío (sin fallback a rawText)', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 50 },
    [{ id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' }],
    '26/09/2026'
  );
  ctrl.state.setRawText('LEVANTE 26/09/2026 PERA RAMA 99');
  ctrl.generatePlan();

  assert.strictEqual(ctrl.state.removeOrder('A'), true);
  const empty = ctrl.generatePlan();

  assert.strictEqual(empty.deliveryDate, '26/09/2026');
  assert.strictEqual(empty.allocations.length, 0, 'no debe resucitar la previsión desde rawText');
  assert.strictEqual(empty.demandSummary.totalRequested, 0);
  assert.strictEqual(empty.errors.filter(e => e.code === 'NO_VALID_LINES_PARSED').length, 0);
});

// =============================================================================
// 3. PEDIDOS SIN FECHA
// =============================================================================
console.log('\n--- 3. Pedidos sin fecha ---');

check('3.1 · Los pedidos sin fecha tienen contexto "Sin fecha" visible y consumen stock una sola vez', () => {
  const doc = mountDom(PRINT_DOM);
  const ctrl = controllerWith(
    { 'PERA_RAMA': 50 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: 'Sin fecha' }
    ],
    '26/09/2026'
  );

  assert.deepStrictEqual(ctrl.state.getAvailableDeliveryDates(), ['26/09/2026', 'Sin fecha']);

  ctrl.renderConsolidatedForecast();
  const selector = doc.getElementById('delivery-date-selector-container');
  assert.ok(selector.innerHTML.includes('Sin fecha'), 'el selector debe ofrecer el contexto Sin fecha');

  const plan = ctrl.generatePlan();
  assert.deepStrictEqual(Object.keys(plan.plansByDate).sort(), ['26/09/2026', 'Sin fecha']);
  assert.strictEqual(sumGlobal(plan), 50);
  assert.strictEqual(sumPlans(plan), 50, 'globalAllocation = suma de plansByDate');

  const sinFecha = plan.plansByDate['Sin fecha'];
  assert.strictEqual(sinFecha.allocations.length, 1);
  assert.strictEqual(sinFecha.allocations[0].orderId, 'B');
  assert.strictEqual(sinFecha.demandSummary.totalRequested, 40);
  assert.ok(
    sinFecha.warnings.some(w => w.code === 'UNDATED_ORDERS'),
    'el plan Sin fecha debe declarar explícitamente los pedidos sin fecha'
  );
  assert.ok(
    !plan.warnings.some(w => w.code === 'UNDATED_ORDERS'),
    'la incidencia no debe duplicarse en el nivel global'
  );

  const view = ctrl.selectDeliveryDate('Sin fecha');
  assert.strictEqual(view.deliveryDate, 'Sin fecha');
  assert.strictEqual(view.allocations.length, 1);
  assert.strictEqual(view.allocations[0].orderId, 'B');
  assert.strictEqual(view.demandSummary.totalRequested, 40);

  // Reparto proporcional Hamilton 30/40 sobre 50 -> 21 + 29, sin exceder stock.
  const a = plan.plansByDate['26/09/2026'].allocations[0].allocatedQuantity;
  const b = sinFecha.allocations[0].allocatedQuantity;
  assert.strictEqual(a + b, 50);
  assert.ok(a > 0 && b > 0, 'ambos pedidos participan del reparto global');
});

check('3.2 · Sin fecha no se cuela en la procedencia de una fecha concreta', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 50 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: 'Sin fecha', origen: 'ANTICIPADO' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();
  const prov = UIController.derivePlatformProvenance('CENTRO', ctrl.state.orders, ctrl.state.planningResult);
  assert.strictEqual(prov.totalDemandBoxes, 10, 'la procedencia del 26/09 solo cuenta sus 10 cjs');
});

// =============================================================================
// 4. MISMA PLATAFORMA EN FECHAS DISTINTAS
// =============================================================================
console.log('\n--- 4. Misma plataforma en fechas distintas ---');

check('4.1 · Dos pedidos de CENTRO en fechas distintas conservan identidad y asignación propia', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 100 },
    [
      { id: 'SAB', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '26/09/2026' },
      { id: 'DOM', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  const plan = ctrl.generatePlan();
  assert.strictEqual(plan.globalAllocation.length, 2);

  const sabado = ctrl.selectDeliveryDate('26/09/2026');
  const domingo = ctrl.selectDeliveryDate('27/09/2026');
  assert.strictEqual(sabado.allocations.length, 1);
  assert.strictEqual(sabado.allocations[0].orderId, 'SAB');
  assert.strictEqual(sabado.allocations[0].allocatedQuantity, 60);
  assert.strictEqual(domingo.allocations.length, 1);
  assert.strictEqual(domingo.allocations[0].orderId, 'DOM');
  assert.strictEqual(domingo.allocations[0].allocatedQuantity, 40);
});

// =============================================================================
// 5. SALIDAS: WHATSAPP, IMPRESIÓN Y PDF POR FECHA
// =============================================================================
console.log('\n--- 5. Salidas por fecha ---');

check('5.1 · WhatsApp de cada fecha contiene solo su plan', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 120 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();

  const waSabado = formatWhatsAppMessage(ctrl.state.planningResult, ctrl.state.orders);
  assert.ok(waSabado.includes('SÁBADO 26/09/2026'));
  assert.ok(/SERVIDO: 75 cjs/.test(waSabado), waSabado);
  assert.ok(waSabado.includes('CENTRO'));
  assert.ok(!waSabado.includes('MURCIA'), 'el WhatsApp del sábado no puede incluir el domingo');

  ctrl.selectDeliveryDate('27/09/2026');
  const waDomingo = formatWhatsAppMessage(ctrl.state.planningResult, ctrl.state.orders);
  assert.ok(waDomingo.includes('DOMINGO 27/09/2026'));
  assert.ok(/SERVIDO: 45 cjs/.test(waDomingo), waDomingo);
  assert.ok(waDomingo.includes('MURCIA'));
  assert.ok(!waDomingo.includes('CENTRO'), 'el WhatsApp del domingo no puede incluir el sábado');
});

check('5.2 · Impresión y PDF usan exclusivamente el plan de la fecha seleccionada', () => {
  const doc = mountDom(PRINT_DOM);
  globalThis.__printCalls = 0;
  let pdfOptions = null;
  globalThis.window.html2pdf = () => ({
    set: (opt) => ({
      from: () => ({
        save: () => { pdfOptions = opt; return Promise.resolve(); }
      })
    })
  });

  const ctrl = controllerWith(
    { 'PERA_RAMA': 120 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();

  ctrl.selectDeliveryDate('27/09/2026');
  assert.strictEqual(String(doc.getElementById('print-delivery-date').textContent), 'DOMINGO 27/09/2026');
  assert.strictEqual(String(doc.getElementById('print-header-servido').textContent), '45');
  assert.strictEqual(String(doc.getElementById('print-header-demandado').textContent), '60');
  assert.strictEqual(String(doc.getElementById('print-header-pendiente').textContent), '15');

  ctrl.handlePrint();
  assert.strictEqual(globalThis.__printCalls, 1);
  assert.strictEqual(String(doc.getElementById('print-delivery-date').textContent), 'DOMINGO 27/09/2026');

  ctrl.handleGeneratePDF();
  assert.ok(pdfOptions, 'debe delegar en html2pdf');
  assert.strictEqual(pdfOptions.filename, 'Plan_Carga_27-09-2026.pdf');
  assert.strictEqual(String(doc.getElementById('print-delivery-date').textContent), 'DOMINGO 27/09/2026');
  assert.strictEqual(String(doc.getElementById('print-header-servido').textContent), '45');
});

// =============================================================================
// 6. COHERENCIA Y DEDUPLICACIÓN
// =============================================================================
console.log('\n--- 6. Coherencia global y deduplicación ---');

check('6.1 · globalAllocation = suma(plansByDate) con 3 fechas + pedido sin fecha', () => {
  const orders = [
    { id: 'D1', platform: 'P1', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '01/10/2026' },
    { id: 'D2', platform: 'P2', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '02/10/2026' },
    { id: 'D3', platform: 'P3', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '03/10/2026' },
    { id: 'D4', platform: 'P4', productId: 'PERA_RAMA', cajas: 20, fechaEntrega: 'Sin fecha' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 150 } });

  assert.strictEqual(res.globalAllocation.length, 4);
  assert.strictEqual(sumGlobal(res), 150);
  assert.strictEqual(sumPlans(res), 150);
  assert.strictEqual(Object.keys(res.plansByDate).length, 4);

  const idsInPlans = [];
  for (const key of Object.keys(res.plansByDate)) {
    for (const a of res.plansByDate[key].allocations) idsInPlans.push(a.orderId);
  }
  assert.deepStrictEqual(idsInPlans.sort(), ['D1', 'D2', 'D3', 'D4']);
  assert.strictEqual(new Set(idsInPlans).size, idsInPlans.length, 'cada pedido aparece en un único plan');
});

check('6.2 · warnings y errors globales no se duplican en el resultado', () => {
  const res = orchestrator.planLoad({
    demandOrders: [
      { id: 'C1', platform: 'CENTRO', productId: 'CHERRY_RAMA', cajas: 10, fechaEntrega: '01/10/2026' },
      { id: 'C2', platform: 'CENTRO', productId: 'CHERRY_RAMA', cajas: 10, fechaEntrega: '02/10/2026' }
    ],
    stock: {}
  });
  assert.strictEqual(res.warnings.filter(w => w.code === 'PRODUCT_WITHOUT_STOCK').length, 1);
  for (const key of Object.keys(res.plansByDate)) {
    assert.strictEqual(
      res.plansByDate[key].warnings.filter(w => w.code === 'PRODUCT_WITHOUT_STOCK').length,
      1
    );
  }

  const lockRes = orchestrator.planLoad({
    demandOrders: [
      { id: 'L1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '01/10/2026' }
    ],
    stock: { 'PERA_RAMA': 5 },
    locks: [
      { platform: 'CENTRO', productId: 'PERA_RAMA', type: 'FULL' },
      { platform: 'CENTRO', productId: 'PERA_RAMA', type: 'FIXED', quantity: 3 }
    ]
  });
  assert.strictEqual(lockRes.errors.filter(e => e.code === 'LOCK_CONFLICT').length, 1);
  assert.strictEqual(
    lockRes.plansByDate['01/10/2026'].errors.filter(e => e.code === 'LOCK_CONFLICT').length,
    1
  );
});

check('6.3 · La vista de fecha nunca mezcla asignaciones de otras fechas', () => {
  mountDom();
  const ctrl = controllerWith(
    { 'PERA_RAMA': 100 },
    [
      { id: 'SAB', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '26/09/2026' },
      { id: 'DOM', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();

  const sabado = ctrl.selectDeliveryDate('26/09/2026');
  assert.ok(sabado.allocations.every(a => a.deliveryDate === '26/09/2026'));
  const domingo = ctrl.selectDeliveryDate('27/09/2026');
  assert.ok(domingo.allocations.every(a => a.deliveryDate === '27/09/2026'));
  assert.ok(!sabado.allocations.some(a => a.orderId === 'DOM'));
  assert.ok(!domingo.allocations.some(a => a.orderId === 'SAB'));
});

// =============================================================================
// 7. INVALIDACIÓN Y REGENERACIÓN (H1, H2, M1)
// =============================================================================
console.log('\n--- 7. Invalidación y regeneración ---');

check('7.1 · H1: reanalizar una previsión regenera el global y elimina el fantasma', () => {
  const { doc, ctrl } = controllerWithDom(FULL_DOM, { 'PERA_RAMA': 100 }, [], '26/09/2026');
  doc.getElementById('tsv-input').value = 'CENTRO\t26/09/2026\t14072\tTOMATE PERA RAMA X\t40\nMURCIA\t27/09/2026\t14072\tTOMATE PERA RAMA X\t60';
  ctrl.handleAnalyze();
  const p1 = ctrl.generatePlan();
  assert.strictEqual(p1.plansByDate['26/09/2026'].totalBoxes, 40);
  assert.strictEqual(p1.plansByDate['27/09/2026'].totalBoxes, 60);

  doc.getElementById('tsv-input').value = 'SUR\t28/09/2026\t14072\tTOMATE PERA RAMA X\t30';
  ctrl.handleAnalyze();

  assert.strictEqual(ctrl.state.selectedDeliveryDate, '28/09/2026');
  assert.deepStrictEqual(Object.keys(ctrl.state.globalResult.plansByDate).sort(), ['28/09/2026']);
  assert.strictEqual(ctrl.state.planningResult.deliveryDate, '28/09/2026');
  assert.strictEqual(ctrl.state.planningResult.demandSummary.totalRequested, 30);
  assert.strictEqual(sumAllocated(ctrl.state.planningResult), 30);
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');

  const v26 = ctrl.selectDeliveryDate('26/09/2026');
  assert.strictEqual(v26.allocations.length, 0, 'el día 26 no debe conservar asignaciones fantasma');
  assert.strictEqual(v26.demandSummary.totalRequested, 0);
});

check('7.2 · H2: aplicar FULL a CENTRO regenera 40/10 y quitarlo restaura 20/30', () => {
  const { doc, ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 50 },
    [
      { id: 'C', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' },
      { id: 'M', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  const p0 = ctrl.generatePlan();
  assert.strictEqual(p0.plansByDate['26/09/2026'].totalBoxes, 20);
  assert.strictEqual(p0.plansByDate['27/09/2026'].totalBoxes, 30);

  ctrl.createFullLock('PERA_RAMA', null, 'PERA COMPLETA');
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 40);
  assert.strictEqual(ctrl.state.globalResult.plansByDate['27/09/2026'].totalBoxes, 10);

  doc.getElementById('active-locks-list').querySelector('.btn-remove-lock').click();
  assert.strictEqual(ctrl.state.locks.length, 0);
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 20);
  assert.strictEqual(ctrl.state.globalResult.plansByDate['27/09/2026'].totalBoxes, 30);
});

check('7.3 · H2: añadir exclusión de CENTRO deja de asignarle cajas; quitarla las restaura', () => {
  const { doc, ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 100 },
    [
      { id: 'C', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' },
      { id: 'M', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 40);

  doc.getElementById('exclusion-type').value = 'PLATFORM';
  doc.getElementById('exclusion-platform-val').value = 'CENTRO';
  doc.getElementById('btn-add-exclusion').click();

  assert.strictEqual(ctrl.state.exclusions.length, 1);
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].allocations.length, 0);
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 0);

  doc.getElementById('active-exclusions-list').querySelector('.btn-remove-excl').click();
  assert.strictEqual(ctrl.state.exclusions.length, 0);
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 40);
});

check('7.4 · H2: override de palet cambia el tipo y quitarlo lo restaura', () => {
  const { doc, ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 76 },
    [{ id: 'C', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 76, fechaEntrega: '26/09/2026' }],
    '26/09/2026'
  );
  ctrl.generatePlan();
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].palletSummaries.groups[0].palletType, 'EURO');

  doc.getElementById('override-pallet-platform').value = 'CENTRO';
  doc.getElementById('override-pallet-product').value = 'PERA_RAMA';
  doc.getElementById('override-pallet-type').value = 'METROCHEP';
  doc.getElementById('btn-add-pallet-override').click();

  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].palletSummaries.groups[0].palletType, 'METROCHEP');

  doc.getElementById('active-pallet-overrides-list').querySelector('.btn-remove-pallet-override').click();
  assert.strictEqual(Object.keys(ctrl.state.palletOverrides).length, 0);
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].palletSummaries.groups[0].palletType, 'EURO');
});

check('7.5 · M1: con plan desactualizado, cambiar de fecha no muestra CORRECTA', () => {
  const { ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 152 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 76, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 76, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();
  assert.strictEqual(ctrl.state.planStatus, 'PLANIFICACIÓN CORRECTA');

  ctrl.state.setStockItem('PERA_RAMA', 150);
  assert.strictEqual(ctrl.state.planState, 'PLAN_DESACTUALIZADO');

  ctrl.selectDeliveryDate('27/09/2026');
  assert.strictEqual(ctrl.state.planStatus, 'PLAN DESACTUALIZADO');
  assert.notStrictEqual(ctrl.state.planStatus, 'PLANIFICACIÓN CORRECTA');
});

check('7.6 · Render multifecha con DOM: cabecera, tarjetas y paletización por fecha', () => {
  const { doc, ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 120 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.handleGeneratePlan();

  assert.strictEqual(String(doc.getElementById('plan-header-servido').textContent), '75');
  assert.strictEqual(String(doc.getElementById('plan-header-demandado').textContent), '100');
  assert.strictEqual(doc.querySelectorAll('#platform-plan-cards-container .digital-loading-card').length, 1);
  assert.ok(doc.getElementById('platform-plan-cards-container').innerHTML.includes('CENTRO'));

  ctrl.selectDeliveryDate('27/09/2026');
  assert.strictEqual(String(doc.getElementById('plan-header-servido').textContent), '45');
  assert.strictEqual(String(doc.getElementById('plan-header-demandado').textContent), '60');
  assert.strictEqual(doc.querySelectorAll('#platform-plan-cards-container .digital-loading-card').length, 1);
  assert.ok(doc.getElementById('platform-plan-cards-container').innerHTML.includes('MURCIA'));
  assert.ok(!doc.getElementById('platform-plan-cards-container').innerHTML.includes('CENTRO'));
  assert.ok(doc.getElementById('palletization-groups-container').innerHTML.length > 0);
});

// =============================================================================
// 8. CIERRE DE M2 (estado desactualizado coherente)
// =============================================================================
console.log('\n--- 8. Estado desactualizado coherente (M2) ---');

check('8.1 · M2: cambiar stock marca planState y planStatus como desactualizado', () => {
  const { ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 152 },
    [
      { id: 'A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 76, fechaEntrega: '26/09/2026' },
      { id: 'B', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 76, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.planStatus, 'PLANIFICACIÓN CORRECTA');

  ctrl.state.setStockItem('PERA_RAMA', 150);
  assert.strictEqual(ctrl.state.planState, 'PLAN_DESACTUALIZADO');
  assert.strictEqual(ctrl.state.planStatus, 'PLAN DESACTUALIZADO');
});

check('8.2 · M2: fallo en regeneración tras añadir bloqueo no muestra el plan como actualizado', () => {
  const { ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 50 },
    [
      { id: 'C', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' },
      { id: 'M', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');

  ctrl.generatePlan = () => { throw new Error('fallo simulado'); };
  assert.throws(() => ctrl.createFullLock('PERA_RAMA', null, 'PERA COMPLETA'), /fallo simulado/);

  assert.strictEqual(ctrl.state.locks.length, 1);
  assert.strictEqual(ctrl.state.planState, 'PLAN_DESACTUALIZADO');
  assert.strictEqual(ctrl.state.planStatus, 'PLAN DESACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 20, 'el plan anterior se conserva');
});

check('8.3 · M2: regenerar tras el fallo restaura ambos estados', () => {
  const { ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 50 },
    [
      { id: 'C', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' },
      { id: 'M', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();

  const original = ctrl.generatePlan.bind(ctrl);
  ctrl.generatePlan = () => { throw new Error('fallo simulado'); };
  assert.throws(() => ctrl.createFullLock('PERA_RAMA', null, 'PERA COMPLETA'), /fallo simulado/);
  ctrl.generatePlan = original;

  ctrl.regeneratePlanIfExists();
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.planStatus, UIController.derivePlanStatus(ctrl.state.planningResult), 'planStatus debe reflejar el resultado real');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 40);
  assert.strictEqual(ctrl.state.globalResult.plansByDate['27/09/2026'].totalBoxes, 10);
});

check('8.4 · H2: formulario genérico de bloqueo regenera el plan', () => {
  const { doc, ctrl } = controllerWithDom(FULL_DOM,
    { 'PERA_RAMA': 50 },
    [
      { id: 'C', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' },
      { id: 'M', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
    ],
    '26/09/2026'
  );
  ctrl.generatePlan();

  doc.getElementById('lock-platform').value = 'CENTRO';
  doc.getElementById('lock-product').value = 'PERA_RAMA';
  doc.getElementById('lock-type').value = 'FULL';
  doc.getElementById('btn-add-lock').click();

  assert.strictEqual(ctrl.state.locks.length, 1);
  assert.strictEqual(ctrl.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctrl.state.globalResult.plansByDate['26/09/2026'].totalBoxes, 40);
  assert.strictEqual(ctrl.state.globalResult.plansByDate['27/09/2026'].totalBoxes, 10);
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

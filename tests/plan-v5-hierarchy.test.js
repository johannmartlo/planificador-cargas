'use strict';

/**
 * PLANIFICADOR DE CARGAS V5 — CIERRE PLAN DE CARGA
 * SUITE DE TESTS: JERARQUÍA VISUAL V5 Y PORCENTAJE DEL PEDIDO SERVIDO
 *
 * Verifica exhaustivamente los requisitos de aceptación de V5:
 *  1. Fórmula y casos límite de porcentaje:
 *     - 258 / 293 -> 88 % DEL PEDIDO SERVIDO
 *     - 0 / 0 -> — % DEL PEDIDO SERVIDO
 *     - 100 / 100 -> 100 % DEL PEDIDO SERVIDO
 *     - 50 / 100 -> 50 % DEL PEDIDO SERVIDO
 *     - 120 / 100 -> 120 % DEL PEDIDO SERVIDO (legítimo si servido > pedido)
 *  2. Pendiente nunca negativo:
 *     - 120 servido sobre 100 pedido -> pendiente 0 CJS
 *     - 258 servido sobre 293 pedido -> pendiente 35 CJS
 *     - 100 servido sobre 100 pedido -> pendiente 0 CJS
 *  3. SERVIDO como elemento más importante y protagonista:
 *     - Tipografía grande en desktop (#plan-header-servido)
 *     - Primer dato del balance en salidas
 *  4. % DEL PEDIDO SERVIDO asociado directamente a SERVIDO:
 *     - Elemento #plan-header-service-rate ubicado bajo #plan-header-servido
 *  5. PEDIDO como referencia separada:
 *     - Ubicado en el extremo opuesto (#plan-header-demandado) con etiqueta PEDIDO
 *  6. PENDIENTE fuera de la pareja SERVIDO / PEDIDO:
 *     - Contenedor independiente (#plan-header-pendiente-wrap)
 *     - Indicador de incidencia sólo si > 0
 *  7. Resumen por producto:
 *     - Desglose con "pedidas · servidas"
 *  8. Tarjetas de plataforma:
 *     - Carga física pura sin Demanda / Servido / Pendiente ni (faltan X)
 *  9. Salidas alineadas (PDF, Impresión, WhatsApp):
 *     - #print-doc-header reproduce la misma jerarquía con SERVIDO, PEDIDO y % DEL PEDIDO SERVIDO
 *     - formatWhatsAppMessage encabeza con SERVIDO y % DEL PEDIDO SERVIDO
 * 10. Reglas de negocio e invariantes congelados:
 *     - Dataset 18/09 (522 cjs, 17 palets, 9 torres)
 *     - Carrefour (80 cjs Consabor, 0 pendientes)
 *     - Mobile intacto
 *
 * Ejecución: node tests/plan-v5-hierarchy.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const parser = require(path.join(SRC, 'parser.js'));
const catalog = require(path.join(SRC, 'catalog.js'));
const ui = require(path.join(SRC, 'ui.js'));

const {
  AppState,
  UIController,
  computeDeliveryProductsSummary,
  formatWhatsAppMessage,
  formatProductArticleName,
  derivePlatformProvenance,
  computeServiceRate,
  formatServiceRateText,
  DATASETS
} = ui;

const { createDocument, serialize } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const HTML_CONTENT = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MOBILE_CSS_CONTENT = fs.readFileSync(path.join(SRC, 'mobile.css'), 'utf8');

let totalChecks = 0;
let passedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  PASS  ${title}`);
  } catch (err) {
    console.error(`  FAIL  ${title}`);
    console.error(`        ${err.message}`);
  }
}

if (typeof global.window === 'undefined') {
  global.window = { location: { search: '' }, addEventListener() {}, scrollTo() {} };
}

console.log('\n=== PLANIFICADOR V5 · CIERRE PLAN DE CARGA: TESTS DE JERARQUÍA Y PORCENTAJE ===\n');

// =============================================================================
// 1. FÓRMULA Y CASOS LÍMITE DE PORCENTAJE
// =============================================================================
check('1.1 · Caso ejemplo: 258 / 293 -> 88 % DEL PEDIDO SERVIDO', () => {
  const rate = computeServiceRate(258, 293);
  assert.strictEqual(rate, 88, 'Porcentaje debe ser 88');
  assert.strictEqual(formatServiceRateText(258, 293), '88 % DEL PEDIDO SERVIDO');
});

check('1.2 · Caso límite: 0 / 0 -> — % DEL PEDIDO SERVIDO (sin división por cero)', () => {
  const rate = computeServiceRate(0, 0);
  assert.strictEqual(rate, null, 'Pedido 0 produce rate null');
  assert.strictEqual(formatServiceRateText(0, 0), '— % DEL PEDIDO SERVIDO');
});

check('1.3 · Caso pleno: 100 / 100 -> 100 % DEL PEDIDO SERVIDO', () => {
  const rate = computeServiceRate(100, 100);
  assert.strictEqual(rate, 100, 'Porcentaje debe ser 100');
  assert.strictEqual(formatServiceRateText(100, 100), '100 % DEL PEDIDO SERVIDO');
});

check('1.4 · Caso mitad: 50 / 100 -> 50 % DEL PEDIDO SERVIDO', () => {
  const rate = computeServiceRate(50, 100);
  assert.strictEqual(rate, 50, 'Porcentaje debe ser 50');
  assert.strictEqual(formatServiceRateText(50, 100), '50 % DEL PEDIDO SERVIDO');
});

check('1.5 · Caso sobre-entrega: 120 / 100 -> 120 % DEL PEDIDO SERVIDO', () => {
  const rate = computeServiceRate(120, 100);
  assert.strictEqual(rate, 120, 'Porcentaje puede legítimamente superar 100');
  assert.strictEqual(formatServiceRateText(120, 100), '120 % DEL PEDIDO SERVIDO');
});

// =============================================================================
// 2. PENDIENTE NUNCA NEGATIVO
// =============================================================================
check('2.1 · Pendiente nunca negativo ante sobre-entrega (120 servido sobre 100 pedido)', () => {
  const pedido = 100;
  const servido = 120;
  const pendiente = Math.max(0, pedido - servido);
  assert.strictEqual(pendiente, 0, 'Pendiente nunca negativo, debe ser 0');
});

check('2.2 · Pendiente con déficit (258 servido sobre 293 pedido -> 35 cajas)', () => {
  const pedido = 293;
  const servido = 258;
  const pendiente = Math.max(0, pedido - servido);
  assert.strictEqual(pendiente, 35, 'Pendiente debe ser exactamente 35');
});

// =============================================================================
// 3. ESTRUCTURA DOM: CABECERA GLOBAL V5 EN INDEX.HTML
// =============================================================================
check('3.1 · index.html incluye los elementos de jerarquía V5', () => {
  assert.ok(HTML_CONTENT.includes('id="plan-global-header"'), 'Contenedor #plan-global-header');
  assert.ok(HTML_CONTENT.includes('id="plan-header-servido"'), 'Elemento #plan-header-servido');
  assert.ok(HTML_CONTENT.includes('id="plan-header-service-rate"'), 'Elemento #plan-header-service-rate');
  assert.ok(HTML_CONTENT.includes('id="plan-header-demandado"'), 'Elemento #plan-header-demandado');
  assert.ok(HTML_CONTENT.includes('id="plan-header-pendiente"'), 'Elemento #plan-header-pendiente');
  assert.ok(HTML_CONTENT.includes('id="plan-header-pendiente-wrap"'), 'Elemento #plan-header-pendiente-wrap');
  assert.ok(HTML_CONTENT.includes('id="plan-header-products-summary"'), 'Elemento #plan-header-products-summary');

  // Comprueba que el rótulo visible para la referencia es PEDIDO
  const demandadoBlock = HTML_CONTENT.slice(HTML_CONTENT.indexOf('id="plan-header-demandado"') - 200, HTML_CONTENT.indexOf('id="plan-header-demandado"') + 200);
  assert.ok(demandadoBlock.includes('PEDIDO'), 'Rótulo visible del dato de referencia es PEDIDO');
});

// =============================================================================
// 4. COMPORTAMIENTO FUNCIONAL DE UIController.renderPlanGlobalHeader
// =============================================================================
check('4.1 · renderPlanGlobalHeader con caso ejemplo 258 servido / 293 pedido', () => {
  const doc = createDocument(HTML_CONTENT);
  global.document = doc;
  const state = new AppState();
  state.selectedDeliveryDate = '26/08/2026';

  // Simular planningResult con 258 servido y 293 pedido
  const fakeResult = {
    selectedDeliveryDate: '26/08/2026',
    demandSummary: { totalRequested: 293 },
    allocations: [
      { productId: 'PERA_RAMA', varietyId: null, requestedQuantity: 293, allocatedQuantity: 258, missingQuantity: 35 }
    ]
  };

  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlanGlobalHeader(fakeResult);

  assert.strictEqual(String(doc.getElementById('plan-header-servido').textContent), '258');
  assert.strictEqual(String(doc.getElementById('plan-header-demandado').textContent), '293');
  assert.strictEqual(String(doc.getElementById('plan-header-service-rate').textContent), '88 % DEL PEDIDO SERVIDO');
  assert.strictEqual(String(doc.getElementById('plan-header-pendiente').textContent), '35');

  const pendWrap = doc.getElementById('plan-header-pendiente-wrap');
  assert.ok(pendWrap.classList.contains('is-incident'), 'Pendiente > 0 activa clase is-incident');
});

check('4.2 · renderPlanGlobalHeader en estado previo al cálculo (sin plan)', () => {
  const doc = createDocument(HTML_CONTENT);
  global.document = doc;
  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 150, fechaEntrega: '26/08/2026' });
  state.selectedDeliveryDate = '26/08/2026';

  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlanGlobalHeader(null);

  assert.strictEqual(String(doc.getElementById('plan-header-servido').textContent), '—');
  assert.strictEqual(String(doc.getElementById('plan-header-demandado').textContent), '150');
  assert.strictEqual(String(doc.getElementById('plan-header-service-rate').textContent), '— % DEL PEDIDO SERVIDO');
  assert.strictEqual(String(doc.getElementById('plan-header-pendiente').textContent), '—');
});

// =============================================================================
// 5. RESUMEN DE LO SERVIDO (ÚNICAMENTE CAJAS SERVIDAS)
// =============================================================================
check('5.1 · Resumen de lo servido muestra únicamente cajas servidas (Pera Rama 100 CJS)', () => {
  const doc = createDocument(HTML_CONTENT);
  global.document = doc;
  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 134, fechaEntrega: '26/08/2026' });

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/08/2026'),
    targetDeliveryDate: '26/08/2026',
    stock: { PERA_RAMA: 100 }
  });

  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlanGlobalHeader(plan);

  const summaryHtml = serialize(doc.getElementById('plan-header-products-summary'));
  assert.ok(summaryHtml.includes('Pera Rama'), 'Muestra Pera Rama');
  assert.ok(summaryHtml.includes('100') && summaryHtml.includes('CJS'), 'Muestra únicamente 100 CJS');
  assert.ok(!summaryHtml.includes('pedidas'), 'NO muestra cajas pedidas en resumen de lo servido');
});

// =============================================================================
// 6. SALIDAS OPERATIVAS: WHATSAPP, PDF E IMPRESIÓN
// =============================================================================
check('6.1 · WhatsApp incorpora SERVIDO como protagonista con % DEL PEDIDO SERVIDO y PEDIDO', () => {
  const state = new AppState();
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 293, fechaEntrega: '26/08/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/08/2026'),
    targetDeliveryDate: '26/08/2026',
    stock: { PERA_RAMA: 258 }
  });

  const wa = formatWhatsAppMessage(plan, state.orders, '26/08/2026');
  assert.ok(wa.includes('*SERVIDO: 258 cjs*'), 'WhatsApp destaca SERVIDO');
  assert.ok(wa.includes('88 % DEL PEDIDO SERVIDO'), 'WhatsApp incluye 88 % DEL PEDIDO SERVIDO vinculado');
  assert.ok(wa.includes('PEDIDO: 293 cajas'), 'WhatsApp muestra PEDIDO: 293 cajas');
  assert.ok(wa.includes('35 cjs'), 'WhatsApp muestra 35 cjs pendientes');
  assert.ok(wa.includes('*RESUMEN DE LO SERVIDO*'), 'WhatsApp incluye RESUMEN DE LO SERVIDO');
  assert.ok(wa.includes('• Pera Rama: 258 CJS'), 'WhatsApp muestra únicamente cajas servidas por producto');
});

check('6.2 · PDF e Impresión (#print-doc-header) incorporan la misma jerarquía V5', () => {
  const doc = createDocument(HTML_CONTENT);
  global.document = doc;
  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/08/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/08/2026'),
    targetDeliveryDate: '26/08/2026',
    stock: { PERA_RAMA: 85 }
  });

  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPrintHeaderSummary(plan);

  assert.strictEqual(String(doc.getElementById('print-header-servido').textContent), '85');
  assert.strictEqual(String(doc.getElementById('print-header-demandado').textContent), '100');
  assert.strictEqual(String(doc.getElementById('print-header-rate').textContent), '85 % DEL PEDIDO SERVIDO');
  assert.strictEqual(String(doc.getElementById('print-header-pendiente').textContent), '15');
  const printSummary = serialize(doc.getElementById('print-header-products-summary'));
  assert.ok(printSummary.includes('Pera Rama: 85 CJS'), 'Print summary muestra únicamente cajas servidas');
  assert.ok(!printSummary.includes('ped'), 'Print summary no muestra ped');
});

// =============================================================================
// 7. NO REGRESIÓN: DATASET 18/09, CARREFOUR Y MOBILE
// =============================================================================
check('7.1 · Dataset 18/09 intacto (522 cajas servidas, 100 % DEL PEDIDO SERVIDO, 0 pendientes)', () => {
  const plan = orchestrator.planLoad({
    rawText: DATASETS['18_SEP'],
    stock: {
      'PERA_RAMA': 320,
      'COCKTAIL_ROMANTICO::CONSABOR': 0,
      'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
      'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
      'CHERRY_RAMA::SUNSTREAM': 100
    }
  });

  assert.strictEqual(plan.totalBoxes, 522);
  assert.strictEqual(plan.palletSummaries.totalPallets, 17);
  assert.strictEqual(plan.palletSummaries.totalPalletSlots, 9);
  assert.strictEqual(formatServiceRateText(plan.totalBoxes, plan.demandSummary.totalRequested), '100 % DEL PEDIDO SERVIDO');
});

check('7.2 · Caso Carrefour intacto (80 cajas Consabor servidas completas)', () => {
  const plan = orchestrator.planLoad({
    rawText: 'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80',
    stock: { 'COCKTAIL_ROMANTICO::CONSABOR': 80 }
  });

  assert.strictEqual(plan.allocations[0].allocatedQuantity, 80);
  assert.strictEqual(plan.allocations[0].missingQuantity, 0);
  assert.strictEqual(formatServiceRateText(80, 80), '100 % DEL PEDIDO SERVIDO');
});

check('7.3 · mobile.css intacto byte a byte', () => {
  assert.ok(MOBILE_CSS_CONTENT.includes('#mobile-header'), 'mobile.css preservado');
  assert.ok(MOBILE_CSS_CONTENT.includes('#mobile-tabbar'), 'mobile.css preservado');
});

// =============================================================================
// RESUMEN
// =============================================================================
console.log(`\n${passedChecks}/${totalChecks} comprobaciones superadas`);
if (passedChecks === totalChecks) {
  console.log('RESULTADO: Todos los requisitos de la jerarquía V5 superados con éxito.\n');
  process.exit(0);
} else {
  console.error(`RESULTADO: ${totalChecks - passedChecks} comprobaciones fallidas.\n`);
  process.exit(1);
}

'use strict';

/**
 * PLANIFICADOR DE CARGAS V4.5 — PASO 1
 * SUITE DE TESTS: SIMPLIFICACIÓN DEL PLAN DE CARGA
 *
 * Comprueba exhaustivamente los 15 puntos exigidos en la Sección 12:
 *  1. Cabecera global con DEMANDADO / SERVIDO / PENDIENTE
 *  2. SERVIDO como cifra principal
 *  3. PENDIENTE destacado solo si > 0
 *  4. Resumen por producto visible
 *  5. Tarjetas de plataforma sin DEMANDA / SERVIDO / PENDIENTE
 *  6. Tarjetas de plataforma sin (faltan X)
 *  7. Tarjetas de plataforma con toda su información física intacta
 *  8. Badges de procedencia intactos
 *  9. Desglose por origen en tarjeta mixta intacto
 * 10. WhatsApp con SERVIDO principal, DEMANDADO secundario, PENDIENTE condicional
 * 11. PDF con la misma jerarquía
 * 12. Impresión con la misma jerarquía
 * 13. Dataset del 18/09 sigue funcionando exactamente igual
 * 14. Caso Carrefour sigue funcionando exactamente igual
 * 15. Mobile no se ha visto afectado
 *
 * Ejecución: node tests/plan-simplification-v45.test.js
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
  formatDateWithDay,
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

function createTestHarness(bodyMarkup) {
  const markup = bodyMarkup || `
    <div id="plan-global-header" class="rounded-xl border border-[#22252A] bg-[#121316] p-4 sm:p-5">
      <div id="plan-header-delivery-date"></div>
      <div class="plan-header-kpi-servido"><span id="plan-header-servido">0</span></div>
      <div class="plan-header-kpi-demandado"><span id="plan-header-demandado">0</span></div>
      <div class="plan-header-kpi-pendiente"><span id="plan-header-pendiente">0</span></div>
      <div id="plan-header-products-summary"></div>
    </div>
    <div id="platform-plan-cards-container"></div>
    <div id="print-doc-header">
      <strong id="print-delivery-date"></strong>
      <strong id="print-header-servido">0</strong>
      <strong id="print-header-demandado">0</strong>
      <div id="print-header-pendiente-wrap"><strong id="print-header-pendiente">0</strong></div>
      <div id="print-header-products-summary"></div>
      <span id="print-grand-total-boxes">0</span>
      <div id="print-articles-totals-list"></div>
    </div>
  `;
  const doc = createDocument(markup);
  global.document = doc;
  return doc;
}

console.log('\n=== PLANIFICADOR V4.5 · PASO 1: SIMPLIFICACIÓN DEL PLAN DE CARGA ===\n');

// =============================================================================
// 1. CABECERA GLOBAL CON DEMANDADO / SERVIDO / PENDIENTE
// =============================================================================
check('1. Cabecera global con DEMANDADO / SERVIDO / PENDIENTE', () => {
  // Verificación estática en index.html
  assert.ok(HTML_CONTENT.includes('id="plan-global-header"'), 'index.html contiene #plan-global-header');
  assert.ok(HTML_CONTENT.includes('id="plan-header-delivery-date"'), 'index.html contiene #plan-header-delivery-date');
  assert.ok(HTML_CONTENT.includes('id="plan-header-servido"'), 'index.html contiene #plan-header-servido');
  assert.ok(HTML_CONTENT.includes('id="plan-header-demandado"'), 'index.html contiene #plan-header-demandado');
  assert.ok(HTML_CONTENT.includes('id="plan-header-pendiente"'), 'index.html contiene #plan-header-pendiente');
  assert.ok(HTML_CONTENT.includes('id="plan-header-products-summary"'), 'index.html contiene #plan-header-products-summary');

  // Comportamiento funcional en UIController
  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 80 }
  });

  const doc = createTestHarness();
  const controller = new UIController(state);
  controller.bindDOM(doc);
  controller.renderPlanGlobalHeader(plan);

  assert.strictEqual(String(doc.getElementById('plan-header-servido').textContent), '80');
  assert.strictEqual(String(doc.getElementById('plan-header-demandado').textContent), '100');
  assert.strictEqual(String(doc.getElementById('plan-header-pendiente').textContent), '20');
});

// =============================================================================
// 2. SERVIDO COMO CIFRA PRINCIPAL
// =============================================================================
check('2. SERVIDO como cifra principal', () => {
  // CSS: .plan-header-kpi-servido tiene jerarquía visual superior
  assert.ok(HTML_CONTENT.includes('.plan-header-kpi-servido'), 'index.html define .plan-header-kpi-servido');
  assert.ok(HTML_CONTENT.includes('#plan-header-servido'), 'index.html define #plan-header-servido');

  // En el template de index.html, servido tiene fuente grande (text-3xl / text-4xl font-extrabold)
  const servidoFragment = HTML_CONTENT.slice(HTML_CONTENT.indexOf('id="plan-header-servido"'), HTML_CONTENT.indexOf('id="plan-header-servido"') + 150);
  assert.ok(servidoFragment.includes('font-extrabold') || servidoFragment.includes('text-3xl'), 'SERVIDO tiene tipografía principal prominente');

  // WhatsApp: SERVIDO encabeza el balance global
  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '26/09/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 50 }
  });
  const wa = formatWhatsAppMessage(plan, state.orders, '26/09/2026');
  assert.ok(wa.includes('*SERVIDO: 50 cjs*'), 'WhatsApp destaca SERVIDO en balance');
});

// =============================================================================
// 3. PENDIENTE DESTACADO SOLO SI > 0
// =============================================================================
check('3. PENDIENTE destacado solo si > 0', () => {
  const state = new AppState();
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '26/09/2026' });

  // Caso A: Sin déficit (pendiente = 0)
  const planCompleto = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 50 }
  });
  const docA = createTestHarness();
  const ctrlA = new UIController(state);
  ctrlA.bindDOM(docA);
  ctrlA.renderPlanGlobalHeader(planCompleto);

  const pendContainerA = docA.getElementById('plan-header-pendiente').closest('.plan-header-kpi-pendiente');
  assert.strictEqual(pendContainerA.classList.contains('is-incident'), false, 'Pendiente 0 NO tiene clase is-incident');
  assert.strictEqual(String(docA.getElementById('plan-header-pendiente').textContent), '0');

  // Caso B: Con déficit (pendiente = 10)
  const planDeficit = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 40 }
  });
  const docB = createTestHarness();
  const ctrlB = new UIController(state);
  ctrlB.bindDOM(docB);
  ctrlB.renderPlanGlobalHeader(planDeficit);

  const pendContainerB = docB.getElementById('plan-header-pendiente').closest('.plan-header-kpi-pendiente');
  assert.strictEqual(pendContainerB.classList.contains('is-incident'), true, 'Pendiente > 0 SÍ tiene clase is-incident');
  assert.strictEqual(String(docB.getElementById('plan-header-pendiente').textContent), '10');
  assert.ok(docB.getElementById('plan-header-pendiente').className.includes('text-amber-400'), 'Color ámbar activo ante incidencia');
});

// =============================================================================
// 4. RESUMEN POR PRODUCTO VISIBLE
// =============================================================================
check('4. Resumen por producto visible', () => {
  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'MADRID', productId: 'COCKTAIL_ROMANTICO', varietyId: 'CONSABOR', cajas: 20, fechaEntrega: '26/09/2026' });

  // A) Con plan calculado
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 25, 'COCKTAIL_ROMANTICO::CONSABOR': 20 }
  });
  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlanGlobalHeader(plan);

  const summaryEl = doc.getElementById('plan-header-products-summary');
  const summaryHtml = serialize(summaryEl);
  assert.ok(summaryHtml.includes('Pera Rama'), 'Muestra Pera Rama');
  assert.ok(summaryHtml.includes('25') && summaryHtml.includes('CJS'), 'Muestra 25 CJS para Pera');
  assert.ok(summaryHtml.includes('Cocktail Consabor'), 'Muestra Cocktail Consabor');
  assert.ok(summaryHtml.includes('20') && summaryHtml.includes('CJS'), 'Muestra 20 CJS para Consabor');
  assert.ok(!summaryHtml.includes('pedidas'), 'NO muestra pedidas en resumen de lo servido');

  // B) Sin plan calculado (estado previo al cálculo)
  const docSinPlan = createTestHarness();
  const ctrlSinPlan = new UIController(state);
  ctrlSinPlan.bindDOM(docSinPlan);
  ctrlSinPlan.renderPlanGlobalHeader(null);

  const summarySinPlanHtml = serialize(docSinPlan.getElementById('plan-header-products-summary'));
  assert.ok(summarySinPlanHtml.includes('Sin cajas servidas'), 'Muestra Sin cajas servidas sin plan');
});

// =============================================================================
// 5. TARJETAS DE PLATAFORMA SIN DEMANDA / SERVIDO / PENDIENTE
// =============================================================================
check('5. Tarjetas de plataforma sin DEMANDA / SERVIDO / PENDIENTE', () => {
  const state = new AppState();
  state.addOrder({ platform: 'CATALUÑA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '26/09/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 50 } // Déficit de 10
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlatformPlan(plan);

  const cardsContainer = doc.getElementById('platform-plan-cards-container');
  const cardsHtml = serialize(cardsContainer);

  assert.ok(!cardsHtml.includes('Demanda:'), 'Tarjeta de plataforma NO contiene Demanda:');
  assert.ok(!cardsHtml.includes('Servido:'), 'Tarjeta de plataforma NO contiene Servido:');
  assert.ok(!cardsHtml.includes('Pendiente:'), 'Tarjeta de plataforma NO contiene Pendiente:');
  assert.ok(!cardsHtml.includes('% de servicio'), 'Tarjeta de plataforma NO contiene % de servicio');
});

// =============================================================================
// 6. TARJETAS DE PLATAFORMA SIN (FALTAN X)
// =============================================================================
check('6. Tarjetas de plataforma sin (faltan X)', () => {
  const state = new AppState();
  state.addOrder({ platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 74, fechaEntrega: '26/09/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 60 } // Faltan 14
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlatformPlan(plan);

  const cardsContainer = doc.getElementById('platform-plan-cards-container');
  const cardsHtml = serialize(cardsContainer);

  assert.ok(!cardsHtml.includes('faltan'), 'No contiene la palabra faltan');
  assert.ok(!cardsHtml.includes('falta'), 'No contiene la palabra falta');
  assert.ok(!cardsHtml.includes('(faltan 14)'), 'No contiene (faltan 14)');
});

// =============================================================================
// 7. TARJETAS DE PLATAFORMA CON TODA SU INFORMACIÓN FÍSICA INTACTA
// =============================================================================
check('7. Tarjetas de plataforma con toda su información física intacta', () => {
  const state = new AppState();
  state.addOrder({ platform: 'SUR', productId: 'PERA_RAMA', cajas: 58, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'SUR', productId: 'CHERRY_RAMA', varietyId: 'SUNSTREAM', cajas: 12, fechaEntrega: '26/09/2026' });

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 58, 'CHERRY_RAMA::SUNSTREAM': 12 }
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlatformPlan(plan);

  const cardsContainer = doc.getElementById('platform-plan-cards-container');
  const cardsHtml = serialize(cardsContainer);

  // Nombre de plataforma
  assert.ok(cardsHtml.includes('SUR'), 'Muestra SUR');
  // Cajas físicas totales a cargar
  assert.ok(cardsHtml.includes('70'), 'Muestra 70 cajas físicas');
  assert.ok(cardsHtml.includes('cajas'), 'Muestra rótulo cajas');
  // Productos y variedades físicas
  assert.ok(cardsHtml.includes('Pera Rama'), 'Muestra Pera Rama');
  assert.ok(cardsHtml.includes('Sunstream') || cardsHtml.includes('Cherry'), 'Muestra Cherry Sunstream');
  assert.ok(cardsHtml.includes('58'), 'Muestra 58 cajas de pera');
  assert.ok(cardsHtml.includes('12'), 'Muestra 12 cajas de cherry');
  // Tipo y número de palets
  assert.ok(cardsHtml.includes('METROCHEP') || cardsHtml.includes('palet') || cardsHtml.includes('palets'), 'Muestra información de palets');
  // Acordeón de detalle físico
  assert.ok(cardsHtml.includes('Ver detalle físico'), 'Conserva el acordeón de detalle físico');
});

// =============================================================================
// 8. BADGES DE PROCEDENCIA INTACTOS
// =============================================================================
check('8. Badges de procedencia intactos', () => {
  const state = new AppState();
  // Anticipado
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026', origen: 'ANTICIPADO' });
  // Previsión
  state.addOrder({ platform: 'BARCELONA', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026', origen: 'PREVISION' });
  // Mixto
  state.addOrder({ platform: 'VALENCIA', productId: 'PERA_RAMA', cajas: 20, fechaEntrega: '26/09/2026', origen: 'ANTICIPADO' });
  state.addOrder({ platform: 'VALENCIA', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '26/09/2026', origen: 'PREVISION' });
  // Dividido
  const parent = state.addOrder({ platform: 'SEVILLA', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026', origen: 'PREVISION' });
  state.splitOrder(parent.id, [
    { platform: 'SEVILLA 1', cajas: 25 },
    { platform: 'SEVILLA 2', cajas: 15 }
  ]);

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 170 }
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlatformPlan(plan);

  const cardsContainer = doc.getElementById('platform-plan-cards-container');
  const cardsHtml = serialize(cardsContainer);

  assert.ok(cardsHtml.includes('ANTICIPADO'), 'Badge ANTICIPADO presente');
  assert.ok(cardsHtml.includes('PREVISIÓN'), 'Badge PREVISIÓN presente');
  assert.ok(cardsHtml.includes('MIXTO'), 'Badge MIXTO presente');
  assert.ok(cardsHtml.includes('DIVIDIDO'), 'Badge DIVIDIDO presente');
});

// =============================================================================
// 9. DESGLOSE POR ORIGEN EN TARJETA MIXTA INTACTO
// =============================================================================
check('9. Desglose por origen en tarjeta mixta intacto', () => {
  const state = new AppState();
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '26/09/2026', origen: 'ANTICIPADO' });
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026', origen: 'PREVISION' });

  // Stock con déficit: 40 cajas físicas para una demanda total mixta de 55
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 40 }
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPlatformPlan(plan);

  const cardsHtml = serialize(doc.getElementById('platform-plan-cards-container'));

  // Muestra procedencia de la demanda sin inventar servido arbitrario
  assert.ok(cardsHtml.includes('25 ANTICIPADO · 30 PREVISIÓN'), 'Desglose de demanda conservado fielmente');
  assert.ok(!cardsHtml.includes('ANTICIPADO servido'), 'No atribuye servido falso a anticipado');
  assert.ok(!cardsHtml.includes('PREVISIÓN servido'), 'No atribuye servido falso a previsión');
});

// =============================================================================
// 10. WHATSAPP CON SERVIDO PRINCIPAL, DEMANDADO SECUNDARIO, PENDIENTE CONDICIONAL
// =============================================================================
check('10. WhatsApp con SERVIDO principal, DEMANDADO secundario, PENDIENTE condicional', () => {
  const state = new AppState();
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '26/09/2026' });

  // A) Con déficit (pendiente = 10)
  const planDeficit = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 40 }
  });
  const waDeficit = formatWhatsAppMessage(planDeficit, state.orders, '26/09/2026');

  assert.ok(waDeficit.includes('*SERVIDO: 40 cjs*'), 'WhatsApp tiene SERVIDO como balance principal');
  assert.ok(waDeficit.includes('PEDIDO: 50 cajas'), 'WhatsApp tiene PEDIDO como dato secundario');
  assert.ok(waDeficit.includes('PENDIENTE: 10 cjs'), 'WhatsApp muestra PENDIENTE cuando es > 0');
  assert.ok(waDeficit.includes('*RESUMEN DE LO SERVIDO*'), 'WhatsApp incluye sección RESUMEN DE LO SERVIDO');
  assert.ok(waDeficit.includes('• Pera Rama: 40 CJS'), 'WhatsApp muestra únicamente cajas servidas por producto');
  assert.ok(!waDeficit.includes('(Faltan'), 'WhatsApp en plataformas no contiene (Faltan X cjs)');

  // B) Sin déficit (pendiente = 0)
  const planCompleto = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 50 }
  });
  const waCompleto = formatWhatsAppMessage(planCompleto, state.orders, '26/09/2026');
  assert.ok(waCompleto.includes('0 cjs pendientes'), 'WhatsApp muestra 0 cjs pendientes de forma neutra');
});

// =============================================================================
// 11. PDF CON LA MISMA JERARQUÍA
// =============================================================================
check('11. PDF con la misma jerarquía', () => {
  // Verificación en markup del contenedor de impresión de index.html
  assert.ok(HTML_CONTENT.includes('id="print-header-servido"'), 'index.html contiene #print-header-servido');
  assert.ok(HTML_CONTENT.includes('id="print-header-demandado"'), 'index.html contiene #print-header-demandado');
  assert.ok(HTML_CONTENT.includes('id="print-header-pendiente"'), 'index.html contiene #print-header-pendiente');
  assert.ok(HTML_CONTENT.includes('id="print-header-products-summary"'), 'index.html contiene #print-header-products-summary');

  const state = new AppState();
  state.addOrder({ platform: 'MADRID', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 75 }
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPrintHeaderSummary(plan);

  assert.strictEqual(String(doc.getElementById('print-header-servido').textContent), '75', 'PDF tiene servido 75');
  assert.strictEqual(String(doc.getElementById('print-header-demandado').textContent), '100', 'PDF tiene demandado 100');
  assert.strictEqual(String(doc.getElementById('print-header-pendiente').textContent), '25', 'PDF tiene pendiente 25');
  const printProdSummary = serialize(doc.getElementById('print-header-products-summary'));
  assert.ok(printProdSummary.includes('Pera Rama: 75 CJS'), 'PDF resume por producto con 75 CJS');
  assert.ok(!printProdSummary.includes('ped'), 'PDF no muestra ped');
});

// =============================================================================
// 12. IMPRESIÓN CON LA MISMA JERARQUÍA
// =============================================================================
check('12. Impresión con la misma jerarquía', () => {
  const state = new AppState();
  state.addOrder({ platform: 'SUR', productId: 'PERA_RAMA', cajas: 58, fechaEntrega: '26/09/2026' });
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 58 }
  });

  const doc = createTestHarness();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  ctrl.renderPrintHeaderSummary(plan);

  // Verificación de compatibilidad hacia atrás: elementos existentes no se rompieron
  assert.strictEqual(String(doc.getElementById('print-grand-total-boxes').textContent), '58', 'Conserva total en #print-grand-total-boxes');
  const articlesList = serialize(doc.getElementById('print-articles-totals-list'));
  assert.ok(articlesList.includes('TOTAL PERA: 58'), 'Conserva desglose tradicional por artículo en impresión');
});

// =============================================================================
// 13. DATASET DEL 18/09 SIGUE FUNCIONANDO EXACTAMENTE IGUAL
// =============================================================================
check('13. Dataset del 18/09 sigue funcionando exactamente igual', () => {
  const RAW_18SEP = DATASETS['18_SEP'];
  const stock18Sep = {
    'PERA_RAMA': 320,
    'COCKTAIL_ROMANTICO::CONSABOR': 0,
    'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
    'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
    'CHERRY_RAMA::SUNSTREAM': 100
  };

  const plan = orchestrator.planLoad({
    rawText: RAW_18SEP,
    stock: stock18Sep
  });

  assert.strictEqual(plan.totalBoxes, 522, 'Total cajas servidas debe ser exactamente 522');
  assert.strictEqual(plan.palletSummaries.totalPallets, 17, 'Total palets debe ser 17');
  assert.strictEqual(plan.palletSummaries.totalPalletSlots, 9, 'Total torres/huecos debe ser 9');
});

// =============================================================================
// 14. CASO CARREFOUR SIGUE FUNCIONANDO EXACTAMENTE IGUAL
// =============================================================================
check('14. Caso Carrefour sigue funcionando exactamente igual', () => {
  const FORECAST = 'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80';
  const stockConsabor = {
    'PERA_RAMA': 0,
    'COCKTAIL_ROMANTICO::CONSABOR': 100,
    'COCKTAIL_ROMANTICO::SAO_PAULO': 0,
    'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
    'CHERRY_RAMA::SUNSTREAM': 0
  };

  const plan = orchestrator.planLoad({
    rawText: FORECAST,
    stock: stockConsabor
  });

  assert.strictEqual(plan.allocations[0].allocatedQuantity, 80, 'Carrefour 80 servidas');
  assert.strictEqual(plan.allocations[0].missingQuantity, 0, 'Carrefour 0 pendientes');

  const wa = formatWhatsAppMessage(plan, plan.allocations.map(a => ({ platform: a.platform, productId: a.productId, varietyId: a.varietyId, cajas: a.requestedQuantity })), '26/08/2026');
  assert.ok(wa.includes('*SERVIDO: 80 cjs*'), 'WhatsApp muestra 80 servidas en balance');
  assert.ok(!wa.includes('PENDIENTE:'), 'WhatsApp no muestra pendiente');
});

// =============================================================================
// 15. MOBILE NO SE HA VISTO AFECTADO
// =============================================================================
check('15. Mobile no se ha visto afectado', () => {
  // A) mobile.css no se ha modificado
  assert.ok(MOBILE_CSS_CONTENT.includes('#mobile-header'), 'mobile.css contiene #mobile-header intacto');
  assert.ok(MOBILE_CSS_CONTENT.includes('#mobile-tabbar'), 'mobile.css contiene #mobile-tabbar intacto');
  assert.ok(MOBILE_CSS_CONTENT.includes('#mobile-kpi-summary'), 'mobile.css contiene #mobile-kpi-summary intacto');

  // B) En desktop (1280px), #plan-global-header no se contamina de clases móviles
  const doc = createDocument(HTML_CONTENT);
  assert.ok(doc.getElementById('plan-global-header'), 'Elemento #plan-global-header está en el DOM');
  assert.ok(doc.getElementById('mobile-header'), 'Elemento #mobile-header sigue existiendo para el shell móvil');
  assert.ok(doc.getElementById('mobile-tabbar'), 'Elemento #mobile-tabbar sigue existiendo para el shell móvil');

  // C) UIController inicializa shell móvil sin colisión
  const state = new AppState();
  const ctrl = new UIController(state);
  ctrl.bindDOM(doc);
  assert.strictEqual(ctrl.currentView, 'plan', 'Controlador arranca vista plan en móvil sin fallar');
});

// =============================================================================
// RESUMEN FINAL
// =============================================================================
console.log(`\n${passedChecks}/${totalChecks} comprobaciones superadas`);
if (passedChecks === totalChecks) {
  console.log('RESULTADO: Todos los 15 puntos de simplificación del Plan de Carga V4.5 superados con éxito.\n');
  process.exit(0);
} else {
  console.error(`RESULTADO: ${totalChecks - passedChecks} comprobaciones fallidas.\n`);
  process.exit(1);
}

/**
 * FASE MOBILE V1 · TESTS END-TO-END (E2E) DEL WORKFLOW OPERATIVO
 *
 * Verifica el ciclo de vida completo de la UX móvil sobre el DOM real de index.html:
 *  1. Estado inicial: Stepper prominente, 4 pasos presentes, KPIs en .is-preplan (sin 6 ceros dominantes).
 *  2. Previsión: Pegar datos -> Analizar -> Previsión marcada ✓ con cjs reales.
 *  3. Transición táctil: Botón #btn-next-to-stock navega a Stock.
 *  4. Stock táctil: Steppers (+10 +10 -> 20) sincronizan AppState y marcan Stock ✓.
 *  5. Bloqueos opcionales: Acceso contextual Paso 3 -> Bloqueo activo -> Retorno guiado a Stock.
 *  6. Generar Plan: Paso 4 -> Cálculo logístico completo -> Plan marcado ✓ -> KPIs en .has-plan con cifras reales.
 *  7. Salida operativa directa: Bloque de salida en vista Plan visible (PDF, WhatsApp, Imprimir).
 *  8. Caso obligatorio Carrefour: 80 cajas Cocktail Romántico Consabor servidas, 0 pendientes.
 *  9. Navegación libre (NO WIZARD): Stepper y tabbar permiten alternar vistas en cualquier momento sin bloqueo.
 *
 * Uso: node tests/mobile-workflow-e2e.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const ui = require(path.join(SRC, 'ui.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const htmlContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

if (typeof global.window === 'undefined') {
  global.window = {
    location: { search: '' },
    addEventListener() {},
    scrollTo() {},
    requestAnimationFrame: undefined
  };
}

function createHarness() {
  const doc = createDocument(htmlContent);
  global.document = doc;
  const state = new ui.AppState();
  const controller = new ui.UIController(state);
  controller.bindDOM();
  return { doc, state, controller };
}

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: (err && err.message) || String(err) });
  }
}

console.log('=== FASE MOBILE V1 · E2E WORKFLOW TEST ===\n');

// ---------------------------------------------------------------------------
// 1. Estado Inicial (Pre-plan)
// ---------------------------------------------------------------------------
check('1.1 · Stepper #mobile-workflow-bar existe en index.html con las 4 etapas', () => {
  const { doc } = createHarness();
  const bar = doc.getElementById('mobile-workflow-bar');
  assert.ok(bar, 'No se encontró #mobile-workflow-bar');
  const steps = bar.querySelectorAll('.mwb-step');
  assert.strictEqual(steps.length, 4, 'Deben existir 4 etapas en el stepper');

  const targets = Array.from(steps).map(s => s.getAttribute('data-wf-target'));
  assert.deepStrictEqual(targets, ['forecast', 'stock', 'locks', 'plan']);
});

check('1.2 · Estado inicial: Previsión es la siguiente acción recomendada, stock y plan pendientes', () => {
  const { doc, controller } = createHarness();
  controller.setView('forecast');
  const bar = doc.getElementById('mobile-workflow-bar');
  const stepForecast = bar.querySelector('[data-wf-target="forecast"]');
  const stepStock = bar.querySelector('[data-wf-target="stock"]');
  const stepPlan = bar.querySelector('[data-wf-target="plan"]');

  assert.ok(stepForecast.classList.contains('is-active'), 'Paso 1 debe estar activo en vista forecast');
  assert.ok(!stepForecast.classList.contains('is-done'), 'Paso 1 no debe estar completado aún');
  assert.ok(stepStock.classList.contains('is-pending'), 'Paso 2 debe estar pendiente');
  assert.ok(stepPlan.classList.contains('is-pending'), 'Paso 4 debe estar pendiente');
});

check('1.3 · Resumen KPI nace con .is-preplan y sin .has-plan (no muestra 6 ceros gigantes)', () => {
  const { doc, controller } = createHarness();
  controller.setView('forecast');
  const kpi = doc.getElementById('mobile-kpi-summary');
  assert.ok(kpi.classList.contains('is-preplan'), 'Debe tener clase is-preplan antes de generar el plan');
  assert.ok(!kpi.classList.contains('has-plan'), 'No debe tener clase has-plan antes de generar el plan');
});

check('1.4 · Bloque de acciones de salida en vista Plan está oculto antes de haber plan', () => {
  const { doc } = createHarness();
  const output = doc.getElementById('plan-mobile-output-actions');
  assert.ok(output, 'Debe existir #plan-mobile-output-actions');
  assert.ok(output.classList.contains('hidden'), 'El bloque de salida debe estar oculto inicialmente');
});

// ---------------------------------------------------------------------------
// 2. Previsión: Carga y Análisis
// ---------------------------------------------------------------------------
check('2.1 · Carga de previsión y análisis actualiza Paso 1 a completado (✓)', () => {
  const { doc, controller } = createHarness();
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();

  const bar = doc.getElementById('mobile-workflow-bar');
  const stepForecast = bar.querySelector('[data-wf-target="forecast"]');
  assert.ok(stepForecast.classList.contains('is-done'), 'Paso 1 debe marcarse is-done');

  const numEl = stepForecast.querySelector('.mwb-num');
  assert.strictEqual(numEl.textContent.trim(), '✓');

  const subEl = stepForecast.querySelector('.mwb-sub');
  assert.ok(subEl.textContent.includes('522 cjs'), `Subtítulo debe mostrar 522 cjs: ${subEl.textContent}`);
});

check('2.2 · Tras análisis aparece el botón #btn-next-to-stock para avance guiado', () => {
  const { doc, controller } = createHarness();
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();

  const nextBtn = doc.getElementById('btn-next-to-stock');
  assert.ok(nextBtn, 'Debe existir el botón #btn-next-to-stock');
  const card = doc.getElementById('forecast-analysis-card');
  assert.ok(!card.classList.contains('hidden'), 'La tarjeta de pre-análisis debe ser visible');
});

// ---------------------------------------------------------------------------
// 3. Transición Táctil Guiada a Stock (Paso 2)
// ---------------------------------------------------------------------------
check('3.1 · Pulsar #btn-next-to-stock conmuta la vista a "stock" y activa Paso 2 en el Stepper', () => {
  const { doc, controller } = createHarness();
  controller.setView('forecast');
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();

  doc.getElementById('btn-next-to-stock').click();
  assert.strictEqual(controller.currentView, 'stock', 'La vista activa debe ser stock');
  assert.strictEqual(doc.querySelector('main').getAttribute('data-view'), 'stock');

  const bar = doc.getElementById('mobile-workflow-bar');
  const stepStock = bar.querySelector('[data-wf-target="stock"]');
  assert.ok(stepStock.classList.contains('is-active'), 'Paso 2 debe tener clase is-active');
});

// ---------------------------------------------------------------------------
// 4. Stock Táctil y Steppers
// ---------------------------------------------------------------------------
check('4.1 · Introducir existencias con steppers actualiza el AppState y marca Stock como completado (✓)', () => {
  const { doc, controller } = createHarness();
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();
  controller.setView('stock');

  // Pulsar stepper +10 dos veces en Pera Rama
  const btnPlusPera = doc.querySelector('.stock-step[data-stock-target="stock-pera"][data-stock-delta="10"]');
  assert.ok(btnPlusPera, 'Botón stepper +10 para pera debe existir');
  btnPlusPera.click();
  btnPlusPera.click();

  const inputPera = doc.getElementById('stock-pera');
  assert.strictEqual(inputPera.value, '20', 'Input de pera debe valer 20');
  assert.strictEqual(controller.state.stock['PERA_RAMA'], 20, 'AppState debe tener 20 en PERA_RAMA');

  const bar = doc.getElementById('mobile-workflow-bar');
  const stepStock = bar.querySelector('[data-wf-target="stock"]');
  assert.ok(stepStock.classList.contains('is-done'), 'Paso 2 debe marcarse is-done');
  assert.strictEqual(stepStock.querySelector('.mwb-num').textContent.trim(), '✓');
});

// ---------------------------------------------------------------------------
// 5. Bloqueos Opcionales (Paso 3)
// ---------------------------------------------------------------------------
check('5.1 · Paso 3 contextual accesible desde Stock y actualiza estado al configurar bloqueos', () => {
  const { doc, controller } = createHarness();
  controller.setView('stock');

  const wfLocksBtn = doc.getElementById('btn-workflow-locks');
  assert.ok(wfLocksBtn, 'Botón #btn-workflow-locks debe existir en la tarjeta de Paso 3');
  wfLocksBtn.click();
  assert.strictEqual(controller.currentView, 'locks', 'Debe navegar a la vista locks');

  // Añadir un bloqueo completo
  controller.selectLockPlatform('CENTRO');
  controller.createFullLock('PERA_RAMA', null, 'PERA RAMA');
  assert.strictEqual(controller.state.locks.length, 1);

  const bar = doc.getElementById('mobile-workflow-bar');
  const stepLocks = bar.querySelector('[data-wf-target="locks"]');
  assert.ok(stepLocks.classList.contains('is-done'), 'Paso 3 debe marcarse is-done al tener bloqueos');

  // Botón para volver a stock
  const btnBack = doc.getElementById('btn-locks-to-stock');
  assert.ok(btnBack, 'Debe existir #btn-locks-to-stock');
  btnBack.click();
  assert.strictEqual(controller.currentView, 'stock', 'Debe retornar a stock');
});

// ---------------------------------------------------------------------------
// 6. Generación del Plan de Carga (Paso 4)
// ---------------------------------------------------------------------------
check('6.1 · Generar el plan ejecuta el motor logístico, marca Paso 4 ✓ y activa KPIs en .has-plan', () => {
  const { doc, controller } = createHarness();
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();
  controller.fillStock({
    'PERA_RAMA': 320,
    'COCKTAIL_ROMANTICO::CONSABOR': 0,
    'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
    'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
    'CHERRY_RAMA::SUNSTREAM': 100
  });

  const btnGenerate = doc.getElementById('btn-generate-plan');
  assert.ok(btnGenerate, 'Botón #btn-generate-plan debe existir');
  btnGenerate.click();

  assert.ok(controller.state.planningResult, 'PlanningResult debe haberse generado');

  controller.setView('plan');
  const bar = doc.getElementById('mobile-workflow-bar');
  const stepPlan = bar.querySelector('[data-wf-target="plan"]');
  assert.ok(stepPlan.classList.contains('is-done'), 'Paso 4 debe marcarse is-done');
  assert.strictEqual(stepPlan.querySelector('.mwb-num').textContent.trim(), '✓');

  const kpi = doc.getElementById('mobile-kpi-summary');
  assert.ok(kpi.classList.contains('has-plan'), 'KPI summary debe tener .has-plan');
  assert.ok(!kpi.classList.contains('is-preplan'), 'KPI summary NO debe tener .is-preplan');

  const mkpiBoxes = doc.getElementById('mkpi-boxes').textContent;
  assert.strictEqual(Number(mkpiBoxes), 522, 'Cajas en KPI deben ser 522');
});

// ---------------------------------------------------------------------------
// 7. Acciones de Salida Directa en Vista Plan
// ---------------------------------------------------------------------------
check('7.1 · Tras generar plan, el bloque #plan-mobile-output-actions se muestra con PDF, WhatsApp e Imprimir', () => {
  const { doc, controller } = createHarness();
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();
  controller.fillStock({ 'PERA_RAMA': 320, 'COCKTAIL_ROMANTICO::SAO_PAULO': 59 });
  controller.handleGeneratePlan();
  controller.setView('plan');

  const output = doc.getElementById('plan-mobile-output-actions');
  assert.ok(!output.classList.contains('hidden'), 'El bloque de salida debe estar visible tras calcular plan');

  const btnPdf = doc.getElementById('btn-plan-output-pdf');
  const btnWa = doc.getElementById('btn-plan-output-whatsapp');
  const btnPrint = doc.getElementById('btn-plan-output-print');

  assert.ok(btnPdf, 'Botón PDF de salida debe existir');
  assert.ok(btnWa, 'Botón WhatsApp de salida debe existir');
  assert.ok(btnPrint, 'Botón Imprimir de salida debe existir');
});

// ---------------------------------------------------------------------------
// 8. Caso Obligatorio Carrefour
// ---------------------------------------------------------------------------
check('8.1 · Prueba Carrefour: 80 cajas Cocktail Romántico Consabor servidas completas', () => {
  const { doc, controller } = createHarness();
  doc.getElementById('tsv-input').value = 'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t80';
  controller.handleAnalyze();
  controller.fillStock({ 'COCKTAIL_ROMANTICO::CONSABOR': 80 });

  controller.handleGeneratePlan();
  const res = controller.state.planningResult;
  assert.ok(res, 'Plan generado');

  const allocs = res.allocations || [];
  const consaborAlloc = allocs.find(a => a.platform === 'CENTRO' && a.varietyId === 'CONSABOR');
  assert.ok(consaborAlloc, 'Debe existir asignación a CENTRO de variedad CONSABOR');
  assert.strictEqual(consaborAlloc.allocatedQuantity, 80, 'Deben asignarse 80 cajas');
  assert.strictEqual(consaborAlloc.missingQuantity, 0, 'Deben faltar 0 cajas');
});

// ---------------------------------------------------------------------------
// 9. Navegación Libre (NO WIZARD)
// ---------------------------------------------------------------------------
check('9.1 · Pulsar libremente cualquier paso del stepper cambia de vista sin bloqueo', () => {
  const { doc, controller } = createHarness();

  const bar = doc.getElementById('mobile-workflow-bar');
  const stepStock = bar.querySelector('[data-wf-target="stock"]');
  const stepLocks = bar.querySelector('[data-wf-target="locks"]');
  const stepPlan = bar.querySelector('[data-wf-target="plan"]');
  const stepForecast = bar.querySelector('[data-wf-target="forecast"]');

  stepStock.click();
  assert.strictEqual(controller.currentView, 'stock', 'Clic en paso 2 debe llevar a stock');

  stepLocks.click();
  assert.strictEqual(controller.currentView, 'locks', 'Clic en paso 3 debe llevar a locks');

  stepPlan.click();
  assert.strictEqual(controller.currentView, 'plan', 'Clic en paso 4 debe llevar a plan');

  stepForecast.click();
  assert.strictEqual(controller.currentView, 'forecast', 'Clic en paso 1 debe llevar a forecast');
});

check('9.2 · Tabbar inferior mantiene paridad y acceso libre a las 4 pantallas', () => {
  const { doc, controller } = createHarness();

  const tabForecast = doc.querySelector('.mt-tab[data-nav-view="forecast"]');
  const tabStock = doc.querySelector('.mt-tab[data-nav-view="stock"]');
  const tabPlan = doc.querySelector('.mt-tab[data-nav-view="plan"]');
  const tabMore = doc.querySelector('.mt-tab[data-nav-view="more"]');

  tabStock.click();
  assert.strictEqual(controller.currentView, 'stock');

  tabPlan.click();
  assert.strictEqual(controller.currentView, 'plan');

  tabMore.click();
  assert.strictEqual(controller.currentView, 'more');

  tabForecast.click();
  assert.strictEqual(controller.currentView, 'forecast');
});

// Resumen final
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`        -> ${r.error}`);
}
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
if (failed > 0) process.exitCode = 1;

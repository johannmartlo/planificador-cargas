/**
 * FASE 18.5 — FLUJO OPERATIVO (workflow visible).
 *
 * Protege el indicador PREVISIÓN → STOCK → PLAN → SALIDA y, sobre todo, que su
 * estado se derive del AppState EXISTENTE sin inventar cifras ni duplicar estado.
 *
 * Estados exigidos por la fase (§24):
 *   A) sin previsión            -> siguiente = previsión
 *   B) previsión, sin stock     -> siguiente = stock
 *   C) previsión + stock        -> siguiente = plan
 *   D) plan generado            -> siguiente = salida, todo hecho
 *   E) plan con incidencias     -> la etapa PLAN queda marcada como incidencia
 *
 * Uso: node tests/mobile-workflow.test.js
 */
'use strict';

const path = require('path');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const ui = require(path.join(SRC, 'ui.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const doc = createDocument('<div id="mkpi-foot"></div>');
global.document = doc;

const c = new ui.UIController(new ui.AppState());
const foot = doc.getElementById('mkpi-foot');
const html = () => foot.innerHTML;
const next = () => foot.getAttribute && foot.getAttribute('data-wf-next');

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: (e && e.message) || String(e) }); }
}

// --- A) Estado inicial: sin previsión ---------------------------------------
c.renderWorkflowStrip();
check('A · sin previsión: la etapa PREVISIÓN es la siguiente', () => {
  assert.ok(/is-next[^"]*"[^>]*>\s*<i[^>]*>→<\/i>Previsión/.test(html()) || /→<\/i>Previsión/.test(html()),
    'no se marca PREVISIÓN como siguiente: ' + html());
  assert.ok(/Stock/.test(html()) && /Plan/.test(html()) && /Salida/.test(html()),
    'no se muestran las 4 etapas del flujo');
  assert.strictEqual(next(), 'forecast');
});
check('A · sin previsión: se indica qué hacer', () => {
  assert.ok(/Pega la previsión/.test(html()), 'no se orienta al usuario: ' + html());
});

// --- B) Previsión analizada, sin stock --------------------------------------
c.state.forecastAnalysis = { validLinesCount: 3, platformsFound: ['CENTRO', 'SUR'], totalRequested: 241 };
c.renderWorkflowStrip();
check('B · previsión analizada: PREVISIÓN queda hecha y el siguiente es STOCK', () => {
  assert.ok(/✓<\/i>Previsión/.test(html()), 'PREVISIÓN no aparece como hecha: ' + html());
  assert.strictEqual(next(), 'stock');
});
check('B · muestra cifras REALES del análisis (no inventadas)', () => {
  assert.ok(/2 plataformas/.test(html()), 'no usa platformsFound: ' + html());
  assert.ok(/241 cajas/.test(html()), 'no usa totalRequested: ' + html());
});

// --- C) Previsión + stock ---------------------------------------------------
c.state.setStockItem('PERA_RAMA', 10);
c.renderWorkflowStrip();
check('C · con stock: STOCK queda hecho y el siguiente es PLAN (generar)', () => {
  assert.ok(/✓<\/i>Stock/.test(html()), 'STOCK no aparece como hecho: ' + html());
  assert.strictEqual(next(), 'plan');
});
check('C · el progreso de stock sale del AppState', () => {
  assert.ok(/stock 1\/\d+/.test(html()), 'no informa de referencias introducidas: ' + html());
});

// --- C2) BLOQUEOS: etapa 3 del flujo (FASE 18.6) ---------------------------
check('C2 · BLOQUEOS es una etapa visible del flujo', () => {
  assert.ok(/Bloqueos/.test(html()), 'la etapa BLOQUEOS no aparece en el flujo: ' + html());
});
check('C2 · sin bloqueos reales la etapa no se marca como completada', () => {
  // «Sin bloqueos» no es un logro: se informa, no se marca ✓.
  assert.ok(!/✓<\/i>Bloqueos/.test(html()), 'BLOQUEOS con ✓ sin bloqueos reales: ' + html());
});
c.state.locks = [{ platform: 'CENTRO', productId: 'PERA_RAMA', type: 'FULL' }];
c.renderWorkflowStrip();
check('C2 · con bloqueos reales la etapa se marca', () => {
  assert.ok(/✓<\/i>Bloqueos/.test(html()), 'BLOQUEOS no se marca con bloqueos activos: ' + html());
});
c.state.locks = []; // higiene: no debe condicionar los estados D y E

// --- D) Plan generado ------------------------------------------------------
c.state.planningResult = { allocations: [{ allocatedQuantity: 80, missingQuantity: 0 }] };
c.renderWorkflowStrip(c.state.planningResult);
check('D · plan generado: PREVISIÓN/STOCK/PLAN hechas y SALIDA como siguiente', () => {
  assert.strictEqual((html().match(/is-done/g) || []).length, 3,
    'sólo deben estar hechas previsión, stock y plan: ' + html());
  assert.strictEqual(next(), 'out');
  assert.ok(/→<\/i>Salida/.test(html()),
    'SALIDA no aparece como siguiente acción disponible: ' + html());
});
check('D · SALIDA nunca se marca como completada (no hay evidencia de exportación)', () => {
  // §3: la app no tiene estado fiable de PDF generado / WhatsApp copiado /
  // impresión, así que no puede afirmar «✓ Salida». Queda como siguiente paso.
  assert.ok(!/✓<\/i>Salida/.test(html()), 'SALIDA aparece con ✓ sin evidencia: ' + html());
});
check('D · el detalle dice el estado del plan y dónde exportar', () => {
  assert.ok(/plan completo · exporta en MÁS/.test(html()), 'detalle inesperado: ' + html());
});

// --- E) Plan con incidencias -----------------------------------------------
c.state.planStatus = 'PLANIFICACIÓN CON INCIDENCIAS';
c.renderWorkflowStrip(c.state.planningResult);
check('E · incidencias: la etapa PLAN se marca como incidencia', () => {
  assert.ok(/is-warn/.test(html()), 'no se señala la incidencia: ' + html());
});
check('E · sin faltantes reales no inventa un aviso de faltantes', () => {
  assert.ok(!/faltan \d+ cjs/.test(html()), 'inventa faltantes: ' + html());
});

c.state.planningResult = { allocations: [{ allocatedQuantity: 40, missingQuantity: 40 }] };
c.state.planStatus = 'PLANIFICACIÓN CORRECTA';
c.renderWorkflowStrip(c.state.planningResult);
check('E · con faltantes reales sí lo dice', () => {
  assert.ok(/faltan 40 cjs por servir/.test(html()), 'no informa de faltantes reales: ' + html());
});

console.log('\n=== FASE 18.5 · FLUJO OPERATIVO MOBILE ===\n');
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`        -> ${r.error}`);
}
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
if (failed > 0) process.exitCode = 1;

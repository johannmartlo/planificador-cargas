/**
 * PHASE 18 — MOBILE SHELL TESTS
 *
 * Cobertura exigida (§22):
 *   - viewports 320 / 360 / 390 / 430 / 480 y portrait
 *   - ausencia de scroll horizontal
 *   - navegación inferior (4 destinos, touch targets)
 *   - previsión, stock, locks, planificación, detalle de plataforma
 *   - replanificación (plan stale)
 *   - PDF, WhatsApp
 *   - dark mode / light mode
 *
 * Las comprobaciones de layout se hacen sobre el CSS y el marcado estáticos
 * (no hay motor de render en Node); las de comportamiento se ejecutan contra el
 * UIController real sobre un DOM mínimo montado limpio en cada caso.
 *
 * Uso: node tests/mobile-shell.test.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const parser = require(path.join(SRC, 'parser.js'));
const catalog = require(path.join(SRC, 'catalog.js'));
const ui = require(path.join(SRC, 'ui.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const CSS = fs.readFileSync(path.join(SRC, 'mobile.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const UI_JS = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');

const results = [];
const pending = [];

function check(name, fn) {
  if (fn && fn.constructor && fn.constructor.name === 'AsyncFunction') {
    pending.push(fn().then(
      () => results.push({ name, ok: true }),
      err => results.push({ name, ok: false, error: (err && err.message) || String(err) })
    ));
    return;
  }
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: (err && err.message) || String(err) });
  }
}

// ===========================================================================
// A. VERIFICACIÓN ESTÁTICA DEL CSS MÓVIL
// ===========================================================================

check('CSS · el archivo existe y es un stylesheet no vacío', () => {
  assert.ok(CSS.length > 5000, `mobile.css demasiado pequeño: ${CSS.length} bytes`);
  assert.ok(CSS.includes('@media'), 'no contiene media queries');
});

check('CSS · llaves balanceadas (stylesheet parseable)', () => {
  let depth = 0;
  for (const ch of CSS) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    assert.ok(depth >= 0, 'llave de cierre sin apertura');
  }
  assert.strictEqual(depth, 0, 'llaves sin cerrar');
});

check('CSS · el shell móvil está encapsulado en @media (max-width: 1023.98px)', () => {
  assert.ok(CSS.includes('@media (max-width: 1023.98px)'), 'falta el media query principal');
  const outside = CSS.split('@media (max-width: 1023.98px)')[0];
  assert.ok(!outside.includes('#results-column'), 'reglas de layout móvil fuera del media query');
  assert.ok(!outside.includes('.digital-loading-card'), 'reglas de tarjeta fuera del media query');
});

for (const vw of [320, 360, 390, 430, 480]) {
  check(`CSS ${vw}px (portrait) · cubierto por el shell móvil`, () => {
    assert.ok(vw <= 1023, `${vw}px debe caer en el shell móvil`);
    assert.ok(!HTML.includes('user-scalable=no'), 'no debe bloquear el zoom (accesibilidad)');
    assert.ok(HTML.includes('viewport-fit=cover'), 'falta viewport-fit=cover para safe-areas');
  });
}

check('CSS 320px · refuerzo específico para pantallas estrechas', () => {
  assert.ok(CSS.includes('@media (max-width: 360px)'), 'falta el bloque de móvil estrecho');
  const narrow = CSS.split('@media (max-width: 360px)')[1] || '';
  assert.ok(narrow.includes('#mobile-kpi-summary .mk-value'), 'KPIs no se ajustan a 320px');
  assert.ok(narrow.includes('.digital-loading-card h3'), 'títulos de plataforma no se ajustan');
});

check('CSS 480px · rejilla de 6 columnas para el resumen en tablet vertical', () => {
  assert.ok(CSS.includes('@media (min-width: 480px) and (max-width: 1023.98px)'), 'falta el tramo 480-1023');
  const tablet = CSS.split('@media (min-width: 480px) and (max-width: 1023.98px)')[1] || '';
  assert.ok(tablet.includes('repeat(6, minmax(0, 1fr))'), 'el resumen no pasa a 6 columnas');
});

check('CSS · sin scroll horizontal: overflow-x oculto + anchos máximos', () => {
  assert.ok(CSS.includes('overflow-x: hidden'), 'falta overflow-x: hidden en html');
  assert.ok(CSS.includes('max-width: 100% !important'), 'faltan límites de ancho');
  assert.ok(CSS.includes('minmax(0, 1fr)'), 'las rejillas deben usar minmax(0, 1fr) para no desbordar');
});

check('CSS · la tabla matricial deja de tener scroll horizontal en móvil', () => {
  const block = (CSS.split('#options-section .overflow-x-auto')[1] || '').trimStart();
  assert.ok(block.startsWith('{ overflow-x: visible !important; }'),
    'la tabla técnica debe apilarse en lugar de desplazarse en horizontal');
  assert.ok(CSS.includes('#options-section tbody tr'), 'falta el apilado de filas en tarjetas');
});

check('CSS · ningún ancho fijo mayor que 320px', () => {
  const widths = Array.from(CSS.matchAll(/(?:^|[\s{;])width:\s*(\d+)px/g)).map(m => Number(m[1]));
  const offenders = widths.filter(w => w > 320);
  assert.deepStrictEqual(offenders, [], `anchos fijos peligrosos: ${offenders.join(', ')}`);
});

check('CSS · objetivos táctiles >= 44px declarados', () => {
  assert.ok(CSS.includes('--m-touch: 44px'), 'falta el token de objetivo táctil');
  assert.ok(CSS.includes('--m-touch-lg: 52px'), 'falta el token de acción primaria');
  for (const sel of ['#mobile-tabbar .mt-tab', '#mobile-header #btn-theme-toggle',
    '.stock-stepper .stock-step', '#platform-plan-cards-container .btn-platform-detail',
    '.platform-detail-modal .pdm-close']) {
    assert.ok(CSS.includes(sel), `falta estilo táctil para ${sel}`);
  }
});

check('CSS · la tabbar tiene 4 destinos y altura de navegación de 68px', () => {
  assert.ok(CSS.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), 'la tabbar no tiene 4 columnas');
  // FASE 18.1: la navegación pasa de 56px a 68px (rango 64–72px de la fase).
  assert.ok(CSS.includes('--m-nav-h: 68px'), 'falta el token de altura de navegación');
  assert.ok(CSS.includes('min-height: var(--m-nav-h)'), 'los destinos no usan la altura de navegación');
});

check('CSS · en fila, los botones de #actions-toolbar no piden el 100% (sin overflow)', () => {
  // FASE 18.3: en la captura real de MÁS se veía un fragmento saliendo por el
  // borde derecho. Causa: el tramo 480-1023 pasa el contenedor a fila mientras
  // los 3 botones seguían a width:100% (3 x 100% + gaps > viewport).
  assert.ok(CSS.includes('#actions-toolbar #btn-export-pdf'),
    'falta el override de ancho de los botones de acciones en fila');
  assert.ok(/flex:\s*1 1 0/.test(CSS),
    'los botones de acciones no se reparten el espacio cuando el contenedor va en fila');
});

check('CSS · el estado vacío del PLAN no es un rectángulo gigante', () => {
  // FASE 18.3: objetivo ~130px de alto.
  assert.ok(/min-height:\s*130px/.test(CSS), 'el estado vacío del plan no limita su altura mínima');
});

// ---------------------------------------------------------------------------
// FASE 18.4 · Auditoría de producto
// ---------------------------------------------------------------------------

check('CSS · la capacidad técnica del palet no se expone en la UI de Stock', () => {
  // "76 cjs/palet EURO" es una regla interna del palletizer, no un dato para
  // introducir stock. El marcado sigue existiendo (compartido con Desktop).
  assert.ok(HTML.includes('sid-unit'), 'el marcado compartido con Desktop debe seguir intacto');
  assert.ok(/\.stock-id \.sid-unit\s*\{\s*display:\s*none/.test(CSS),
    'la metadata técnica del palet sigue visible en móvil');
});

check('ui.js · el stepper despacha un Event REAL cuando el DOM es real', () => {
  // BUG REAL: EventTarget.dispatchEvent(objetoPlano) lanza TypeError en los
  // navegadores ("parameter 1 is not of type Event"). El número cambiaba en
  // pantalla pero el AppState no se actualizaba: el plan se generaba con el
  // stock anterior. El doble mini-dom acepta objetos planos, así que los tests
  // no lo veían. Este check protege contra la regresión.
  assert.ok(/new Event\(\s*'input'/.test(UI_JS),
    "el stepper no construye un new Event('input')");
  assert.ok(/instanceof window\.EventTarget/.test(UI_JS),
    'no se detecta un EventTarget real: en navegador caería al objeto plano y fallaría');
  // El objeto plano solo puede quedar como último recurso, DESPUÉS del Event real.
  const idxReal = UI_JS.indexOf("new Event('input'");
  const idxPlain = UI_JS.search(/dispatchEvent\s*\(\s*\{/);
  assert.ok(idxPlain === -1 || idxPlain > idxReal,
    'el objeto plano se despacha antes del Event real: en navegador lanzaría TypeError');
});

// ---------------------------------------------------------------------------
// FASE 18.5.1 · Cierre del flujo operativo
// ---------------------------------------------------------------------------

check('HTML · MÁS separa SALIDA de CONFIGURACIÓN OPERATIVA (sólo rótulos)', () => {
  // §1: dos grupos visuales. No se mueve ninguna acción ni cambia ningún ID.
  assert.ok(HTML.includes('mm-group">Salida<'), 'falta el rótulo de grupo SALIDA');
  assert.ok(HTML.includes('mm-group">Configuración operativa<'),
    'falta el rótulo de grupo CONFIGURACIÓN OPERATIVA');
  assert.ok(/\.mm-group\s*\{/.test(CSS), 'falta el estilo de los grupos de MÁS');
  // Las 5 acciones siguen existiendo y en el MISMO orden.
  const ids = ['btn-more-export-pdf', 'btn-more-export-whatsapp', 'btn-more-print',
    'btn-more-locks', 'btn-more-options'];
  let last = -1;
  for (const id of ids) {
    const i = HTML.indexOf('id="' + id + '"');
    assert.ok(i > last, `${id} ausente o fuera de orden`);
    last = i;
  }
});

check('CSS · GENERAR PLAN DE CARGA se presenta como puente datos → resultado', () => {
  // §5 (18.6): el contexto incluye también BLOQUEOS, que ya es etapa del flujo.
  assert.ok(/PREVISIÓN \+ STOCK \+ BLOQUEOS → PLAN/.test(CSS),
    'falta el contexto visual del botón de generar');
  assert.ok(/#btn-generate-plan::before/.test(CSS), 'el contexto no se aplica al botón de generar');
});

check('HTML/CSS · PASO 3 del flujo da acceso contextual a los bloqueos existentes', () => {
  // §4 (18.6): BLOQUEOS deja de estar sólo en MÁS. Debe haber una entrada
  // contextual en el flujo que use la MISMA funcionalidad.
  assert.ok(HTML.includes('wf-step-card'), 'falta el bloque del PASO 3');
  assert.ok(HTML.includes('id="wf-locks-status"'), 'falta el estado de bloqueos del PASO 3');
  assert.ok(HTML.includes('id="btn-workflow-locks"'), 'falta el botón contextual de bloqueos');
  assert.ok(/\.wf-step-card\s*\{/.test(CSS), 'falta el estilo del bloque del PASO 3');
  // Sin lógica duplicada: la nueva entrada llama al MISMO setView('locks').
  assert.ok(/wire\('btn-workflow-locks', \(\) => self\.setView\('locks'\)\)/.test(UI_JS),
    "el acceso contextual no reutiliza setView('locks')");
  assert.ok(/wire\('btn-more-locks', \(\) => self\.setView\('locks'\)\)/.test(UI_JS),
    'MÁS debe conservar su acceso secundario a bloqueos');
  // MÁS conserva las 5 acciones (no se movió ninguna).
  for (const id of ['btn-more-export-pdf', 'btn-more-export-whatsapp', 'btn-more-print',
    'btn-more-locks', 'btn-more-options']) {
    assert.ok(HTML.includes('id="' + id + '"'), `MÁS perdió ${id}`);
  }
});

check('CSS · safe-areas de notch / barra inferior consideradas', () => {
  assert.ok(CSS.includes('env(safe-area-inset-top'), 'falta safe-area-inset-top');
  assert.ok(CSS.includes('env(safe-area-inset-bottom'), 'falta safe-area-inset-bottom');
  assert.ok(CSS.includes('env(safe-area-inset-bottom, 0px)) !important'),
    'el padding de main no reserva espacio para la tabbar');
});

check('CSS · sin dependencia de hover y sin elementos superpuestos', () => {
  assert.ok(CSS.includes('(hover: none)'), 'falta el tramo sin hover');
  assert.ok(CSS.includes('touch-action: manipulation'), 'faltan hints táctiles');
  assert.ok(CSS.includes('-webkit-tap-highlight-color'), 'falta el reset del highlight táctil');
});

check('CSS · el shell móvil se excluye de la impresión / PDF', () => {
  const printBlock = CSS.split('@media print')[1] || '';
  for (const sel of ['#mobile-header', '#mobile-tabbar', '#mobile-kpi-summary', '.platform-detail-modal']) {
    assert.ok(printBlock.includes(sel), `${sel} no se excluye de la impresión`);
  }
});

check('CSS · dark y light reutilizan los tokens existentes (sin tercer tema)', () => {
  assert.ok(!CSS.includes('data-theme="blue"'), 'no debe existir un tercer tema');
  assert.ok(CSS.includes('var(--clr-bg)'), 'no reutiliza los tokens de fondo');
  assert.ok(CSS.includes('var(--clr-text-primary)'), 'no reutiliza los tokens de texto');
  assert.ok(CSS.includes('html[data-theme="light"]'), 'falta el ajuste de contraste en modo claro');
});

check('index.html · anti-FOUC y persistencia de tema intactos', () => {
  assert.ok(HTML.includes("localStorage.getItem('planificador-theme')"), 'falta la lectura de tema');
  assert.ok(HTML.includes('<html lang="es" class="h-full" data-theme="dark">'), 'dark debe ser por defecto');
});

check('index.html · carga src/mobile.css y los 7 módulos del motor', () => {
  assert.ok(HTML.includes('href="src/mobile.css"'), 'no se enlaza mobile.css');
  for (const m of ['catalog.js', 'parser.js', 'hamilton.js', 'cocktail-solver.js',
    'palletizer.js', 'orchestrator.js', 'ui.js']) {
    assert.ok(HTML.includes(`src/${m}`), `falta el módulo ${m}`);
  }
});

// ===========================================================================
// B. VERIFICACIÓN ESTRUCTURAL DEL MARCADO
// ===========================================================================

check('HTML · header móvil compacto con acciones esenciales', () => {
  assert.ok(HTML.includes('id="mobile-header"'), 'falta el header móvil');
  const header = HTML.slice(HTML.indexOf('id="mobile-header"'), HTML.indexOf('PLANIFICADOR DE CARGA'));
  assert.ok(header.includes('RC3.1'), 'falta la marca de versión');
});

check('HTML · resumen compacto con las 6 cifras exigidas', () => {
  for (const id of ['mkpi-boxes', 'mkpi-assigned', 'mkpi-pending',
    'mkpi-platforms', 'mkpi-pallets', 'mkpi-towers']) {
    assert.ok(HTML.includes(`id="${id}"`), `falta la cifra ${id}`);
  }
});

check('HTML · tabbar inferior con PREVISIÓN / STOCK / PLAN / MÁS', () => {
  const tabs = Array.from(HTML.matchAll(/data-nav-view="([a-z]+)"/g)).map(m => m[1]);
  assert.deepStrictEqual(tabs, ['forecast', 'stock', 'plan', 'more']);
  const bar = HTML.slice(HTML.indexOf('id="mobile-tabbar"'));
  for (const label of ['Previsión', 'Stock', 'Plan', 'Más']) {
    assert.ok(bar.includes(label), `falta el texto ${label}`);
  }
  assert.strictEqual((bar.match(/class="mt-ico"/g) || []).length, 4, 'cada destino debe tener icono');
});

check('HTML · router de vistas conectado a las secciones reales', () => {
  assert.ok(HTML.includes('<main data-view="plan"'), 'falta data-view en main');
  for (const [section, view] of [['prevision-section', 'forecast'], ['stock-section', 'stock'],
    ['locks-section', 'locks'], ['options-section', 'options'], ['actions-toolbar', 'more']]) {
    assert.ok(new RegExp(`id="${section}" data-view="${view}"`).test(HTML),
      `${section} no está asociada a la vista ${view}`);
  }
});

check('HTML · modal de detalle de plataforma presente y accesible', () => {
  assert.ok(HTML.includes('id="platform-detail-modal"'), 'falta el modal de detalle');
  assert.ok(HTML.includes('role="dialog"'), 'falta role=dialog');
  assert.ok(HTML.includes('aria-modal="true"'), 'falta aria-modal');
  assert.ok(HTML.includes('id="pdm-close"'), 'falta el botón de cierre');
  assert.ok(HTML.includes('id="pdm-body"'), 'falta el contenedor de detalle');
  assert.ok(HTML.includes('hidden'), 'el modal debe arrancar oculto');
});

check('HTML · acciones PDF / WhatsApp / Imprimir accesibles desde móvil', () => {
  for (const id of ['btn-more-export-pdf', 'btn-more-export-whatsapp', 'btn-more-print',
    'btn-more-locks', 'btn-more-options']) {
    assert.ok(HTML.includes(`id="${id}"`), `falta el acceso rápido ${id}`);
  }
});

check('HTML · steppers táctiles de stock con sus 5 entradas', () => {
  const targets = Array.from(HTML.matchAll(/data-stock-target="([a-z-]+)"/g)).map(m => m[1]);
  assert.deepStrictEqual(Array.from(new Set(targets)).sort(), [
    'stock-cherry-sun', 'stock-cocktail-consabor', 'stock-cocktail-sp',
    'stock-cocktail-sun', 'stock-pera'
  ]);
  assert.strictEqual((HTML.match(/data-stock-delta="-10"/g) || []).length, 5, 'faltan decrementos');
  assert.strictEqual((HTML.match(/data-stock-delta="10"/g) || []).length, 5, 'faltan incrementos');
});

check('HTML · CONSABOR, SUNSTREAM y SAO_PAULO se introducen como variedades', () => {
  assert.ok(HTML.includes('>Consabor<'), 'falta la variedad Consabor');
  assert.ok(HTML.includes('>Sunstream<'), 'falta la variedad Sunstream');
  assert.ok(HTML.includes('>Sao Paulo<'), 'falta la variedad Sao Paulo');
  assert.ok(HTML.includes('id="stock-cocktail-consabor"'), 'falta el input de Consabor');
  assert.ok(!HTML.includes('id="stock-consabor"'), 'CONSABOR no debe ser un artículo propio');
});

check('HTML · el detalle no usa "hueco de camión" / truck slot (§8)', () => {
  const start = HTML.indexOf('id="platform-detail-modal"');
  const modalBlock = HTML.slice(start, start + 1200);
  assert.ok(!/hueco de cami[oó]n/i.test(modalBlock), 'el modal no debe hablar de huecos de camión');
  assert.ok(!/truck\s*slot/i.test(modalBlock), 'el modal no debe hablar de truck slots');
});

check('HTML · todo ID consultado por ui.js existe en index.html', () => {
  const uiSource = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');
  const ids = Array.from(uiSource.matchAll(/getElementById\('([a-zA-Z0-9_-]+)'\)/g)).map(m => m[1]);
  const missing = Array.from(new Set(ids)).filter(id => !HTML.includes(`id="${id}"`));
  assert.deepStrictEqual(missing, [], `IDs referenciados y ausentes: ${missing.join(', ')}`);
});

// ===========================================================================
// C. COMPORTAMIENTO REAL SOBRE EL UIController
// ===========================================================================

const MOBILE_DOM = `
<main data-view="plan">
  <span id="badge-delivery-date"></span>
  <span id="badge-plan-status"></span>
  <span id="badge-plan-sync" class="hidden"></span>
  <div id="plan-desactualizado-banner" class="hidden"></div>
  <div id="kpi-allocated"></div>
  <div id="kpi-truck-slots"></div>
  <div id="kpi-pallet-slots"></div>
  <div id="kpi-pallets"></div>
  <div id="kpi-requested"></div>
  <div id="kpi-missing"></div>
  <div id="kpi-service-rate"></div>
  <div id="kpi-stock-details"></div>
  <div id="plan-calculated-time"></div>
  <span id="mkpi-boxes"></span>
  <span id="mkpi-assigned"></span>
  <span id="mkpi-pending"></span>
  <div id="mkpi-pending-cell"></div>
  <span id="mkpi-platforms"></span>
  <span id="mkpi-pallets"></span>
  <span id="mkpi-towers"></span>
  <span id="mkpi-foot"></span>
  <span id="mm-delivery-date"></span>
  <span id="mm-status"></span>
  <span id="mt-badge-forecast" hidden></span>
  <span id="mt-badge-plan" hidden></span>
  <textarea id="tsv-input"></textarea>
  <div id="forecast-analysis-card" class="hidden"></div>
  <span id="ana-total-lines"></span>
  <span id="ana-valid-lines"></span>
  <span id="ana-error-lines"></span>
  <span id="ana-detected-date"></span>
  <span id="ana-total-requested"></span>
  <div id="ana-demands-breakdown"></div>
  <div id="ana-platform-demands"></div>
  <div id="ana-corrupt-lines-box" class="hidden"></div>
  <div id="ana-corrupt-lines-list"></div>
  <input id="stock-pera" type="number" value="0" />
  <input id="stock-cocktail-consabor" type="number" value="0" />
  <input id="stock-cocktail-sp" type="number" value="0" />
  <input id="stock-cocktail-sun" type="number" value="0" />
  <input id="stock-cherry-sun" type="number" value="0" />
  <button id="btn-generate-plan"></button>
  <button id="btn-recalculate-banner"></button>
  <button id="btn-analyze"></button>
  <button id="btn-load-18sep"></button>
  <button id="btn-load-26aug"></button>
  <select id="lock-platform"></select>
  <select id="lock-product"></select>
  <select id="lock-type"><option value="FULL">FULL</option><option value="FIXED">FIXED</option></select>
  <div id="lock-qty-container"></div>
  <button id="btn-add-lock"></button>
  <select id="exclusion-type"><option value="PRODUCT">Producto</option></select>
  <select id="exclusion-product-val"></select>
  <select id="exclusion-platform-val"></select>
  <input id="exclusion-line-val" type="number" />
  <input id="exclusion-reason" type="text" />
  <div id="box-excl-product"></div>
  <div id="box-excl-platform" class="hidden"></div>
  <div id="box-excl-line" class="hidden"></div>
  <button id="btn-add-exclusion"></button>
  <div id="active-exclusions-list"></div>
  <select id="override-pallet-platform"></select>
  <select id="override-pallet-product"></select>
  <select id="override-pallet-type"><option value="EURO">EURO</option></select>
  <button id="btn-add-pallet-override"></button>
  <div id="active-pallet-overrides-list"></div>
  <div id="plan-comparison-section" class="hidden"><div id="plan-comparison-content"></div></div>
  <div id="lock-platform-pills"></div>
  <span id="lock-selected-platform-label"></span>
  <div id="lock-conflict-msg" class="hidden"></div>
  <div id="active-locks-list"></div>
  <button id="btn-lock-pera"></button>
  <button id="btn-lock-cocktail-consabor"></button>
  <button id="btn-lock-cocktail-sp"></button>
  <button id="btn-lock-cocktail-sun"></button>
  <button id="btn-lock-cherry"></button>
  <button id="btn-add-fixed-lock"></button>
  <select id="lock-fixed-product"><option value="PERA_RAMA">Pera Rama</option></select>
  <input id="lock-qty" type="number" />
  <div id="results-column">
    <div id="platform-plan-cards-container"></div>
  </div>
  <div id="platform-detail-modal" hidden>
    <span id="pdm-platform-name"></span>
    <div id="pdm-body"></div>
    <button id="pdm-close"></button>
  </div>
  <div id="warnings-errors-section" class="hidden"><div id="errors-list-container"></div><div><div id="warnings-list-container"></div></div></div>
  <div id="print-incidences-block"></div>
  <div id="print-doc-header" class="hidden"></div>
  <div id="print-articles-totals-list"></div>
  <span id="print-grand-total-boxes"></span>
  <span id="print-delivery-date"></span>
  <span id="print-emission-time"></span>
  <div id="print-signatures-block" class="hidden"></div>
  <div id="executive-summary-section"></div>
  <div id="actions-toolbar" class="hidden"></div>
  <div id="toast-action-feedback" class="hidden"></div>
</main>
<nav id="mobile-tabbar">
  <button class="mt-tab" data-nav-view="forecast"></button>
  <button class="mt-tab" data-nav-view="stock"></button>
  <button class="mt-tab" data-nav-view="plan"></button>
  <button class="mt-tab" data-nav-view="more"></button>
</nav>
<button id="btn-theme-toggle"></button>
<button id="btn-more-export-pdf"></button>
<button id="btn-more-export-whatsapp"></button>
<button id="btn-more-print"></button>
<button id="btn-more-locks"></button>
<button id="btn-more-options"></button>
<button id="btn-export-pdf"></button>
<button id="btn-export-whatsapp"></button>
<div class="stock-stepper">
  <button class="stock-step" data-stock-target="stock-pera" data-stock-delta="-10"></button>
  <button class="stock-step" data-stock-target="stock-pera" data-stock-delta="10" data-stock-max="76"></button>
  <button class="stock-step" data-stock-target="stock-cocktail-consabor" data-stock-delta="10" data-stock-max="80"></button>
</div>
`;

const STOCK_18SEP = {
  'PERA_RAMA': 320,
  'COCKTAIL_ROMANTICO::CONSABOR': 0,
  'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
  'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
  'CHERRY_RAMA::SUNSTREAM': 100
};

if (typeof global.window === 'undefined') {
  global.window = { location: { search: '' }, addEventListener() {}, scrollTo() {} };
}

/** Monta un DOM limpio: cada caso parte de cero y no acumula listeners. */
function mountDom() {
  global.document = createDocument(MOBILE_DOM);
  return global.document;
}

/** Arranca un controlador replicando el arranque real de index.html. */
function freshController() {
  const documentRef = mountDom();
  const state = new ui.AppState();
  const controller = new ui.UIController(state);
  controller.bindDOM();
  return { document: documentRef, state, controller };
}

/** Controlador con el plan 18/09 ya generado. */
function freshWithPlan() {
  const ctx = freshController();
  ctx.document.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  ctx.controller.handleAnalyze();
  ctx.controller.fillStock({ ...STOCK_18SEP });
  global.window.requestAnimationFrame = undefined;
  ctx.result = ctx.controller.handleGeneratePlan();
  return ctx;
}

// --- Navegación -------------------------------------------------------------
check('navegación · setView conmuta main[data-view] y aria-current', () => {
  const { document: doc, controller } = freshController();
  const main = doc.querySelector('main');
  for (const view of ['forecast', 'stock', 'plan', 'more']) {
    assert.strictEqual(controller.setView(view), true, `setView(${view}) rechazado`);
    assert.strictEqual(main.getAttribute('data-view'), view);
    const current = doc.querySelectorAll('#mobile-tabbar .mt-tab')
      .filter(t => t.getAttribute('aria-current') === 'page');
    assert.strictEqual(current.length, 1, `aria-current incorrecto en ${view}`);
    assert.strictEqual(current[0].getAttribute('data-nav-view'), view);
  }
});

check('navegación · vistas válidas y rechazo de vistas inexistentes', () => {
  const { controller } = freshController();
  assert.deepStrictEqual(ui.UIController.MOBILE_VIEWS,
    ['forecast', 'stock', 'plan', 'more', 'locks', 'options']);
  assert.strictEqual(controller.setView('locks'), true);
  assert.strictEqual(controller.setView('options'), true);
  assert.strictEqual(controller.setView('inexistente'), false);
});

check('navegación · el clic en la tabbar cambia de vista', () => {
  const { document: doc } = freshController();
  const tabs = doc.querySelectorAll('#mobile-tabbar .mt-tab');
  tabs.find(t => t.getAttribute('data-nav-view') === 'stock').click();
  assert.strictEqual(doc.querySelector('main').getAttribute('data-view'), 'stock');
  tabs.find(t => t.getAttribute('data-nav-view') === 'plan').click();
  assert.strictEqual(doc.querySelector('main').getAttribute('data-view'), 'plan');
});

check('navegación · los accesos de "MÁS" abren bloqueos y opciones', () => {
  const { document: doc } = freshController();
  doc.getElementById('btn-more-locks').click();
  assert.strictEqual(doc.querySelector('main').getAttribute('data-view'), 'locks');
  doc.getElementById('btn-more-options').click();
  assert.strictEqual(doc.querySelector('main').getAttribute('data-view'), 'options');
});

check('navegación · salir de PLAN cierra el detalle abierto', () => {
  const ctx = freshWithPlan();
  assert.strictEqual(ctx.controller.openPlatformDetail('CENTRO'), true);
  assert.strictEqual(ctx.document.getElementById('platform-detail-modal').hidden, false);
  ctx.controller.setView('stock');
  assert.strictEqual(ctx.document.getElementById('platform-detail-modal').hidden, true);
});

// --- Previsión --------------------------------------------------------------
check('previsión · pegar el forecast y analizar produce el desglose esperado', () => {
  const { document: doc, state, controller } = freshController();
  doc.getElementById('tsv-input').value = ui.DATASETS['18_SEP'];
  controller.handleAnalyze();

  assert.strictEqual(state.forecastAnalysis.totalRequested, 522);
  assert.strictEqual(state.forecastAnalysis.validLinesCount, 17);
  assert.strictEqual(state.forecastAnalysis.detectedDate, '26/08/2026');
  assert.strictEqual(doc.getElementById('ana-total-requested').textContent, '522 cjs');
  assert.strictEqual(doc.getElementById('forecast-analysis-card').classList.contains('hidden'), false);
  assert.ok(state.forecastAnalysis.platformsFound.includes('CENTRO'));
});

check('previsión · no exige transformación previa del texto (parser intacto)', () => {
  const raw = ui.DATASETS['18_SEP'];
  assert.ok(raw.includes('\t'), 'el dataset de prueba es tabulado crudo');
  const parsed = parser.parseForecast(raw, catalog.DEFAULT_CATALOG);
  assert.strictEqual(parsed.lines.filter(l => l.isValid).length, 17);
});

check('previsión · el botón de ejemplo 18/09 carga previsión y stock', () => {
  const { document: doc, state } = freshController();
  doc.getElementById('btn-load-18sep').click();
  assert.strictEqual(state.forecastAnalysis.totalRequested, 522);
  assert.strictEqual(state.stock['PERA_RAMA'], 320);
  assert.strictEqual(String(doc.getElementById('stock-pera').value), '320');
});

// --- Stock ------------------------------------------------------------------
check('stock · los steppers actualizan input y AppState con clip 0..max', () => {
  const { document: doc, state } = freshController();
  const pera = doc.getElementById('stock-pera');
  assert.ok(pera, 'no se encontró el input stock-pera');
  pera.value = '0';

  const steps = doc.querySelectorAll('.stock-step');
  const findStep = (target, delta) => steps.find(b =>
    b.getAttribute('data-stock-target') === target &&
    String(b.getAttribute('data-stock-delta')) === String(delta));

  const plus = findStep('stock-pera', 10);
  const minus = findStep('stock-pera', -10);
  assert.ok(plus && minus, 'faltan los steppers de stock-pera');

  plus.click();
  assert.strictEqual(pera.value, '10', `tras +: ${pera.value}`);
  assert.strictEqual(state.stock['PERA_RAMA'], 10, `estado tras +: ${state.stock['PERA_RAMA']}`);

  minus.click();
  assert.strictEqual(pera.value, '0');
  assert.strictEqual(state.stock['PERA_RAMA'], 0);

  minus.click();
  assert.strictEqual(pera.value, '0', 'no puede quedar negativo');

  const consaborStep = findStep('stock-cocktail-consabor', 10);
  const consabor = doc.getElementById('stock-cocktail-consabor');
  assert.ok(consaborStep && consabor, 'faltan los steppers de Consabor');
  consabor.value = '75';
  consaborStep.click();
  assert.strictEqual(consabor.value, '80', `clip superior falló: ${consabor.value} (max 80)`);
  assert.strictEqual(state.stock['COCKTAIL_ROMANTICO::CONSABOR'], 80);
});

check('stock · los 5 inputs sincronizan el AppState existente', () => {
  const { document: doc, state } = freshController();
  const map = {
    'stock-pera': 'PERA_RAMA',
    'stock-cocktail-consabor': 'COCKTAIL_ROMANTICO::CONSABOR',
    'stock-cocktail-sp': 'COCKTAIL_ROMANTICO::SAO_PAULO',
    'stock-cocktail-sun': 'COCKTAIL_ROMANTICO::SUNSTREAM',
    'stock-cherry-sun': 'CHERRY_RAMA::SUNSTREAM'
  };
  for (const [id, key] of Object.entries(map)) {
    const el = doc.getElementById(id);
    el.value = '33';
    el.dispatchEvent({ type: 'input', target: el });
    assert.strictEqual(state.stock[key], 33, `${id} no sincroniza ${key}`);
  }
});

// --- Locks ------------------------------------------------------------------
check('locks · CONSABOR FULL se crea sin cambiar las reglas', () => {
  const { document: doc, controller } = freshController();
  controller.selectLockPlatform('CENTRO');
  controller.createFullLock('COCKTAIL_ROMANTICO', 'CONSABOR', 'COCKTAIL CONSABOR');

  const lock = controller.state.locks.find(l => l.varietyId === 'CONSABOR');
  assert.ok(lock, 'no se creó el bloqueo CONSABOR FULL');
  assert.strictEqual(lock.type, 'FULL');
  assert.strictEqual(lock.platform, 'CENTRO');
  assert.strictEqual(controller.state.hasLockConflict('CENTRO', 'COCKTAIL_ROMANTICO'), false);
  assert.ok(doc.getElementById('active-locks-list').innerHTML.includes('CONSABOR'));
});

check('locks · los 5 botones FULL existen y crean su bloqueo', () => {
  const ctx = freshController();
  ctx.controller.selectLockPlatform('CENTRO');

  // Productos distintos -> bloqueos FULL independientes
  const distinctProducts = [
    ['btn-lock-pera', 'PERA_RAMA'],
    ['btn-lock-cocktail-consabor', 'COCKTAIL_ROMANTICO'],
    ['btn-lock-cherry', 'CHERRY_RAMA']
  ];
  for (const [btnId, productId] of distinctProducts) {
    const btn = ctx.document.getElementById(btnId);
    assert.ok(btn, `falta el botón ${btnId}`);
    btn.click();
    const found = ctx.controller.state.locks.some(l =>
      l.productId === productId && l.type === 'FULL' && l.platform === 'CENTRO');
    assert.ok(found, `${btnId} no creó el bloqueo FULL de ${productId}`);
  }

  // Los botones de variedad (SP / SUN) fijan la variedad del bloqueo.
  // Comportamiento EXISTENTE del motor: AppState.addLock deduplica FULL por
  // (plataforma, producto) sin distinguir variedad, por lo que al pulsar SP
  // queda registrada la variedad SAO_PAULO y una pulsación posterior de SUN
  // se considera duplicado. El shell móvil no altera esa regla.
  const spBtn = ctx.document.getElementById('btn-lock-cocktail-sp');
  const sunBtn = ctx.document.getElementById('btn-lock-cocktail-sun');
  assert.ok(spBtn && sunBtn, 'faltan los botones de variedad de Cocktail');

  const fresh2 = freshController();
  fresh2.controller.selectLockPlatform('CENTRO');
  fresh2.document.getElementById('btn-lock-cocktail-sp').click();
  const spLock = fresh2.controller.state.locks.find(l => l.productId === 'COCKTAIL_ROMANTICO');
  assert.ok(spLock, 'el botón SP no creó bloqueo');
  assert.strictEqual(spLock.varietyId, 'SAO_PAULO', 'el botón SP debe fijar SAO_PAULO');
  assert.strictEqual(spLock.type, 'FULL');

  const fresh3 = freshController();
  fresh3.controller.selectLockPlatform('CENTRO');
  fresh3.document.getElementById('btn-lock-cocktail-sun').click();
  const sunLock = fresh3.controller.state.locks.find(l => l.productId === 'COCKTAIL_ROMANTICO');
  assert.ok(sunLock, 'el botón SUN no creó bloqueo');
  assert.strictEqual(sunLock.varietyId, 'SUNSTREAM', 'el botón SUN debe fijar SUNSTREAM');
  assert.strictEqual(sunLock.type, 'FULL');
});

check('locks · bloqueo parcial fijo respeta la cantidad introducida', () => {
  const { controller } = freshController();
  controller.selectLockPlatform('SUR');
  assert.strictEqual(controller.addFixedLock('PERA_RAMA', 40), true);
  const lock = controller.state.locks[0];
  assert.strictEqual(lock.type, 'FIXED');
  assert.strictEqual(lock.quantity, 40);
  assert.strictEqual(controller.addFixedLock('PERA_RAMA', 0), false, 'cantidad 0 debe rechazarse');
});

check('locks · conflicto FULL + FIXED detectado igual que en escritorio', () => {
  const st = new ui.AppState();
  st.addLock({ platform: 'CENTRO', productId: 'PERA_RAMA', type: 'FULL' });
  st.addLock({ platform: 'CENTRO', productId: 'PERA_RAMA', type: 'FIXED', quantity: 10 });
  assert.strictEqual(st.hasLockConflict('CENTRO', 'PERA_RAMA'), true);
});

// --- Planificación ----------------------------------------------------------
check('planificación · generar plan desde móvil produce el resultado congelado', () => {
  const ctx = freshWithPlan();
  const result = ctx.result;
  assert.ok(result, 'no se generó ningún PlanningResult');
  assert.strictEqual(result.totalBoxes, 522);
  assert.strictEqual(result.totalPallets, 17);
  assert.strictEqual(result.totalPalletSlots, 9);
  assert.strictEqual(result.demandSummary.totalRequested, 522);
  assert.strictEqual(ctx.controller.state.planStatus, 'PLANIFICACIÓN CON INCIDENCIAS');
});

check('planificación · el resumen móvil y la tabbar reflejan el plan', () => {
  const ctx = freshWithPlan();
  const read = id => ctx.document.getElementById(id).textContent;
  assert.strictEqual(String(read('mkpi-boxes')), '522');
  assert.strictEqual(String(read('mkpi-assigned')), '522');
  assert.strictEqual(String(read('mkpi-platforms')), '6');
  assert.strictEqual(String(read('mkpi-pallets')), '17');
  assert.strictEqual(String(read('mkpi-towers')), '9');
  // FASE 18.5.1: con un plan están hechas PREVISIÓN, STOCK y PLAN. SALIDA no se
  // marca como completada (no hay evidencia de exportación): queda como la
  // siguiente acción disponible.
  const footEl = ctx.document.getElementById('mkpi-foot');
  const foot = String(footEl.innerHTML || footEl.textContent || '');
  assert.ok(foot.includes('Salida'), `el pie no muestra el flujo operativo: ${foot}`);
  assert.strictEqual((foot.match(/is-done/g) || []).length, 3,
    `deberían estar hechas 3 etapas (no SALIDA): ${foot}`);
  assert.ok(/→<\/i>Salida/.test(foot), `SALIDA no figura como siguiente acción: ${foot}`);
  assert.ok(!/✓<\/i>Salida/.test(foot), `SALIDA no puede mostrarse completada: ${foot}`);
  assert.ok(/plan completo · exporta en MÁS|faltan \d+ cjs por servir · exporta en MÁS/.test(foot),
    `el pie no refleja el estado real del plan: ${foot}`);
  assert.strictEqual(String(read('mm-status')), 'PLANIFICACIÓN CON INCIDENCIAS');
  assert.strictEqual(String(read('mm-delivery-date')), '26/08/2026');
});

check('planificación · la tabbar muestra el badge de cajas pendientes', () => {
  const ctx = freshWithPlan();
  const badge = ctx.document.getElementById('mt-badge-plan');
  const missing = ctx.result.allocations.reduce((s, a) => s + a.missingQuantity, 0);
  if (missing > 0) {
    assert.strictEqual(badge.hidden, false, 'debe mostrarse el badge de pendientes');
    assert.strictEqual(badge.textContent, String(missing));
  } else {
    assert.strictEqual(badge.hidden, true);
  }
});

// --- Detalle de plataforma --------------------------------------------------
check('detalle · VER DETALLE abre la plataforma pulsada', () => {
  const ctx = freshWithPlan();
  const doc = ctx.document;
  const buttons = doc.querySelectorAll('.btn-platform-detail');
  assert.strictEqual(buttons.length, 6, 'deben existir 6 botones de detalle');

  const centro = buttons.find(b => b.getAttribute('data-platform') === 'CENTRO');
  assert.ok(centro, 'no existe el botón de detalle de CENTRO');
  centro.click();

  assert.strictEqual(doc.getElementById('platform-detail-modal').hidden, false, 'el modal no se abrió');
  assert.strictEqual(doc.getElementById('pdm-platform-name').textContent, 'CENTRO');

  const html = doc.getElementById('pdm-body').innerHTML;
  assert.ok(html.includes('115'), 'faltan las 115 cajas de CENTRO');
  assert.ok(html.includes('Pera Rama'));
  assert.ok(html.includes('Cocktail Romántico'));
  assert.ok(html.includes('Cherry Rama'));
  assert.ok(html.includes('Torre 1') && html.includes('Torre 2'), 'faltan las torres de CENTRO');
  assert.ok(html.includes('1909') && html.includes('999'), 'faltan las alturas de torre');
  assert.ok(html.includes('2278'), 'falta el gálibo máximo');
});

check('detalle · el botón de cierre y Escape cierran el detalle', () => {
  const ctx = freshWithPlan();
  assert.strictEqual(ctx.controller.openPlatformDetail('CENTRO'), true);
  assert.strictEqual(ctx.document.getElementById('platform-detail-modal').hidden, false);
  ctx.document.getElementById('pdm-close').click();
  assert.strictEqual(ctx.document.getElementById('platform-detail-modal').hidden, true);

  assert.strictEqual(ctx.controller.openPlatformDetail('SUR'), true);
  assert.strictEqual(ctx.document.getElementById('platform-detail-modal').hidden, false);
  ctx.document.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.strictEqual(ctx.document.getElementById('platform-detail-modal').hidden, true);
});

check('detalle · jerarquía plataforma > producto > variedad > cajas > palet > torre', () => {
  const ctx = freshWithPlan();
  const model = ctx.controller.getMobileModel();
  const centro = model.slots.find(s => s.platform === 'CENTRO');
  assert.ok(centro, 'sin plataforma CENTRO');
  const html = ctx.controller.buildPlatformDetailHTML(centro);

  const iHero = html.indexOf('pdm-hero');
  const iProdTitle = html.indexOf('pdm-group-title');
  const iProd = html.indexOf('pdm-prod-name');
  const iVar = html.indexOf('pdm-prod-var');
  const iBoxes = html.indexOf('pdm-prod-boxes');
  const iPallets = html.indexOf('pdm-pallets');
  const iTower = html.indexOf('pdm-tower');

  assert.ok(iHero >= 0 && iHero < iProdTitle, 'las cifras globales deben ir primero');
  assert.ok(iProdTitle < iProd, 'el título de productos debe preceder a los productos');
  assert.ok(iProd < iVar, 'el producto debe preceder a la variedad');
  assert.ok(iVar < iBoxes, 'la variedad debe preceder a las cajas');
  assert.ok(iBoxes < iPallets, 'las cajas deben preceder a los palets');
  assert.ok(iPallets < iTower, 'los palets deben preceder a las torres');
});

check('detalle · todas las plataformas abren y muestran su nombre', () => {
  const ctx = freshWithPlan();
  const model = ctx.controller.getMobileModel();
  for (const slot of model.slots) {
    assert.strictEqual(ctx.controller.openPlatformDetail(slot.platform), true, slot.platform);
    assert.strictEqual(ctx.document.getElementById('pdm-platform-name').textContent, slot.platform);
    ctx.controller.closePlatformDetail();
  }
  assert.strictEqual(ctx.controller.openPlatformDetail('NO_EXISTE'), false);
});

// --- Replanificación --------------------------------------------------------
check('replanificación · stock -> plan stale -> recalcular conserva la demanda', () => {
  const ctx = freshWithPlan();
  const { document: doc, state, controller } = ctx;
  assert.strictEqual(state.planState, 'PLAN_ACTUALIZADO');

  const pera = doc.getElementById('stock-pera');
  pera.value = '100';
  pera.dispatchEvent({ type: 'input', target: pera });
  assert.strictEqual(state.planState, 'PLAN_DESACTUALIZADO');
  assert.strictEqual(doc.getElementById('plan-desactualizado-banner').classList.contains('hidden'), false);
  assert.ok(doc.getElementById('badge-plan-sync').textContent.includes('DESACTUALIZADO'));

  const second = controller.handleGeneratePlan();
  assert.strictEqual(state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(second.demandSummary.totalRequested, 522, 'debe conservarse la demanda original');
  assert.ok(second.allocations.reduce((s, a) => s + a.missingQuantity, 0) > 0, 'debe haber faltantes');
  assert.strictEqual(state.previousResult, ctx.result, 'el plan anterior debe preservarse');
});

check('replanificación · el recálculo del banner funciona igual que el botón principal', () => {
  const ctx = freshWithPlan();
  const pera = ctx.document.getElementById('stock-pera');
  pera.value = '50';
  pera.dispatchEvent({ type: 'input', target: pera });
  assert.strictEqual(ctx.state.planState, 'PLAN_DESACTUALIZADO');
  ctx.document.getElementById('btn-recalculate-banner').click();
  assert.strictEqual(ctx.state.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(ctx.state.planningResult.demandSummary.totalRequested, 522);
});

// --- PDF / WhatsApp ---------------------------------------------------------
check('PDF · el botón móvil delega en el generador existente', () => {
  const ctx = freshWithPlan();
  let called = 0;
  global.window.html2pdf = () => ({
    set: () => ({ from: () => ({ save: () => { called++; return Promise.resolve(); } }) })
  });
  global.window.print = () => { called += 100; };
  global.window.scrollTo = () => {};

  ctx.document.getElementById('btn-more-export-pdf').click();
  assert.strictEqual(called, 1, `no delegó en html2pdf (llamadas=${called})`);
});

check('PDF · los totales por artículo son las cajas SERVIDAS y suman 522', () => {
  const ctx = freshWithPlan();
  // Misma ruta que ejecuta handleGeneratePDF antes de capturar la hoja
  ctx.controller.renderPrintHeaderSummary(ctx.result);

  const list = ctx.document.getElementById('print-articles-totals-list').innerHTML;
  // Los totales deben ser EXACTAMENTE los del cómputo canónico por artículo
  // (cajas SERVIDAS), tal como los publica el PDF.
  const summary = ui.computeServedTotalsByArticle(ctx.result);
  for (const item of summary.totalsList) {
    assert.ok(list.includes(item.formattedText),
      `falta "${item.formattedText}" en la cabecera de impresión: ${list}`);
  }
  assert.ok(summary.totalsList.some(t => t.article === 'PERA'), 'falta TOTAL PERA');
  assert.ok(summary.totalsList.some(t => t.article === 'COCKTAIL'), 'falta TOTAL COCKTAIL');
  assert.ok(summary.totalsList.some(t => t.article === 'SUNSTREAM'), 'falta TOTAL SUNSTREAM');

  // Suma de cajas servidas == total de cajas asignadas del plan
  const allocatedTotal = ctx.result.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
  assert.strictEqual(summary.grandTotal, allocatedTotal,
    'el total por artículo debe sumar las cajas servidas');
  assert.strictEqual(
    String(ctx.document.getElementById('print-grand-total-boxes').textContent),
    String(summary.grandTotal),
    'el total global impreso no coincide con la suma de artículos'
  );
  assert.ok(!/TOTAL CONSABOR/i.test(list), 'CONSABOR no debe aparecer como artículo independiente');
  assert.ok(!/TOTAL SAO_PAULO/i.test(list), 'SAO_PAULO no debe aparecer como artículo independiente');
});

check('WhatsApp · el botón móvil copia el mismo mensaje formateado', () => {
  const ctx = freshWithPlan();
  let copied = null;
  Object.defineProperty(global, 'navigator', {
    value: { clipboard: { writeText: t => { copied = t; return Promise.resolve(); } } },
    configurable: true,
    writable: true
  });

  ctx.document.getElementById('btn-more-export-whatsapp').click();
  const expected = ui.formatWhatsAppMessage(ctx.result);
  assert.strictEqual(copied, expected, 'el texto copiado no coincide con formatWhatsAppMessage');
  assert.ok(copied.includes('522'));
  assert.ok(copied.includes('CENTRO'));
});

check('WhatsApp · el texto no introduce un artículo CONSABOR', () => {
  const ctx = freshWithPlan();
  const wa = ui.formatWhatsAppMessage(ctx.result);
  assert.ok(!/TOTAL CONSABOR/i.test(wa), 'WhatsApp no debe crear TOTAL CONSABOR');
  const summary = ui.computeServedTotalsByArticle(ctx.result);
  assert.ok(!summary.totalsList.some(t => t.article === 'CONSABOR'));
});

// --- Dark / Light -----------------------------------------------------------
check('tema · toggleTheme alterna dark/light, persiste y actualiza el botón', () => {
  const store = {};
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    configurable: true,
    writable: true
  });

  const { document: doc, controller } = freshController();
  const html = doc.documentElement;

  controller.initTheme();
  assert.strictEqual(html.getAttribute('data-theme'), 'dark', 'dark debe ser por defecto');
  assert.strictEqual(doc.getElementById('btn-theme-toggle').textContent, '☀️');

  controller.toggleTheme();
  assert.strictEqual(html.getAttribute('data-theme'), 'light');
  assert.strictEqual(store['planificador-theme'], 'light');
  assert.strictEqual(doc.getElementById('btn-theme-toggle').textContent, '🌙');

  controller.toggleTheme();
  assert.strictEqual(html.getAttribute('data-theme'), 'dark');
  assert.strictEqual(store['planificador-theme'], 'dark');
});

check('tema · un valor inválido en localStorage cae a dark', () => {
  const store = { 'planificador-theme': 'neon' };
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    configurable: true,
    writable: true
  });
  const { document: doc, controller } = freshController();
  controller.initTheme();
  assert.strictEqual(doc.documentElement.getAttribute('data-theme'), 'dark');
});

check('tema · cambiar de tema no altera el plan ni el stock', () => {
  const ctx = freshWithPlan();
  const before = JSON.stringify(ctx.result.allocations);
  ctx.controller.toggleTheme();
  ctx.controller.toggleTheme();
  assert.strictEqual(JSON.stringify(ctx.state.planningResult.allocations), before,
    'el tema no debe tocar el resultado de planificación');
});

// --- Regresión de escritorio -------------------------------------------------
check('regresión · los módulos de dominio no contienen código del shell móvil', () => {
  for (const f of ['catalog.js', 'parser.js', 'hamilton.js', 'cocktail-solver.js',
    'palletizer.js', 'orchestrator.js']) {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8');
    assert.ok(!/mobile|MOBILE/.test(src), `${f} contiene referencias al shell móvil`);
  }
});

check('regresión · las APIs públicas del motor siguen intactas', () => {
  assert.strictEqual(typeof orchestrator.planLoad, 'function');
  assert.strictEqual(typeof ui.AppState, 'function');
  assert.strictEqual(typeof ui.UIController, 'function');
  assert.strictEqual(typeof ui.buildTruckSlotsModel, 'function');
  assert.strictEqual(typeof ui.formatWhatsAppMessage, 'function');
  assert.strictEqual(typeof ui.computeServedTotalsByArticle, 'function');
  assert.strictEqual(typeof ui.comparePlanningResults, 'function');
});

check('regresión · index.html conserva los anclajes del shell de escritorio', () => {
  for (const id of ['kpi-allocated', 'kpi-truck-slots', 'kpi-pallet-slots', 'kpi-pallets',
    'kpi-requested', 'kpi-missing', 'kpi-service-rate', 'kpi-stock-details',
    'table-platform-allocations-body', 'palletization-groups-container',
    'print-articles-totals-list', 'print-grand-total-boxes', 'btn-theme-toggle',
    'plan-comparison-section', 'active-pallet-overrides-list', 'active-exclusions-list']) {
    assert.ok(HTML.includes(`id="${id}"`), `se ha perdido el anclaje de escritorio ${id}`);
  }
  assert.ok(HTML.includes('grid-cols-1 md:grid-cols-2 lg:grid-cols-3'),
    'el grid de escritorio de plataformas ha cambiado');
});

check('regresión · el header y el footer de escritorio siguen presentes', () => {
  assert.ok(HTML.includes('PLANIFICADOR DE CARGA'), 'falta el título de escritorio');
  assert.ok(/<header class="[^"]*desktop-only/.test(HTML), 'el header de escritorio debe marcarse desktop-only');
  assert.ok(/<footer class="desktop-only/.test(HTML), 'el footer de escritorio debe marcarse desktop-only');
});

// ===========================================================================
// Informe
// ===========================================================================
Promise.all(pending).then(() => {
  let failed = 0;
  console.log('\n=== FASE 18 · MOBILE SHELL TESTS ===\n');
  for (const r of results) {
    if (r.ok) {
      console.log(`  PASS  ${r.name}`);
    } else {
      failed++;
      console.log(`  FAIL  ${r.name}`);
      console.log(`        ${r.error}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} pruebas superadas`);
  process.exit(failed === 0 ? 0 : 1);
});

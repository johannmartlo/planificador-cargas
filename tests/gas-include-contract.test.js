/**
 * PHASE 20.1 — Contrato de integración GAS: include() y ensamblado HTML.
 *
 * Motivo: la verificación de Fase 19 emulaba include() como una lectura cruda del
 * archivo, mientras Code.gs usaba realmente
 * `createHtmlOutputFromFile(...).getContent()`, que pasa el texto por el parser
 * HTML de HtmlService. Esa divergencia ocultó el fallo real:
 *
 *   Exception: Malformed HTML content: [SRC_parser_js.html] (Code.gs:60)
 *
 * Este test fija el contrato correcto y evitaría la regresión:
 *   1. include() debe devolver el contenido CRUDO (sin parser HTML).
 *   2. Cada scriptlet de index.html debe ir dentro de EXACTAMENTE un envoltorio
 *      <script>/<style> (los módulos no llevan envoltorio propio).
 *   3. Ningún módulo puede contener </script> ni </style> (cerraría el envoltorio).
 *   4. El ensamblado debe insertar cada módulo byte a byte.
 *   5. Todos los módulos JS deben compilar (sintaxis válida).
 *
 * Uso: node tests/gas-include-contract.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GAS = path.join(ROOT, 'gas');

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: (e && e.message) || String(e) }); }
}

const CODE_GS = fs.readFileSync(path.join(GAS, 'Code.gs'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(GAS, 'index.html'), 'utf8');
const SRC_FILES = fs.readdirSync(GAS).filter(f => /^SRC_.*\.html$/.test(f)).sort();

// ---------------------------------------------------------------------------
// 1. Contrato de include(): contenido crudo, nunca parser HTML
// ---------------------------------------------------------------------------
check('Code.gs · include() usa getRawContent() (contenido crudo, sin parser HTML)', () => {
  if (!/function\s+include\s*\([^)]*\)\s*\{[\s\S]*?getRawContent\s*\(\s*\)/.test(CODE_GS)) {
    throw new Error('include() no usa getRawContent()');
  }
});

check('Code.gs · include() NO usa createHtmlOutputFromFile (origen del "Malformed HTML content")', () => {
  const body = CODE_GS.slice(CODE_GS.indexOf('function include'));
  if (/createHtmlOutputFromFile/.test(body)) {
    throw new Error('include() sigue pasando los módulos por el parser HTML de HtmlService');
  }
});

check('Code.gs · doGet() sigue sirviendo index como plantilla evaluada', () => {
  if (!/createTemplateFromFile\(\s*INDEX_TEMPLATE\s*\)/.test(CODE_GS)) throw new Error('no usa createTemplateFromFile(INDEX_TEMPLATE)');
  if (!/\.evaluate\s*\(\s*\)/.test(CODE_GS)) throw new Error('no llama a evaluate()');
});

check('Code.gs · doGet() declara el viewport con addMetaTag (HtmlService ignora los <meta> del HTML)', () => {
  // FASE 18.3. La documentación de HtmlOutput dice literalmente: "Meta tags
  // included directly in an Apps Script HTML file are ignored". El <meta
  // name="viewport"> de index.html NO llega al navegador.
  // Sin addMetaTag('viewport', ...) el móvil maqueta a ~980px y encoge la app
  // ~0,4x: se ve diminuta Y las media queries de móvil (<480px) no se disparan.
  if (!/addMetaTag\s*\(\s*'viewport'\s*,/.test(CODE_GS)) {
    throw new Error("falta output.addMetaTag('viewport', ...) en doGet()");
  }
  if (!/width=device-width/.test(CODE_GS)) throw new Error('el viewport no fija width=device-width');
  if (!/initial-scale=1/.test(CODE_GS)) throw new Error('el viewport no fija initial-scale=1');
  if (!/viewport-fit=cover/.test(CODE_GS)) throw new Error('el viewport no fija viewport-fit=cover (safe-areas de iPhone)');
});

// ---------------------------------------------------------------------------
// 2. Los módulos son crudos: sin envoltorio propio
// ---------------------------------------------------------------------------
check('SRC_*.html · ningún módulo trae su propio <script>/<style>', () => {
  const bad = SRC_FILES.filter(f => /<\s*(script|style)\b/i.test(fs.readFileSync(path.join(GAS, f), 'utf8')));
  if (bad.length) throw new Error(`envoltorio propio duplicaría etiquetas: ${bad.join(', ')}`);
});

check('SRC_*.html · ningún módulo contiene </script> ni </style>', () => {
  const bad = SRC_FILES.filter(f => /<\/\s*(script|style)\s*>/i.test(fs.readFileSync(path.join(GAS, f), 'utf8')));
  if (bad.length) throw new Error(`cerraría el envoltorio de index.html: ${bad.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 3. Cada scriptlet va dentro de exactamente un envoltorio
// ---------------------------------------------------------------------------
const scriptletAny = /<\?!=?\s*include\('([^']+)'\)\s*;?\s*\?>/g;
const wrapped = /<(script|style)><\?!= include\('([^']+)'\); \?><\/\1>/g;

check('index.html · 8 scriptlets include() (1 CSS + 7 JS)', () => {
  const n = (INDEX_HTML.match(scriptletAny) || []).length;
  if (n !== 8) throw new Error(`esperados 8, encontrados ${n}`);
});

check('index.html · los 8 scriptlets van dentro de exactamente un envoltorio <script>/<style>', () => {
  const n = (INDEX_HTML.match(wrapped) || []).length;
  if (n !== 8) throw new Error(`scriptlets correctamente envueltos: ${n}/8`);
});

check('index.html · no queda ningún scriptlet sin resolver en el ensamblado', () => {
  const assembled = INDEX_HTML.replace(scriptletAny, '');
  if (/<\?/.test(assembled)) throw new Error('quedan secuencias <? sin resolver');
});

// ---------------------------------------------------------------------------
// 4. Ensamblado byte a byte (espejo de getRawContent())
// ---------------------------------------------------------------------------
function assemble() {
  return INDEX_HTML.replace(scriptletAny, (_, file) => {
    const p = path.join(GAS, file);
    if (!fs.existsSync(p)) throw new Error(`include(): no existe ${file}`);
    return fs.readFileSync(p, 'utf8'); // getRawContent(): crudo, sin parser
  });
}

const ASSEMBLED = assemble();

check('ensamblado · cada módulo aparece verbatim (byte a byte) en el documento final', () => {
  const missing = SRC_FILES.filter(f => !ASSEMBLED.includes(fs.readFileSync(path.join(GAS, f), 'utf8')));
  if (missing.length) throw new Error(`no insertados verbatim: ${missing.join(', ')}`);
});

check('ensamblado · el CSS móvil completo llega al documento', () => {
  const css = fs.readFileSync(path.join(GAS, 'SRC_mobile_css.html'), 'utf8');
  if (!ASSEMBLED.includes(css)) throw new Error('CSS móvil no insertado');
});

check('ensamblado · ningún módulo JS se perdió (7 bloques presentes)', () => {
  const js = SRC_FILES.filter(f => /_js\.html$/.test(f));
  if (js.length !== 7) throw new Error(`esperados 7 módulos JS, hay ${js.length}`);
  const missing = js.filter(f => !ASSEMBLED.includes(fs.readFileSync(path.join(GAS, f), 'utf8')));
  if (missing.length) throw new Error(`módulos ausentes: ${missing.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 5. Sintaxis de todos los módulos JS + cordura del CSS
// ---------------------------------------------------------------------------
check('sintaxis · los 7 módulos JS compilan', () => {
  const js = SRC_FILES.filter(f => /_js\.html$/.test(f));
  for (const f of js) {
    const src = fs.readFileSync(path.join(GAS, f), 'utf8');
    try { new vm.Script(src, { filename: f }); }
    catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
});

check('sintaxis · el CSS móvil tiene llaves balanceadas', () => {
  const css = fs.readFileSync(path.join(GAS, 'SRC_mobile_css.html'), 'utf8');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open !== close) throw new Error(`{ ${open} vs } ${close}`);
});

// ---------------------------------------------------------------------------
// 6. Prueba de que el requisito es real (anti-regresión de la causa raíz)
// ---------------------------------------------------------------------------
check('causa raíz · hay módulos con "<"+letra que rompen el parser HTML', () => {
  const withAngle = SRC_FILES.filter(f => /<[A-Za-z]/.test(fs.readFileSync(path.join(GAS, f), 'utf8')));
  if (withAngle.length === 0) {
    throw new Error('ya no hay "<"+letra: revisar si este test sigue siendo necesario');
  }
});

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
console.log('\n=== FASE 20.1 · CONTRATO DE INTEGRACIÓN GAS ===\n');
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`        -> ${r.error}`);
}
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
if (failed > 0) process.exitCode = 1;

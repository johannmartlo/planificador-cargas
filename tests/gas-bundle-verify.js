/**
 * PHASE 19 — Verificación del bundle GAS generado.
 *
 * Reproduce, en Node, lo que hará Apps Script HTML Service al servir la app:
 *   1. Lee `gas/index.html` (la plantilla).
 *   2. Resuelve cada scriptlet `<?!= include('SRC_x.html') ?>` exactamente igual
 *      que `Code.gs::include()` -> `createTemplateFromFile(...).getRawContent()`.
 *   3. Ejecuta los bloques <script> resultantes en un contexto de NAVEGADOR
 *      (sin `module`), de modo que los UMD toman su rama `root.LogisticsX`.
 *   4. Comprueba que la app queda operativa y que el caso funcional CONSABOR
 *      produce 80 cajas.
 *
 * Es la verificación de CÓDIGO más cercana posible al runtime de GAS sin
 * desplegar. No sustituye a una prueba en el navegador tras el deployment.
 *
 * Uso: node tests/gas-bundle-verify.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const ROOT = path.join(__dirname, '..');
const GAS = path.join(ROOT, 'gas');

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: (e && e.message) || String(e) }); }
}

// ---------------------------------------------------------------------------
// 1. Emular Code.gs
// ---------------------------------------------------------------------------
const CODE_GS = fs.readFileSync(path.join(GAS, 'Code.gs'), 'utf8');

/** Réplica de Code.gs::include() -> createTemplateFromFile(f).getRawContent() */
function include(filename) {
  const p = path.join(GAS, filename);
  if (!fs.existsSync(p)) throw new Error(`include(): no existe ${filename}`);
  return fs.readFileSync(p, 'utf8');
}

/** Réplica de doGet(): crea la plantilla y evalúa los scriptlets. */
function doGet() {
  let html = fs.readFileSync(path.join(GAS, 'index.html'), 'utf8');
  const scriptlet = /<\?!= include\('([^']+)'\); \?>/g;
  let count = 0;
  html = html.replace(scriptlet, (_, file) => { count++; return include(file); });
  return { html, scriptlets: count };
}

const rendered = doGet();

// ---------------------------------------------------------------------------
// 2. Comprobaciones estáticas de la estructura GAS
// ---------------------------------------------------------------------------
check('Code.gs · define doGet()', () => {
  assert.ok(/function\s+doGet\s*\(/.test(CODE_GS), 'falta doGet()');
});

check('Code.gs · define include() con contenido CRUDO (getRawContent)', () => {
  assert.ok(/function\s+include\s*\(/.test(CODE_GS), 'falta include()');
  // FASE 20.1: include() NO debe pasar los módulos por el parser HTML de
  // HtmlService. createHtmlOutputFromFile(...).getContent() provocaba
  // "Malformed HTML content" con los genéricos de JSDoc (Array<Object>,
  // Object<string, number>) presentes en SRC_parser_js.html y otros módulos.
  assert.ok(/createTemplateFromFile\(filename\)\.getRawContent\(\)/.test(CODE_GS),
    'include() no usa createTemplateFromFile(...).getRawContent()');
  assert.ok(!/createHtmlOutputFromFile/.test(CODE_GS.slice(CODE_GS.indexOf('function include'))),
    'include() sigue pasando los módulos por el parser HTML de HtmlService');
});

check('Code.gs · usa createTemplateFromFile + evaluate', () => {
  assert.ok(/HtmlService\.createTemplateFromFile\(INDEX_TEMPLATE\)/.test(CODE_GS),
    'no crea la plantilla');
  assert.ok(/\.evaluate\(\)/.test(CODE_GS), 'no evalúa la plantilla');
});

check('Code.gs · NO contiene lógica de negocio', () => {
  // Se analiza sólo el CÓDIGO EJECUTABLE: los comentarios de documentación
  // mencionan legítimamente los módulos del motor para explicar qué NO hace
  // este archivo. Las cadenas se vacían y los comentarios se eliminan.
  const sinBloques = CODE_GS.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const soloCodigo = sinBloques
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  const prohibido = [
    'planLoad', 'parseForecast', 'aggregateDemands', 'Hamilton',
    'Cocktail', 'Palletizer', 'stacking', 'LOCK', 'CONSABOR',
    'SAO_PAULO', 'SUNSTREAM', 'SpreadsheetApp',
    'UrlFetchApp', 'PropertiesService', 'CacheService', 'google.script.run'
  ];
  const encontrados = prohibido.filter(p => soloCodigo.includes(p));
  assert.deepStrictEqual(encontrados, [],
    `Code.gs ejecuta términos de dominio/backend: ${encontrados.join(', ')}`);

  // Sólo pueden existir las funciones de hosting
  const funciones = Array.from(soloCodigo.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g))
    .map(m => m[1]);
  assert.deepStrictEqual(funciones.sort(), ['doGet', 'include'],
    `funciones inesperadas en Code.gs: ${funciones.join(', ')}`);
});

check('Code.gs · no introduce backend ni persistencia', () => {
  assert.ok(!/doPost\s*\(/.test(CODE_GS), 'no debe existir doPost (sin API)');
  assert.ok(!/function\s+(getStock|saveStock|savePlan|login|auth)/i.test(CODE_GS),
    'no debe haber funciones de backend');
});

check('appsscript.json · manifiesto válido y mínimo', () => {
  const raw = fs.readFileSync(path.join(GAS, 'appsscript.json'), 'utf8');
  const m = JSON.parse(raw);
  assert.strictEqual(m.runtimeVersion, 'V8', 'debe usar runtime V8');
  assert.ok(m.webapp, 'falta la sección webapp');
  assert.strictEqual(m.webapp.executeAs, 'USER_DEPLOYING');
  assert.ok(['ANYONE_ANONYMOUS', 'ANYONE', 'DOMAIN', 'MYSELF'].includes(m.webapp.access),
    `access inválido: ${m.webapp.access}`);
  assert.deepStrictEqual(Object.keys(m.dependencies || {}), [], 'sin dependencias');
});

check('.clasp.json · Script ID exacto y rootDir=gas', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8'));
  assert.strictEqual(cfg.scriptId, '1zZaq7ylbPMQCrpzKhitdZoc4_QQPAPGysK_89MVLkpVcJ_9Eoon-OIR4',
    'el Script ID no coincide con el exigido');
  assert.strictEqual(cfg.rootDir, 'gas');
});

check('index.html (GAS) · resuelve exactamente 8 scriptlets (1 CSS + 7 JS)', () => {
  assert.strictEqual(rendered.scriptlets, 8, `scriptlets encontrados: ${rendered.scriptlets}`);
});

check('index.html (GAS) · tras resolver no queda ningún scriptlet', () => {
  assert.ok(!/<\?/.test(rendered.html), 'quedan secuencias <? sin resolver');
});

// ---------------------------------------------------------------------------
// 3. Ejecutar el bundle como lo haría el navegador
// ---------------------------------------------------------------------------
/** Extrae los bloques <script> SIN atributo src, en orden de aparición. */
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}
function inlineStyles(html) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

const scripts = inlineScripts(rendered.html);
const styles = inlineStyles(rendered.html);

check('bundle · contiene el CSS móvil completo (43.532 bytes)', () => {
  const cssSource = fs.readFileSync(path.join(ROOT, 'src', 'mobile.css'), 'utf8');
  const joined = styles.join('\n');
  assert.ok(joined.includes(cssSource), 'el CSS móvil no está íntegro en el bundle');
  assert.ok(styles.length >= 2, 'se esperaban el <style> móvil y el de escritorio');
});

check('bundle · los 7 módulos + el script de tema se ejecutan y registran sus globals', () => {
  // Contexto de NAVEGADOR: sin module/exports -> rama root.LogisticsX de los UMD
  const store = {};
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    navigator: { userAgent: 'node' },
    // El navegador siempre expone localStorage; en la VM hay que aportarlo.
    // (En Apps Script el iframe es same-origin consigo mismo, así que también
    //  lo tendrá; ver Findings del informe.)
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    // El navegador aporta el DOM y el CDN de Tailwind; en la VM se aportan
    // el mini-DOM de los tests y el objeto global 	ailwind que crea el CDN.
    document: createDocument('<html data-theme="dark"></html>'),
    tailwind: {},
    addEventListener: function () {},
    removeEventListener: function () {},
    location: { search: '' }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  scripts.forEach((code, i) => {
    try {
      vm.runInContext(code, context, { filename: `gas-inline-${i}.js` });
    } catch (err) {
      throw new Error(`el bloque <script> #${i} falló al ejecutarse: ${err.message}`);
    }
  });

  const expected = [
    'LogisticsCatalog', 'LogisticsParser', 'LogisticsHamilton',
    'LogisticsCocktail', 'LogisticsPalletizer', 'LogisticsOrchestrator', 'LogisticsUI'
  ];
  for (const g of expected) {
    assert.ok(sandbox[g], `no se registró window.${g}`);
  }

  // La app real: UIController disponible y operativa
  const ui = sandbox.LogisticsUI;
  const orchestrator = sandbox.LogisticsOrchestrator;
  assert.strictEqual(typeof ui.UIController, 'function');
  assert.strictEqual(typeof orchestrator.planLoad, 'function');

  // Caso funcional §21 sobre el código TAL COMO se sirve desde GAS
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80',
    stock: {
      'PERA_RAMA': 0,
      'COCKTAIL_ROMANTICO::CONSABOR': 100,
      'COCKTAIL_ROMANTICO::SAO_PAULO': 0,
      'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
      'CHERRY_RAMA::SUNSTREAM': 0
    },
    locks: [], exclusions: [], palletConfiguration: {}
  });

  assert.strictEqual(result.totalBoxes, 80, `cajas: ${result.totalBoxes}`);
  assert.strictEqual(result.deliveryDate, '26/08/2026');
  const cock = result.allocations.filter(a => a.productId === 'COCKTAIL_ROMANTICO');
  assert.strictEqual(cock.length, 1);
  assert.strictEqual(cock[0].varietyId, 'CONSABOR');
  assert.strictEqual(result.allocations.reduce((s, a) => s + a.missingQuantity, 0), 0);

  const summary = ui.computeServedTotalsByArticle(result);
  // La lista llega del contexto VM: se comparan valores, no referencias.
  assert.deepStrictEqual(Array.from(summary.totalsList, t => String(t.formattedText)),
    ['TOTAL COCKTAIL: 80']);
  assert.strictEqual(summary.grandTotal, 80);
  assert.ok(/CONSABOR/.test(ui.formatWhatsAppMessage(result)), 'WhatsApp no rotula CONSABOR');
});

check('bundle · no queda ninguna referencia a src/ (Apps Script no sirve estáticos)', () => {
  assert.ok(!/(?:src|href)="src\//.test(rendered.html),
    'el bundle conserva rutas locales src/');
});

check('bundle · las dependencias externas son HTTPS', () => {
  const urls = Array.from(rendered.html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g))
    .map(m => m[1]);
  assert.ok(urls.length >= 4, `se esperaban >=4 recursos externos, hay ${urls.length}`);
  const insecure = urls.filter(u => u.startsWith('http://'));
  assert.deepStrictEqual(insecure, [], `recursos sin TLS: ${insecure.join(', ')}`);
});

check('bundle · mantiene Tailwind, Google Fonts y html2pdf', () => {
  for (const dep of ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'html2pdf.bundle.min.js']) {
    assert.ok(rendered.html.includes(dep), `falta la dependencia ${dep}`);
  }
});

check('bundle · conserva el anti-FOUC y el viewport móvil', () => {
  assert.ok(rendered.html.includes("localStorage.getItem('planificador-theme')"),
    'falta la lectura de tema anti-FOUC');
  assert.ok(rendered.html.includes('viewport-fit=cover'), 'falta viewport-fit=cover');
  assert.ok(rendered.html.includes('id="mobile-tabbar"'), 'falta la tabbar del Mobile Shell');
  assert.ok(rendered.html.includes('id="platform-detail-modal"'), 'falta el detalle de plataforma');
  assert.ok(rendered.html.includes('id="tsv-input"'), 'falta la previsión');
});

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
let failed = 0;
console.log('\n=== FASE 19 · VERIFICACIÓN DEL BUNDLE GAS ===\n');
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

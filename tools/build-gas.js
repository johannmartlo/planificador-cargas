#!/usr/bin/env node
/**
 * PHASE 19 — Generador de artefactos para Google Apps Script.
 *
 * NO duplica lógica: lee los archivos REALES del workspace y produce, dentro de
 * `gas/`, la estructura mínima que Apps Script HTML Service necesita.
 *
 * Estrategia de inclusión
 * -----------------------
 * HTML Service no sirve archivos .js/.css estáticos, sólo plantillas HTML. Para
 * no reescribir ni un carácter del código:
 *
 *   - `mobile.css`      -> `gas/SRC_mobile_css.html`   (CSS verbatim)
 *   - `src/*.js`        -> `gas/SRC_*.html`            (JS verbatim)
 *   - `gas/index.html`  -> shell con scriptlets `<?!= include('SRC_...') ?>`
 *                          que inyecta cada archivo EN TIEMPO DE RENDER.
 *
 * Ventaja: los archivos fuente siguen siendo la ÚNICA fuente de verdad. Editar
 * `src/ui.js` y volver a hacer `clasp push` propaga el cambio sin regenerar
 * ninguna copia del código.
 *
 * Verificación de integridad: por cada archivo generado se vuelca su hash
 * SHA-256 y se compara con el del origen, garantizando que el contenido
 * embebido es byte a byte idéntico al del workspace.
 *
 * Uso: node tools/build-gas.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const GAS = path.join(ROOT, 'gas');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/** Los 7 módulos UMD, en el MISMO orden estricto de dependencia que index.html. */
const MODULES = [
  'catalog.js',
  'parser.js',
  'hamilton.js',
  'cocktail-solver.js',
  'palletizer.js',
  'orchestrator.js',
  'ui.js'
];

/** Nombre del artefacto GAS para un archivo de src/. */
const gasNameFor = file => 'SRC_' + file.replace(/[-.]/g, '_') + '.html';

const manifest = [];
const notes = [];

function writeGas(fileName, content) {
  const target = path.join(GAS, fileName);
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

// ---------------------------------------------------------------------------
// 0. Precondiciones
// ---------------------------------------------------------------------------
if (!fs.existsSync(GAS)) fs.mkdirSync(GAS, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Cargar los orígenes
// ---------------------------------------------------------------------------
const cssPath = path.join(SRC, 'mobile.css');
const cssBuf = fs.readFileSync(cssPath);
const cssText = cssBuf.toString('utf8');

const moduleSources = MODULES.map(name => {
  const file = path.join(SRC, name);
  if (!fs.existsSync(file)) throw new Error(`Módulo ausente: src/${name}`);
  const buf = fs.readFileSync(file);
  return { name, buf, text: buf.toString('utf8') };
});

const indexPath = path.join(ROOT, 'index.html');
const indexBuf = fs.readFileSync(indexPath);
let indexText = indexBuf.toString('utf8');

// ---------------------------------------------------------------------------
// 2. Comprobación de compatibilidad con el motor de plantillas de GAS
//    HTML Service procesa `<?` / `<?=` como scriptlets: si el código los
//    contuviera, la plantilla fallaría en tiempo de render.
// ---------------------------------------------------------------------------
// La restricción REAL de Apps Script HTML Service es que el bloque <script>
// inline no puede contener la secuencia `<?`, porque se interpretaría como
// scriptlet de plantilla. `<!--` dentro de una cadena de JavaScript que genera
// un comentario HTML en el DOM (uso legítimo en ui.js) NO es un problema: no
// aparece en el flujo del parser mientras el script no se cierre.
const assertNoScriptlet = (label, text) => {
  const hits = text.match(/<\?/g);
  if (hits) {
    throw new Error(
      `${label} contiene la secuencia reservada "<?:" (${hits.length} veces). ` +
      'Se interpretaría como scriptlet de HTML Service y rompería el render.'
    );
  }
};

for (const { name, text } of moduleSources) {
  assertNoScriptlet(`src/${name}`, text);
  if (/<\/script/i.test(text)) {
    throw new Error(`src/${name} contiene "</script", que cerraría el bloque inline.`);
  }
}
assertNoScriptlet('src/mobile.css', cssText);

// ---------------------------------------------------------------------------
// 3. Emitir el CSS y los módulos JS como plantillas HTML
// ---------------------------------------------------------------------------
const cssArtifact = 'SRC_mobile_css.html';
writeGas(cssArtifact, cssText);
manifest.push({
  gas: cssArtifact,
  origin: 'src/mobile.css',
  bytes: Buffer.byteLength(cssText, 'utf8'),
  sha256: sha256(Buffer.from(cssText, 'utf8')),
  originSha256: sha256(cssBuf)
});

for (const m of moduleSources) {
  const artifact = gasNameFor(m.name);
  writeGas(artifact, m.text);
  manifest.push({
    gas: artifact,
    origin: `src/${m.name}`,
    bytes: Buffer.byteLength(m.text, 'utf8'),
    sha256: sha256(Buffer.from(m.text, 'utf8')),
    originSha256: sha256(m.buf)
  });
}

// ---------------------------------------------------------------------------
// 4. Adaptar index.html: sólo la forma de inclusión cambia
//    - <link rel="stylesheet" href="src/mobile.css">        -> scriptlet <style>
//    - <script src="src/xxx.js"></script>                    -> scriptlet <script>
//    El diseño, el marcado y el CSS embebido quedan intactos.
// ---------------------------------------------------------------------------
const beforeText = indexText;

// 4a. CSS
const cssLinkRe = /  <link rel="stylesheet" href="src\/mobile\.css" \/>/;
if (!cssLinkRe.test(indexText)) {
  throw new Error('No se encontró el <link> de src/mobile.css en index.html');
}
indexText = indexText.replace(
  cssLinkRe,
  '  <!-- FASE 19 · GAS: el CSS móvil se inyecta como <style> en tiempo de render\n' +
  '       (scriptlet sin escape). El archivo sigue siendo src/mobile.css verbatim. -->\n' +
  "  <style><?!= include('" + cssArtifact + "'); ?></style>"
);

// 4b. Módulos JS (se conserva EXACTAMENTE el orden de dependencia)
let inlinedModules = 0;
for (const m of moduleSources) {
  const tag = `  <script src="src/${m.name}"></script>`;
  const artifact = gasNameFor(m.name);
  if (!indexText.includes(tag)) {
    throw new Error(`No se encontró el <script> de src/${m.name} en index.html`);
  }
  indexText = indexText.replace(
    tag,
    `  <script><?!= include('${artifact}'); ?></script>`
  );
  inlinedModules++;
}

// Sanidad: no deben quedar referencias locales a src/
const leftover = indexText.match(/(?:src|href)="src\/[^"]+"/g);
if (leftover) {
  throw new Error(`Quedaron referencias locales a src/ en index.html: ${leftover.join(', ')}`);
}

// Sanidad: ninguna secuencia reservada introducida por la adaptación
if (/<\?/.test(indexText.replace(/<\?!= include\('[^']+'\); \?>/g, ''))) {
  throw new Error('index.html contiene una secuencia <? fuera de los scriptlets esperados');
}

writeGas('index.html', indexText);

// ---------------------------------------------------------------------------
// 5. Diferencias introducidas en index.html (para el informe)
// ---------------------------------------------------------------------------
const beforeLines = beforeText.split('\n');
const afterLines = indexText.split('\n');
const diffSummary = {
  lineasAntes: beforeLines.length,
  lineasDespues: afterLines.length,
  scriptletsCss: 1,
  scriptletsJs: inlinedModules,
  cambios: [
    '<link href="src/mobile.css"> -> <style><?!= include(\'SRC_mobile_css.html\') ?></style>',
    ...moduleSources.map(m =>
      `<script src="src/${m.name}"> -> <script><?!= include('${gasNameFor(m.name)}') ?>`)
  ]
};

// ---------------------------------------------------------------------------
// 6. Verificación de integridad de lo generado
// ---------------------------------------------------------------------------
let integrityOk = true;
for (const item of manifest) {
  const generated = fs.readFileSync(path.join(GAS, item.gas), 'utf8');
  const ok = sha256(Buffer.from(generated, 'utf8')) === item.originSha256;
  item.identico = ok;
  if (!ok) integrityOk = false;
}

const generatedIndex = fs.readFileSync(path.join(GAS, 'index.html'), 'utf8');
const scriptletCount = (generatedIndex.match(/<\?!= include\('/g) || []).length;

// ---------------------------------------------------------------------------
// 7. Informe
// ---------------------------------------------------------------------------
console.log('\n=== GENERACIÓN DE ARTEFACTOS GAS ===\n');
console.log('Artefacto GAS'.padEnd(26) + 'Origen'.padEnd(26) + 'Bytes'.padStart(8) + '  Idéntico');
console.log('-'.repeat(74));
for (const it of manifest) {
  console.log(
    it.gas.padEnd(26) + it.origin.padEnd(26) + String(it.bytes).padStart(8) + '  ' + (it.identico ? 'SI' : 'NO')
  );
}
console.log('-'.repeat(74));
console.log(`Scriptlets en gas/index.html: ${scriptletCount} (1 CSS + ${inlinedModules} JS)`);
console.log(`index.html: ${diffSummary.lineasAntes} -> ${diffSummary.lineasDespues} líneas`);
console.log(`Integridad byte a byte de los módulos y del CSS: ${integrityOk ? 'OK' : 'FALLIDA'}`);

fs.writeFileSync(
  path.join(GAS, 'GAS_BUILD_MANIFEST.json'),
  JSON.stringify({ generado: new Date().toISOString(), manifest, diffSummary }, null, 2),
  'utf8'
);

if (!integrityOk) {
  console.error('\nERROR: la verificación de integridad ha fallado.');
  process.exit(1);
}
if (scriptletCount !== 1 + MODULES.length) {
  console.error(`\nERROR: se esperaban ${1 + MODULES.length} scriptlets y hay ${scriptletCount}.`);
  process.exit(1);
}
console.log('\nOK: artefactos GAS generados y verificados.\n');

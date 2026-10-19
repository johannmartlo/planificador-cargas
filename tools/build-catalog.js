#!/usr/bin/env node
/**
 * Generador del módulo de datos de catálogo para navegador/GAS.
 *
 * Fuente de verdad: `catalog/catalog.json`.
 * Artefacto generado: `src/catalog-data.js` (UMD, sin dependencias).
 *
 * Motivo: el navegador y Google Apps Script no pueden leer JSON del disco; el
 * catálogo se sirve como módulo JS y `src/catalog.js` lo consume. Este script
 * mantiene ambos sincronizados y valida el catálogo antes de escribir.
 *
 * Uso:
 *   node tools/build-catalog.js           # valida y regenera src/catalog-data.js
 *   node tools/build-catalog.js --check   # valida y falla si el artefacto no está sincronizado
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'catalog', 'catalog.json');
const TARGET = path.join(ROOT, 'src', 'catalog-data.js');

const { validateCatalog, formatIssues } = require(path.join(ROOT, 'src', 'catalog-schema.js'));

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function buildArtifact(data, sourceText) {
  const json = JSON.stringify(data, null, 2);
  const hash = sha256(sourceText);
  return [
    '/*',
    ' * AUTO-GENERADO por tools/build-catalog.js — NO EDITAR A MANO.',
    ' * Fuente: catalog/catalog.json',
    ` * catalogVersion: ${data.catalogVersion}`,
    ` * sha256(catalog.json): ${hash}`,
    ' */',
    '(function (root, factory) {',
    "  if (typeof module === 'object' && module.exports) {",
    '    module.exports = factory();',
    '  } else {',
    '    root.LogisticsCatalogData = factory();',
    '  }',
    "})(typeof globalThis !== 'undefined' ? globalThis : this, function () {",
    "  'use strict';",
    '  return ' + json + ';',
    '});',
    ''
  ].join('\n');
}

function main() {
  const checkOnly = process.argv.indexOf('--check') !== -1;

  if (!fs.existsSync(SOURCE)) {
    console.error(`No existe el catálogo fuente: ${SOURCE}`);
    process.exit(1);
  }

  const sourceText = fs.readFileSync(SOURCE, 'utf8');
  let data;
  try {
    data = JSON.parse(sourceText);
  } catch (err) {
    console.error(`JSON inválido en ${SOURCE}: ${err.message}`);
    process.exit(1);
  }

  const validation = validateCatalog(data);
  if (!validation.valid) {
    console.error('Catálogo inválido. No se genera el artefacto:');
    console.error(formatIssues(validation));
    process.exit(1);
  }
  validation.warnings.forEach(w => {
    console.warn(`AVISO [${w.code}] ${w.path}: ${w.message}`);
  });

  const artifact = buildArtifact(data, sourceText);

  if (checkOnly) {
    if (!fs.existsSync(TARGET)) {
      console.error(`Falta el artefacto generado: ${TARGET}`);
      process.exit(1);
    }
    const current = fs.readFileSync(TARGET, 'utf8');
    if (current !== artifact) {
      console.error('src/catalog-data.js no está sincronizado con catalog/catalog.json.');
      console.error('Ejecuta: node tools/build-catalog.js');
      process.exit(1);
    }
    console.log(`OK: catálogo válido y artefacto sincronizado (${data.articles.length} artículos, sha256 ${sha256(sourceText).slice(0, 12)}…).`);
    return;
  }

  fs.writeFileSync(TARGET, artifact, 'utf8');
  console.log(`Generado ${path.relative(ROOT, TARGET)} desde catalog/catalog.json`);
  console.log(`Artículos: ${data.articles.length} · catalogVersion: ${data.catalogVersion} · sha256: ${sha256(sourceText).slice(0, 12)}…`);
}

main();

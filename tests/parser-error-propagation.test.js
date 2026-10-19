'use strict';

/**
 * V4.7 — Propagación de errores del parser al orquestador (D3).
 *
 * El parser anida los motivos en `parsingErrors[i].errors[]`; el orquestador
 * debe propagarlos como mensaje legible y códigos, conservando línea y texto.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const orchestrator = require(path.join(ROOT, 'src', 'orchestrator.js'));

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

function lineError(result) {
  return (result.warnings || []).find(w => w.code === 'PARSER_LINE_ERROR');
}

console.log('\n=== V4.7 · PROPAGACIÓN DE ERRORES DEL PARSER ===\n');

check('1 · un error anidado produce mensaje legible, código, línea e id', () => {
  const raw = [
    'CENTRO\t20/10/2026\t14072\tTOMATE PERA RAMA\t10',
    'CENTRO\t20/10/2026\t99999\tTOMATE KIWI\t5'
  ].join('\n');
  const result = orchestrator.planLoad({ rawText: raw, stock: { 'PERA_RAMA': 10 } });
  const warning = lineError(result);
  assert.ok(warning, 'no se generó PARSER_LINE_ERROR');
  assert.strictEqual(warning.lineNumber, 2);
  assert.strictEqual(warning.lineId, 'line_2');
  assert.strictEqual(warning.rawText, 'CENTRO\t20/10/2026\t99999\tTOMATE KIWI\t5');
  assert.deepStrictEqual(warning.errorCodes, ['UNKNOWN_PRODUCT']);
  assert.ok(warning.message.includes('Producto no reconocido'),
    `mensaje inesperado: ${warning.message}`);
  assert.ok(!/undefined/.test(warning.message));
});

check('2 · una línea con varios errores no descarta información', () => {
  const raw = 'CENTRO\t20/10/2026\t99999\tTOMATE KIWI';
  const result = orchestrator.planLoad({ rawText: raw, stock: {} });
  const warning = lineError(result);
  assert.ok(warning, 'no se generó PARSER_LINE_ERROR');
  assert.ok(warning.errorCodes.includes('MISSING_QUANTITY'), JSON.stringify(warning.errorCodes));
  assert.ok(warning.errorCodes.includes('UNKNOWN_PRODUCT'), JSON.stringify(warning.errorCodes));
  assert.ok(warning.message.includes('cantidad'), `mensaje: ${warning.message}`);
  assert.ok(warning.message.includes('Producto no reconocido'), `mensaje: ${warning.message}`);
  assert.ok(warning.details.length >= 2, 'no se conservaron los detalles anidados');
});

check('3 · si todas las líneas son inválidas se informa del fallo global', () => {
  const result = orchestrator.planLoad({
    rawText: 'CENTRO\t20/10/2026\t99999\tTOMATE KIWI\t5',
    stock: {}
  });
  const warning = lineError(result);
  assert.ok(warning, 'no se generó PARSER_LINE_ERROR');
  assert.ok(result.errors.some(e => e.code === 'NO_VALID_LINES_PARSED'));
  assert.strictEqual(result.sourceSummary.validLinesCount, 0);
  assert.ok(warning.message.length > 0);
});

check('4 · la advertencia nunca contiene "undefined" con varios errores', () => {
  const raw = 'CENTRO\t20/10/2026\t99999\tTOMATE KIWI';
  const result = orchestrator.planLoad({ rawText: raw, stock: {} });
  const warning = lineError(result);
  assert.ok(warning && typeof warning.message === 'string');
  assert.ok(warning.message.indexOf('undefined') === -1);
  assert.ok(warning.errorCodes.length >= 2);
});

console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${total}`);
console.log(`PASADAS CON ÉXITO:    ${passed}`);
console.log(`FALLOS:               ${failures.length}`);
console.log('==================================================\n');

if (failures.length > 0) {
  process.exitCode = 1;
}

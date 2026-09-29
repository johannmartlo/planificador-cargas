'use strict';

/**
 * TEST: Desglose técnico - Visibilidad de Málaga y plataformas dinámicas
 * Caso de prueba: Previsión 30/09/2026 (17 líneas, 216 cajas, 6 plataformas)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { createDocument } = require('./helpers/mini-dom.js');
const catalog = require('../src/catalog.js');
const parser = require('../src/parser.js');
const ui = require('../src/ui.js');
const { AppState, UIController } = ui;

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('\n=== TEST DESGLOSE TÉCNICO: VISIBILIDAD DE MÁLAGA (30/09/2026) ===\n');

// 1. Verificación estática: index.html no debe tener max-h-36 ni overflow-y-auto en ana-platform-demands
assert.ok(
  htmlContent.includes('id="ana-platform-demands"'),
  'index.html contiene #ana-platform-demands'
);
const platContainerMatch = htmlContent.match(/id="ana-platform-demands"[^>]*class="([^"]*)"/);
assert.ok(platContainerMatch, 'Encontrado #ana-platform-demands con atributo class');
const classes = platContainerMatch[1];
assert.ok(
  !classes.includes('max-h-36'),
  `#ana-platform-demands no debe contener max-h-36 (actual: "${classes}")`
);
assert.ok(
  !classes.includes('overflow-y-auto'),
  `#ana-platform-demands no debe contener overflow-y-auto (actual: "${classes}")`
);
console.log('  PASS  1. index.html no tiene límite artificial de altura (max-h-36 / overflow-y-auto)');

// 2. Reproducción del caso 30/09/2026 (fijo en tests, sin ensuciar la app productiva)
const text30Sep = [
  'CENTRO\t30/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t30',
  'CATALUÑA\t30/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t30',
  'LEVANTE\t30/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t25',
  'SUR\t30/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t20',
  'SANTANDER\t30/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t15',
  'MALAGA\t30/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t10',
  'CENTRO\t30/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t20',
  'CATALUÑA\t30/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t15',
  'LEVANTE\t30/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t10',
  'SUR\t30/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t8',
  'SANTANDER\t30/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t5',
  'MALAGA\t30/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t6',
  'CENTRO\t30/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t6',
  'CATALUÑA\t30/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t4',
  'LEVANTE\t30/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t6',
  'SUR\t30/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t3',
  'SANTANDER\t30/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t3'
].join('\n');

const parsed = parser.parseForecast(text30Sep, catalog);
assert.strictEqual(parsed.lines.length, 17, 'Total 17 líneas parseadas');
const validLines = parsed.lines.filter(l => l.isValid);
assert.strictEqual(validLines.length, 17, 'Total 17 líneas válidas');
const totalReq = validLines.reduce((s, l) => s + l.requestedQuantity, 0);
assert.strictEqual(totalReq, 216, 'Total cajas solicitadas = 216 cjs');
console.log('  PASS  2. Parser produce 17 líneas válidas y 216 cjs para 30/09/2026');

// 3. Verificación de renderizado en UIController
const doc = createDocument(`
  <div id="forecast-analysis-card">
    <span id="ana-total-lines"></span>
    <span id="ana-valid-lines"></span>
    <span id="ana-error-lines"></span>
    <span id="ana-detected-date"></span>
    <span id="ana-total-requested"></span>
    <div id="ana-demands-breakdown"></div>
    <div id="ana-platform-demands" class="space-y-1 pt-1"></div>
    <div id="ana-corrupt-lines-box"></div>
    <div id="ana-corrupt-lines-list"></div>
    <div id="consolidated-platforms-list"></div>
    <div id="context-date-chips"></div>
    <span id="consolidated-orders-badge"></span>
    <input id="tsv-input" />
  </div>
`);
global.document = doc;
global.window = { location: { search: '' }, addEventListener() {}, scrollTo() {} };

const state = new AppState();
const ctrl = new UIController(state);
ctrl.bindDOM(doc);

doc.getElementById('tsv-input').value = text30Sep;
const analysis = ctrl.analyzeForecast(text30Sep);
ctrl.renderForecastAnalysis(analysis);

const platDiv = doc.getElementById('ana-platform-demands');
const serialized = doc.serialize(platDiv);

// 4. Verificación de plataformas presentes y cajas
const expectedPlatforms = ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA'];
let sumFromMarkup = 0;

for (const plat of expectedPlatforms) {
  assert.ok(serialized.includes(plat), `Plataforma ${plat} visible en el desglose técnico`);
  const regex = new RegExp(`${plat}[\\s\\S]*?\\((\\d+)\\s*cjs\\)`);
  const match = serialized.match(regex);
  assert.ok(match, `Encontrado total de cajas para ${plat}`);
  const boxes = parseInt(match[1], 10);
  sumFromMarkup += boxes;
}

assert.strictEqual(sumFromMarkup, 216, `Suma de todas las plataformas (${sumFromMarkup}) = 216 cjs`);
assert.ok(serialized.includes('MALAGA'), 'Málaga está presente y visible en el desglose');
console.log('  PASS  3. Las 6 plataformas están presentes en el desglose técnico (incluida MALAGA)');
console.log(`  PASS  4. Suma de plataformas en desglose = ${sumFromMarkup} cjs (coincide con total 216 cjs)`);

// 5. Verificación dinámica para N plataformas (ej. 7 plataformas)
const dynamicAnalysis = {
  ...analysis,
  platformsFound: ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA', 'BILBAO'],
  demandsByPlatformAndProduct: {
    PERA_RAMA: {
      CENTRO: 10, CATALUÑA: 10, LEVANTE: 10, SUR: 10, SANTANDER: 10, MALAGA: 10, BILBAO: 10
    }
  }
};
ctrl.renderForecastAnalysis(dynamicAnalysis);
const dynamicSerialized = doc.serialize(platDiv);
assert.ok(dynamicSerialized.includes('BILBAO'), 'Soporta dinámicamente 7 o más plataformas');
console.log('  PASS  5. Desglose técnico dinámico para 6, 7, 8 o más plataformas sin límite');

console.log('\nTodos los tests de desglose técnico y visibilidad de Málaga superados con éxito.\n');

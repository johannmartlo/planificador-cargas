/**
 * PHASE 18 — §21 COMPARACIÓN DESKTOP vs MOBILE
 *
 * Verifica que el shell móvil consume EXACTAMENTE el mismo AppState y el mismo
 * PlanningResult que el shell de escritorio, y que cada cifra operativa coincide:
 *   totalBoxes, totalPallets, totalPalletSlots, plataformas, productos,
 *   variedades, asignaciones, formatos, alturas y torres.
 *
 * Dataset real: 18/09 -> 522 cajas · 17 palets · 9 torres.
 *
 * Uso: node tests/mobile-desktop-parity.test.js
 */
'use strict';

const path = require('path');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const ui = require(path.join(SRC, 'ui.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

// ---------------------------------------------------------------------------
// Expectativas congeladas del dataset 18/09 (RC3.1)
// ---------------------------------------------------------------------------
const EXPECTED = {
  deliveryDate: '26/08/2026',
  totalRequested: 522,
  totalBoxes: 522,
  totalPallets: 17,
  totalPalletSlots: 9,
  totalTowers: 9,
  platforms: 6,
  errors: 0
};

const STOCK_18SEP = {
  'PERA_RAMA': 320,
  'COCKTAIL_ROMANTICO::CONSABOR': 0,
  'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
  'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
  'CHERRY_RAMA::SUNSTREAM': 100
};

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: err && err.message });
  }
}

// ---------------------------------------------------------------------------
// Fixture: un único PlanLoad alimenta ambos shells
// ---------------------------------------------------------------------------
const planningResult = orchestrator.planLoad({
  rawText: ui.DATASETS['18_SEP'],
  stock: { ...STOCK_18SEP },
  locks: [],
  exclusions: [],
  palletConfiguration: {}
});

const model = ui.buildTruckSlotsModel(planningResult);

function totalTowersOf(m) {
  return (m.slots || []).reduce((s, sl) => {
    const t = (sl.stackingPlan && sl.stackingPlan.towers) ? sl.stackingPlan.towers : [];
    return s + t.length;
  }, 0);
}

// ---------------------------------------------------------------------------
// 1. Contrato congelado del dataset
// ---------------------------------------------------------------------------
check('dataset 18/09 · totalBoxes = 522', () => {
  assert.strictEqual(planningResult.totalBoxes, EXPECTED.totalBoxes);
  assert.strictEqual(planningResult.demandSummary.totalRequested, EXPECTED.totalRequested);
});

check('dataset 18/09 · totalPallets = 17', () => {
  assert.strictEqual(planningResult.totalPallets, EXPECTED.totalPallets);
});

check('dataset 18/09 · totalPalletSlots = 9', () => {
  assert.strictEqual(planningResult.totalPalletSlots, EXPECTED.totalPalletSlots);
});

check('dataset 18/09 · torres = 9', () => {
  assert.strictEqual(totalTowersOf(model), EXPECTED.totalTowers);
});

check('dataset 18/09 · motores sin errores y físicamente viable', () => {
  assert.strictEqual((planningResult.errors || []).length, EXPECTED.errors);
  assert.strictEqual(planningResult.isPhysicallyFeasible, true);
});

// ---------------------------------------------------------------------------
// 2. El shell móvil es el MISMO árbol de render → mismos valores en el DOM
// ---------------------------------------------------------------------------
const MOBILE_DOM = `
<main data-view="plan">
  <span id="kpi-allocated"></span>
  <span id="kpi-truck-slots"></span>
  <span id="kpi-pallet-slots"></span>
  <span id="kpi-pallets"></span>
  <span id="kpi-requested"></span>
  <span id="kpi-missing"></span>
  <span id="kpi-service-rate"></span>
  <div id="kpi-stock-details"></div>
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
  <span id="badge-delivery-date"></span>
  <span id="badge-plan-status"></span>
  <span id="mt-badge-forecast" hidden></span>
  <span id="mt-badge-plan" hidden></span>
  <div id="platform-plan-cards-container"></div>
  <div id="warnings-errors-section"><div id="errors-list-container"></div><div><div id="warnings-list-container"></div></div></div>
  <div id="print-incidences-block"></div>
  <div id="print-articles-totals-list"></div>
  <span id="print-grand-total-boxes"></span>
  <span id="print-delivery-date"></span>
  <span id="print-emission-time"></span>
  <span id="plan-calculated-time"></span>
  <div id="actions-toolbar" class="hidden"></div>
  <div id="platform-detail-modal" hidden>
    <span id="pdm-platform-name"></span>
    <div id="pdm-body"></div>
    <button id="pdm-close"></button>
  </div>
</main>
<nav id="mobile-tabbar">
  <button class="mt-tab" data-nav-view="forecast"></button>
  <button class="mt-tab" data-nav-view="stock"></button>
  <button class="mt-tab" data-nav-view="plan"></button>
  <button class="mt-tab" data-nav-view="more"></button>
</nav>
<button id="btn-generate-plan"></button>
<div class="stock-step" data-stock-target="stock-pera" data-stock-delta="10" data-stock-max="76"></div>
<input id="stock-pera" type="number" value="0" />
`;

const document = createDocument(MOBILE_DOM);
// El shell móvil se ejecuta contra el document real del navegador: en Node lo
// exponemos como global para ejercitar el MISMO código de UIController.
global.document = document;
const appState = new ui.AppState();
const controller = new ui.UIController(appState);

appState.rawText = ui.DATASETS['18_SEP'];
appState.setStock({ ...STOCK_18SEP });
appState.planningResult = planningResult;
appState.calculatedStock = { ...STOCK_18SEP };
appState.planState = 'PLAN_ACTUALIZADO';
appState.planStatus = ui.UIController.derivePlanStatus(planningResult);

const mobileModel = controller.getMobileModel();

check('móvil · getMobileModel() deriva el mismo modelo que el shell de escritorio', () => {
  const fromMobile = controller.getMobileModel();
  // Ambas shells llaman a la MISMA función pura sobre el MISMO PlanningResult:
  // el modelo debe ser idéntico valor a valor (ni se recalcula ni se duplica).
  assert.deepStrictEqual(fromMobile, model);
  // Y además queda cacheado por identidad de resultado (no se reconstruye en cada render).
  assert.strictEqual(controller.getMobileModel(), fromMobile);
});

check('móvil · tarjetas de plataforma renderizadas (mismo contenedor que Desktop)', () => {
  controller.renderPlatformPlan(planningResult);
  const cards = document.querySelectorAll('#platform-plan-cards-container .digital-loading-card');
  assert.strictEqual(cards.length, model.slots.length);
  assert.strictEqual(cards.length, EXPECTED.platforms);
});

check('móvil · cada tarjeta expone su botón VER DETALLE', () => {
  const buttons = document.querySelectorAll('#platform-plan-cards-container .btn-platform-detail');
  assert.strictEqual(buttons.length, model.slots.length);
  const platforms = buttons.map(b => b.getAttribute('data-platform')).sort();
  assert.deepStrictEqual(platforms, model.slots.map(s => s.platform).sort());
});

check('móvil · KPIs de escritorio y móviles muestran los MISMOS totales', () => {
  controller.renderExecutiveSummary(planningResult); // shell escritorio
  controller.renderMobileKpis(planningResult);       // shell móvil

  const read = id => document.getElementById(id).textContent;

  // totalBoxes
  assert.strictEqual(String(read('kpi-allocated')), '522');
  assert.strictEqual(String(read('mkpi-boxes')), '522');

  // totales asignadas / solicitadas / pendientes
  const totalMissing = planningResult.allocations.reduce((s, a) => s + a.missingQuantity, 0);
  assert.strictEqual(String(read('kpi-missing')), String(totalMissing));
  assert.strictEqual(String(read('mkpi-pending')), String(totalMissing));

  // totalPallets
  assert.strictEqual(String(read('kpi-pallets')), '17');
  assert.strictEqual(String(read('mkpi-pallets')), '17');

  // plataformas
  assert.strictEqual(String(read('kpi-truck-slots')), '6');
  assert.strictEqual(String(read('mkpi-platforms')), '6');

  // torres (móvil)
  assert.strictEqual(String(read('mkpi-towers')), '9');
});

check('móvil · totalPalletSlots coincide entre modelo y motor', () => {
  assert.strictEqual(mobileModel.totalPalletSlots, planningResult.palletSummaries.totalPalletSlots);
  assert.strictEqual(mobileModel.totalPalletSlots, 9);
});

// ---------------------------------------------------------------------------
// 3. Detalle de plataforma: productos, variedades, formatos, alturas, torres
// ---------------------------------------------------------------------------
check('móvil · detalle de cada plataforma reproduce el modelo exactamente', () => {
  for (const slot of model.slots) {
    assert.strictEqual(controller.openPlatformDetail(slot.platform), true,
      `openPlatformDetail(${slot.platform})`);

    const nameEl = document.getElementById('pdm-platform-name');
    const bodyEl = document.getElementById('pdm-body');
    assert.strictEqual(nameEl.textContent, slot.platform);

    const html = bodyEl.innerHTML;

    // Cajas totales de la plataforma
    assert.ok(html.includes(`<b>${slot.totalBoxes}</b>`),
      `${slot.platform}: faltan las ${slot.totalBoxes} cajas`);

    // Productos + variedades + cajas por producto
    for (const item of slot.items) {
      const prodName = ui.UIController.getMobileProductName(item.productId);
      assert.ok(html.includes(prodName), `${slot.platform}: falta producto ${prodName}`);

      if (item.varietyId) {
        const varName = ui.UIController.getMobileVarietyName(item.productId, item.varietyId);
        assert.ok(html.includes(varName), `${slot.platform}: falta variedad ${varName}`);
      }

      assert.ok(html.includes(`<b>${item.totalBoxes}</b>`),
        `${slot.platform}: faltan las ${item.totalBoxes} cajas de ${item.productId}`);

      // Formato de palet
      assert.ok(html.includes(item.palletType),
        `${slot.platform}: falta el formato ${item.palletType}`);

      // Palets físicos con su ocupación
      for (const p of item.pallets) {
        assert.ok(html.includes(`#${p.palletNumber}`),
          `${slot.platform}: falta el palet #${p.palletNumber}`);
        assert.ok(html.includes(`${p.occupancyPercentage}%`),
          `${slot.platform}: falta la ocupación ${p.occupancyPercentage}% del palet #${p.palletNumber}`);
      }
    }

    // Torres con su formato y altura exacta
    const towers = (slot.stackingPlan && slot.stackingPlan.towers) ? slot.stackingPlan.towers : [];
    assert.strictEqual((html.match(/class="pdm-tower"/g) || []).length, towers.length,
      `${slot.platform}: número de torres distinto`);

    for (const t of towers) {
      assert.ok(html.includes(`Torre ${t.towerIndex}`), `${slot.platform}: falta la torre ${t.towerIndex}`);
      assert.ok(html.includes(`<b>${t.towerHeightMm}</b>`),
        `${slot.platform}: falta la altura ${t.towerHeightMm} mm de la torre ${t.towerIndex}`);
      assert.ok(html.includes(String(t.maxTowerHeightMm)),
        `${slot.platform}: falta el gálibo ${t.maxTowerHeightMm} mm`);
      for (const p of (t.pallets || [])) {
        const totalH = p.palletTotalHeightMm || ((p.merchandiseHeightMm || 0) + (p.palletHeightMm || 144));
        assert.ok(html.includes(`${totalH} mm`),
          `${slot.platform}: falta la altura de palet ${totalH} mm`);
      }
    }
  }
});

check('móvil · asignaciones completas (plataforma + cajas + variedad) presentes en el detalle', () => {
  // conjunto único en el dataset 18/09: (plataforma, cajas asignadas, variedad)
  for (const a of planningResult.allocations) {
    if (a.allocatedQuantity <= 0) continue;
    const slot = model.slots.find(s => s.platform === a.platform);
    assert.ok(slot, `falta la plataforma ${a.platform}`);

    const item = slot.items.find(i =>
      i.productId === a.productId &&
      (i.varietyId === a.varietyId || (!i.varietyId && !a.varietyId)));
    assert.ok(item, `${a.platform}/${a.productId}: producto ausente del modelo móvil`);
    assert.strictEqual(item.totalBoxes, a.allocatedQuantity,
      `${a.platform}/${a.productId}: cajas del modelo != cajas asignadas`);

    controller.openPlatformDetail(a.platform);
    const html = document.getElementById('pdm-body').innerHTML;
    assert.ok(html.includes(`<b>${a.allocatedQuantity}</b>`),
      `${a.platform}/${a.productId}: el detalle no muestra ${a.allocatedQuantity} cajas`);
    if (a.varietyId) {
      const varName = ui.UIController.getMobileVarietyName(a.productId, a.varietyId);
      assert.ok(html.includes(varName),
        `${a.platform}: el detalle no muestra la variedad ${varName}`);
    }
  }
});

check('móvil · ningún detalle inventa campos tipo "hueco de camión" o "truck slot"', () => {
  for (const slot of model.slots) {
    controller.openPlatformDetail(slot.platform);
    const html = document.getElementById('pdm-body').innerHTML.toLowerCase();
    assert.ok(!html.includes('truck slot'), `${slot.platform}: aparece "truck slot"`);
    assert.ok(!html.includes('camión'), `${slot.platform}: aparece "camión"`);
    assert.ok(!html.includes('camion'), `${slot.platform}: aparece "camion"`);
  }
});

check('paridad · tarjeta (Desktop) y detalle (Mobile) muestran las MISMAS cifras por plataforma', () => {
  const container = document.getElementById('platform-plan-cards-container');
  appState.planningResult = planningResult;

  for (const slot of model.slots) {
    // --- Lado Desktop: la tarjeta del plan ---
    const card = container.children.find(c => c.getAttribute('data-platform') === slot.platform);
    assert.ok(card, `Desktop: falta la tarjeta de ${slot.platform}`);
    const cardHtml = card.innerHTML;

    // Totales de la plataforma (marcado exacto del render de escritorio)
    assert.ok(cardHtml.includes(`card-boxes tabular-nums tracking-tight">${slot.totalBoxes}</span>`),
      `Desktop: la tarjeta de ${slot.platform} no muestra ${slot.totalBoxes} cajas`);

    // Cajas por producto y formato de palet
    for (const item of slot.items) {
      assert.ok(cardHtml.includes(`card-boxes tabular-nums">\n                ${item.totalBoxes}\n`),
        `Desktop: ${slot.platform} no muestra ${item.totalBoxes} cjs de ${item.productId}`);
      assert.ok(cardHtml.includes(item.palletType),
        `Desktop: ${slot.platform} no muestra el formato ${item.palletType}`);
    }

    // --- Lado Mobile: el detalle ---
    assert.strictEqual(controller.openPlatformDetail(slot.platform), true);
    const detailHtml = document.getElementById('pdm-body').innerHTML;

    assert.ok(detailHtml.includes(`<b>${slot.totalBoxes}</b>`),
      `Mobile: el detalle de ${slot.platform} no muestra ${slot.totalBoxes} cajas`);

    for (const item of slot.items) {
      assert.ok(detailHtml.includes(`<b>${item.totalBoxes}</b>`),
        `Mobile: el detalle de ${slot.platform} no muestra ${item.totalBoxes} cjs de ${item.productId}`);
      assert.ok(detailHtml.includes(item.palletType),
        `Mobile: el detalle de ${slot.platform} no muestra el formato ${item.palletType}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 4. CONSABOR — variedad de Cocktail, nunca artículo independiente (§20)
// ---------------------------------------------------------------------------
check('CONSABOR · etiqueta de variedad propia (no un artículo "CONSABOR")', () => {
  const varName = ui.UIController.getMobileVarietyName('COCKTAIL_ROMANTICO', 'CONSABOR');
  assert.strictEqual(varName, 'CONSABOR');
  assert.strictEqual(ui.UIController.getMobileProductName('COCKTAIL_ROMANTICO'), 'Cocktail Romántico');
});

check('CONSABOR · el detalle lo rotula bajo Cocktail Romántico, nunca como producto suelto', () => {
  // Forzamos una asignación CONSABOR vía stock, sin tocar ninguna regla
  const consaborResult = orchestrator.planLoad({
    rawText: ui.DATASETS['18_SEP'],
    stock: {
      'PERA_RAMA': 320,
      'COCKTAIL_ROMANTICO::CONSABOR': 102,
      'COCKTAIL_ROMANTICO::SAO_PAULO': 0,
      'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
      'CHERRY_RAMA::SUNSTREAM': 100
    },
    locks: [],
    exclusions: [],
    palletConfiguration: {}
  });

  const consaborModel = ui.buildTruckSlotsModel(consaborResult);
  const consaborItems = consaborModel.slots
    .flatMap(s => s.items)
    .filter(i => i.varietyId === 'CONSABOR');

  assert.ok(consaborItems.length > 0, 'el motor no asignó ninguna variedad CONSABOR');

  // El detalle móvil se abre sobre el PlanningResult vigente del controlador.
  appState.planningResult = consaborResult;

  for (const slot of consaborModel.slots) {
    if (!slot.items.some(i => i.varietyId === 'CONSABOR')) continue;
    controller.openPlatformDetail(slot.platform);
    const html = document.getElementById('pdm-body').innerHTML;
    assert.ok(html.includes('Cocktail Romántico'), `${slot.platform}: no rotula el producto Cocktail`);
    assert.ok(html.includes('CONSABOR'), `${slot.platform}: no rotula la variedad CONSABOR`);
    assert.ok(!/producto\s+consabor/i.test(html), 'CONSABOR no debe aparecer como producto');
  }

  appState.planningResult = planningResult;
});

check('CONSABOR · suma dentro de TOTAL COCKTAIL (nunca artículo independiente)', () => {
  const summary = ui.computeServedTotalsByArticle(planningResult);
  const articles = summary.totalsList.map(t => t.article);
  assert.ok(articles.includes('COCKTAIL'), 'falta TOTAL COCKTAIL');
  assert.ok(!articles.includes('CONSABOR'), 'CONSABOR no debe ser un artículo independiente');
  assert.ok(!articles.includes('SAO_PAULO'), 'SAO_PAULO no debe ser un artículo independiente');
});

check('Cherry es independiente y CONSABOR no altera su total', () => {
  const summary = ui.computeServedTotalsByArticle(planningResult);
  const text = summary.totalsList.map(t => t.formattedText).join(' | ');
  assert.ok(text.includes('TOTAL PERA: 320'), text);
  assert.ok(text.includes('TOTAL COCKTAIL: 102'), text);
  assert.ok(text.includes('TOTAL SUNSTREAM: 100'), text);
  assert.strictEqual(summary.grandTotal, 522);
});

// ---------------------------------------------------------------------------
// 5. Salidas operativas intactas (PDF / WhatsApp)
// ---------------------------------------------------------------------------
check('WhatsApp · mensaje generado desde el PlanningResult compartido', () => {
  const msg = ui.formatWhatsAppMessage(planningResult);
  assert.ok(msg.length > 0, 'mensaje vacío');
  assert.ok(msg.includes('522'), 'el mensaje no incluye el total de cajas');
  for (const slot of model.slots) {
    assert.ok(msg.includes(slot.platform), `el mensaje no incluye ${slot.platform}`);
  }
});

check('PDF · totales servidos por artículo usan las cajas SERVIDAS', () => {
  const summary = ui.computeServedTotalsByArticle(planningResult);
  const allocated = planningResult.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
  assert.strictEqual(summary.grandTotal, allocated);
  assert.strictEqual(summary.grandTotal, 522);
});

// ---------------------------------------------------------------------------
// 6. Replanificación: cambio de stock -> plan stale -> recálculo -> misma demanda
// ---------------------------------------------------------------------------
check('replanificación · el shell móvil no altera el comportamiento stale', () => {
  const liveState = new ui.AppState();
  const liveController = new ui.UIController(liveState);
  liveState.rawText = ui.DATASETS['18_SEP'];
  liveState.setStock({ ...STOCK_18SEP });

  const first = liveController.generatePlan();
  assert.strictEqual(first.demandSummary.totalRequested, 522);
  assert.strictEqual(liveState.planState, 'PLAN_ACTUALIZADO');

  // Cambio de stock -> plan desactualizado
  liveState.setStockItem('PERA_RAMA', 100);
  assert.strictEqual(liveState.planState, 'PLAN_DESACTUALIZADO');

  const second = liveController.recalculatePlan();
  assert.strictEqual(liveState.planState, 'PLAN_ACTUALIZADO');
  assert.strictEqual(second.demandSummary.totalRequested, 522, 'la demanda original debe conservarse');
  assert.ok(second.allocations.reduce((s, a) => s + a.missingQuantity, 0) > 0,
    'con menos stock debe haber faltantes');
  assert.strictEqual(liveState.previousResult, first);
});

// ---------------------------------------------------------------------------
// 7. Locks: FULL + CONSABOR FULL sin cambios de reglas
// ---------------------------------------------------------------------------
check('locks · CONSABOR FULL se mantiene como bloqueo de variedad', () => {
  const lockState = new ui.AppState();
  lockState.addLock({
    platform: 'CENTRO',
    productId: 'COCKTAIL_ROMANTICO',
    varietyId: 'CONSABOR',
    type: 'FULL',
    label: 'COCKTAIL CONSABOR'
  });
  const lock = lockState.locks[0];
  assert.strictEqual(lock.platform, 'CENTRO');
  assert.strictEqual(lock.productId, 'COCKTAIL_ROMANTICO');
  assert.strictEqual(lock.varietyId, 'CONSABOR');
  assert.strictEqual(lock.type, 'FULL');
  assert.strictEqual(lockState.hasLockConflict('CENTRO', 'COCKTAIL_ROMANTICO'), false);
});

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
let failed = 0;
console.log('\n=== FASE 18 · DESKTOP vs MOBILE (dataset 18/09) ===\n');
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
console.log(failed === 0
  ? 'RESULTADO: Desktop y Mobile consumen EXACTAMENTE el mismo PlanningResult.'
  : `RESULTADO: ${failed} fallo(s).`);
process.exit(failed === 0 ? 0 : 1);

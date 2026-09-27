'use strict';

/**
 * TEST SUITE: Previsión Consolidada + Pedidos Anticipados + Fecha de Entrega como dato de primera clase + División de Pedidos
 * PlanificadorCarga-V4 (RC3.1)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const parser = require(path.join(SRC, 'parser.js'));
const catalog = require(path.join(SRC, 'catalog.js'));
const ui = require(path.join(SRC, 'ui.js'));

const { AppState, UIController, getDayOfWeekName, formatDateWithDay, formatWhatsAppMessage, getBasePlatform, getProductVarietyDisplay, derivePlatformProvenance, getProvenanceBadgeHTML } = ui;
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

let totalChecks = 0;
let passedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  PASS  ${title}`);
  } catch (err) {
    console.error(`  FAIL  ${title}`);
    console.error(`        ${err.message}`);
  }
}

console.log('\n=== PRUEBAS DE PREVISIÓN CONSOLIDADA, FECHA DE ENTREGA Y DIVISIÓN DE PEDIDOS ===\n');

// =============================================================================
// 1. DÍA DE LA SEMANA Y FORMATEO DE FECHAS
// =============================================================================
check('Fecha · getDayOfWeekName resuelve correctamente días en español', () => {
  assert.strictEqual(getDayOfWeekName('26/09/2026'), 'SÁBADO');
  assert.strictEqual(getDayOfWeekName('27/09/2026'), 'DOMINGO');
  assert.strictEqual(getDayOfWeekName('21/09/2026'), 'LUNES');
  assert.strictEqual(getDayOfWeekName('26/08/2026'), 'MIÉRCOLES');
  assert.strictEqual(getDayOfWeekName('2026-09-26'), 'SÁBADO');
  assert.strictEqual(getDayOfWeekName(''), '');
  assert.strictEqual(getDayOfWeekName(null), '');
});

check('Fecha · formatDateWithDay formatea con día prominente', () => {
  assert.strictEqual(formatDateWithDay('26/09/2026'), 'SÁBADO 26/09/2026');
  assert.strictEqual(formatDateWithDay('27/09/2026'), 'DOMINGO 27/09/2026');
  assert.strictEqual(formatDateWithDay(''), '');
});

// =============================================================================
// 2. CASO A: PEDIDOS ANTICIPADOS (JUEVES)
// =============================================================================
check('Caso A · Registro de pedidos anticipados recibidos sin previsión previa', () => {
  const state = new AppState();

  // Jueves: Llegan CENTRO (40 cjs) y LEVANTE (30 cjs) con entrega sábado 26/09/2026
  const ordCentro = state.addAdvanceOrder({
    platform: 'centro',
    productId: 'pera_rama',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });

  const ordLevante = state.addAdvanceOrder({
    platform: 'levante',
    productId: 'pera_rama',
    cajas: 30,
    fechaEntrega: '26/09/2026'
  });

  assert.strictEqual(state.orders.length, 2);
  assert.strictEqual(ordCentro.platform, 'CENTRO');
  assert.strictEqual(ordCentro.productId, 'PERA_RAMA');
  assert.strictEqual(ordCentro.cajas, 40);
  assert.strictEqual(ordCentro.fechaEntrega, '26/09/2026');
  assert.strictEqual(ordCentro.origen, 'ANTICIPADO');
  assert.strictEqual(ordCentro.active, true);
  assert.ok(ordCentro.id.startsWith('ORD-'));

  assert.strictEqual(ordLevante.platform, 'LEVANTE');
  assert.strictEqual(ordLevante.cajas, 30);
  assert.strictEqual(ordLevante.origen, 'ANTICIPADO');
  assert.strictEqual(ordLevante.active, true);
});

// =============================================================================
// 3. CASO B: PREVISIÓN DEL VIERNES + COEXISTENCIA NO DESTRUCTIVA
// =============================================================================
check('Caso B · Importación de previsión el viernes coexiste con anticipados del jueves', () => {
  const state = new AppState();

  // Anticipados del jueves
  state.addAdvanceOrder({
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });
  state.addAdvanceOrder({
    platform: 'LEVANTE',
    productId: 'PERA_RAMA',
    cajas: 30,
    fechaEntrega: '26/09/2026'
  });

  // Previsión recibida el viernes:
  // - CATALUÑA (60 cjs, entrega SÁBADO 26/09/2026)
  // - MURCIA (50 cjs, entrega DOMINGO 27/09/2026)
  const forecastText = [
    'CATALUÑA\tFri Sep 25 2026 00:00:00 GMT+0200\t26/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t60',
    'MURCIA\tFri Sep 25 2026 00:00:00 GMT+0200\t27/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t50'
  ].join('\n');

  const parsed = parser.parseForecast(forecastText, catalog.DEFAULT_CATALOG);
  state.importForecastLines(parsed.lines, '26/09/2026');

  // En la colección unificada deben existir 4 pedidos: 2 anticipados + 2 de previsión
  assert.strictEqual(state.orders.length, 4);

  const anticipados = state.orders.filter(o => o.origen === 'ANTICIPADO');
  const previsionales = state.orders.filter(o => o.origen === 'PREVISION');

  assert.strictEqual(anticipados.length, 2, 'Los 2 anticipados se conservan intactos');
  assert.strictEqual(previsionales.length, 2, 'Las 2 líneas de previsión se integran');

  // Comprobar que CATALUÑA y MURCIA tienen origen PREVISION
  const catalunya = state.orders.find(o => o.platform === 'CATALUÑA');
  const murcia = state.orders.find(o => o.platform === 'MURCIA');
  assert.ok(catalunya && catalunya.cajas === 60 && catalunya.origen === 'PREVISION');
  assert.ok(murcia && murcia.cajas === 50 && murcia.origen === 'PREVISION' && murcia.fechaEntrega === '27/09/2026');
});

check('Caso B · Deduplicación no destructiva ante solapamiento de plataforma', () => {
  const state = new AppState();

  // Anticipado: CENTRO 40 cajas
  state.addAdvanceOrder({
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });

  // Si la previsión trae CENTRO 50 cajas (difiere en cajas), NO se fusiona silenciosamente: coexisten ambos
  const forecastDiff = 'CENTRO\tFri Sep 25 2026 00:00:00 GMT+0200\t26/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t50';
  const parsedDiff = parser.parseForecast(forecastDiff, catalog.DEFAULT_CATALOG);
  state.importForecastLines(parsedDiff.lines, '26/09/2026');

  assert.strictEqual(state.orders.length, 2, 'Deben coexistir ambos pedidos para revisión manual');
  const centros = state.orders.filter(o => o.platform === 'CENTRO');
  assert.strictEqual(centros.length, 2);
  assert.ok(centros.some(c => c.origen === 'ANTICIPADO' && c.cajas === 40));
  assert.ok(centros.some(c => c.origen === 'PREVISION' && c.cajas === 50));
});

// =============================================================================
// 4. CASO C: FECHA DE ENTREGA COMO DATO DE PRIMERA CLASE (NO MEZCLA EN CAMIÓN)
// =============================================================================
check('Caso C · getAvailableDeliveryDates detecta fechas disponibles de forma determinista', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '27/09/2026', origen: 'PREVISION' });

  const dates = state.getAvailableDeliveryDates();
  assert.deepStrictEqual(dates, ['26/09/2026', '27/09/2026']);
});

check('Caso C · getActiveDemandOrders filtra estrictamente por fecha de entrega seleccionada', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'CATALUÑA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '26/09/2026', origen: 'PREVISION' });
  state.addOrder({ platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '27/09/2026', origen: 'PREVISION' });

  // Planificar Sábado 26/09/2026
  const sabadoOrders = state.getActiveDemandOrders('26/09/2026');
  assert.strictEqual(sabadoOrders.length, 3);
  const totalSabado = sabadoOrders.reduce((s, o) => s + o.cajas, 0);
  assert.strictEqual(totalSabado, 130, '40 + 30 + 60 = 130 cajas para el sábado');
  assert.ok(!sabadoOrders.some(o => o.platform === 'MURCIA'), 'MURCIA (domingo) NO entra en el sábado');

  // Planificar Domingo 27/09/2026
  const domingoOrders = state.getActiveDemandOrders('27/09/2026');
  assert.strictEqual(domingoOrders.length, 1);
  assert.strictEqual(domingoOrders[0].platform, 'MURCIA');
  assert.strictEqual(domingoOrders[0].cajas, 50);
});

check('Caso C · planLoad genera cargas estrictamente separadas por fecha (sin mezclar camiones)', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'CATALUÑA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '26/09/2026', origen: 'PREVISION' });
  state.addOrder({ platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '27/09/2026', origen: 'PREVISION' });

  // 1. Carga del Sábado
  const stockSabado = { 'PERA_RAMA': 130 };
  const resSabado = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: stockSabado
  });

  assert.strictEqual(resSabado.deliveryDate, '26/09/2026');
  assert.strictEqual(resSabado.targetDeliveryDate, '26/09/2026');
  const platSabado = resSabado.allocations.map(a => a.platform);
  assert.ok(platSabado.includes('CENTRO'));
  assert.ok(platSabado.includes('LEVANTE'));
  assert.ok(platSabado.includes('CATALUÑA'));
  assert.ok(!platSabado.includes('MURCIA'), 'MURCIA no puede estar en la carga del sábado');
  const totalAllocSabado = resSabado.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
  assert.strictEqual(totalAllocSabado, 130);

  // 2. Carga del Domingo
  const stockDomingo = { 'PERA_RAMA': 50 };
  const resDomingo = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('27/09/2026'),
    targetDeliveryDate: '27/09/2026',
    stock: stockDomingo
  });

  assert.strictEqual(resDomingo.deliveryDate, '27/09/2026');
  const platDomingo = resDomingo.allocations.map(a => a.platform);
  assert.deepStrictEqual(platDomingo, ['MURCIA']);
  const totalAllocDomingo = resDomingo.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
  assert.strictEqual(totalAllocDomingo, 50);
});

// =============================================================================
// 5. CASO E: DIVISIÓN DE PEDIDOS E INVARIANTE MATEMÁTICO
// =============================================================================
check('Caso E · splitOrder rechaza división si la suma no coincide exactamente', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });

  // Intentar dividir 40 en 25 + 20 (= 45) -> debe lanzar error
  assert.throws(() => {
    state.splitOrder(parent.id, [
      { platform: 'CENTRO 1', cajas: 25 },
      { platform: 'CENTRO 2', cajas: 20 }
    ]);
  }, /no coincide con las cajas del pedido original/);

  // Intentar dividir con menos de 2 sub-pedidos -> debe lanzar error
  assert.throws(() => {
    state.splitOrder(parent.id, [
      { platform: 'CENTRO 1', cajas: 40 }
    ]);
  }, /al menos 2 sub-pedidos/);
});

check('Caso E · splitOrder divide CENTRO 40 en CENTRO 1 (25) y CENTRO 2 (15) correctamente', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });

  const children = state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  assert.strictEqual(children.length, 2);
  assert.strictEqual(parent.active, false, 'El pedido padre queda inactivo');
  assert.deepStrictEqual(parent.splitChildren, children.map(c => c.id));

  assert.strictEqual(children[0].platform, 'CENTRO 1');
  assert.strictEqual(children[0].cajas, 25);
  assert.strictEqual(children[0].origen, 'DIVIDIDO');
  assert.strictEqual(children[0].parentOrderId, parent.id);
  assert.strictEqual(children[0].active, true);

  assert.strictEqual(children[1].platform, 'CENTRO 2');
  assert.strictEqual(children[1].cajas, 15);
  assert.strictEqual(children[1].origen, 'DIVIDIDO');
  assert.strictEqual(children[1].parentOrderId, parent.id);
  assert.strictEqual(children[1].active, true);

  // En las demandas activas sólo entran CENTRO 1 y CENTRO 2 (no el padre de 40)
  const activeDemands = state.getActiveDemandOrders('26/09/2026');
  assert.strictEqual(activeDemands.length, 2);
  const totalCajas = activeDemands.reduce((s, o) => s + o.cajas, 0);
  assert.strictEqual(totalCajas, 40);
});

check('Caso E · Los sub-pedidos divididos generan entidades logísticas independientes en el plan', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });
  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const activeOrders = state.getActiveDemandOrders('26/09/2026');
  const plan = orchestrator.planLoad({
    demandOrders: activeOrders,
    targetDeliveryDate: '26/09/2026',
    stock: { 'PERA_RAMA': 40 }
  });

  const platNames = plan.allocations.map(a => a.platform);
  assert.ok(platNames.includes('CENTRO 1'), 'CENTRO 1 aparece como plataforma independiente');
  assert.ok(platNames.includes('CENTRO 2'), 'CENTRO 2 aparece como plataforma independiente');
  assert.ok(!platNames.includes('CENTRO'), 'El CENTRO padre no figura como plataforma activa');

  // Cada sub-plataforma tiene sus propios palets y torres calculados
  const c1Pallets = plan.palletSummaries.groups.filter(g => g.platform === 'CENTRO 1');
  const c2Pallets = plan.palletSummaries.groups.filter(g => g.platform === 'CENTRO 2');
  assert.ok(c1Pallets.length > 0);
  assert.ok(c2Pallets.length > 0);
  assert.strictEqual(c1Pallets[0].totalBoxes, 25);
  assert.strictEqual(c2Pallets[0].totalBoxes, 15);
});

check('Caso E · unsplitOrder restaura el pedido padre y elimina los sub-pedidos', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 40,
    fechaEntrega: '26/09/2026'
  });
  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  // Deshacer división
  const ok = state.unsplitOrder(parent.id);
  assert.strictEqual(ok, true);
  assert.strictEqual(parent.active, true, 'El padre vuelve a estar activo');
  assert.strictEqual(parent.splitChildren, null);

  const activeDemands = state.getActiveDemandOrders('26/09/2026');
  assert.strictEqual(activeDemands.length, 1);
  assert.strictEqual(activeDemands[0].platform, 'CENTRO');
  assert.strictEqual(activeDemands[0].cajas, 40);
});

// =============================================================================
// 6. CASO F: SALIDAS OPERATIVAS CON FECHA Y DÍA PROMINENTES
// =============================================================================
check('Caso F · WhatsApp incluye cabecera prominente con día de la semana y fecha', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { 'PERA_RAMA': 40 }
  });

  const wa = formatWhatsAppMessage(plan);
  assert.ok(wa.includes('ENTREGA: SÁBADO 26/09/2026'), 'WhatsApp debe destacar el día y la fecha de entrega');
  assert.ok(wa.includes('CENTRO'), 'WhatsApp incluye la plataforma');
  assert.ok(wa.includes('40 cajas'), 'WhatsApp incluye el total de cajas');
});

check('Caso F · WhatsApp y salidas reflejan los sub-pedidos divididos (CENTRO 1 y CENTRO 2)', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });
  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { 'PERA_RAMA': 40 }
  });

  const wa = formatWhatsAppMessage(plan);
  assert.ok(wa.includes('CENTRO 1'), 'WhatsApp muestra CENTRO 1');
  assert.ok(wa.includes('CENTRO 2'), 'WhatsApp muestra CENTRO 2');
  assert.ok(!wa.includes('CENTRO —'), 'WhatsApp no muestra CENTRO sin dividir');
});

// =============================================================================
// 7. CASO G: PARIDAD DESKTOP Y MOBILE
// =============================================================================
check('Caso G · Desktop y Mobile consumen el mismo modelo de AppState y PlanningResult', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026' });

  const controller = new UIController(state);
  const activeOrders = state.getActiveDemandOrders('26/09/2026');

  const plan = orchestrator.planLoad({
    demandOrders: activeOrders,
    targetDeliveryDate: '26/09/2026',
    stock: { 'PERA_RAMA': 70 }
  });

  state.planningResult = plan;

  // Derivar modelo de presentación
  const model = UIController.buildTruckSlotsModel(plan);
  assert.strictEqual(model.totalTruckSlots, 2);
  assert.strictEqual(model.totalBoxes, 70);
  assert.strictEqual(model.slots.length, 2);

  // Verificar que getAvailableDeliveryDates y getDayOfWeekName son compartidos
  assert.deepStrictEqual(state.getAvailableDeliveryDates(), ['26/09/2026']);
  assert.strictEqual(UIController.getDayOfWeekName('26/09/2026'), 'SÁBADO');
});

// =============================================================================
// 8. CASO H: REDISEÑO PREVISIÓN CONSOLIDADA DESKTOP (V4)
// =============================================================================
check('Caso H1 · getBasePlatform resuelve plataformas base, sufijos numéricos y enlaces de división', () => {
  const allOrders = [
    { id: 'O1', platform: 'CENTRO', cajas: 40 },
    { id: 'O2', platform: 'CENTRO 1', parentOrderId: 'O1', cajas: 25 },
    { id: 'O3', platform: 'CENTRO 2', parentOrderId: 'O1', cajas: 15 },
    { id: 'O4', platform: 'LEVANTE 1', cajas: 10 },
    { id: 'O5', platform: 'MALAGA', cajas: 20 }
  ];

  assert.strictEqual(getBasePlatform(allOrders[0], allOrders), 'CENTRO');
  assert.strictEqual(getBasePlatform(allOrders[1], allOrders), 'CENTRO');
  assert.strictEqual(getBasePlatform(allOrders[2], allOrders), 'CENTRO');
  assert.strictEqual(getBasePlatform(allOrders[3], allOrders), 'LEVANTE');
  assert.strictEqual(getBasePlatform(allOrders[4], allOrders), 'MALAGA');
});

check('Caso H2 · getProductVarietyDisplay formatea sobrio y sin iconos de pera', () => {
  const dPera = getProductVarietyDisplay('PERA_RAMA', null);
  assert.strictEqual(dPera.fullLabel, 'PERA');
  assert.strictEqual(dPera.pillLabel, 'PERA');

  const dCocktail = getProductVarietyDisplay('COCKTAIL_ROMANTICO', null);
  assert.strictEqual(dCocktail.fullLabel, 'COCKTAIL');
  assert.strictEqual(dCocktail.pillLabel, 'COCKTAIL');

  const dCherrySun = getProductVarietyDisplay('CHERRY_RAMA', 'SUNSTREAM');
  assert.strictEqual(dCherrySun.fullLabel, 'CHERRY · SUNSTREAM');
  assert.strictEqual(dCherrySun.pillLabel, 'SUNSTREAM');

  const dCocktailConsabor = getProductVarietyDisplay('COCKTAIL_ROMANTICO', 'CONSABOR');
  assert.strictEqual(dCocktailConsabor.fullLabel, 'COCKTAIL · CONSABOR');
  assert.strictEqual(dCocktailConsabor.pillLabel, 'CONSABOR');
});

check('Caso H3 · Rediseño Desktop: Nivel 1 muestra plataformas con total de cajas y resumen de productos', () => {
  const state = new AppState();
  // CENTRO (138 cajas): PERA 68, COCKTAIL 50, SUNSTREAM 20
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 68, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'COCKTAIL_ROMANTICO', cajas: 50, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'CHERRY_RAMA', varietyId: 'SUNSTREAM', cajas: 20, fechaEntrega: '26/09/2026' });

  // LEVANTE (54 cajas): PERA 37, COCKTAIL 12, SUNSTREAM 5
  state.addAdvanceOrder({ platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 37, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'LEVANTE', productId: 'COCKTAIL_ROMANTICO', cajas: 12, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'LEVANTE', productId: 'CHERRY_RAMA', varietyId: 'SUNSTREAM', cajas: 5, fechaEntrega: '26/09/2026' });

  // MÁLAGA (23 cajas): PERA 10, COCKTAIL 13
  state.addAdvanceOrder({ platform: 'MALAGA', productId: 'PERA_RAMA', cajas: 10, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'MALAGA', productId: 'COCKTAIL_ROMANTICO', cajas: 13, fechaEntrega: '26/09/2026' });

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.renderConsolidatedForecast();

  const badge = doc.getElementById('consolidated-count-badge');
  assert.strictEqual(badge.textContent, '8 pedidos activos');

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  // Comprobar tarjetas Nivel 1 y totales de cajas
  assert.ok(serialized.includes('CENTRO'), 'Muestra CENTRO');
  assert.ok(serialized.includes('138 cajas'), 'Total CENTRO 138 cajas');
  assert.ok(serialized.includes('LEVANTE'), 'Muestra LEVANTE');
  assert.ok(serialized.includes('54 cajas'), 'Total LEVANTE 54 cajas');
  assert.ok(serialized.includes('MALAGA'), 'Muestra MALAGA');
  assert.ok(serialized.includes('23 cajas'), 'Total MALAGA 23 cajas');

  // Comprobar pills de productos
  assert.ok(serialized.includes('PERA') && serialized.includes('68'), 'CENTRO tiene PERA 68');
  assert.ok(serialized.includes('COCKTAIL') && serialized.includes('50'), 'CENTRO tiene COCKTAIL 50');
  assert.ok(serialized.includes('SUNSTREAM') && serialized.includes('20'), 'CENTRO tiene SUNSTREAM 20');

  // En estado cerrado NO muestra el detalle de pedidos individuales
  assert.ok(!serialized.includes('platform-detail-body'), 'No muestra detalle de pedidos cuando está cerrado');
  assert.ok(serialized.includes('Ver detalle'), 'Muestra botón "Ver detalle"');
});

check('Caso H4 · Estado abierto (toggle) despliega el detalle por Producto/Variedad y pedidos individuales', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 68, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'COCKTAIL_ROMANTICO', cajas: 50, fechaEntrega: '26/09/2026' });
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'CHERRY_RAMA', varietyId: 'SUNSTREAM', cajas: 20, fechaEntrega: '26/09/2026' });

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  assert.strictEqual(controller.isPlatformExpanded('CENTRO'), false);

  // Abrir detalle de CENTRO
  controller.togglePlatformDetail('CENTRO');
  assert.strictEqual(controller.isPlatformExpanded('CENTRO'), true);

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serializedOpen = doc.serialize(listEl);

  // Nivel 2: Agrupación por producto/variedad
  assert.ok(serializedOpen.includes('platform-detail-body'), 'Muestra cuerpo de detalle');
  assert.ok(serializedOpen.includes('PERA') && serializedOpen.includes('68 cajas'), 'Nivel 2 PERA 68 cajas');
  assert.ok(serializedOpen.includes('COCKTAIL') && serializedOpen.includes('50 cajas'), 'Nivel 2 COCKTAIL 50 cajas');
  assert.ok(serializedOpen.includes('CHERRY · SUNSTREAM') && serializedOpen.includes('20 cajas'), 'Nivel 2 CHERRY · SUNSTREAM 20 cajas');

  // Nivel 3 y 4: Pedidos y acciones
  assert.ok(serializedOpen.includes('✂ Dividir'), 'Acción dividir disponible');
  assert.ok(serializedOpen.includes('Ocultar detalle'), 'Botón ocultar detalle disponible');

  // Cerrar detalle
  controller.togglePlatformDetail('CENTRO');
  assert.strictEqual(controller.isPlatformExpanded('CENTRO'), false);
  const serializedClosed = doc.serialize(listEl);
  assert.ok(!serializedClosed.includes('platform-detail-body'), 'Detalle se oculta al volver a pulsar');
});

check('Caso H5 · Pedido dividido (CENTRO 40 -> CENTRO 1 25 + CENTRO 2 15) aparece bajo la misma plataforma y se revierte', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });

  // Dividir pedido
  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.expandPlatform('CENTRO');

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  // Plataforma CENTRO agrupa a los sub-pedidos
  assert.ok(serialized.includes('CENTRO'), 'Tarjeta plataforma es CENTRO');
  assert.ok(serialized.includes('40 cajas'), 'Total activo sigue siendo 40 cajas (25 + 15)');
  assert.ok(serialized.includes('CENTRO 1') && serialized.includes('25'), 'Sub-pedido CENTRO 1 presente');
  assert.ok(serialized.includes('CENTRO 2') && serialized.includes('15'), 'Sub-pedido CENTRO 2 presente');
  assert.ok(serialized.includes('DIVIDIDO'), 'Badge DIVIDIDO presente');
  assert.ok(serialized.includes('↩ Deshacer división'), 'Botón para revertir división presente');

  // Deshacer división
  state.unsplitOrder(parent.id);
  assert.strictEqual(parent.active, true);
  assert.strictEqual(state.orders.length, 1);

  controller.renderConsolidatedForecast();
  const serializedRestored = doc.serialize(listEl);
  assert.ok(!serializedRestored.includes('CENTRO 1'), 'CENTRO 1 eliminado tras unsplit');
  assert.ok(!serializedRestored.includes('CENTRO 2'), 'CENTRO 2 eliminado tras unsplit');
  assert.ok(serializedRestored.includes('CENTRO') && serializedRestored.includes('40'), 'CENTRO 40 cajas restaurado');
});

// =============================================================================
// FASE 1A · VALIDACIÓN AUTOMATIZADA UX DESKTOP Y DESIGN SYSTEM (REQUISITOS 1 - 12)
// =============================================================================

check('Fase 1A · 1. Tarjeta de plataforma con DEMANDA / SERVIDO / PENDIENTE', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '26/09/2026';
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 138, fechaEntrega: '26/09/2026' });

  // Simular PlanningResult existente con 110 cajas servidas y 28 pendientes
  state.planState = 'PLAN_ACTUALIZADO';
  state.planningResult = {
    selectedDeliveryDate: '26/09/2026',
    allocations: [
      { platform: 'CENTRO', productId: 'PERA_RAMA', requestedQuantity: 138, allocatedQuantity: 110, missingQuantity: 28 }
    ]
  };

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.renderConsolidatedForecast();

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  assert.ok(serialized.includes('platform-demanda-val') && serialized.includes('138'), 'Demanda refleja 138');
  assert.ok(serialized.includes('platform-servido-val') && serialized.includes('110'), 'Servido refleja 110');
  assert.ok(serialized.includes('platform-pendiente-val') && serialized.includes('28'), 'Pendiente refleja 28');
  assert.ok(serialized.includes('79.7% servido'), 'Porcentaje de servicio 79.7% calculado correctamente');
});

check('Fase 1A · 2. Estado sin PlanningResult (muestra pendientes de generar en lugar de inventar)', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '26/09/2026';
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 138, fechaEntrega: '26/09/2026' });
  state.planningResult = null;
  state.planState = 'NO_PLAN';

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.renderConsolidatedForecast();

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  assert.ok(serialized.includes('platform-demanda-val') && serialized.includes('138'), 'Demanda refleja 138');
  assert.ok(serialized.includes('platform-servido-val') && serialized.includes('—'), 'Servido es guion cuando no hay plan');
  assert.ok(serialized.includes('platform-pendiente-val') && serialized.includes('—'), 'Pendiente es guion cuando no hay plan');
  assert.ok(serialized.includes('Plan pendiente de generar'), 'Indica claramente que el plan está pendiente de generar');
});

check('Fase 1A · 3. Pedido ANTICIPADO integrado en la plataforma correspondiente', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '28/09/2026';
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '28/09/2026' });

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.expandPlatform('CENTRO');

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  assert.ok(serialized.includes('CENTRO'), 'Plataforma es CENTRO');
  assert.ok(serialized.includes('badge-origin-anticipado'), 'Posee badge de pedido anticipado');
  assert.ok(serialized.includes('ANTICIPADO'), 'Texto ANTICIPADO visible en el detalle');
});

check('Fase 1A · 4. ANTICIPADO + PREVISIÓN de misma fecha suman en la misma tarjeta', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '28/09/2026';

  // 1. Previsión oficial: CENTRO — PERA — 40 cajas
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '28/09/2026', origen: 'PREVISION' });

  // 2. Pedido anticipado: CENTRO — PERA — 15 cajas
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 15, fechaEntrega: '28/09/2026' });

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.expandPlatform('CENTRO');

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  // Tarjeta principal debe representar CENTRO = 55 cajas (no un cajón separado)
  assert.ok(serialized.includes('55 cajas'), 'La plataforma muestra la suma consolidada de 55 cajas');
  assert.ok(serialized.includes('PERA') && serialized.includes('55'), 'El producto PERA muestra 55 cajas');
  assert.ok(serialized.includes('ANTICIPADO') && serialized.includes('15'), 'Muestra línea de anticipado 15 cjs');
  assert.ok(serialized.includes('PREVISIÓN') && serialized.includes('40'), 'Muestra línea de previsión 40 cjs');
});

check('Fase 1A · 5. División CENTRO → CENTRO 1 + CENTRO 2 bajo la misma plataforma base', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '28/09/2026';
  const parent = state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '28/09/2026', origen: 'PREVISION' });

  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.expandPlatform('CENTRO');

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  assert.ok(serialized.includes('CENTRO 1') && serialized.includes('25'), 'Sub-pedido CENTRO 1 con 25 cjs');
  assert.ok(serialized.includes('CENTRO 2') && serialized.includes('15'), 'Sub-pedido CENTRO 2 con 15 cjs');
  assert.ok(serialized.includes('DIVIDIDO'), 'Ambos rotulados como DIVIDIDO');
});

check('Fase 1A · 6. Suma de cajas correcta (conservación de masa en plataforma)', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '28/09/2026';
  const parent = state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '28/09/2026' });

  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const activeOrders = state.getActiveDemandOrders('28/09/2026');
  const totalCajas = activeOrders.reduce((sum, o) => sum + o.cajas, 0);
  assert.strictEqual(totalCajas, 40, 'La suma de las cajas activas sigue siendo exactamente 40');
});

check('Fase 1A · 7. Light completo: Tokens CSS definidos exhaustivamente', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const lightBlock = indexHtml.match(/html\[data-theme="light"\]\s*\{([^}]+)\}/);
  assert.ok(lightBlock, 'Bloque html[data-theme="light"] existe');

  const css = lightBlock[1];
  const requiredTokens = [
    '--clr-bg',
    '--clr-surface',
    '--clr-card',
    '--clr-card-elevated',
    '--clr-border',
    '--clr-border-strong',
    '--clr-text-primary',
    '--clr-text-secondary',
    '--clr-text-muted',
    '--clr-accent',
    '--clr-success',
    '--clr-warning',
    '--clr-danger'
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `Token ${token} está definido en Light`);
  }
});

check('Fase 1A · 8. Dark completo: Tokens CSS definidos exhaustivamente', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const darkBlock = indexHtml.match(/html\[data-theme="dark"\]\s*\{([^}]+)\}/);
  assert.ok(darkBlock, 'Bloque html[data-theme="dark"] existe');

  const css = darkBlock[1];
  const requiredTokens = [
    '--clr-bg',
    '--clr-surface',
    '--clr-card',
    '--clr-card-elevated',
    '--clr-border',
    '--clr-border-strong',
    '--clr-text-primary',
    '--clr-text-secondary',
    '--clr-text-muted',
    '--clr-accent',
    '--clr-success',
    '--clr-warning',
    '--clr-danger'
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `Token ${token} está definido en Dark`);
  }
});

check('Fase 1A · 9. Cambio Light → Dark mediante UIController.toggleTheme()', () => {
  const doc = createDocument('<button id="btn-theme-toggle"></button>');
  doc.documentElement.setAttribute('data-theme', 'light');
  global.document = doc;

  const controller = new UIController();
  controller.toggleTheme();

  assert.strictEqual(doc.documentElement.getAttribute('data-theme'), 'dark');
  const btn = doc.getElementById('btn-theme-toggle');
  assert.strictEqual(btn.textContent, '☀️', 'Botón muestra sol para volver a claro');
});

check('Fase 1A · 10. Cambio Dark → Light mediante UIController.toggleTheme()', () => {
  const doc = createDocument('<button id="btn-theme-toggle"></button>');
  doc.documentElement.setAttribute('data-theme', 'dark');
  global.document = doc;

  const controller = new UIController();
  controller.toggleTheme();

  assert.strictEqual(doc.documentElement.getAttribute('data-theme'), 'light');
  const btn = doc.getElementById('btn-theme-toggle');
  assert.strictEqual(btn.textContent, '🌙', 'Botón muestra luna para volver a oscuro');
});

check('Fase 1A · 11. Ausencia de clases/colores huérfanos que produzcan fondos inconsistentes en Previsión', () => {
  const state = new AppState();
  state.selectedDeliveryDate = '26/09/2026';
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });

  const bodyHtml = `
    <div id="consolidated-forecast-container">
      <span id="consolidated-count-badge"></span>
      <div id="delivery-date-selector-container"></div>
      <div id="consolidated-platforms-list"></div>
    </div>
  `;
  const doc = createDocument(bodyHtml);
  global.document = doc;

  const controller = new UIController(state);
  controller.expandPlatform('CENTRO');

  const listEl = doc.getElementById('consolidated-platforms-list');
  const serialized = doc.serialize(listEl);

  // No debe contener clases oscuras huérfanas sin mapeo como bg-[#0E1013] o bg-[#1C1F25]
  assert.ok(!serialized.includes('bg-[#0E1013]'), 'No contiene bg-[#0E1013]');
  assert.ok(!serialized.includes('bg-[#1C1F25]'), 'No contiene bg-[#1C1F25]');
  assert.ok(!serialized.includes('border-[#2E323B]'), 'No contiene border-[#2E323B]');
  assert.ok(serialized.includes('bg-card'), 'Usa clase semántica bg-card');
  assert.ok(serialized.includes('border-app'), 'Usa clase semántica border-app');
});

check('Fase 1A · 12. Desktop no modifica Mobile (elementos del shell móvil intactos)', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  // Elementos obligatorios del shell móvil
  assert.ok(indexHtml.includes('id="mobile-workflow-bar"'), 'mobile-workflow-bar presente');
  assert.ok(indexHtml.includes('id="mobile-kpi-summary"'), 'mobile-kpi-summary presente');
  assert.ok(indexHtml.includes('id="mobile-tabbar"'), 'mobile-tabbar presente');
  assert.ok(indexHtml.includes('id="platform-detail-modal"'), 'platform-detail-modal presente');
  assert.ok(indexHtml.includes('id="mobile-more-section"'), 'mobile-more-section presente');
  assert.ok(indexHtml.includes('src/mobile.css'), 'src/mobile.css importado');
});

// =============================================================================
// 9. CASO I: TRAZABILIDAD DE PROCEDENCIA EN PLAN DE CARGA (V4)
// =============================================================================
check('Caso I1 · Demanda 100% ANTICIPADO genera badge ANTICIPADO en Plan y WhatsApp', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '26/09/2026' });

  const prov = derivePlatformProvenance('CENTRO', state.orders);
  assert.strictEqual(prov.state, 'ANTICIPADO');
  assert.deepStrictEqual(prov.badges, ['ANTICIPADO']);

  state.setStockItem('PERA_RAMA', 76);
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 76 }
  });

  const wa = formatWhatsAppMessage(plan, state.orders);
  assert.ok(wa.includes('CENTRO [ANTICIPADO]'), 'WhatsApp incluye badge [ANTICIPADO]');

  // En tarjeta DOM
  const doc = createDocument(`
    <div id="platform-plan-cards-container"></div>
  `);
  global.document = doc;
  const controller = new UIController(state);
  controller.bindDOM(doc);
  controller.renderPlatformPlan(plan);

  const container = doc.getElementById('platform-plan-cards-container');
  const cardHtml = doc.serialize(container);
  assert.ok(cardHtml.includes('card-badge-anticipado'), 'Tarjeta incluye clase card-badge-anticipado');
  assert.ok(cardHtml.includes('ANTICIPADO'), 'Tarjeta muestra texto ANTICIPADO');
});

check('Caso I2 · Carga MIXTA (25 ANTICIPADO + 30 PREVISIÓN = 55) genera badge MIXTO y desglose sin inventar reparto servido', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026', origen: 'PREVISION' });

  const prov = derivePlatformProvenance('CENTRO', state.orders);
  assert.strictEqual(prov.state, 'MIXTO');
  assert.deepStrictEqual(prov.badges, ['MIXTO']);
  assert.strictEqual(prov.anticipadoBoxes, 25);
  assert.strictEqual(prov.previsionBoxes, 30);
  assert.ok(prov.detailText.includes('25 ANTICIPADO'));
  assert.ok(prov.detailText.includes('30 PREVISIÓN'));

  // Plan con stock completo (55 servidas)
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 76 }
  });

  const wa = formatWhatsAppMessage(plan, state.orders);
  assert.ok(wa.includes('CENTRO [MIXTO]'), 'WhatsApp incluye [MIXTO]');
  assert.ok(wa.includes('25 ANTICIPADO · 30 PREVISIÓN'), 'WhatsApp incluye desglose de demanda');

  const doc = createDocument('<div id="platform-plan-cards-container"></div>');
  global.document = doc;
  const controller = new UIController(state);
  controller.bindDOM(doc);
  controller.renderPlatformPlan(plan);

  const cardHtml = doc.serialize(doc.getElementById('platform-plan-cards-container'));
  assert.ok(cardHtml.includes('card-badge-mixto'), 'Tarjeta incluye clase card-badge-mixto');
  assert.ok(cardHtml.includes('25 ANTICIPADO · 30 PREVISIÓN'), 'Tarjeta muestra desglose de demanda');
});

check('Caso I3 · Carga MIXTA con DÉFICIT muestra demanda, servido/pendiente global y NO atribuye el servido a una fuente', () => {
  const state = new AppState();
  state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '26/09/2026' });
  state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '26/09/2026', origen: 'PREVISION' });

  // Stock limitado a 40 cajas (demanda 55, faltan 15)
  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 40 }
  });

  const doc = createDocument('<div id="platform-plan-cards-container"></div>');
  global.document = doc;
  const controller = new UIController(state);
  controller.bindDOM(doc);
  controller.renderPlatformPlan(plan);

  const cardHtml = doc.serialize(doc.getElementById('platform-plan-cards-container'));
  // Debe mostrar demanda 55, servido 40, pendiente 15
  assert.ok(cardHtml.includes('55'), 'Muestra demanda total 55');
  assert.ok(cardHtml.includes('40'), 'Muestra servido 40');
  assert.ok(cardHtml.includes('15'), 'Muestra pendiente 15');
  assert.ok(cardHtml.includes('25 ANTICIPADO · 30 PREVISIÓN'), 'Muestra procedencia de la demanda');
  // NO debe inventar un reparto servido tipo "25 ANTICIPADO servido" o "15 PREVISION servido"
  assert.ok(!cardHtml.includes('ANTICIPADO servido'), 'No atribuye servido a anticipado');
  assert.ok(!cardHtml.includes('PREVISIÓN servido'), 'No atribuye servido a previsión');
});

check('Caso I4 · Subpedido dividido de PREVISIÓN muestra [ DIVIDIDO ] y enlace a padre', () => {
  const state = new AppState();
  const parent = state.addOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026', origen: 'PREVISION' });
  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const prov1 = derivePlatformProvenance('CENTRO 1', state.orders);
  assert.strictEqual(prov1.state, 'DIVIDIDO');
  assert.deepStrictEqual(prov1.badges, ['DIVIDIDO']);
  assert.strictEqual(prov1.basePlatform, 'CENTRO');

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 76 }
  });

  const wa = formatWhatsAppMessage(plan, state.orders);
  assert.ok(wa.includes('CENTRO 1 [DIVIDIDO]'), 'WhatsApp incluye CENTRO 1 [DIVIDIDO]');
  assert.ok(wa.includes('↳ Subpedido de CENTRO'), 'WhatsApp incluye enlace a subpedido');

  const doc = createDocument('<div id="platform-plan-cards-container"></div>');
  global.document = doc;
  const controller = new UIController(state);
  controller.bindDOM(doc);
  controller.renderPlatformPlan(plan);

  const cardHtml = doc.serialize(doc.getElementById('platform-plan-cards-container'));
  assert.ok(cardHtml.includes('card-badge-dividido'), 'Tarjeta contiene card-badge-dividido');
  assert.ok(cardHtml.includes('↳ Subpedido de CENTRO'), 'Tarjeta contiene enlace a padre');
});

check('Caso I5 · Subpedido dividido de ANTICIPADO muestra [ DIVIDIDO ] [ ANTICIPADO ]', () => {
  const state = new AppState();
  const parent = state.addAdvanceOrder({ platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' });
  state.splitOrder(parent.id, [
    { platform: 'CENTRO 1', cajas: 25 },
    { platform: 'CENTRO 2', cajas: 15 }
  ]);

  const prov1 = derivePlatformProvenance('CENTRO 1', state.orders);
  assert.strictEqual(prov1.state, 'DIVIDIDO_ANTICIPADO');
  assert.deepStrictEqual(prov1.badges, ['DIVIDIDO', 'ANTICIPADO']);
  assert.strictEqual(prov1.basePlatform, 'CENTRO');

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 76 }
  });

  const wa = formatWhatsAppMessage(plan, state.orders);
  assert.ok(wa.includes('CENTRO 1 [DIVIDIDO] [ANTICIPADO]'), 'WhatsApp incluye CENTRO 1 [DIVIDIDO] [ANTICIPADO]');

  const doc = createDocument('<div id="platform-plan-cards-container"></div>');
  global.document = doc;
  const controller = new UIController(state);
  controller.bindDOM(doc);
  controller.renderPlatformPlan(plan);

  const cardHtml = doc.serialize(doc.getElementById('platform-plan-cards-container'));
  assert.ok(cardHtml.includes('card-badge-dividido'), 'Tarjeta contiene card-badge-dividido');
  assert.ok(cardHtml.includes('card-badge-anticipado'), 'Tarjeta contiene card-badge-anticipado');
});

check('Caso I6 · Carga 100% PREVISIÓN muestra [ PREVISIÓN ]', () => {
  const state = new AppState();
  state.addOrder({ platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 37, fechaEntrega: '26/09/2026', origen: 'PREVISION' });

  const prov = derivePlatformProvenance('LEVANTE', state.orders);
  assert.strictEqual(prov.state, 'PREVISIÓN');
  assert.deepStrictEqual(prov.badges, ['PREVISIÓN']);

  const plan = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { PERA_RAMA: 76 }
  });

  const wa = formatWhatsAppMessage(plan, state.orders);
  assert.ok(wa.includes('LEVANTE [PREVISIÓN]'), 'WhatsApp incluye LEVANTE [PREVISIÓN]');
});

console.log(`\n${passedChecks}/${totalChecks} comprobaciones superadas\n`);
if (passedChecks !== totalChecks) {
  process.exit(1);
}

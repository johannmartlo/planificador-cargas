'use strict';

/**
 * PLANIFICADOR DE CARGAS V4.6 — TDD DEL REPARTO GLOBAL MULTIFECHA
 * SUITE DE TESTS: CONTRATO FUNCIONAL Y VALIDACIÓN DEL ORQUESTADOR
 *
 * Principios arquitectónicos de V4.6:
 *  1. Un único pool global de asistencias / stock físico de almacén.
 *  2. Una única ejecución del reparto para todas las fechas de entrega.
 *  3. La unidad de asignación es el PEDIDO INDIVIDUAL (orderId unívoco).
 *  4. La fecha de entrega, plataforma, producto y variedad son atributos del pedido.
 *  5. Posterior agrupación de asignaciones por fecha para planes de carga físicos.
 *  6. Conmutar fecha en UI no vuelve a ejecutar el reparto de existencias.
 *  7. Conservación estricta: suma(servidos) <= stock global; suma(servidos + pendientes) = demanda.
 *  8. Compatibilidad total con la línea base de V4.5 (monofecha).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'src');
const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const parser = require(path.join(SRC, 'parser.js'));
const catalog = require(path.join(SRC, 'catalog.js'));
const hamilton = require(path.join(SRC, 'hamilton.js'));
const cocktailSolver = require(path.join(SRC, 'cocktail-solver.js'));
const ui = require(path.join(SRC, 'ui.js'));

const { AppState, UIController } = ui;
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

let totalChecks = 0;
let passedChecks = 0;
let flawsConfirmed = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  PASS  ${title}`);
  } catch (err) {
    console.error(`  FAIL  ${title}`);
    console.error(`        ${err.message}`);
    throw err;
  }
}

function checkBugReproduction(title, fn) {
  totalChecks++;
  try {
    fn();
    flawsConfirmed++;
    passedChecks++;
    console.log(`  PASS [FALLO V4.5 CONFIRMADO] ${title}`);
  } catch (err) {
    console.error(`  FAIL [FALLO NO REPRODUCIDO] ${title}`);
    console.error(`        ${err.message}`);
    throw err;
  }
}

console.log('\n=== PLANIFICADOR V4.6 · REPARTO GLOBAL MULTIFECHA (TDD) ===\n');

// =============================================================================
// CASO 1 — MONOFECHA / COMPATIBILIDAD V4.5
// =============================================================================
console.log('--- CASO 1: MONOFECHA / COMPATIBILIDAD V4.5 ---');

check('Caso 1.1 · Con 1 sola fecha, el reparto asigna 80 servidas y 20 pendientes de 100 pedidas', () => {
  const state = new AppState();
  const orderA = state.addOrder({
    id: 'ORD-A',
    platform: 'CENTRO',
    productId: 'PERA_RAMA',
    cajas: 100,
    fechaEntrega: '26/09/2026',
    origen: 'PREVISION'
  });

  const stock = { 'PERA_RAMA': 80 };

  const result = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock
  });

  assert.strictEqual(result.deliveryDate, '26/09/2026');
  assert.strictEqual(result.allocations.length, 1);
  const alloc = result.allocations[0];
  assert.strictEqual(alloc.platform, 'CENTRO');
  assert.strictEqual(alloc.orderId, 'ORD-A');
  assert.strictEqual(alloc.requestedQuantity, 100);
  assert.strictEqual(alloc.allocatedQuantity, 80);
  assert.strictEqual(alloc.missingQuantity, 20);

  // Stock remanente
  const peraRem = result.stockRemaining.find(s => s.productId === 'PERA_RAMA');
  assert.ok(peraRem, 'Debe existir reporte de stock remanente');
  assert.strictEqual(peraRem.available, 80);
  assert.strictEqual(peraRem.used, 80);
  assert.strictEqual(peraRem.remaining, 0);

  // Dimensiones V4.6
  assert.ok(Array.isArray(result.globalAllocation));
  assert.ok(typeof result.plansByDate === 'object');
  assert.ok(result.plansByDate['26/09/2026']);
});

// =============================================================================
// CASO 2 — DOS FECHAS / MISMO ARTÍCULO
// =============================================================================
console.log('\n--- CASO 2: DOS FECHAS / MISMO ARTÍCULO ---');

checkBugReproduction('Caso 2.1 · Reproducción del fallo V4.5 si el llamador filtra por fecha antes de planificar', () => {
  // Si un llamador externo comete el error de V4.5 de filtrar previamente por fecha:
  const state = new AppState();
  state.setStockItem('PERA_RAMA', 120);

  state.addOrder({ id: 'ORD-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' });
  state.addOrder({ id: 'ORD-B', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' });

  // Planificar Sábado aisladamente con todo el stock
  const resSabado = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('26/09/2026'),
    targetDeliveryDate: '26/09/2026',
    stock: { ...state.stock }
  });
  const servidoSabado = resSabado.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);

  // Planificar Domingo aisladamente con todo el stock
  const resDomingo = orchestrator.planLoad({
    demandOrders: state.getActiveDemandOrders('27/09/2026'),
    targetDeliveryDate: '27/09/2026',
    stock: { ...state.stock }
  });
  const servidoDomingo = resDomingo.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);

  // Demostración del fallo si se filtra previamente:
  assert.strictEqual(servidoSabado, 100);
  assert.strictEqual(servidoDomingo, 60);
  assert.strictEqual(servidoSabado + servidoDomingo, 160);
});

check('Caso 2.2 · Contrato V4.6 en planLoad: Un único pool de 120 cjs reparte proporcionalmente 75 y 45 cjs', () => {
  const orders = [
    { id: 'ORD-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-B', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 120 }
  });

  // Reparto global unificado
  assert.strictEqual(res.globalAllocation.length, 2);
  const allocA = res.globalAllocation.find(a => a.orderId === 'ORD-A');
  const allocB = res.globalAllocation.find(a => a.orderId === 'ORD-B');

  assert.strictEqual(allocA.allocatedQuantity, 75);
  assert.strictEqual(allocA.missingQuantity, 25);
  assert.strictEqual(allocB.allocatedQuantity, 45);
  assert.strictEqual(allocB.missingQuantity, 15);

  const totalServido = allocA.allocatedQuantity + allocB.allocatedQuantity;
  assert.strictEqual(totalServido, 120, 'Stock global exactamente consumido');

  // Stock remanente
  const rem = res.stockRemaining.find(s => s.productId === 'PERA_RAMA');
  assert.strictEqual(rem.used, 120);
  assert.strictEqual(rem.remaining, 0);

  // Planes por fecha generados
  assert.ok(res.plansByDate['26/09/2026']);
  assert.ok(res.plansByDate['27/09/2026']);
  assert.strictEqual(res.plansByDate['26/09/2026'].totalBoxes, 75);
  assert.strictEqual(res.plansByDate['27/09/2026'].totalBoxes, 45);
});

// =============================================================================
// CASO 3 — TRES FECHAS
// =============================================================================
console.log('\n--- CASO 3: TRES FECHAS ---');

check('Caso 3.1 · Contrato V4.6 en planLoad: Tres fechas (100 + 60 + 40 = 200 cjs) con 150 de stock sirven 75, 45 y 30 cjs', () => {
  const orders = [
    { id: 'ORD-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-B', platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' },
    { id: 'ORD-C', platform: 'SUR', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '28/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 150 }
  });

  assert.strictEqual(res.globalAllocation.length, 3);
  const allocA = res.globalAllocation.find(a => a.orderId === 'ORD-A');
  const allocB = res.globalAllocation.find(a => a.orderId === 'ORD-B');
  const allocC = res.globalAllocation.find(a => a.orderId === 'ORD-C');

  assert.strictEqual(allocA.allocatedQuantity, 75);
  assert.strictEqual(allocB.allocatedQuantity, 45);
  assert.strictEqual(allocC.allocatedQuantity, 30);

  const totalServido = allocA.allocatedQuantity + allocB.allocatedQuantity + allocC.allocatedQuantity;
  assert.strictEqual(totalServido, 150, 'Suma total servida exactamente 150');

  // Tres fechas segregadas
  assert.strictEqual(res.plansByDate['26/09/2026'].totalBoxes, 75);
  assert.strictEqual(res.plansByDate['27/09/2026'].totalBoxes, 45);
  assert.strictEqual(res.plansByDate['28/09/2026'].totalBoxes, 30);
});

// =============================================================================
// CASO 4 — PEDIDOS DEL MISMO ARTÍCULO Y MISMA PLATAFORMA (MISMA FECHA)
// =============================================================================
console.log('\n--- CASO 4: PEDIDOS DEL MISMO ARTÍCULO Y MISMA PLATAFORMA ---');

check('Caso 4.1 · planLoad conserva orderId y genera asignaciones independientes para la misma plataforma', () => {
  const orders = [
    { id: 'ORD-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-B', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '26/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    targetDeliveryDate: '26/09/2026',
    stock: { 'PERA_RAMA': 120 }
  });

  // En V4.6, allocations contiene 2 elementos distintos con su orderId
  assert.strictEqual(res.allocations.length, 2);
  const aA = res.allocations.find(a => a.orderId === 'ORD-A');
  const aB = res.allocations.find(a => a.orderId === 'ORD-B');

  assert.ok(aA && aB, 'Ambos pedidos conservan su identidad');
  assert.strictEqual(aA.platform, 'CENTRO');
  assert.strictEqual(aB.platform, 'CENTRO');
  assert.strictEqual(aA.allocatedQuantity, 80);
  assert.strictEqual(aB.allocatedQuantity, 40);

  // Paletización suma correctamente en el camión de la fecha
  assert.strictEqual(res.totalBoxes, 120);
});

check('Caso 4.2 · Contrato V4.6: Cada pedido individual conserva su orderId y su asignación propia', () => {
  const demands = { 'ORD-A': 100, 'ORD-B': 50 };
  const hamRes = hamilton.allocateProportionalHamilton(demands, 120, []);

  const allocA = hamRes.allocations.find(a => a.platform === 'ORD-A');
  const allocB = hamRes.allocations.find(a => a.platform === 'ORD-B');

  assert.strictEqual(allocA.allocatedQuantity, 80);
  assert.strictEqual(allocA.missingQuantity, 20);
  assert.strictEqual(allocB.allocatedQuantity, 40);
  assert.strictEqual(allocB.missingQuantity, 10);
});

// =============================================================================
// CASO 5 — MISMA PLATAFORMA EN DISTINTAS FECHAS
// =============================================================================
console.log('\n--- CASO 5: MISMA PLATAFORMA EN DISTINTAS FECHAS ---');

check('Caso 5.1 · planLoad conserva fechas distintas y plataforma homónima sin colisión', () => {
  const orders = [
    { id: 'ORD-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-B', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 120 }
  });

  assert.strictEqual(res.globalAllocation.length, 2);
  const aA = res.globalAllocation.find(a => a.orderId === 'ORD-A');
  const aB = res.globalAllocation.find(a => a.orderId === 'ORD-B');

  assert.strictEqual(aA.deliveryDate, '26/09/2026');
  assert.strictEqual(aB.deliveryDate, '27/09/2026');
  assert.strictEqual(aA.allocatedQuantity, 75);
  assert.strictEqual(aB.allocatedQuantity, 45);

  // Y se separan físicamente en planes por fecha
  assert.strictEqual(res.plansByDate['26/09/2026'].allocations.length, 1);
  assert.strictEqual(res.plansByDate['27/09/2026'].allocations.length, 1);
  assert.strictEqual(res.plansByDate['26/09/2026'].allocations[0].orderId, 'ORD-A');
  assert.strictEqual(res.plansByDate['27/09/2026'].allocations[0].orderId, 'ORD-B');
});

check('Caso 5.2 · Contrato V4.6: Asignación unívoca por orderId sin colisión por nombre de plataforma', () => {
  const demands = { 'ORD-A': 100, 'ORD-B': 60 };
  const hamRes = hamilton.allocateProportionalHamilton(demands, 120, []);

  assert.strictEqual(hamRes.allocations.length, 2);
  const ids = hamRes.allocations.map(a => a.platform);
  assert.ok(ids.includes('ORD-A'));
  assert.ok(ids.includes('ORD-B'));
});

// =============================================================================
// CASO 6 — VARIOS ARTÍCULOS
// =============================================================================
console.log('\n--- CASO 6: VARIOS ARTÍCULOS ---');

check('Caso 6.1 · Contrato V4.6: Stocks independientes por artículo sin contaminación cruzada', () => {
  const orders = [
    { id: 'ORD-P1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-P2', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' },
    { id: 'ORD-C1', platform: 'LEVANTE', productId: 'CHERRY_RAMA', cajas: 50, fechaEntrega: '26/09/2026' },
    { id: 'ORD-C2', platform: 'LEVANTE', productId: 'CHERRY_RAMA', cajas: 80, fechaEntrega: '27/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: {
      'PERA_RAMA': 120,
      'CHERRY_RAMA::SUNSTREAM': 100
    }
  });

  const aP1 = res.globalAllocation.find(a => a.orderId === 'ORD-P1');
  const aP2 = res.globalAllocation.find(a => a.orderId === 'ORD-P2');
  const aC1 = res.globalAllocation.find(a => a.orderId === 'ORD-C1');
  const aC2 = res.globalAllocation.find(a => a.orderId === 'ORD-C2');

  assert.strictEqual(aP1.allocatedQuantity, 75);
  assert.strictEqual(aP2.allocatedQuantity, 45);
  assert.strictEqual(aC1.allocatedQuantity, 38);
  assert.strictEqual(aC2.allocatedQuantity, 62);

  // Verificar stock remanente independiente
  const remPera = res.stockRemaining.find(s => s.productId === 'PERA_RAMA');
  const remCherry = res.stockRemaining.find(s => s.productId === 'CHERRY_RAMA');
  assert.strictEqual(remPera.used, 120);
  assert.strictEqual(remPera.remaining, 0);
  assert.strictEqual(remCherry.used, 100);
  assert.strictEqual(remCherry.remaining, 0);
});

// =============================================================================
// CASO 7 — COCKTAIL / FIFO MULTIFECHA
// =============================================================================
console.log('\n--- CASO 7: COCKTAIL / FIFO MULTIFECHA ---');

check('Caso 7.1 · Contrato V4.6: FIFO monovarietal sobre pedidos globales sin reutilizar variedad', () => {
  const orders = [
    { id: 'ORD-CK1', platform: 'CENTRO', productId: 'COCKTAIL_ROMANTICO', cajas: 50, fechaEntrega: '26/09/2026' },
    { id: 'ORD-CK2', platform: 'LEVANTE', productId: 'COCKTAIL_ROMANTICO', cajas: 50, fechaEntrega: '27/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: {
      'COCKTAIL_ROMANTICO::SAO_PAULO': 60,
      'COCKTAIL_ROMANTICO::SUNSTREAM': 50
    }
  });

  assert.strictEqual(res.globalAllocation.length, 2);
  const a1 = res.globalAllocation.find(a => a.orderId === 'ORD-CK1');
  const a2 = res.globalAllocation.find(a => a.orderId === 'ORD-CK2');

  assert.strictEqual(a1.allocatedQuantity, 50);
  assert.strictEqual(a2.allocatedQuantity, 50);

  // Uno recibe SAO_PAULO y el otro SUNSTREAM según FIFO monovarietal
  const varieties = [a1.varietyId, a2.varietyId];
  assert.ok(varieties.includes('SAO_PAULO'));
  assert.ok(varieties.includes('SUNSTREAM'));

  // Stock remanente
  const spRem = res.stockRemaining.find(s => s.varietyId === 'SAO_PAULO');
  const sunRem = res.stockRemaining.find(s => s.varietyId === 'SUNSTREAM');
  assert.strictEqual(spRem.used + sunRem.used, 100);
});

// =============================================================================
// CASO 8 — FECHA SIN DEMANDA
// =============================================================================
console.log('\n--- CASO 8: FECHA SIN DEMANDA ---');

check('Caso 8.1 · Contrato V4.6: La fecha sin pedidos no recibe stock y no altera el prorrateo de las demás', () => {
  const orders = [
    { id: 'ORD-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-C', platform: 'SUR', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '28/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 120 }
  });

  assert.strictEqual(res.globalAllocation.length, 2);
  const aA = res.globalAllocation.find(a => a.orderId === 'ORD-A');
  const aC = res.globalAllocation.find(a => a.orderId === 'ORD-C');

  assert.strictEqual(aA.allocatedQuantity, 80);
  assert.strictEqual(aC.allocatedQuantity, 40);

  // La fecha 27/09/2026 (sin demanda) no existe en plansByDate
  assert.strictEqual(res.plansByDate['27/09/2026'], undefined);
});

// =============================================================================
// CASO 9 — PEDIDOS ANTICIPADOS MULTIFECHA
// =============================================================================
console.log('\n--- CASO 9: PEDIDOS ANTICIPADOS MULTIFECHA ---');

check('Caso 9.1 · Contrato V4.6: Pedidos anticipados de distintas fechas entran al pool global con su procedencia', () => {
  const orders = [
    { id: 'ORD-ANT1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026', origen: 'ANTICIPADO' },
    { id: 'ORD-ANT2', platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '27/09/2026', origen: 'ANTICIPADO' },
    { id: 'ORD-PREV', platform: 'SUR', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '28/09/2026', origen: 'PREVISION' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 90 }
  });

  assert.strictEqual(res.globalAllocation.length, 3);
  const aAnt1 = res.globalAllocation.find(a => a.orderId === 'ORD-ANT1');
  const aAnt2 = res.globalAllocation.find(a => a.orderId === 'ORD-ANT2');
  const aPrev = res.globalAllocation.find(a => a.orderId === 'ORD-PREV');

  assert.strictEqual(aAnt1.origen, 'ANTICIPADO');
  assert.strictEqual(aAnt2.origen, 'ANTICIPADO');
  assert.strictEqual(aPrev.origen, 'PREVISION');

  const totalServido = aAnt1.allocatedQuantity + aAnt2.allocatedQuantity + aPrev.allocatedQuantity;
  assert.strictEqual(totalServido, 90, 'Pool global reparte exactamente 90 cjs');
});

// =============================================================================
// CASO 10 — PEDIDOS DIVIDIDOS
// =============================================================================
console.log('\n--- CASO 10: PEDIDOS DIVIDIDOS ---');

check('Caso 10.1 · Contrato V4.6: Hijos de división con distintas fechas conservan orderId y participan en el reparto', () => {
  const orders = [
    { id: 'PARENT', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026', active: false },
    { id: 'CHILD-1', platform: 'CENTRO 1', productId: 'PERA_RAMA', cajas: 25, fechaEntrega: '26/09/2026', active: true, origen: 'DIVIDIDO' },
    { id: 'CHILD-2', platform: 'CENTRO 2', productId: 'PERA_RAMA', cajas: 15, fechaEntrega: '27/09/2026', active: true, origen: 'DIVIDIDO' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 30 }
  });

  // Padre inactivo queda excluido; los dos hijos activos entran al reparto
  assert.strictEqual(res.globalAllocation.length, 2);
  const c1 = res.globalAllocation.find(a => a.orderId === 'CHILD-1');
  const c2 = res.globalAllocation.find(a => a.orderId === 'CHILD-2');

  assert.ok(c1 && c2, 'Ambos hijos activos entran al reparto');
  assert.strictEqual(c1.allocatedQuantity + c2.allocatedQuantity, 30);
  assert.strictEqual(c1.deliveryDate, '26/09/2026');
  assert.strictEqual(c2.deliveryDate, '27/09/2026');
});

// =============================================================================
// CASO 11 — SUMAS Y CONSERVACIÓN DE EXISTENCIAS
// =============================================================================
console.log('\n--- CASO 11: SUMAS Y CONSERVACIÓN ---');

check('Caso 11.1 · Contrato V4.6: Invariantes matemáticos de conservación estricta en planLoad', () => {
  const orders = [
    { id: 'ORD-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 120, fechaEntrega: '26/09/2026' },
    { id: 'ORD-2', platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 85, fechaEntrega: '27/09/2026' },
    { id: 'ORD-3', platform: 'SUR', productId: 'PERA_RAMA', cajas: 45, fechaEntrega: '28/09/2026' },
    { id: 'ORD-4', platform: 'CATALUÑA', productId: 'PERA_RAMA', cajas: 90, fechaEntrega: '29/09/2026' }
  ];

  const stockAvailable = 230;
  const totalDemand = 120 + 85 + 45 + 90; // 340

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': stockAvailable }
  });

  const totalServido = res.globalAllocation.reduce((s, a) => s + a.allocatedQuantity, 0);
  const totalPendiente = res.globalAllocation.reduce((s, a) => s + a.missingQuantity, 0);
  const rem = res.stockRemaining.find(s => s.productId === 'PERA_RAMA');

  // Invariante 1: servido <= stock disponible
  assert.ok(totalServido <= stockAvailable);
  assert.strictEqual(totalServido, stockAvailable);

  // Invariante 2: servidos + pendientes = demanda
  assert.strictEqual(totalServido + totalPendiente, totalDemand);

  // Invariante 3: stock inicial = stock servido + stock restante
  assert.strictEqual(rem.available, rem.used + rem.remaining);
  assert.strictEqual(rem.used, totalServido);
  assert.strictEqual(rem.remaining, 0);
});

// =============================================================================
// CASO 12 — RECONSTRUCCIÓN POR FECHA
// =============================================================================
console.log('\n--- CASO 12: RECONSTRUCCIÓN POR FECHA ---');

check('Caso 12.1 · Contrato V4.6: Reconstrucción de planes por fecha a partir de plansByDate sin recalcular', () => {
  const orders = [
    { id: 'ORD-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-2', platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '26/09/2026' },
    { id: 'ORD-3', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
  ];

  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 150 }
  });

  // Consultar plan Sábado directamente
  const planSabado = res.plansByDate['26/09/2026'];
  assert.ok(planSabado, 'Plan de Sábado existe');
  assert.strictEqual(planSabado.deliveryDate, '26/09/2026');
  assert.strictEqual(planSabado.allocations.length, 2);

  // Consultar plan Domingo directamente
  const planDomingo = res.plansByDate['27/09/2026'];
  assert.ok(planDomingo, 'Plan de Domingo existe');
  assert.strictEqual(planDomingo.deliveryDate, '27/09/2026');
  assert.strictEqual(planDomingo.allocations.length, 1);

  // Las cantidades de cada pedido coinciden exactamente con globalAllocation
  const g1 = res.globalAllocation.find(a => a.orderId === 'ORD-1');
  const p1 = planSabado.allocations.find(a => a.orderId === 'ORD-1');
  assert.strictEqual(g1.allocatedQuantity, p1.allocatedQuantity);
});

// =============================================================================
// CASO 13 — CAMBIO DE FECHA NO RECALCULA
// =============================================================================
console.log('\n--- CASO 13: CAMBIO DE FECHA NO RECALCULA ---');

checkBugReproduction('Caso 13.1 · Reproducción del flujo V4.5 en UIController (pendiente de Paso 4)', () => {
  const doc = createDocument();
  globalThis.document = doc;
  globalThis.window = {
    document: doc,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    scrollTo: () => {}
  };

  const ctrl = new UIController();
  ctrl.state.setStockItem('PERA_RAMA', 120);

  ctrl.state.addOrder({ id: 'ORD-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' });
  ctrl.state.addOrder({ id: 'ORD-2', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' });

  // 1. Generar plan para Sábado
  ctrl.state.selectedDeliveryDate = '26/09/2026';
  const plan1 = ctrl.generatePlan();
  const servido1 = plan1.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);

  // 2. Conmutar a Domingo y generar plan
  ctrl.state.selectedDeliveryDate = '27/09/2026';
  const plan2 = ctrl.generatePlan();
  const servido2 = plan2.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);

  // En V4.5 UIController filtra antes de llamar a planLoad, confirmando que ui.js aún no ha sido adaptado
  assert.strictEqual(servido1, 100);
  assert.strictEqual(servido2, 60);
  assert.strictEqual(servido1 + servido2, 160);
});

check('Caso 13.2 · Contrato V4.6: planLoad con targetDeliveryDate consulta la fecha sin duplicar stock', () => {
  const orders = [
    { id: 'ORD-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '26/09/2026' },
    { id: 'ORD-2', platform: 'MURCIA', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '27/09/2026' }
  ];

  // Llamada para ver Sábado
  const resSabado = orchestrator.planLoad({
    demandOrders: orders,
    targetDeliveryDate: '26/09/2026',
    stock: { 'PERA_RAMA': 120 }
  });

  // Llamada para ver Domingo (mismos pedidos y stock)
  const resDomingo = orchestrator.planLoad({
    demandOrders: orders,
    targetDeliveryDate: '27/09/2026',
    stock: { 'PERA_RAMA': 120 }
  });

  // Ambas llamadas comparten el mismo reparto global
  assert.strictEqual(resSabado.allocations[0].allocatedQuantity, 75);
  assert.strictEqual(resDomingo.allocations[0].allocatedQuantity, 45);
  assert.strictEqual(resSabado.allocations[0].allocatedQuantity + resDomingo.allocations[0].allocatedQuantity, 120);

  // Y el stock restante reportado es 0 en ambos
  assert.strictEqual(resSabado.stockRemaining.find(s => s.productId === 'PERA_RAMA').used, 120);
  assert.strictEqual(resDomingo.stockRemaining.find(s => s.productId === 'PERA_RAMA').used, 120);
});

// =============================================================================
// CASO 14 — REGRESIÓN V4.5
// =============================================================================
console.log('\n--- CASO 14: REGRESIÓN V4.5 ---');

check('Caso 14.1 · Regresión V4.5: El dataset monofecha sigue produciendo 100% servido y 0 pendientes', () => {
  const state = new AppState();
  state.setStockItem('COCKTAIL_ROMANTICO::CONSABOR', 80);
  const ord = state.addOrder({
    platform: 'CENTRO',
    productId: 'COCKTAIL_ROMANTICO',
    varietyId: 'CONSABOR',
    cajas: 80,
    fechaEntrega: '26/09/2026'
  });

  const res = orchestrator.planLoad({
    demandOrders: [ord],
    targetDeliveryDate: '26/09/2026',
    stock: { 'COCKTAIL_ROMANTICO::CONSABOR': 80 }
  });

  assert.strictEqual(res.allocations.length, 1);
  assert.strictEqual(res.allocations[0].allocatedQuantity, 80);
  assert.strictEqual(res.allocations[0].missingQuantity, 0);
});

// =============================================================================
// REGRESIONES ESPECÍFICAS DE V4.6 (REQUISITO PASO 3)
// =============================================================================
console.log('\n--- REGRESIONES ESPECÍFICAS DE V4.6 ---');

check('R1. Un solo reparto global ejecutado sobre la totalidad de la demanda', () => {
  const orders = [
    { id: 'R1-A', platform: 'P1', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '01/10/2026' },
    { id: 'R1-B', platform: 'P2', productId: 'PERA_RAMA', cajas: 100, fechaEntrega: '02/10/2026' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 100 } });
  assert.strictEqual(res.globalAllocation.reduce((s, a) => s + a.allocatedQuantity, 0), 100);
});

check('R2. Stock no duplicado entre fechas: conservación estricta', () => {
  const orders = [
    { id: 'R2-A', platform: 'P1', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '01/10/2026' },
    { id: 'R2-B', platform: 'P2', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '02/10/2026' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 80 } });
  const rem = res.stockRemaining.find(s => s.productId === 'PERA_RAMA');
  assert.strictEqual(rem.used, 80);
  assert.strictEqual(rem.remaining, 0);
});

check('R3. orderId conservado en todas las asignaciones', () => {
  const orders = [
    { id: 'CUSTOM-ORDER-ID-123', platform: 'P1', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '01/10/2026' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 50 } });
  assert.strictEqual(res.allocations[0].orderId, 'CUSTOM-ORDER-ID-123');
});

check('R4. Misma plataforma en fechas distintas no colisiona', () => {
  const orders = [
    { id: 'R4-A', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 70, fechaEntrega: '01/10/2026' },
    { id: 'R4-B', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '02/10/2026' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 100 } });
  assert.strictEqual(res.globalAllocation.length, 2);
  assert.strictEqual(res.globalAllocation.find(a => a.orderId === 'R4-A').allocatedQuantity, 70);
  assert.strictEqual(res.globalAllocation.find(a => a.orderId === 'R4-B').allocatedQuantity, 30);
});

check('R5. Dos pedidos misma plataforma y misma fecha no se fusionan', () => {
  const orders = [
    { id: 'R5-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 40, fechaEntrega: '01/10/2026' },
    { id: 'R5-2', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 60, fechaEntrega: '01/10/2026' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 100 } });
  assert.strictEqual(res.allocations.length, 2);
  assert.strictEqual(res.allocations.find(a => a.orderId === 'R5-1').allocatedQuantity, 40);
  assert.strictEqual(res.allocations.find(a => a.orderId === 'R5-2').allocatedQuantity, 60);
});

check('R6. Planes físicos separados por fecha (plansByDate)', () => {
  const orders = [
    { id: 'R6-1', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '01/10/2026' },
    { id: 'R6-2', platform: 'LEVANTE', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '02/10/2026' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 100 } });
  assert.ok(res.plansByDate['01/10/2026'].palletSummaries);
  assert.ok(res.plansByDate['02/10/2026'].palletSummaries);
  assert.strictEqual(res.plansByDate['01/10/2026'].totalBoxes, 50);
  assert.strictEqual(res.plansByDate['02/10/2026'].totalBoxes, 50);
});

check('R7. Cocktail FIFO global no reutiliza stock de variedad', () => {
  const orders = [
    { id: 'R7-1', platform: 'CENTRO', productId: 'COCKTAIL_ROMANTICO', cajas: 40, fechaEntrega: '01/10/2026' },
    { id: 'R7-2', platform: 'LEVANTE', productId: 'COCKTAIL_ROMANTICO', cajas: 40, fechaEntrega: '02/10/2026' }
  ];
  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: {
      'COCKTAIL_ROMANTICO::SAO_PAULO': 40,
      'COCKTAIL_ROMANTICO::SUNSTREAM': 40
    }
  });
  const spUsed = res.stockRemaining.find(s => s.varietyId === 'SAO_PAULO').used;
  const sunUsed = res.stockRemaining.find(s => s.varietyId === 'SUNSTREAM').used;
  assert.strictEqual(spUsed, 40);
  assert.strictEqual(sunUsed, 40);
});

check('R8. Pedidos anticipados multifecha preservan procedencia en reparto', () => {
  const orders = [
    { id: 'R8-ANT', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '01/10/2026', origen: 'ANTICIPADO' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 50 } });
  assert.strictEqual(res.allocations[0].origen, 'ANTICIPADO');
});

check('R9. Pedidos divididos en fechas distintas', () => {
  const orders = [
    { id: 'R9-P', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '01/10/2026', active: false },
    { id: 'R9-C1', platform: 'CENTRO 1', productId: 'PERA_RAMA', cajas: 30, fechaEntrega: '01/10/2026', active: true, origen: 'DIVIDIDO' },
    { id: 'R9-C2', platform: 'CENTRO 2', productId: 'PERA_RAMA', cajas: 20, fechaEntrega: '02/10/2026', active: true, origen: 'DIVIDIDO' }
  ];
  const res = orchestrator.planLoad({ demandOrders: orders, stock: { 'PERA_RAMA': 50 } });
  assert.strictEqual(res.globalAllocation.length, 2);
});

check('R10. Multiproducto con stocks independientes multifecha', () => {
  const orders = [
    { id: 'R10-P', platform: 'CENTRO', productId: 'PERA_RAMA', cajas: 50, fechaEntrega: '01/10/2026' },
    { id: 'R10-C', platform: 'CENTRO', productId: 'CHERRY_RAMA', cajas: 40, fechaEntrega: '02/10/2026' }
  ];
  const res = orchestrator.planLoad({
    demandOrders: orders,
    stock: { 'PERA_RAMA': 50, 'CHERRY_RAMA::SUNSTREAM': 40 }
  });
  assert.strictEqual(res.globalAllocation.length, 2);
  assert.strictEqual(res.globalAllocation.find(a => a.productId === 'PERA_RAMA').allocatedQuantity, 50);
  assert.strictEqual(res.globalAllocation.find(a => a.productId === 'CHERRY_RAMA').allocatedQuantity, 40);
});

// =============================================================================
// RESUMEN DE RESULTADOS
// =============================================================================
console.log('\n==================================================');
console.log(`TOTAL COMPROBACIONES: ${totalChecks}`);
console.log(`PASADAS CON ÉXITO:    ${passedChecks}`);
console.log(`FALLOS V4.5 PROBADOS: ${flawsConfirmed}`);
console.log('==================================================\n');

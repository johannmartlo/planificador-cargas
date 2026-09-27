/**
 * Motor de Prorrateo Proporcional Hamilton (Método del Mayor Resto) y Gestión de Stock
 *
 * Módulo puro, determinista y completamente desacoplado del DOM.
 * Implementa el cálculo de stock disponible, cantidad servible, validación estricta,
 * aplicación de bloqueos prioritarios, prorrateo con desempate determinista
 * y trazabilidad completa de asignaciones.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticsHamilton = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Valida rigurosamente los tipos y valores de las demandas y el stock disponible.
   *
   * @param {any} demandByPlatform - Mapa de demandas { PLATAFORMA: cantidad }.
   * @param {any} availableStock - Stock físico disponible en almacén.
   * @returns {{ isValid: boolean, errors: Array<Object>, sanitizedDemands: Object<string, number>, sanitizedStock: number }}
   */
  function validateInputs(demandByPlatform, availableStock) {
    const errors = [];

    // 1. Validación de demandByPlatform
    if (
      typeof demandByPlatform !== 'object' ||
      demandByPlatform === null ||
      Array.isArray(demandByPlatform)
    ) {
      errors.push({
        code: 'INVALID_DEMAND_OBJECT',
        message: 'demandByPlatform debe ser un objeto válido no nulo ni array.'
      });
      return { isValid: false, errors, sanitizedDemands: {}, sanitizedStock: 0 };
    }

    const sanitizedDemands = {};
    for (const [platform, qty] of Object.entries(demandByPlatform)) {
      if (typeof qty !== 'number') {
        errors.push({
          code: 'NON_NUMERIC_DEMAND',
          message: `La demanda para "${platform}" debe ser numérica. Recibido: ${typeof qty}.`,
          context: { platform, value: qty }
        });
        continue;
      }

      if (isNaN(qty) || !isFinite(qty)) {
        errors.push({
          code: 'INVALID_NUMERIC_VALUE',
          message: `La demanda para "${platform}" es NaN o Infinity.`,
          context: { platform, value: qty }
        });
        continue;
      }

      if (!Number.isInteger(qty)) {
        errors.push({
          code: 'DECIMAL_DEMAND_NOT_ALLOWED',
          message: `La demanda para "${platform}" no puede ser decimal (${qty}). Solo se admiten cajas enteras.`,
          context: { platform, value: qty }
        });
        continue;
      }

      if (qty < 0) {
        errors.push({
          code: 'NEGATIVE_DEMAND',
          message: `La demanda para "${platform}" no puede ser negativa (${qty}).`,
          context: { platform, value: qty }
        });
        continue;
      }

      sanitizedDemands[platform] = qty;
    }

    // 2. Validación de availableStock
    if (typeof availableStock !== 'number') {
      errors.push({
        code: 'NON_NUMERIC_STOCK',
        message: `availableStock debe ser un valor numérico. Recibido: ${typeof availableStock}.`,
        context: { availableStock }
      });
    } else if (isNaN(availableStock) || !isFinite(availableStock)) {
      errors.push({
        code: 'INVALID_STOCK_VALUE',
        message: 'availableStock no puede ser NaN ni Infinity.',
        context: { availableStock }
      });
    } else if (!Number.isInteger(availableStock)) {
      errors.push({
        code: 'DECIMAL_STOCK_NOT_ALLOWED',
        message: `availableStock no puede ser decimal (${availableStock}). Solo se admiten cajas enteras.`,
        context: { availableStock }
      });
    } else if (availableStock < 0) {
      errors.push({
        code: 'NEGATIVE_STOCK',
        message: `availableStock no puede ser negativo (${availableStock}).`,
        context: { availableStock }
      });
    }

    const sanitizedStock = errors.length === 0 ? availableStock : 0;

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedDemands,
      sanitizedStock
    };
  }

  /**
   * Realiza la asignación proporcional de stock mediante el método de Hamilton (mayor resto),
   * aplicando previamente los bloqueos prioritarios.
   *
   * @param {Object<string, number>} demandByPlatform - Mapa inmutable { PLATAFORMA: cajas }.
   * @param {number} availableStock - Stock físico total utilizable.
   * @param {Array<Object>} [locks] - Lista de bloqueos [{ platform: string, type: 'FULL'|'FIXED', quantity?: number }].
   * @returns {{
   *   totalRequested: number,
   *   availableStock: number,
   *   totalAllocated: number,
   *   totalMissing: number,
   *   stockRemaining: number,
   *   allocations: Array<Object>,
   *   warnings: Array<Object>,
   *   errors: Array<Object>,
   *   isFeasible: boolean
   * }}
   */
  function allocateProportionalHamilton(demandByPlatform, availableStock, locks = []) {
    const warnings = [];
    const errors = [];

    // =======================================================================
    // PASO 1: VALIDACIÓN DE ENTRADA
    // =======================================================================
    const validation = validateInputs(demandByPlatform, availableStock);
    if (!validation.isValid) {
      return {
        totalRequested: 0,
        availableStock: typeof availableStock === 'number' && !isNaN(availableStock) ? availableStock : 0,
        totalAllocated: 0,
        totalMissing: 0,
        stockRemaining: 0,
        allocations: [],
        warnings,
        errors: validation.errors,
        isFeasible: false
      };
    }

    // Copia defensiva inmutable para garantizar que la entrada no se modifique
    const demands = { ...validation.sanitizedDemands };
    const safeStock = validation.sanitizedStock;
    const platforms = Object.keys(demands);

    let totalRequested = 0;
    for (const p of platforms) {
      totalRequested += demands[p];
    }

    // Inicializar mapa de asignaciones
    const allocMap = {};
    for (const plat of platforms) {
      allocMap[plat] = {
        platform: plat,
        requestedQuantity: demands[plat],
        lockedQuantity: 0,
        proportionalQuantity: 0,
        allocatedQuantity: 0,
        missingQuantity: demands[plat],
        fulfillmentPercentage: 0,
        allocationMethod: 'UNFULFILLED',
        quota: 0,
        remainder: 0
      };
    }

    // =======================================================================
    // PASO 2: APLICACIÓN Y VALIDACIÓN DE BLOQUEOS
    // =======================================================================
    // Agrupar y validar locks por plataforma:
    // - FULL + FULL idénticos -> deduplicar a un único bloqueo FULL.
    // - FULL + FIXED sobre la misma plataforma -> conflicto explícito (LOCK_CONFLICT). No elegir silenciosamente uno de los dos.
    const locksByPlatform = new Map();
    if (Array.isArray(locks)) {
      for (const lock of locks) {
        if (!lock || !lock.platform || !allocMap[lock.platform]) continue;
        const plat = lock.platform;
        if (!locksByPlatform.has(plat)) {
          locksByPlatform.set(plat, []);
        }
        locksByPlatform.get(plat).push(lock);
      }
    }

    const consolidatedLocks = new Map();
    for (const [plat, platLocks] of locksByPlatform.entries()) {
      const hasFull = platLocks.some(l => l.type === 'FULL');
      const hasFixed = platLocks.some(l => l.type === 'FIXED');

      if (hasFull && hasFixed) {
        errors.push({
          code: 'LOCK_CONFLICT',
          platform: plat,
          message: `Conflicto de bloqueos en plataforma ${plat}: se ha especificado simultáneamente bloqueo TOTAL (FULL) y FIJO (FIXED).`
        });
        // No resolver arbitrariamente; omitir del reparto de bloqueos
        continue;
      }

      if (hasFull) {
        // Deduplicar FULL + FULL a uno solo
        consolidatedLocks.set(plat, platLocks.find(l => l.type === 'FULL'));
      } else {
        // Si hay varios FIXED o uno solo, consolidar
        consolidatedLocks.set(plat, platLocks[platLocks.length - 1]);
      }
    }

    let totalLocked = 0;

    for (const [plat, lock] of consolidatedLocks.entries()) {
      const requested = allocMap[plat].requestedQuantity;
      let lockQty = 0;

      if (lock.type === 'FULL') {
        lockQty = requested;
      } else if (lock.type === 'FIXED') {
        const rawFixed = typeof lock.quantity === 'number' ? lock.quantity : 0;
        const desired = Math.max(0, Math.floor(rawFixed));

        if (desired > requested) {
          warnings.push({
            code: 'LOCK_EXCEEDED_DEMAND',
            message: `El bloqueo fijo de ${desired} cjs para ${plat} supera su pedido original de ${requested} cjs. Se acota a la demanda solicitada.`,
            context: { platform: plat, desiredQuantity: desired, requestedQuantity: requested }
          });
          lockQty = requested;
        } else {
          lockQty = desired;
        }
      }

      allocMap[plat].lockedQuantity = lockQty;
      allocMap[plat].allocatedQuantity = lockQty;
      allocMap[plat].missingQuantity = requested - lockQty;
      allocMap[plat].fulfillmentPercentage = requested > 0
        ? parseFloat(((lockQty / requested) * 100).toFixed(2))
        : 100;
      allocMap[plat].allocationMethod = lockQty === requested ? 'FULL' : 'LOCK';

      totalLocked += lockQty;
    }

    // Validación crítica: Bloqueos no pueden superar el stock disponible
    if (totalLocked > safeStock) {
      const stockDeficit = totalLocked - safeStock;
      errors.push({
        code: 'STOCK_EXCEEDED_BY_LOCKS',
        message: `La suma de bloqueos (${totalLocked} cjs) excede el stock disponible total (${safeStock} cjs). Faltan ${stockDeficit} cjs para satisfacer los bloqueos.`,
        context: { totalLocked, availableStock: safeStock, stockDeficit }
      });

      return {
        totalRequested,
        availableStock: safeStock,
        totalAllocated: 0,
        totalMissing: totalRequested,
        stockRemaining: safeStock,
        allocations: platforms.map(p => allocMap[p]),
        warnings,
        errors,
        isFeasible: false
      };
    }

    // =======================================================================
    // PASO 3: CÁLCULO DE STOCK RESIDUAL Y DEMANDA RESIDUAL
    // =======================================================================
    const residualStock = safeStock - totalLocked;
    const residualDemands = {};
    let totalResidualDemand = 0;

    for (const plat of platforms) {
      const resDem = allocMap[plat].requestedQuantity - allocMap[plat].lockedQuantity;
      residualDemands[plat] = resDem;
      totalResidualDemand += resDem;
    }

    // =======================================================================
    // PASO 4: SUFICIENCIA O REPARTO HAMILTON
    // =======================================================================
    if (totalResidualDemand === 0 || residualStock === 0) {
      // No hay demanda residual que satisfacer o se agotó el stock disponible
      for (const plat of platforms) {
        const item = allocMap[plat];
        item.fulfillmentPercentage = item.requestedQuantity > 0
          ? parseFloat(((item.allocatedQuantity / item.requestedQuantity) * 100).toFixed(2))
          : 100;
      }
    } else if (residualStock >= totalResidualDemand) {
      // Stock residual suficiente: asignar el 100% de la demanda residual a todos
      for (const plat of platforms) {
        const item = allocMap[plat];
        const resDem = residualDemands[plat];
        item.proportionalQuantity = resDem;
        item.allocatedQuantity = item.lockedQuantity + resDem;
        item.missingQuantity = 0;
        item.fulfillmentPercentage = 100;
        item.quota = parseFloat(resDem.toFixed(2));
        item.remainder = 0;

        if (item.lockedQuantity > 0 && item.proportionalQuantity > 0) {
          item.allocationMethod = 'LOCK_HAMILTON';
        } else if (item.lockedQuantity > 0) {
          item.allocationMethod = 'FULL';
        } else {
          item.allocationMethod = 'FULL';
        }
      }
    } else {
      // =====================================================================
      // PASO 5: MÉTODO DEL MAYOR RESTO (HAMILTON)
      // =====================================================================
      let assignedIntegerSum = 0;
      const candidates = [];

      for (const plat of platforms) {
        const resDem = residualDemands[plat];
        if (resDem <= 0) {
          allocMap[plat].quota = 0;
          allocMap[plat].remainder = 0;
          continue;
        }

        const rawQuota = (resDem / totalResidualDemand) * residualStock;
        const integerPart = Math.floor(rawQuota);
        const remainder = rawQuota - integerPart;

        allocMap[plat].proportionalQuantity = integerPart;
        allocMap[plat].quota = parseFloat(rawQuota.toFixed(4));
        allocMap[plat].remainder = parseFloat(remainder.toFixed(4));
        assignedIntegerSum += integerPart;

        candidates.push({
          platform: plat,
          integerPart,
          remainder,
          originalRequest: allocMap[plat].requestedQuantity
        });
      }

      // Ordenación determinista para adjudicar las unidades sobrantes:
      // 1. Mayor resto decimal (DESC)
      // 2. Mayor pedido original solicitado (DESC)
      // 3. Nombre canónico de plataforma orden alfabético (ASC)
      candidates.sort((a, b) => {
        const diffRem = b.remainder - a.remainder;
        if (Math.abs(diffRem) > 1e-9) return diffRem;
        const diffReq = b.originalRequest - a.originalRequest;
        if (diffReq !== 0) return diffReq;
        return a.platform.localeCompare(b.platform);
      });

      // Asignar +1 caja a los primeros "remainingUnits" candidatos
      const remainingUnits = residualStock - assignedIntegerSum;
      for (let i = 0; i < remainingUnits; i++) {
        if (candidates[i]) {
          const plat = candidates[i].platform;
          allocMap[plat].proportionalQuantity += 1;
        }
      }

      // Consolidar totales por plataforma
      for (const plat of platforms) {
        const item = allocMap[plat];
        item.allocatedQuantity = item.lockedQuantity + item.proportionalQuantity;
        item.missingQuantity = item.requestedQuantity - item.allocatedQuantity;
        item.fulfillmentPercentage = item.requestedQuantity > 0
          ? parseFloat(((item.allocatedQuantity / item.requestedQuantity) * 100).toFixed(2))
          : 100;

        if (item.lockedQuantity > 0 && item.proportionalQuantity > 0) {
          item.allocationMethod = 'LOCK_HAMILTON';
        } else if (item.lockedQuantity > 0) {
          item.allocationMethod = item.allocatedQuantity === item.requestedQuantity ? 'FULL' : 'LOCK';
        } else if (item.allocatedQuantity > 0) {
          item.allocationMethod = item.allocatedQuantity === item.requestedQuantity ? 'FULL' : 'HAMILTON';
        } else {
          item.allocationMethod = 'UNFULFILLED';
        }
      }
    }

    // =======================================================================
    // PASO 6: INVARIANTES OBLIGATORIOS Y CONSOLIDACIÓN FINAL
    // =======================================================================
    let totalAllocated = 0;
    let totalMissing = 0;

    for (const plat of platforms) {
      const item = allocMap[plat];
      totalAllocated += item.allocatedQuantity;
      totalMissing += item.missingQuantity;

      // Invariante 2: 0 <= allocated <= requested
      if (item.allocatedQuantity < 0 || item.allocatedQuantity > item.requestedQuantity) {
        errors.push({
          code: 'ALLOCATION_BOUNDS_VIOLATION',
          message: `Invariante violada: Asignación fuera de límites para ${plat} (asignado: ${item.allocatedQuantity}, pedido: ${item.requestedQuantity}).`,
          context: { platform: plat, item }
        });
      }

      // Invariante 3: missing = requested - allocated
      if (item.missingQuantity !== (item.requestedQuantity - item.allocatedQuantity)) {
        errors.push({
          code: 'MISSING_QUANTITY_INVARIANT_VIOLATION',
          message: `Invariante violada: missingQuantity inconsistente en ${plat}.`,
          context: { platform: plat, item }
        });
      }

      // Invariante 4: allocated y missing son enteros
      if (!Number.isInteger(item.allocatedQuantity) || !Number.isInteger(item.missingQuantity)) {
        errors.push({
          code: 'NON_INTEGER_RESULT',
          message: `Invariante violada: Cantidades no enteras detectadas en ${plat}.`,
          context: { platform: plat, item }
        });
      }

      // Invariante 5 & 6: No NaN ni Infinity
      if (isNaN(item.allocatedQuantity) || !isFinite(item.allocatedQuantity)) {
        errors.push({
          code: 'NAN_OR_INFINITY_DETECTED',
          message: `Invariante violada: NaN o Infinity detectado en ${plat}.`,
          context: { platform: plat, item }
        });
      }
    }

    // Invariante 1: SUM(allocated) = MIN(availableStock, totalRequested)
    const expectedAllocatedTotal = Math.min(safeStock, totalRequested);
    if (totalAllocated !== expectedAllocatedTotal) {
      errors.push({
        code: 'TOTAL_ALLOCATION_INVARIANT_VIOLATION',
        message: `Invariante violada: totalAllocated (${totalAllocated}) no coincide con MIN(availableStock, totalRequested) (${expectedAllocatedTotal}).`,
        context: { totalAllocated, expectedAllocatedTotal, availableStock: safeStock, totalRequested }
      });
    }

    const stockRemaining = Math.max(0, safeStock - totalAllocated);

    return {
      totalRequested,
      availableStock: safeStock,
      totalAllocated,
      totalMissing,
      stockRemaining,
      allocations: platforms.map(p => allocMap[p]),
      warnings,
      errors,
      isFeasible: errors.length === 0
    };
  }

  return {
    validateInputs,
    allocateProportionalHamilton
  };
});

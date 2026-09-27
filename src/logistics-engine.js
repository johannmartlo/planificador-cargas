/**
 * LogisticsEngine - Motor Logístico Puro e Independiente para Planificación Hortofrutícola
 *
 * Principios:
 * - Cero dependencias del DOM, window ni frameworks.
 * - Funciones puras y resultados deterministas serializables a JSON.
 * - Pipeline conceptual riguroso:
 *   DEMANDA -> STOCK DISPONIBLE -> CANTIDAD SERVIBLE -> ASIGNACIÓN -> RESTRICCIONES DE VARIEDAD/FIFO -> RESULTADO
 * - Estricta separación de las magnitudes cuantitativas:
 *   - requestedQuantity: demanda inicial solicitada
 *   - servibleQuantity: cuota físicamente servible según stock
 *   - lockedQuantity: cantidad asignada por bloqueo
 *   - proportionalQuantity: cantidad asignada por Hamilton
 *   - allocatedQuantity: total asignado (locked + proportional)
 *   - missingQuantity: déficit insatisfecho (requested - allocated)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticsEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // =========================================================================
  // CATÁLOGO PREDETERMINADO Y REGLAS DE NEGOCIO
  // =========================================================================

  const DEFAULT_CATALOG = {
    products: {
      PERA_RAMA: {
        id: 'PERA_RAMA',
        name: 'TOMATE PERA RAMA',
        gisCodes: ['14072'],
        matchRegex: /PERA\s*RAMA/i,
        hasMonovarietalRestriction: false,
        varieties: []
      },
      COCKTAIL_ROMANTICO: {
        id: 'COCKTAIL_ROMANTICO',
        name: 'TOMATE COCKTAIL ROMÁNTICO 10x300',
        gisCodes: ['16228'],
        matchRegex: /COCKT.*ROMANT/i,
        hasMonovarietalRestriction: true,
        varieties: [
          { id: 'SAO_PAULO', name: 'Sao Paulo', isOldLot: true, fifoPriority: 1 },
          { id: 'SUNSTREAM', name: 'Sunstream', isOldLot: false, fifoPriority: 2 }
        ]
      },
      CHERRY_RAMA: {
        id: 'CHERRY_RAMA',
        name: 'TOMATE CHERRY RAMA SUNSTREAM',
        gisCodes: ['18746'],
        matchRegex: /CHERRY\s*RAMA/i,
        hasMonovarietalRestriction: false,
        varieties: [
          { id: 'SUNSTREAM', name: 'Sunstream', isOldLot: false, fifoPriority: 1 }
        ]
      }
    },
    palletRules: {
      PERA_RAMA: {
        productId: 'PERA_RAMA',
        palletType: 'EURO',
        minOperationalBoxes: 80,
        maxStandardBoxes: 96
      },
      COCKTAIL_ROMANTICO: {
        productId: 'COCKTAIL_ROMANTICO',
        palletType: 'EURO',
        minOperationalBoxes: 80,
        maxStandardBoxes: 96
      },
      CHERRY_RAMA: {
        productId: 'CHERRY_RAMA',
        palletType: 'EURO',
        minOperationalBoxes: 176,
        maxStandardBoxes: 176,
        alternativeRules: {
          METROCHEP: {
            productId: 'CHERRY_RAMA',
            palletType: 'METROCHEP',
            minOperationalBoxes: 220,
            maxStandardBoxes: 220
          }
        }
      }
    },
    canonicalPlatforms: ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA']
  };

  // =========================================================================
  // 1. PARSER RESILIENTE POR PATRONES
  // =========================================================================

  /**
   * Interpreta texto bruto copiado directamente de previsiones de email o ERP.
   * No depende de columnas tabuladas ni posiciones fijas; identifica tokens mediante patrones.
   * Tolera tabuladores, múltiples espacios, espacios no separables y líneas corruptas.
   *
   * @param {string} rawText - Texto copiado íntegro.
   * @param {Object} [customCatalog] - Catálogo opcional para sobreescribir defaults.
   * @returns {{ lines: Array<Object>, detectedDate: string|null, parsingErrors: Array<string> }}
   */
  function parseRawForecast(rawText, customCatalog = DEFAULT_CATALOG) {
    if (typeof rawText !== 'string') {
      return { lines: [], detectedDate: null, parsingErrors: ['El texto de entrada debe ser una cadena de caracteres.'] };
    }

    const rawLines = rawText.split(/\r?\n/);
    const lines = [];
    const parsingErrors = [];
    let detectedDate = null;
    let lineCounter = 0;

    const knownPlatforms = (customCatalog.canonicalPlatforms || DEFAULT_CATALOG.canonicalPlatforms)
      .map(p => p.toUpperCase());

    for (let i = 0; i < rawLines.length; i++) {
      const originalLine = rawLines[i];
      // Normalizar espacios no separables (\u00A0, \u202F) y saltos de carro
      const cleanLine = originalLine.replace(/[\u00A0\u202F]/g, ' ').trim();
      if (!cleanLine) continue; // Saltar líneas vacías

      lineCounter++;
      const lineId = `line_${lineCounter}`;
      const lineErrors = [];

      // 1. Detección de fecha de entrega (formato DD/MM/YYYY)
      const deliveryDateMatch = cleanLine.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      let deliveryDate = null;
      if (deliveryDateMatch) {
        deliveryDate = deliveryDateMatch[1];
        if (!detectedDate) detectedDate = deliveryDate;
      } else {
        lineErrors.push('No se encontró fecha de entrega DD/MM/YYYY.');
      }

      // 2. Detección de timestamp de origen/cabecera si existe
      // Ejemplo: Tue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)
      const sourceDateMatch = cleanLine.match(/\b[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}(?:\s*\([^)]*\))?/);
      const sourceDate = sourceDateMatch ? sourceDateMatch[0] : null;

      // 3. Detección de cantidad solicitada (último número entero en la línea)
      const quantityMatch = cleanLine.match(/\b(\d+)\s*$/);
      let requestedQuantity = 0;
      if (quantityMatch) {
        requestedQuantity = parseInt(quantityMatch[1], 10);
      } else {
        lineErrors.push('No se pudo detectar la cantidad solicitada (número entero final).');
      }

      // 4. Detección de código GIS (token numérico de 4 a 6 dígitos)
      // Debe aparecer después de la fecha de entrega y antes de la descripción
      let gisCode = '';
      if (deliveryDate) {
        const afterDate = cleanLine.slice(cleanLine.indexOf(deliveryDate) + deliveryDate.length);
        const gisMatch = afterDate.match(/\b(\d{4,6})\b/);
        if (gisMatch) gisCode = gisMatch[1];
      }
      if (!gisCode) {
        // Fallback: buscar tokens de 4 a 6 dígitos que no sean el año ni el offset GMT
        const matches = cleanLine.matchAll(/\b(\d{4,6})\b/g);
        for (const m of matches) {
          const val = m[1];
          if (deliveryDate && deliveryDate.includes(val)) continue;
          if (cleanLine.includes(`GMT+${val}`) || cleanLine.includes(`GMT-${val}`)) continue;
          gisCode = val;
          break;
        }
      }

      // 5. Detección de plataforma de destino
      let platform = '';
      const upperLine = cleanLine.toUpperCase();
      // Búsqueda por coincidencia de plataformas conocidas al inicio
      for (const kp of knownPlatforms) {
        const normalizedKP = kp.normalize('NFD').replace(/[\u0300-\u036f]/g, m => m === '\u0303' ? '\u0303' : '');
        if (upperLine.startsWith(kp) || upperLine.startsWith(normalizedKP)) {
          platform = kp;
          break;
        }
      }
      if (!platform) {
        // Si no coincide con las conocidas, tomar la primera palabra antes de espacios o tabs
        const firstToken = cleanLine.split(/[\t\s]+/)[0] || '';
        platform = firstToken.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, m => m === '\u0303' ? '\u0303' : '');
      }

      // 6. Detección de descripción de producto y match de catálogo
      let detectedProductKey = 'UNKNOWN';
      let detectedVariety = null;
      let productDescription = '';

      if (cleanLine.includes('\t')) {
        const cols = cleanLine.split('\t').map(c => c.trim());
        productDescription = cols.find(c => /TOMATE|PERA|COCKT|CHERRY/i.test(c)) || (cols.length >= 2 ? cols[cols.length - 2] : '');
      } else {
        // Subcadena intermedia entre GIS (o fecha) y cantidad final
        let searchPart = cleanLine;
        if (gisCode && cleanLine.includes(gisCode)) {
          searchPart = cleanLine.slice(cleanLine.indexOf(gisCode) + gisCode.length);
        } else if (deliveryDate && cleanLine.includes(deliveryDate)) {
          searchPart = cleanLine.slice(cleanLine.indexOf(deliveryDate) + deliveryDate.length);
        }
        if (quantityMatch) {
          searchPart = searchPart.slice(0, searchPart.lastIndexOf(quantityMatch[1]));
        }
        productDescription = searchPart.trim();
      }

      // Matching contra el catálogo de productos
      const products = customCatalog.products || DEFAULT_CATALOG.products;
      for (const [key, prod] of Object.entries(products)) {
        const matchesGis = gisCode && prod.gisCodes.includes(gisCode);
        const matchesName = prod.matchRegex && (prod.matchRegex.test(cleanLine) || prod.matchRegex.test(productDescription));

        if (matchesGis || matchesName) {
          detectedProductKey = key;
          break;
        }
      }

      // Variedad si se encuentra especificada
      if (/SUNSTREAM/i.test(cleanLine)) {
        detectedVariety = 'SUNSTREAM';
      } else if (/SAO\s*PAULO/i.test(cleanLine)) {
        detectedVariety = 'SAO_PAULO';
      }

      const isValid = lineErrors.length === 0 && requestedQuantity >= 0 && platform.length > 0;
      if (!isValid) {
        parsingErrors.push(`Línea ${i + 1}: ${lineErrors.join(' | ')}`);
      }

      lines.push({
        id: lineId,
        rawText: originalLine,
        lineNumber: i + 1,
        platform,
        deliveryDate: deliveryDate || detectedDate || '',
        sourceDate,
        gisCode: gisCode || '',
        productDescription,
        detectedProductKey,
        detectedVariety,
        requestedQuantity,
        isValid,
        parseErrors: lineErrors
      });
    }

    return {
      lines,
      detectedDate,
      parsingErrors
    };
  }

  // =========================================================================
  // 2. AGREGACIÓN DE DEMANDAS Y EXCLUSIONES
  // =========================================================================

  function aggregateDemands(orderLines, exclusions = []) {
    const excludedProductKeys = new Set();
    const excludedPlatforms = new Set();
    const excludedLineIds = new Set();

    for (const ex of exclusions) {
      if (ex.type === 'PRODUCT') excludedProductKeys.add(ex.target);
      if (ex.type === 'PLATFORM') excludedPlatforms.add(ex.target);
      if (ex.type === 'LINE') excludedLineIds.add(ex.target);
    }

    const activeLines = orderLines.filter(line => {
      if (!line.isValid) return false;
      if (excludedLineIds.has(line.id)) return false;
      if (excludedProductKeys.has(line.detectedProductKey)) return false;
      if (excludedPlatforms.has(line.platform)) return false;
      return true;
    });

    const platformsSet = new Set();
    const demandsByProduct = {};
    const totalDemandByProduct = {};

    for (const line of activeLines) {
      const prodKey = line.detectedProductKey;
      const plat = line.platform;
      const qty = line.requestedQuantity;

      platformsSet.add(plat);

      if (!demandsByProduct[prodKey]) {
        demandsByProduct[prodKey] = {};
        totalDemandByProduct[prodKey] = 0;
      }
      demandsByProduct[prodKey][plat] = (demandsByProduct[prodKey][plat] || 0) + qty;
      totalDemandByProduct[prodKey] += qty;
    }

    const canonicalOrder = DEFAULT_CATALOG.canonicalPlatforms;
    const sortedPlatforms = Array.from(platformsSet).sort((a, b) => {
      let idxA = canonicalOrder.indexOf(a);
      let idxB = canonicalOrder.indexOf(b);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB || a.localeCompare(b);
    });

    for (const prodKey of Object.keys(demandsByProduct)) {
      for (const plat of sortedPlatforms) {
        if (demandsByProduct[prodKey][plat] === undefined) {
          demandsByProduct[prodKey][plat] = 0;
        }
      }
    }

    return {
      activeLines,
      platforms: sortedPlatforms,
      demandsByProduct,
      totalDemandByProduct
    };
  }

  // =========================================================================
  // 3. ALGORITMO DE PRORRATEO HAMILTON CON DETERMINACIÓN DE DEMANDA SERVIBLE
  // =========================================================================

  /**
   * Ejecuta la asignación proporcional respetando bloqueos y calculando servibleQuantity.
   *
   * @param {Object<string, number>} demandByPlatform - Demandas solicitadas por plataforma.
   * @param {number} availableStock - Stock total utilizable.
   * @param {Array<Object>} [locks] - Bloqueos asignados.
   * @returns {Object} Resultado con trazabilidad de cada magnitud cuantitativa.
   */
  function allocateHamilton(demandByPlatform, availableStock, locks = []) {
    const warnings = [];
    const errors = [];
    const platforms = Object.keys(demandByPlatform);

    const safeStock = Math.max(0, Math.floor(Number(availableStock) || 0));
    let totalRequested = 0;

    for (const plat of platforms) {
      const qty = Math.max(0, Math.floor(Number(demandByPlatform[plat]) || 0));
      totalRequested += qty;
    }

    // Cantidad máxima físicamente servible del pedido total
    const totalServible = Math.min(totalRequested, safeStock);

    const allocations = {};
    for (const plat of platforms) {
      const requested = Math.max(0, Math.floor(Number(demandByPlatform[plat]) || 0));
      allocations[plat] = {
        requestedQuantity: requested,
        servibleQuantity: requested, // Se ajustará si stock < demanda
        lockedQuantity: 0,
        proportionalQuantity: 0,
        allocatedQuantity: 0,
        missingQuantity: requested,
        fulfillmentPercentage: 0,
        allocationMethod: 'UNFULFILLED'
      };
    }

    // PASO 1: APLICACIÓN Y VALIDACIÓN DE BLOQUEOS
    let totalLocked = 0;

    for (const lock of locks) {
      const plat = lock.platform;
      if (!allocations[plat]) continue;

      const requested = allocations[plat].requestedQuantity;
      let lockQty = 0;

      if (lock.type === 'FULL') {
        lockQty = requested;
      } else if (lock.type === 'FIXED') {
        const desired = Math.max(0, Math.floor(Number(lock.quantity) || 0));
        if (desired > requested) {
          warnings.push({
            code: 'LOCK_EXCEEDED_DEMAND',
            message: `El bloqueo fijo de ${desired} cjs para ${plat} supera su pedido de ${requested} cjs. Se acota a la demanda.`,
            context: { platform: plat, desired, requested }
          });
          lockQty = requested;
        } else {
          lockQty = desired;
        }
      }

      allocations[plat].lockedQuantity = lockQty;
      allocations[plat].allocatedQuantity = lockQty;
      allocations[plat].missingQuantity = requested - lockQty;
      allocations[plat].allocationMethod = lockQty === requested ? 'FULL' : 'LOCK';
      totalLocked += lockQty;
    }

    if (totalLocked > safeStock) {
      errors.push({
        code: 'STOCK_EXCEEDED_BY_LOCKS',
        message: `La suma de bloqueos (${totalLocked} cjs) excede el stock disponible (${safeStock} cjs).`,
        context: { totalLocked, safeStock }
      });

      return {
        allocations,
        summary: {
          requested: totalRequested,
          available: safeStock,
          servible: totalServible,
          allocated: 0,
          missing: totalRequested
        },
        warnings,
        errors,
        isPhysicallyFeasible: false
      };
    }

    const usableStock = safeStock - totalLocked;

    let residualDemandTotal = 0;
    const residualDemands = {};
    for (const plat of platforms) {
      const resDem = allocations[plat].requestedQuantity - allocations[plat].lockedQuantity;
      residualDemands[plat] = resDem;
      residualDemandTotal += resDem;
    }

    // PASO 2: ASIGNACIÓN DE DEMANDA RESIDUAL Y CÁLCULO DE SERVIBLE QUANTITY
    if (residualDemandTotal === 0 || usableStock === 0) {
      for (const plat of platforms) {
        const item = allocations[plat];
        item.servibleQuantity = item.lockedQuantity;
        item.fulfillmentPercentage = item.requestedQuantity > 0
          ? Math.round((item.allocatedQuantity / item.requestedQuantity) * 100)
          : 100;
      }
    } else if (usableStock >= residualDemandTotal) {
      // Stock suficiente: 100% servible
      for (const plat of platforms) {
        const item = allocations[plat];
        const addQty = residualDemands[plat];
        item.proportionalQuantity = addQty;
        item.allocatedQuantity += addQty;
        item.servibleQuantity = item.allocatedQuantity;
        item.missingQuantity = 0;
        item.fulfillmentPercentage = 100;
        item.allocationMethod = item.lockedQuantity > 0 ? 'LOCK_FULL' : 'FULL';
      }
    } else {
      // Stock insuficiente: Reparto Hamilton del remanente usable
      let assignedCount = 0;
      const quotas = [];

      for (const plat of platforms) {
        const dem = residualDemands[plat];
        if (dem <= 0) continue;

        const exactQuota = (dem / residualDemandTotal) * usableStock;
        const integerPart = Math.floor(exactQuota);
        const remainder = exactQuota - integerPart;

        allocations[plat].proportionalQuantity = integerPart;
        assignedCount += integerPart;

        quotas.push({
          platform: plat,
          integerPart,
          remainder,
          residualDemand: dem,
          originalRequest: allocations[plat].requestedQuantity
        });
      }

      // Desempate determinista: mayor resto -> mayor pedido inicial -> alfabético
      quotas.sort((a, b) => {
        const diffRemainder = b.remainder - a.remainder;
        if (Math.abs(diffRemainder) > 1e-9) return diffRemainder;
        const diffReq = b.originalRequest - a.originalRequest;
        if (diffReq !== 0) return diffReq;
        return a.platform.localeCompare(b.platform);
      });

      const remainderBoxesToAssign = usableStock - assignedCount;
      for (let i = 0; i < remainderBoxesToAssign; i++) {
        if (quotas[i]) {
          const plat = quotas[i].platform;
          allocations[plat].proportionalQuantity += 1;
        }
      }

      for (const plat of platforms) {
        const item = allocations[plat];
        item.allocatedQuantity = item.lockedQuantity + item.proportionalQuantity;
        item.servibleQuantity = item.allocatedQuantity;
        item.missingQuantity = item.requestedQuantity - item.allocatedQuantity;
        item.fulfillmentPercentage = item.requestedQuantity > 0
          ? Math.round((item.allocatedQuantity / item.requestedQuantity) * 100)
          : 100;

        if (item.lockedQuantity > 0 && item.proportionalQuantity > 0) {
          item.allocationMethod = 'LOCK_HAMILTON';
        } else if (item.lockedQuantity > 0) {
          item.allocationMethod = item.allocatedQuantity === item.requestedQuantity ? 'FULL' : 'LOCK';
        } else {
          item.allocationMethod = 'HAMILTON';
        }
      }
    }

    // PASO 3: INVARIANTES
    let totalAllocated = 0;
    let totalMissing = 0;
    for (const plat of platforms) {
      const item = allocations[plat];
      totalAllocated += item.allocatedQuantity;
      totalMissing += item.missingQuantity;

      if (item.allocatedQuantity > item.requestedQuantity) {
        errors.push({
          code: 'ALLOCATION_EXCEEDS_REQUEST',
          message: `Invariante violada: Asignadas ${item.allocatedQuantity} cjs a ${plat}, superior al pedido de ${item.requestedQuantity} cjs.`,
          context: { platform: plat, item }
        });
      }
    }

    if (totalAllocated > safeStock) {
      errors.push({
        code: 'ALLOCATION_EXCEEDS_STOCK',
        message: `Invariante violada: Total asignado (${totalAllocated} cjs) supera stock disponible (${safeStock} cjs).`,
        context: { totalAllocated, safeStock }
      });
    }

    if (safeStock < totalRequested && totalAllocated !== safeStock) {
      errors.push({
        code: 'STOCK_CONSERVATION_FAILURE',
        message: `Invariante violada: Cuando stock (${safeStock}) < demanda (${totalRequested}), la suma asignada (${totalAllocated}) debe coincidir con el stock.`,
        context: { totalAllocated, safeStock, totalRequested }
      });
    }

    return {
      allocations,
      summary: {
        requested: totalRequested,
        available: safeStock,
        servible: totalServible,
        allocated: totalAllocated,
        missing: totalMissing
      },
      warnings,
      errors,
      isPhysicallyFeasible: errors.length === 0
    };
  }

  // =========================================================================
  // 4. SOLUCIONADOR MONOVARIETAL FIFO SOBRE DEMANDA SERVIBLE
  // =========================================================================

  /**
   * Asigna variedades respetando la restricción monovarietal estricta:
   * 1. Cada plataforma recibe COMO MÁXIMO UNA ÚNICA VARIEDAD.
   * 2. Se opera EXCLUSIVAMENTE sobre la demanda servible real.
   * 3. Prioriza el consumo del lote viejo (Sao Paulo) hasta su límite físico.
   *
   * @param {Object<string, number>} servibleDemandByPlatform - Demanda servible real por plataforma.
   * @param {number} stockOldLot - Stock disponible del lote viejo / prioritario FIFO (Sao Paulo).
   * @param {number} stockFreshLot - Stock disponible del lote fresco (Sunstream).
   * @param {Object} [options]
   * @returns {Object} Asignación monovarietal explicable y determinista.
   */
  function solveMonovarietalFIFO(servibleDemandByPlatform, stockOldLot, stockFreshLot, options = {}) {
    const oldLotStock = Math.max(0, Math.floor(Number(stockOldLot) || 0));
    const freshLotStock = Math.max(0, Math.floor(Number(stockFreshLot) || 0));
    const oldLotName = options.oldLotName || 'Sao Paulo';
    const oldLotId = options.oldLotId || 'SAO_PAULO';
    const freshLotName = options.freshLotName || 'Sunstream';
    const freshLotId = options.freshLotId || 'SUNSTREAM';

    const warnings = [];
    const errors = [];
    const suggestedAlternatives = [];

    const activeEntries = Object.entries(servibleDemandByPlatform)
      .map(([plat, qty]) => ({ platform: plat, demand: Math.max(0, Math.floor(Number(qty) || 0)) }))
      .filter(e => e.demand > 0);

    const n = activeEntries.length;

    if (n === 0) {
      return {
        assignment: {},
        oldLotUsed: 0,
        freshLotUsed: 0,
        oldLotRemaining: oldLotStock,
        freshLotRemaining: freshLotStock,
        isExactMatch: true,
        isPhysicallyFeasible: true,
        deviation: 0,
        warnings: [],
        errors: [],
        suggestedAlternatives: []
      };
    }

    const totalCombinations = 1 << n;
    let exactMatches = [];
    let bestLowerCombo = null;
    let bestLowerSum = -1;
    let bestUpperCombo = null;
    let bestUpperSum = Infinity;

    // Buscar combinaciones de plataformas para agotar el lote viejo
    for (let mask = 0; mask < totalCombinations; mask++) {
      let currentSum = 0;
      const currentCombo = [];

      for (let j = 0; j < n; j++) {
        if ((mask >> j) & 1) {
          currentSum += activeEntries[j].demand;
          currentCombo.push(activeEntries[j]);
        }
      }

      if (currentSum === oldLotStock) {
        exactMatches.push({ sum: currentSum, combo: currentCombo });
      } else if (currentSum < oldLotStock && currentSum > bestLowerSum) {
        bestLowerSum = currentSum;
        bestLowerCombo = currentCombo;
      } else if (currentSum > oldLotStock && currentSum < bestUpperSum) {
        bestUpperSum = currentSum;
        bestUpperCombo = currentCombo;
      }
    }

    let selectedCombo = null;
    let isExactMatch = false;

    if (exactMatches.length > 0) {
      isExactMatch = true;
      exactMatches.sort((a, b) => b.combo.length - a.combo.length || a.combo[0].platform.localeCompare(b.combo[0].platform));
      selectedCombo = exactMatches[0].combo;
    } else {
      isExactMatch = false;
      selectedCombo = bestLowerCombo || [];

      const deficit = oldLotStock - (bestLowerSum >= 0 ? bestLowerSum : 0);
      suggestedAlternatives.push({
        type: 'BEST_FEASIBLE_SUBSET',
        description: `Asignar ${bestLowerSum} cjs de ${oldLotName} a [${selectedCombo.map(c => c.platform).join(', ')}], dejando ${deficit} cjs de lote viejo en almacén.`,
        oldLotAssigned: bestLowerSum,
        oldLotRemaining: deficit,
        platforms: selectedCombo.map(c => c.platform)
      });

      if (bestUpperCombo && bestUpperSum <= oldLotStock + 10) {
        const excess = bestUpperSum - oldLotStock;
        suggestedAlternatives.push({
          type: 'STOCK_SHORTAGE',
          description: `Se requerirían ${excess} cjs adicionales de ${oldLotName} para cubrir [${bestUpperCombo.map(c => c.platform).join(', ')}] (Total: ${bestUpperSum} cjs).`,
          requiredExtraStock: excess,
          platforms: bestUpperCombo.map(c => c.platform)
        });
      }

      warnings.push({
        code: 'NO_EXACT_MONOVARIETAL_MATCH',
        message: `No existe combinación que sume exactamente el lote viejo (${oldLotStock} cjs de ${oldLotName}). Mejor combinación viable inferior: ${bestLowerSum} cjs (desviación: ${deficit} cjs).`,
        context: { oldLotStock, bestLowerSum, deviation: deficit }
      });
    }

    const oldLotPlatforms = new Set(selectedCombo.map(c => c.platform));
    const assignment = {};
    let oldLotUsed = 0;
    let freshLotUsed = 0;

    for (const entry of activeEntries) {
      const plat = entry.platform;
      const dem = entry.demand;

      if (oldLotPlatforms.has(plat)) {
        assignment[plat] = {
          variety: oldLotName,
          varietyId: oldLotId,
          cajas: dem,
          isOldLot: true
        };
        oldLotUsed += dem;
      } else {
        assignment[plat] = {
          variety: freshLotName,
          varietyId: freshLotId,
          cajas: dem,
          isOldLot: false
        };
        freshLotUsed += dem;
      }
    }

    for (const [plat] of Object.entries(servibleDemandByPlatform)) {
      if (!assignment[plat]) {
        assignment[plat] = {
          variety: '-',
          varietyId: 'NONE',
          cajas: 0,
          isOldLot: false
        };
      }
    }

    let isPhysicallyFeasible = true;

    if (oldLotUsed > oldLotStock) {
      isPhysicallyFeasible = false;
      errors.push({
        code: 'OLD_LOT_STOCK_EXCEEDED',
        message: `Asignación de lote viejo (${oldLotUsed} cjs) excede stock disponible (${oldLotStock} cjs).`,
        context: { oldLotUsed, oldLotStock }
      });
    }

    if (freshLotUsed > freshLotStock) {
      isPhysicallyFeasible = false;
      errors.push({
        code: 'FRESH_LOT_STOCK_EXCEEDED',
        message: `Asignación de lote fresco (${freshLotUsed} cjs) excede stock disponible (${freshLotStock} cjs). Faltan ${freshLotUsed - freshLotStock} cjs.`,
        context: { freshLotUsed, freshLotStock, deficit: freshLotUsed - freshLotStock }
      });
    }

    const deviation = oldLotStock - oldLotUsed;

    return {
      assignment,
      oldLotUsed,
      freshLotUsed,
      oldLotRemaining: oldLotStock - oldLotUsed,
      freshLotRemaining: freshLotStock - freshLotUsed,
      isExactMatch,
      isPhysicallyFeasible,
      deviation,
      warnings,
      errors,
      suggestedAlternatives
    };
  }

  // =========================================================================
  // 5. MOTOR DE PALETIZACIÓN EXPLICABLE CON REPARTO EN RANGO [MIN, MAX]
  // =========================================================================

  /**
   * Calcula la distribución explicable de palets físicos.
   * Para productos con rango min/max (ej: 80 a 96), busca un reparto homogéneo
   * entre N palets cumpliendo minOperationalBoxes <= cajasPorPalet <= maxStandardBoxes.
   *
   * @param {number} totalBoxes - Cajas totales del producto para la plataforma.
   * @param {Object} rule - Regla de paletización ({ minOperationalBoxes, maxStandardBoxes, palletType }).
   * @returns {{
   *   palletType: string,
   *   totalBoxes: number,
   *   palletCount: number,
   *   pallets: Array<{
   *     palletNumber: number,
   *     boxes: number,
   *     capacity: number,
   *     occupancyPercentage: number,
   *     missingBoxesToMax: number,
   *     minOperationalBoxes: number,
   *     isOperationalMinimumMet: boolean,
   *     isFull: boolean
   *   }>,
   *   isOperationalMinimumMet: boolean,
   *   hasUnderfill: boolean,
   *   warnings: Array<Object>
   * }}
   */
  function calculatePalletization(totalBoxes, rule) {
    const boxes = Math.max(0, Math.floor(Number(totalBoxes) || 0));
    const maxStandard = rule && rule.maxStandardBoxes ? rule.maxStandardBoxes : 96;
    const minOperational = rule && rule.minOperationalBoxes ? rule.minOperationalBoxes : 80;
    const palletType = rule && rule.palletType ? rule.palletType : 'EURO';

    if (boxes === 0) {
      return {
        palletType,
        totalBoxes: 0,
        palletCount: 0,
        pallets: [],
        isOperationalMinimumMet: true,
        hasUnderfill: false,
        warnings: []
      };
    }

    const pallets = [];
    const warnings = [];

    // CASO A: Formato Rígido (ej. Cherry 176 o Metrochep 220) donde min === max
    if (minOperational === maxStandard) {
      const fullPallets = Math.floor(boxes / maxStandard);
      const rem = boxes % maxStandard;

      for (let i = 1; i <= fullPallets; i++) {
        pallets.push({
          palletNumber: i,
          boxes: maxStandard,
          capacity: maxStandard,
          occupancyPercentage: 100,
          missingBoxesToMax: 0,
          minOperationalBoxes: minOperational,
          isOperationalMinimumMet: true,
          isFull: true
        });
      }

      if (rem > 0) {
        const occ = parseFloat(((rem / maxStandard) * 100).toFixed(2));
        pallets.push({
          palletNumber: fullPallets + 1,
          boxes: rem,
          capacity: maxStandard,
          occupancyPercentage: occ,
          missingBoxesToMax: maxStandard - rem,
          minOperationalBoxes: minOperational,
          isOperationalMinimumMet: false,
          isFull: false
        });
        warnings.push({
          code: 'PALLET_UNDERFILL',
          message: `Palet incompleto de ${rem} cjs (${occ}%). Faltan ${maxStandard - rem} cjs para palet completo.`
        });
      }

      return {
        palletType,
        totalBoxes: boxes,
        palletCount: pallets.length,
        pallets,
        isOperationalMinimumMet: rem === 0,
        hasUnderfill: rem > 0,
        warnings
      };
    }

    // CASO B: Formato con rango min-max operativo (ej. Pera y Cocktail [80, 96])
    if (boxes <= maxStandard) {
      // 1 solo palet
      const isMinMet = boxes >= minOperational;
      const occ = parseFloat(((boxes / maxStandard) * 100).toFixed(2));
      pallets.push({
        palletNumber: 1,
        boxes,
        capacity: maxStandard,
        occupancyPercentage: occ,
        missingBoxesToMax: maxStandard - boxes,
        minOperationalBoxes: minOperational,
        isOperationalMinimumMet: isMinMet,
        isFull: boxes === maxStandard
      });

      if (!isMinMet) {
        warnings.push({
          code: 'PALLET_UNDERFILL',
          message: `Palet de ${boxes} cjs por debajo del mínimo operativo (${minOperational} cjs). Faltan ${minOperational - boxes} cjs.`
        });
      }

      return {
        palletType,
        totalBoxes: boxes,
        palletCount: 1,
        pallets,
        isOperationalMinimumMet: isMinMet,
        hasUnderfill: !isMinMet,
        warnings
      };
    }

    // Más de 1 palet: buscar k palets tal que k * min <= boxes <= k * max
    const kMin = Math.ceil(boxes / maxStandard);
    const kMax = Math.floor(boxes / minOperational);

    if (kMin <= kMax) {
      // Existe solución homogénea válida que cumple el rango en TODOS los palets
      const k = kMin; // Menor cantidad de palets de suelo requeridos
      const base = Math.floor(boxes / k);
      const remainder = boxes % k;

      for (let i = 1; i <= k; i++) {
        const pBoxes = i <= remainder ? base + 1 : base;
        const occ = parseFloat(((pBoxes / maxStandard) * 100).toFixed(2));
        pallets.push({
          palletNumber: i,
          boxes: pBoxes,
          capacity: maxStandard,
          occupancyPercentage: occ,
          missingBoxesToMax: maxStandard - pBoxes,
          minOperationalBoxes: minOperational,
          isOperationalMinimumMet: pBoxes >= minOperational,
          isFull: pBoxes === maxStandard
        });
      }

      return {
        palletType,
        totalBoxes: boxes,
        palletCount: k,
        pallets,
        isOperationalMinimumMet: true,
        hasUnderfill: false,
        warnings
      };
    } else {
      // Cae en un hueco donde no caben k palets de >= min (ej. 97 a 159 cajas)
      // Se llenan palets completos de 96 y el remanente genera aviso de underfill
      const fullCount = Math.floor(boxes / maxStandard);
      const rem = boxes % maxStandard;

      for (let i = 1; i <= fullCount; i++) {
        pallets.push({
          palletNumber: i,
          boxes: maxStandard,
          capacity: maxStandard,
          occupancyPercentage: 100,
          missingBoxesToMax: 0,
          minOperationalBoxes: minOperational,
          isOperationalMinimumMet: true,
          isFull: true
        });
      }

      if (rem > 0) {
        const isMinMet = rem >= minOperational;
        const occ = parseFloat(((rem / maxStandard) * 100).toFixed(2));
        pallets.push({
          palletNumber: fullCount + 1,
          boxes: rem,
          capacity: maxStandard,
          occupancyPercentage: occ,
          missingBoxesToMax: maxStandard - rem,
          minOperationalBoxes: minOperational,
          isOperationalMinimumMet: isMinMet,
          isFull: false
        });

        if (!isMinMet) {
          warnings.push({
            code: 'PALLET_UNDERFILL',
            message: `Palet remanente de ${rem} cjs por debajo del mínimo operativo (${minOperational} cjs). Faltan ${minOperational - rem} cjs.`
          });
        }
      }

      const allMinMet = pallets.every(p => p.isOperationalMinimumMet);

      return {
        palletType,
        totalBoxes: boxes,
        palletCount: pallets.length,
        pallets,
        isOperationalMinimumMet: allMinMet,
        hasUnderfill: !allMinMet,
        warnings
      };
    }
  }

  // =========================================================================
  // 6. PLANIFICACIÓN CONSOLIDADA DE CARGA (PIPELINE COMPLETO)
  // =========================================================================

  /**
   * Orquestador central que aplica el pipeline conceptual:
   * DEMANDA -> STOCK DISPONIBLE -> CANTIDAD SERVIBLE -> ASIGNACIÓN -> RESTRICCIONES DE VARIEDAD/FIFO -> RESULTADO
   *
   * @param {Object} params
   * @returns {Object} PlanningResult
   */
  function planConsolidatedLoad(params) {
    const {
      orderLines = [],
      stockConfig = {},
      locks = [],
      exclusions = [],
      customCatalog = DEFAULT_CATALOG
    } = params;

    const catalog = { ...DEFAULT_CATALOG, ...customCatalog };
    const globalWarnings = [];
    const globalErrors = [];

    // 1. Agregación y exclusiones
    const aggregated = aggregateDemands(orderLines, exclusions);
    const { platforms, demandsByProduct } = aggregated;

    const deliveryDate = orderLines.length > 0 ? (orderLines[0].deliveryDate || '') : '';
    const allocationsResult = [];
    const productSummaries = {};
    const platformSummaries = {};

    for (const plat of platforms) {
      platformSummaries[plat] = {
        platform: plat,
        totalBoxes: 0,
        itemsByProduct: {},
        palletsSummary: []
      };
    }

    // 2. Procesamiento por producto
    for (const [prodKey, demands] of Object.entries(demandsByProduct)) {
      const prodDef = catalog.products[prodKey] || {
        id: prodKey,
        name: prodKey,
        hasMonovarietalRestriction: false
      };
      const palletRule = (catalog.palletRules && catalog.palletRules[prodKey]) || {
        productId: prodKey,
        palletType: 'EURO',
        minOperationalBoxes: 80,
        maxStandardBoxes: 96
      };

      if (prodDef.hasMonovarietalRestriction) {
        // --- COCKTAIL ROMÁNTICO: PIPELINE CON DEMANDA SERVIBLE Y MONOVARIETAL FIFO ---
        const stockOld = stockConfig[prodKey]?.oldLotStock ?? stockConfig.cocktailSaoStock ?? 0;
        const stockFresh = stockConfig[prodKey]?.freshLotStock ?? stockConfig.cocktailSunStock ?? 0;
        const totalAvailCocktail = stockOld + stockFresh;

        // PASO A: Determinar demanda servible por plataforma usando Hamilton
        const prodLocks = locks.filter(l => l.productId === prodKey);
        const baseAlloc = allocateHamilton(demands, totalAvailCocktail, prodLocks);

        if (baseAlloc.warnings.length > 0) globalWarnings.push(...baseAlloc.warnings);
        if (baseAlloc.errors.length > 0) globalErrors.push(...baseAlloc.errors);

        // PASO B: Resolver asignación monovarietal sobre la demanda servible real
        const servibleDemand = {};
        for (const plat of platforms) {
          servibleDemand[plat] = baseAlloc.allocations[plat]?.allocatedQuantity || 0;
        }

        const monoRes = solveMonovarietalFIFO(servibleDemand, stockOld, stockFresh, {
          oldLotName: 'Sao Paulo',
          oldLotId: 'SAO_PAULO',
          freshLotName: 'Sunstream',
          freshLotId: 'SUNSTREAM'
        });

        if (monoRes.warnings.length > 0) globalWarnings.push(...monoRes.warnings);
        if (monoRes.errors.length > 0) globalErrors.push(...monoRes.errors);

        let totalProdRequested = 0;
        let totalProdAllocated = 0;

        for (const plat of platforms) {
          const req = demands[plat] || 0;
          const baseItem = baseAlloc.allocations[plat];
          const servibleQty = baseItem.servibleQuantity;
          const assignedItem = monoRes.assignment[plat] || { variety: '-', cajas: 0, isOldLot: false, varietyId: 'NONE' };
          const allocQty = assignedItem.cajas;
          const missingQty = Math.max(0, req - allocQty);

          totalProdRequested += req;
          totalProdAllocated += allocQty;

          const palletCalc = calculatePalletization(allocQty, palletRule);
          if (palletCalc.hasUnderfill && allocQty > 0) {
            globalWarnings.push({
              code: 'PALLET_UNDERFILL',
              message: `${plat}: ${allocQty} cjs de ${prodDef.name} presenta underfill en palet.`,
              context: { platform: plat, product: prodKey, palletCalc }
            });
          }

          allocationsResult.push({
            platform: plat,
            productId: prodKey,
            productName: prodDef.name,
            varietyId: assignedItem.varietyId,
            varietyName: assignedItem.variety,
            isOldLot: assignedItem.isOldLot,
            requestedQuantity: req,
            servibleQuantity: servibleQty,
            lockedQuantity: baseItem.lockedQuantity,
            proportionalQuantity: baseItem.proportionalQuantity,
            allocatedQuantity: allocQty,
            missingQuantity: missingQty,
            fulfillmentPercentage: req > 0 ? Math.round((allocQty / req) * 100) : 100,
            allocationMethod: 'MONOVARIETAL',
            palletDetails: palletCalc
          });

          platformSummaries[plat].totalBoxes += allocQty;
          platformSummaries[plat].itemsByProduct[prodKey] = {
            allocatedQuantity: allocQty,
            variety: assignedItem.variety,
            palletDetails: palletCalc
          };
          platformSummaries[plat].palletsSummary.push(palletCalc);
        }

        productSummaries[prodKey] = {
          productId: prodKey,
          productName: prodDef.name,
          requested: totalProdRequested,
          available: totalAvailCocktail,
          servible: baseAlloc.summary.servible,
          allocated: totalProdAllocated,
          missing: Math.max(0, totalProdRequested - totalProdAllocated),
          monovarietalDetails: {
            oldLotUsed: monoRes.oldLotUsed,
            oldLotRemaining: monoRes.oldLotRemaining,
            freshLotUsed: monoRes.freshLotUsed,
            freshLotRemaining: monoRes.freshLotRemaining,
            isExactMatch: monoRes.isExactMatch,
            deviation: monoRes.deviation,
            suggestedAlternatives: monoRes.suggestedAlternatives
          }
        };

      } else {
        // --- CASO ESTÁNDAR (PERA RAMA, CHERRY): HAMILTON DIRECTO CON BLOQUEOS ---
        const prodStock = typeof stockConfig[prodKey] === 'number'
          ? stockConfig[prodKey]
          : (stockConfig[prodKey]?.stock ?? (prodKey === 'PERA_RAMA' ? stockConfig.peraStock ?? 0 : 0));

        const prodLocks = locks.filter(l => l.productId === prodKey);
        const hamRes = allocateHamilton(demands, prodStock, prodLocks);

        if (hamRes.warnings.length > 0) globalWarnings.push(...hamRes.warnings);
        if (hamRes.errors.length > 0) globalErrors.push(...hamRes.errors);

        for (const plat of platforms) {
          const allocItem = hamRes.allocations[plat];
          const palletCalc = calculatePalletization(allocItem.allocatedQuantity, palletRule);

          if (palletCalc.hasUnderfill && allocItem.allocatedQuantity > 0) {
            globalWarnings.push({
              code: 'PALLET_UNDERFILL',
              message: `${plat}: ${allocItem.allocatedQuantity} cjs de ${prodDef.name} presenta underfill en palet.`,
              context: { platform: plat, product: prodKey, palletCalc }
            });
          }

          allocationsResult.push({
            platform: plat,
            productId: prodKey,
            productName: prodDef.name,
            varietyId: null,
            varietyName: 'Estándar',
            isOldLot: false,
            requestedQuantity: allocItem.requestedQuantity,
            servibleQuantity: allocItem.servibleQuantity,
            lockedQuantity: allocItem.lockedQuantity,
            proportionalQuantity: allocItem.proportionalQuantity,
            allocatedQuantity: allocItem.allocatedQuantity,
            missingQuantity: allocItem.missingQuantity,
            fulfillmentPercentage: allocItem.fulfillmentPercentage,
            allocationMethod: allocItem.allocationMethod,
            palletDetails: palletCalc
          });

          platformSummaries[plat].totalBoxes += allocItem.allocatedQuantity;
          platformSummaries[plat].itemsByProduct[prodKey] = {
            allocatedQuantity: allocItem.allocatedQuantity,
            variety: 'Estándar',
            palletDetails: palletCalc
          };
          platformSummaries[plat].palletsSummary.push(palletCalc);
        }

        productSummaries[prodKey] = {
          productId: prodKey,
          productName: prodDef.name,
          requested: hamRes.summary.requested,
          available: hamRes.summary.available,
          servible: hamRes.summary.servible,
          allocated: hamRes.summary.allocated,
          missing: hamRes.summary.missing
        };
      }
    }

    const isPhysicallyFeasible = globalErrors.length === 0;

    return {
      deliveryDate,
      platforms,
      allocations: allocationsResult,
      productSummaries,
      platformSummaries,
      warnings: globalWarnings,
      errors: globalErrors,
      isPhysicallyFeasible,
      timestamp: new Date().toISOString()
    };
  }

  return {
    DEFAULT_CATALOG,
    parseRawForecast,
    aggregateDemands,
    allocateHamilton,
    solveMonovarietalFIFO,
    calculatePalletization,
    planConsolidatedLoad
  };
});

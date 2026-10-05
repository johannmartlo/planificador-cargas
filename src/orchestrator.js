/**
 * Orquestador Central del Planificador de Carga Hortofrutícola
 *
 * Módulo puro, determinista y desacoplado del DOM.
 * Arquitectura UMD compatible con Node.js y navegador sin bundlers ni frameworks.
 *
 * Pipeline integral:
 * RAW TEXT
 * -> PARSER (parseForecast)
 * -> VALIDACIÓN
 * -> EXCLUSIONES (PRODUCT, PLATFORM, LINE)
 * -> AGREGACIÓN DE DEMANDA (aggregateDemands)
 * -> STOCK DISPONIBLE POR TUPLA (productId, varietyId)
 * -> ASIGNACIÓN DE CARGA (Hamilton / Cocktail Monovarietal FIFO)
 * -> MOTOR DE PALETIZACIÓN (planPallets)
 * -> PLANNING RESULT SERIALIZABLE CON BALANCE CUANTITATIVO
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { DEFAULT_CATALOG, getStockKey, createStockItem, getProductVarieties } = require('./catalog.js');
    const { parseForecast, aggregateDemands } = require('./parser.js');
    const { allocateProportionalHamilton } = require('./hamilton.js');
    const { solveMonovarietalFIFO } = require('./cocktail-solver.js');
    const { DEFAULT_PALLET_RULES, planPallets } = require('./palletizer.js');

    module.exports = factory(
      DEFAULT_CATALOG,
      getStockKey,
      createStockItem,
      getProductVarieties,
      parseForecast,
      aggregateDemands,
      allocateProportionalHamilton,
      solveMonovarietalFIFO,
      DEFAULT_PALLET_RULES,
      planPallets
    );
  } else {
    root.LogisticsOrchestrator = factory(
      root.LogisticsCatalog.DEFAULT_CATALOG,
      root.LogisticsCatalog.getStockKey,
      root.LogisticsCatalog.createStockItem,
      root.LogisticsCatalog.getProductVarieties,
      root.LogisticsParser.parseForecast,
      root.LogisticsParser.aggregateDemands,
      root.LogisticsHamilton.allocateProportionalHamilton,
      root.LogisticsCocktail.solveMonovarietalFIFO,
      root.LogisticsPalletizer.DEFAULT_PALLET_RULES,
      root.LogisticsPalletizer.planPallets
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  DEFAULT_CATALOG,
  getStockKey,
  createStockItem,
  getProductVarieties,
  parseForecast,
  aggregateDemands,
  allocateProportionalHamilton,
  solveMonovarietalFIFO,
  DEFAULT_PALLET_RULES,
  planPallets
) {
  'use strict';

  // Producto comercial único de Cocktail. Sus variedades físicas (CONSABOR, SUNSTREAM,
  // SAO_PAULO) son internas y se resuelven SIEMPRE por stock, nunca por la previsión.
  const COCKTAIL_PRODUCT_ID = 'COCKTAIL_ROMANTICO';

  /**
   * Variedades físicas registradas en catálogo para un producto comercial.
   * @param {string} productId
   * @returns {Array<string>}
   */
  function getVarietyIds(productId) {
    return getProductVarieties(productId, DEFAULT_CATALOG).map(v => v.id);
  }

  // =========================================================================
  // 1. VALIDACIÓN Y NORMALIZACIÓN DE STOCK
  // =========================================================================

  /**
   * Valida defensivamente la integridad física del stock de entrada.
   * Rechaza:
   * - Stock negativo (INVALID_STOCK_NEGATIVE)
   * - Stock decimal (INVALID_STOCK_DECIMAL)
   * - Stock NaN, Infinity o no numérico (INVALID_STOCK_NAN)
   *
   * @param {Array|Object} stockInput
   * @returns {{ isValid: boolean, errors: Array<Object> }}
   */
  function validateStock(stockInput) {
    const errors = [];
    if (!stockInput) return { isValid: true, errors: [] };

    function checkNumericValue(key, val) {
      if (val === null || val === undefined || typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        errors.push({
          code: 'INVALID_STOCK_NAN',
          message: `Valor de stock no numérico, NaN o infinito (${val}) para '${key}'.`,
          context: { key, value: val }
        });
        return;
      }
      if (!Number.isInteger(val)) {
        errors.push({
          code: 'INVALID_STOCK_DECIMAL',
          message: `Valor de stock decimal (${val}) no permitido para '${key}'. Solo se admiten cajas enteras.`,
          context: { key, value: val }
        });
        return;
      }
      if (val < 0) {
        errors.push({
          code: 'INVALID_STOCK_NEGATIVE',
          message: `Valor de stock negativo (${val}) no permitido para '${key}'.`,
          context: { key, value: val }
        });
        return;
      }
    }

    if (Array.isArray(stockInput)) {
      for (let i = 0; i < stockInput.length; i++) {
        const item = stockInput[i];
        if (!item || typeof item !== 'object') {
          errors.push({
            code: 'INVALID_STOCK_NAN',
            message: `Elemento de stock inválido en índice ${i}.`,
            context: { index: i, item }
          });
          continue;
        }
        const key = `${item.productId || 'UNKNOWN'}::${item.varietyId || 'STANDARD'}`;
        const rawQty = item.availableQuantity !== undefined ? item.availableQuantity : item.available;
        checkNumericValue(key, rawQty);
      }
    } else if (typeof stockInput === 'object') {
      const entries = stockInput instanceof Map ? stockInput.entries() : Object.entries(stockInput);
      for (const [k, val] of entries) {
        if (typeof val === 'number' || typeof val !== 'object' || val === null) {
          checkNumericValue(k, val);
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          for (const [subKey, subVal] of Object.entries(val)) {
            checkNumericValue(`${k}::${subKey}`, subVal);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Normaliza la entrada de stock a un Map con clave `productId::varietyId`.
   *
   * Formatos soportados:
   * - Array de StockItem: [ { productId, varietyId, availableQuantity } ]
   * - Objeto con claves compuestas: { 'PERA_RAMA::STANDARD': 320, 'COCKTAIL_ROMANTICO::CONSABOR': 100 }
   * - Objeto anidado: { COCKTAIL_ROMANTICO: { CONSABOR: 100, SUNSTREAM: 40, SAO_PAULO: 20 }, PERA_RAMA: 320 }
   * - Objeto plano: { PERA_RAMA: 320, CHERRY_RAMA: 100, CONSABOR: 100, SUNSTREAM: 40, SAO_PAULO: 20 }
   *
   * @param {Array|Object} stockInput
   * @returns {Map<string, { productId: string, varietyId: string|null, available: number, stockKey: string }>}
   */
  function normalizeStockInput(stockInput) {
    const stockMap = new Map();

    if (!stockInput) return stockMap;

    // Caso 1: Array de objetos StockItem
    if (Array.isArray(stockInput)) {
      for (const item of stockInput) {
        if (!item || typeof item !== 'object') continue;
        const pId = String(item.productId || '').trim().toUpperCase();
        const vId = item.varietyId ? String(item.varietyId).trim().toUpperCase() : null;
        const qty = Math.max(0, Math.floor(Number(item.availableQuantity !== undefined ? item.availableQuantity : item.available || 0)));
        const key = getStockKey(pId, vId);
        stockMap.set(key, { productId: pId, varietyId: vId, available: qty, stockKey: key });
      }
      return stockMap;
    }

    // Caso 2: Objeto o Map
    if (typeof stockInput === 'object') {
      const entries = stockInput instanceof Map ? stockInput.entries() : Object.entries(stockInput);

      for (const [k, val] of entries) {
        if (typeof val === 'number') {
          const qty = Math.max(0, Math.floor(val));

          // Si la clave ya tiene formato compuesto "PRODUCT::VARIETY"
          if (k.includes('::')) {
            const [pId, vPart] = k.split('::');
            const vId = (!vPart || vPart === 'STANDARD' || vPart === 'NULL') ? null : vPart.trim().toUpperCase();
            const key = getStockKey(pId.trim().toUpperCase(), vId);
            stockMap.set(key, { productId: pId.trim().toUpperCase(), varietyId: vId, available: qty, stockKey: key });
          } else {
            const cleanKey = k.trim().toUpperCase();
            // Si la clave es un producto directo
            if (cleanKey === 'PERA_RAMA') {
              const key = getStockKey('PERA_RAMA', null);
              stockMap.set(key, { productId: 'PERA_RAMA', varietyId: null, available: qty, stockKey: key });
            } else if (cleanKey === 'CHERRY_RAMA') {
              const key = getStockKey('CHERRY_RAMA', 'SUNSTREAM');
              stockMap.set(key, { productId: 'CHERRY_RAMA', varietyId: 'SUNSTREAM', available: qty, stockKey: key });
            } else if (cleanKey === 'CONSABOR') {
              // Variedad interna de Cocktail Romántico (mismo artículo comercial, GIS 16228)
              const key = getStockKey(COCKTAIL_PRODUCT_ID, 'CONSABOR');
              stockMap.set(key, { productId: COCKTAIL_PRODUCT_ID, varietyId: 'CONSABOR', available: qty, stockKey: key });
            } else if (cleanKey === 'SAO_PAULO') {
              const key = getStockKey('COCKTAIL_ROMANTICO', 'SAO_PAULO');
              stockMap.set(key, { productId: 'COCKTAIL_ROMANTICO', varietyId: 'SAO_PAULO', available: qty, stockKey: key });
            } else if (cleanKey === 'SUNSTREAM') {
              // Si viene 'SUNSTREAM' suelto, corresponde a Cocktail Sunstream si ya existe Cherry o por defecto
              const key = getStockKey('COCKTAIL_ROMANTICO', 'SUNSTREAM');
              stockMap.set(key, { productId: 'COCKTAIL_ROMANTICO', varietyId: 'SUNSTREAM', available: qty, stockKey: key });
            } else {
              const key = getStockKey(cleanKey, null);
              stockMap.set(key, { productId: cleanKey, varietyId: null, available: qty, stockKey: key });
            }
          }
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Objeto anidado: { COCKTAIL_ROMANTICO: { SAO_PAULO: 59, SUNSTREAM: 43 } }
          const pId = k.trim().toUpperCase();
          for (const [varName, subQty] of Object.entries(val)) {
            const vId = (!varName || varName === 'STANDARD' || varName === 'NULL') ? null : varName.trim().toUpperCase();
            const numQty = Math.max(0, Math.floor(Number(subQty) || 0));
            const key = getStockKey(pId, vId);
            stockMap.set(key, { productId: pId, varietyId: vId, available: numQty, stockKey: key });
          }
        }
      }
    }

    return stockMap;
  }

  // =========================================================================
  // 2. GESTIÓN DE EXCLUSIONES (PRODUCT, PLATFORM, LINE)
  // =========================================================================

  /**
   * Normaliza y evalúa las reglas de exclusión sobre una línea de previsión.
   *
   * @param {Array|Object} exclusionsInput
   * @returns {{
   *   isExcluded: (line: Object) => { excluded: boolean, reason?: string, type?: string },
   *   rules: Array<Object>
   * }}
   */
  function buildExclusionFilter(exclusionsInput) {
    const rules = [];

    if (!exclusionsInput) {
      return { isExcluded: () => ({ excluded: false }), rules: [] };
    }

    if (Array.isArray(exclusionsInput)) {
      for (const item of exclusionsInput) {
        if (!item) continue;
        if (typeof item === 'string') {
          rules.push({ type: 'UNKNOWN', value: item.trim().toUpperCase(), reason: 'Exclusión general' });
        } else if (typeof item === 'object') {
          rules.push({
            type: String(item.type || 'UNKNOWN').trim().toUpperCase(),
            value: typeof item.value === 'string' ? item.value.trim().toUpperCase() : item.value,
            reason: item.reason || 'Exclusión manual'
          });
        }
      }
    } else if (typeof exclusionsInput === 'object') {
      if (Array.isArray(exclusionsInput.products)) {
        for (const p of exclusionsInput.products) {
          rules.push({ type: 'PRODUCT', value: String(p).trim().toUpperCase(), reason: 'Producto excluido' });
        }
      }
      if (Array.isArray(exclusionsInput.platforms)) {
        for (const plat of exclusionsInput.platforms) {
          rules.push({ type: 'PLATFORM', value: String(plat).trim().toUpperCase(), reason: 'Plataforma excluida' });
        }
      }
      if (Array.isArray(exclusionsInput.lines)) {
        for (const l of exclusionsInput.lines) {
          rules.push({ type: 'LINE', value: Number(l), reason: 'Línea de pedido excluida' });
        }
      }
    }

    function isExcluded(line) {
      for (const r of rules) {
        if (r.type === 'PRODUCT' && line.productId === r.value) {
          return { excluded: true, reason: r.reason, type: 'PRODUCT', value: r.value };
        }
        if (r.type === 'PLATFORM' && line.platform === r.value) {
          return { excluded: true, reason: r.reason, type: 'PLATFORM', value: r.value };
        }
        if (r.type === 'LINE' && Number(line.lineNumber) === Number(r.value)) {
          return { excluded: true, reason: r.reason, type: 'LINE', value: r.value };
        }
        if (r.type === 'UNKNOWN') {
          if (line.productId === r.value || line.platform === r.value) {
            return { excluded: true, reason: r.reason, type: 'UNKNOWN', value: r.value };
          }
        }
      }
      return { excluded: false };
    }

    return { isExcluded, rules };
  }

  // =========================================================================
  // 3. FUNCIÓN PURA PRINCIPAL: planLoad
  // =========================================================================

  /**
   * Orquesta la planificación de carga completa.
   *
   * @param {Object} options
   * @param {string} options.rawText - Texto bruto del email.
   * @param {Object} [options.catalogConfig] - Catálogo o configuración personalizada.
   * @param {Array|Object} [options.stock] - Stock físico disponible en almacén.
   * @param {Array<Object>} [options.locks=[]] - Bloqueos prioritarios (FULL / FIXED).
   * @param {Array|Object} [options.exclusions=[]] - Reglas de exclusión (PRODUCT, PLATFORM, LINE).
   * @param {Object|Function} [options.palletConfiguration={}] - Configuración de tipos de palet.
   * @returns {Object} PlanningResult completo, estructurado y serializable a JSON.
   */
  function planLoad(options = {}) {
    const warnings = [];
    const errors = [];

    const {
      rawText = '',
      catalogConfig = DEFAULT_CATALOG,
      stock = {},
      locks = [],
      exclusions = [],
      palletConfiguration = {},
      demandOrders = null,
      targetDeliveryDate = null
    } = options;

    let allParsedLines = [];
    let detectedDates = [];
    let effectiveDeliveryDate = null;
    let sourceDate = null;

    if (Array.isArray(demandOrders) && demandOrders.length > 0) {
      allParsedLines = demandOrders.map((ord, idx) => {
        const orderId = String(ord.id || ord.orderId || `ord_${idx + 1}`).trim();
        const isActive = (ord.active !== false) && (ord.estado ? ord.estado === 'ACTIVO' : (ord.isValid !== false));
        return {
          id: orderId,
          orderId,
          rawText: ord.sourceLine || `${ord.platform} ${ord.fechaEntrega || ord.deliveryDate || ''} ${ord.productId} ${ord.cajas !== undefined ? ord.cajas : ord.requestedQuantity}`,
          lineNumber: idx + 1,
          platform: String(ord.platform || '').trim().toUpperCase(),
          deliveryDate: String(ord.fechaEntrega || ord.deliveryDate || '').trim(),
          sourceDate: null,
          gisCode: ord.gisCode || '',
          productDescription: ord.productDescription || ord.productId,
          productId: String(ord.productId || '').trim().toUpperCase(),
          varietyId: ord.varietyId ? String(ord.varietyId).trim().toUpperCase() : null,
          requestedQuantity: Number(ord.cajas !== undefined ? ord.cajas : ord.requestedQuantity) || 0,
          isValid: isActive,
          origen: ord.origen || 'MANUAL',
          estado: ord.estado || (isActive ? 'ACTIVO' : 'INACTIVO'),
          parseErrors: []
        };
      });
      detectedDates = Array.from(new Set(allParsedLines.map(l => l.deliveryDate).filter(Boolean)));
      effectiveDeliveryDate = targetDeliveryDate || (detectedDates && detectedDates[0]) || null;
    } else {
      const parseFn = parseForecast || parseRawText;
      const parseResult = parseFn(rawText, catalogConfig);

      if (parseResult.parsingWarnings && parseResult.parsingWarnings.length > 0) {
        for (const w of parseResult.parsingWarnings) {
          warnings.push({
            code: w.code || 'PARSER_WARNING',
            message: w.message,
            context: w.context
          });
        }
      }

      if (parseResult.parsingErrors && parseResult.parsingErrors.length > 0) {
        for (const err of parseResult.parsingErrors) {
          warnings.push({
            code: 'PARSER_LINE_ERROR',
            lineNumber: err.lineNumber,
            message: err.message,
            rawText: err.rawText
          });
        }
      }

      allParsedLines = (parseResult.lines || []).map((l, idx) => ({
        ...l,
        orderId: l.id || `line_${l.lineNumber || idx + 1}`,
        deliveryDate: String(l.deliveryDate || '').trim()
      }));
      sourceDate = (allParsedLines.find(l => l.sourceDate) || {}).sourceDate || null;
      detectedDates = parseResult.detectedDates || (parseResult.detectedDate ? [parseResult.detectedDate] : []);
      effectiveDeliveryDate = targetDeliveryDate || parseResult.detectedDate || null;
    }

    const validLines = allParsedLines.filter(l => l && l.isValid);

    if (validLines.length === 0) {
      errors.push({
        code: 'NO_VALID_LINES_PARSED',
        message: 'No se encontraron líneas de pedido válidas en el texto suministrado.'
      });

      return {
        deliveryDate: effectiveDeliveryDate,
        detectedDates,
        sourceDate,
        sourceSummary: {
          totalLinesParsed: allParsedLines.length,
          validLinesCount: 0,
          lines: allParsedLines
        },
        demandSummary: { totalRequested: 0, byProduct: {}, byPlatform: {} },
        exclusionsSummary: { excludedLinesCount: 0, excludedProducts: [], excludedPlatforms: [], details: [] },
        allocations: [],
        palletSummaries: { totalBoxes: 0, totalPallets: 0, groups: [], byPlatform: {}, byProduct: {}, byPalletType: {} },
        stockRemaining: [],
        warnings,
        errors,
        isPhysicallyFeasible: false
      };
    }

    // -----------------------------------------------------------------------
    // PASO 2 Y 3: EXCLUSIONES Y AGREGACIÓN DE DEMANDA
    // -----------------------------------------------------------------------
    const { isExcluded } = buildExclusionFilter(exclusions);

    const activeLines = [];
    const excludedDetails = [];
    const excludedProductsSet = new Set();
    const excludedPlatformsSet = new Set();

    for (const line of validLines) {
      const check = isExcluded(line);
      if (check.excluded) {
        excludedDetails.push({
          lineNumber: line.lineNumber,
          platform: line.platform,
          productId: line.productId,
          gisCode: line.gisCode,
          requestedQuantity: line.requestedQuantity,
          reason: check.reason,
          rawText: line.rawText
        });
        excludedProductsSet.add(line.productId);
        excludedPlatformsSet.add(line.platform);

        warnings.push({
          code: 'LINE_EXCLUDED',
          lineNumber: line.lineNumber,
          platform: line.platform,
          productId: line.productId,
          message: `Línea ${line.lineNumber} (${line.platform} - ${line.productId}) excluida: ${check.reason}`
        });
      } else {
        activeLines.push(line);
      }
    }

    const aggregated = aggregateDemands(activeLines);

    // Resumen de demanda activa
    const totalRequested = aggregated.totalGeneral || 0;
    const demandByProduct = { ...(aggregated.totalByProduct || {}) };
    const demandByPlatform = {};

    for (const prodId of Object.keys(aggregated.demandsByProduct || {})) {
      const platMap = aggregated.demandsByProduct[prodId];
      for (const plat of Object.keys(platMap)) {
        const q = platMap[plat] || 0;
        demandByPlatform[plat] = (demandByPlatform[plat] || 0) + q;
      }
    }

    const productDemands = aggregated.demandsByProduct || {};

    // -----------------------------------------------------------------------
    // PASO 4: VALIDACIÓN Y RESOLUCIÓN DE STOCK Y ASIGNACIÓN POR PRODUCTO
    // -----------------------------------------------------------------------
    const stockValidation = validateStock(stock);
    if (!stockValidation.isValid) {
      for (const err of stockValidation.errors) {
        errors.push(err);
      }
      return {
        deliveryDate: effectiveDeliveryDate,
        detectedDates,
        sourceDate,
        sourceSummary: {
          totalLinesParsed: allParsedLines.length,
          validLinesCount: validLines.length,
          lines: allParsedLines
        },
        demandSummary: {
          totalRequested,
          byProduct: demandByProduct,
          byPlatform: demandByPlatform
        },
        exclusionsSummary: {
          excludedLinesCount: excludedDetails.length,
          excludedProducts: Array.from(excludedProductsSet),
          excludedPlatforms: Array.from(excludedPlatformsSet),
          details: excludedDetails
        },
        allocations: [],
        palletSummaries: { totalBoxes: 0, totalPallets: 0, groups: [], byPlatform: {}, byProduct: {}, byPalletType: {} },
        stockRemaining: [],
        warnings,
        errors,
        isPhysicallyFeasible: false
      };
    }

    const stockMap = normalizeStockInput(stock);
    const finalAllocations = [];
    const usedStockMap = new Map();

    function recordUsedStock(pId, vId, qty) {
      const key = getStockKey(pId, vId);
      const prev = usedStockMap.get(key) || 0;
      usedStockMap.set(key, prev + qty);
    }

    function getAvailableStock(pId, vId) {
      const key = getStockKey(pId, vId);
      const entry = stockMap.get(key);
      return entry ? entry.available : 0;
    }

    // Procesar todos los productos comerciales presentes en la demanda
    const productKeys = Object.keys(productDemands);

    // Detección de productos en demanda sin stock registrado (Requisito 2 Hardening)
    for (const pId of productKeys) {
      if (pId === COCKTAIL_PRODUCT_ID) {
        // Producto comercial único con N variedades físicas internas: solo procede avisar
        // de ausencia de stock si NINGUNA variedad registrada tiene stock declarado.
        const varietyIds = getVarietyIds(COCKTAIL_PRODUCT_ID);
        const hasAnyVarietyStock = varietyIds.some(vId => stockMap.has(getStockKey(COCKTAIL_PRODUCT_ID, vId)));
        if (!hasAnyVarietyStock) {
          warnings.push({
            code: 'PRODUCT_WITHOUT_STOCK',
            productId: COCKTAIL_PRODUCT_ID,
            message: `Demanda de COCKTAIL_ROMANTICO presente (${demandByProduct['COCKTAIL_ROMANTICO']} cjs), pero no se ha registrado stock disponible en el almacén.`
          });
          for (const vId of varietyIds) {
            const key = getStockKey(COCKTAIL_PRODUCT_ID, vId);
            if (!stockMap.has(key)) {
              stockMap.set(key, { productId: COCKTAIL_PRODUCT_ID, varietyId: vId, available: 0, stockKey: key });
            }
          }
        }
      } else {
        const vId = (pId === 'CHERRY_RAMA') ? 'SUNSTREAM' : null;
        const key = getStockKey(pId, vId);
        if (!stockMap.has(key)) {
          warnings.push({
            code: 'PRODUCT_WITHOUT_STOCK',
            productId: pId,
            message: `Demanda de ${pId} presente (${demandByProduct[pId]} cjs), pero no se ha registrado stock disponible en el almacén.`
          });
          stockMap.set(key, { productId: pId, varietyId: vId, available: 0, stockKey: key });
        }
      }
    }

    for (const pId of productKeys) {
      // Pedidos activos para este producto comercial
      const productLines = activeLines.filter(l => l.productId === pId);
      if (productLines.length === 0) continue;

      // Construir mapa de demanda por pedido individual y mapa de resolución inversa
      const solverDemandMap = {};
      const solverKeyToLine = new Map();

      for (let idx = 0; idx < productLines.length; idx++) {
        const line = productLines[idx];
        const baseKey = String(line.orderId || line.id || `line_${line.lineNumber || idx + 1}`).trim();
        let uniqueKey = baseKey;
        if (solverDemandMap[uniqueKey] !== undefined) {
          uniqueKey = `${baseKey}__${idx + 1}`;
        }
        solverDemandMap[uniqueKey] = Math.max(0, Math.floor(Number(line.requestedQuantity) || 0));
        solverKeyToLine.set(uniqueKey, line);
      }

      // Filtrar y validar locks para este producto
      const productAdaptedLocks = [];
      if (Array.isArray(locks)) {
        for (const l of locks) {
          if (!l || String(l.productId || '').trim().toUpperCase() !== pId) continue;
          const lockPlat = l.platform ? String(l.platform).trim().toUpperCase() : null;
          const lockOrderId = (l.orderId || l.id) ? String(l.orderId || l.id).trim() : null;
          const lockDate = (l.deliveryDate || l.fechaEntrega) ? String(l.deliveryDate || l.fechaEntrega).trim() : null;

          for (const [sKey, line] of solverKeyToLine.entries()) {
            let matches = false;
            if (lockOrderId && (line.orderId === lockOrderId || line.id === lockOrderId)) {
              matches = true;
            } else if (!lockOrderId && lockPlat && line.platform === lockPlat) {
              if (!lockDate || line.deliveryDate === lockDate) {
                matches = true;
              }
            }
            if (matches) {
              productAdaptedLocks.push({
                platform: sKey,
                type: l.type,
                quantity: l.quantity,
                varietyId: l.varietyId ? String(l.varietyId).trim().toUpperCase() : null
              });
            }
          }
        }
      }

      // Validar conflictos de locks sobre la misma entidad de demanda
      const locksByTarget = new Map();
      for (const al of productAdaptedLocks) {
        if (!locksByTarget.has(al.platform)) locksByTarget.set(al.platform, []);
        locksByTarget.get(al.platform).push(al);
      }

      const relevantLocks = [];
      for (const [targetKey, tLocks] of locksByTarget.entries()) {
        const hasFull = tLocks.some(l => String(l.type || '').toUpperCase() === 'FULL');
        const hasFixed = tLocks.some(l => String(l.type || '').toUpperCase() === 'FIXED');
        const line = solverKeyToLine.get(targetKey);
        const platDisplay = line ? line.platform : targetKey;

        if (hasFull && hasFixed) {
          errors.push({
            code: 'LOCK_CONFLICT',
            platform: platDisplay,
            productId: pId,
            message: `Conflicto de bloqueos para ${pId} en plataforma ${platDisplay}: se especificó simultáneamente bloqueo TOTAL (FULL) y FIJO (FIXED).`
          });
          continue;
        }

        if (hasFull) {
          relevantLocks.push(tLocks.find(l => String(l.type || '').toUpperCase() === 'FULL'));
        } else {
          relevantLocks.push(tLocks[tLocks.length - 1]);
        }
      }

      // =====================================================================
      // PRODUCTO 1: COCKTAIL ROMÁNTICO (FIFO + RESTRICCIÓN MONOVARIETAL)
      // =====================================================================
      if (pId === COCKTAIL_PRODUCT_ID) {
        const varietyStocks = {};
        for (const vId of getVarietyIds(COCKTAIL_PRODUCT_ID)) {
          varietyStocks[vId] = getAvailableStock(COCKTAIL_PRODUCT_ID, vId);
        }

        const cocktailRes = solveMonovarietalFIFO(
          solverDemandMap,
          varietyStocks.SAO_PAULO || 0,
          varietyStocks.SUNSTREAM || 0,
          {
            locks: relevantLocks,
            catalog: catalogConfig,
            productId: COCKTAIL_PRODUCT_ID,
            varietyStocks
          }
        );

        if (!cocktailRes.isFeasible && cocktailRes.errors && cocktailRes.errors.length > 0) {
          for (const e of cocktailRes.errors) {
            errors.push({ ...e, productId: pId });
          }
        }

        if (cocktailRes.warnings && cocktailRes.warnings.length > 0) {
          for (const w of cocktailRes.warnings) {
            warnings.push({ ...w, productId: pId });
          }
        }

        for (const alloc of cocktailRes.allocations) {
          const line = solverKeyToLine.get(alloc.platform);
          finalAllocations.push({
            orderId: line ? (line.orderId || line.id) : alloc.platform,
            platform: line ? line.platform : alloc.platform,
            deliveryDate: line ? (line.deliveryDate || '') : '',
            productId: COCKTAIL_PRODUCT_ID,
            varietyId: alloc.varietyId,
            requestedQuantity: alloc.requestedQuantity,
            allocatedQuantity: alloc.allocatedQuantity,
            missingQuantity: alloc.missingQuantity,
            requestedBoxes: alloc.requestedQuantity,
            allocatedBoxes: alloc.allocatedQuantity,
            pendingBoxes: alloc.missingQuantity,
            allocationMethod: alloc.allocationMethod,
            origen: line ? (line.origen || 'MANUAL') : 'MANUAL'
          });

          if (alloc.allocatedQuantity > 0 && alloc.varietyId) {
            recordUsedStock(COCKTAIL_PRODUCT_ID, alloc.varietyId, alloc.allocatedQuantity);
          }
        }
      }
      // =====================================================================
      // PRODUCTOS 2 Y 3: PERA RAMA / CHERRY RAMA / OTROS (HAMILTON ESTÁNDAR)
      // =====================================================================
      else {
        const ownVarieties = getVarietyIds(pId);
        const vId = ownVarieties.length === 1 ? ownVarieties[0] : null;
        const availableStock = getAvailableStock(pId, vId);

        const hamRes = allocateProportionalHamilton(solverDemandMap, availableStock, relevantLocks);

        if (!hamRes.isFeasible && hamRes.errors && hamRes.errors.length > 0) {
          for (const e of hamRes.errors) {
            errors.push({ ...e, productId: pId });
          }
        }

        if (hamRes.warnings && hamRes.warnings.length > 0) {
          for (const w of hamRes.warnings) {
            warnings.push({ ...w, productId: pId });
          }
        }

        for (const alloc of hamRes.allocations) {
          const line = solverKeyToLine.get(alloc.platform);
          finalAllocations.push({
            orderId: line ? (line.orderId || line.id) : alloc.platform,
            platform: line ? line.platform : alloc.platform,
            deliveryDate: line ? (line.deliveryDate || '') : '',
            productId: pId,
            varietyId: vId,
            requestedQuantity: alloc.requestedQuantity,
            allocatedQuantity: alloc.allocatedQuantity,
            missingQuantity: alloc.missingQuantity,
            requestedBoxes: alloc.requestedQuantity,
            allocatedBoxes: alloc.allocatedQuantity,
            pendingBoxes: alloc.missingQuantity,
            allocationMethod: alloc.allocationMethod,
            origen: line ? (line.origen || 'MANUAL') : 'MANUAL'
          });

          if (alloc.allocatedQuantity > 0) {
            recordUsedStock(pId, vId, alloc.allocatedQuantity);
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // PASO 5: CÁLCULO DE STOCK REMANENTE E INTEGRIDAD CUANTITATIVA
    // -----------------------------------------------------------------------
    const stockRemainingList = [];
    for (const [key, item] of stockMap.entries()) {
      const used = usedStockMap.get(key) || 0;
      const remaining = Math.max(0, item.available - used);

      stockRemainingList.push({
        productId: item.productId,
        varietyId: item.varietyId,
        stockKey: key,
        available: item.available,
        used,
        remaining
      });
    }

    // Ordenar de forma determinista el stock restante
    stockRemainingList.sort((a, b) => a.stockKey.localeCompare(b.stockKey));

    // -----------------------------------------------------------------------
    // PASO 6: PALETIZACIÓN FÍSICA Y PLANES SEGREGADOS POR FECHA
    // -----------------------------------------------------------------------
    const plansByDate = {};
    const dateKeys = Array.from(new Set(finalAllocations.map(a => a.deliveryDate).filter(Boolean)));
    if (dateKeys.length === 0) {
      dateKeys.push(effectiveDeliveryDate || '');
    }

    for (const d of dateKeys) {
      const dateAllocs = finalAllocations.filter(a => !d || a.deliveryDate === d);
      const datePalletRes = planPallets(dateAllocs, DEFAULT_PALLET_RULES, palletConfiguration);

      const dateDemandByProd = {};
      const dateDemandByPlat = {};
      let dateTotalRequested = 0;
      for (const a of dateAllocs) {
        dateTotalRequested += (a.requestedQuantity || 0);
        dateDemandByProd[a.productId] = (dateDemandByProd[a.productId] || 0) + (a.requestedQuantity || 0);
        dateDemandByPlat[a.platform] = (dateDemandByPlat[a.platform] || 0) + (a.requestedQuantity || 0);
      }

      plansByDate[d] = {
        deliveryDate: d || effectiveDeliveryDate,
        targetDeliveryDate: d || effectiveDeliveryDate,
        selectedDeliveryDate: d || effectiveDeliveryDate,
        detectedDates: d ? [d] : detectedDates,
        sourceDate,
        demandSummary: {
          totalRequested: dateTotalRequested,
          byProduct: dateDemandByProd,
          byPlatform: dateDemandByPlat
        },
        allocations: dateAllocs,
        totalBoxes: datePalletRes.totalBoxes,
        totalPallets: datePalletRes.totalPallets,
        totalPalletSlots: datePalletRes.totalPalletSlots,
        palletGroups: datePalletRes.groups,
        palletSummaries: {
          totalBoxes: datePalletRes.totalBoxes,
          totalPallets: datePalletRes.totalPallets,
          totalPalletSlots: datePalletRes.totalPalletSlots,
          groups: datePalletRes.groups,
          byPlatform: datePalletRes.summary.byPlatform,
          byProduct: datePalletRes.summary.byProduct,
          byPalletType: datePalletRes.summary.byPalletType,
          stackingPlanByPlatform: datePalletRes.stackingPlanByPlatform
        },
        stockRemaining: stockRemainingList,
        warnings: [...warnings, ...(datePalletRes.warnings || [])],
        errors: [...errors, ...(datePalletRes.errors || [])],
        isPhysicallyFeasible: errors.length === 0 && (datePalletRes.errors || []).length === 0
      };
    }

    const primaryDateKey = (targetDeliveryDate && plansByDate[targetDeliveryDate])
      ? targetDeliveryDate
      : (effectiveDeliveryDate && plansByDate[effectiveDeliveryDate])
        ? effectiveDeliveryDate
        : dateKeys[0];

    const activePlan = plansByDate[primaryDateKey] || {
      deliveryDate: effectiveDeliveryDate,
      targetDeliveryDate: effectiveDeliveryDate,
      selectedDeliveryDate: effectiveDeliveryDate,
      detectedDates,
      sourceDate,
      demandSummary: { totalRequested, byProduct: demandByProduct, byPlatform: demandByPlatform },
      allocations: finalAllocations,
      totalBoxes: 0,
      totalPallets: 0,
      totalPalletSlots: 0,
      palletGroups: [],
      palletSummaries: { totalBoxes: 0, totalPallets: 0, totalPalletSlots: 0, groups: [], byPlatform: {}, byProduct: {}, byPalletType: {} },
      stockRemaining: stockRemainingList,
      warnings: [],
      errors: [],
      isPhysicallyFeasible: false
    };

    const isPhysicallyFeasible = errors.length === 0 && activePlan.isPhysicallyFeasible;

    return {
      deliveryDate: activePlan.deliveryDate,
      targetDeliveryDate: targetDeliveryDate || activePlan.deliveryDate,
      selectedDeliveryDate: activePlan.deliveryDate,
      detectedDates,
      sourceDate,
      sourceSummary: {
        totalLinesParsed: allParsedLines.length,
        validLinesCount: validLines.length,
        lines: allParsedLines
      },
      demandSummary: targetDeliveryDate ? activePlan.demandSummary : {
        totalRequested,
        byProduct: demandByProduct,
        byPlatform: demandByPlatform
      },
      globalDemandSummary: {
        totalRequested,
        byProduct: demandByProduct,
        byPlatform: demandByPlatform
      },
      allocations: targetDeliveryDate ? activePlan.allocations : finalAllocations,
      globalAllocation: finalAllocations,
      plansByDate,
      totalBoxes: activePlan.totalBoxes,
      totalPallets: activePlan.totalPallets,
      totalPalletSlots: activePlan.totalPalletSlots,
      palletGroups: activePlan.palletGroups,
      palletSummaries: activePlan.palletSummaries,
      stockRemaining: stockRemainingList,
      warnings: [...warnings, ...(activePlan.warnings || [])],
      errors: [...errors, ...(activePlan.errors || [])],
      isPhysicallyFeasible
    };
  }

  return {
    validateStock,
    normalizeStockInput,
    buildExclusionFilter,
    planLoad
  };
});

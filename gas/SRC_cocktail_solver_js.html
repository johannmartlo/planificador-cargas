/**
 * Solucionador de Cocktail Romántico: Fifo + Restricción Monovarietal
 *
 * Módulo puro, determinista y completamente desacoplado del DOM.
 * Regla de negocio:
 * - COCKTAIL_ROMANTICO es un producto comercial único (GIS: 16228): artículo, numeración
 *   y descripción comercial invariantes. Las variedades son internas y se resuelven por stock.
 * - Variedades físicas soportadas: CONSABOR (activa), SUNSTREAM y SAO_PAULO (histórica).
 *   El solver es agnóstico al número de variedades: las lee del catálogo.
 * - Restricción monovarietal estricta: Una plataforma no puede recibir simultáneamente
 *   dos variedades distintas. Recibe 100% de una única variedad (o nada).
 * - Prioridades de optimización:
 *   1. Mayor cantidad total de cajas asignadas.
 *   2. Mayor cantidad de la variedad de prioridad (por defecto SAO_PAULO, lote viejo / FIFO).
 *      Esta prioridad solo se aplica si esa variedad tiene stock disponible.
 *   3. Menor desviación respecto a la asignación proporcional total (Hamilton).
 *   4. Menor número de plataformas utilizadas para la variedad de prioridad.
 *   5. Desempate determinista: (5a) orden explícito de variedades `varietyPreference`
 *      aplicado lexicográficamente sobre plataformas canónicas, y (5b) orden canónico
 *      de plataforma. Ambos son neutros: no expresan ninguna preferencia empresarial
 *      no definida, solo garantizan determinismo y permiten parametrizar la política.
 *
 * POLÍTICA PENDIENTE (no inventada aquí):
 * Cuando dos o más variedades tienen stock simultáneo y ninguna es la variedad de prioridad
 * (hoy: CONSABOR vs SUNSTREAM), no existe una regla empresarial de prioridad definida. El
 * solver NO la inventa: aplica un desempate neutro y explícito (orden del catálogo) y emite la
 * advertencia `COCKTAIL_VARIETY_PRIORITY_PENDING` para que la decisión sea visible/parametrizable.
 * El orden puede parametrizarse con `options.varietyPreference` sin tocar la lógica.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { allocateProportionalHamilton, validateInputs } = require('./hamilton.js');
    const { DEFAULT_CATALOG, getProductVarieties } = require('./catalog.js');
    module.exports = factory(allocateProportionalHamilton, validateInputs, DEFAULT_CATALOG, getProductVarieties);
  } else {
    root.LogisticsCocktail = factory(
      root.LogisticsHamilton.allocateProportionalHamilton,
      root.LogisticsHamilton.validateInputs,
      root.LogisticsCatalog.DEFAULT_CATALOG,
      root.LogisticsCatalog.getProductVarieties
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  allocateProportionalHamilton,
  validateInputs,
  DEFAULT_CATALOG,
  getProductVarieties
) {
  'use strict';

  const COCKTAIL_PRODUCT_ID = 'COCKTAIL_ROMANTICO';

  // Variedad de prioridad por defecto (lote viejo, FIFO). Comportamiento histórico preservado.
  const DEFAULT_PRIORITY_VARIETY = 'SAO_PAULO';

  // Orden neutro por defecto para el desempate entre variedades equivalentes.
  // Se deriva y valida contra el catálogo en tiempo de ejecución.
  const DEFAULT_VARIETY_ORDER = ['CONSABOR', 'SAO_PAULO', 'SUNSTREAM'];

  /**
   * Normaliza la entrada de stock multi-variedad a un mapa plano { VARIEDAD: cantidad }.
   * Acepta:
   * - undefined/null -> {}
   * - Array de StockItem [{ varietyId, availableQuantity }]
   * - Array de strings ['CONSABOR', 'SUNSTREAM'] (cantidad 0)
   * - Objeto { CONSABOR: 100, SUNSTREAM: 40 }
   *
   * @param {any} input
   * @returns {Object<string, number>}
   */
  function normalizeVarietyStockInput(input) {
    const out = {};
    if (!input) return out;

    if (Array.isArray(input)) {
      for (const item of input) {
        if (typeof item === 'string') {
          const id = item.trim().toUpperCase();
          if (id) out[id] = 0;
          continue;
        }
        if (!item || typeof item !== 'object') continue;
        const rawId = item.varietyId || item.variety || item.id;
        if (!rawId) continue;
        const id = String(rawId).trim().toUpperCase();
        const rawQty = item.availableQuantity !== undefined
          ? item.availableQuantity
          : (item.available !== undefined ? item.available : item.quantity);
        out[id] = Math.max(0, Math.floor(Number(rawQty) || 0));
      }
      return out;
    }

    if (typeof input === 'object') {
      const entries = input instanceof Map ? input.entries() : Object.entries(input);
      for (const [key, val] of entries) {
        if (!key) continue;
        const id = String(key).trim().toUpperCase();
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Formato { CONSABOR: { availableQuantity: 100 } }
          const rawQty = val.availableQuantity !== undefined
            ? val.availableQuantity
            : (val.available !== undefined ? val.available : val.quantity);
          out[id] = Math.max(0, Math.floor(Number(rawQty) || 0));
        } else {
          out[id] = Math.max(0, Math.floor(Number(val) || 0));
        }
      }
    }

    return out;
  }

  /**
   * Resuelve la asignación monovarietal del Cocktail Romántico.
   *
   * Firma histórica (2 variedades): solveMonovarietalFIFO(demands, stockSaoPaulo, stockSunstream)
   * Firma extendida (N variedades): solveMonovarietalFIFO(demands, stockSaoPaulo, stockSunstream, {
   *   varietyStocks: { CONSABOR: 100, SAO_PAULO: 0, SUNSTREAM: 0 }
   * })
   *
   * @param {Object<string, number>} demandByPlatform - Mapa inmutable { PLATAFORMA: demandaOriginal }.
   * @param {number} stockSaoPaulo - Cajas disponibles de la variedad histórica Sao Paulo (lote viejo/FIFO).
   * @param {number} stockSunstream - Cajas disponibles de la variedad Sunstream.
   * @param {Object} [options] - Opciones adicionales:
   *   - locks: Array<{platform, type, quantity}>
   *   - catalog: catálogo de productos/variedades
   *   - productId: producto comercial (por defecto COCKTAIL_ROMANTICO)
   *   - varietyStocks: Object|Array|Map con el stock por variedad (tiene precedencia sobre los
   *     parámetros posicionales; si ambas fuentes se informan con valores distintos se emite error)
   *   - varietyPreference: Array<string> con el orden explícito de desempate entre variedades
   *   - priorityVariety: variedad de prioridad FIFO (por defecto SAO_PAULO)
   * @returns {{
   *   totalDemand: number,
   *   totalStock: number,
   *   totalAllocated: number,
   *   allocations: Array<{
   *     platform: string,
   *     requestedQuantity: number,
   *     allocatedQuantity: number,
   *     varietyId: string|null,
   *     missingQuantity: number,
   *     allocationMethod: string
   *   }>,
   *   saoPaulo: { available: number, used: number, remaining: number },
   *   sunstream: { available: number, used: number, remaining: number },
   *   varieties: Object<string, { available: number, used: number, remaining: number }>,
   *   productId: string,
   *   isFeasible: boolean,
   *   isExact: boolean,
   *   warnings: Array<Object>,
   *   errors: Array<Object>,
   *   alternatives: Array<Object>
   * }}
   */
  function solveMonovarietalFIFO(demandByPlatform, stockSaoPaulo, stockSunstream, options = {}) {
    const warnings = [];
    const errors = [];
    const alternatives = [];

    const catalogConfig = options.catalog || DEFAULT_CATALOG;
    const productId = String(options.productId || COCKTAIL_PRODUCT_ID).trim().toUpperCase();

    const catalogVarieties = getProductVarieties(productId, catalogConfig);
    const varietyIds = catalogVarieties.map(v => v.id);
    const isRegisteredVariety = id => varietyIds.indexOf(id) !== -1;

    const emptyLegacyVariety = () => ({ available: 0, used: 0, remaining: 0 });
    const emptyStocks = () => {
      const m = {};
      for (const id of varietyIds) m[id] = 0;
      return m;
    };

    // =======================================================================
    // 1. VALIDACIÓN RIGUROSA DE ENTRADAS
    // =======================================================================
    const valDemands = validateInputs(demandByPlatform, 0);
    if (!valDemands.isValid) {
      return {
        totalDemand: 0,
        totalStock: 0,
        totalAllocated: 0,
        allocations: [],
        saoPaulo: emptyLegacyVariety(),
        sunstream: emptyLegacyVariety(),
        varieties: {},
        productId,
        isFeasible: false,
        isExact: false,
        warnings,
        errors: valDemands.errors,
        alternatives
      };
    }

    // =======================================================================
    // 1.b RESOLUCIÓN DEL STOCK POR VARIEDAD
    // =======================================================================
    const resolvedStocks = emptyStocks();
    resolvedStocks.SAO_PAULO = stockSaoPaulo;
    resolvedStocks.SUNSTREAM = stockSunstream;

    const optionStocks = normalizeVarietyStockInput(options.varietyStocks);
    for (const [id, qty] of Object.entries(optionStocks)) {
      if (!isRegisteredVariety(id)) {
        errors.push({
          code: 'UNKNOWN_COCKTAIL_VARIETY',
          message: `La variedad "${id}" no está registrada en el catálogo para el producto ${productId}.`,
          context: { productId, varietyId: id, registeredVarieties: varietyIds }
        });
        continue;
      }
      const legacyValue = (id === 'SAO_PAULO' || id === 'SUNSTREAM')
        ? Math.max(0, Math.floor(Number(resolvedStocks[id]) || 0))
        : 0;
      const provided = Math.max(0, Math.floor(Number(qty) || 0));
      if ((id === 'SAO_PAULO' || id === 'SUNSTREAM') && provided !== legacyValue) {
        errors.push({
          code: 'CONFLICTING_STOCK_SOURCES',
          message: `Stock contradictorio para la variedad ${id}: parámetro posicional (${legacyValue}) y varietyStocks (${provided}).`,
          context: { productId, varietyId: id, positional: legacyValue, varietyStocks: provided }
        });
        continue;
      }
      resolvedStocks[id] = provided;
    }

    if (errors.length > 0) {
      return {
        totalDemand: 0,
        totalStock: 0,
        totalAllocated: 0,
        allocations: [],
        saoPaulo: emptyLegacyVariety(),
        sunstream: emptyLegacyVariety(),
        varieties: {},
        productId,
        isFeasible: false,
        isExact: false,
        warnings,
        errors,
        alternatives
      };
    }

    // Validar stocks individuales (paridad con la validación histórica de SP y SUN)
    const stockErrors = [];
    for (const id of varietyIds) {
      const val = validateInputs({ DUMMY: 0 }, resolvedStocks[id]);
      if (!val.isValid) stockErrors.push(...val.errors);
    }

    if (stockErrors.length > 0) {
      return {
        totalDemand: 0,
        totalStock: 0,
        totalAllocated: 0,
        allocations: [],
        saoPaulo: emptyLegacyVariety(),
        sunstream: emptyLegacyVariety(),
        varieties: {},
        productId,
        isFeasible: false,
        isExact: false,
        warnings,
        errors: stockErrors,
        alternatives
      };
    }

    // Inmutabilidad: copia defensiva de demandas
    const demands = { ...valDemands.sanitizedDemands };

    let totalStock = 0;
    for (const id of varietyIds) totalStock += resolvedStocks[id];

    const platforms = Object.keys(demands);
    let totalDemand = 0;
    for (const p of platforms) {
      totalDemand += demands[p];
    }

    const maximumServable = Math.min(totalStock, totalDemand);

    const buildVarietiesSummary = (usedById) => {
      const summary = {};
      for (const id of varietyIds) {
        const used = usedById[id] || 0;
        summary[id] = {
          available: resolvedStocks[id],
          used,
          remaining: resolvedStocks[id] - used
        };
      }
      return summary;
    };

    const emptyUsed = {};
    for (const id of varietyIds) emptyUsed[id] = 0;

    // Caso base: Demanda cero o Stock total cero
    if (totalDemand === 0 || maximumServable === 0) {
      const emptyAllocations = platforms.map(p => ({
        platform: p,
        requestedQuantity: demands[p],
        allocatedQuantity: 0,
        varietyId: null,
        missingQuantity: demands[p],
        allocationMethod: 'UNFULFILLED'
      }));

      return {
        totalDemand,
        totalStock,
        totalAllocated: 0,
        allocations: emptyAllocations,
        saoPaulo: { available: resolvedStocks.SAO_PAULO, used: 0, remaining: resolvedStocks.SAO_PAULO },
        sunstream: { available: resolvedStocks.SUNSTREAM, used: 0, remaining: resolvedStocks.SUNSTREAM },
        varieties: buildVarietiesSummary(emptyUsed),
        productId,
        isFeasible: true,
        isExact: true,
        warnings,
        errors,
        alternatives
      };
    }

    // =======================================================================
    // 2. RESOLUCIÓN DE LA POLÍTICA DE VARIEDADES
    // =======================================================================
    // Variedad de prioridad (FIFO). Solo se aplica si tiene stock disponible.
    const priorityVariety = options.priorityVariety
      ? String(options.priorityVariety).trim().toUpperCase()
      : DEFAULT_PRIORITY_VARIETY;
    const hasPriorityVariety = (resolvedStocks[priorityVariety] || 0) > 0;

    // Orden de desempate neutro: variedad de prioridad primero, luego el orden explícito
    // (options.varietyPreference) y finalmente el orden del catálogo.
    const rawPreference = Array.isArray(options.varietyPreference) && options.varietyPreference.length > 0
      ? options.varietyPreference.map(v => String(v).trim().toUpperCase())
      : DEFAULT_VARIETY_ORDER;

    const varietyOrder = [];
    const pushOrder = id => {
      if (id && varietyOrder.indexOf(id) === -1) varietyOrder.push(id);
    };
    pushOrder(priorityVariety);
    for (const id of rawPreference) pushOrder(id);
    for (const id of varietyIds) pushOrder(id);

    /** Número de variedades distintas con stock positivo. */
    const stockedVarieties = varietyIds
      .filter(id => (resolvedStocks[id] || 0) > 0)
      .sort((a, b) => varietyOrder.indexOf(a) - varietyOrder.indexOf(b));

    const locks = options.locks || [];

    // =======================================================================
    // 3. DETERMINACIÓN DE ASIGNACIÓN TOTAL PROPORCIONAL POR PLATAFORMA
    // =======================================================================
    // Si totalStock >= totalDemand, el objetivo ideal es el 100% de la demanda.
    // Si totalStock < totalDemand, usamos Hamilton para fijar la cuota proporcional
    // total de Cocktail antes de dividirla por variedad.
    let targetAllocation = {};

    if (totalStock >= totalDemand && locks.length === 0) {
      targetAllocation = { ...demands };
    } else {
      const hamResult = allocateProportionalHamilton(demands, maximumServable, locks);
      if (!hamResult.isFeasible) {
        return {
          totalDemand,
          totalStock,
          totalAllocated: 0,
          allocations: [],
          saoPaulo: { available: resolvedStocks.SAO_PAULO, used: 0, remaining: resolvedStocks.SAO_PAULO },
          sunstream: { available: resolvedStocks.SUNSTREAM, used: 0, remaining: resolvedStocks.SUNSTREAM },
          varieties: buildVarietiesSummary(emptyUsed),
          productId,
          isFeasible: false,
          isExact: false,
          warnings: hamResult.warnings,
          errors: hamResult.errors,
          alternatives
        };
      }
      for (const item of hamResult.allocations) {
        targetAllocation[item.platform] = item.allocatedQuantity;
      }
    }

    // Plataformas activas con demanda > 0
    const activePlatforms = platforms
      .filter(p => demands[p] > 0)
      .sort((a, b) => a.localeCompare(b));

    const n = activePlatforms.length;

    // =======================================================================
    // 4. EXPLORACIÓN COMBINATORIA DETERMINISTA Y CRITERIOS DE OPTIMALIDAD
    // =======================================================================
    const canonicalPlatforms = (catalogConfig.platforms && catalogConfig.platforms.canonical) ||
      (DEFAULT_CATALOG.platforms && DEFAULT_CATALOG.platforms.canonical) ||
      ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA'];

    function getCanonicalIndex(p) {
      const idx = canonicalPlatforms.indexOf(p);
      return idx !== -1 ? idx : 999;
    }

    function compareCanonicalPlatformSets(setA, setB) {
      const arrA = Array.from(setA).sort((x, y) => getCanonicalIndex(x) - getCanonicalIndex(y) || x.localeCompare(y));
      const arrB = Array.from(setB).sort((x, y) => getCanonicalIndex(x) - getCanonicalIndex(y) || x.localeCompare(y));
      const minLen = Math.min(arrA.length, arrB.length);
      for (let i = 0; i < minLen; i++) {
        const idxA = getCanonicalIndex(arrA[i]);
        const idxB = getCanonicalIndex(arrB[i]);
        if (idxA !== idxB) return idxA - idxB;
        const comp = arrA[i].localeCompare(arrB[i]);
        if (comp !== 0) return comp;
      }
      return arrA.length - arrB.length;
    }

    /**
     * Firma de variedades de una solución en orden canónico de plataforma.
     * Cada posición es el rango de la variedad asignada dentro de `varietyOrder`.
     * Permite aplicar la preferencia explícita de variedades de forma lexicográfica
     * (plataforma canónica anterior primero) SIN inventar ninguna prioridad empresarial:
     * solo actúa cuando todas las métricas objetivas anteriores ya empatan.
     */
    function getVarietyPreferenceSignature(platformQuantities, varietySets) {
      const signature = [];
      const ordered = platforms.slice().sort(
        (a, b) => getCanonicalIndex(a) - getCanonicalIndex(b) || a.localeCompare(b)
      );
      for (const p of ordered) {
        if ((platformQuantities[p] || 0) <= 0) continue;
        let assigned = null;
        for (const id of Object.keys(varietySets)) {
          if (varietySets[id].has(p)) { assigned = id; break; }
        }
        const rank = assigned ? varietyOrder.indexOf(assigned) : varietyOrder.length;
        signature.push(rank === -1 ? varietyOrder.length : rank);
      }
      return signature;
    }

    function compareSignatures(sigA, sigB) {
      const minLen = Math.min(sigA.length, sigB.length);
      for (let i = 0; i < minLen; i++) {
        if (sigA[i] !== sigB[i]) return sigA[i] - sigB[i];
      }
      return sigA.length - sigB.length;
    }

    /**
     * Comparación jerárquica de soluciones candidatas.
     * IMPORTANTE: el orden de las prioridades 1-5 es el histórico y no debe alterarse.
     * La prioridad 2 solo se evalúa cuando la variedad de prioridad tiene stock.
     */
    function isBetter(cand, best) {
      if (!best) return true;
      // Prioridad 1: Mayor cantidad total asignada (DESC)
      if (cand.totalAllocated !== best.totalAllocated) {
        return cand.totalAllocated > best.totalAllocated;
      }
      // Prioridad 2: Mayor uso de la variedad de prioridad / FIFO (DESC)
      if (hasPriorityVariety && cand.priorityUsed !== best.priorityUsed) {
        return cand.priorityUsed > best.priorityUsed;
      }
      // Prioridad 3: Menor desviación respecto al target proporcional (ASC)
      if (cand.deviation !== best.deviation) {
        return cand.deviation < best.deviation;
      }
      // Prioridad 4: Menor número de plataformas para la variedad de prioridad (ASC)
      if (hasPriorityVariety && cand.priorityPlatformCount !== best.priorityPlatformCount) {
        return cand.priorityPlatformCount < best.priorityPlatformCount;
      }
      // Prioridad 5a: Preferencia explícita/configurable de variedad (neutra, solo en empate)
      const sigCmp = compareSignatures(cand.preferenceSignature, best.preferenceSignature);
      if (sigCmp !== 0) return sigCmp < 0;
      // Prioridad 5b: Desempate determinista por orden canónico de plataforma
      return compareCanonicalPlatformSets(cand.priorityPlatforms, best.priorityPlatforms) < 0;
    }

    /**
     * Asigna el stock físico disponible de una variedad a un subconjunto de plataformas.
     * Si la demanda agregada supera el stock de la variedad, prorratea mediante Hamilton
     * garantizando cuotas enteras, mayor resto y respeto de bloqueos prioritarios.
     */
    function allocateVariety(platList, varietyStock, varLocks) {
      const res = {
        allocations: {},
        used: 0
      };
      for (const p of platList) res.allocations[p] = 0;
      if (platList.length === 0 || varietyStock <= 0) return res;

      const varDemands = {};
      let totalVarDemand = 0;
      for (const p of platList) {
        varDemands[p] = demands[p];
        totalVarDemand += demands[p];
      }

      const maxServ = Math.min(varietyStock, totalVarDemand);
      if (maxServ <= 0) return res;

      const relevantLocks = (varLocks || []).filter(l => l && platList.includes(l.platform));

      if (relevantLocks.length === 0) {
        if (totalVarDemand <= varietyStock) {
          for (const p of platList) res.allocations[p] = varDemands[p];
          res.used = totalVarDemand;
          return res;
        }
        const ham = allocateProportionalHamilton(varDemands, maxServ, []);
        for (const a of ham.allocations) res.allocations[a.platform] = a.allocatedQuantity;
        res.used = ham.totalAllocated;
        return res;
      }

      // Procesar bloqueos prioritarios acotados a la capacidad física de la variedad
      const processedLocks = [];
      for (const l of relevantLocks) {
        const dem = varDemands[l.platform];
        const desired = (l.type === 'FULL') ? dem : Math.min(dem, Math.max(0, Math.floor(Number(l.quantity) || 0)));
        processedLocks.push({
          platform: l.platform,
          type: 'FIXED',
          quantity: Math.min(desired, varietyStock),
          desired
        });
      }

      const sumClamped = processedLocks.reduce((s, l) => s + l.quantity, 0);
      if (sumClamped <= varietyStock) {
        const ham = allocateProportionalHamilton(varDemands, maxServ, processedLocks);
        if (ham.isFeasible) {
          for (const a of ham.allocations) res.allocations[a.platform] = a.allocatedQuantity;
          res.used = ham.totalAllocated;
          return res;
        }
      }

      // Fallback si la suma de bloqueos en esta variedad excede el stock físico disponible
      let rem = varietyStock;
      const sorted = [...processedLocks].sort((a, b) => a.platform.localeCompare(b.platform));
      const fallbackLocks = [];
      for (const l of sorted) {
        const q = Math.min(l.quantity, rem);
        fallbackLocks.push({ platform: l.platform, type: 'FIXED', quantity: q });
        rem -= q;
      }
      const hamFallback = allocateProportionalHamilton(varDemands, maxServ, fallbackLocks);
      for (const a of hamFallback.allocations) res.allocations[a.platform] = a.allocatedQuantity;
      res.used = hamFallback.totalAllocated;
      return res;
    }

    let bestSolution = null;

    // Variedad base del recorrido binario: la de prioridad si tiene stock; si no,
    // la primera variedad con stock según el orden de desempate. Esto preserva el
    // comportamiento histórico (Sao Paulo) y mantiene el caso de 2 variedades idéntico.
    const baseVariety = hasPriorityVariety ? priorityVariety : (stockedVarieties[0] || null);

    if (baseVariety) {
      const otherStocked = stockedVarieties.filter(id => id !== baseVariety);
      const baseStock = resolvedStocks[baseVariety] || 0;

      // Búsqueda exhaustiva determinista sobre las k^n particiones monovarietales
      // (cada plataforma activa recibe una única variedad, sin mezclar jamás en la misma plataforma)
      const combinations = Math.pow(otherStocked.length + 1, n);

      for (let combo = 0; combo < combinations; combo++) {
        const assign = {};
        const platformQuantities = {};
        const platformSets = {};
        const usage = {};

        let cursor = combo;
        for (let j = 0; j < n; j++) {
          const idx = cursor % (otherStocked.length + 1);
          cursor = Math.floor(cursor / (otherStocked.length + 1));
          assign[activePlatforms[j]] = (idx === 0) ? baseVariety : otherStocked[idx - 1];
        }

        for (const id of [baseVariety, ...otherStocked]) {
          platformSets[id] = new Set();
          usage[id] = { used: 0, remaining: resolvedStocks[id] || 0 };
        }

        const basePlats = [];
        for (const p of activePlatforms) {
          if (assign[p] === baseVariety) basePlats.push(p);
        }
        const resBase = allocateVariety(basePlats, baseStock, locks);
        for (const p of basePlats) {
          const q = resBase.allocations[p] || 0;
          platformQuantities[p] = q;
          if (q > 0) platformSets[baseVariety].add(p);
        }
        usage[baseVariety].used = resBase.used;

        for (const id of otherStocked) {
          const platList = [];
          for (const p of activePlatforms) {
            if (assign[p] === id) platList.push(p);
          }
          const resVar = allocateVariety(platList, resolvedStocks[id] || 0, locks);
          for (const p of platList) {
            const q = resVar.allocations[p] || 0;
            platformQuantities[p] = q;
            if (q > 0) platformSets[id].add(p);
          }
          usage[id].used = resVar.used;
        }

        let totalAllocated = 0;
        for (const id of [baseVariety, ...otherStocked]) {
          totalAllocated += usage[id].used;
          usage[id].remaining = (resolvedStocks[id] || 0) - usage[id].used;
        }

        let deviation = 0;
        for (const p of platforms) {
          const q = platformQuantities[p] || 0;
          const target = targetAllocation[p] || 0;
          deviation += Math.abs(q - target);
        }

        const cand = {
          totalAllocated,
          priorityUsed: usage[priorityVariety] ? usage[priorityVariety].used : 0,
          priorityPlatformCount: platformSets[priorityVariety] ? platformSets[priorityVariety].size : 0,
          priorityPlatforms: new Set(platformSets[priorityVariety] || []),
          preferenceSignature: getVarietyPreferenceSignature(platformQuantities, platformSets),
          deviation,
          usage,
          platformSets,
          platformQuantities
        };

        if (isBetter(cand, bestSolution)) {
          bestSolution = cand;
        }
      }
    }

    // =======================================================================
    // 5. CONSTRUCCIÓN DEL RESULTADO FINAL
    // =======================================================================
    const finalAllocations = [];
    const finalUsedById = { ...emptyUsed };
    let finalTotalAllocated = 0;

    const quantities = bestSolution ? bestSolution.platformQuantities : {};

    // Cada plataforma recibe exactamente una variedad (nunca mezcla). La pertenencia se
    // toma directamente del conjunto de plataformas del ganador para cada variedad con uso.
    const platformVariety = {};
    if (bestSolution) {
      for (const id of Object.keys(bestSolution.platformSets)) {
        if (bestSolution.usage[id].used <= 0) continue;
        for (const p of bestSolution.platformSets[id]) {
          if (quantities[p] > 0 && !platformVariety[p]) platformVariety[p] = id;
        }
      }
    }

    for (const plat of platforms) {
      const req = demands[plat];
      let allocQty = quantities[plat] || 0;
      let varietyId = null;

      if (allocQty > 0) {
        varietyId = platformVariety[plat] || null;
      }

      if (varietyId === null) allocQty = 0;

      finalTotalAllocated += allocQty;
      if (varietyId) finalUsedById[varietyId] += allocQty;

      finalAllocations.push({
        platform: plat,
        requestedQuantity: req,
        allocatedQuantity: allocQty,
        varietyId,
        missingQuantity: req - allocQty,
        allocationMethod: allocQty > 0 ? 'MONOVARIETAL' : 'UNFULFILLED'
      });
    }

    const remainingPriority = resolvedStocks[priorityVariety] - (finalUsedById[priorityVariety] || 0);

    // Evaluación de optimalidad exacta (paridad con el criterio histórico de Sao Paulo)
    const isExact = (remainingPriority === 0 && finalTotalAllocated === maximumServable) ||
      (finalTotalAllocated === totalDemand && remainingPriority === 0);

    // Registro de alternativas explicables si queda remanente del lote de prioridad
    if (remainingPriority > 0) {
      alternatives.push({
        type: 'FIFO_REMAINDER',
        message: `Quedan ${remainingPriority} cajas de Sao Paulo porque ninguna combinación de plataformas permite absorberlas sin romper la restricción monovarietal o exceder el stock.`,
        context: {
          remainingSaoPaulo: remainingPriority,
          usedSaoPaulo: finalUsedById[priorityVariety] || 0,
          availableSaoPaulo: resolvedStocks[priorityVariety]
        }
      });
      warnings.push({
        code: 'SAO_PAULO_UNDERUTILIZED',
        message: `No se pudo liquidar completamente el lote viejo de Sao Paulo (remanente: ${remainingPriority} cjs).`
      });
    }

    if (finalTotalAllocated < maximumServable) {
      const unservedBoxes = maximumServable - finalTotalAllocated;
      alternatives.push({
        type: 'MONOVARIETAL_UNSERVED',
        message: `No se pudieron servir ${unservedBoxes} cajas de Cocktail Romántico debido a la indivisibilidad de plataforma y restricción monovarietal.`,
        context: { maximumServable, totalAllocated: finalTotalAllocated, unservedBoxes }
      });
      warnings.push({
        code: 'MONOVARIETAL_RESTRICTION_UNFULFILLED',
        message: `No se pudieron asignar ${unservedBoxes} cajas de Cocktail Romántico debido a la restricción monovarietal estricta.`
      });
    }

    // Decisión de negocio PENDIENTE: no existe prioridad definida entre variedades que no
    // son el lote de prioridad (hoy CONSABOR vs SUNSTREAM) cuando ambas tienen stock.
    // El solver aplica un desempate neutro y lo declara explícitamente en lugar de inventar
    // una preferencia empresarial.
    const nonPriorityVarietiesUsed = Object.keys(finalUsedById)
      .filter(id => id !== priorityVariety && finalUsedById[id] > 0);

    if (!hasPriorityVariety && nonPriorityVarietiesUsed.length > 1) {
      const chosen = {};
      for (const alloc of finalAllocations) {
        if (alloc.varietyId) chosen[alloc.platform] = alloc.varietyId;
      }
      warnings.push({
        code: 'COCKTAIL_VARIETY_PRIORITY_PENDING',
        message: `Hay ${nonPriorityVarietiesUsed.length} variedades de Cocktail con stock simultáneo (${nonPriorityVarietiesUsed.join(', ')}) y no existe una prioridad empresarial definida entre ellas. Se aplicó el desempate neutro por orden de variedades [${varietyOrder.join(' > ')}]. Definir la política para fijarla.`,
        context: {
          pendingDecision: true,
          varietiesWithStock: stockedVarieties,
          varietiesUsed: nonPriorityVarietiesUsed,
          neutralTieBreakOrder: varietyOrder,
          chosenVarietyByPlatform: chosen
        }
      });
      alternatives.push({
        type: 'VARIETY_PRIORITY_PENDING',
        message: 'La prioridad entre variedades de Cocktail con stock simultáneo está pendiente de definición empresarial; el resultado es determinista pero la política es parametrizable vía varietyPreference.',
        context: {
          varietiesWithStock: stockedVarieties,
          neutralTieBreakOrder: varietyOrder
        }
      });
    }

    return {
      totalDemand,
      totalStock,
      totalAllocated: finalTotalAllocated,
      allocations: finalAllocations,
      saoPaulo: {
        available: resolvedStocks.SAO_PAULO,
        used: finalUsedById.SAO_PAULO || 0,
        remaining: resolvedStocks.SAO_PAULO - (finalUsedById.SAO_PAULO || 0)
      },
      sunstream: {
        available: resolvedStocks.SUNSTREAM,
        used: finalUsedById.SUNSTREAM || 0,
        remaining: resolvedStocks.SUNSTREAM - (finalUsedById.SUNSTREAM || 0)
      },
      varieties: buildVarietiesSummary(finalUsedById),
      productId,
      isFeasible: bestSolution !== null,
      isExact,
      warnings,
      errors,
      alternatives
    };
  }

  return {
    solveMonovarietalFIFO
  };
});

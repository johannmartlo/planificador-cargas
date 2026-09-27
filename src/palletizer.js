/**
 * Motor de Paletización Logístico Hortofrutícola
 *
 * Módulo puro, determinista y completamente desacoplado del DOM.
 * Arquitectura UMD compatible con Node.js y navegador sin dependencias externas.
 *
 * Principios:
 * - Cada combinación (platform + product + variety + palletType) se paletiza de forma independiente.
 * - Nunca se suman productos diferentes en una capacidad común.
 * - Nunca se combinan variedades físicas de Cocktail Romántico en un mismo palet.
 * - Cherry Rama y Cocktail Romántico son completamente independientes.
 * - Nunca se alteran las cantidades asignadas para forzar que los palets cuadren.
 * - Soporta rangos operativos min/max (Pera/Cocktail) y capacidades rígidas (Cherry).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { DEFAULT_CATALOG } = require('./catalog.js');
    module.exports = factory(DEFAULT_CATALOG);
  } else {
    root.LogisticsPalletizer = factory(
      (root.LogisticsCatalog && root.LogisticsCatalog.DEFAULT_CATALOG) || {}
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DEFAULT_CATALOG) {
  'use strict';

  // =========================================================================
  // 1. CONSTANTES FÍSICAS Y REGLAS DE PALETIZACIÓN OFICIALES (FASE 14.4)
  // =========================================================================

  const PALLET_WOOD_HEIGHT_MM = 144;
  /**
   * DEFAULT_REFERENCE_TOWER_HEIGHT_MM:
   * Gálibo operativo de referencia del modelo, derivado del paletizado
   * máximo conocido y configurable.
   *
   * Control de altura física en torre:
   *   towerHeightMm = sum(palletHeightMm) + sum(merchandiseHeightMm)
   * donde palletHeightMm = 144 mm y towerHeightMm <= referenceTowerHeightMm.
   */
  const DEFAULT_REFERENCE_TOWER_HEIGHT_MM = 2278;

  const DEFAULT_PALLET_RULES = {
    PERA_RAMA: {
      EURO: {
        productId: 'PERA_RAMA',
        palletType: 'EURO',
        boxLength: 600,
        boxWidth: 400,
        boxHeight: 95,
        boxHeightMm: 95,
        palletLength: 1200,
        palletWidth: 800,
        palletHeight: 144,
        boxesPerLayer: 4,
        maxLayers: 19,
        maxStandardBoxes: 76,
        layerPattern: '4_PER_LAYER',
        capacitySource: 'PHYSICAL_CONFIGURATION_OFFICIAL',
        verified: true,
        isRigid: true,
        name: 'Palet Europeo Oficial Pera (4 cjs/capa, 19 capas, 76 cjs)'
      },
      METROCHEP: {
        productId: 'PERA_RAMA',
        palletType: 'METROCHEP',
        boxLength: 600,
        boxWidth: 400,
        boxHeight: 95,
        boxHeightMm: 95,
        palletLength: 1200,
        palletWidth: 1000,
        palletHeight: 144,
        boxesPerLayer: 5,
        maxLayers: 19,
        maxStandardBoxes: 95,
        layerPattern: '5_PER_LAYER',
        capacitySource: 'PHYSICAL_CONFIGURATION_OFFICIAL',
        verified: true,
        isRigid: true,
        name: 'Palet Metrochep Oficial Pera (5 cjs/capa, 19 capas, 95 cjs)'
      }
    },
    COCKTAIL_ROMANTICO: {
      EURO: {
        productId: 'COCKTAIL_ROMANTICO',
        palletType: 'EURO',
        boxLength: 600,
        boxWidth: 400,
        boxHeight: 95,
        boxHeightMm: 95,
        palletLength: 1200,
        palletWidth: 800,
        palletHeight: 144,
        boxesPerLayer: 4,
        maxLayers: 20,
        maxStandardBoxes: 80,
        layerPattern: '4_PER_LAYER',
        capacitySource: 'PHYSICAL_CONFIGURATION_OFFICIAL',
        verified: true,
        isRigid: true,
        name: 'Palet Europeo Oficial Cocktail (4 cjs/capa, 20 capas, 80 cjs)'
      },
      METROCHEP: {
        productId: 'COCKTAIL_ROMANTICO',
        palletType: 'METROCHEP',
        boxLength: 600,
        boxWidth: 400,
        boxHeight: 95,
        boxHeightMm: 95,
        palletLength: 1200,
        palletWidth: 1000,
        palletHeight: 144,
        boxesPerLayer: 5,
        maxLayers: 20,
        maxStandardBoxes: 100,
        layerPattern: '5_PER_LAYER',
        capacitySource: 'PHYSICAL_CONFIGURATION_OFFICIAL',
        verified: true,
        isRigid: true,
        name: 'Palet Metrochep Oficial Cocktail (5 cjs/capa, 20 capas, 100 cjs)'
      }
    },
    CHERRY_RAMA: {
      EURO: {
        productId: 'CHERRY_RAMA',
        palletType: 'EURO',
        boxLength: 400,
        boxWidth: 300,
        boxHeight: 97,
        boxHeightMm: 97,
        palletLength: 1200,
        palletWidth: 800,
        palletHeight: 144,
        boxesPerLayer: 8,
        maxLayers: 22,
        maxStandardBoxes: 176,
        layerPattern: '8_PER_LAYER',
        capacitySource: 'PHYSICAL_CONFIGURATION_OFFICIAL',
        verified: true,
        isRigid: true,
        name: 'Palet Europeo Oficial Cherry (8 cjs/capa, 22 capas, 176 cjs)'
      },
      METROCHEP: {
        productId: 'CHERRY_RAMA',
        palletType: 'METROCHEP',
        boxLength: 400,
        boxWidth: 300,
        boxHeight: 97,
        boxHeightMm: 97,
        palletLength: 1200,
        palletWidth: 1000,
        palletHeight: 144,
        boxesPerLayer: 10,
        maxLayers: 22,
        maxStandardBoxes: 220,
        layerPattern: '10_COMBINED_ORIENTATION',
        capacitySource: 'PHYSICAL_CONFIGURATION_OFFICIAL',
        verified: true,
        isRigid: true,
        name: 'Palet Metrochep Oficial Cherry (10 cjs/capa, 22 capas, 220 cjs)'
      }
    }
  };

  /**
   * Tipo de palet predeterminado por producto
   */
  const DEFAULT_PALLET_TYPE_BY_PRODUCT = {
    PERA_RAMA: 'EURO',
    COCKTAIL_ROMANTICO: 'EURO',
    CHERRY_RAMA: 'EURO'
  };

  // =========================================================================
  // 2. VALIDACIÓN DE ENTRADAS Y COMPATIBILIDAD
  // =========================================================================

  /**
   * Valida la compatibilidad entre un producto y un tipo de palet.
   *
   * @param {string} productId
   * @param {string} palletType
   * @param {Object} [rules=DEFAULT_PALLET_RULES]
   * @returns {{ isValid: boolean, error?: string, rule?: Object }}
   */
  function validatePalletCompatibility(productId, palletType, rules = DEFAULT_PALLET_RULES) {
    if (!productId || typeof productId !== 'string') {
      return {
        isValid: false,
        error: `Identificador de producto no válido: ${productId}`
      };
    }

    if (!palletType || typeof palletType !== 'string') {
      return {
        isValid: false,
        error: `Tipo de palet no válido: ${palletType}`
      };
    }

    const prodRules = rules[productId];
    if (!prodRules) {
      return {
        isValid: false,
        error: `No existen reglas de paletización configuradas para el producto ${productId}`
      };
    }

    const rule = prodRules[palletType];
    if (!rule) {
      const allowed = Object.keys(prodRules).join(', ');
      return {
        isValid: false,
        error: `El producto ${productId} no es compatible con el tipo de palet ${palletType}. Formatos válidos: [${allowed}]`
      };
    }

    return {
      isValid: true,
      rule
    };
  }

  // =========================================================================
  // 3. FUNCIÓN PURA: CÁLCULO DE PALETIZACIÓN PARA UNA CANTIDAD
  // =========================================================================

  /**
   * Calcula la distribución de cajas en palets según las reglas del formato.
   *
   * @param {number} boxes - Cantidad de cajas a paletizar (entero >= 0).
   * @param {Object} palletRule - Regla de paletización ({ palletType, minOperationalBoxes, maxStandardBoxes, isRigid }).
   * @returns {{
   *   totalBoxes: number,
   *   palletCount: number,
   *   pallets: Array<{
   *     palletNumber: number,
   *     boxes: number,
   *     capacity: number,
   *     occupancyPercentage: number,
   *     missingToFull: number,
   *     isFull: boolean,
   *     isOperationalMinimumMet: boolean,
   *     underfill: boolean
   *   }>,
   *   warnings: Array<{ code: string, palletNumber: number, boxes: number, minOperationalBoxes: number, message: string }>,
   *   explanation: string
   * }}
   */
  function calculatePalletization(boxes, palletRule) {
    const warnings = [];

    // Validación numérica defensiva
    if (typeof boxes !== 'number' || isNaN(boxes) || !isFinite(boxes) || boxes < 0) {
      return {
        totalBoxes: 0,
        palletCount: 0,
        pallets: [],
        warnings: [{
          code: 'INVALID_BOX_COUNT',
          palletNumber: 0,
          boxes: 0,
          minOperationalBoxes: 0,
          message: `Cantidad de cajas inválida: ${boxes}`
        }],
        explanation: 'Cantidad de cajas no válida para paletización.'
      };
    }

    const totalBoxes = Math.floor(boxes);
    if (totalBoxes === 0) {
      return {
        totalBoxes: 0,
        palletCount: 0,
        pallets: [],
        warnings: [],
        explanation: 'Sin cajas a paletizar (total = 0).'
      };
    }

    if (!palletRule || typeof palletRule !== 'object') {
      return {
        totalBoxes,
        palletCount: 0,
        pallets: [],
        warnings: [{
          code: 'MISSING_PALLET_RULE',
          palletNumber: 0,
          boxes: totalBoxes,
          minOperationalBoxes: 0,
          message: 'No se suministró una regla de paletización válida.'
        }],
        explanation: 'Regla de paletización ausente.'
      };
    }

    const {
      maxStandardBoxes = 76,
      boxesPerLayer,
      maxLayers,
      boxHeight = 95,
      palletHeight = PALLET_WOOD_HEIGHT_MM
    } = palletRule;

    const capacity = maxStandardBoxes;
    const bpl = boxesPerLayer || (capacity === 176 ? 8 : capacity === 220 ? 10 : 4);
    const bh = boxHeight;
    const palletHeightMm = palletHeight || PALLET_WOOD_HEIGHT_MM;
    const pallets = [];

    const fullPalletsCount = Math.floor(totalBoxes / capacity);
    const remainderBoxes = totalBoxes % capacity;

    for (let i = 1; i <= fullPalletsCount; i++) {
      const pLayers = maxLayers || Math.ceil(capacity / bpl);
      const merchandiseHeightMm = pLayers * bh;
      const palletTotalHeightMm = palletHeightMm + merchandiseHeightMm;

      pallets.push({
        palletNumber: i,
        boxes: capacity,
        capacity,
        occupancyPercentage: 100.0,
        missingToFull: 0,
        isFull: true,
        isOperationalMinimumMet: palletRule.minOperationalBoxes ? true : null,
        underfill: false,
        layers: pLayers,
        boxesPerLayer: bpl,
        boxHeightMm: bh,
        palletHeightMm,
        woodHeightMm: palletHeightMm,
        merchandiseHeightMm,
        palletTotalHeightMm,
        theoreticalHeightMm: palletTotalHeightMm
      });
    }

    if (remainderBoxes > 0) {
      const palletNum = fullPalletsCount + 1;
      const occPct = Math.round((remainderBoxes / capacity) * 10000) / 100;
      const missing = capacity - remainderBoxes;
      const pLayers = Math.ceil(remainderBoxes / bpl);
      const merchandiseHeightMm = pLayers * bh;
      const palletTotalHeightMm = palletHeightMm + merchandiseHeightMm;
      const isUnderfill = Boolean(palletRule.minOperationalBoxes && remainderBoxes < palletRule.minOperationalBoxes);

      pallets.push({
        palletNumber: palletNum,
        boxes: remainderBoxes,
        capacity,
        occupancyPercentage: occPct,
        missingToFull: missing,
        isFull: false,
        isOperationalMinimumMet: palletRule.minOperationalBoxes ? (remainderBoxes >= palletRule.minOperationalBoxes) : null,
        underfill: isUnderfill,
        layers: pLayers,
        boxesPerLayer: bpl,
        boxHeightMm: bh,
        palletHeightMm,
        woodHeightMm: palletHeightMm,
        merchandiseHeightMm,
        palletTotalHeightMm,
        theoreticalHeightMm: palletTotalHeightMm
      });

      warnings.push({
        code: isUnderfill ? 'PALLET_UNDERFILL' : 'PALLET_NOT_FULL',
        palletNumber: palletNum,
        boxes: remainderBoxes,
        minOperationalBoxes: palletRule.minOperationalBoxes || 0,
        message: isUnderfill
          ? `Palet #${palletNum} tiene ${remainderBoxes} cajas (por debajo del mínimo de ${palletRule.minOperationalBoxes}).`
          : `Palet #${palletNum} incompleto: ${remainderBoxes} de ${capacity} cajas.`
      });
    }

    const count = pallets.length;
    let explanation = '';
    if (remainderBoxes === 0) {
      explanation = `${count} palet(s) completo(s) de ${capacity} cajas al 100% de ocupación.`;
    } else {
      explanation = `${fullPalletsCount} palet(s) completo(s) de ${capacity} cajas y 1 palet con ${remainderBoxes} cajas (${Math.round((remainderBoxes / capacity) * 10000) / 100}% ocupación).`;
    }

    return {
      totalBoxes,
      palletCount: pallets.length,
      pallets,
      warnings,
      explanation
    };
  }

  // =========================================================================
  // 4. FUNCIÓN SUPERIOR: PLANIFICACIÓN INTEGRAL DE PALETS (planPallets)
  // =========================================================================

  /**
   * Resuelve el tipo de palet para una combinación plataforma + producto y cantidad.
   * Regla oficial del cliente (Fase 14.4):
   * ¿CABEN EN UN PALET INDIVIDUAL EURO?
   * - PERA RAMA: <= 76 cjs -> EURO; > 76 cjs -> METROCHEP
   * - COCKTAIL ROMÁNTICO: <= 80 cjs -> EURO; > 80 cjs -> METROCHEP
   * - CHERRY RAMA: <= 176 cjs -> EURO; > 176 cjs -> METROCHEP
   *
   * @param {string} platform
   * @param {string} productId
   * @param {Object|Function} [config]
   * @param {number} [totalBoxes=0]
   * @returns {string}
   */
  function resolvePalletType(platform, productId, config, totalBoxes = 0) {
    if (!productId) return 'EURO';

    let configuredType = null;
    if (config && typeof config === 'object') {
      const key = `${platform}::${productId}`;
      if (config[key]) configuredType = config[key];
      else if (config[productId]) configuredType = config[productId];
    }

    if (configuredType) {
      // Regla Fase 9.1: Cherry Rama solo puede ir en METROCHEP si supera la capacidad Euro (176 cjs)
      if (configuredType === 'METROCHEP' && productId === 'CHERRY_RAMA' && totalBoxes > 0 && totalBoxes <= 176) {
        return 'EURO';
      }
      return configuredType;
    }

    if (productId === 'PERA_RAMA') {
      return totalBoxes > 76 ? 'METROCHEP' : 'EURO';
    }

    if (productId === 'COCKTAIL_ROMANTICO') {
      return totalBoxes > 80 ? 'METROCHEP' : 'EURO';
    }

    if (productId === 'CHERRY_RAMA') {
      return totalBoxes > 176 ? 'METROCHEP' : 'EURO';
    }

    return 'EURO';
  }

  /**
   * Planifica la paletización de todas las asignaciones producidas por los motores de carga.
   *
   * @param {Array<Object>|{ allocations: Array<Object> }} allocationsInput - Asignaciones de carga.
   * @param {Object} [palletRules=DEFAULT_PALLET_RULES] - Reglas de paletización.
   * @param {Object|Function} [palletTypeConfiguration={}] - Configuración de formatos de palet.
   * @returns {{
   *   totalBoxes: number,
   *   totalPallets: number,
   *   groups: Array<{
   *     platform: string,
   *     productId: string,
   *     varietyId: string|null,
   *     palletType: string,
   *     totalBoxes: number,
   *     palletCount: number,
   *     pallets: Array<Object>,
   *     warnings: Array<Object>,
   *     explanation: string
   *   }>,
   *   summary: {
   *     byPlatform: Object<string, { boxes: number, pallets: number }>,
   *     byProduct: Object<string, { boxes: number, pallets: number }>,
   *     byPalletType: Object<string, { boxes: number, pallets: number }>
   *   },
   *   warnings: Array<Object>,
   *   errors: Array<Object>
   * }}
   */
  function planPallets(allocationsInput, palletRules = DEFAULT_PALLET_RULES, palletTypeConfiguration = {}, options = {}) {
    const warnings = [];
    const errors = [];
    const referenceTowerHeightMm = (options && options.referenceTowerHeightMm) || DEFAULT_REFERENCE_TOWER_HEIGHT_MM;

    const rawList = Array.isArray(allocationsInput)
      ? allocationsInput
      : (allocationsInput && Array.isArray(allocationsInput.allocations))
        ? allocationsInput.allocations
        : [];

    if (!Array.isArray(rawList)) {
      errors.push({
        code: 'INVALID_ALLOCATIONS_INPUT',
        message: 'La entrada de asignaciones debe ser un array o un objeto con propiedad allocations.'
      });
      return {
        totalBoxes: 0,
        totalPallets: 0,
        totalPalletSlots: 0,
        groups: [],
        summary: { byPlatform: {}, byProduct: {}, byPalletType: {} },
        stackingPlanByPlatform: {},
        warnings,
        errors
      };
    }

    // Filtrar asignaciones efectivas (> 0 cajas)
    const validItems = [];
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;

      const qty = item.allocatedQuantity !== undefined
        ? item.allocatedQuantity
        : item.boxes !== undefined
          ? item.boxes
          : 0;

      if (typeof qty === 'number' && qty > 0) {
        validItems.push({
          platform: String(item.platform || '').trim().toUpperCase(),
          productId: String(item.productId || 'UNKNOWN').trim().toUpperCase(),
          varietyId: item.varietyId ? String(item.varietyId).trim().toUpperCase() : null,
          quantity: Math.floor(qty),
          originalItem: item
        });
      }
    }

    // Agrupar asignaciones por plataforma preservando el orden de entrada
    const platformMap = new Map();
    for (const item of validItems) {
      if (!platformMap.has(item.platform)) {
        platformMap.set(item.platform, []);
      }
      platformMap.get(item.platform).push(item);
    }

    const allGroups = [];
    let grandTotalBoxes = 0;
    let grandTotalPallets = 0;
    let grandTotalPalletSlots = 0;

    const summaryByPlatform = {};
    const summaryByProduct = {};
    const summaryByPalletType = {};
    const stackingPlanByPlatform = {};

    for (const [platform, platItems] of platformMap.entries()) {
      // Agrupar items de la plataforma por tupla (productId, varietyId)
      const itemGroupMap = new Map();
      for (const it of platItems) {
        const varKey = it.varietyId || 'NULL';
        const groupKey = `${it.productId}::${varKey}`;
        if (!itemGroupMap.has(groupKey)) {
          itemGroupMap.set(groupKey, {
            platform,
            productId: it.productId,
            varietyId: it.varietyId,
            totalBoxes: 0
          });
        }
        itemGroupMap.get(groupKey).totalBoxes += it.quantity;
      }

      const platGroupedItems = Array.from(itemGroupMap.values());

      // Ejecutar optimizador global canónico para la plataforma (Fase 16.3)
      const optResult = optimizePlatformPalletization(platform, platGroupedItems, {
        palletRules,
        palletTypeConfiguration,
        referenceTowerHeightMm
      });

      for (const w of optResult.warnings) warnings.push(w);
      for (const e of optResult.errors) errors.push(e);

      for (const g of optResult.groups) {
        allGroups.push(g);

        // Resumen por producto
        if (!summaryByProduct[g.productId]) summaryByProduct[g.productId] = { boxes: 0, pallets: 0 };
        summaryByProduct[g.productId].boxes += g.totalBoxes;
        summaryByProduct[g.productId].pallets += g.palletCount;

        // Resumen por tipo de palet
        if (!summaryByPalletType[g.palletType]) summaryByPalletType[g.palletType] = { boxes: 0, pallets: 0 };
        summaryByPalletType[g.palletType].boxes += g.totalBoxes;
        summaryByPalletType[g.palletType].pallets += g.palletCount;
      }

      grandTotalBoxes += optResult.totalBoxes;
      grandTotalPallets += optResult.totalPallets;
      grandTotalPalletSlots += optResult.totalTowers;

      const platStacking = {
        platform,
        totalPallets: optResult.totalPallets,
        palletSlots: optResult.totalTowers,
        totalTowers: optResult.totalTowers,
        totalBoxes: optResult.totalBoxes,
        euroPalletsCount: optResult.format === 'EURO' ? optResult.totalPallets : 0,
        metroPalletsCount: optResult.format === 'METROCHEP' ? optResult.totalPallets : 0,
        euroSlotsCount: optResult.format === 'EURO' ? optResult.totalTowers : 0,
        metroSlotsCount: optResult.format === 'METROCHEP' ? optResult.totalTowers : 0,
        slots: optResult.towers,
        towers: optResult.towers
      };

      stackingPlanByPlatform[platform] = platStacking;

      summaryByPlatform[platform] = {
        boxes: optResult.totalBoxes,
        pallets: optResult.totalPallets,
        palletSlots: optResult.totalTowers,
        euroPallets: platStacking.euroPalletsCount,
        metroPallets: platStacking.metroPalletsCount,
        euroSlots: platStacking.euroSlotsCount,
        metroSlots: platStacking.metroSlotsCount,
        stackingPlan: platStacking
      };
    }

    return {
      totalBoxes: grandTotalBoxes,
      totalPallets: grandTotalPallets,
      totalPalletSlots: grandTotalPalletSlots,
      groups: allGroups,
      summary: {
        byPlatform: summaryByPlatform,
        byProduct: summaryByProduct,
        byPalletType: summaryByPalletType
      },
      stackingPlanByPlatform,
      warnings,
      errors
    };
  }

  /**
   * Construye el objeto estructurado de una torre (hueco de palet).
   */
  function buildTower(towerPallets, towerIndex = 1, platform = '', format = 'EURO', maxTowerHeightMm = DEFAULT_REFERENCE_TOWER_HEIGHT_MM) {
    const totalWoodHeightMm = towerPallets.length * PALLET_WOOD_HEIGHT_MM;
    const merchandiseHeightMm = towerPallets.reduce((s, p) => s + (p.merchandiseHeightMm || 0), 0);
    const towerHeightMm = totalWoodHeightMm + merchandiseHeightMm;
    const remainingHeightMm = maxTowerHeightMm - towerHeightMm;
    const totalBoxes = towerPallets.reduce((s, p) => s + (p.boxes || 0), 0);
    const isValid = towerPallets.length <= 3 && towerHeightMm <= maxTowerHeightMm;

    return {
      platform,
      palletType: format,
      format,
      towerIndex,
      slotIndex: towerIndex,
      palletCount: towerPallets.length,
      totalPallets: towerPallets.length,
      totalBoxes,
      woodHeightMm: totalWoodHeightMm,
      totalWoodHeightMm,
      merchandiseHeightMm,
      towerHeightMm,
      totalHeightMm: towerHeightMm,
      maxTowerHeightMm,
      remainingHeightMm,
      isValid,
      pallets: towerPallets
    };
  }

  /**
   * Agrupa palets de un mismo formato en el número mínimo de torres válidas
   * respetando:
   * 1. Máximo 3 palets por torre
   * 2. Madera acumulativa de 144 mm por palet físico
   * 3. Altura de mercancía de cada palet
   * 4. Gálibo máximo: alturaTorre <= maxTowerHeightMm (2278 mm por defecto)
   */
  function packPalletsIntoTowers(formatPallets, maxTowerHeightMm = DEFAULT_REFERENCE_TOWER_HEIGHT_MM, platform = '', format = 'EURO') {
    if (!formatPallets || formatPallets.length === 0) return [];
    const limit = maxTowerHeightMm || DEFAULT_REFERENCE_TOWER_HEIGHT_MM;

    // Si los palets suministrados tienen formatos mixtos, empaquetar cada formato por separado para garantizar segregación absoluta
    const formatsPresent = new Set(formatPallets.map(p => p.format || p.palletType).filter(Boolean));
    if (formatsPresent.size > 1) {
      const euro = formatPallets.filter(p => (p.format || p.palletType) !== 'METROCHEP');
      const metro = formatPallets.filter(p => (p.format || p.palletType) === 'METROCHEP');
      const euroTowers = packPalletsIntoTowers(euro, limit, platform, 'EURO');
      const metroTowers = packPalletsIntoTowers(metro, limit, platform, 'METROCHEP');
      const result = [];
      euroTowers.forEach((t, i) => {
        t.slotIndex = i + 1;
        t.towerIndex = i + 1;
        result.push(t);
      });
      metroTowers.forEach((t, i) => {
        t.slotIndex = euroTowers.length + i + 1;
        t.towerIndex = euroTowers.length + i + 1;
        result.push(t);
      });
      return result;
    }

    const fmt = format || (formatPallets[0] && (formatPallets[0].format || formatPallets[0].palletType)) || 'EURO';

    if (formatPallets.length === 1) {
      return [buildTower([formatPallets[0]], 1, platform, fmt, limit)];
    }

    // Comprobación rápida: si todos los palets son <= 3 y caben en 1 sola torre
    if (formatPallets.length <= 3) {
      const totalWood = formatPallets.length * PALLET_WOOD_HEIGHT_MM;
      const totalMerch = formatPallets.reduce((s, p) => s + (p.merchandiseHeightMm || 0), 0);
      if (totalWood + totalMerch <= limit) {
        return [buildTower(formatPallets, 1, platform, fmt, limit)];
      }
    }
    // Ordenar palets de mayor a menor altura de mercancía para empaquetado determinista óptimo
    const sorted = [...formatPallets].sort((a, b) => {
      const aMerch = a.merchandiseHeightMm !== undefined ? a.merchandiseHeightMm : (a.palletTotalHeightMm ? a.palletTotalHeightMm - PALLET_WOOD_HEIGHT_MM : 0);
      const bMerch = b.merchandiseHeightMm !== undefined ? b.merchandiseHeightMm : (b.palletTotalHeightMm ? b.palletTotalHeightMm - PALLET_WOOD_HEIGHT_MM : 0);
      const diff = bMerch - aMerch;
      if (diff !== 0) return diff;
      return (a.palletId || '').localeCompare(b.palletId || '');
    });

    let bestPartition = null;

    function getMerch(p) {
      if (p.merchandiseHeightMm !== undefined) return p.merchandiseHeightMm;
      if (p.palletTotalHeightMm !== undefined) return Math.max(0, p.palletTotalHeightMm - PALLET_WOOD_HEIGHT_MM);
      return 0;
    }

    function canAdd(tower, pallet) {
      if (tower.length >= 3) return false;
      const wood = (tower.length + 1) * PALLET_WOOD_HEIGHT_MM;
      const merch = tower.reduce((s, p) => s + getMerch(p), 0) + getMerch(pallet);
      return (wood + merch) <= limit;
    }

    function search(index, currentTowers) {
      if (bestPartition && currentTowers.length >= bestPartition.length) return;

      if (index === sorted.length) {
        if (!bestPartition || currentTowers.length < bestPartition.length) {
          bestPartition = currentTowers.map(t => [...t]);
        }
        return;
      }

      const pallet = sorted[index];

      for (let i = 0; i < currentTowers.length; i++) {
        if (canAdd(currentTowers[i], pallet)) {
          currentTowers[i].push(pallet);
          search(index + 1, currentTowers);
          currentTowers[i].pop();
        }
      }

      if (!bestPartition || currentTowers.length + 1 < bestPartition.length) {
        currentTowers.push([pallet]);
        search(index + 1, currentTowers);
        currentTowers.pop();
      }
    }

    search(0, []);

    const finalGroups = bestPartition || sorted.map(p => [p]);
    return finalGroups.map((tPallets, idx) =>
      buildTower(tPallets, idx + 1, platform, format, maxTowerHeightMm)
    );
  }

  // =========================================================================
  // 4B. OPTIMIZADOR GLOBAL DE PALETIZACIÓN POR PLATAFORMA (FASE 16.3)
  // =========================================================================

  /**
   * Genera la configuración de palets físicos y torres para una plataforma en un formato homogéneo dado.
   *
   * @param {string} platform
   * @param {Array<Object>} platGroupedItems - Array de items { platform, productId, varietyId, totalBoxes }
   * @param {string} format - 'EURO' | 'METROCHEP'
   * @param {Object} palletRules
   * @param {number} referenceTowerHeightMm
   * @returns {Object}
   */
  function generatePlatformCandidate(platform, platGroupedItems, format, palletRules, referenceTowerHeightMm) {
    const groups = [];
    const pallets = [];
    const warnings = [];
    const errors = [];
    let totalBoxes = 0;

    for (const item of platGroupedItems) {
      const { productId, varietyId, totalBoxes: qty } = item;
      const compCheck = validatePalletCompatibility(productId, format, palletRules);
      if (!compCheck.isValid) {
        errors.push({
          code: 'INCOMPATIBLE_PALLET_TYPE',
          platform,
          productId,
          varietyId,
          palletType: format,
          message: compCheck.error
        });
        continue;
      }

      const rule = compCheck.rule;
      const palResult = calculatePalletization(qty, rule);

      for (const w of palResult.warnings) {
        warnings.push({
          ...w,
          platform,
          productId,
          varietyId,
          palletType: format
        });
      }

      const itemPallets = palResult.pallets.map(p => {
        const bpl = p.boxesPerLayer || rule.boxesPerLayer;
        const bh = p.boxHeightMm || rule.boxHeight;
        const layers = p.layers;
        const merchH = p.merchandiseHeightMm;
        const woodH = p.palletHeightMm || PALLET_WOOD_HEIGHT_MM;
        const totalH = woodH + merchH;

        return {
          palletId: `${platform}::${productId}::${varietyId || 'STD'}::P${p.palletNumber}`,
          platform,
          productId,
          productName: productId,
          varietyId: varietyId || null,
          palletType: format,
          format,
          palletNumber: p.palletNumber,
          boxes: p.boxes,
          capacity: p.capacity,
          occupancyPercentage: p.occupancyPercentage,
          missingToFull: p.missingToFull,
          isFull: p.isFull,
          isOperationalMinimumMet: p.isOperationalMinimumMet,
          underfill: Boolean(p.underfill),
          layers,
          boxesPerLayer: bpl,
          boxHeightMm: bh,
          palletHeightMm: woodH,
          woodHeightMm: woodH,
          merchandiseHeightMm: merchH,
          palletTotalHeightMm: totalH,
          theoreticalHeightMm: totalH
        };
      });

      pallets.push(...itemPallets);
      totalBoxes += qty;

      groups.push({
        platform,
        productId,
        varietyId: varietyId || null,
        palletType: format,
        format,
        totalBoxes: qty,
        palletCount: palResult.palletCount,
        pallets: itemPallets,
        warnings: palResult.warnings,
        explanation: palResult.explanation
      });
    }

    const towers = packPalletsIntoTowers(pallets, referenceTowerHeightMm, platform, format);

    return {
      platform,
      format,
      groups,
      pallets,
      towers,
      totalTowers: towers.length,
      totalPallets: pallets.length,
      totalBoxes,
      warnings,
      errors,
      isValid: errors.length === 0 && towers.length > 0
    };
  }

  /**
   * Optimizador Global de Paletización por Plataforma (Fase 16.3).
   *
   * Regla Canónica:
   * Evalúa candidatos exactamente en orden de torres:
   * 1. 1 TORRE EURO
   * 2. 1 TORRE METROCHEP
   * 3. 2 TORRES EURO
   * 4. 2 TORRES METROCHEP
   * 5. 3 TORRES EURO
   * 6. 3 TORRES METROCHEP
   * 7. 4 TORRES EURO
   * 8. 4 TORRES METROCHEP
   * ...
   * La primera configuración válida encontrada es la seleccionada.
   * Prioridad 1: Minimizar el número de torres.
   * Prioridad 2: A igual número de torres, preferir EURO.
   *
   * @param {string} platform
   * @param {Array<Object>} platGroupedItems
   * @param {Object} [options={}]
   * @returns {Object}
   */
  function optimizePlatformPalletization(platform, platGroupedItems, options = {}) {
    const palletRules = options.palletRules || DEFAULT_PALLET_RULES;
    const referenceTowerHeightMm = options.referenceTowerHeightMm || DEFAULT_REFERENCE_TOWER_HEIGHT_MM;
    const palletTypeConfiguration = options.palletTypeConfiguration || {};

    if (!platGroupedItems || platGroupedItems.length === 0) {
      return {
        platform,
        format: 'EURO',
        groups: [],
        pallets: [],
        towers: [],
        totalTowers: 0,
        totalPallets: 0,
        totalBoxes: 0,
        warnings: [],
        errors: [],
        isValid: true
      };
    }

    // Si hay un override manual explícito configurado para la plataforma
    let forcedFormat = palletTypeConfiguration[platform] || palletTypeConfiguration[`${platform}::GLOBAL`];
    if (!forcedFormat && palletTypeConfiguration && typeof palletTypeConfiguration === 'object') {
      for (const item of platGroupedItems) {
        const pKey = `${platform}::${item.productId}`;
        let configured = palletTypeConfiguration[pKey] || palletTypeConfiguration[item.productId];
        if (configured === 'METROCHEP' && item.productId === 'CHERRY_RAMA' && item.totalBoxes > 0 && item.totalBoxes <= 176) {
          // Regla Fase 9.1: Cherry Rama solo puede ir en METROCHEP si supera la capacidad Euro (176 cjs)
          configured = null;
        }
        if (configured === 'EURO' || configured === 'METROCHEP') {
          forcedFormat = configured;
          break;
        }
      }
    }

    // Regla de salvaguarda adicional si se forzó a nivel plataforma: Cherry Rama solo puede ir en METROCHEP si supera la capacidad Euro (176 cjs)
    if (forcedFormat === 'METROCHEP') {
      const isOnlyCherry = platGroupedItems.length === 1 && platGroupedItems[0].productId === 'CHERRY_RAMA';
      if (isOnlyCherry && platGroupedItems[0].totalBoxes > 0 && platGroupedItems[0].totalBoxes <= 176) {
        forcedFormat = 'EURO';
      }
    }

    if (forcedFormat === 'EURO' || forcedFormat === 'METROCHEP') {
      return generatePlatformCandidate(platform, platGroupedItems, forcedFormat, palletRules, referenceTowerHeightMm);
    }

    const euroCand = generatePlatformCandidate(platform, platGroupedItems, 'EURO', palletRules, referenceTowerHeightMm);
    const metroCand = generatePlatformCandidate(platform, platGroupedItems, 'METROCHEP', palletRules, referenceTowerHeightMm);

    if (!euroCand.isValid && metroCand.isValid) return metroCand;
    if (!metroCand.isValid && euroCand.isValid) return euroCand;
    if (!euroCand.isValid && !metroCand.isValid) return euroCand;

    const maxTowers = Math.max(euroCand.totalTowers, metroCand.totalTowers);
    for (let t = 1; t <= maxTowers; t++) {
      if (euroCand.totalTowers <= t) {
        return euroCand;
      }
      if (metroCand.totalTowers <= t) {
        return metroCand;
      }
    }

    return euroCand;
  }

  /**
   * Calcula el plan de torres y huecos de palet para una plataforma.
   * Reglas oficiales:
   * - Segregación estricta por formato: EURO y METROCHEP nunca comparten torre.
   * - Palets físicos monovarietales y monoproducto.
   * - Madera de 144 mm (palletHeightMm) por palet físico en la torre.
   * - Gálibo operativo de referencia del modelo: towerHeightMm <= referenceTowerHeightMm (2278 mm por defecto, configurable).
   * - Fórmula de altura en torre: towerHeightMm = sum(palletHeightMm) + sum(merchandiseHeightMm).
   * - Máximo 3 palets por torre.
   */
  function calculatePlatformStackingPlan(platform, platformGroups, options = {}) {
    const referenceTowerHeightMm = (options && options.referenceTowerHeightMm) || DEFAULT_REFERENCE_TOWER_HEIGHT_MM;
    const euroPallets = [];
    const metroPallets = [];

    for (const group of platformGroups) {
      const gFormat = group.palletType || group.format || 'EURO';
      const prodRules = DEFAULT_PALLET_RULES[group.productId] || {};
      const formatRule = prodRules[gFormat] || {};

      for (const p of (group.pallets || [])) {
        const bpl = p.boxesPerLayer || formatRule.boxesPerLayer || (gFormat === 'METROCHEP' ? (group.productId === 'CHERRY_RAMA' ? 10 : 5) : (group.productId === 'CHERRY_RAMA' ? 8 : 4));
        const bh = p.boxHeightMm || formatRule.boxHeight || (group.productId === 'CHERRY_RAMA' ? 97 : 95);
        const layers = p.layers || Math.ceil(p.boxes / bpl);
        const merchandiseHeightMm = p.merchandiseHeightMm || (layers * bh);
        const palletHeightMm = p.palletHeightMm || PALLET_WOOD_HEIGHT_MM;
        const palletTotalHeightMm = p.palletTotalHeightMm || (palletHeightMm + merchandiseHeightMm);

        const palletInfo = {
          palletId: p.palletId || `${platform}::${group.productId || p.productId}::${(p.varietyId !== undefined ? p.varietyId : group.varietyId) || 'STD'}::P${p.palletNumber || 1}`,
          platform,
          productId: p.productId || group.productId,
          productName: p.productName || group.productId,
          varietyId: p.varietyId !== undefined ? p.varietyId : (group.varietyId || null),
          palletType: gFormat,
          format: gFormat,
          palletNumber: p.palletNumber || 1,
          boxes: p.boxes,
          capacity: p.capacity || formatRule.maxStandardBoxes || (gFormat === 'METROCHEP' ? 220 : 76),
          occupancyPercentage: p.occupancyPercentage,
          isFull: p.isFull,
          layers,
          boxesPerLayer: bpl,
          boxHeightMm: bh,
          palletHeightMm,
          merchandiseHeightMm,
          palletTotalHeightMm
        };

        if (gFormat === 'METROCHEP') {
          metroPallets.push(palletInfo);
        } else {
          euroPallets.push(palletInfo);
        }
      }
    }

    const euroTowers = packPalletsIntoTowers(euroPallets, referenceTowerHeightMm, platform, 'EURO');
    const metroTowers = packPalletsIntoTowers(metroPallets, referenceTowerHeightMm, platform, 'METROCHEP');

    const allTowers = [];
    euroTowers.forEach((t, i) => {
      t.slotIndex = i + 1;
      t.towerIndex = i + 1;
      allTowers.push(t);
    });
    metroTowers.forEach((t, i) => {
      t.slotIndex = euroTowers.length + i + 1;
      t.towerIndex = euroTowers.length + i + 1;
      allTowers.push(t);
    });

    const allPallets = [...euroPallets, ...metroPallets];

    return {
      platform,
      totalPallets: allPallets.length,
      palletSlots: allTowers.length,
      totalTowers: allTowers.length,
      totalBoxes: allPallets.reduce((sum, p) => sum + (p.boxes || 0), 0),
      euroPalletsCount: euroPallets.length,
      metroPalletsCount: metroPallets.length,
      euroSlotsCount: euroTowers.length,
      metroSlotsCount: metroTowers.length,
      slots: allTowers,
      towers: allTowers
    };
  }

  /**
   * Calcula la altura teórica de la mercancía en milímetros (boxHeight * layers).
   */
  function calculateTheoreticalMerchandiseHeight(layers, boxHeight = 95) {
    if (typeof layers !== 'number' || isNaN(layers) || layers < 0) return 0;
    return Math.round(layers * (boxHeight || 95));
  }

  return {
    PALLET_WOOD_HEIGHT_MM,
    DEFAULT_REFERENCE_TOWER_HEIGHT_MM,
    DEFAULT_PALLET_RULES,
    DEFAULT_PALLET_TYPE_BY_PRODUCT,
    validatePalletCompatibility,
    resolvePalletType,
    calculatePalletization,
    buildTower,
    packPalletsIntoTowers,
    calculatePlatformStackingPlan,
    optimizePlatformPalletization,
    planPallets,
    calculateTheoreticalMerchandiseHeight
  };
});

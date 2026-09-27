/**
 * Capa de UI y Controlador de la SPA "Planificador de Carga"
 *
 * Módulo desacoplado del DOM mediante arquitectura AppState + UIController.
 * UMD compatible con navegador (Vanilla JS ES6+) y Node.js para testing automatizado.
 *
 * Flujo estricto:
 * Usuario introduce datos -> AppState -> UIController -> planLoad(...) -> PlanningResult -> Renderizado
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const orchestrator = require('./orchestrator.js');
    const parser = require('./parser.js');
    const catalog = require('./catalog.js');
    module.exports = factory(orchestrator, parser, catalog);
  } else {
    root.LogisticsUI = factory(
      root.LogisticsOrchestrator,
      root.LogisticsParser,
      root.LogisticsCatalog
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  orchestrator,
  parser,
  catalog
) {
  'use strict';

  const DEFAULT_CATALOG = (catalog && catalog.DEFAULT_CATALOG) || {};
  const planLoad = orchestrator ? orchestrator.planLoad : null;
  const parseForecast = parser ? parser.parseForecast : null;
  const aggregateDemands = parser ? parser.aggregateDemands : null;

  // Configuración por defecto de palets por regla operativa (Fase 9.1: Cataluña no fuerza METROCHEP)
  const DEFAULT_PALLET_CONFIGURATION = {};

  // =========================================================================
  // Etiquetas de variedad (capa de PRESENTACIÓN)
  // =========================================================================
  /**
   * Textos EXACTOS ya certificados para las variedades históricas. Se conservan
   * literalmente para no alterar ninguna salida existente.
   */
  const LEGACY_VARIETY_LABELS = {
    COCKTAIL_ROMANTICO: {
      SAO_PAULO: 'Cocktail SP',
      SUNSTREAM: 'Cocktail SUN',
      CONSABOR: 'CONSABOR'
    }
  };

  /**
   * Etiqueta corta de variedad para PDF/WhatsApp/pantalla, resuelta desde el catálogo.
   * Evita ternarios hardcodeados que solo contemplaban SAO_PAULO y SUNSTREAM, de modo
   * que una variedad nueva (CONSABOR) se rotula correctamente sin tocar la lógica.
   *
   * @param {string} productId
   * @param {string|null} varietyId
   * @returns {string} '' si no hay variedad
   */
  function getVarietyShortLabel(productId, varietyId) {
    if (!varietyId) return '';
    const legacy = LEGACY_VARIETY_LABELS[productId];
    if (legacy && legacy[varietyId]) return legacy[varietyId];

    const prodDef = DEFAULT_CATALOG.products && DEFAULT_CATALOG.products[productId];
    const def = prodDef && Array.isArray(prodDef.varieties)
      ? prodDef.varieties.find(v => v.id === varietyId)
      : null;
    if (def && def.name) return def.name.toUpperCase();

    return String(varietyId).replace(/_/g, ' ');
  }

  /**
   * Etiqueta larga de variedad para el detalle de plataforma.
   * @param {string} productId
   * @param {string|null} varietyId
   * @returns {string} '' si no hay variedad
   */
  function getVarietyLongLabel(productId, varietyId) {
    const short = getVarietyShortLabel(productId, varietyId);
    if (!short) return '';
    return short.charAt(0) + short.slice(1).toLowerCase();
  }

  /**
   * Clases CSS del badge de variedad en la tabla de asignaciones.
   * @param {string|null} varietyId
   * @returns {string}
   */
  function getVarietyBadgeClass(varietyId) {
    if (varietyId === 'SAO_PAULO') return 'bg-blue-950/50 text-blue-300 border-blue-800/60';
    if (varietyId === 'SUNSTREAM') return 'bg-amber-950/50 text-amber-300 border-amber-800/60';
    return 'bg-teal-950/50 text-teal-300 border-teal-800/60';
  }

  /**
   * Sanitizador HTML para prevenir inyecciones XSS en el renderizado DOM.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Datasets reales de prueba (copiados directamente del texto bruto del email)
  const DATASETS = {
    '18_SEP': `SANTANDER\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t4
CENTRO\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t55
SUR\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t58
LEVANTE\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t24
SANTANDER\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t58
CATALUÑA\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t60
LEVANTE\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t74
CENTRO\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t36
CATALUÑA\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t31
SANTANDER\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t24
SUR\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t12
CATALUÑA\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t16
LEVANTE\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t12
SUR\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t12
MALAGA\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t15
MALAGA\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t7
CENTRO\tTue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t24`.trim(),

    '26_AUG': `SANTANDER\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t8
CENTRO\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t46
SUR\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t28
LEVANTE\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t13
SANTANDER\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t15
LEVANTE\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t13
CATALUÑA\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t20
SANTANDER\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t18
SUR\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t8
SUR\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t8
CATALUÑA\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t20
CENTRO\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t31
CATALUÑA\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t6
MALAGA\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t28
LEVANTE\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t25
CENTRO\tTue Aug 25 2026 00:00:00 GMT+0200\t26/08/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t6`.trim(),

    '21_SEP': `CENTRO\t21/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t34
CATALUÑA\t21/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t34
LEVANTE\t21/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t28
SUR\t21/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t24
SANTANDER\t21/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t14
MALAGA\t21/09/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t7
CENTRO\t21/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t29
CATALUÑA\t21/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t15
LEVANTE\t21/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t10
SUR\t21/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t9
SANTANDER\t21/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t4
MALAGA\t21/09/2026\t16228\tTOMATE COCKT.ROMANT. CARREFOUR\t7
CENTRO\t21/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t6
CATALUÑA\t21/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t3
LEVANTE\t21/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t10
SUR\t21/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t3
SANTANDER\t21/09/2026\t18746\tTOMATE CHERRY RAMA SUNSTREAM CARREFOUR\t4`.trim()
  };

  // =========================================================================
  // Helpers de Fechas de Entrega (Día de la Semana + Formateo Operativo)
  // =========================================================================
  const SPANISH_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

  function parseDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    // Formato DD/MM/YYYY
    const dmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10) - 1;
      const y = parseInt(dmy[3], 10);
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime()) && date.getDate() === d && date.getMonth() === m) {
        return date;
      }
    }
    // Formato YYYY-MM-DD
    const ymd = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      const y = parseInt(ymd[1], 10);
      const m = parseInt(ymd[2], 10) - 1;
      const d = parseInt(ymd[3], 10);
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime()) && date.getDate() === d && date.getMonth() === m) {
        return date;
      }
    }
    const fallback = new Date(clean);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  function getDayOfWeekName(dateStr) {
    const d = parseDateString(dateStr);
    if (!d) return '';
    return SPANISH_DAYS[d.getDay()] || '';
  }

  function formatDateWithDay(dateStr) {
    if (!dateStr) return '';
    const day = getDayOfWeekName(dateStr);
    return day ? `${day} ${dateStr}` : dateStr;
  }

  // =========================================================================
  // Helpers de Jerarquía Visual para Previsión Consolidada Desktop (V4)
  // =========================================================================
  function getBasePlatform(order, allOrdersList) {
    if (!order) return '';
    if (order.parentOrderId && Array.isArray(allOrdersList)) {
      const parent = allOrdersList.find(p => p.id === order.parentOrderId);
      if (parent && parent.platform) return String(parent.platform).trim().toUpperCase();
    }
    const plat = String(order.platform || '').trim().toUpperCase();
    const m = plat.match(/^(.*?)\s+\d+$/);
    if (m) {
      return m[1].trim();
    }
    return plat;
  }

  function getProductVarietyDisplay(productId, varietyId) {
    let prodLabel = '';
    if (productId === 'PERA_RAMA') prodLabel = 'PERA';
    else if (productId === 'COCKTAIL_ROMANTICO') prodLabel = 'COCKTAIL';
    else if (productId === 'CHERRY_RAMA') prodLabel = 'CHERRY';
    else prodLabel = String(productId || '').replace(/_/g, ' ');

    const varLabel = getVarietyShortLabel(productId, varietyId);

    let fullLabel = prodLabel;
    if (varLabel && varLabel !== '-' && varLabel !== 'DEFAULT') {
      if (productId === 'CHERRY_RAMA' && varLabel === 'SUNSTREAM') {
        fullLabel = 'CHERRY · SUNSTREAM';
      } else if (productId === 'COCKTAIL_ROMANTICO' && varLabel === 'SUNSTREAM') {
        fullLabel = 'COCKTAIL · SUNSTREAM';
      } else {
        fullLabel = `${prodLabel} · ${varLabel}`;
      }
    }

    let pillLabel = prodLabel;
    if (varLabel && varLabel !== '-' && varLabel !== 'DEFAULT') {
      if (productId === 'CHERRY_RAMA' && varLabel === 'SUNSTREAM') {
        pillLabel = 'SUNSTREAM';
      } else if (productId === 'COCKTAIL_ROMANTICO' && varLabel === 'SUNSTREAM') {
        pillLabel = 'SUNSTREAM';
      } else {
        pillLabel = varLabel;
      }
    }

    return { prodLabel, varLabel, fullLabel, pillLabel };
  }

  // =========================================================================
  // 1. AppState: Estado central de la aplicación
  // =========================================================================
  class AppState {
    constructor() {
      this.reset();
    }

    reset() {
      this.rawText = '';
      this.forecastAnalysis = null;
      this.stock = {
        'PERA_RAMA': 0,
        'COCKTAIL_ROMANTICO::CONSABOR': 0,
        'COCKTAIL_ROMANTICO::SAO_PAULO': 0,
        'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
        'CHERRY_RAMA::SUNSTREAM': 0
      };
      this.locks = [];
      this.exclusions = [];
      this.palletOverrides = {};
      this.planningResult = null;
      this.previousResult = null;
      this.calculatedStock = null;
      this.lastCalculatedAt = null;
      this.planState = 'NO_PLAN'; // 'NO_PLAN', 'PLAN_ACTUALIZADO', 'PLAN_DESACTUALIZADO'
      this.planStatus = 'IDLE'; // 'IDLE', 'PLANIFICACIÓN CORRECTA', 'PLANIFICACIÓN CON INCIDENCIAS', 'PLANIFICACIÓN NO VIABLE'
      // Colección unificada de pedidos (Previsión Consolidada + Anticipados + Divisiones)
      this.orders = [];
      this.selectedDeliveryDate = null;
    }

    setRawText(text) {
      this.rawText = typeof text === 'string' ? text : '';
    }

    _checkPlanSyncState() {
      if (!this.planningResult) {
        this.planState = 'NO_PLAN';
        return;
      }
      if (!this.calculatedStock) {
        this.planState = 'PLAN_ACTUALIZADO';
        return;
      }
      let hasChanged = false;
      const allKeys = new Set([...Object.keys(this.stock), ...Object.keys(this.calculatedStock)]);
      for (const k of allKeys) {
        const currentVal = this.stock[k] || 0;
        const calcVal = this.calculatedStock[k] || 0;
        if (currentVal !== calcVal) {
          hasChanged = true;
          break;
        }
      }
      this.planState = hasChanged ? 'PLAN_DESACTUALIZADO' : 'PLAN_ACTUALIZADO';
    }

    setStockItem(stockKey, value) {
      const num = Math.max(0, Math.floor(Number(value) || 0));
      this.stock[stockKey] = num;
      this._checkPlanSyncState();
    }

    setStock(stockObj) {
      if (!stockObj) return;
      for (const [k, v] of Object.entries(stockObj)) {
        const num = Math.max(0, Math.floor(Number(v) || 0));
        this.stock[k] = num;
      }
      this._checkPlanSyncState();
    }

    setPalletOverride(platform, productId, palletType) {
      if (!platform || !productId || !palletType) return false;
      const key = `${String(platform).trim().toUpperCase()}::${String(productId).trim().toUpperCase()}`;
      this.palletOverrides[key] = String(palletType).trim().toUpperCase();
      return true;
    }

    removePalletOverride(key) {
      if (this.palletOverrides && this.palletOverrides[key]) {
        delete this.palletOverrides[key];
        return true;
      }
      return false;
    }

    addLock(lock) {
      if (!lock || !lock.platform || !lock.productId || !lock.type) return false;
      const cleanLock = {
        platform: String(lock.platform).trim().toUpperCase(),
        productId: String(lock.productId).trim().toUpperCase(),
        type: String(lock.type).trim().toUpperCase()
      };
      if (cleanLock.type === 'FIXED') {
        cleanLock.quantity = Math.max(0, Math.floor(Number(lock.quantity) || 0));
      }
      if (lock.varietyId) {
        cleanLock.varietyId = String(lock.varietyId).trim().toUpperCase();
      }
      if (lock.label) {
        cleanLock.label = String(lock.label).trim();
      }

      // Deduplicar FULL + FULL idénticos
      const isDuplicate = this.locks.some(
        l => l.platform === cleanLock.platform &&
             l.productId === cleanLock.productId &&
             l.type === cleanLock.type &&
             (cleanLock.type !== 'FIXED' || l.quantity === cleanLock.quantity)
      );
      if (isDuplicate) {
        return true;
      }

      this.locks.push(cleanLock);
      return true;
    }

    hasLockConflict(platform, productId) {
      if (!platform || !productId) return false;
      const plat = String(platform).trim().toUpperCase();
      const prod = String(productId).trim().toUpperCase();
      const relevant = this.locks.filter(l => l.platform === plat && l.productId === prod);
      const hasFull = relevant.some(l => l.type === 'FULL');
      const hasFixed = relevant.some(l => l.type === 'FIXED');
      return hasFull && hasFixed;
    }

    removeLock(index) {
      if (index >= 0 && index < this.locks.length) {
        this.locks.splice(index, 1);
        return true;
      }
      return false;
    }

    addExclusion(exclusion) {
      if (!exclusion || !exclusion.type || exclusion.value === undefined || exclusion.value === '') return false;
      const type = String(exclusion.type).trim().toUpperCase();
      let value = exclusion.value;
      if (type === 'LINE') {
        value = Number(value);
        if (isNaN(value) || value <= 0) return false;
      } else {
        value = String(value).trim().toUpperCase();
      }
      this.exclusions.push({
        type,
        value,
        reason: exclusion.reason ? String(exclusion.reason).trim() : 'Exclusión manual'
      });
      return true;
    }

    removeExclusion(index) {
      if (index >= 0 && index < this.exclusions.length) {
        this.exclusions.splice(index, 1);
        return true;
      }
      return false;
    }

    // =======================================================================
    // Gestión de Pedidos Consolidados (Anticipados, Previsión, Divisiones)
    // =======================================================================
    /**
     * Añade un pedido al conjunto unificado de pedidos.
     * @param {Object} orderData
     * @returns {Object} Pedido creado y registrado
     */
    addOrder(orderData) {
      if (!orderData || !orderData.platform || !orderData.productId) {
        throw new Error('El pedido requiere plataforma y producto.');
      }
      const boxes = Math.max(1, Math.floor(Number(orderData.cajas !== undefined ? orderData.cajas : (orderData.requestedQuantity !== undefined ? orderData.requestedQuantity : orderData.boxes)) || 0));
      const platform = String(orderData.platform).trim().toUpperCase();
      const productId = String(orderData.productId).trim().toUpperCase();
      const varietyId = orderData.varietyId ? String(orderData.varietyId).trim().toUpperCase() : null;
      const fechaEntrega = orderData.fechaEntrega ? String(orderData.fechaEntrega).trim() : (this.selectedDeliveryDate || 'Sin fecha');
      const origen = orderData.origen ? String(orderData.origen).trim().toUpperCase() : 'ANTICIPADO';

      const order = {
        id: orderData.id || `ORD-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
        platform,
        productId,
        varietyId,
        cajas: boxes,
        fechaEntrega,
        origen, // 'ANTICIPADO' | 'PREVISION' | 'DIVIDIDO'
        parentOrderId: orderData.parentOrderId || null,
        splitChildren: orderData.splitChildren || null,
        sourceLine: orderData.sourceLine !== undefined ? orderData.sourceLine : null,
        active: orderData.active !== undefined ? Boolean(orderData.active) : true
      };

      if (!this.selectedDeliveryDate && fechaEntrega && fechaEntrega !== 'Sin fecha') {
        this.selectedDeliveryDate = fechaEntrega;
      }

      this.orders.push(order);
      return order;
    }

    /**
     * Añade un pedido anticipado recibido antes de la previsión oficial.
     * @param {Object} orderData
     * @returns {Object}
     */
    addAdvanceOrder(orderData) {
      return this.addOrder({
        ...orderData,
        origen: 'ANTICIPADO'
      });
    }

    /**
     * Importa las líneas parseadas de una previsión respetando pedidos anticipados y divisiones existentes.
     * Deduplicación no destructiva: si una línea coincide al 100% con un anticipado se vincula;
     * si difiere, coexisten ambos para revisión manual sin sobrescritura silenciosa.
     * @param {Array} validLines
     * @param {string|null} detectedDate
     */
    importForecastLines(validLines, detectedDate) {
      // Eliminar pedidos anteriores de tipo PREVISION para permitir re-análisis sin duplicar
      this.orders = this.orders.filter(o => o.origen !== 'PREVISION');

      if (!Array.isArray(validLines)) return;

      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i];
        if (!l) continue;
        const lineDate = l.deliveryDate || detectedDate || 'Sin fecha';
        const lineBoxes = Number(l.requestedQuantity !== undefined ? l.requestedQuantity : (l.boxes !== undefined ? l.boxes : (l.cajas || 0))) || 0;

        // Comprobar coincidencia exacta con anticipado activo
        const exactMatch = this.orders.find(o =>
          o.active &&
          o.origen === 'ANTICIPADO' &&
          o.platform === l.platform &&
          o.productId === l.productId &&
          (o.varietyId || null) === (l.varietyId || null) &&
          o.fechaEntrega === lineDate &&
          o.cajas === lineBoxes
        );

        if (exactMatch) {
          // Ya existe exactamente este pedido anticipado, conservamos el anticipado y vinculamos línea
          exactMatch.sourceLine = l.lineNumber !== undefined ? l.lineNumber : (i + 1);
          continue;
        }

        // Crear pedido de previsión
        this.addOrder({
          platform: l.platform,
          productId: l.productId,
          varietyId: l.varietyId || null,
          cajas: lineBoxes,
          fechaEntrega: lineDate,
          origen: 'PREVISION',
          sourceLine: l.lineNumber !== undefined ? l.lineNumber : (i + 1),
          active: true
        });
      }

      if (!this.selectedDeliveryDate) {
        const dates = this.getAvailableDeliveryDates();
        if (dates.length > 0) this.selectedDeliveryDate = dates[0];
      }
    }

    editOrder(orderId, updates) {
      const order = this.orders.find(o => o.id === orderId);
      if (!order) return false;
      if (updates.platform !== undefined) order.platform = String(updates.platform).trim().toUpperCase();
      if (updates.productId !== undefined) order.productId = String(updates.productId).trim().toUpperCase();
      if (updates.varietyId !== undefined) order.varietyId = updates.varietyId ? String(updates.varietyId).trim().toUpperCase() : null;
      if (updates.cajas !== undefined) {
        order.cajas = Math.max(1, Math.floor(Number(updates.cajas) || 0));
      }
      if (updates.fechaEntrega !== undefined) order.fechaEntrega = String(updates.fechaEntrega).trim();
      return true;
    }

    /**
     * Divide un pedido en dos o más sub-pedidos independientes.
     * Invariante estricto: la suma de cajas de los hijos debe coincidir exactamente con las cajas del pedido original.
     * @param {string} orderId ID del pedido padre
     * @param {Array<{platform: string, cajas: number}>} splits
     * @returns {Array<Object>} Nuevos sub-pedidos creados
     */
    splitOrder(orderId, splits) {
      const parent = this.orders.find(o => o.id === orderId);
      if (!parent) {
        throw new Error(`Pedido no encontrado: ${orderId}`);
      }
      if (!Array.isArray(splits) || splits.length < 2) {
        throw new Error('La división requiere al menos 2 sub-pedidos.');
      }

      const totalSplitBoxes = splits.reduce((sum, s) => sum + Math.max(1, Math.floor(Number(s.cajas) || 0)), 0);
      if (totalSplitBoxes !== parent.cajas) {
        throw new Error(
          `La suma de cajas de la división (${totalSplitBoxes}) no coincide con las cajas del pedido original (${parent.cajas}).`
        );
      }

      // Si ya tenía hijos de una división anterior, desvincularlos primero
      if (Array.isArray(parent.splitChildren) && parent.splitChildren.length > 0) {
        this.unsplitOrder(orderId);
      }

      // Desactivar el pedido padre
      parent.active = false;
      parent.splitChildren = [];

      const createdChildren = [];
      for (let i = 0; i < splits.length; i++) {
        const s = splits[i];
        const childPlatform = String(s.platform || `${parent.platform} ${i + 1}`).trim().toUpperCase();
        const childBoxes = Math.max(1, Math.floor(Number(s.cajas) || 0));

        const childOrder = this.addOrder({
          platform: childPlatform,
          productId: parent.productId,
          varietyId: parent.varietyId,
          cajas: childBoxes,
          fechaEntrega: parent.fechaEntrega,
          origen: 'DIVIDIDO',
          parentOrderId: parent.id,
          sourceLine: parent.sourceLine,
          active: true
        });

        parent.splitChildren.push(childOrder.id);
        createdChildren.push(childOrder);
      }

      return createdChildren;
    }

    /**
     * Deshace la división de un pedido, restaurando el pedido padre y eliminando los hijos.
     * @param {string} orderId ID del pedido padre o de cualquiera de sus hijos
     * @returns {boolean}
     */
    unsplitOrder(orderId) {
      let parent = this.orders.find(o => o.id === orderId);
      if (!parent) return false;

      // Si el id es de un hijo, buscar su padre
      if (parent.parentOrderId) {
        parent = this.orders.find(o => o.id === parent.parentOrderId);
        if (!parent) return false;
      }

      if (!Array.isArray(parent.splitChildren) || parent.splitChildren.length === 0) {
        return false;
      }

      const childIds = new Set(parent.splitChildren);
      this.orders = this.orders.filter(o => !childIds.has(o.id));
      parent.splitChildren = null;
      parent.active = true;
      return true;
    }

    removeOrder(orderId) {
      const idx = this.orders.findIndex(o => o.id === orderId);
      if (idx === -1) return false;
      const order = this.orders[idx];

      // Si tiene hijos de división, eliminarlos también
      if (Array.isArray(order.splitChildren)) {
        const childIds = new Set(order.splitChildren);
        this.orders = this.orders.filter(o => !childIds.has(o.id));
      }

      // Si es un hijo, quitarlo de splitChildren de su padre
      if (order.parentOrderId) {
        const parent = this.orders.find(o => o.id === order.parentOrderId);
        if (parent && Array.isArray(parent.splitChildren)) {
          parent.splitChildren = parent.splitChildren.filter(id => id !== orderId);
          if (parent.splitChildren.length === 0) {
            parent.active = true;
            parent.splitChildren = null;
          }
        }
      }

      this.orders = this.orders.filter(o => o.id !== orderId);
      return true;
    }

    getAvailableDeliveryDates() {
      const dates = new Set();
      for (const o of this.orders) {
        if (o.active && o.fechaEntrega && o.fechaEntrega !== 'Sin fecha') {
          dates.add(o.fechaEntrega);
        }
      }
      return Array.from(dates).sort();
    }

    getActiveDemandOrders(targetDeliveryDate) {
      return this.orders.filter(o => {
        if (!o.active) return false;
        if (targetDeliveryDate && o.fechaEntrega && o.fechaEntrega !== targetDeliveryDate) {
          return false;
        }
        return true;
      });
    }

    setSelectedDeliveryDate(dateStr) {
      this.selectedDeliveryDate = dateStr ? String(dateStr).trim() : null;
    }
  }

  // =========================================================================
  // 1.8 TRAZABILIDAD DE PROCEDENCIA DE CARGA DE PLATAFORMA (V4)
  // =========================================================================
  /**
   * Determina la procedencia de una carga de plataforma en el Plan de Carga.
   * La unidad visual y operativa de procedencia es la CARGA DE PLATAFORMA (slot).
   *
   * Estados permitidos:
   *   - 'ANTICIPADO': El 100% de la demanda activa procede de pedidos ANTICIPADOS.
   *   - 'PREVISIÓN':  El 100% de la demanda activa procede de PREVISIÓN.
   *   - 'MIXTO':      Coexisten ambas procedencias dentro de la demanda activa.
   *   - 'DIVIDIDO':   Subpedido independiente (coexiste con ANTICIPADO si el padre era anticipado).
   *
   * @param {string} platform Nombre de la plataforma en la carga (ej. 'CENTRO', 'CENTRO 1')
   * @param {Array} [ordersInput] Lista de pedidos de AppState o PlanningResult
   * @param {Object} [planningResult] PlanningResult activo
   * @returns {Object} { state, badges, isDivided, basePlatform, anticipadoBoxes, previsionBoxes, totalDemandBoxes, detailText }
   */
  function derivePlatformProvenance(platform, ordersInput, planningResult) {
    const normPlat = String(platform || '').trim().toUpperCase();

    let orderList = [];
    if (Array.isArray(ordersInput) && ordersInput.length > 0) {
      orderList = ordersInput;
    } else if (planningResult && planningResult.sourceSummary && Array.isArray(planningResult.sourceSummary.lines)) {
      orderList = planningResult.sourceSummary.lines;
    } else if (typeof window !== 'undefined' && window.appState && Array.isArray(window.appState.orders)) {
      orderList = window.appState.orders;
    }

    const targetDate = planningResult
      ? (planningResult.deliveryDate || (planningResult.detectedDates && planningResult.detectedDates[0]))
      : null;

    // Filtrar pedidos que correspondan a esta plataforma exacta
    const platOrders = orderList.filter(o => {
      if (!o) return false;
      const oPlat = String(o.platform || '').trim().toUpperCase();
      if (oPlat !== normPlat) return false;
      if (o.active === false || o.estado === 'DIVIDIDO' || o.estado === 'CANCELADO') return false;
      if (targetDate && o.fechaEntrega && o.fechaEntrega !== 'Sin fecha' && o.fechaEntrega !== targetDate) return false;
      return true;
    });

    let basePlat = normPlat;
    let isDivided = false;
    let parentOrigin = null;

    // Detección de subpedido por parentOrderId o getBasePlatform
    for (const o of platOrders) {
      if (o.isDivided || o.origen === 'DIVIDIDO' || o.parentOrderId) {
        isDivided = true;
        if (o.parentOrderId) {
          const parent = orderList.find(p => p && p.id === o.parentOrderId);
          if (parent) {
            basePlat = String(parent.platform || basePlat).trim().toUpperCase();
            parentOrigin = parent.origen ? String(parent.origen).trim().toUpperCase() : null;
          }
        }
      }
    }

    if (!isDivided && typeof getBasePlatform === 'function') {
      const derivedBase = getBasePlatform({ platform: normPlat }, orderList);
      if (derivedBase && derivedBase !== normPlat) {
        isDivided = true;
        basePlat = derivedBase;
      }
    }

    let anticipadoBoxes = 0;
    let previsionBoxes = 0;

    for (const o of platOrders) {
      const boxes = Number(o.cajas !== undefined ? o.cajas : (o.requestedQuantity !== undefined ? o.requestedQuantity : 0)) || 0;
      const orig = String(o.origen || '').trim().toUpperCase();

      if (orig === 'ANTICIPADO') {
        anticipadoBoxes += boxes;
      } else if (orig === 'PREVISION') {
        previsionBoxes += boxes;
      } else if (orig === 'DIVIDIDO' || o.parentOrderId) {
        if (parentOrigin === 'ANTICIPADO') {
          anticipadoBoxes += boxes;
        } else {
          previsionBoxes += boxes;
        }
      } else {
        previsionBoxes += boxes;
      }
    }

    const badges = [];
    let state = 'PREVISIÓN';
    let detailText = '';

    if (isDivided) {
      badges.push('DIVIDIDO');
      if (anticipadoBoxes > 0 && previsionBoxes === 0) {
        badges.push('ANTICIPADO');
        state = 'DIVIDIDO_ANTICIPADO';
      } else if (anticipadoBoxes > 0 && previsionBoxes > 0) {
        badges.push('MIXTO');
        state = 'DIVIDIDO_MIXTO';
        detailText = `${anticipadoBoxes} ANTICIPADO · ${previsionBoxes} PREVISIÓN`;
      } else {
        state = 'DIVIDIDO';
      }
    } else {
      if (anticipadoBoxes > 0 && previsionBoxes === 0) {
        badges.push('ANTICIPADO');
        state = 'ANTICIPADO';
      } else if (anticipadoBoxes > 0 && previsionBoxes > 0) {
        badges.push('MIXTO');
        state = 'MIXTO';
        detailText = `${anticipadoBoxes} ANTICIPADO · ${previsionBoxes} PREVISIÓN`;
      } else {
        badges.push('PREVISIÓN');
        state = 'PREVISIÓN';
      }
    }

    return {
      state,
      badges,
      isDivided,
      basePlatform: basePlat !== normPlat ? basePlat : null,
      anticipadoBoxes,
      previsionBoxes,
      totalDemandBoxes: anticipadoBoxes + previsionBoxes,
      detailText
    };
  }

  function getProvenanceBadgeHTML(badge) {
    if (badge === 'ANTICIPADO') {
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider card-badge-anticipado">ANTICIPADO</span>`;
    }
    if (badge === 'MIXTO') {
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider card-badge-mixto">MIXTO</span>`;
    }
    if (badge === 'DIVIDIDO') {
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider card-badge-dividido">DIVIDIDO</span>`;
    }
    if (badge === 'PREVISIÓN') {
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider card-badge-prevision">PREVISIÓN</span>`;
    }
    return `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#8A8F98] border border-[#2B2F36]">${escapeHtml(badge)}</span>`;
  }

  // =========================================================================
  // 2. buildTruckSlotsModel: Modelo Logístico Puro de Plataformas y Huecos de Palet
  // =========================================================================
  /**
   * Construye el modelo logístico de presentación agrupado por Plataforma y Huecos de Palet.
   * Unidad principal de planificación: PLATAFORMA.
   * Cada plataforma contiene sus palets físicos y sus torres (huecos de palet en suelo).
   * Modelo pasivo: consume exclusivamente las torres y huecos calculados por el dominio (palletizer).
   *
   * @param {Object} planningResult PlanningResult devuelto por planLoad
   * @param {Array} [orders=[]] Lista opcional de pedidos de demanda para derivar procedencia
   * @returns {Object} Modelo estructurado de expedición
   */
  function buildTruckSlotsModel(planningResult, orders = []) {
    if (!planningResult) {
      return {
        totalTruckSlots: 0,
        totalPallets: 0,
        totalBoxes: 0,
        slots: [],
        criticalAlerts: [],
        palletOccupancySummary: {
          totalIncomplete: 0,
          underfillCount: 0,
          details: []
        }
      };
    }

    const prodOrder = { 'CHERRY_RAMA': 1, 'COCKTAIL_ROMANTICO': 2, 'PERA_RAMA': 3 };

    const getProductLabel = (productId) => {
      if (productId === 'CHERRY_RAMA') return 'Cherry Rama';
      if (productId === 'COCKTAIL_ROMANTICO') return 'Cocktail Romántico';
      if (productId === 'PERA_RAMA') return 'Pera Rama';
      return productId;
    };

    const getVarietyLabel = (productId, varietyId) => {
      if (!varietyId) return '';
      // Etiqueta legible derivada del catálogo (CONSABOR, SUNSTREAM, SAO_PAULO, ...)
      // para no requerir cambios cada vez que se registra una variedad nueva.
      const prodDef = DEFAULT_CATALOG.products && DEFAULT_CATALOG.products[productId];
      const def = prodDef && Array.isArray(prodDef.varieties)
        ? prodDef.varieties.find(v => v.id === varietyId)
        : null;
      if (def && def.name) return def.name;
      if (varietyId === 'SAO_PAULO') return 'Sao Paulo';
      if (varietyId === 'SUNSTREAM') return 'Sunstream';
      if (varietyId === 'CONSABOR') return 'Consabor';
      return varietyId;
    };

    const groups = (planningResult.palletSummaries && planningResult.palletSummaries.groups) || [];
    const byPlatformSummary = (planningResult.palletSummaries && planningResult.palletSummaries.byPlatform) || {};

    // Determinar orden determinista de plataformas basado en asignaciones efectivas
    const platSet = new Set();
    const platOrder = [];

    // Priorizar orden de grupos de paletización
    for (const g of groups) {
      if (!platSet.has(g.platform)) {
        platSet.add(g.platform);
        platOrder.push(g.platform);
      }
    }

    // Y también plataformas de allocations con cajas asignadas
    for (const a of (planningResult.allocations || [])) {
      if (a.allocatedQuantity > 0 && !platSet.has(a.platform)) {
        platSet.add(a.platform);
        platOrder.push(a.platform);
      }
    }

    const slots = [];
    let slotIdx = 1;

    for (const plat of platOrder) {
      const platGroups = groups.filter(g => g.platform === plat);
      // Ordenar productos dentro de la plataforma
      platGroups.sort((a, b) => (prodOrder[a.productId] || 99) - (prodOrder[b.productId] || 99));

      const items = platGroups.map(g => {
        const prodLabel = getProductLabel(g.productId);
        const varLabel = getVarietyLabel(g.productId, g.varietyId);
        const palletLabel = `${g.palletCount} × ${g.palletType}`;

        const allocMatch = (planningResult.allocations || []).find(a =>
          a.platform === plat &&
          a.productId === g.productId &&
          (a.varietyId === g.varietyId || (!a.varietyId && !g.varietyId))
        );
        const requestedQuantity = allocMatch ? allocMatch.requestedQuantity : g.totalBoxes;
        const missingQuantity = allocMatch ? allocMatch.missingQuantity : 0;

        return {
          platform: plat,
          productId: g.productId,
          varietyId: g.varietyId,
          productLabel: prodLabel,
          varietyLabel: varLabel,
          palletType: g.palletType,
          palletCount: g.palletCount,
          palletLabel,
          totalBoxes: g.totalBoxes,
          requestedQuantity,
          missingQuantity,
          pallets: (g.pallets || []).map(p => ({
            palletNumber: p.palletNumber,
            boxes: p.boxes,
            capacity: p.capacity,
            occupancyPercentage: p.occupancyPercentage,
            missingToFull: p.missingToFull,
            isFull: p.isFull,
            isOperationalMinimumMet: p.isOperationalMinimumMet,
            underfill: Boolean(p.underfill),
            layers: p.layers,
            theoreticalHeightMm: p.theoreticalHeightMm
          }))
        };
      });

      const totalBoxes = items.reduce((s, it) => s + it.totalBoxes, 0);
      const platSummary = byPlatformSummary[plat] || {};
      const totalPallets = platSummary.pallets !== undefined
        ? platSummary.pallets
        : items.reduce((s, it) => s + it.palletCount, 0);
      const palletSlots = platSummary.palletSlots !== undefined
        ? platSummary.palletSlots
        : 0;
      const stackingPlan = platSummary.stackingPlan || null;
      const provenance = derivePlatformProvenance(plat, orders, planningResult);

      slots.push({
        platform: plat,
        provenance,
        truckSlotIndex: slotIdx++,
        totalBoxes,
        totalPallets,
        palletSlots,
        stackingPlan,
        items
      });
    }

    // Totales globales pasivos leídos directamente del resultado del motor de paletización
    const totalTruckSlots = slots.length;
    const totalPallets = (planningResult.palletSummaries && planningResult.palletSummaries.totalPallets !== undefined)
      ? planningResult.palletSummaries.totalPallets
      : (planningResult.totalPallets !== undefined
          ? planningResult.totalPallets
          : slots.reduce((s, sl) => s + sl.totalPallets, 0));
    const totalPalletSlots = (planningResult.palletSummaries && planningResult.palletSummaries.totalPalletSlots !== undefined)
      ? planningResult.palletSummaries.totalPalletSlots
      : (planningResult.totalPalletSlots !== undefined
          ? planningResult.totalPalletSlots
          : slots.reduce((s, sl) => s + sl.palletSlots, 0));
    const totalBoxes = slots.reduce((s, sl) => s + sl.totalBoxes, 0);

    // Alertas críticas (excluye avisos menores de palet bajo mínimo/incompleto y avisos normales de FIFO)
    const criticalAlerts = [];

    // Errores
    for (const err of (planningResult.errors || [])) {
      criticalAlerts.push(err);
    }

    // Déficit de stock
    const totalReq = (planningResult.demandSummary && planningResult.demandSummary.totalRequested) || 0;
    const totalAlloc = (planningResult.allocations || []).reduce((s, a) => s + a.allocatedQuantity, 0);
    const totalMissing = (planningResult.allocations || []).reduce((s, a) => s + a.missingQuantity, 0);

    if (totalMissing > 0) {
      criticalAlerts.push({
        code: 'STOCK_DEFICIT',
        message: `Déficit de stock: faltan ${totalMissing} cajas por asignar (${totalAlloc}/${totalReq} cajas asignadas).`,
        context: { totalRequested: totalReq, totalAllocated: totalAlloc, totalMissing }
      });
    }

    // Warnings: excluir ocupación parcial y remanente no problemático de lote viejo (Fase 14.1)
    for (const w of (planningResult.warnings || [])) {
      const isOccupancyWarning = (
        w.code === 'PALLET_UNDERFILL' ||
        w.code === 'PALLET_NOT_FULL' ||
        w.code === 'PALLET_MINIMUM_UNDERFILL' ||
        (w.message && (w.message.includes('bajo mínimo') || w.message.includes('incompleto')))
      );
      const isFifoRoutineWarning = (
        w.code === 'FIFO_OLD_LOT_REMAINDER' ||
        (w.message && (w.message.includes('liquidar') || w.message.includes('remanente de Sao Paulo') || w.message.includes('lote viejo')))
      );
      if (!isOccupancyWarning && !isFifoRoutineWarning) {
        criticalAlerts.push(w);
      }
    }

    // Resumen agregado de ocupación de palets
    let totalIncomplete = 0;
    let underfillCount = 0;
    const occupancyDetails = [];

    for (const sl of slots) {
      for (const it of sl.items) {
        for (const p of it.pallets) {
          if (p.underfill) {
            underfillCount++;
            totalIncomplete++;
            occupancyDetails.push({
              platform: sl.platform,
              productId: it.productId,
              varietyId: it.varietyId,
              palletNumber: p.palletNumber,
              boxes: p.boxes,
              capacity: p.capacity,
              type: 'UNDERFILL'
            });
          } else if (!p.isFull) {
            totalIncomplete++;
            occupancyDetails.push({
              platform: sl.platform,
              productId: it.productId,
              varietyId: it.varietyId,
              palletNumber: p.palletNumber,
              boxes: p.boxes,
              capacity: p.capacity,
              type: 'INCOMPLETE'
            });
          }
        }
      }
    }

    const palletOccupancySummary = {
      totalIncomplete,
      underfillCount,
      details: occupancyDetails
    };

    return {
      totalTruckSlots,
      totalPallets,
      totalPalletSlots,
      totalBoxes,
      slots,
      criticalAlerts,
      palletOccupancySummary
    };
  }

  // =========================================================================
  // 2B. computeServedTotalsByArticle: Resumen Global de Cajas Servidas por Artículo (PDF)
  // =========================================================================
  /**
   * Calcula el resumen global con el total de cajas servidas por artículo para la Hoja de Carga (PDF).
   * Reglas estrictas:
   * - Se calcula a partir del resultado final de planificación (allocations).
   * - Suma exclusivamente las cajas efectivamente asignadas en todas las plataformas.
   * - NO utiliza la demanda original para el cómputo de cajas.
   * - NO utiliza el stock.
   * - NO cuenta cajas pendientes.
   * - Agrupa por artículo canónico ante múltiples variedades físicas (ej. Cocktail SP + Sunstream -> TOTAL COCKTAIL).
   * 
   * @param {Object} planningResult PlanningResult devuelto por planLoad
   * @returns {{ totals: Object, byArticle: Object, totalsList: Array<{ article: string, label: string, servedBoxes: number, formattedText: string }>, grandTotal: number }}
   */
  function computeServedTotalsByArticle(planningResult) {
    if (!planningResult) {
      return { totals: {}, byArticle: {}, totalsList: [], grandTotal: 0 };
    }

    const canonicalArticleName = (pid, label) => {
      const id = String(pid || '').toUpperCase();
      const lbl = String(label || '').toUpperCase();
      if (id.startsWith('PERA') || id.includes('PERA') || lbl.includes('PERA')) {
        return 'PERA';
      }
      if (id.startsWith('COCKTAIL') || id.includes('COCKT') || lbl.includes('COCKT')) {
        return 'COCKTAIL';
      }
      if (id.startsWith('CHERRY') || id.includes('CHERRY') || id.includes('SUNSTREAM') || lbl.includes('CHERRY') || lbl.includes('SUNSTREAM')) {
        return 'SUNSTREAM';
      }
      return (lbl || id || 'DESCONOCIDO').replace(/TOMATE_|_RAMA|_ROMANTICO/gi, '').trim().toUpperCase();
    };

    const byArticle = {};

    // 1. Registrar artículos demandados para asegurar que si tienen 0 servidas figuren con 0
    const demandSources = [
      planningResult.demandSummary && planningResult.demandSummary.byProduct,
      planningResult.demandSummary && planningResult.demandSummary.demandsByProduct
    ];
    for (const src of demandSources) {
      if (src && typeof src === 'object') {
        for (const prodKey of Object.keys(src)) {
          if (Number(src[prodKey]) > 0) {
            const art = canonicalArticleName(prodKey);
            if (!(art in byArticle)) {
              byArticle[art] = 0;
            }
          }
        }
      }
    }

    // 2. Sumar exclusivamente las cajas servidas (allocatedQuantity) en todas las plataformas
    const allocations = Array.isArray(planningResult.allocations) ? planningResult.allocations : [];
    for (const alloc of allocations) {
      const art = canonicalArticleName(alloc.productId, alloc.productLabel);
      if (!(art in byArticle)) {
        byArticle[art] = 0;
      }
      const qty = Number(alloc.allocatedQuantity);
      if (!isNaN(qty) && qty > 0) {
        byArticle[art] += qty;
      }
    }

    // 3. Orden preferente: PERA, COCKTAIL, SUNSTREAM, resto alfabético
    const preferredOrder = ['PERA', 'COCKTAIL', 'SUNSTREAM'];
    const articleKeys = Object.keys(byArticle).sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    let grandTotal = 0;
    const totalsList = [];

    for (const art of articleKeys) {
      const servedBoxes = byArticle[art];
      grandTotal += servedBoxes;
      totalsList.push({
        article: art,
        label: art,
        servedBoxes,
        formattedText: `TOTAL ${art}: ${servedBoxes}`
      });
    }

    return {
      totals: byArticle,
      byArticle,
      totalsList,
      grandTotal
    };
  }

  // =========================================================================
  // 3. formatWhatsAppMessage: Salida Operativa Pura para WhatsApp (Móvil)
  // =========================================================================
  /**
   * Genera un mensaje formateado y limpio para compartir por WhatsApp.
   * Jerarquía: PLATAFORMA · Y PALETS
   * Función pura: sin acceso al DOM, sin recalcular nada.
   * @param {Object} planningResult PlanningResult devuelto por planLoad
   * @returns {string}
   */
  function formatWhatsAppMessage(planningResult, orders = []) {
    if (!planningResult) return '';

    const lines = [];

    const rawDeliveryDate = planningResult.deliveryDate ||
      (planningResult.detectedDates && planningResult.detectedDates[0]) ||
      '';
    const dayOfWeek = rawDeliveryDate ? getDayOfWeekName(rawDeliveryDate) : '';
    const dateFormatted = dayOfWeek ? `${dayOfWeek} ${rawDeliveryDate}` : (rawDeliveryDate || 'Sin fecha');

    lines.push(`🚛 *PLAN DE CARGA — ENTREGA: ${dateFormatted}*`);
    lines.push(`Fecha: ${dateFormatted}`);
    lines.push('');

    // TOTAL
    const totalReq = (planningResult.demandSummary && planningResult.demandSummary.totalRequested) || 0;
    const totalAlloc = (planningResult.allocations || []).reduce((s, a) => s + a.allocatedQuantity, 0);
    const totalMissing = (planningResult.allocations || []).reduce((s, a) => s + a.missingQuantity, 0);
    const model = buildTruckSlotsModel(planningResult, orders);
    const totalTruckSlots = model.totalTruckSlots;
    const totalPallets = model.totalPallets;
    const totalPalletSlots = model.totalPalletSlots;

    lines.push('TOTAL');
    lines.push(`📦 ${totalReq} cajas`);
    lines.push(`🟢 ${totalAlloc} asignadas`);
    if (totalMissing > 0) {
      lines.push(`⚠️ ${totalMissing} pendientes`);
    }
    lines.push(`🏢 ${totalTruckSlots} plataformas`);
    const slotWord = totalPalletSlots === 1 ? 'hueco de palet' : 'huecos de palet';
    lines.push(`🅿️ ${totalPalletSlots} ${slotWord}`);
    const palWord = totalPallets === 1 ? 'palet físico' : 'palets físicos';
    lines.push(`📦 ${totalPallets} ${palWord}`);
    lines.push('');

    // Helpers
    const getProductLabel = (productId, varietyId) => {
      if (productId === 'CHERRY_RAMA') return 'Cherry';
      if (productId === 'COCKTAIL_ROMANTICO') {
        // Textos históricos preservados literalmente; CONSABOR se rotula por su nombre.
        if (varietyId === 'SAO_PAULO') return 'Cocktail SP';
        if (varietyId === 'SUNSTREAM') return 'Cocktail Romántico';
        if (varietyId === 'CONSABOR') return getVarietyShortLabel(productId, varietyId);
        return 'Cocktail Romántico';
      }
      if (productId === 'PERA_RAMA') return 'Pera Rama';
      return productId;
    };

    // PLATAFORMAS
    lines.push('PLATAFORMAS');
    lines.push('');

    if (model.slots.length === 0) {
      lines.push('_(Sin asignaciones registradas)_');
      lines.push('');
    } else {
      model.slots.forEach((slot, index) => {
        const platSlotWord = slot.palletSlots === 1 ? 'HUECO DE PALET' : 'HUECOS DE PALET';
        const platPalWord = slot.totalPallets === 1 ? 'PALET' : 'PALETS';

        const prov = slot.provenance || derivePlatformProvenance(slot.platform, orders, planningResult);
        const badgeStr = (prov && prov.badges && prov.badges.length > 0)
          ? ' [' + prov.badges.join('] [') + ']'
          : '';

        lines.push(`${slot.platform}${badgeStr} · ${slot.palletSlots} ${platSlotWord} · ${slot.totalPallets} ${platPalWord}`);

        if (prov && prov.basePlatform && prov.basePlatform !== slot.platform) {
          lines.push(`↳ Subpedido de ${prov.basePlatform}`);
        }
        if (prov && prov.state === 'MIXTO' && prov.detailText) {
          lines.push(`↳ Demanda: ${prov.detailText}`);
        }

        for (const item of slot.items) {
          const prodName = getProductLabel(item.productId, item.varietyId);
          let extra = '';
          if (item.missingQuantity > 0) {
            extra = ` (Faltan ${item.missingQuantity} cjs)`;
          }
          lines.push(`• ${prodName}: ${item.totalBoxes} cjs · ${item.palletType} ×${item.palletCount}${extra}`);
        }
        if (index < model.slots.length - 1) {
          lines.push('');
        }
      });
      lines.push('');
    }

    // PALETIZACIÓN
    lines.push('PALETIZACIÓN');
    lines.push('');

    if (model.slots.length === 0) {
      lines.push('_(Sin palets físicos calculados)_');
    } else {
      model.slots.forEach((slot, index) => {
        lines.push(slot.platform);
        for (const item of slot.items) {
          let shortProd = 'Pera';
          if (item.productId === 'CHERRY_RAMA') shortProd = 'Cherry';
          else if (item.productId === 'COCKTAIL_ROMANTICO') {
            // Antes: SAO_PAULO ? 'Cocktail SP' : 'Cocktail SUN' (etiquetaba CONSABOR como SUN).
            shortProd = getVarietyShortLabel(item.productId, item.varietyId) || 'Cocktail SUN';
          }

          for (const p of item.pallets) {
            lines.push(`• ${shortProd} · ${item.palletType}: ${p.boxes} cjs`);
          }
        }
        if (index < model.slots.length - 1) {
          lines.push('');
        }
      });
    }

    // INCIDENCIAS CRÍTICAS
    const critAlerts = model.criticalAlerts || [];
    if (critAlerts.length > 0) {
      lines.push('');
      lines.push('INCIDENCIAS');
      lines.push('');
      for (const alert of critAlerts) {
        const isError = alert.code && (alert.code.startsWith('INVALID_') || alert.code.startsWith('INCOMPATIBLE_'));
        const icon = isError ? '⛔' : '⚠️';
        const platPrefix = alert.platform ? `[${alert.platform}] ` : '';
        lines.push(`${icon} ${platPrefix}${alert.message}`);
      }
    }

    return lines.join('\n');
  }

  // =========================================================================
  // 3. comparePlanningResults: Comparativa pura entre planes (Fase 10.1)
  // =========================================================================
  /**
   * Función pura para comparar dos instancias de PlanningResult (plan previo vs actual).
   * @param {Object} previousResult
   * @param {Object} currentResult
   * @returns {Object} Informe estructurado de cambios
   */
  function comparePlanningResults(previousResult, currentResult) {
    if (!previousResult || !currentResult) {
      return {
        hasComparison: false,
        deltas: null,
        byPlatform: {},
        byProduct: {},
        changesSummary: [],
        isIdentical: false
      };
    }

    // Totales de plan previo
    const prevAllocations = previousResult.allocations || [];
    const prevAlloc = prevAllocations.reduce((s, a) => s + (a.allocatedQuantity || 0), 0);
    const prevMiss = prevAllocations.reduce((s, a) => s + (a.missingQuantity || 0), 0);
    const prevReq = previousResult.demandSummary ? previousResult.demandSummary.totalRequested : (prevAlloc + prevMiss);
    const prevRemStock = (previousResult.stockRemaining || []).reduce((s, r) => s + (r.remaining || 0), 0);
    const prevPallets = (previousResult.palletSummaries && previousResult.palletSummaries.totalPallets) || 0;
    const prevRate = prevReq > 0 ? (prevAlloc / prevReq) * 100 : 100.0;

    // Totales de plan actual
    const currAllocations = currentResult.allocations || [];
    const currAlloc = currAllocations.reduce((s, a) => s + (a.allocatedQuantity || 0), 0);
    const currMiss = currAllocations.reduce((s, a) => s + (a.missingQuantity || 0), 0);
    const currReq = currentResult.demandSummary ? currentResult.demandSummary.totalRequested : (currAlloc + currMiss);
    const currRemStock = (currentResult.stockRemaining || []).reduce((s, r) => s + (r.remaining || 0), 0);
    const currPallets = (currentResult.palletSummaries && currentResult.palletSummaries.totalPallets) || 0;
    const currRate = currReq > 0 ? (currAlloc / currReq) * 100 : 100.0;

    const deltas = {
      totalRequestedDelta: currReq - prevReq,
      totalAllocatedDelta: currAlloc - prevAlloc,
      totalMissingDelta: currMiss - prevMiss,
      totalRemainingStockDelta: currRemStock - prevRemStock,
      serviceRateDelta: Math.round((currRate - prevRate) * 10) / 10,
      totalPalletsDelta: currPallets - prevPallets
    };

    // Agrupar asignaciones previas por plataforma y producto
    const prevMap = {};
    for (const a of prevAllocations) {
      if (!prevMap[a.platform]) prevMap[a.platform] = { allocatedTotal: 0, missingTotal: 0, products: {} };
      prevMap[a.platform].allocatedTotal += (a.allocatedQuantity || 0);
      prevMap[a.platform].missingTotal += (a.missingQuantity || 0);
      if (!prevMap[a.platform].products[a.productId]) {
        prevMap[a.platform].products[a.productId] = { allocated: 0, missing: 0 };
      }
      prevMap[a.platform].products[a.productId].allocated += (a.allocatedQuantity || 0);
      prevMap[a.platform].products[a.productId].missing += (a.missingQuantity || 0);
    }

    // Agrupar asignaciones actuales por plataforma y producto
    const currMap = {};
    for (const a of currAllocations) {
      if (!currMap[a.platform]) currMap[a.platform] = { allocatedTotal: 0, missingTotal: 0, products: {} };
      currMap[a.platform].allocatedTotal += (a.allocatedQuantity || 0);
      currMap[a.platform].missingTotal += (a.missingQuantity || 0);
      if (!currMap[a.platform].products[a.productId]) {
        currMap[a.platform].products[a.productId] = { allocated: 0, missing: 0 };
      }
      currMap[a.platform].products[a.productId].allocated += (a.allocatedQuantity || 0);
      currMap[a.platform].products[a.productId].missing += (a.missingQuantity || 0);
    }

    const platforms = new Set([
      ...Object.keys(prevMap),
      ...Object.keys(currMap)
    ]);

    const byPlatform = {};
    const changesSummary = [];

    for (const plat of platforms) {
      const prevPlat = prevMap[plat] || { allocatedTotal: 0, missingTotal: 0, products: {} };
      const currPlat = currMap[plat] || { allocatedTotal: 0, missingTotal: 0, products: {} };

      const platAllocDelta = currPlat.allocatedTotal - prevPlat.allocatedTotal;
      const platMissingDelta = currPlat.missingTotal - prevPlat.missingTotal;

      const prodSet = new Set([
        ...Object.keys(prevPlat.products),
        ...Object.keys(currPlat.products)
      ]);

      const products = {};
      for (const prodId of prodSet) {
        const prevProd = prevPlat.products[prodId] || { allocated: 0, missing: 0 };
        const currProd = currPlat.products[prodId] || { allocated: 0, missing: 0 };
        const deltaAlloc = currProd.allocated - prevProd.allocated;
        products[prodId] = {
          previousAllocated: prevProd.allocated,
          currentAllocated: currProd.allocated,
          deltaAllocated: deltaAlloc,
          previousMissing: prevProd.missing,
          currentMissing: currProd.missing,
          deltaMissing: currProd.missing - prevProd.missing
        };

        if (deltaAlloc !== 0) {
          const sign = deltaAlloc > 0 ? `+${deltaAlloc}` : `${deltaAlloc}`;
          changesSummary.push(`${plat} · ${prodId}: ${prevProd.allocated} → ${currProd.allocated} (${sign} cjs)`);
        }
      }

      byPlatform[plat] = {
        previousAllocated: prevPlat.allocatedTotal,
        currentAllocated: currPlat.allocatedTotal,
        deltaAllocated: platAllocDelta,
        previousMissing: prevPlat.missingTotal,
        currentMissing: currPlat.missingTotal,
        deltaMissing: platMissingDelta,
        products
      };
    }

    // Comparativa de stock por producto
    const prevStockMap = {};
    for (const s of (previousResult.stockRemaining || [])) {
      const key = s.stockKey || s.productId;
      prevStockMap[key] = s;
    }
    const currStockMap = {};
    for (const s of (currentResult.stockRemaining || [])) {
      const key = s.stockKey || s.productId;
      currStockMap[key] = s;
    }
    const allStockKeys = new Set([...Object.keys(prevStockMap), ...Object.keys(currStockMap)]);
    const byProduct = {};
    for (const key of allStockKeys) {
      const ps = prevStockMap[key] || { available: 0, used: 0, remaining: 0 };
      const cs = currStockMap[key] || { available: 0, used: 0, remaining: 0 };
      byProduct[key] = {
        previousAllocated: ps.used,
        currentAllocated: cs.used,
        deltaAllocated: cs.used - ps.used,
        previousAvailable: ps.available,
        currentAvailable: cs.available,
        deltaAvailable: cs.available - ps.available
      };
    }

    return {
      hasComparison: true,
      deltas,
      byPlatform,
      byProduct,
      changesSummary,
      isIdentical: deltas.totalAllocatedDelta === 0 && deltas.totalMissingDelta === 0 && changesSummary.length === 0
    };
  }

  // =========================================================================
  // 4. UIController: Orquestación de eventos, llamadas a planLoad y renderizado
  // =========================================================================
  // =========================================================================
  // 3B. CAPA DE PRESENTACIÓN MÓVIL (FASE 18 — MOBILE SHELL)
  // =========================================================================
  /**
   * Este bloque es EXCLUSIVAMENTE presentación. Consume el mismo AppState y el
   * mismo PlanningResult que el shell de escritorio a través de
   * buildTruckSlotsModel(). No recalcula palets, torres, alturas, reparto,
   * FIFO, monovarietalidad ni ningún otro aspecto del dominio.
   */

  /** Vistas válidas del shell móvil (router de presentación, §7). */
  const MOBILE_VIEWS = ['forecast', 'stock', 'plan', 'more', 'locks', 'options'];

  /**
   * Nombre de producto presentable sin duplicar la variedad física.
   * CONSABOR, SUNSTREAM y SAO_PAULO son VARIEDADES de Cocktail/Cherry:
   * nunca se muestran como artículos independientes (§20).
   */
  function getMobileProductName(productId) {
    if (productId === 'PERA_RAMA') return 'Pera Rama';
    if (productId === 'COCKTAIL_ROMANTICO') return 'Cocktail Romántico';
    if (productId === 'CHERRY_RAMA') return 'Cherry Rama';
    return String(productId);
  }

  /**
   * Etiqueta de variedad para el detalle móvil.
   * CONSABOR se rotula "CONSABOR" (no "Cocktail Consabor"): la fila de producto
   * ya indica el artículo, evitando un producto ficticio "CONSABOR".
   */
  function getMobileVarietyName(productId, varietyId) {
    if (!varietyId) return '';
    const legacy = LEGACY_VARIETY_LABELS[productId];
    if (legacy && legacy[varietyId]) return legacy[varietyId];
    return String(varietyId).replace(/_/g, ' ');
  }

  /** Palabra plural correcta para el recuento de palets. */
  function palletWord(n) {
    return n === 1 ? 'palet' : 'palets';
  }

  /** Palabra plural correcta para el recuento de torres. */
  function towerWord(n) {
    return n === 1 ? 'torre' : 'torres';
  }
  class UIController {
    constructor(state = new AppState()) {
      this.state = state;
      this.isGenerating = false;
      this.selectedLockPlatform = 'CENTRO';
      this.expandedPlatforms = new Set();
    }

    togglePlatformDetail(platform) {
      if (!platform) return;
      const plat = String(platform).trim().toUpperCase();
      if (!this.expandedPlatforms) this.expandedPlatforms = new Set();
      if (this.expandedPlatforms.has(plat)) {
        this.expandedPlatforms.delete(plat);
      } else {
        this.expandedPlatforms.add(plat);
      }
      this.renderConsolidatedForecast();
    }

    isPlatformExpanded(platform) {
      if (!platform || !this.expandedPlatforms) return false;
      return this.expandedPlatforms.has(String(platform).trim().toUpperCase());
    }

    expandPlatform(platform) {
      if (!platform) return;
      if (!this.expandedPlatforms) this.expandedPlatforms = new Set();
      this.expandedPlatforms.add(String(platform).trim().toUpperCase());
      this.renderConsolidatedForecast();
    }

    collapsePlatform(platform) {
      if (!platform || !this.expandedPlatforms) return;
      this.expandedPlatforms.delete(String(platform).trim().toUpperCase());
      this.renderConsolidatedForecast();
    }

    selectLockPlatform(platform) {
      if (!platform) return;
      this.selectedLockPlatform = String(platform).trim().toUpperCase();
      this.renderLockPlatformPills();
      this.renderLockActionButtons();
      this.checkLockConflictFeedback();
    }

    getLockActionsForPlatform(platform) {
      const plat = platform || this.selectedLockPlatform || 'CENTRO';
      return [
        { id: 'PERA_RAMA', label: 'PERA COMPLETA', buttonId: 'btn-lock-pera', type: 'FULL' },
        { id: 'COCKTAIL_ROMANTICO', varietyId: 'CONSABOR', label: 'COCKTAIL CONSABOR', buttonId: 'btn-lock-cocktail-consabor', type: 'FULL' },
        { id: 'COCKTAIL_ROMANTICO', varietyId: 'SAO_PAULO', label: 'COCKTAIL SP', buttonId: 'btn-lock-cocktail-sp', type: 'FULL' },
        { id: 'COCKTAIL_ROMANTICO', varietyId: 'SUNSTREAM', label: 'COCKTAIL SUN', buttonId: 'btn-lock-cocktail-sun', type: 'FULL' },
        { id: 'CHERRY_RAMA', label: 'CHERRY COMPLETO', buttonId: 'btn-lock-cherry', type: 'FULL' }
      ];
    }

    createFullLock(productId, varietyId = null, label = '') {
      const platform = this.selectedLockPlatform || 'CENTRO';
      const cleanProd = String(productId).trim().toUpperCase();
      let defaultLabel = label;
      if (!defaultLabel) {
        if (cleanProd === 'PERA_RAMA') defaultLabel = 'PERA COMPLETA';
        else if (cleanProd === 'CHERRY_RAMA') defaultLabel = 'CHERRY COMPLETO';
        else if (varietyId === 'SAO_PAULO') defaultLabel = 'COCKTAIL SP';
        else if (varietyId === 'SUNSTREAM') defaultLabel = 'COCKTAIL SUN';
        else if (varietyId === 'CONSABOR') defaultLabel = 'COCKTAIL CONSABOR';
        else defaultLabel = 'COCKTAIL';
      }
      this.state.addLock({
        platform,
        productId: cleanProd,
        varietyId: varietyId ? String(varietyId).trim().toUpperCase() : null,
        type: 'FULL',
        label: defaultLabel
      });
      this.renderLocksList();
      this.checkLockConflictFeedback();
      this.renderPlanStateBanner();
    }

    addFixedLock(productId, quantity) {
      const platform = this.selectedLockPlatform || 'CENTRO';
      const q = Math.max(0, Math.floor(Number(quantity) || 0));
      if (q <= 0) return false;
      const cleanProd = String(productId).trim().toUpperCase();
      const prodShort = cleanProd === 'PERA_RAMA' ? 'PERA' : cleanProd === 'CHERRY_RAMA' ? 'CHERRY' : 'COCKTAIL';
      this.state.addLock({
        platform,
        productId: cleanProd,
        type: 'FIXED',
        quantity: q,
        label: `${prodShort} (${q} cjs)`
      });
      this.renderLocksList();
      this.checkLockConflictFeedback();
      this.renderPlanStateBanner();
      return true;
    }

    checkLockConflictFeedback() {
      if (typeof document === 'undefined') return;
      const msgEl = document.getElementById('lock-conflict-msg');
      if (!msgEl) return;
      const plat = this.selectedLockPlatform || 'CENTRO';
      const hasConflict = ['PERA_RAMA', 'COCKTAIL_ROMANTICO', 'CHERRY_RAMA'].some(p => this.state.hasLockConflict(plat, p));
      if (hasConflict) {
        msgEl.classList.remove('hidden');
      } else {
        msgEl.classList.add('hidden');
      }
    }

    renderLockPlatformPills() {
      if (typeof document === 'undefined') return;
      const container = document.getElementById('lock-platform-pills');
      if (!container) return;

      const platforms = (this.state.forecastAnalysis && this.state.forecastAnalysis.platformsFound && this.state.forecastAnalysis.platformsFound.length > 0)
        ? this.state.forecastAnalysis.platformsFound
        : (DEFAULT_CATALOG.platforms && DEFAULT_CATALOG.platforms.canonical) || ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA'];

      if (!platforms.includes(this.selectedLockPlatform)) {
        this.selectedLockPlatform = platforms[0];
      }

      const self = this;
      container.innerHTML = platforms.map(p => {
        const isSelected = p === self.selectedLockPlatform;
        const activeClass = isSelected
          ? 'bg-[#EDEDEF] text-[#0B0C0E] font-bold border-transparent shadow-sm'
          : 'bg-[#16181B] hover:bg-[#1D2024] text-[#8A8F98] hover:text-[#EDEDEF] font-medium border-[#22252A]';
        return `
          <button
            type="button"
            data-lock-plat="${p}"
            class="btn-select-lock-plat px-3 py-1.5 rounded-md border text-xs transition-colors duration-150 active:scale-[0.98] ${activeClass}"
          >
            ${p}
          </button>
        `;
      }).join('');

      container.querySelectorAll('.btn-select-lock-plat').forEach(btn => {
        btn.addEventListener('click', e => {
          const plat = e.currentTarget.getAttribute('data-lock-plat');
          self.selectLockPlatform(plat);
        });
      });
    }

    renderLockActionButtons() {
      if (typeof document === 'undefined') return;
      const labelEl = document.getElementById('lock-selected-platform-label');
      if (labelEl) {
        labelEl.textContent = this.selectedLockPlatform || 'CENTRO';
      }
    }

    /**
     * Determina el estado cualitativo de la planificación a partir del PlanningResult real.
     * @param {Object} result PlanningResult devuelto por planLoad
     * @returns {'PLANIFICACIÓN CORRECTA'|'PLANIFICACIÓN CON INCIDENCIAS'|'PLANIFICACIÓN NO VIABLE'}
     */
    static derivePlanStatus(result) {
      if (!result) return 'IDLE';
      const hasErrors = (result.errors && result.errors.length > 0) || !result.isPhysicallyFeasible;
      if (hasErrors) {
        return 'PLANIFICACIÓN NO VIABLE';
      }
      const hasWarnings = result.warnings && result.warnings.length > 0;
      if (hasWarnings) {
        return 'PLANIFICACIÓN CON INCIDENCIAS';
      }
      return 'PLANIFICACIÓN CORRECTA';
    }

    /**
     * Realiza el pre-análisis de la previsión cruda usando el parser oficial.
     * @param {string} rawText
     * @returns {Object} Resumen estructurado para la UI
     */
    analyzeForecast(rawText) {
      this.state.setRawText(rawText);

      if (!parseForecast) {
        throw new Error('Módulo LogisticsParser no disponible.');
      }

      const parsed = parseForecast(this.state.rawText, DEFAULT_CATALOG);
      const allLines = parsed.lines || [];
      const validLines = allLines.filter(l => l && l.isValid);
      const errorLines = (parsed.parsingErrors || []).length;
      const detectedDate = parsed.detectedDate || (parsed.detectedDates && parsed.detectedDates[0]) || null;

      let aggregated = null;
      if (aggregateDemands && validLines.length > 0) {
        aggregated = aggregateDemands(validLines);
      }

      const analysis = {
        totalLines: allLines.length,
        validLinesCount: validLines.length,
        errorLinesCount: errorLines,
        detectedDate,
        detectedDates: parsed.detectedDates || [],
        productsFound: aggregated ? Object.keys(aggregated.totalByProduct || {}) : [],
        platformsFound: aggregated ? (aggregated.platforms || []) : [],
        demandsByProduct: aggregated ? (aggregated.totalByProduct || {}) : {},
        demandsByPlatformAndProduct: aggregated ? (aggregated.demandsByProduct || {}) : {},
        totalRequested: aggregated ? aggregated.totalGeneral : 0,
        warnings: parsed.parsingWarnings || [],
        errors: parsed.parsingErrors || []
      };

      this.state.forecastAnalysis = analysis;
      // Sincronizar pedidos en la Previsión Consolidada (aditivo con pedidos anticipados)
      this.state.importForecastLines(validLines, analysis.detectedDate);
      this.renderConsolidatedForecast();
      return analysis;
    }

    /**
     * Reejecuta el planificador conservando previsión, exclusiones y locks (Fase 10.1).
     * @returns {Object} Nuevo PlanningResult
     */
    recalculatePlan() {
      return this.generatePlan();
    }

    /**
     * Ejecuta el planificador de carga completo sobre el estado actual.
     * @returns {Object} PlanningResult
     */
    generatePlan() {
      if (!planLoad) {
        throw new Error('Módulo LogisticsOrchestrator no disponible.');
      }

      // Preservar plan anterior en memoria sin mutarlo (Fase 10.1)
      if (this.state.planningResult) {
        this.state.previousResult = this.state.planningResult;
      }

      // Resolver pedidos activos para la fecha de entrega seleccionada
      let activeOrders = null;
      let targetDeliveryDate = this.state.selectedDeliveryDate;
      if (this.state.orders && this.state.orders.length > 0) {
        if (!targetDeliveryDate) {
          const availableDates = this.state.getAvailableDeliveryDates();
          if (availableDates.length > 0) {
            targetDeliveryDate = availableDates[0];
            this.state.selectedDeliveryDate = targetDeliveryDate;
          }
        }
        activeOrders = this.state.getActiveDemandOrders(targetDeliveryDate);
      }

      const options = {
        rawText: this.state.rawText,
        demandOrders: activeOrders,
        targetDeliveryDate: targetDeliveryDate,
        stock: { ...this.state.stock },
        locks: [...this.state.locks],
        exclusions: [...this.state.exclusions],
        palletConfiguration: {
          ...DEFAULT_PALLET_CONFIGURATION,
          ...this.state.palletOverrides
        }
      };

      const result = planLoad(options);
      this.state.planningResult = result;
      this.state.calculatedStock = { ...this.state.stock };
      this.state.lastCalculatedAt = new Date();
      this.state.planState = 'PLAN_ACTUALIZADO';
      this.state.planStatus = UIController.derivePlanStatus(result);

      return result;
    }

    // =======================================================================
    // 3B. MOBILE SHELL — Presentación móvil (FASE 18)
    // =======================================================================
    /**
     * Cambia la vista activa del shell móvil.
     * Sólo conmuta `main[data-view]` y el estado aria de la tabbar: no
     * recalcula, no re-renderiza y no altera AppState ni PlanningResult.
     * En escritorio la llamada es inerte (ninguna regla CSS la usa).
     *
     * @param {string} view 'forecast' | 'stock' | 'plan' | 'more' | 'locks' | 'options'
     * @returns {boolean} true si la vista es válida
     */
    setView(view) {
      if (typeof document === 'undefined') return false;
      const key = String(view || '').trim().toLowerCase();
      if (MOBILE_VIEWS.indexOf(key) === -1) return false;

      this.currentView = key;

      const main = document.querySelector('main');
      if (main) main.setAttribute('data-view', key);

      document.querySelectorAll('#mobile-tabbar .mt-tab').forEach(tab => {
        const isCurrent = tab.getAttribute('data-nav-view') === key;
        if (isCurrent) {
          tab.setAttribute('aria-current', 'page');
        } else {
          tab.removeAttribute('aria-current');
        }
      });

      // Al salir de PLAN el detalle abierto pierde su contexto
      if (key !== 'plan') this.closePlatformDetail();

      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
      this.updateWorkflowBar();
      return true;
    }

    /** Modelo logístico del plan actual, cacheado por identidad de resultado. */
    getMobileModel() {
      const result = this.state.planningResult;
      if (!result) return null;
      if (this._mobileModel && this._mobileModelSource === result) {
        return this._mobileModel;
      }
      this._mobileModel = buildTruckSlotsModel(result, this.state.orders);
      this._mobileModelSource = result;
      return this._mobileModel;
    }

    /**
     * Abre el detalle de plataforma (§9). Consume exclusivamente el modelo
     * derivado del PlanningResult vigente.
     * @param {string} platform
     * @returns {boolean}
     */
    openPlatformDetail(platform) {
      if (typeof document === 'undefined' || !platform) return false;

      const modal = document.getElementById('platform-detail-modal');
      const bodyEl = document.getElementById('pdm-body');
      const nameEl = document.getElementById('pdm-platform-name');
      if (!modal || !bodyEl || !nameEl) return false;

      const model = this.getMobileModel();
      if (!model) return false;

      const slot = (model.slots || []).find(s => s.platform === platform);
      if (!slot) return false;

      nameEl.textContent = slot.platform;
      bodyEl.innerHTML = this.buildPlatformDetailHTML(slot);
      modal.hidden = false;
      document.body.classList.add('pdm-lock');

      const closeBtn = document.getElementById('pdm-close');
      if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();

      this.detailPlatform = slot.platform;
      return true;
    }

    /** Cierra el detalle de plataforma. */
    closePlatformDetail() {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('platform-detail-modal');
      if (modal && !modal.hidden) {
        modal.hidden = true;
        document.body.classList.remove('pdm-lock');
        this.detailPlatform = null;
      }
    }

    /**
     * Construye el HTML del detalle de plataforma.
     * Jerarquía estricta (§10): PLATAFORMA > PRODUCTO > VARIEDAD > CAJAS > PALET > TORRE.
     * Todos los valores provienen del modelo; no se inventa ni se recalcula nada.
     *
     * @param {Object} slot Slot de buildTruckSlotsModel
     * @returns {string} HTML
     */
    buildPlatformDetailHTML(slot) {
      if (!slot) return '';

      const towers = (slot.stackingPlan && slot.stackingPlan.towers) ? slot.stackingPlan.towers : [];

      // --- Cabecera de cifras ------------------------------------------------
      const heroHTML = `
        <div class="pdm-hero">
          <div><b>${slot.totalBoxes}</b><span>Cajas</span></div>
          <div><b>${slot.totalPallets}</b><span>${palletWord(slot.totalPallets)}</span></div>
          <div><b>${towers.length}</b><span>${towerWord(towers.length)}</span></div>
        </div>
      `;

      // --- Productos ---------------------------------------------------------
      const productsHTML = (slot.items || []).map(item => {
        const varietyName = getMobileVarietyName(item.productId, item.varietyId);
        const varietyHTML = varietyName
          ? `<span class="pdm-prod-var">${escapeHtml(varietyName)}</span>`
          : '';

        const missingTag = item.missingQuantity > 0
          ? `<span class="pdm-tag is-missing">Faltan ${item.missingQuantity} cjs</span>`
          : '';

        const palletRows = (item.pallets || []).map(p => {
          const occClass = p.isFull ? 'pdm-occ' : 'pdm-occ is-partial';
          return `
            <div class="pdm-pallet-row">
              <span>Palet <b>#${p.palletNumber}</b> · <b>${p.boxes}</b>/${p.capacity} cjs</span>
              <span class="${occClass}">${p.occupancyPercentage}%</span>
            </div>
          `;
        }).join('');

        return `
          <div class="pdm-prod">
            <div class="pdm-prod-head">
              <div>
                <div class="pdm-prod-name">${escapeHtml(getMobileProductName(item.productId))}</div>
                ${varietyHTML}
              </div>
              <div class="pdm-prod-boxes">
                <b>${item.totalBoxes}</b>
                <span>cajas</span>
              </div>
            </div>
            <div class="pdm-prod-meta">
              <span class="pdm-tag${item.palletType === 'METROCHEP' ? ' is-metro' : ''}">${item.palletType}</span>
              <span class="pdm-tag">${item.palletCount} ${palletWord(item.palletCount)}</span>
              ${missingTag}
            </div>
            <div class="pdm-pallets">${palletRows}</div>
          </div>
        `;
      }).join('');

      // --- Torres ------------------------------------------------------------
      let towersHTML = '';
      if (towers.length > 0) {
        towersHTML = towers.map(t => {
          const inner = (t.pallets || []).map((p, pIdx) => {
            const varietyName = getMobileVarietyName(p.productId, p.varietyId);
            const prodName = escapeHtml(getMobileProductName(p.productId)) +
              (varietyName ? ` · ${escapeHtml(varietyName)}` : '');

            const merchH = p.merchandiseHeightMm || 0;
            const woodH = p.palletHeightMm || 144;
            const totalH = p.palletTotalHeightMm || (merchH + woodH);
            const layersTxt = `${p.layers} ${p.layers === 1 ? 'capa' : 'capas'}`;

            return `
              <div class="pdm-tpallet">
                <div class="pdm-tpallet-top">
                  <span class="pdm-tpallet-name"><em>P${pIdx + 1}</em>${prodName}</span>
                  <span class="pdm-tpallet-mm">${totalH} mm</span>
                </div>
                <div class="pdm-tpallet-sub">
                  <span>${p.boxes} cjs · ${layersTxt}</span>
                  <span>${merchH} mm merc. + ${woodH} mm madera</span>
                </div>
              </div>
            `;
          }).join('');

          return `
            <div class="pdm-tower">
              <div class="pdm-tower-head">
                <span class="pdm-tower-name">
                  <span class="pdm-tower-fmt${t.format === 'METROCHEP' ? ' is-metro' : ''}">${t.format}</span>
                  Torre ${t.towerIndex}
                </span>
                <span class="pdm-tower-h">
                  Altura <b>${t.towerHeightMm}</b> / ${t.maxTowerHeightMm} mm
                  <span class="pdm-rest">· quedan ${t.remainingHeightMm} mm</span>
                </span>
              </div>
              <div class="pdm-tower-body">${inner}</div>
            </div>
          `;
        }).join('');
      } else {
        towersHTML = '<p class="pdm-empty">Sin torres registradas para esta plataforma.</p>';
      }

      return `
        ${heroHTML}
        <div>
          <div class="pdm-group-title">Productos · ${(slot.items || []).length}</div>
        </div>
        ${productsHTML}
        <div>
          <div class="pdm-group-title">Torres · ${towers.length}</div>
        </div>
        ${towersHTML}
      `;
    }

    /**
     * Vuelca el resumen compacto móvil (§5) y el contexto de la vista "MÁS".
     * Fuente: PlanningResult vigente (o ceros si no hay plan).
     * @param {Object|null} result
     */
    /**
     * FASE 18.5 · Indicador de FLUJO OPERATIVO.
     *
     * Convierte la antigua banda de estado (`#mkpi-foot`) en una guía visual del
     * workflow: PREVISIÓN → STOCK → PLAN → SALIDA.
     *
     * NO introduce estado nuevo ni una máquina de estados: se deriva
     * EXCLUSIVAMENTE de lo que ya existe en AppState.
     *   · Paso 1 PREVISIÓN : state.forecastAnalysis.validLinesCount > 0
     *   · Paso 2 STOCK     : referencias de state.stock con valor > 0
     *   · Paso 3 PLAN      : planningResult != null
     *   · Paso 4 SALIDA    : el plan existe (las acciones ya están disponibles)
     * Las cifras que muestra (plataformas, cajas, faltantes) salen del propio
     * análisis / PlanningResult: no se inventa ninguna.
     *
     * Es una GUÍA: no bloquea, no obliga y no cambia la navegación.
     *
     * @param {Object} [result] PlanningResult recién calculado, si lo hay.
     */
    /**
     * FASE MOBILE V1: Sincroniza la barra principal de workflow (#mobile-workflow-bar)
     * reflejando las 4 etapas (Previsión, Stock, Bloqueos, Plan) con sus estados
     * reactivos (is-active, is-done, is-next, is-pending), chips y números.
     * También actualiza la visibilidad de los bloques dependientes del plan
     * (is-preplan / has-plan en #mobile-kpi-summary y bloque de salida).
     */
    updateWorkflowBar() {
      if (typeof document === 'undefined') return;

      const analysis = this.state.forecastAnalysis;
      const forecastDone = !!(analysis && analysis.validLinesCount > 0);

      const stock = this.state.stock || {};
      const stockKeys = Object.keys(stock);
      const stockCount = stockKeys.filter((k) => Number(stock[k]) > 0).length;
      const stockDone = stockCount > 0;

      const locks = this.state.locks || [];
      const locksDone = locks.length > 0;

      const plan = this.state.planningResult;
      const planDone = !!plan;

      const currentView = this.currentView || 'forecast';

      // Siguiente acción recomendada (guía sin bloqueo)
      let next = 'forecast';
      if (forecastDone) next = stockDone ? (planDone ? 'out' : 'plan') : 'stock';

      // Actualizar #mobile-kpi-summary clase is-preplan / has-plan
      const kpiSummary = document.getElementById('mobile-kpi-summary');
      if (kpiSummary) {
        if (planDone) {
          kpiSummary.classList.remove('is-preplan');
          kpiSummary.classList.add('has-plan');
        } else {
          kpiSummary.classList.add('is-preplan');
          kpiSummary.classList.remove('has-plan');
        }
      }

      // Actualizar bloque de salida en vista Plan
      const outputActions = document.getElementById('plan-mobile-output-actions');
      if (outputActions) {
        if (planDone) {
          outputActions.classList.remove('hidden');
        } else {
          outputActions.classList.add('hidden');
        }
      }

      const bar = document.getElementById('mobile-workflow-bar');
      if (!bar) return;

      const stepsMap = {
        forecast: {
          num: 1,
          done: forecastDone,
          active: currentView === 'forecast',
          isNext: !forecastDone && next === 'forecast',
          subDone: (analysis && analysis.totalRequested ? analysis.totalRequested + ' cjs' : 'Analizada'),
          subPending: 'Pega datos'
        },
        stock: {
          num: 2,
          done: stockDone,
          active: currentView === 'stock',
          isNext: !stockDone && next === 'stock',
          subDone: stockCount + ' ref' + (stockCount === 1 ? '' : 's'),
          subPending: 'Existencias'
        },
        locks: {
          num: 3,
          done: locksDone,
          active: currentView === 'locks',
          isNext: false,
          subDone: locks.length + ' activo' + (locks.length === 1 ? '' : 's'),
          subPending: 'Opcional'
        },
        plan: {
          num: 4,
          done: planDone,
          active: currentView === 'plan',
          isNext: !planDone && next === 'plan',
          subDone: 'Calculado',
          subPending: 'Generar'
        }
      };

      const stepButtons = bar.querySelectorAll('.mwb-step');
      stepButtons.forEach((btn) => {
        const target = btn.getAttribute('data-wf-target');
        const cfg = stepsMap[target];
        if (!cfg) return;

        btn.classList.remove('is-active', 'is-done', 'is-next', 'is-pending');
        if (cfg.active) btn.classList.add('is-active');
        if (cfg.done) btn.classList.add('is-done');
        else if (cfg.isNext) btn.classList.add('is-next');
        else if (!cfg.active) btn.classList.add('is-pending');

        if (cfg.active) {
          btn.setAttribute('aria-current', 'step');
        } else {
          btn.removeAttribute('aria-current');
        }

        const numEl = btn.querySelector('.mwb-num');
        if (numEl) {
          numEl.textContent = cfg.done ? '✓' : String(cfg.num);
        }

        const subEl = btn.querySelector('.mwb-sub');
        if (subEl) {
          subEl.textContent = cfg.done ? cfg.subDone : (cfg.isNext ? 'Siguiente →' : cfg.subPending);
        }
      });
    }

    renderWorkflowStrip(result) {
      if (typeof document === 'undefined') return;
      const el = document.getElementById('mkpi-foot');
      if (!el) return;

      const analysis = this.state.forecastAnalysis;
      const forecastDone = !!(analysis && analysis.validLinesCount > 0);

      const stock = this.state.stock || {};
      const stockKeys = Object.keys(stock);
      const stockCount = stockKeys.filter((k) => Number(stock[k]) > 0).length;
      const stockReady = stockCount > 0;

      const plan = result || this.state.planningResult;
      const planDone = !!plan;
      const incidencia = planDone && this.state.planStatus === 'PLANIFICACIÓN CON INCIDENCIAS';

      // FASE 18.6 · §4 · BLOQUEOS Y EXCEPCIONES pasan a ser una ETAPA del flujo,
      // no una función escondida en MÁS. Se derivan del array que YA existe
      // (`state.locks`): no se crea ningún estado nuevo.
      const locks = this.state.locks || [];
      const locksCount = locks.length;
      const locksDone = locksCount > 0;

      // Siguiente paso recomendado — sólo orientación, nunca bloqueo.
      // BLOQUEOS es opcional: tras preparar el stock, la acción es generar.
      let next = 'forecast';
      if (forecastDone) next = stockReady ? (planDone ? 'out' : 'plan') : 'stock';

      const STEPS = [
        { id: 'forecast', n: '1', label: 'Previsión' },
        { id: 'stock', n: '2', label: 'Stock' },
        { id: 'locks', n: '3', label: 'Bloqueos' },
        { id: 'plan', n: '4', label: 'Plan' },
        { id: 'out', n: '5', label: 'Salida' }
      ];
      // FASE 18.5.1 · §3 · CORRECCIÓN SEMÁNTICA DE SALIDA.
      // Que exista un plan NO significa que la salida esté hecha: la app no
      // tiene ningún estado fiable de "PDF generado", "WhatsApp copiado" ni
      // "impreso", y esta fase prohíbe inventarlo. Por tanto SALIDA nunca se
      // marca como completada: queda como la siguiente acción DISPONIBLE (→).
      const done = { forecast: forecastDone, stock: stockReady, locks: locksDone, plan: planDone, out: false };

      const items = STEPS.map((s) => {
        const isNext = !done[s.id] && s.id === next;
        const cls = done[s.id] ? 'is-done' : (isNext ? 'is-next' : 'is-pending');
        const mark = done[s.id] ? '✓' : (isNext ? '→' : '·');
        const warn = (s.id === 'plan' && incidencia) ? ' is-warn' : '';
        return '<span class="wf-step ' + cls + warn + '">' +
          '<i aria-hidden="true">' + mark + '</i>' + s.label + '</span>';
      }).join('<span class="wf-sep" aria-hidden="true"></span>');

      // Detalle operativo real (nunca cifras inventadas).
      let detail = '';
      if (planDone) {
        const allocs = plan.allocations || [];
        const missing = allocs.reduce((s, a) => s + (a.missingQuantity || 0), 0);
        detail = missing > 0
          ? 'faltan ' + missing + ' cjs por servir · exporta en MÁS'
          : 'plan completo · exporta en MÁS';
      } else if (forecastDone) {
        const plats = (analysis.platformsFound || []).length;
        detail = plats + ' plataforma' + (plats === 1 ? '' : 's') +
          ' · ' + (analysis.totalRequested || 0) + ' cajas';
        if (stockReady) detail += ' · stock ' + stockCount + '/' + stockKeys.length;
      } else {
        detail = 'Pega la previsión recibida por email y pulsa Analizar';
      }

      el.innerHTML = '<span class="wf-track">' + items + '</span>' +
        '<span class="wf-detail">' + detail + '</span>';
      if (el.setAttribute) el.setAttribute('data-wf-next', next);

      // §4 · Estado del PASO 3, derivado del MISMO array state.locks.
      // «Sin bloqueos» no es un logro: se informa, no se marca como completado.
      const lockStatus = document.getElementById('wf-locks-status');
      if (lockStatus) {
        lockStatus.textContent = locksCount === 0
          ? 'Sin bloqueos ni excepciones'
          : locksCount + (locksCount === 1 ? ' bloqueo activo' : ' bloqueos activos');
      }
    }

    renderMobileKpis(result) {
      if (typeof document === 'undefined') return;

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };

      if (!result) {
        setText('mkpi-boxes', 0);
        setText('mkpi-assigned', 0);
        setText('mkpi-pending', 0);
        setText('mkpi-platforms', 0);
        setText('mkpi-pallets', 0);
        setText('mkpi-towers', 0);
        // FASE 18.5: la banda de estado pasa a ser el indicador de flujo.
        this.renderWorkflowStrip();
        this.updateWorkflowBar();
        setText('mm-delivery-date', '--/--/----');
        setText('mm-status', 'SIN PLAN');
        return;
      }

      const allocations = result.allocations || [];
      const totalAllocated = allocations.reduce((s, a) => s + (a.allocatedQuantity || 0), 0);
      const totalMissing = allocations.reduce((s, a) => s + (a.missingQuantity || 0), 0);

      const model = this.getMobileModel() || { slots: [], totalPallets: 0 };
      const slots = model.slots || [];
      const totalTowers = slots.reduce((s, sl) => {
        const t = (sl.stackingPlan && sl.stackingPlan.towers) ? sl.stackingPlan.towers : [];
        return s + t.length;
      }, 0);

      setText('mkpi-boxes', totalAllocated);
      setText('mkpi-assigned', totalAllocated);
      setText('mkpi-pending', totalMissing);
      setText('mkpi-platforms', slots.length);
      setText('mkpi-pallets', model.totalPallets || 0);
      setText('mkpi-towers', totalTowers);

      const pendingCell = document.getElementById('mkpi-pending-cell');
      if (pendingCell) {
        if (totalMissing > 0) pendingCell.classList.remove('is-zero');
        else pendingCell.classList.add('is-zero');
      }

      const deliveryDate = result.deliveryDate ||
        (result.detectedDates && result.detectedDates[0]) || '--/--/----';

      // FASE 18.5: el detalle operativo lo compone el indicador de flujo, que
      // además marca ✓/→/· por etapa. Las cajas asignadas ya se ven en los KPI
      // CAJAS y ASIGNADAS, así que no se duplica aquí.
      this.renderWorkflowStrip(result);
      this.updateWorkflowBar();

      setText('mm-delivery-date', deliveryDate);
      setText('mm-status', this.state.planStatus || 'SIN PLAN');

      // Badges numéricos de la tabbar
      const badgeForecast = document.getElementById('mt-badge-forecast');
      if (badgeForecast) {
        const forecastLines = (this.state.forecastAnalysis && this.state.forecastAnalysis.validLinesCount) || 0;
        if (forecastLines > 0) {
          badgeForecast.textContent = String(forecastLines);
          badgeForecast.hidden = false;
        } else {
          badgeForecast.hidden = true;
        }
      }

      const badgePlan = document.getElementById('mt-badge-plan');
      if (badgePlan) {
        if (totalMissing > 0) {
          badgePlan.textContent = String(totalMissing);
          badgePlan.hidden = false;
        } else {
          badgePlan.hidden = true;
        }
      }
    }
    // =======================================================================
    // 3. VINCULACIÓN Y RENDERIZADO EN DOM (Navegador)
    // =======================================================================

    /**
     * Inicializa los escuchadores de eventos del DOM y el estado visual.
     */
    bindDOM() {
      if (typeof document === 'undefined') return;

      const self = this;

      // Botones de datasets de ejemplo
      const btnLoad18Sep = document.getElementById('btn-load-18sep');
      const btnLoad26Aug = document.getElementById('btn-load-26aug');
      const tsvInput = document.getElementById('tsv-input');

      if (btnLoad18Sep && tsvInput) {
        btnLoad18Sep.addEventListener('click', () => {
          tsvInput.value = DATASETS['18_SEP'];
          self.handleAnalyze();
          // Sugerir stock típico para 18 Sep
          self.fillStock({
            'PERA_RAMA': 320,
            'COCKTAIL_ROMANTICO::CONSABOR': 0,
            'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
            'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
            'CHERRY_RAMA::SUNSTREAM': 100
          });
        });
      }

      if (btnLoad26Aug && tsvInput) {
        btnLoad26Aug.addEventListener('click', () => {
          tsvInput.value = DATASETS['26_AUG'];
          self.handleAnalyze();
          self.fillStock({
            'PERA_RAMA': 134,
            'COCKTAIL_ROMANTICO::CONSABOR': 0,
            'COCKTAIL_ROMANTICO::SAO_PAULO': 50,
            'COCKTAIL_ROMANTICO::SUNSTREAM': 58,
            'CHERRY_RAMA::SUNSTREAM': 60
          });
        });
      }

      // Botón "Analizar previsión"
      const btnAnalyze = document.getElementById('btn-analyze');
      if (btnAnalyze && tsvInput) {
        btnAnalyze.addEventListener('click', () => {
          self.handleAnalyze();
        });
      }

      // Inputs de Stock
      const stockInputs = [
        { id: 'stock-pera', key: 'PERA_RAMA' },
        { id: 'stock-cocktail-consabor', key: 'COCKTAIL_ROMANTICO::CONSABOR' },
        { id: 'stock-cocktail-sp', key: 'COCKTAIL_ROMANTICO::SAO_PAULO' },
        { id: 'stock-cocktail-sun', key: 'COCKTAIL_ROMANTICO::SUNSTREAM' },
        { id: 'stock-cherry-sun', key: 'CHERRY_RAMA::SUNSTREAM' }
      ];

      stockInputs.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
          el.addEventListener('input', e => {
            self.state.setStockItem(item.key, e.target.value);
            self.renderPlanStateBanner();
            self.updateWorkflowBar();
            self.renderWorkflowStrip();
          });
        }
      });

      // Botón Añadir Exclusión
      const btnAddExclusion = document.getElementById('btn-add-exclusion');
      if (btnAddExclusion) {
        btnAddExclusion.addEventListener('click', () => {
          const typeEl = document.getElementById('exclusion-type');
          const reasonEl = document.getElementById('exclusion-reason');
          let val = '';
          if (typeEl && typeEl.value === 'PRODUCT') {
            const el = document.getElementById('exclusion-product-val');
            val = el ? el.value : '';
          } else if (typeEl && typeEl.value === 'PLATFORM') {
            const el = document.getElementById('exclusion-platform-val');
            val = el ? el.value : '';
          } else {
            const el = document.getElementById('exclusion-line-val');
            val = el ? el.value : '';
          }

          if (typeEl && val) {
            const added = self.state.addExclusion({
              type: typeEl.value,
              value: val,
              reason: reasonEl ? reasonEl.value : ''
            });
            if (added) {
              const lineEl = document.getElementById('exclusion-line-val');
              if (lineEl) lineEl.value = '';
              if (reasonEl) reasonEl.value = '';
              self.renderExclusionsList();
            }
          }
        });
      }

      // Cambio de tipo de exclusión para alternar select / input
      const exclTypeSelect = document.getElementById('exclusion-type');
      if (exclTypeSelect) {
        exclTypeSelect.addEventListener('change', e => {
          const prodBox = document.getElementById('box-excl-product');
          const platBox = document.getElementById('box-excl-platform');
          const lineBox = document.getElementById('box-excl-line');
          if (prodBox && platBox && lineBox) {
            prodBox.classList.add('hidden');
            platBox.classList.add('hidden');
            lineBox.classList.add('hidden');
            if (e.target.value === 'PRODUCT') prodBox.classList.remove('hidden');
            else if (e.target.value === 'PLATFORM') platBox.classList.remove('hidden');
            else lineBox.classList.remove('hidden');
          }
        });
      }

      // Botón Añadir Lock
      const btnAddLock = document.getElementById('btn-add-lock');
      if (btnAddLock) {
        btnAddLock.addEventListener('click', () => {
          const platEl = document.getElementById('lock-platform');
          const prodEl = document.getElementById('lock-product');
          const typeEl = document.getElementById('lock-type');
          const qtyEl = document.getElementById('lock-qty');

          if (platEl && prodEl && typeEl) {
            const added = self.state.addLock({
              platform: platEl.value,
              productId: prodEl.value,
              type: typeEl.value,
              quantity: qtyEl ? qtyEl.value : 0
            });
            if (added) {
              if (qtyEl) qtyEl.value = '';
              self.renderLocksList();
            }
          }
        });
      }

      // Select de tipo de lock (mostrar/ocultar input de cantidad)
      const lockTypeSelect = document.getElementById('lock-type');
      const lockQtyContainer = document.getElementById('lock-qty-container');
      if (lockTypeSelect && lockQtyContainer) {
        lockTypeSelect.addEventListener('change', e => {
          if (e.target.value === 'FIXED') {
            lockQtyContainer.classList.remove('hidden');
          } else {
            lockQtyContainer.classList.add('hidden');
          }
        });
      }

      // Botones de acción directa de Locks (Fase 13.1)
      const btnLockPera = document.getElementById('btn-lock-pera');
      if (btnLockPera) {
        btnLockPera.addEventListener('click', () => {
          self.createFullLock('PERA_RAMA', null, 'PERA COMPLETA');
        });
      }

      const btnLockCocktailConsabor = document.getElementById('btn-lock-cocktail-consabor');
      if (btnLockCocktailConsabor) {
        btnLockCocktailConsabor.addEventListener('click', () => {
          self.createFullLock('COCKTAIL_ROMANTICO', 'CONSABOR', 'COCKTAIL CONSABOR');
        });
      }

      const btnLockCocktailSp = document.getElementById('btn-lock-cocktail-sp');
      if (btnLockCocktailSp) {
        btnLockCocktailSp.addEventListener('click', () => {
          self.createFullLock('COCKTAIL_ROMANTICO', 'SAO_PAULO', 'COCKTAIL SP');
        });
      }

      const btnLockCocktailSun = document.getElementById('btn-lock-cocktail-sun');
      if (btnLockCocktailSun) {
        btnLockCocktailSun.addEventListener('click', () => {
          self.createFullLock('COCKTAIL_ROMANTICO', 'SUNSTREAM', 'COCKTAIL SUN');
        });
      }

      const btnLockCherry = document.getElementById('btn-lock-cherry');
      if (btnLockCherry) {
        btnLockCherry.addEventListener('click', () => {
          self.createFullLock('CHERRY_RAMA', null, 'CHERRY COMPLETO');
        });
      }

      // Bloqueo parcial fijando cantidad (Fase 13.1)
      const btnAddFixedLock = document.getElementById('btn-add-fixed-lock');
      if (btnAddFixedLock) {
        btnAddFixedLock.addEventListener('click', () => {
          const prodEl = document.getElementById('lock-fixed-product');
          const qtyEl = document.getElementById('lock-qty');
          if (prodEl && qtyEl) {
            const q = Number(qtyEl.value);
            if (q > 0) {
              self.addFixedLock(prodEl.value, q);
              qtyEl.value = '';
            }
          }
        });
      }

      // Botón Principal: "GENERAR PLAN DE CARGA" / "RECALCULAR PLAN"
      const btnGenerate = document.getElementById('btn-generate-plan');
      if (btnGenerate) {
        btnGenerate.addEventListener('click', () => {
          self.handleGeneratePlan();
        });
      }

      // Botón de Recálculo en Banner de Desactualización
      const btnRecalcBanner = document.getElementById('btn-recalculate-banner');
      if (btnRecalcBanner) {
        btnRecalcBanner.addEventListener('click', () => {
          self.handleGeneratePlan();
        });
      }

      // Botón Añadir Override de Palet
      const btnAddPalletOverride = document.getElementById('btn-add-pallet-override');
      if (btnAddPalletOverride) {
        btnAddPalletOverride.addEventListener('click', () => {
          const platEl = document.getElementById('override-pallet-platform');
          const prodEl = document.getElementById('override-pallet-product');
          const typeEl = document.getElementById('override-pallet-type');
          if (platEl && prodEl && typeEl) {
            self.state.setPalletOverride(platEl.value, prodEl.value, typeEl.value);
            self.renderPalletOverridesList();
          }
        });
      }

      // Botones de Acciones (WhatsApp, PDF, Impresión)
      const btnWhatsApp = document.getElementById('btn-export-whatsapp');
      if (btnWhatsApp) {
        btnWhatsApp.addEventListener('click', () => {
          self.handleCopyWhatsApp();
        });
      }

      const btnPdf = document.getElementById('btn-export-pdf');
      if (btnPdf) {
        btnPdf.addEventListener('click', () => {
          self.handleGeneratePDF();
        });
      }

      const btnPrint = document.getElementById('btn-print-plan');
      if (btnPrint) {
        btnPrint.addEventListener('click', () => {
          self.handlePrint();
        });
      }

      const btnToggleForecast = document.getElementById('btn-toggle-forecast-input');
      if (btnToggleForecast) {
        btnToggleForecast.addEventListener('click', () => self.toggleForecastInput());
      }

      // Previsión Consolidada y Pedidos Anticipados / División
      const btnOpenAddOrder = document.getElementById('btn-open-add-order');
      if (btnOpenAddOrder) {
        btnOpenAddOrder.addEventListener('click', () => self.openAddOrderModal());
      }

      const btnCloseAddOrder = document.getElementById('btn-close-add-order');
      if (btnCloseAddOrder) {
        btnCloseAddOrder.addEventListener('click', () => self.closeAddOrderModal());
      }

      const btnSaveOrder = document.getElementById('btn-save-order');
      if (btnSaveOrder) {
        btnSaveOrder.addEventListener('click', () => self.saveNewOrder());
      }

      const btnCloseSplitOrder = document.getElementById('btn-close-split-order');
      if (btnCloseSplitOrder) {
        btnCloseSplitOrder.addEventListener('click', () => self.closeSplitOrderModal());
      }

      const btnCancelSplitOrder = document.getElementById('btn-cancel-split-order');
      if (btnCancelSplitOrder) {
        btnCancelSplitOrder.addEventListener('click', () => self.closeSplitOrderModal());
      }

      const btnAddSplitRow = document.getElementById('btn-add-split-row');
      if (btnAddSplitRow) {
        btnAddSplitRow.addEventListener('click', () => self.addSplitRow());
      }

      const btnConfirmSplit = document.getElementById('btn-confirm-split');
      if (btnConfirmSplit) {
        btnConfirmSplit.addEventListener('click', () => self.confirmSplitOrder());
      }

      const splitRowsContainer = document.getElementById('split-rows-container');
      if (splitRowsContainer) {
        splitRowsContainer.addEventListener('input', () => self.updateSplitSumFeedback());
        splitRowsContainer.addEventListener('click', e => {
          const removeBtn = e.target.closest('.btn-remove-split-row');
          if (removeBtn) {
            const rows = splitRowsContainer.querySelectorAll('.split-row');
            if (rows.length > 2) {
              const row = removeBtn.closest('.split-row');
              if (row) {
                row.remove();
                self.updateSplitSumFeedback();
              }
            } else {
              self.showToast('Se requieren al menos 2 sub-pedidos.', 'warning');
            }
          }
        });
      }

      const forecastContainer = document.getElementById('consolidated-forecast-container');
      if (forecastContainer) {
        forecastContainer.addEventListener('click', e => {
          // 1. Toggle de plataforma
          const toggleBtn = e.target.closest('[data-toggle-platform]');
          if (toggleBtn) {
            const plat = toggleBtn.getAttribute('data-toggle-platform');
            self.togglePlatformDetail(plat);
            return;
          }

          // 2. Dividir pedido
          const splitBtn = e.target.closest('[data-split-order-id]');
          if (splitBtn) {
            const orderId = splitBtn.getAttribute('data-split-order-id');
            self.openSplitOrderModal(orderId);
            return;
          }

          // 3. Deshacer división
          const unsplitBtn = e.target.closest('[data-unsplit-order-id]');
          if (unsplitBtn) {
            const orderId = unsplitBtn.getAttribute('data-unsplit-order-id');
            self.state.unsplitOrder(orderId);
            self.renderConsolidatedForecast();
            self.updateWorkflowBar();
            if (self.state.planningResult) {
              self.handleGeneratePlan();
            }
            self.showToast('✓ División revertida.');
            return;
          }

          // 4. Eliminar pedido
          const removeBtn = e.target.closest('[data-remove-order-id]');
          if (removeBtn) {
            const orderId = removeBtn.getAttribute('data-remove-order-id');
            self.state.removeOrder(orderId);
            self.renderConsolidatedForecast();
            self.updateWorkflowBar();
            if (self.state.planningResult) {
              self.handleGeneratePlan();
            }
            self.showToast('✓ Pedido eliminado.');
            return;
          }

          // 5. Selector de Fecha de Entrega
          const dateBtn = e.target.closest('[data-delivery-date]');
          if (dateBtn) {
            const chosenDate = dateBtn.getAttribute('data-delivery-date');
            self.state.setSelectedDeliveryDate(chosenDate);
            self.renderConsolidatedForecast();
            if (self.state.planningResult) {
              self.handleGeneratePlan();
            }
            return;
          }
        });
      }

      // Botones de toggle de tema (DARK ↔ LIGHT)
      const boundThemeBtns = new Set();
      const bindThemeClick = (btn) => {
        if (!btn || boundThemeBtns.has(btn)) return;
        boundThemeBtns.add(btn);
        btn.addEventListener('click', () => {
          self.toggleTheme();
        });
      };
      bindThemeClick(document.getElementById('btn-theme-toggle'));
      bindThemeClick(document.getElementById('btn-theme-toggle-desktop'));
      if (document.querySelectorAll) {
        try {
          const classBtns = document.querySelectorAll('.btn-theme-toggle');
          if (classBtns && classBtns.forEach) {
            classBtns.forEach(bindThemeClick);
          }
        } catch (_) {}
      }

      // Inicializar tema desde localStorage
      this.initTheme();

      // FASE 18 · MOBILE SHELL: navegación inferior, steppers de stock,
      // detalle de plataforma y acciones de la vista "MÁS".
      this.bindMobileShell();

      // Inicializar dropdowns, listas, barra de acciones y botones de estado
      this.populateDropdowns(null);
      this.renderPalletOverridesList();
      this.renderActionsToolbar(null);
      this.renderPlanStateBanner();
      this.renderConsolidatedForecast();
    }

    // =======================================================================
    // 3C. MOBILE SHELL — Enlace de eventos táctiles (FASE 18)
    // =======================================================================
    /**
     * Conecta la navegación inferior, los steppers de stock, el detalle de
     * plataforma y los accesos de la vista "MÁS".
     *
     * Todos los manejadores delegan en los métodos ya existentes
     * (handleGeneratePlan, handleGeneratePDF, handleCopyWhatsApp, handlePrint,
     * state.setStockItem, ...): el shell móvil no introduce lógica nueva.
     */
    bindMobileShell() {
      if (typeof document === 'undefined') return;
      const self = this;

      // --- 1. Navegación inferior (router de vistas) ----------------------
      document.querySelectorAll('#mobile-tabbar .mt-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          self.setView(tab.getAttribute('data-nav-view'));
        });
      });

      // --- 2. Steppers de stock (§12) -------------------------------------
      // Sincronizan el input real y, con él, el AppState existente.
      document.querySelectorAll('.stock-step').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-stock-target');
          const delta = Number(btn.getAttribute('data-stock-delta')) || 0;
          const input = targetId ? document.getElementById(targetId) : null;
          if (!input) return;

          const rawMax = btn.getAttribute('data-stock-max');
          const max = rawMax === null ? null : Number(rawMax);
          const current = Math.max(0, Math.floor(Number(input.value) || 0));
          let next = current + delta;
          if (next < 0) next = 0;
          if (max !== null && !isNaN(max) && next > max) next = max;

          if (next === current) return;
          input.value = String(next);

          // Se notifica el cambio reutilizando el MISMO evento `input` que ya
          // escucha bindDOM(): el stepper táctil no abre ninguna vía de estado
          // nueva.
          //
          // FASE 18.4 · BUG REAL CORREGIDO. Antes se despachaba un OBJETO PLANO
          // ({ type:'input', ... }). En un navegador real,
          // EventTarget.dispatchEvent() exige una instancia de Event y lanza
          // TypeError ("parameter 1 is not of type 'Event'"). La excepción
          // abortaba este handler justo después de escribir input.value: el
          // número cambiaba en pantalla pero el AppState NUNCA se enteraba, así
          // que el plan se generaba con el stock anterior. El doble mini-dom
          // acepta objetos planos, por eso los tests no lo veían.
          //
          // Con un Event real el navegador fija `target` en el propio input y el
          // listener existente (e.target.value) funciona igual que al teclear.
          // La detección exige un EventTarget REAL: en Node/tests existe el
          // constructor global Event pero el DOM es un doble, así que se usa el
          // objeto plano solo como último recurso.
          var dispatched = false;
          var realDOM = false;
          try {
            realDOM = typeof Event === 'function' &&
              typeof window !== 'undefined' &&
              typeof window.EventTarget === 'function' &&
              input instanceof window.EventTarget;
          } catch (err) { realDOM = false; }

          if (realDOM) {
            try {
              input.dispatchEvent(new Event('input', { bubbles: true }));
              dispatched = true;
            } catch (err) { dispatched = false; }
          }
          if (!dispatched && input.dispatchEvent) {
            input.dispatchEvent({ type: 'input', bubbles: true, target: input, currentTarget: input });
          }
        });
      });

      // --- 3. Detalle de plataforma (§9) ----------------------------------
      const cardsContainer = document.getElementById('platform-plan-cards-container');
      if (cardsContainer) {
        cardsContainer.addEventListener('click', e => {
          const btn = e.target && e.target.closest
            ? e.target.closest('.btn-platform-detail')
            : null;
          if (!btn) return;
          const platform = btn.getAttribute('data-platform');
          self.openPlatformDetail(platform);
        });
      }

      const closeBtn = document.getElementById('pdm-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => self.closePlatformDetail());
      }

      // Cierre por Escape (teclado físico / accesibilidad)
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') self.closePlatformDetail();
      });

      // --- 4. Vista "MÁS": acciones (§15) y accesos directos --------------
      const wire = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
      };

      wire('btn-more-export-pdf', () => self.handleGeneratePDF());
      wire('btn-more-export-whatsapp', () => self.handleCopyWhatsApp());
      wire('btn-more-print', () => self.handlePrint());
      wire('btn-more-locks', () => self.setView('locks'));
      // FASE 18.6 · §4: el PASO 3 del flujo entra en los MISMOS controles de
      // bloqueo. Es una entrada más al mismo setView('locks'): ni lógica, ni
      // estado, ni handler nuevos.
      wire('btn-workflow-locks', () => self.setView('locks'));
      wire('btn-more-options', () => self.setView('options'));

      // FASE MOBILE V1: Cableado del stepper principal (#mobile-workflow-bar)
      document.querySelectorAll('#mobile-workflow-bar .mwb-step').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-wf-target');
          if (target) self.setView(target);
        });
      });

      // FASE MOBILE V1: Botones de avance y navegación guiada
      wire('btn-next-to-stock', () => self.setView('stock'));
      wire('btn-locks-to-stock', () => self.setView('stock'));

      // FASE MOBILE V1: Acciones directas de salida en vista Plan
      wire('btn-plan-output-pdf', () => self.handleGeneratePDF());
      wire('btn-plan-output-whatsapp', () => self.handleCopyWhatsApp());
      wire('btn-plan-output-print', () => self.handlePrint());

      // --- 5. Estado inicial del shell móvil ------------------------------
      this.setView(this.currentView || 'plan');
      this.renderMobileKpis(this.state.planningResult);
      this.syncMobileMoreContext(this.state.planningResult);
      this.updateWorkflowBar();
    }
    fillStock(stockObj) {
      if (!stockObj) return;
      for (const [k, v] of Object.entries(stockObj)) {
        this.state.setStockItem(k, v);
      }
      if (typeof document !== 'undefined') {
        const elPera = document.getElementById('stock-pera');
        const elSP = document.getElementById('stock-cocktail-sp');
        const elSUN = document.getElementById('stock-cocktail-sun');
        const elCherry = document.getElementById('stock-cherry-sun');
        const elConsabor = document.getElementById('stock-cocktail-consabor');
        if (elPera && stockObj['PERA_RAMA'] !== undefined) elPera.value = stockObj['PERA_RAMA'];
        if (elConsabor && stockObj['COCKTAIL_ROMANTICO::CONSABOR'] !== undefined) elConsabor.value = stockObj['COCKTAIL_ROMANTICO::CONSABOR'];
        if (elSP && stockObj['COCKTAIL_ROMANTICO::SAO_PAULO'] !== undefined) elSP.value = stockObj['COCKTAIL_ROMANTICO::SAO_PAULO'];
        if (elSUN && stockObj['COCKTAIL_ROMANTICO::SUNSTREAM'] !== undefined) elSUN.value = stockObj['COCKTAIL_ROMANTICO::SUNSTREAM'];
        if (elCherry && stockObj['CHERRY_RAMA::SUNSTREAM'] !== undefined) elCherry.value = stockObj['CHERRY_RAMA::SUNSTREAM'];
        this.renderPlanStateBanner();
        this.updateWorkflowBar();
        this.renderWorkflowStrip();
      }
    }

    handleAnalyze() {
      const tsvInput = document.getElementById('tsv-input');
      const rawText = tsvInput ? tsvInput.value : this.state.rawText;
      const analysis = this.analyzeForecast(rawText);
      this.renderForecastAnalysis(analysis);
      this.populateDropdowns(analysis);
      this.updateWorkflowBar();
      this.renderWorkflowStrip();
    }

    handleGeneratePlan() {
      if (this.isGenerating) return;
      this.isGenerating = true;

      const btn = (typeof document !== 'undefined') ? document.getElementById('btn-generate-plan') : null;
      let originalHtml = '';

      if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        originalHtml = btn.innerHTML;
        btn.innerHTML = `<span>RECALCULANDO...</span>`;
      }

      const execute = () => {
        try {
          // Sincronizar inputs numéricos de stock antes de generar
          const elPera = document.getElementById('stock-pera');
          const elSP = document.getElementById('stock-cocktail-sp');
          const elSUN = document.getElementById('stock-cocktail-sun');
          const elCherry = document.getElementById('stock-cherry-sun');
          const elConsabor = document.getElementById('stock-cocktail-consabor');
          if (elPera) this.state.setStockItem('PERA_RAMA', elPera.value);
          if (elConsabor) this.state.setStockItem('COCKTAIL_ROMANTICO::CONSABOR', elConsabor.value);
          if (elSP) this.state.setStockItem('COCKTAIL_ROMANTICO::SAO_PAULO', elSP.value);
          if (elSUN) this.state.setStockItem('COCKTAIL_ROMANTICO::SUNSTREAM', elSUN.value);
          if (elCherry) this.state.setStockItem('CHERRY_RAMA::SUNSTREAM', elCherry.value);

          const tsvInput = document.getElementById('tsv-input');
          if (tsvInput) this.state.setRawText(tsvInput.value);

          const result = this.generatePlan();
          this.renderAll(result);
          return result;
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
            this.renderPlanButtonState();
          }
          this.isGenerating = false;
        }
      };

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        setTimeout(execute, 150);
      } else {
        return execute();
      }
    }

    renderAll(result) {
      if (typeof document === 'undefined' || !result) return;

      this.renderHeader(result, this.state.planStatus);
      this.renderPrintHeaderSummary(result);
      this.renderPlanStateBanner();
      this.renderComparisonDetails();
      this.renderActionsToolbar(result);
      this.renderExecutiveSummary(result);
      this.renderPlatformPlan(result);
      this.renderPlatformTable(result);
      this.renderPalletization(result);
      this.renderWarningsAndErrors(result);

      // FASE 18 · MOBILE SHELL: renders de presentación móvil (aditivos).
      // No alteran ninguno de los renders del shell de escritorio.
      this.renderMobileKpis(result);
      this.syncMobileMoreContext(result);
    }

    renderPlanButtonState() {
      const btn = (typeof document !== 'undefined') ? document.getElementById('btn-generate-plan') : null;
      if (!btn) return;
      if (this.state.planningResult) {
        btn.innerHTML = `<span>⚡ RECALCULAR PLAN DE CARGA DE ESTA ENTREGA →</span>`;
      } else {
        btn.innerHTML = `<span>⚡ CALCULAR PLAN DE CARGA DE ESTA ENTREGA →</span>`;
      }
    }

    renderPlanStateBanner() {
      if (typeof document === 'undefined') return;

      const banner = document.getElementById('plan-desactualizado-banner');
      const badgeSync = document.getElementById('badge-plan-sync');
      const planActionText = document.getElementById('plan-action-state-text');

      let totalStockCalculated = 0;
      if (this.state.calculatedStock) {
        totalStockCalculated = Object.values(this.state.calculatedStock).reduce((acc, v) => acc + (Number(v) || 0), 0);
      }

      if (this.state.planState === 'PLAN_DESACTUALIZADO') {
        if (banner) banner.classList.remove('hidden');
        if (planActionText) {
          planActionText.textContent = 'Existencias modificadas · Plan desactualizado';
          planActionText.className = 'font-mono text-xs font-semibold text-amber-400';
        }
        if (badgeSync) {
          badgeSync.classList.remove('hidden');
          badgeSync.textContent = '⚠ PLAN DESACTUALIZADO';
          badgeSync.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-950/40 text-amber-300 border border-amber-800/60 animate-pulse';
        }
      } else if (this.state.planState === 'PLAN_ACTUALIZADO') {
        if (banner) banner.classList.add('hidden');
        if (planActionText) {
          planActionText.textContent = 'Plan actualizado y conforme';
          planActionText.className = 'font-mono text-xs font-semibold text-emerald-400';
        }
        if (badgeSync) {
          badgeSync.classList.remove('hidden');
          const missing = (this.state.planningResult && this.state.planningResult.allocations)
            ? this.state.planningResult.allocations.reduce((s, a) => s + (a.missingQuantity || 0), 0)
            : 0;
          if (missing > 0) {
            badgeSync.textContent = `⚠ ${missing} CAJAS PENDIENTES`;
            badgeSync.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-950/40 text-amber-300 border border-amber-800/60';
          } else {
            badgeSync.textContent = '● PLAN ACTUALIZADO';
            badgeSync.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-800/60';
          }
        }
      } else {
        if (banner) banner.classList.add('hidden');
        if (badgeSync) badgeSync.classList.add('hidden');
        if (planActionText) {
          planActionText.textContent = 'Listo para calcular';
          planActionText.className = 'font-mono text-xs font-semibold text-[#8A8F98]';
        }
      }

      this.renderPlanButtonState();
    }

    renderComparisonDetails() {
      const compSection = document.getElementById('plan-comparison-section');
      const compContent = document.getElementById('plan-comparison-content');
      if (!compSection || !compContent) return;

      if (!this.state.previousResult || !this.state.planningResult) {
        compSection.classList.add('hidden');
        return;
      }

      const comp = comparePlanningResults(this.state.previousResult, this.state.planningResult);
      if (!comp.hasComparison) {
        compSection.classList.add('hidden');
        return;
      }

      compSection.classList.remove('hidden');

      const d = comp.deltas;
      const fmtDelta = (val, suffix = '') => {
        if (val > 0) return `<span class="text-emerald-400 font-bold font-mono">+${val}${suffix}</span>`;
        if (val < 0) return `<span class="text-rose-400 font-bold font-mono">${val}${suffix}</span>`;
        return `<span class="text-[#5E6470] font-mono">0${suffix}</span>`;
      };

      let html = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center p-2.5 rounded-lg bg-[#121316] border border-[#22252A]">
          <div>
            <div class="text-[10px] text-[#8A8F98] uppercase font-medium">Asignadas</div>
            <div class="text-xs font-bold text-[#EDEDEF]">${fmtDelta(d.totalAllocatedDelta, ' cjs')}</div>
          </div>
          <div>
            <div class="text-[10px] text-[#8A8F98] uppercase font-medium">Pendientes</div>
            <div class="text-xs font-bold text-[#EDEDEF]">${fmtDelta(d.totalMissingDelta, ' cjs')}</div>
          </div>
          <div>
            <div class="text-[10px] text-[#8A8F98] uppercase font-medium">Stock Restante</div>
            <div class="text-xs font-bold text-[#EDEDEF]">${fmtDelta(d.totalRemainingStockDelta, ' cjs')}</div>
          </div>
          <div>
            <div class="text-[10px] text-[#8A8F98] uppercase font-medium">Palets</div>
            <div class="text-xs font-bold text-[#EDEDEF]">${fmtDelta(d.totalPalletsDelta, ' pal')}</div>
          </div>
        </div>
      `;

      if (comp.changesSummary.length > 0) {
        html += `
          <div class="mt-2 space-y-1">
            <span class="text-[10px] font-bold text-[#8A8F98] uppercase tracking-wider block">Detalle de Variaciones:</span>
            <ul class="space-y-1 text-[11px] font-mono text-[#EDEDEF] bg-[#121316] p-2 rounded border border-[#22252A] max-h-36 overflow-y-auto">
              ${comp.changesSummary.map(c => `<li class="flex items-center gap-1.5"><span class="text-indigo-400">•</span> ${c}</li>`).join('')}
            </ul>
          </div>
        `;
      } else {
        html += `<p class="text-xs text-[#5E6470] italic">No hay cambios numéricos entre la planificación anterior y la actual.</p>`;
      }

      compContent.innerHTML = html;
    }

    renderHeader(result, status) {
      const badgeDate = document.getElementById('badge-delivery-date');
      const badgeDateDesktop = document.getElementById('badge-delivery-date-desktop');
      const badgeStatus = document.getElementById('badge-plan-status');

      const rawDate = result.deliveryDate || (result.detectedDates && result.detectedDates[0]) || 'Sin fecha';
      const formattedDate = rawDate !== 'Sin fecha' ? formatDateWithDay(rawDate) : 'Sin fecha';
      if (badgeDate) {
        badgeDate.textContent = rawDate;
      }
      if (badgeDateDesktop) {
        badgeDateDesktop.textContent = formattedDate;
      }

      if (badgeStatus) {
        badgeStatus.textContent = status;
        badgeStatus.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-medium tracking-wide transition-colors ';

        if (status === 'PLANIFICACIÓN CORRECTA') {
          badgeStatus.className += 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60';
        } else if (status === 'PLANIFICACIÓN CON INCIDENCIAS') {
          badgeStatus.className += 'bg-amber-950/40 text-amber-300 border border-amber-800/60';
        } else {
          badgeStatus.className += 'bg-rose-950/40 text-rose-400 border border-rose-800/60';
        }
      }

      const printDateEl = document.getElementById('print-delivery-date');
      const printTimeEl = document.getElementById('print-emission-time');
      if (printDateEl) {
        printDateEl.textContent = result.deliveryDate || (result.detectedDates && result.detectedDates[0]) || '--/--/----';
      }
      if (printTimeEl && !printTimeEl.textContent) {
        printTimeEl.textContent = new Date().toLocaleString('es-ES');
      }

      // Trazabilidad horaria discreta (Fase 10.1)
      const calcTimeEl = document.getElementById('plan-calculated-time');
      if (calcTimeEl) {
        if (this.state.lastCalculatedAt) {
          const d = this.state.lastCalculatedAt;
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          calcTimeEl.textContent = `Plan calculado ${hh}:${mm}`;
          calcTimeEl.classList.remove('hidden');
        } else {
          calcTimeEl.classList.add('hidden');
        }
      }

      this.renderPrintHeaderSummary(result);
    }

    renderPrintHeaderSummary(result) {
      if (typeof document === 'undefined') return;
      const listEl = document.getElementById('print-articles-totals-list');
      const grandTotalEl = document.getElementById('print-grand-total-boxes');
      const printDateEl = document.getElementById('print-delivery-date');

      if (printDateEl && result) {
        const rawDate = result.deliveryDate || (result.detectedDates && result.detectedDates[0]) || '';
        const dayOfWeek = rawDate ? getDayOfWeekName(rawDate) : '';
        printDateEl.textContent = dayOfWeek ? `${dayOfWeek} ${rawDate}` : (rawDate || '--/--/----');
      }

      if (!listEl && !grandTotalEl) return;

      const summary = computeServedTotalsByArticle(result);

      if (listEl) {
        if (summary.totalsList.length === 0) {
          listEl.innerHTML = '<span class="text-slate-500 font-normal">Sin asignaciones</span>';
        } else {
          listEl.innerHTML = summary.totalsList.map(item => `
            <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-900 tracking-tight">
              ${item.formattedText}
            </span>
          `).join('');
        }
      }

      if (grandTotalEl) {
        grandTotalEl.textContent = summary.grandTotal;
      }
    }

    renderForecastAnalysis(analysis) {
      const container = document.getElementById('forecast-analysis-card');
      if (!container) return;

      container.classList.remove('hidden');

      const elTotal = document.getElementById('ana-total-lines');
      const elValid = document.getElementById('ana-valid-lines');
      const elErrors = document.getElementById('ana-error-lines');
      const elDate = document.getElementById('ana-detected-date');
      const elTotalReq = document.getElementById('ana-total-requested');
      const elDemands = document.getElementById('ana-demands-breakdown');
      const elPlatDemands = document.getElementById('ana-platform-demands');
      const elCorruptBox = document.getElementById('ana-corrupt-lines-box');
      const elCorruptList = document.getElementById('ana-corrupt-lines-list');

      if (elTotal) elTotal.textContent = analysis.totalLines;
      if (elValid) elValid.textContent = analysis.validLinesCount;
      if (elErrors) elErrors.textContent = analysis.errorLinesCount;
      if (elTotalReq) elTotalReq.textContent = `${analysis.totalRequested} cjs`;
      if (elDate) {
        if (analysis.detectedDates && analysis.detectedDates.length > 1) {
          elDate.textContent = analysis.detectedDates.join(', ');
        } else {
          elDate.textContent = analysis.detectedDate || 'No detectada';
        }
      }

      // Demanda agregada por producto
      if (elDemands) {
        const entries = Object.entries(analysis.demandsByProduct || {});
        if (entries.length === 0) {
          elDemands.innerHTML = '<span class="text-slate-400 italic">Sin demanda válida</span>';
        } else {
          elDemands.innerHTML = entries.map(([p, q]) => `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#16181B] text-[#8A8F98] text-xs font-mono font-medium border border-[#22252A]">
              <span>${p.replace(/_RAMA|_ROMANTICO/g, '')}:</span>
              <span class="font-bold text-[#EDEDEF]">${q} cjs</span>
            </span>
          `).join('');
        }
      }

      // Desglose agregado por plataforma y producto
      if (elPlatDemands) {
        const platMap = analysis.demandsByPlatformAndProduct || {};
        const platforms = analysis.platformsFound || [];
        if (platforms.length === 0) {
          elPlatDemands.innerHTML = '<span class="text-[#5E6470] italic text-xs">Sin plataformas detectadas</span>';
        } else {
          elPlatDemands.innerHTML = platforms.map(plat => {
            const prodParts = [];
            let totalPlat = 0;
            for (const prodId of Object.keys(platMap)) {
              const qty = (platMap[prodId] && platMap[prodId][plat]) || 0;
              if (qty > 0) {
                const shortProd = prodId.replace('TOMATE_', '').replace(/_RAMA|_ROMANTICO/g, '');
                prodParts.push(`${shortProd}: ${qty}`);
                totalPlat += qty;
              }
            }
            return `
              <div class="px-2.5 py-1 rounded bg-[#16181B] border border-[#22252A] text-xs flex items-center justify-between">
                <span class="font-bold text-[#EDEDEF]">${plat}</span>
                <span class="text-[11px] text-[#8A8F98] font-mono">${prodParts.join(' | ')} <strong class="text-[#EDEDEF] font-bold">(${totalPlat} cjs)</strong></span>
              </div>
            `;
          }).join('');
        }
      }

      // Líneas corruptas o con incidencias (sin bloquear válidas)
      if (elCorruptBox && elCorruptList) {
        if (analysis.errorLinesCount > 0 && analysis.errors && analysis.errors.length > 0) {
          elCorruptBox.classList.remove('hidden');
          elCorruptList.innerHTML = analysis.errors.map(err => `
            <div class="text-xs p-2 rounded bg-rose-950/30 border border-rose-800/60 text-rose-300 space-y-0.5">
              <div class="font-semibold"><span class="font-mono bg-rose-900/60 text-rose-200 px-1 py-0.2 rounded text-[10px]">Línea ${escapeHtml(err.lineNumber || '?')}</span> ${escapeHtml(err.message)}</div>
              ${err.rawText ? `<div class="font-mono text-[10px] text-[#8A8F98] truncate mt-0.5 bg-[#121316] p-1 rounded border border-[#22252A]">"${escapeHtml(err.rawText)}"</div>` : ''}
            </div>
          `).join('');
        } else {
          elCorruptBox.classList.add('hidden');
          elCorruptList.innerHTML = '';
        }
      }

      // Progressive disclosure: Colapsar entrada de previsión y mostrar barra resumen si hay líneas válidas
      const summaryBar = document.getElementById('forecast-summary-bar');
      const inputWrapper = document.getElementById('forecast-input-wrapper');
      const summaryText = document.getElementById('forecast-summary-text');
      const toggleBtn = document.getElementById('btn-toggle-forecast-input');

      if (summaryBar && inputWrapper) {
        if (analysis && analysis.validLinesCount > 0) {
          summaryBar.classList.remove('hidden');
          inputWrapper.classList.add('hidden');
          if (summaryText) {
            summaryText.textContent = `${analysis.validLinesCount} líneas · ${analysis.totalRequested} cjs`;
          }
          if (toggleBtn) {
            toggleBtn.textContent = 'Modificar texto de previsión ▾';
          }
        }
      }
    }

    toggleForecastInput() {
      if (typeof document === 'undefined') return;
      const inputWrapper = document.getElementById('forecast-input-wrapper');
      const toggleBtn = document.getElementById('btn-toggle-forecast-input');
      if (!inputWrapper) return;

      const isHidden = inputWrapper.classList.contains('hidden');
      if (isHidden) {
        inputWrapper.classList.remove('hidden');
        if (toggleBtn) toggleBtn.textContent = 'Ocultar texto de previsión ▴';
      } else {
        inputWrapper.classList.add('hidden');
        if (toggleBtn) toggleBtn.textContent = 'Modificar texto de previsión ▾';
      }
    }

    renderConsolidatedForecast() {
      if (typeof document === 'undefined') return;
      const container = document.getElementById('consolidated-forecast-container');
      if (!container) return;

      const badgeCount = document.getElementById('consolidated-count-badge');
      const dateSelector = document.getElementById('delivery-date-selector-container');
      const platformsList = document.getElementById('consolidated-platforms-list');
      const tableBody = document.getElementById('consolidated-orders-table-body');

      const allOrders = this.state.orders || [];
      const activeOrders = allOrders.filter(o => o.active);

      if (badgeCount) {
        badgeCount.textContent = `${activeOrders.length} pedido${activeOrders.length !== 1 ? 's' : ''} activo${activeOrders.length !== 1 ? 's' : ''}`;
      }

      // Sincronizar fecha en cabecera desktop y móvil
      const activeDateText = this.state.selectedDeliveryDate
        ? formatDateWithDay(this.state.selectedDeliveryDate)
        : '--/--/----';
      const badgeDate = document.getElementById('badge-delivery-date');
      const badgeDateDesktop = document.getElementById('badge-delivery-date-desktop');
      if (badgeDate) badgeDate.textContent = this.state.selectedDeliveryDate || '--/--/----';
      if (badgeDateDesktop) badgeDateDesktop.textContent = activeDateText;

      // 1. Selector de Fecha de Entrega
      if (dateSelector) {
        const availableDates = this.state.getAvailableDeliveryDates();
        if (availableDates.length === 0) {
          dateSelector.innerHTML = '<span class="text-xs text-muted italic">Sin fechas registradas</span>';
        } else {
          if (!this.state.selectedDeliveryDate && availableDates.length > 0) {
            this.state.selectedDeliveryDate = availableDates[0];
          }
          const selected = this.state.selectedDeliveryDate;
          const selectedDayName = getDayOfWeekName(selected);
          const otherDates = availableDates.filter(d => d !== selected);
          let contextNoticeHtml = '';
          if (otherDates.length > 0) {
            const otherDayNames = otherDates.map(d => getDayOfWeekName(d) || d).join(', ');
            contextNoticeHtml = `
              <div class="mt-2 pt-2 border-t border-app text-[11px] text-muted flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>Estás planificando la entrega del <strong class="text-primary font-semibold">${escapeHtml(selectedDayName ? selectedDayName.toUpperCase() : selected)}</strong>. La demanda de otras fechas (${escapeHtml(otherDayNames)}) se gestiona en su contexto.</span>
              </div>
            `;
          }

          dateSelector.innerHTML = `
            <div class="space-y-1.5">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-secondary">Contexto de Entrega:</span>
                <span class="text-[11px] font-mono text-muted">${availableDates.length} fecha${availableDates.length !== 1 ? 's' : ''} disponible${availableDates.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                ${availableDates.map(d => {
                  const dayName = getDayOfWeekName(d);
                  const isSel = d === selected;
                  const label = dayName ? `${dayName} ${d}` : d;
                  const countForDate = allOrders.filter(o => o.active && o.fechaEntrega === d).length;
                  const boxesForDate = allOrders.filter(o => o.active && o.fechaEntrega === d).reduce((s, o) => s + o.cajas, 0);
                  const activeClasses = isSel
                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/60 font-bold shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                    : 'bg-surface hover:bg-hover text-secondary hover:text-primary border border-app';
                  return `
                    <button
                      type="button"
                      data-delivery-date="${escapeHtml(d)}"
                      class="delivery-date-pill px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 cursor-pointer ${activeClasses}"
                    >
                      <span>📅 ${escapeHtml(label)}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-app font-mono font-bold">${boxesForDate} cjs (${countForDate})</span>
                      ${isSel ? '<span class="text-emerald-500 font-bold">✓</span>' : ''}
                    </button>
                  `;
                }).join('')}
              </div>
              ${contextNoticeHtml}
            </div>
          `;
        }
      }

      // 2. Filtrado de pedidos según fecha seleccionada
      const targetDate = this.state.selectedDeliveryDate;
      const filteredOrders = targetDate
        ? allOrders.filter(o => o.fechaEntrega === targetDate)
        : allOrders;

      const targetEl = platformsList || tableBody;
      if (!targetEl) return;

      if (filteredOrders.length === 0) {
        targetEl.innerHTML = `
          <div class="p-6 text-center text-xs text-muted italic bg-surface/50 rounded-xl border border-app">
            No hay pedidos en la previsión consolidada para la fecha seleccionada. Pega y analiza una previsión o añade pedidos anticipados.
          </div>
        `;
        return;
      }

      // 3. Agrupación Jerárquica por PLATAFORMA BASE
      const platformMap = new Map();
      for (const ord of filteredOrders) {
        const basePlat = getBasePlatform(ord, allOrders);
        if (!platformMap.has(basePlat)) {
          platformMap.set(basePlat, {
            platform: basePlat,
            allOrders: [],
            activeOrders: []
          });
        }
        const g = platformMap.get(basePlat);
        g.allOrders.push(ord);
        if (ord.active) {
          g.activeOrders.push(ord);
        }
      }

      // Ordenar plataformas: Canónicas primero, luego alfabéticamente
      const canonicalList = (DEFAULT_CATALOG.platforms && DEFAULT_CATALOG.platforms.canonical) ||
        ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA', 'MÁLAGA'];
      const sortedPlatforms = Array.from(platformMap.keys()).sort((a, b) => {
        const idxA = canonicalList.indexOf(a);
        const idxB = canonicalList.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

      // Renderizar tarjetas por plataforma
      const htmlCards = sortedPlatforms.map(platName => {
        const group = platformMap.get(platName);
        const totalBoxes = group.activeOrders.reduce((sum, o) => sum + o.cajas, 0);
        const isExpanded = this.isPlatformExpanded(platName);

        // Agrupar pedidos activos por Producto / Variedad
        const productMap = new Map();
        for (const o of group.activeOrders) {
          const pKey = `${o.productId}::${o.varietyId || ''}`;
          if (!productMap.has(pKey)) {
            const labels = getProductVarietyDisplay(o.productId, o.varietyId);
            productMap.set(pKey, {
              key: pKey,
              productId: o.productId,
              varietyId: o.varietyId,
              fullLabel: labels.fullLabel,
              pillLabel: labels.pillLabel,
              totalBoxes: 0,
              orders: []
            });
          }
          const pGroup = productMap.get(pKey);
          pGroup.totalBoxes += o.cajas;
          pGroup.orders.push(o);
        }

        // Resumen Nivel 1: "PERA 68 · COCKTAIL 50 · SUNSTREAM 20"
        const productPillsHtml = Array.from(productMap.values()).map(p => {
          return `<span class="inline-flex items-center gap-1">${escapeHtml(p.pillLabel)} <strong class="text-primary font-mono">${p.totalBoxes}</strong></span>`;
        }).join('<span class="text-muted mx-1.5">·</span>');

        // Cálculo del Balance Operativo: DEMANDA / SERVIDO / PENDIENTE
        const demanda = totalBoxes;
        let servido = 0;
        let pendiente = 0;
        let hasPlan = false;
        let serviceRateText = 'Plan pendiente de generar';
        let serviceRateClass = 'text-muted';

        const currentPlan = this.state.planningResult;
        if (currentPlan && Array.isArray(currentPlan.allocations) && this.state.planState !== 'NO_PLAN') {
          const planDate = currentPlan.selectedDeliveryDate || currentPlan.targetDeliveryDate || currentPlan.deliveryDate;
          if (!targetDate || !planDate || planDate === targetDate) {
            hasPlan = true;
            const platAllocations = currentPlan.allocations.filter(a => {
              const aBase = getBasePlatform({ platform: a.platform }, allOrders);
              return aBase === platName || String(a.platform).toUpperCase() === platName;
            });

            servido = platAllocations.reduce((sum, a) => sum + (Number(a.allocatedQuantity) || 0), 0);
            if (platAllocations.length > 0) {
              pendiente = Math.max(0, demanda - servido);
            } else {
              pendiente = demanda;
            }

            const rate = demanda > 0 ? ((servido / demanda) * 100).toFixed(1) : '100.0';
            serviceRateText = `${rate}% servido`;
            if (pendiente === 0 && servido > 0) {
              serviceRateClass = 'text-emerald-500 font-bold';
            } else if (servido > 0) {
              serviceRateClass = 'text-amber-500 font-bold';
            } else {
              serviceRateClass = 'text-rose-500 font-bold';
            }
          }
        }

        // Nivel 2 y 3: Detalle desplegable si isExpanded
        let detailHtml = '';
        if (isExpanded) {
          // Identificar padres divididos para mostrar la relación si existen
          const dividedParents = group.allOrders.filter(o => !o.active && Array.isArray(o.splitChildren) && o.splitChildren.length > 0);

          const productBlocksHtml = Array.from(productMap.values()).map(p => {
            // Pedidos activos para este producto
            const ordersRowsHtml = p.orders.map(order => {
              const isChild = Boolean(order.parentOrderId);
              const dayName = getDayOfWeekName(order.fechaEntrega);
              const dateLabel = dayName ? `${dayName} ${order.fechaEntrega}` : order.fechaEntrega;

              let badgeHtml = '';
              if (order.origen === 'ANTICIPADO') {
                badgeHtml = '<span class="badge-origin-anticipado inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">ANTICIPADO</span>';
              } else if (order.origen === 'DIVIDIDO') {
                badgeHtml = '<span class="badge-origin-dividido inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">DIVIDIDO</span>';
              } else {
                badgeHtml = '<span class="badge-origin-prevision inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">PREVISIÓN</span>';
              }

              return `
                <div class="order-item-row flex items-center justify-between p-2.5 rounded-lg bg-surface border border-app hover:border-strong transition-colors text-xs gap-3">
                  <!-- Nivel 3: Datos del Pedido -->
                  <div class="flex items-center gap-2.5 min-w-0 flex-wrap">
                    ${isChild ? `<span class="text-purple-400 font-mono font-bold">↳</span>` : ''}
                    <span class="font-mono font-bold text-primary text-xs">${escapeHtml(order.platform)}</span>
                    ${badgeHtml}
                    ${order.varietyId ? `<span class="text-[11px] text-secondary bg-card px-1.5 py-0.5 rounded border border-app">${escapeHtml(getVarietyShortLabel(order.productId, order.varietyId))}</span>` : ''}
                    <span class="text-[11px] text-muted font-mono">📅 ${escapeHtml(dateLabel)}</span>
                  </div>

                  <!-- Nivel 4: Cajas y Acciones -->
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="font-mono font-bold text-emerald-500 text-xs px-2.5 py-1 rounded bg-card border border-app">
                      ${order.cajas} <span class="text-[10px] text-secondary font-normal">cajas</span>
                    </span>

                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-split-order-id="${escapeHtml(order.id)}"
                        class="px-2.5 py-1 rounded-md bg-surface hover:bg-hover text-[11px] font-medium text-primary border border-app transition-colors"
                        title="Dividir en 2 o más sub-pedidos"
                      >✂ Dividir</button>

                      ${(order.origen === 'DIVIDIDO' || order.parentOrderId) ? `
                        <button
                          type="button"
                          data-unsplit-order-id="${escapeHtml(order.id)}"
                          class="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-medium text-amber-500 border border-amber-500/30 transition-colors"
                          title="Restaurar pedido original"
                        >↩ Deshacer división</button>
                      ` : ''}

                      <button
                        type="button"
                        data-remove-order-id="${escapeHtml(order.id)}"
                        class="px-2 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-[11px] text-rose-500 border border-rose-500/30 transition-colors"
                        title="Eliminar pedido"
                      >✕</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('');

            // Padres divididos de este producto
            const relatedDividedParents = dividedParents.filter(dp => dp.productId === p.productId && (dp.varietyId || null) === (p.varietyId || null));
            const parentRowsHtml = relatedDividedParents.map(dp => `
              <div class="order-parent-divided-row flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-app/50 text-xs opacity-60 text-secondary">
                <div class="flex items-center gap-2">
                  <span class="line-through font-mono font-bold">${escapeHtml(dp.platform)}</span>
                  <span class="text-[10px] italic text-muted">(pedido original de ${dp.cajas} cjs dividido)</span>
                </div>
                <button
                  type="button"
                  data-unsplit-order-id="${escapeHtml(dp.id)}"
                  class="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-[10px] text-amber-500 border border-amber-500/30 transition-colors"
                  title="Restaurar pedido original completo"
                >↩ Deshacer división</button>
              </div>
            `).join('');

            return `
              <div class="product-group-block rounded-lg bg-card border border-app p-3 space-y-2.5">
                <!-- Nivel 2: Cabecera de Producto / Variedad -->
                <div class="flex items-center justify-between pb-1.5 border-b border-app">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-primary">${escapeHtml(p.fullLabel)}</span>
                    <span class="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ${p.totalBoxes} cajas
                    </span>
                  </div>
                  <span class="text-[11px] text-muted">${p.orders.length} pedido${p.orders.length !== 1 ? 's' : ''}</span>
                </div>

                <!-- Nivel 3 y 4: Pedidos y Acciones -->
                <div class="space-y-1.5">
                  ${ordersRowsHtml}
                  ${parentRowsHtml}
                </div>
              </div>
            `;
          }).join('');

          detailHtml = `
            <div class="platform-detail-body border-t border-app bg-surface p-4 space-y-3.5 animate-fadeIn">
              <div class="flex items-center justify-between pb-2 border-b border-app">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-secondary">Detalle de Plataforma:</span>
                  <span class="text-xs font-mono font-bold text-primary">${escapeHtml(platName)}</span>
                  <span class="text-xs font-mono text-emerald-500 font-semibold">— ${totalBoxes} cajas</span>
                </div>
                <button
                  type="button"
                  data-toggle-platform="${escapeHtml(platName)}"
                  class="text-[11px] text-secondary hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span>↑ Ocultar detalle</span>
                </button>
              </div>

              ${productBlocksHtml}

              <div class="flex justify-end pt-1">
                <button
                  type="button"
                  data-toggle-platform="${escapeHtml(platName)}"
                  class="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1.5 py-1 px-3 rounded-lg bg-surface hover:bg-hover border border-app"
                >
                  <span>↑ Ocultar detalle</span>
                </button>
              </div>
            </div>
          `;
        }

        // Retornar tarjeta completa (Nivel 1)
        return `
          <div class="platform-group-card rounded-xl bg-card border border-app overflow-hidden transition-all shadow-sm" data-platform="${escapeHtml(platName)}">
            <!-- Nivel 1: Fila resumen de plataforma con Balance DEMANDA / SERVIDO / PENDIENTE -->
            <div
              class="platform-header-row p-4 cursor-pointer hover:bg-hover transition-colors select-none"
              data-toggle-platform="${escapeHtml(platName)}"
            >
              <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                <!-- Identidad y total cajas solicitadas -->
                <div class="flex items-center gap-3.5 min-w-0">
                  <div class="w-1.5 h-10 rounded-full bg-emerald-500 shrink-0"></div>
                  <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-2.5">
                      <h4 class="font-mono font-black text-base md:text-lg tracking-wide text-primary uppercase">${escapeHtml(platName)}</h4>
                      <span class="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-surface text-emerald-500 border border-emerald-500/30">
                        ${totalBoxes} cajas
                      </span>
                    </div>
                    <div class="text-xs text-secondary truncate flex items-center flex-wrap pt-0.5">
                      ${productPillsHtml || '<span class="italic text-[11px] text-muted">Sin productos</span>'}
                    </div>
                  </div>
                </div>

                <!-- Balance Operativo: DEMANDA / SERVIDO / PENDIENTE -->
                <div class="flex items-center gap-4 sm:gap-6 shrink-0 bg-surface px-4 py-2 rounded-lg border border-app">
                  <div class="text-center min-w-[50px]">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-muted">Demanda</span>
                    <span class="font-mono font-black text-sm text-primary platform-demanda-val">${demanda}</span>
                  </div>
                  <span class="text-muted/40 font-light">/</span>
                  <div class="text-center min-w-[50px]">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-muted">Servido</span>
                    <span class="font-mono font-black text-sm ${hasPlan ? 'text-emerald-500' : 'text-muted'} platform-servido-val">${hasPlan ? servido : '—'}</span>
                  </div>
                  <span class="text-muted/40 font-light">/</span>
                  <div class="text-center min-w-[50px]">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-muted">Pendiente</span>
                    <span class="font-mono font-black text-sm ${hasPlan ? (pendiente > 0 ? 'text-amber-500' : 'text-secondary') : 'text-muted'} platform-pendiente-val">${hasPlan ? pendiente : '—'}</span>
                  </div>
                  <div class="border-l border-app pl-3 text-right min-w-[90px]">
                    <span class="block text-[10px] font-semibold text-muted uppercase">Estado</span>
                    <span class="font-mono text-xs ${serviceRateClass} platform-status-val">
                      ${serviceRateText}
                    </span>
                  </div>
                </div>

                <!-- Botón de apertura / cierre -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-toggle-platform="${escapeHtml(platName)}"
                    class="text-xs font-semibold px-3.5 py-2 rounded-lg bg-surface hover:bg-hover text-primary border border-app transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span>${isExpanded ? 'Ocultar detalle' : 'Ver detalle'}</span>
                    <span class="text-xs text-secondary">${isExpanded ? '↑' : '→'}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Nivel 2, 3, 4: Desplegable -->
            ${detailHtml}
          </div>
        `;
      }).join('');

      targetEl.innerHTML = htmlCards;
    }

    openAddOrderModal() {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('modal-add-order');
      if (!modal) return;

      const platEl = document.getElementById('order-platform');
      const prodEl = document.getElementById('order-product');
      const varEl = document.getElementById('order-variety');
      const boxesEl = document.getElementById('order-boxes');
      const dateEl = document.getElementById('order-delivery-date');
      const errEl = document.getElementById('order-form-error');

      if (platEl) platEl.value = '';
      if (prodEl) prodEl.value = 'PERA_RAMA';
      if (varEl) varEl.value = '';
      if (boxesEl) boxesEl.value = '';
      if (dateEl) {
        const available = (this.state.getAvailableDeliveryDates && this.state.getAvailableDeliveryDates()) || [];
        dateEl.value = this.state.selectedDeliveryDate || (available.length > 0 ? available[0] : '');
      }
      if (errEl) {
        errEl.classList.add('hidden');
        errEl.textContent = '';
      }

      modal.classList.remove('hidden');
      modal.removeAttribute('hidden');
    }

    closeAddOrderModal() {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('modal-add-order');
      if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('hidden', '');
      }
    }

    saveNewOrder() {
      if (typeof document === 'undefined') return;
      const platEl = document.getElementById('order-platform');
      const prodEl = document.getElementById('order-product');
      const varEl = document.getElementById('order-variety');
      const boxesEl = document.getElementById('order-boxes');
      const dateEl = document.getElementById('order-delivery-date');
      const errEl = document.getElementById('order-form-error');

      const platform = platEl ? platEl.value.trim().toUpperCase() : '';
      const productId = prodEl ? prodEl.value.trim().toUpperCase() : '';
      const varietyId = varEl && varEl.value ? varEl.value.trim().toUpperCase() : null;
      const boxes = boxesEl ? parseInt(boxesEl.value, 10) : 0;
      const deliveryDate = dateEl ? dateEl.value.trim() : '';

      if (!platform) {
        if (errEl) { errEl.textContent = 'Indica la plataforma (ej. CENTRO, LEVANTE).'; errEl.classList.remove('hidden'); }
        return;
      }
      if (!productId) {
        if (errEl) { errEl.textContent = 'Selecciona un producto.'; errEl.classList.remove('hidden'); }
        return;
      }
      if (isNaN(boxes) || boxes <= 0) {
        if (errEl) { errEl.textContent = 'La cantidad de cajas debe ser mayor que 0.'; errEl.classList.remove('hidden'); }
        return;
      }
      if (!deliveryDate) {
        if (errEl) { errEl.textContent = 'Indica la fecha de entrega (ej. 26/09/2026).'; errEl.classList.remove('hidden'); }
        return;
      }

      this.state.addAdvanceOrder({
        platform,
        productId,
        varietyId,
        cajas: boxes,
        fechaEntrega: deliveryDate
      });

      this.closeAddOrderModal();
      this.renderConsolidatedForecast();
      this.updateWorkflowBar();
      if (this.state.planningResult) {
        this.handleGeneratePlan();
      }
      this.showToast(`✓ Pedido anticipado para ${platform} (${boxes} cjs) añadido.`);
    }

    openSplitOrderModal(orderId) {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('modal-split-order');
      if (!modal) return;

      const order = (this.state.orders || []).find(o => o.id === orderId);
      if (!order) return;

      this.currentSplitOrderId = orderId;

      const infoEl = document.getElementById('split-parent-info');
      const rowsContainer = document.getElementById('split-rows-container');
      const errEl = document.getElementById('split-form-error');

      if (errEl) {
        errEl.classList.add('hidden');
        errEl.textContent = '';
      }

      const dayName = getDayOfWeekName(order.fechaEntrega);
      const dateText = dayName ? `${dayName} ${order.fechaEntrega}` : order.fechaEntrega;
      const varText = order.varietyId ? ` (${order.varietyId})` : '';

      if (infoEl) {
        infoEl.innerHTML = `
          <div class="p-3 rounded-lg bg-[#16181B] border border-[#22252A] text-xs space-y-1">
            <div class="flex items-center justify-between font-mono font-bold">
              <span class="text-white text-sm">${escapeHtml(order.platform)}</span>
              <span class="text-emerald-400 text-sm">${order.cajas} cajas</span>
            </div>
            <div class="text-[#8A8F98] text-[11px]">
              <span>${escapeHtml(order.productId)}${escapeHtml(varText)}</span>
              <span class="text-[#383D45]">·</span>
              <span>Entrega: ${escapeHtml(dateText)}</span>
            </div>
          </div>
        `;
      }

      // Crear 2 sub-pedidos por defecto repartiendo las cajas
      const half1 = Math.ceil(order.cajas / 2);
      const half2 = Math.floor(order.cajas / 2);

      if (rowsContainer) {
        rowsContainer.innerHTML = `
          <div class="split-row grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              value="${escapeHtml(order.platform)} 1"
              class="split-row-platform col-span-6 p-2 rounded bg-[#0B0C0E] border border-[#22252A] text-xs text-white"
              placeholder="Sub-plataforma 1"
            />
            <input
              type="number"
              min="1"
              value="${half1}"
              class="split-row-boxes col-span-4 p-2 rounded bg-[#0B0C0E] border border-[#22252A] text-xs font-mono font-bold text-white text-right"
              placeholder="Cajas"
            />
            <span class="col-span-1 text-center text-xs text-[#5E6470]">cjs</span>
            <button type="button" class="btn-remove-split-row col-span-1 p-1 text-xs text-[#5E6470] hover:text-rose-400 font-bold text-center cursor-pointer" title="Eliminar sub-pedido">✕</button>
          </div>
          <div class="split-row grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              value="${escapeHtml(order.platform)} 2"
              class="split-row-platform col-span-6 p-2 rounded bg-[#0B0C0E] border border-[#22252A] text-xs text-white"
              placeholder="Sub-plataforma 2"
            />
            <input
              type="number"
              min="1"
              value="${half2}"
              class="split-row-boxes col-span-4 p-2 rounded bg-[#0B0C0E] border border-[#22252A] text-xs font-mono font-bold text-white text-right"
              placeholder="Cajas"
            />
            <span class="col-span-1 text-center text-xs text-[#5E6470]">cjs</span>
            <button type="button" class="btn-remove-split-row col-span-1 p-1 text-xs text-[#5E6470] hover:text-rose-400 font-bold text-center cursor-pointer" title="Eliminar sub-pedido">✕</button>
          </div>
        `;
      }

      this.updateSplitSumFeedback();
      modal.classList.remove('hidden');
      modal.removeAttribute('hidden');
    }

    addSplitRow() {
      if (typeof document === 'undefined') return;
      const rowsContainer = document.getElementById('split-rows-container');
      if (!rowsContainer) return;

      const order = (this.state.orders || []).find(o => o.id === this.currentSplitOrderId);
      const prefix = order ? order.platform : 'SUB';
      const rowCount = rowsContainer.querySelectorAll('.split-row').length + 1;

      const row = document.createElement('div');
      row.className = 'split-row grid grid-cols-12 gap-2 items-center';
      row.innerHTML = `
        <input
          type="text"
          value="${escapeHtml(prefix)} ${rowCount}"
          class="split-row-platform col-span-6 p-2 rounded bg-[#0B0C0E] border border-[#22252A] text-xs text-white"
          placeholder="Sub-plataforma ${rowCount}"
        />
        <input
          type="number"
          min="1"
          value="0"
          class="split-row-boxes col-span-4 p-2 rounded bg-[#0B0C0E] border border-[#22252A] text-xs font-mono font-bold text-white text-right"
          placeholder="Cajas"
        />
        <span class="col-span-1 text-center text-xs text-[#5E6470]">cjs</span>
        <button type="button" class="btn-remove-split-row col-span-1 p-1 text-xs text-[#5E6470] hover:text-rose-400 font-bold text-center cursor-pointer" title="Eliminar sub-pedido">✕</button>
      `;
      rowsContainer.appendChild(row);
      this.updateSplitSumFeedback();
    }

    updateSplitSumFeedback() {
      if (typeof document === 'undefined') return;
      const rowsContainer = document.getElementById('split-rows-container');
      const sumEl = document.getElementById('split-sum-info');
      const btnConfirm = document.getElementById('btn-confirm-split');
      if (!rowsContainer || !sumEl) return;

      const order = (this.state.orders || []).find(o => o.id === this.currentSplitOrderId);
      if (!order) return;

      let currentSum = 0;
      rowsContainer.querySelectorAll('.split-row-boxes').forEach(inp => {
        currentSum += Math.max(0, parseInt(inp.value, 10) || 0);
      });

      const isExact = currentSum === order.cajas;
      if (isExact) {
        sumEl.textContent = `Suma: ${currentSum} / ${order.cajas} cjs (✓ Cuadre exacto)`;
        sumEl.className = 'text-xs font-semibold text-emerald-400';
        if (btnConfirm) {
          btnConfirm.disabled = false;
          btnConfirm.classList.remove('opacity-40', 'cursor-not-allowed');
          btnConfirm.classList.add('cursor-pointer');
        }
      } else {
        const diff = currentSum - order.cajas;
        const diffText = diff > 0 ? `+${diff} de más` : `${Math.abs(diff)} restantes`;
        sumEl.textContent = `Suma: ${currentSum} / ${order.cajas} cjs (⚠️ ${diffText})`;
        sumEl.className = 'text-xs font-semibold text-amber-400';
        if (btnConfirm) {
          btnConfirm.disabled = true;
          btnConfirm.classList.add('opacity-40', 'cursor-not-allowed');
          btnConfirm.classList.remove('cursor-pointer');
        }
      }
    }

    closeSplitOrderModal() {
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('modal-split-order');
      if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('hidden', '');
      }
      this.currentSplitOrderId = null;
    }

    confirmSplitOrder() {
      if (typeof document === 'undefined' || !this.currentSplitOrderId) return;
      const rowsContainer = document.getElementById('split-rows-container');
      const errEl = document.getElementById('split-form-error');
      if (!rowsContainer) return;

      const order = (this.state.orders || []).find(o => o.id === this.currentSplitOrderId);
      if (!order) return;

      const splits = [];
      const rowEls = rowsContainer.querySelectorAll('.split-row');
      rowEls.forEach(row => {
        const pInp = row.querySelector('.split-row-platform');
        const bInp = row.querySelector('.split-row-boxes');
        const pVal = pInp ? pInp.value.trim().toUpperCase() : '';
        const bVal = bInp ? parseInt(bInp.value, 10) || 0 : 0;
        if (pVal && bVal > 0) {
          splits.push({ platform: pVal, cajas: bVal });
        }
      });

      if (splits.length < 2) {
        if (errEl) {
          errEl.textContent = 'Se requieren al menos 2 sub-pedidos válidos con más de 0 cajas.';
          errEl.classList.remove('hidden');
        }
        return;
      }

      try {
        this.state.splitOrder(this.currentSplitOrderId, splits);
        const parentPlat = getBasePlatform(order, this.state.orders);
        if (this.expandedPlatforms && parentPlat) {
          this.expandedPlatforms.add(parentPlat);
        }
        this.closeSplitOrderModal();
        this.renderConsolidatedForecast();
        this.updateWorkflowBar();
        if (this.state.planningResult) {
          this.handleGeneratePlan();
        }
        this.showToast(`✓ Pedido ${order.platform} dividido en ${splits.length} sub-pedidos.`);
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message;
          errEl.classList.remove('hidden');
        }
      }
    }

    populateDropdowns(analysis) {
      const lockPlat = document.getElementById('lock-platform');
      const lockProd = document.getElementById('lock-product');
      const exclPlat = document.getElementById('exclusion-platform-val');
      const exclProd = document.getElementById('exclusion-product-val');
      const overridePlat = document.getElementById('override-pallet-platform');
      const overrideProd = document.getElementById('override-pallet-product');

      const platforms = analysis && analysis.platformsFound && analysis.platformsFound.length > 0
        ? analysis.platformsFound
        : (DEFAULT_CATALOG.platforms && DEFAULT_CATALOG.platforms.canonical) || ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA'];

      const products = analysis && analysis.productsFound && analysis.productsFound.length > 0
        ? analysis.productsFound
        : ['PERA_RAMA', 'COCKTAIL_ROMANTICO', 'CHERRY_RAMA'];

      if (lockPlat) {
        lockPlat.innerHTML = platforms.map(p => `<option value="${p}">${p}</option>`).join('');
      }
      if (exclPlat) {
        exclPlat.innerHTML = platforms.map(p => `<option value="${p}">${p}</option>`).join('');
      }
      if (lockProd) {
        lockProd.innerHTML = products.map(p => `<option value="${p}">${p}</option>`).join('');
      }
      if (exclProd) {
        exclProd.innerHTML = products.map(p => `<option value="${p}">${p}</option>`).join('');
      }
      if (overridePlat) {
        overridePlat.innerHTML = platforms.map(p => `<option value="${p}">${p}</option>`).join('');
      }
      if (overrideProd) {
        overrideProd.innerHTML = products.map(p => `<option value="${p}">${p}</option>`).join('');
      }

      this.renderLockPlatformPills();
      this.renderLockActionButtons();
      this.checkLockConflictFeedback();
    }

    renderPalletOverridesList() {
      const container = document.getElementById('active-pallet-overrides-list');
      if (!container) return;

      const entries = Object.entries(this.state.palletOverrides || {});
      if (entries.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic">Sin excepciones manuales (se aplican reglas automáticas).</p>';
        return;
      }

      container.innerHTML = entries.map(([key, palletType]) => {
        const parts = key.split('::');
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-[#16181B] border border-[#22252A] text-xs">
            <div class="flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 border border-purple-800/60 font-mono font-bold text-[10px]">${palletType}</span>
              <span class="font-semibold text-[#EDEDEF]">${parts[0]}</span>
              <span class="text-[#8A8F98] font-mono text-[11px]">${parts[1]}</span>
            </div>
            <button data-override-key="${key}" class="btn-remove-pallet-override text-[#5E6470] hover:text-rose-400 p-1 font-bold">✕</button>
          </div>
        `;
      }).join('');

      const self = this;
      container.querySelectorAll('.btn-remove-pallet-override').forEach(btn => {
        btn.addEventListener('click', e => {
          const key = e.target.getAttribute('data-override-key');
          self.state.removePalletOverride(key);
          self.renderPalletOverridesList();
        });
      });
    }

    renderLocksList() {
      if (typeof document === 'undefined') return;
      const container = document.getElementById('active-locks-list');
      if (!container) return;

      if (this.state.locks.length === 0) {
        container.innerHTML = '<p class="text-xs text-[#5E6470] italic w-full">No hay bloqueos activos.</p>';
        this.updateWorkflowBar();
        this.renderWorkflowStrip();
        return;
      }

      container.innerHTML = this.state.locks.map((l, idx) => {
        let label = l.label;
        if (!label) {
          let prodLabel = l.productId === 'PERA_RAMA' ? 'PERA'
            : l.productId === 'COCKTAIL_ROMANTICO' ? (l.varietyId === 'SAO_PAULO' ? 'COCKTAIL SP' : l.varietyId === 'SUNSTREAM' ? 'COCKTAIL SUN' : 'COCKTAIL')
            : l.productId === 'CHERRY_RAMA' ? 'CHERRY'
            : l.productId;
          let typeLabel = l.type === 'FULL' ? 'COMPLETA' : `(${l.quantity} cjs)`;
          label = `${prodLabel} ${typeLabel}`;
        }
        return `
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#16181B] border border-[#22252A] text-xs font-medium text-[#EDEDEF] shadow-2xs">
            <span>🔒</span>
            <span class="font-bold text-[#EDEDEF]">${l.platform}</span>
            <span class="text-[#5E6470]">·</span>
            <span class="font-medium text-[#8A8F98]">${label}</span>
            <button data-lock-idx="${idx}" class="btn-remove-lock text-[#5E6470] hover:text-rose-400 font-bold ml-1 transition-colors" title="Eliminar bloqueo">✕</button>
          </div>
        `;
      }).join('');

      this.updateWorkflowBar();
      this.renderWorkflowStrip();

      const self = this;
      container.querySelectorAll('.btn-remove-lock').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = Number(e.target.getAttribute('data-lock-idx'));
          self.state.removeLock(idx);
          self.renderLocksList();
          self.checkLockConflictFeedback();
          self.renderPlanStateBanner();
        });
      });
    }

    renderExclusionsList() {
      const container = document.getElementById('active-exclusions-list');
      if (!container) return;

      if (this.state.exclusions.length === 0) {
        container.innerHTML = '<p class="text-xs text-[#5E6470] italic">No hay exclusiones aplicadas.</p>';
        return;
      }

      container.innerHTML = this.state.exclusions.map((ex, idx) => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-[#16181B] border border-[#22252A] text-xs">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded bg-rose-950/50 text-rose-300 border border-rose-800/60 font-mono font-bold text-[10px]">${ex.type}</span>
            <span class="font-semibold text-[#EDEDEF]">${ex.value}</span>
            <span class="text-[#8A8F98] text-[11px] italic">(${ex.reason})</span>
          </div>
          <button data-excl-idx="${idx}" class="btn-remove-excl text-[#5E6470] hover:text-rose-400 p-1 font-bold">✕</button>
        </div>
      `).join('');

      const self = this;
      container.querySelectorAll('.btn-remove-excl').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = Number(e.target.getAttribute('data-excl-idx'));
          self.state.removeExclusion(idx);
          self.renderExclusionsList();
        });
      });
    }

    renderExecutiveSummary(result) {
      const model = buildTruckSlotsModel(result);
      const totalReq = result.demandSummary ? result.demandSummary.totalRequested : 0;
      const totalAlloc = result.allocations ? result.allocations.reduce((s, a) => s + a.allocatedQuantity, 0) : 0;
      const totalMissing = result.allocations ? result.allocations.reduce((s, a) => s + a.missingQuantity, 0) : 0;
      const totalPallets = model.totalPallets;
      const totalPalletSlots = model.totalPalletSlots;
      const totalTruckSlots = model.totalTruckSlots;
      const fulfillmentPct = totalReq > 0 ? ((totalAlloc / totalReq) * 100).toFixed(1) : '100.0';

      const elSlots = document.getElementById('kpi-truck-slots');
      const elPalletSlots = document.getElementById('kpi-pallet-slots');
      const elReq = document.getElementById('kpi-requested');
      const elAlloc = document.getElementById('kpi-allocated');
      const elMissing = document.getElementById('kpi-missing');
      const elService = document.getElementById('kpi-service-rate');
      const elPallets = document.getElementById('kpi-pallets');
      const elStockList = document.getElementById('kpi-stock-details');

      if (elSlots) elSlots.textContent = totalTruckSlots;
      if (elPalletSlots) elPalletSlots.textContent = totalPalletSlots;
      if (elReq) elReq.textContent = totalReq;
      if (elAlloc) elAlloc.textContent = totalAlloc;
      if (elMissing) elMissing.textContent = totalMissing;
      if (elService) elService.textContent = `${fulfillmentPct}%`;
      if (elPallets) elPallets.textContent = totalPallets;

      if (elStockList && result.stockRemaining) {
        const formatStockKey = (k) => {
          if (k === 'PERA_RAMA') return 'Pera Rama';
          if (k === 'COCKTAIL_ROMANTICO::CONSABOR') return 'Cocktail (Consabor)';
          if (k === 'COCKTAIL_ROMANTICO::SAO_PAULO') return 'Cocktail (Sao Paulo)';
          if (k === 'COCKTAIL_ROMANTICO::SUNSTREAM') return 'Cocktail (Sunstream)';
          if (k === 'CHERRY_RAMA::SUNSTREAM') return 'Cherry Rama (Sunstream)';
          return k;
        };

        elStockList.innerHTML = result.stockRemaining.map(s => `
          <div class="flex items-center justify-between py-1.5 px-3 rounded bg-[#121316] border border-[#22252A] text-xs">
            <span class="font-semibold text-[#EDEDEF]">${formatStockKey(s.stockKey)}</span>
            <span class="font-mono text-[11px] text-[#8A8F98]">
              disponible: <strong class="text-[#EDEDEF]">${s.available}</strong> | 
              usado: <strong class="text-emerald-400">${s.used}</strong> | 
              restante: <strong class="text-amber-400">${s.remaining}</strong>
            </span>
          </div>
        `).join('');
      }
    }

    renderPlatformPlan(result) {
      const container = document.getElementById('platform-plan-cards-container');
      if (!container) return;

      const allOrders = (this.state && this.state.orders) || [];
      const model = buildTruckSlotsModel(result, allOrders);
      if (model.slots.length === 0) {
        container.innerHTML = `
          <div class="col-span-full bg-[#16181B] rounded-xl border border-[#22252A] p-8 text-center text-[#5E6470] italic text-xs">
            No hay mercancía asignada a ninguna plataforma.
          </div>
        `;
        return;
      }

      container.innerHTML = model.slots.map(slot => {
        // Filas de productos en la plataforma
        const productRowsHTML = slot.items.map(item => {
          const missingText = item.missingQuantity > 0
            ? ` <span class="no-print text-rose-400 font-semibold text-[10px] block sm:inline">(faltan ${item.missingQuantity})</span>`
            : '';

          let prodDisplay = item.productLabel;
          if (item.productId === 'PERA_RAMA') {
            prodDisplay = 'Pera Rama';
          } else if (item.productId === 'COCKTAIL_ROMANTICO') {
            if (item.varietyId === 'SAO_PAULO') {
              prodDisplay = 'Cocktail — Sao Paulo';
            } else if (item.varietyId === 'SUNSTREAM') {
              prodDisplay = 'Cocktail — Sunstream';
            } else {
              prodDisplay = 'Cocktail' + (item.varietyId ? ` — ${item.varietyId}` : '');
            }
          } else if (item.productId === 'CHERRY_RAMA') {
            if (item.varietyId === 'SUNSTREAM') {
              prodDisplay = 'Cherry Sunstream';
            } else {
              prodDisplay = 'Cherry Rama' + (item.varietyId ? ` — ${item.varietyId}` : '');
            }
          }

          return `
            <div class="grid grid-cols-12 gap-1 items-center py-1 px-1 border-b border-[#22252A] last:border-b-0 text-xs">
              <div class="col-span-6 font-medium text-[#EDEDEF] text-prod truncate" title="${prodDisplay}">
                <span>${prodDisplay}</span>${missingText}
              </div>
              <div class="col-span-3 text-right font-mono font-bold text-[#EDEDEF] card-boxes tabular-nums">
                ${item.totalBoxes}
              </div>
              <div class="col-span-3 text-right font-mono text-[11px] text-[#8A8F98] badge-pallet font-medium">
                ${item.palletCount} × ${item.palletType}
              </div>
            </div>
          `;
        }).join('');

        // Detalle físico de torres y palets por hueco (Fase 14.4)
        const towers = (slot.stackingPlan && slot.stackingPlan.towers) ? slot.stackingPlan.towers : [];
        let physicalDetailHTML = '';

        if (towers.length > 0) {
          physicalDetailHTML = towers.map(t => {
            const towerPalletsHTML = (t.pallets || []).map((p, pIdx) => {
              let prodName = p.productId;
              if (p.productId === 'PERA_RAMA') prodName = 'Pera Rama';
              else if (p.productId === 'COCKTAIL_ROMANTICO') {
                // Textos históricos preservados; CONSABOR (y futuras variedades) se rotulan igual.
                if (p.varietyId === 'SAO_PAULO') prodName = 'Cocktail (Sao Paulo)';
                else if (p.varietyId === 'SUNSTREAM') prodName = 'Cocktail (Sunstream)';
                else if (p.varietyId) prodName = `Cocktail (${getVarietyLongLabel(p.productId, p.varietyId)})`;
                else prodName = 'Cocktail Romántico';
              } else if (p.productId === 'CHERRY_RAMA') {
                prodName = p.varietyId === 'SUNSTREAM' ? 'Cherry Sunstream' : 'Cherry Rama';
              }

              const merchH = p.merchandiseHeightMm || 0;
              const woodH = p.palletHeightMm || 144;
              const totalH = p.palletTotalHeightMm || (merchH + woodH);

              return `
                <div class="py-1 px-2 rounded bg-[#16181B] border border-[#22252A] text-[11px] space-y-0.5">
                  <div class="flex items-center justify-between gap-1.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="text-[#5E6470] font-mono text-[10px] font-bold">P${pIdx + 1}</span>
                      <span class="font-semibold text-[#EDEDEF] truncate">${escapeHtml(prodName)}</span>
                    </div>
                    <span class="font-mono font-bold text-[#EDEDEF] text-[11px] shrink-0">${totalH} mm</span>
                  </div>
                  <div class="flex items-center justify-between text-[10px] font-mono text-[#8A8F98]">
                    <span>${p.boxes} cjs · ${p.layers} ${p.layers === 1 ? 'capa' : 'capas'}</span>
                    <span>${merchH} mm merc. + ${woodH} mm madera</span>
                  </div>
                </div>
              `;
            }).join('');

            return `
              <div class="rounded-lg bg-[#121316] border border-[#22252A] p-2.5 space-y-2">
                <div class="flex items-center justify-between text-xs flex-wrap gap-1">
                  <div class="flex items-center gap-1.5 font-mono">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${t.format === 'METROCHEP' ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60' : 'bg-[#1D2024] text-[#EDEDEF] border border-[#2B2F36]'}">
                      TORRE ${t.format} #${t.towerIndex}
                    </span>
                    <span class="text-[11px] text-[#8A8F98]">
                      ${t.palletCount} ${t.palletCount === 1 ? 'palet' : 'palets'} | <strong class="text-[#EDEDEF]">${t.totalBoxes}</strong> cjs
                    </span>
                  </div>
                  <div class="font-mono text-[10px] text-[#8A8F98]">
                    <span>ALTURA <strong class="text-[#EDEDEF]">${t.towerHeightMm}</strong> / ${t.maxTowerHeightMm} mm</span>
                    <span class="ml-1 text-emerald-400 font-semibold">| RESTANTE ${t.remainingHeightMm} mm</span>
                  </div>
                </div>
                <div class="space-y-1">
                  ${towerPalletsHTML}
                </div>
              </div>
            `;
          }).join('');
        } else {
          physicalDetailHTML = slot.items.map(item => {
            return item.pallets.map(p => {
              let badge = `<span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/60">100%</span>`;
              if (!p.isFull) {
                badge = `<span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-amber-950/40 text-amber-300 border border-amber-800/60">${p.occupancyPercentage}%</span>`;
              }

              return `
                <div class="flex items-center justify-between py-0.5 px-1.5 rounded bg-[#121316] border border-[#22252A] text-[11px]">
                  <span class="text-[#8A8F98]">Palet #${p.palletNumber} (${item.palletType}): <strong class="font-mono font-bold text-[#EDEDEF]">${p.boxes}</strong>/${p.capacity}</span>
                  ${badge}
                </div>
              `;
            }).join('');
          }).join('');
        }

        const palletSlotWord = slot.palletSlots === 1 ? 'hueco de palet' : 'huecos de palet';
        const palletSlotLabel = `${slot.palletSlots} ${palletSlotWord}`;
        const physicalPalletWord = slot.totalPallets === 1 ? 'palet' : 'palets';
        const physicalPalletSub = ` <span class="text-[#5E6470] card-badge">(${slot.totalPallets} ${physicalPalletWord})</span>`;

        const prov = slot.provenance || derivePlatformProvenance(slot.platform, allOrders, result);
        const provenanceBadgesHTML = (prov && prov.badges && prov.badges.length > 0)
          ? prov.badges.map(b => getProvenanceBadgeHTML(b)).join(' ')
          : '';

        const basePlat = prov.basePlatform || getBasePlatform({ platform: slot.platform }, allOrders);
        const subpedidoBadge = (basePlat && basePlat !== slot.platform)
          ? `<div class="text-[11px] font-mono text-purple-400 font-semibold tracking-tight">↳ Subpedido de ${escapeHtml(basePlat)}</div>`
          : '';

        let mixedDetailHTML = '';
        if (prov.state === 'MIXTO' || (prov.anticipadoBoxes > 0 && prov.previsionBoxes > 0)) {
          mixedDetailHTML = `<div class="text-[10px] font-mono text-[#8A8F98] mt-0.5 tracking-tight font-medium">${escapeHtml(prov.detailText)}</div>`;
        }

        const platMissing = slot.items.reduce((s, it) => s + (it.missingQuantity || 0), 0);
        const platRequested = slot.items.reduce((s, it) => s + (it.requestedQuantity || it.totalBoxes), 0);
        let deficitNoticeHTML = '';
        if (platMissing > 0) {
          deficitNoticeHTML = `
            <div class="mt-1 px-2 py-0.5 rounded bg-rose-950/30 border border-rose-900/40 text-[10px] font-mono text-rose-300">
              Demanda: <strong>${platRequested}</strong> cjs · Servido: <strong class="text-white">${slot.totalBoxes}</strong> cjs · Pendiente: <strong class="text-rose-400">${platMissing}</strong> cjs
            </div>
          `;
        }

        return `
          <div data-platform="${slot.platform}" class="digital-loading-card bg-[#16181B] rounded-lg border border-[#22252A] p-3.5 hover:border-[#383D45] text-[#EDEDEF] transition-colors break-inside-avoid print:p-2 print:border-slate-400 print:shadow-none">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-mono font-bold text-[#EDEDEF] tracking-tight text-base uppercase">${slot.platform}</h3>
                  ${provenanceBadgesHTML ? `<div class="flex items-center gap-1">${provenanceBadgesHTML}</div>` : ''}
                </div>
                ${subpedidoBadge}
                ${mixedDetailHTML}
              </div>
              <span class="text-xs font-mono font-medium text-[#8A8F98] card-badge">${palletSlotLabel}${physicalPalletSub}</span>
            </div>
            ${deficitNoticeHTML}
            <div class="mt-0.5 flex items-baseline justify-between">
              <span class="text-2xl font-mono font-extrabold text-[#EDEDEF] card-boxes tabular-nums tracking-tight">${slot.totalBoxes}</span>
              <span class="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#5E6470]">cajas</span>
            </div>
            <div class="border-b border-[#22252A] my-2 print:border-slate-800"></div>
            <div class="grid grid-cols-12 gap-1 text-[10px] font-mono uppercase tracking-wider text-[#5E6470] font-semibold border-b border-[#22252A] pb-1 mb-1 px-1">
              <div class="col-span-6">Producto</div>
              <div class="col-span-3 text-right">Cajas</div>
              <div class="col-span-3 text-right">Palet</div>
            </div>
            <div class="space-y-0.5">
              ${productRowsHTML}
            </div>
            <details class="no-print mt-2 pt-1.5 border-t border-[#22252A] text-[11px] text-[#8A8F98] group">
              <summary class="cursor-pointer font-medium hover:text-[#EDEDEF] select-none py-1 flex items-center justify-between">
                <span>Ver detalle físico (${slot.palletSlots} hueco${slot.palletSlots > 1 ? 's' : ''})</span>
                <span class="text-[#5E6470] group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div class="pt-1.5 space-y-2">
                ${physicalDetailHTML}
              </div>
            </details>
            <!-- FASE 18 · MOBILE SHELL: acceso táctil al detalle de plataforma.
                 Visible sólo en móvil (src/mobile.css). No altera el PDF ni la impresión. -->
            <button
              type="button"
              class="btn-platform-detail mobile-only"
              data-platform="${slot.platform}"
              aria-label="Ver detalle de la plataforma ${slot.platform}"
            >
              <span>Ver detalle</span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        `;
      }).join('');
    }

    renderPlatformTable(result) {
      const tbody = document.getElementById('table-platform-allocations-body');
      if (!tbody) return;

      if (!result.allocations || result.allocations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400 italic">No hay asignaciones que mostrar.</td></tr>`;
        return;
      }

      const formatProduct = (p) => {
        if (p === 'PERA_RAMA') return 'Pera Rama';
        if (p === 'COCKTAIL_ROMANTICO') return 'Cocktail Romántico';
        if (p === 'CHERRY_RAMA') return 'Cherry Rama';
        return p;
      };

      tbody.innerHTML = result.allocations.map(a => {
        let varietyBadge = '<span class="text-[#5E6470] font-mono text-[11px]">-</span>';
        if (a.varietyId) {
          // Badge genérico: SAO_PAULO y SUNSTREAM conservan su color; CONSABOR y
          // cualquier variedad nueva del catálogo obtienen badge propio en vez de "-".
          varietyBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getVarietyBadgeClass(a.varietyId)}">${getVarietyShortLabel(a.productId, a.varietyId)}</span>`;
        }

        const isUnfulfilled = a.allocatedQuantity === 0;
        const isPartial = a.allocatedQuantity > 0 && a.missingQuantity > 0;

        let statusClass = 'text-[#EDEDEF]';
        if (isUnfulfilled) statusClass = 'text-rose-400 bg-rose-950/20';
        else if (isPartial) statusClass = 'text-amber-300 bg-amber-950/20';

        // Determinar tipo de palet aplicado a este producto en esta plataforma
        const matchedGroup = (result.palletSummaries && result.palletSummaries.groups)
          ? result.palletSummaries.groups.find(g =>
              g.platform === a.platform &&
              g.productId === a.productId &&
              (g.varietyId === a.varietyId || (!g.varietyId && !a.varietyId))
            )
          : null;
        const palletTypeName = matchedGroup ? matchedGroup.palletType : 'EURO';
        const metroCap = a.productId === 'CHERRY_RAMA' ? '220' : a.productId === 'COCKTAIL_ROMANTICO' ? '100' : '95';
        const euroCap = a.productId === 'CHERRY_RAMA' ? '176' : a.productId === 'COCKTAIL_ROMANTICO' ? '80' : '76';
        const palletBadge = palletTypeName === 'METROCHEP'
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/50 text-purple-300 border border-purple-800/60">METROCHEP (${metroCap})</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#16181B] text-[#8A8F98] border border-[#22252A]">EURO (${euroCap})</span>`;

        return `
          <tr class="hover:bg-[#1D2024]/60 transition-colors border-b border-[#22252A] ${statusClass}">
            <td class="py-2.5 px-4 font-semibold text-[#EDEDEF]">${a.platform}</td>
            <td class="py-2.5 px-3 text-[#8A8F98] font-medium">${formatProduct(a.productId)}</td>
            <td class="py-2.5 px-3">${varietyBadge}</td>
            <td class="py-2.5 px-3 font-mono tabular-nums text-right font-medium text-[#8A8F98]">${a.requestedQuantity}</td>
            <td class="py-2.5 px-3 font-mono tabular-nums font-bold text-right ${a.allocatedQuantity > 0 ? 'text-emerald-400' : 'text-[#5E6470]'}">${a.allocatedQuantity}</td>
            <td class="py-2.5 px-3 font-mono tabular-nums text-right ${a.missingQuantity > 0 ? 'text-rose-400 font-bold' : 'text-[#5E6470]'}">${a.missingQuantity}</td>
            <td class="py-2.5 px-3 text-center">${palletBadge}</td>
            <td class="py-2.5 px-4 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#16181B] text-[#8A8F98] border border-[#22252A]">
                ${a.allocationMethod}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderPalletization(result) {
      const container = document.getElementById('palletization-groups-container');
      if (!container) return;

      const groups = (result.palletSummaries && result.palletSummaries.groups) || [];
      if (groups.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400 italic py-4">No se han generado palets físicos.</p>`;
        return;
      }

      const formatProduct = (p) => {
        if (p === 'PERA_RAMA') return 'Pera Rama';
        if (p === 'COCKTAIL_ROMANTICO') return 'Cocktail Romántico';
        if (p === 'CHERRY_RAMA') return 'Cherry Rama';
        return p;
      };

      container.innerHTML = groups.map(g => {
        const palletsHTML = (g.pallets || []).map(p => {
          let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">Completo</span>`;
          if (!p.isFull) {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/50 text-amber-300 border border-amber-800/60">Incompleto</span>`;
          }

          return `
            <div class="p-3 rounded-lg border border-[#22252A] bg-[#121316] space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-[#EDEDEF]">Palet #${p.palletNumber} (${g.palletType})</span>
                ${statusBadge}
              </div>
              <div class="flex items-baseline justify-between">
                <span class="text-xl font-mono font-bold text-[#EDEDEF]">${p.boxes} <span class="text-xs font-normal text-[#8A8F98]">/ ${p.capacity} cjs</span></span>
                <span class="text-xs font-mono font-semibold text-[#8A8F98]">${p.occupancyPercentage}%</span>
              </div>
              <div class="w-full bg-[#16181B] border border-[#22252A] rounded-full h-1.5 overflow-hidden">
                <div class="h-1.5 rounded-full ${p.isFull ? 'bg-emerald-500' : 'bg-amber-500'}" style="width: ${Math.min(100, p.occupancyPercentage)}%"></div>
              </div>
              <div class="flex justify-between text-[10px] text-[#5E6470] font-mono">
                <span>Capas: ${p.layers}</span>
                <span>Alt: ${p.theoreticalHeightMm} mm</span>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="bg-[#16181B] rounded-xl border border-[#22252A] p-4 space-y-3">
            <div class="flex items-center justify-between border-b border-[#22252A] pb-2">
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-[#EDEDEF]">${g.platform}</span>
                <span class="text-xs text-[#5E6470]">•</span>
                <span class="text-xs font-semibold text-[#8A8F98]">${formatProduct(g.productId)}</span>
                ${g.varietyId ? `<span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${g.varietyId === 'SAO_PAULO' ? 'bg-blue-950/50 text-blue-300 border border-blue-800/60' : 'bg-amber-950/50 text-amber-300 border border-amber-800/60'}">${g.varietyId}</span>` : ''}
              </div>
              <span class="text-xs font-mono font-semibold text-[#8A8F98] bg-[#121316] border border-[#22252A] px-2 py-0.5 rounded">
                ${g.totalBoxes} cjs en ${g.palletCount} palet(s)
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              ${palletsHTML}
            </div>
          </div>
        `;
      }).join('');
    }

    renderWarningsAndErrors(result) {
      const section = document.getElementById('warnings-errors-section');
      const printIncidences = document.getElementById('print-incidences-block');
      const errorsContainer = document.getElementById('errors-list-container');
      const warningsContainer = document.getElementById('warnings-list-container');

      const model = buildTruckSlotsModel(result);
      const criticalAlerts = model.criticalAlerts || [];

      // El panel #warnings-errors-section es la ÚNICA fuente visual oficial para incidencias.
      // Cualquier bloque secundario o duplicado externo permanece siempre oculto.
      if (printIncidences) {
        printIncidences.classList.add('hidden');
        printIncidences.innerHTML = '';
      }

      if (criticalAlerts.length === 0) {
        if (section) section.classList.add('hidden');
        return;
      }

      if (section) section.classList.remove('hidden');

      if (errorsContainer) {
        errorsContainer.innerHTML = criticalAlerts.map(alert => {
          const isInvariant = alert.code === 'TOTAL_ALLOCATION_INVARIANT_VIOLATION' ||
            (alert.code && alert.code.includes('INVARIANT_VIOLATION'));
          const isLockConflict = alert.code === 'LOCK_CONFLICT';

          let displayMessage = alert.message;
          let displayCode = alert.code || 'INCIDENCIA_EXPEDICION';

          if (isInvariant) {
            displayMessage = 'Error de cálculo. Revisar planificación.';
            displayCode = 'ERROR_PLANIFICACION';
          } else if (isLockConflict) {
            displayMessage = 'Esta asignación ya está bloqueada de otra forma.';
            displayCode = 'CONFLICTO';
          }

          return `
            <div class="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/60 text-rose-300 space-y-1 text-xs">
              <div class="flex items-center gap-2 font-bold text-xs">
                <span class="px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-200 font-mono text-[10px]">INCIDENCIA</span>
                <span class="font-mono text-rose-200">${escapeHtml(displayCode)}</span>
                ${alert.platform ? `<span class="text-rose-400 font-normal">| ${escapeHtml(alert.platform)}</span>` : ''}
              </div>
              <p class="font-medium text-rose-300">${escapeHtml(displayMessage)}</p>
              ${isInvariant ? `<p class="text-[10px] text-rose-400 font-mono italic">Detalle técnico: ${escapeHtml(alert.message)}</p>` : ''}
            </div>
          `;
        }).join('');
      }

      if (warningsContainer) {
        warningsContainer.innerHTML = '';
        const warnParent = warningsContainer.parentElement;
        if (warnParent) warnParent.classList.add('hidden');
      }
    }

    renderActionsToolbar(result) {
      const toolbar = document.getElementById('actions-toolbar');
      if (!toolbar) return;

      const hasValidPlan = Boolean(
        result &&
        result.allocations &&
        result.allocations.length > 0 &&
        result.demandSummary &&
        result.demandSummary.totalRequested > 0
      );

      if (hasValidPlan) {
        toolbar.classList.remove('hidden');
        const printDateEl = document.getElementById('print-delivery-date');
        const printTimeEl = document.getElementById('print-emission-time');
        if (printDateEl) {
          printDateEl.textContent = result.deliveryDate || (result.detectedDates && result.detectedDates[0]) || '--/--/----';
        }
        if (printTimeEl) {
          printTimeEl.textContent = new Date().toLocaleString('es-ES');
        }
      } else {
        toolbar.classList.add('hidden');
      }

      // FASE 18 · MOBILE SHELL: mantiene sincronizado el resumen móvil.
      this.renderMobileKpis(result);
    }

    /**
     * FASE 18 · MOBILE SHELL — refresca las fichas de contexto de la vista
     * "MÁS" (fecha de entrega y estado del plan) a partir del estado vigente.
     * @param {Object|null} result
     */
    syncMobileMoreContext(result) {
      if (typeof document === 'undefined') return;
      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      const deliveryDate = (result && (result.deliveryDate ||
        (result.detectedDates && result.detectedDates[0]))) || '--/--/----';
      setText('mm-delivery-date', deliveryDate);
      setText('mm-status', (result && this.state.planStatus) || 'SIN PLAN');
    }

    showToast(message, type = 'success') {
      const toast = document.getElementById('toast-action-feedback');
      if (!toast) return;

      toast.textContent = message;
      toast.className = 'mt-2.5 p-2.5 rounded-lg text-xs font-semibold text-center transition-all ';
      if (type === 'success') {
        toast.className += 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 shadow-sm';
      } else if (type === 'info') {
        toast.className += 'bg-[#16181B] border border-[#22252A] text-[#EDEDEF] shadow-sm';
      } else {
        toast.className += 'bg-rose-950/60 border border-rose-800/80 text-rose-300 shadow-sm';
      }
      toast.classList.remove('hidden');

      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 4000);
    }

    /**
     * TEMA: inicializa el tema al montar la UI.
     * Lee localStorage['planificador-theme']. Si es inválido o ausente → dark.
     * Aplica data-theme en <html> y sincroniza el botón.
     */
    initTheme() {
      if (typeof document === 'undefined') return;
      const stored = (typeof localStorage !== 'undefined')
        ? localStorage.getItem('planificador-theme')
        : null;
      const theme = (stored === 'light' || stored === 'dark') ? stored : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      this._updateThemeToggleUI(theme);
    }

    /**
     * Sincroniza el ícono y accesibilidad del botón toggle según el tema activo.
     */
    _updateThemeToggleUI(theme) {
      if (typeof document === 'undefined') return;
      const isDark = theme === 'dark';
      const label = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
      const icon = isDark ? '☀️' : '🌙';

      const updateBtn = (btn) => {
        if (!btn) return;
        btn.textContent = icon;
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
      };

      updateBtn(document.getElementById('btn-theme-toggle'));
      updateBtn(document.getElementById('btn-theme-toggle-desktop'));
      if (document.querySelectorAll) {
        try {
          const classBtns = document.querySelectorAll('.btn-theme-toggle');
          if (classBtns && classBtns.forEach) {
            classBtns.forEach(updateBtn);
          }
        } catch (_) {}
      }
    }

    /**
     * Alterna entre dark y light, persiste en localStorage y actualiza el botón.
     * NO modifica PlanningResult ni ninguna lógica de negocio.
     */
    toggleTheme() {
      if (typeof document === 'undefined') return;
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('planificador-theme', next);
      }
      this._updateThemeToggleUI(next);
    }

    handleCopyWhatsApp() {
      if (!this.state.planningResult) return;

      const text = formatWhatsAppMessage(this.state.planningResult, this.state.orders);
      const self = this;

      const onSuccess = () => {
        self.showToast('✓ Mensaje formateado para WhatsApp copiado al portapapeles. Listo para pegar.', 'success');
      };

      const onError = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          onSuccess();
        } catch (err) {
          self.showToast('⚠️ No se pudo copiar automáticamente. Por favor, revisa los permisos del portapapeles.', 'error');
        }
      };

      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(onError);
      } else {
        onError();
      }
    }

    handlePrint() {
      if (!this.state.planningResult || typeof window === 'undefined') return;

      this.renderPrintHeaderSummary(this.state.planningResult);
      const rawDate = this.state.planningResult.deliveryDate || (this.state.planningResult.detectedDates && this.state.planningResult.detectedDates[0]) || '';
      const dayOfWeek = rawDate ? getDayOfWeekName(rawDate) : '';
      const printDateEl = document.getElementById('print-delivery-date');
      const printTimeEl = document.getElementById('print-emission-time');
      if (printDateEl) {
        printDateEl.textContent = dayOfWeek ? `${dayOfWeek} ${rawDate}` : (rawDate || '--/--/----');
      }
      if (printTimeEl) {
        printTimeEl.textContent = new Date().toLocaleString('es-ES');
      }

      window.print();
    }

    handleGeneratePDF() {
      if (!this.state.planningResult || typeof window === 'undefined') return;

      // Resetear scroll para evitar captura de lienzo vacío en html2canvas
      window.scrollTo(0, 0);

      this.renderPrintHeaderSummary(this.state.planningResult);
      const dateStr = (this.state.planningResult.deliveryDate || 'expedicion').replace(/\//g, '-');

      const rawDate = this.state.planningResult.deliveryDate || (this.state.planningResult.detectedDates && this.state.planningResult.detectedDates[0]) || '';
      const dayOfWeek = rawDate ? getDayOfWeekName(rawDate) : '';
      const printDateEl = document.getElementById('print-delivery-date');
      const printTimeEl = document.getElementById('print-emission-time');
      if (printDateEl) {
        printDateEl.textContent = dayOfWeek ? `${dayOfWeek} ${rawDate}` : (rawDate || '--/--/----');
      }
      if (printTimeEl) {
        printTimeEl.textContent = new Date().toLocaleString('es-ES');
      }

      if (typeof window.html2pdf !== 'undefined') {
        const element = document.getElementById('results-column');
        const actionsToolbar = document.getElementById('actions-toolbar');
        const printHeader = document.getElementById('print-doc-header');
        const printSignatures = document.getElementById('print-signatures-block');
        const execSummary = document.getElementById('executive-summary-section');
        const warnSection = document.getElementById('warnings-errors-section');
        const compSection = document.getElementById('plan-comparison-section');
        const cardsContainer = document.getElementById('platform-plan-cards-container');

        const noPrintElements = element ? element.querySelectorAll('.no-print, details, #print-incidences-block') : [];
        noPrintElements.forEach(el => {
          el.classList.add('hidden');
          el.style.display = 'none';
        });

        if (actionsToolbar) { actionsToolbar.classList.add('hidden'); actionsToolbar.style.display = 'none'; }
        if (execSummary) { execSummary.classList.add('hidden'); execSummary.style.display = 'none'; }
        if (warnSection) { warnSection.classList.add('hidden'); warnSection.style.display = 'none'; }
        if (compSection) { compSection.classList.add('hidden'); compSection.style.display = 'none'; }
        if (printHeader) {
          printHeader.classList.remove('hidden');
          printHeader.style.display = 'block';
        }
        if (printSignatures) {
          printSignatures.classList.remove('hidden');
          printSignatures.style.display = 'grid';
        }

        const origGrid = cardsContainer ? cardsContainer.style.gridTemplateColumns : '';
        const origGap = cardsContainer ? cardsContainer.style.gap : '';
        if (cardsContainer) {
          cardsContainer.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
          cardsContainer.style.gap = '8px';
        }

        if (element) {
          element.classList.add('theme-pdf-export');
        }

        this.showToast('Generando Hoja de Plan de Carga en PDF (1 página A4)...', 'info');

        const opt = {
          margin: [6, 6, 6, 6],
          filename: `Plan_Carga_${dateStr}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        const restoreVisibility = () => {
          if (element) {
            element.classList.remove('theme-pdf-export');
          }
          if (cardsContainer) {
            cardsContainer.style.gridTemplateColumns = origGrid;
            cardsContainer.style.gap = origGap;
          }
          if (printHeader) {
            printHeader.classList.add('hidden');
            printHeader.style.display = '';
          }
          if (printSignatures) {
            printSignatures.classList.add('hidden');
            printSignatures.style.display = '';
          }
          if (actionsToolbar) {
            actionsToolbar.classList.remove('hidden');
            actionsToolbar.style.display = '';
          }
          if (execSummary) {
            execSummary.classList.remove('hidden');
            execSummary.style.display = '';
          }
          noPrintElements.forEach(el => {
            if (el.id !== 'print-incidences-block') {
              el.classList.remove('hidden');
              el.style.display = '';
            }
          });
          if (warnSection && self.state.planningResult) {
            const m = buildTruckSlotsModel(self.state.planningResult);
            if (m.criticalAlerts && m.criticalAlerts.length > 0) {
              warnSection.classList.remove('hidden');
              warnSection.style.display = '';
            }
          }
        };

        const self = this;
        window.html2pdf().set(opt).from(element).save().then(() => {
          restoreVisibility();
          self.showToast('✓ Hoja de Plan de Carga descargada en PDF (1 página).', 'success');
        }).catch((err) => {
          console.error('Error generando PDF con html2pdf:', err);
          restoreVisibility();
          window.print();
        });
      } else {
        this.showToast('Abriendo vista de impresión (selecciona "Guardar como PDF")...', 'info');
        window.print();
      }
    }
  }

  UIController.formatWhatsAppMessage = formatWhatsAppMessage;
  UIController.buildTruckSlotsModel = buildTruckSlotsModel;
  UIController.comparePlanningResults = comparePlanningResults;
  UIController.computeServedTotalsByArticle = computeServedTotalsByArticle;
  UIController.getDayOfWeekName = getDayOfWeekName;
  UIController.formatDateWithDay = formatDateWithDay;
  UIController.derivePlatformProvenance = derivePlatformProvenance;
  UIController.getProvenanceBadgeHTML = getProvenanceBadgeHTML;

  // FASE 18 · MOBILE SHELL: helpers de presentación expuestos para los tests
  // de paridad Desktop vs Mobile. Siguen siendo funciones puras de formato.
  UIController.getMobileProductName = getMobileProductName;
  UIController.getMobileVarietyName = getMobileVarietyName;
  UIController.MOBILE_VIEWS = MOBILE_VIEWS;

  // Si estamos en entorno navegador, auto-inicializar al cargar el DOM
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      const appState = new AppState();
      const uiController = new UIController(appState);
      window.appState = appState;
      window.uiController = uiController;
      uiController.bindDOM();

      if (window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const autoKey = urlParams.get('autoload');
        if (autoKey === '18sep' || autoKey === '1') {
          const tsvInput = document.getElementById('tsv-input');
          if (tsvInput) {
            tsvInput.value = DATASETS['18_SEP'];
            uiController.handleAnalyze();
            uiController.fillStock({
              'PERA_RAMA': 320,
              'COCKTAIL_ROMANTICO::SAO_PAULO': 59,
              'COCKTAIL_ROMANTICO::SUNSTREAM': 43,
              'CHERRY_RAMA::SUNSTREAM': 100
            });
            uiController.handleGeneratePlan();
          }
        }
      }
    });
  }

  return {
    VERSION: '1.0.0',
    AppState,
    UIController,
    DATASETS,
    formatWhatsAppMessage,
    buildTruckSlotsModel,
    comparePlanningResults,
    computeServedTotalsByArticle,
    getMobileProductName,
    getMobileVarietyName,
    MOBILE_VIEWS,
    getDayOfWeekName,
    formatDateWithDay,
    getBasePlatform,
    getProductVarietyDisplay,
    derivePlatformProvenance,
    getProvenanceBadgeHTML
  };
});

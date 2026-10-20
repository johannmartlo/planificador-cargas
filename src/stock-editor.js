/**
 * V4.8.2 — Editor de stock.
 *
 * Lógica pura (sin DOM) para validar claves y cantidades de stock y para
 * persistirlas en el almacenamiento local del navegador.
 *
 * Clave de identificación real (la misma que consume el motor):
 *   productId::varietyId   ->   varietyId = STANDARD cuando no hay variedad
 *
 * En el objeto `stock` de la UI se conserva la forma histórica sin `::` cuando
 * no hay variedad (`PERA_RAMA`), y con `::VARIEDAD` cuando la hay
 * (`COCKTAIL_ROMANTICO::CONSABOR`). Ambas formas se normalizan a la clave
 * canónica para detectar duplicados.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticsStockEditor = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'planificador-stock-v1';

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value === undefined || value === null ? '' : value).trim();
  }

  function parseStockKey(stockKey) {
    const raw = text(stockKey);
    if (!raw) return null;
    const idx = raw.indexOf('::');
    if (idx === -1) {
      return { productId: raw.toUpperCase(), varietyId: null };
    }
    const productId = raw.slice(0, idx).trim().toUpperCase();
    const rawVariety = raw.slice(idx + 2).trim().toUpperCase();
    const varietyId = (!rawVariety || rawVariety === 'STANDARD' || rawVariety === 'NULL')
      ? null
      : rawVariety;
    if (!productId) return null;
    return { productId, varietyId };
  }

  function canonicalStockKey(productId, varietyId) {
    return `${text(productId).toUpperCase()}::${varietyId ? text(varietyId).toUpperCase() : 'STANDARD'}`;
  }

  /**
   * Identidad que usará el motor para una clave. Si la clave es plana y el
   * artículo tiene variedad por defecto (o una única variedad), el motor la
   * resuelve a esa variedad; la identidad debe reflejarlo para no duplicar.
   */
  function resolveStockIdentity(stockKey, catalogConfig) {
    const parsed = parseStockKey(stockKey);
    if (!parsed) return null;
    const products = (catalogConfig && catalogConfig.products) || {};
    const product = products[parsed.productId] || null;
    let varietyId = parsed.varietyId;
    if (!varietyId && product) {
      if (product.defaultVarietyId) {
        varietyId = product.defaultVarietyId;
      } else if (Array.isArray(product.varieties) && product.varieties.length === 1) {
        varietyId = product.varieties[0].id;
      }
    }
    return {
      productId: parsed.productId,
      varietyId,
      canonicalKey: canonicalStockKey(parsed.productId, varietyId)
    };
  }

  /**
   * Clave que se guarda en `AppState.stock`: conserva la forma histórica
   * (`PERA_RAMA`) cuando no hay variedad y usa `::` cuando la hay.
   */
  function makeStockKey(productId, varietyId) {
    const cleanProduct = text(productId).toUpperCase();
    const cleanVariety = text(varietyId).toUpperCase();
    return cleanVariety ? `${cleanProduct}::${cleanVariety}` : cleanProduct;
  }

  function normalizeQuantity(value, options = {}) {
    if (value === null || value === undefined || text(value) === '') {
      return {
        ok: false,
        code: 'INVALID_STOCK_EMPTY',
        message: 'Introduce una cantidad de cajas.'
      };
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        code: 'INVALID_STOCK_NAN',
        message: 'La cantidad debe ser un número entero de cajas.'
      };
    }
    if (!Number.isInteger(n)) {
      return {
        ok: false,
        code: 'INVALID_STOCK_DECIMAL',
        message: 'La cantidad debe ser un número entero de cajas; no se admiten decimales.'
      };
    }
    if (n < 0) {
      return {
        ok: false,
        code: 'INVALID_STOCK_NEGATIVE',
        message: 'La cantidad no puede ser negativa.'
      };
    }
    if (!Number.isSafeInteger(n)) {
      return {
        ok: false,
        code: 'INVALID_STOCK_TOO_LARGE',
        message: 'La cantidad es demasiado grande.'
      };
    }
    if (options.positive && n <= 0) {
      return {
        ok: false,
        code: 'INVALID_STOCK_NON_POSITIVE',
        message: 'La cantidad debe ser mayor que cero para añadir una existencia.'
      };
    }
    return { ok: true, value: n };
  }

  function validateStockObject(stock, catalogConfig) {
    if (!isPlainObject(stock)) {
      return {
        ok: false,
        errors: [{ code: 'INVALID_STOCK_OBJECT', message: 'El stock debe ser un objeto de claves y cantidades.' }]
      };
    }
    const errors = [];
    const seen = new Set();
    for (const [key, value] of Object.entries(stock)) {
      const parsed = parseStockKey(key);
      if (!parsed) {
        errors.push({
          code: 'INVALID_STOCK_KEY',
          message: `La clave de stock '${key}' no es válida.`
        });
        continue;
      }
      const identity = resolveStockIdentity(key, catalogConfig);
      const canonical = identity
        ? identity.canonicalKey
        : canonicalStockKey(parsed.productId, parsed.varietyId);
      if (seen.has(canonical)) {
        errors.push({
          code: 'DUPLICATE_STOCK_KEY',
          message: `Hay más de una línea para la misma clave de stock (${canonical}).`
        });
      } else {
        seen.add(canonical);
      }
      const qty = normalizeQuantity(value);
      if (!qty.ok) {
        errors.push({
          code: qty.code,
          message: `Stock inválido para '${key}': ${qty.message}`
        });
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /**
   * Carga el stock local. Si el contenido guardado es inválido se usa el stock
   * por defecto y se devuelve un error comprensible (nunca se lanza).
   */
  function loadStock(defaultStock, storage, catalogConfig) {
    const fallback = clone(isPlainObject(defaultStock) ? defaultStock : {});
    if (!storage) {
      return { data: fallback, source: 'default', error: null };
    }
    let raw = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (err) {
      return {
        data: fallback,
        source: 'default',
        error: { code: 'STORAGE_UNAVAILABLE', message: 'El almacenamiento local no está disponible.' }
      };
    }
    if (!raw) {
      return { data: fallback, source: 'default', error: null };
    }
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return {
        data: fallback,
        source: 'default',
        error: { code: 'INVALID_LOCAL_STOCK', message: 'El stock local guardado no es JSON válido.' }
      };
    }
    const validation = validateStockObject(parsed, catalogConfig);
    if (!validation.ok) {
      return {
        data: fallback,
        source: 'default',
        error: {
          code: 'INVALID_LOCAL_STOCK',
          message: 'El stock local guardado no es válido; se usa el stock por defecto.',
          errors: validation.errors
        }
      };
    }
    const normalized = { ...fallback };
    for (const [key, value] of Object.entries(parsed)) {
      const identity = resolveStockIdentity(key, catalogConfig);
      if (!identity) continue;
      normalized[makeStockKey(identity.productId, identity.varietyId)] = value;
    }
    return {
      data: normalized,
      source: 'local',
      error: null
    };
  }

  function saveStock(stock, storage, catalogConfig) {
    if (!storage) {
      return {
        ok: false,
        code: 'STORAGE_UNAVAILABLE',
        errors: [{ code: 'STORAGE_UNAVAILABLE', message: 'No hay almacenamiento local; el stock no se ha guardado.' }]
      };
    }
    const validation = validateStockObject(stock, catalogConfig);
    if (!validation.ok) {
      return { ok: false, code: 'INVALID_STOCK_OBJECT', errors: validation.errors };
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(stock));
    } catch (err) {
      return {
        ok: false,
        code: 'STORAGE_WRITE_FAILED',
        errors: [{ code: 'STORAGE_WRITE_FAILED', message: 'No se pudo escribir el stock en el almacenamiento local.' }]
      };
    }
    return { ok: true };
  }

  function entryMeta(stockKey, catalogConfig) {
    const parsed = parseStockKey(stockKey);
    if (!parsed) {
      return { productId: '', varietyId: null, product: null, variety: null, status: 'INVALID' };
    }
    const products = (catalogConfig && catalogConfig.products) || {};
    const product = products[parsed.productId] || null;
    const identity = resolveStockIdentity(stockKey, catalogConfig);
    const effectiveVarietyId = identity ? identity.varietyId : parsed.varietyId;
    const variety = product && Array.isArray(product.varieties)
      ? product.varieties.find(v => v.id === effectiveVarietyId) || null
      : null;
    return {
      productId: parsed.productId,
      varietyId: effectiveVarietyId,
      product,
      variety,
      status: product ? (product.status || 'ACTIVE') : 'MISSING'
    };
  }

  function hasDuplicate(stock, productId, varietyId, catalogConfig) {
    const wanted = canonicalStockKey(productId, varietyId);
    return Object.keys(stock || {}).some(key => {
      const identity = resolveStockIdentity(key, catalogConfig);
      return identity && identity.canonicalKey === wanted;
    });
  }

  /**
   * Valida una línea nueva de stock contra el catálogo actual y el stock ya
   * existente. No muta nada.
   */
  function validateNewEntry(entry, catalogConfig, currentStock) {
    const productId = text(entry && entry.productId).toUpperCase();
    if (!productId) {
      return { ok: false, errors: [{ code: 'MISSING_ARTICLE', message: 'Selecciona un artículo.' }] };
    }
    const products = (catalogConfig && catalogConfig.products) || {};
    const product = products[productId];
    if (!product) {
      return {
        ok: false,
        errors: [{ code: 'UNKNOWN_ARTICLE', message: `El artículo ${productId} no existe en el catálogo actual.` }]
      };
    }
    if ((product.status || 'ACTIVE') !== 'ACTIVE') {
      return {
        ok: false,
        errors: [{ code: 'INACTIVE_ARTICLE', message: `El artículo ${productId} está inactivo y no puede recibir nuevas existencias.` }]
      };
    }

    let varietyId = text(entry && entry.varietyId).toUpperCase() || null;
    const varieties = Array.isArray(product.varieties) ? product.varieties : [];
    if (varietyId) {
      if (!varieties.some(v => v.id === varietyId)) {
        return {
          ok: false,
          errors: [{ code: 'UNKNOWN_VARIETY', message: `La variedad ${varietyId} no pertenece a ${productId}.` }]
        };
      }
    } else if (product.defaultVarietyId) {
      varietyId = product.defaultVarietyId;
    } else if (varieties.length === 1) {
      varietyId = varieties[0].id;
    } else if (varieties.length > 1) {
      return {
        ok: false,
        errors: [{ code: 'MISSING_VARIETY', message: `Selecciona una variedad para ${productId}.` }]
      };
    }

    const qty = normalizeQuantity(entry && entry.quantity, { positive: true });
    if (!qty.ok) {
      return { ok: false, errors: [{ code: qty.code, message: qty.message }] };
    }
    if (hasDuplicate(currentStock, productId, varietyId, catalogConfig)) {
      return {
        ok: false,
        errors: [{
          code: 'DUPLICATE_STOCK_KEY',
          message: `Ya existe una línea de stock para ${productId}${varietyId ? ' / ' + varietyId : ''}.`
        }]
      };
    }

    return {
      ok: true,
      productId,
      varietyId,
      quantity: qty.value,
      stockKey: makeStockKey(productId, varietyId),
      canonicalKey: canonicalStockKey(productId, varietyId)
    };
  }

  return {
    STORAGE_KEY,
    parseStockKey,
    canonicalStockKey,
    makeStockKey,
    normalizeQuantity,
    validateStockObject,
    loadStock,
    saveStock,
    entryMeta,
    hasDuplicate,
    validateNewEntry
  };
});

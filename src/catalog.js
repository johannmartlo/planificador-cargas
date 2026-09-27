/**
 * Catálogo de Productos y Plataformas para el Planificador de Carga Hortofrutícola
 *
 * Módulo independiente y configurable.
 * Permite ampliar productos, códigos GIS, variedades y plataformas sin alterar la lógica del parser.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticsCatalog = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_CATALOG = {
    platforms: {
      canonical: ['CENTRO', 'CATALUÑA', 'LEVANTE', 'SUR', 'SANTANDER', 'MALAGA'],
      aliases: {
        'CENTRO': 'CENTRO',
        'CATALUÑA': 'CATALUÑA',
        'CATALUNA': 'CATALUÑA',
        'CATALUNYA': 'CATALUÑA',
        'LEVANTE': 'LEVANTE',
        'SUR': 'SUR',
        'SANTANDER': 'SANTANDER',
        'MALAGA': 'MALAGA',
        'MÁLAGA': 'MALAGA'
      }
    },
    products: {
      PERA_RAMA: {
        id: 'PERA_RAMA',
        name: 'TOMATE PERA RAMA',
        gisCodes: ['14072'],
        matchRegex: /PERA\s*RAMA/i,
        hasMonovarietalRestriction: false,
        varieties: [],
        detectVariety: function () {
          return null; // Pera Rama es monoproducto estándar en previsión
        }
      },
      COCKTAIL_ROMANTICO: {
        id: 'COCKTAIL_ROMANTICO',
        name: 'TOMATE COCKTAIL ROMÁNTICO',
        gisCodes: ['16228'],
        matchRegex: /COCKT.*ROMANT/i,
        hasMonovarietalRestriction: true,
        // Variedades físicas internas del Cocktail Romántico (un solo artículo comercial, GIS 16228).
        // - CONSABOR: variedad activa actualmente (mismo formato físico que el Cocktail 300 existente).
        // - SUNSTREAM: variedad existente, sin stock operativo en la actualidad.
        // - SAO_PAULO: variedad histórica, sin stock operativo en la actualidad (no eliminar: compatibilidad).
        // El orden de esta lista es el único desempate neutro por defecto del solver cuando varias
        // variedades tienen stock simultáneo. La prioridad empresarial CONSABOR vs SUNSTREAM está PENDIENTE
        // de definición y no se inventa aquí.
        varieties: [
          { id: 'CONSABOR', name: 'Consabor', isOldLot: false, fifoPriority: 2 },
          { id: 'SAO_PAULO', name: 'Sao Paulo', isOldLot: true, fifoPriority: 1 },
          { id: 'SUNSTREAM', name: 'Sunstream', isOldLot: false, fifoPriority: 2 }
        ],
        detectVariety: function () {
          // REGLA OBLIGATORIA: No inferir variedad física de Cocktail en la previsión original.
          // varietyId = null en la OrderLine. Se asignará en almacén según stock y FIFO.
          return null;
        }
      },
      CHERRY_RAMA: {
        id: 'CHERRY_RAMA',
        name: 'TOMATE CHERRY RAMA SUNSTREAM',
        gisCodes: ['18746'],
        matchRegex: /CHERRY\s*RAMA/i,
        hasMonovarietalRestriction: false,
        varieties: [
          { id: 'SUNSTREAM', name: 'Sunstream', isOldLot: false, fifoPriority: 1 }
        ],
        detectVariety: function (description) {
          // Producto independiente. SUNSTREAM pertenece al contexto de CHERRY_RAMA.
          if (/SUNSTREAM/i.test(description)) {
            return 'SUNSTREAM';
          }
          return null;
        }
      }
    }
  };

  /**
   * Genera un identificador único de stock basado en la tupla (productId, varietyId).
   * @param {string} productId
   * @param {string|null} varietyId
   * @returns {string}
   */
  function getStockKey(productId, varietyId) {
    return `${productId}::${varietyId || 'STANDARD'}`;
  }

  /**
   * Crea un registro de stock con clave compuesta.
   * @param {string} productId
   * @param {string|null} varietyId
   * @param {number} availableQuantity
   * @param {Object} [extra]
   * @returns {{ productId: string, varietyId: string|null, availableQuantity: number, stockKey: string }}
   */
  function createStockItem(productId, varietyId, availableQuantity, extra = {}) {
    return {
      productId,
      varietyId: varietyId || null,
      availableQuantity: Math.max(0, Math.floor(Number(availableQuantity) || 0)),
      stockKey: getStockKey(productId, varietyId),
      ...extra
    };
  }

  /**
   * Devuelve las variedades físicas registradas de un producto comercial.
   * @param {string} productId
   * @param {Object} [catalog]
   * @returns {Array<{id: string, name: string, isOldLot: boolean, fifoPriority: number}>}
   */
  function getProductVarieties(productId, catalog = DEFAULT_CATALOG) {
    const products = (catalog && catalog.products) || DEFAULT_CATALOG.products;
    const prod = products[String(productId || '').trim().toUpperCase()];
    if (!prod || !Array.isArray(prod.varieties)) return [];
    return prod.varieties.slice();
  }

  /**
   * Busca la definición de una variedad física dentro de un producto comercial.
   * @param {string} productId
   * @param {string} varietyId
   * @param {Object} [catalog]
   * @returns {Object|null}
   */
  function findVariety(productId, varietyId, catalog = DEFAULT_CATALOG) {
    if (!varietyId) return null;
    const wanted = String(varietyId).trim().toUpperCase();
    return getProductVarieties(productId, catalog).find(v => v.id === wanted) || null;
  }

  /**
   * Normaliza el texto de una plataforma a su nombre canónico oficial.
   * @param {string} rawPlatform
   * @param {Object} [catalog]
   * @returns {string}
   */
  function normalizePlatform(rawPlatform, catalog = DEFAULT_CATALOG) {
    if (!rawPlatform || typeof rawPlatform !== 'string') return '';

    const clean = rawPlatform.trim().toUpperCase();
    const aliases = (catalog.platforms && catalog.platforms.aliases) || DEFAULT_CATALOG.platforms.aliases;

    if (aliases[clean]) {
      return aliases[clean];
    }

    // Normalización fonética/tildes preservando la Ñ
    const normalizedNFD = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, function (m) {
      return m === '\u0303' ? '\u0303' : '';
    });

    if (aliases[normalizedNFD]) {
      return aliases[normalizedNFD];
    }

    return clean;
  }

  /**
   * Identifica el producto en base al GIS (prioritario) o la descripción.
   * @param {string} gisCode
   * @param {string} description
   * @param {Object} [catalog]
   * @returns {{ productId: string, productName: string, varietyId: string|null }}
   */
  function identifyProduct(gisCode, description, catalog = DEFAULT_CATALOG) {
    const products = (catalog && catalog.products) || DEFAULT_CATALOG.products;

    // 1. Prioridad absoluta: Búsqueda por código numérico GIS
    if (gisCode) {
      for (const [key, prod] of Object.entries(products)) {
        if (prod.gisCodes && prod.gisCodes.includes(String(gisCode))) {
          const varietyId = typeof prod.detectVariety === 'function'
            ? prod.detectVariety(description)
            : null;

          return {
            productId: prod.id || key,
            productName: prod.name || key,
            varietyId
          };
        }
      }
    }

    // 2. Fallback secundario: Búsqueda por expresión regular en descripción
    if (description) {
      for (const [key, prod] of Object.entries(products)) {
        if (prod.matchRegex && prod.matchRegex.test(description)) {
          const varietyId = typeof prod.detectVariety === 'function'
            ? prod.detectVariety(description)
            : null;

          return {
            productId: prod.id || key,
            productName: prod.name || key,
            varietyId
          };
        }
      }
    }

    return {
      productId: 'UNKNOWN',
      productName: description || 'PRODUCTO DESCONOCIDO',
      varietyId: null
    };
  }

  return {
    DEFAULT_CATALOG,
    normalizePlatform,
    identifyProduct,
    getStockKey,
    createStockItem,
    getProductVarieties,
    findVariety
  };
});

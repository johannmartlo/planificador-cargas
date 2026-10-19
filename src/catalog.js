/**
 * Catálogo de Productos y Plataformas para el Planificador de Carga Hortofrutícola
 *
 * V4.7: los datos viven en `catalog/catalog.json` (fuente de verdad) y se
 * materializan en `src/catalog-data.js` mediante `tools/build-catalog.js`.
 * Este módulo sigue exponiendo la API pública histórica (DEFAULT_CATALOG,
 * identifyProduct, getProductVarieties, ...) construida desde esos datos, de
 * modo que parser, orquestador, UI y pruebas no cambian de contrato.
 *
 * Módulo independiente y configurable: admite productos, códigos GIS,
 * variedades y plataformas sin alterar la lógica del parser.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./catalog-data.js'));
  } else {
    root.LogisticsCatalog = factory(root.LogisticsCatalogData);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CATALOG_DATA) {
  'use strict';

  if (!CATALOG_DATA || !Array.isArray(CATALOG_DATA.articles)) {
    throw new Error(
      'LogisticsCatalog: no se ha cargado catalog-data.js. ' +
      'Debe incluirse antes de catalog.js y regenerarse con tools/build-catalog.js.'
    );
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function compilePattern(pattern) {
    return new RegExp(pattern.value, pattern.flags || 'i');
  }

  function compilePatterns(article) {
    const defs = (article.identification && article.identification.patterns) || [];
    return defs.map(compilePattern);
  }

  /**
   * Constructor de la función histórica detectVariety a partir de la regla
   * declarativa del catálogo (sin funciones en los datos).
   */
  function buildVarietyDetector(article) {
    const detection = article.identification && article.identification.varietyDetection;
    if (detection && detection.mode === 'DESCRIPTION_PATTERN' && detection.pattern && detection.varietyId) {
      const re = new RegExp(detection.pattern, detection.flags || 'i');
      return function (description) {
        re.lastIndex = 0;
        return re.test(String(description || '')) ? detection.varietyId : null;
      };
    }
    return function () {
      return null;
    };
  }

  /**
   * Convierte la definición declarativa de un artículo en la regla de
   * paletización que consume palletizer.js (misma forma que la histórica).
   */
  function buildPalletRules(article) {
    const rules = {};
    const box = article.box || {};
    const formats = (article.palletization && article.palletization.formats) || {};
    Object.keys(formats).forEach(formatName => {
      const format = formats[formatName];
      rules[formatName] = {
        productId: article.id,
        palletType: formatName,
        boxLength: box.lengthMm,
        boxWidth: box.widthMm,
        boxHeight: box.heightMm,
        boxHeightMm: box.heightMm,
        palletLength: format.palletLengthMm,
        palletWidth: format.palletWidthMm,
        palletHeight: format.palletHeightMm,
        boxesPerLayer: format.boxesPerLayer,
        maxLayers: format.maxLayers,
        maxStandardBoxes: format.boxesPerLayer * format.maxLayers,
        layerPattern: format.layerPattern,
        capacitySource: format.capacitySource,
        verified: format.verified,
        isRigid: format.isRigid,
        name: format.name
      };
    });
    return rules;
  }

  /**
   * Salvaguarda opcional para overrides manuales de formato.
   * No impone ningún umbral por defecto: solo evita forzar METROCHEP por debajo
   * de la capacidad EURO cuando el artículo lo declara explícitamente.
   */
  function buildOverrideGuard(article) {
    const guard = (article.palletization && article.palletization.overrideGuard) || {};
    return {
      blockMetrochepBelowEuroCapacity: Boolean(guard.blockMetrochepBelowEuroCapacity)
    };
  }

  /**
   * Construye un catálogo completo a partir de datos declarativos.
   * @param {Object} data Estructura de catalog.json.
   * @returns {Object} Catálogo con `products`, `palletRules` y `palletGuards`.
   */
  function buildCatalog(data) {
    const products = {};
    const palletRules = {};
    const palletGuards = {};

    (data.articles || []).forEach(article => {
      const patterns = compilePatterns(article);
      const product = {
        // --- Compatibilidad histórica ---------------------------------------
        id: article.id,
        name: article.name,
        gisCodes: (article.identification && article.identification.gisCodes || []).slice(),
        matchRegex: patterns[0] || null,
        hasMonovarietalRestriction: Boolean(article.hasMonovarietalRestriction),
        varieties: (article.varieties || []).map(v => ({ ...v })),
        detectVariety: buildVarietyDetector(article),
        // --- Datos declarativos ---------------------------------------------
        status: article.status || 'ACTIVE',
        shortName: article.shortName,
        matchRegexes: patterns,
        identification: clone(article.identification || {}),
        stockAliases: { ...(article.stockAliases || {}) },
        defaultVarietyId: article.defaultVarietyId === undefined ? null : article.defaultVarietyId,
        box: { ...(article.box || {}) },
        palletization: clone(article.palletization || {}),
        planning: { ...(article.planning || {}) },
        audit: article.audit ? clone(article.audit) : null
      };

      products[article.id] = product;
      palletRules[article.id] = buildPalletRules(article);
      palletGuards[article.id] = buildOverrideGuard(article);
    });

    return {
      schemaVersion: data.schemaVersion,
      catalogVersion: data.catalogVersion,
      globals: { ...(data.globals || {}) },
      platforms: clone(data.platforms || { canonical: [], aliases: {} }),
      products,
      articles: clone(data.articles || []),
      palletRules,
      palletGuards
    };
  }

  const DEFAULT_CATALOG = buildCatalog(CATALOG_DATA);

  /**
   * Genera un identificador único de stock basado en la tupla (productId, varietyId).
   */
  function getStockKey(productId, varietyId) {
    return `${productId}::${varietyId || 'STANDARD'}`;
  }

  /**
   * Crea un registro de stock con clave compuesta.
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
   * Devuelve la definición de un artículo (producto comercial).
   */
  function getArticle(productId, catalog = DEFAULT_CATALOG) {
    const products = (catalog && catalog.products) || DEFAULT_CATALOG.products;
    const key = String(productId || '').trim().toUpperCase();
    return products[key] || null;
  }

  /**
   * Variedades físicas registradas de un producto comercial.
   */
  function getProductVarieties(productId, catalog = DEFAULT_CATALOG) {
    const product = getArticle(productId, catalog);
    if (!product || !Array.isArray(product.varieties)) return [];
    return product.varieties.slice();
  }

  /**
   * Busca la definición de una variedad física dentro de un producto comercial.
   */
  function findVariety(productId, varietyId, catalog = DEFAULT_CATALOG) {
    if (!varietyId) return null;
    const wanted = String(varietyId).trim().toUpperCase();
    return getProductVarieties(productId, catalog).find(v => v.id === wanted) || null;
  }

  /**
   * Reglas de paletización del catálogo (productId -> formato -> regla).
   */
  function getPalletRules(catalog = DEFAULT_CATALOG) {
    if (catalog && catalog.palletRules) return catalog.palletRules;
    return buildCatalog({ articles: Object.values((catalog && catalog.products) || {}) }).palletRules;
  }

  /**
   * Salvaguardas de override manual por artículo (sin umbrales obligatorios).
   */
  function getPalletGuards(catalog = DEFAULT_CATALOG) {
    if (catalog && catalog.palletGuards) return catalog.palletGuards;
    return {};
  }

  /**
   * Resuelve una clave de stock "suelta" (sin `::`) a (productId, varietyId)
   * usando los alias declarados y las variedades por defecto del catálogo.
   *
   * Semántica preservada de V4.6:
   *  - Alias explícitos (CONSABOR, SAO_PAULO, SUNSTREAM) -> Cocktail.
   *  - Id de artículo con una sola variedad -> esa variedad (Cherry).
   *  - Id de artículo sin variedades -> sin variedad (Pera).
   *  - Id de artículo con varias variedades y sin alias -> sin variedad.
   *
   * @returns {{productId: string, varietyId: string|null}|null}
   */
  function resolveStockSelection(rawKey, catalog = DEFAULT_CATALOG) {
    const key = String(rawKey || '').trim().toUpperCase();
    if (!key) return null;
    const products = (catalog && catalog.products) || DEFAULT_CATALOG.products;

    // 1. Alias explícitos de variedad suelta.
    for (const product of Object.values(products)) {
      if (product.stockAliases && Object.prototype.hasOwnProperty.call(product.stockAliases, key)) {
        return { productId: product.id, varietyId: product.stockAliases[key] };
      }
    }

    // 2. Id de artículo.
    const product = products[key];
    if (product) {
      if (product.defaultVarietyId) {
        return { productId: product.id, varietyId: product.defaultVarietyId };
      }
      if (Array.isArray(product.varieties) && product.varieties.length === 1) {
        return { productId: product.id, varietyId: product.varieties[0].id };
      }
      return { productId: product.id, varietyId: null };
    }

    return null;
  }

  /**
   * Normaliza el texto de una plataforma a su nombre canónico oficial.
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

  function detectVarietyFor(product, description) {
    return typeof product.detectVariety === 'function'
      ? product.detectVariety(description)
      : null;
  }

  function matchByDescription(product, description) {
    const regexes = (product.matchRegexes && product.matchRegexes.length)
      ? product.matchRegexes
      : (product.matchRegex ? [product.matchRegex] : []);
    return regexes.some(re => {
      if (!re) return false;
      re.lastIndex = 0;
      return re.test(description);
    });
  }

  /**
   * Identifica el producto de una línea de pedido.
   *
   * Reglas V4.7 (identificación segura):
   *  - GIS conocido y único -> artículo (aunque la descripción no coincida).
   *  - GIS conocido pero de artículo INACTIVE -> error INACTIVE_ARTICLE.
   *  - GIS presente y desconocido -> UNKNOWN_PRODUCT (NO se recurre a la
   *    descripción; evita clasificaciones silenciosas por coincidencia textual).
   *  - GIS ausente + una única descripción coincidente -> artículo.
   *  - GIS ausente + varias coincidencias -> AMBIGUOUS_PRODUCT.
   *  - Sin coincidencias -> UNKNOWN_PRODUCT.
   *
   * @returns {{productId: string, productName: string, varietyId: string|null,
   *            errorCode?: string, candidates?: string[]}}
   */
  function identifyProduct(gisCode, description, catalog = DEFAULT_CATALOG) {
    const products = (catalog && catalog.products) || DEFAULT_CATALOG.products;
    const all = Object.values(products);
    const active = all.filter(p => p.status !== 'INACTIVE');
    const unknown = (errorCode, candidates) => ({
      productId: 'UNKNOWN',
      productName: description || 'PRODUCTO DESCONOCIDO',
      varietyId: null,
      errorCode,
      ...(candidates ? { candidates } : {})
    });

    // 1. Prioridad absoluta: código GIS.
    if (gisCode) {
      const gis = String(gisCode).trim();
      const matches = all.filter(p => (p.gisCodes || []).indexOf(gis) !== -1);

      if (matches.length === 1) {
        const product = matches[0];
        if (product.status === 'INACTIVE') {
          return {
            productId: 'UNKNOWN',
            productName: product.name,
            varietyId: null,
            errorCode: 'INACTIVE_ARTICLE',
            articleId: product.id
          };
        }
        return {
          productId: product.id,
          productName: product.name,
          varietyId: detectVarietyFor(product, description)
        };
      }

      if (matches.length > 1) {
        return unknown('AMBIGUOUS_PRODUCT', matches.map(p => p.id));
      }

      // GIS presente pero desconocido: nunca se reclasifica por descripción.
      return unknown('UNKNOWN_PRODUCT');
    }

    // 2. Sin GIS: identificación por descripción (solo artículos activos).
    if (description) {
      const matches = active.filter(p => matchByDescription(p, description));

      if (matches.length === 1) {
        const product = matches[0];
        return {
          productId: product.id,
          productName: product.name,
          varietyId: detectVarietyFor(product, description)
        };
      }

      if (matches.length > 1) {
        return unknown('AMBIGUOUS_PRODUCT', matches.map(p => p.id));
      }
    }

    return unknown('UNKNOWN_PRODUCT');
  }

  return {
    DEFAULT_CATALOG,
    buildCatalog,
    getArticle,
    getPalletRules,
    getPalletGuards,
    resolveStockSelection,
    normalizePlatform,
    identifyProduct,
    getStockKey,
    createStockItem,
    getProductVarieties,
    findVariety
  };
});

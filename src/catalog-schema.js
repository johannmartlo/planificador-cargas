/**
 * Validador puro del catálogo de artículos (V4.7).
 *
 * Módulo independiente del DOM y de cualquier persistencia. Comprueba la
 * estructura y las invariantes físicas y de identificación del catálogo antes
 * de que el motor lo consuma o de que se guarde un cambio.
 *
 * Uso:
 *   const { validateCatalog } = require('./catalog-schema.js');
 *   const result = validateCatalog(catalogData);
 *   // result = { valid, errors: [{code, path, message}], warnings: [...] }
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticsCatalogSchema = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const ALLOWED_STATUS = ['ACTIVE', 'INACTIVE'];
  const ALLOWED_FORMATS = ['EURO', 'METROCHEP'];
  const ALLOWED_STRATEGIES = ['HAMILTON', 'MONOVARIETAL_FIFO'];
  const DEFAULTS = {
    palletWoodHeightMm: 144,
    maxTowerHeightMm: 2278,
    maxPalletsPerTower: 3
  };

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim() !== '';
  }

  function isPosInt(v) {
    return typeof v === 'number' && Number.isInteger(v) && v > 0;
  }

  function pushError(errors, code, path, message) {
    errors.push({ code, path, message });
  }

  function compilePattern(pattern) {
    return new RegExp(pattern.value, pattern.flags || '');
  }

  /**
   * @param {Object} data Catálogo completo (catalog.json).
   * @param {Object} [options]
   * @returns {{ valid: boolean, errors: Array, warnings: Array }}
   */
  function validateCatalog(data, options = {}) {
    const errors = [];
    const warnings = [];
    const globals = {
      palletWoodHeightMm: options.palletWoodHeightMm || DEFAULTS.palletWoodHeightMm,
      maxTowerHeightMm: options.maxTowerHeightMm || DEFAULTS.maxTowerHeightMm,
      maxPalletsPerTower: options.maxPalletsPerTower || DEFAULTS.maxPalletsPerTower
    };

    if (!isObject(data)) {
      pushError(errors, 'INVALID_CATALOG', '$', 'El catálogo debe ser un objeto.');
      return { valid: false, errors, warnings };
    }

    if (data.schemaVersion !== SCHEMA_VERSION) {
      pushError(errors, 'INVALID_SCHEMA_VERSION', '$.schemaVersion',
        `schemaVersion esperado ${SCHEMA_VERSION}, recibido ${data.schemaVersion}.`);
    }

    if (!isNonEmptyString(data.catalogVersion)) {
      pushError(errors, 'MISSING_CATALOG_VERSION', '$.catalogVersion',
        'catalogVersion es obligatorio y no puede estar vacío.');
    }

    if (data.globals !== undefined && !isObject(data.globals)) {
      pushError(errors, 'INVALID_GLOBALS', '$.globals', 'globals debe ser un objeto.');
    } else if (isObject(data.globals)) {
      if (data.globals.palletWoodHeightMm !== undefined && !isPosInt(data.globals.palletWoodHeightMm)) {
        pushError(errors, 'INVALID_GLOBAL', '$.globals.palletWoodHeightMm', 'Debe ser entero positivo.');
      }
      if (data.globals.maxTowerHeightMm !== undefined && !isPosInt(data.globals.maxTowerHeightMm)) {
        pushError(errors, 'INVALID_GLOBAL', '$.globals.maxTowerHeightMm', 'Debe ser entero positivo.');
      }
      if (data.globals.maxPalletsPerTower !== undefined && !isPosInt(data.globals.maxPalletsPerTower)) {
        pushError(errors, 'INVALID_GLOBAL', '$.globals.maxPalletsPerTower', 'Debe ser entero positivo.');
      }
      if (isPosInt(data.globals.palletWoodHeightMm)) globals.palletWoodHeightMm = data.globals.palletWoodHeightMm;
      if (isPosInt(data.globals.maxTowerHeightMm)) globals.maxTowerHeightMm = data.globals.maxTowerHeightMm;
      if (isPosInt(data.globals.maxPalletsPerTower)) globals.maxPalletsPerTower = data.globals.maxPalletsPerTower;
    }

    // -----------------------------------------------------------------------
    // Plataformas
    // -----------------------------------------------------------------------
    const platforms = data.platforms || {};
    const canonical = Array.isArray(platforms.canonical) ? platforms.canonical : null;
    const aliases = isObject(platforms.aliases) ? platforms.aliases : null;
    if (!canonical || canonical.length === 0) {
      pushError(errors, 'INVALID_PLATFORMS', '$.platforms.canonical',
        'Debe existir una lista canónica de plataformas no vacía.');
    } else {
      const seen = new Set();
      canonical.forEach((p, i) => {
        if (!isNonEmptyString(p)) {
          pushError(errors, 'INVALID_PLATFORM', `$.platforms.canonical[${i}]`, 'Plataforma vacía o no textual.');
        } else if (seen.has(p)) {
          pushError(errors, 'DUPLICATE_PLATFORM', `$.platforms.canonical[${i}]`, `Plataforma duplicada: ${p}.`);
        } else {
          seen.add(p);
        }
      });
      if (!aliases) {
        pushError(errors, 'INVALID_PLATFORMS', '$.platforms.aliases', 'Debe existir un mapa de alias.');
      } else {
        for (const [alias, target] of Object.entries(aliases)) {
          if (!isNonEmptyString(alias)) {
            pushError(errors, 'INVALID_PLATFORM_ALIAS', '$.platforms.aliases', 'Alias vacío.');
          }
          if (!isNonEmptyString(target) || !seen.has(target)) {
            pushError(errors, 'INVALID_PLATFORM_ALIAS', `$.platforms.aliases.${alias}`,
              `El alias debe apuntar a una plataforma canónica existente.`);
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Artículos
    // -----------------------------------------------------------------------
    const articles = data.articles;
    if (!Array.isArray(articles) || articles.length === 0) {
      pushError(errors, 'INVALID_ARTICLES', '$.articles', 'El catálogo debe contener al menos un artículo.');
      return { valid: errors.length === 0, errors, warnings };
    }

    const ids = new Map();
    const gisOwners = new Map();
    const patternOwners = new Map();
    const stockAliasOwners = new Map();

    articles.forEach((article, index) => {
      const base = `$.articles[${index}]`;
      const label = isObject(article) && isNonEmptyString(article.id) ? article.id : `#${index}`;
      const path = `${base}(${label})`;

      if (!isObject(article)) {
        pushError(errors, 'INVALID_ARTICLE', base, 'Cada artículo debe ser un objeto.');
        return;
      }

      if (!isNonEmptyString(article.id)) {
        pushError(errors, 'MISSING_ARTICLE_ID', `${path}.id`, 'id obligatorio y no vacío.');
      } else {
        const id = article.id.trim();
        if (ids.has(id)) {
          pushError(errors, 'DUPLICATE_ARTICLE_ID', `${path}.id`, `id duplicado: ${id}.`);
        } else {
          ids.set(id, index);
        }
        if (!/^[A-Z0-9_]+$/.test(id)) {
          warnings.push({ code: 'NON_CANONICAL_ID', path: `${path}.id`,
            message: `Se recomienda id en mayúsculas A-Z, 0-9 y guion bajo: ${id}.` });
        }
      }

      if (ALLOWED_STATUS.indexOf(article.status) === -1) {
        pushError(errors, 'INVALID_STATUS', `${path}.status`,
          `status debe ser uno de ${ALLOWED_STATUS.join(', ')}.`);
      }

      if (!isNonEmptyString(article.name)) {
        pushError(errors, 'MISSING_NAME', `${path}.name`, 'name obligatorio.');
      }
      if (!isNonEmptyString(article.shortName)) {
        pushError(errors, 'MISSING_SHORT_NAME', `${path}.shortName`, 'shortName obligatorio.');
      }

      // --- Identificación ---------------------------------------------------
      const identification = article.identification;
      if (!isObject(identification)) {
        pushError(errors, 'MISSING_IDENTIFICATION', `${path}.identification`, 'identification obligatorio.');
      } else {
        const gisCodes = identification.gisCodes;
        if (!Array.isArray(gisCodes) || gisCodes.length === 0) {
          pushError(errors, 'MISSING_GIS', `${path}.identification.gisCodes`,
            'Debe declararse al menos un código GIS.');
        } else {
          gisCodes.forEach((gis, gi) => {
            if (!isNonEmptyString(gis)) {
              pushError(errors, 'INVALID_GIS', `${path}.identification.gisCodes[${gi}]`, 'GIS vacío o no textual.');
              return;
            }
            if (gisOwners.has(gis)) {
              pushError(errors, 'DUPLICATE_GIS', `${path}.identification.gisCodes[${gi}]`,
                `GIS ${gis} ya está asignado a ${gisOwners.get(gis)}.`);
            } else {
              gisOwners.set(gis, article.id);
            }
            if (!/^\d+$/.test(gis)) {
              warnings.push({ code: 'NON_NUMERIC_GIS', path: `${path}.identification.gisCodes[${gi}]`,
                message: `GIS no numérico: ${gis}. Verificar compatibilidad con Hispatec.` });
            }
          });
        }

        const patterns = identification.patterns;
        if (!Array.isArray(patterns) || patterns.length === 0) {
          pushError(errors, 'MISSING_PATTERN', `${path}.identification.patterns`,
            'Debe declararse al menos un patrón de descripción.');
        } else {
          patterns.forEach((pattern, pi) => {
            const ppath = `${path}.identification.patterns[${pi}]`;
            if (!isObject(pattern) || !isNonEmptyString(pattern.value)) {
              pushError(errors, 'INVALID_PATTERN', ppath, 'Patrón con value obligatorio.');
              return;
            }
            let re = null;
            try {
              re = compilePattern(pattern);
            } catch (e) {
              pushError(errors, 'INVALID_PATTERN_REGEX', ppath, `Expresión regular inválida: ${e.message}`);
              return;
            }
            const key = `${pattern.value}::${pattern.flags || ''}`;
            if (patternOwners.has(key)) {
              pushError(errors, 'DUPLICATE_PATTERN', ppath,
                `Patrón idéntico ya usado por ${patternOwners.get(key)}.`);
            } else {
              patternOwners.set(key, article.id);
            }
            // Solape textual directo con el nombre comercial de otro artículo.
            articles.forEach((other, oi) => {
              if (oi === index || !isObject(other)) return;
              const samples = [other.name, other.shortName].filter(isNonEmptyString);
              samples.forEach(sample => {
                if (re.test(sample)) {
                  pushError(errors, 'PATTERN_OVERLAP', ppath,
                    `El patrón "${pattern.value}" coincide con el nombre del artículo ${other.id} ("${sample}").`);
                }
              });
            });
          });
        }

        const detection = identification.varietyDetection || { mode: 'NONE' };
        if (isObject(detection) && detection.mode === 'DESCRIPTION_PATTERN') {
          if (!isNonEmptyString(detection.pattern)) {
            pushError(errors, 'INVALID_VARIETY_DETECTION', `${path}.identification.varietyDetection.pattern`,
              'DESCRIPTION_PATTERN requiere pattern.');
          } else if (!isNonEmptyString(detection.varietyId)) {
            pushError(errors, 'INVALID_VARIETY_DETECTION', `${path}.identification.varietyDetection.varietyId`,
              'DESCRIPTION_PATTERN requiere varietyId.');
          } else {
            try {
              compilePattern(detection);
            } catch (e) {
              pushError(errors, 'INVALID_VARIETY_DETECTION', `${path}.identification.varietyDetection.pattern`,
                `Expresión regular inválida: ${e.message}`);
            }
          }
        }
      }

      // --- Variedades -------------------------------------------------------
      const varieties = article.varieties === undefined ? [] : article.varieties;
      const varietyIds = new Set();
      if (!Array.isArray(varieties)) {
        pushError(errors, 'INVALID_VARIETIES', `${path}.varieties`, 'varieties debe ser un array.');
      } else {
        varieties.forEach((variety, vi) => {
          const vpath = `${path}.varieties[${vi}]`;
          if (!isObject(variety) || !isNonEmptyString(variety.id)) {
            pushError(errors, 'INVALID_VARIETY', vpath, 'Variedad con id obligatorio.');
            return;
          }
          if (varietyIds.has(variety.id)) {
            pushError(errors, 'DUPLICATE_VARIETY', `${vpath}.id`, `Variedad duplicada: ${variety.id}.`);
          }
          varietyIds.add(variety.id);
          if (!isNonEmptyString(variety.name)) {
            pushError(errors, 'INVALID_VARIETY', `${vpath}.name`, 'name de variedad obligatorio.');
          }
          if (variety.fifoPriority !== undefined && !isPosInt(variety.fifoPriority)) {
            pushError(errors, 'INVALID_FIFO_PRIORITY', `${vpath}.fifoPriority`, 'fifoPriority debe ser entero positivo.');
          }
        });
      }

      if (article.defaultVarietyId !== null && article.defaultVarietyId !== undefined) {
        if (!varietyIds.has(article.defaultVarietyId)) {
          pushError(errors, 'UNKNOWN_DEFAULT_VARIETY', `${path}.defaultVarietyId`,
            `defaultVarietyId "${article.defaultVarietyId}" no existe entre las variedades.`);
        }
      }

      // La variedad inferida por descripción debe existir en el propio artículo.
      const detection = article.identification && article.identification.varietyDetection;
      if (isObject(detection) && detection.mode === 'DESCRIPTION_PATTERN' &&
          isNonEmptyString(detection.varietyId) && !varietyIds.has(detection.varietyId)) {
        pushError(errors, 'UNKNOWN_VARIETY_DETECTION', `${path}.identification.varietyDetection.varietyId`,
          `varietyId "${detection.varietyId}" no existe entre las variedades del artículo.`);
      }

      const planning = isObject(article.planning) ? article.planning : {};
      if (!isObject(article.planning)) {
        pushError(errors, 'MISSING_PLANNING', `${path}.planning`,
          'planning es obligatorio (allocationStrategy debe declararse explícitamente).');
      }
      if (!isNonEmptyString(planning.allocationStrategy)) {
        pushError(errors, 'MISSING_STRATEGY', `${path}.planning.allocationStrategy`,
          'allocationStrategy es obligatorio.');
      } else if (ALLOWED_STRATEGIES.indexOf(planning.allocationStrategy) === -1) {
        pushError(errors, 'INVALID_STRATEGY', `${path}.planning.allocationStrategy`,
          `allocationStrategy debe ser uno de ${ALLOWED_STRATEGIES.join(', ')}.`);
      }
      if (planning.allocationStrategy === 'MONOVARIETAL_FIFO') {
        if (varietyIds.size < 2) {
          warnings.push({ code: 'FIFO_WITH_FEW_VARIETIES', path: `${path}.varieties`,
            message: 'MONOVARIETAL_FIFO con menos de dos variedades.' });
        }
        if (planning.fifoPriorityVariety !== null && planning.fifoPriorityVariety !== undefined) {
          if (!varietyIds.has(planning.fifoPriorityVariety)) {
            pushError(errors, 'UNKNOWN_FIFO_VARIETY', `${path}.planning.fifoPriorityVariety`,
              `fifoPriorityVariety "${planning.fifoPriorityVariety}" no existe entre las variedades.`);
          }
        }
      } else if (varietyIds.size > 1 && !article.defaultVarietyId) {
        pushError(errors, 'MISSING_DEFAULT_VARIETY', `${path}.defaultVarietyId`,
          'Con varias variedades y estrategia HAMILTON se requiere defaultVarietyId.');
      }

      if (planning.varietyPreference !== undefined) {
        if (!Array.isArray(planning.varietyPreference)) {
          pushError(errors, 'INVALID_VARIETY_PREFERENCE', `${path}.planning.varietyPreference`,
            'varietyPreference debe ser un array de identificadores de variedad.');
        } else {
          planning.varietyPreference.forEach((varietyId, vi) => {
            if (!isNonEmptyString(varietyId) || !varietyIds.has(varietyId)) {
              pushError(errors, 'UNKNOWN_VARIETY_PREFERENCE',
                `${path}.planning.varietyPreference[${vi}]`,
                `La variedad "${varietyId}" no existe entre las variedades del artículo.`);
            }
          });
        }
      }

      // --- Alias de stock ---------------------------------------------------
      const stockAliases = article.stockAliases === undefined ? {} : article.stockAliases;
      if (!isObject(stockAliases)) {
        pushError(errors, 'INVALID_STOCK_ALIASES', `${path}.stockAliases`, 'stockAliases debe ser un objeto.');
      } else {
        for (const [alias, varietyId] of Object.entries(stockAliases)) {
          if (!isNonEmptyString(alias)) {
            pushError(errors, 'INVALID_STOCK_ALIAS', `${path}.stockAliases`, 'Alias de stock vacío.');
          }
          if (stockAliasOwners.has(alias) && stockAliasOwners.get(alias) !== article.id) {
            pushError(errors, 'DUPLICATE_STOCK_ALIAS', `${path}.stockAliases.${alias}`,
              `El alias "${alias}" ya está definido en el artículo ${stockAliasOwners.get(alias)}.`);
          } else {
            stockAliasOwners.set(alias, article.id);
          }
          if (!varietyIds.has(varietyId)) {
            pushError(errors, 'UNKNOWN_STOCK_ALIAS_VARIETY', `${path}.stockAliases.${alias}`,
              `La variedad "${varietyId}" no pertenece al artículo ${article.id}.`);
          }
        }
        if (varietyIds.size > 1) {
          for (const varietyId of varietyIds) {
            const covered = Object.values(stockAliases).indexOf(varietyId) !== -1;
            if (!covered) {
              warnings.push({ code: 'VARIETY_WITHOUT_STOCK_ALIAS', path: `${path}.stockAliases`,
                message: `La variedad ${varietyId} no tiene alias de stock suelto.` });
            }
          }
        }
      }

      // --- Caja y paletización ---------------------------------------------
      const box = article.box;
      if (!isObject(box)) {
        pushError(errors, 'MISSING_BOX', `${path}.box`, 'box obligatorio.');
      } else {
        ['lengthMm', 'widthMm', 'heightMm'].forEach(field => {
          if (!isPosInt(box[field])) {
            pushError(errors, 'INVALID_BOX_DIMENSION', `${path}.box.${field}`, 'Debe ser entero positivo (mm).');
          }
        });
      }

      const palletization = article.palletization;
      if (!isObject(palletization)) {
        pushError(errors, 'MISSING_PALLETIZATION', `${path}.palletization`, 'palletization obligatorio.');
        return;
      }

      const overrideGuard = palletization.overrideGuard;
      if (overrideGuard !== undefined) {
        if (!isObject(overrideGuard)) {
          pushError(errors, 'INVALID_OVERRIDE_GUARD', `${path}.palletization.overrideGuard`,
            'overrideGuard debe ser un objeto.');
        } else if (overrideGuard.blockMetrochepBelowEuroCapacity !== undefined &&
                   typeof overrideGuard.blockMetrochepBelowEuroCapacity !== 'boolean') {
          pushError(errors, 'INVALID_OVERRIDE_GUARD', `${path}.palletization.overrideGuard.blockMetrochepBelowEuroCapacity`,
            'blockMetrochepBelowEuroCapacity debe ser booleano.');
        }
      }

      const formats = palletization.formats;
      if (!isObject(formats) || Object.keys(formats).length === 0) {
        pushError(errors, 'MISSING_PALLET_FORMATS', `${path}.palletization.formats`,
          'Debe existir al menos un formato de paletización.');
        return;
      }

      Object.keys(formats).forEach(formatName => {
        const fpath = `${path}.palletization.formats.${formatName}`;
        if (ALLOWED_FORMATS.indexOf(formatName) === -1) {
          pushError(errors, 'UNKNOWN_PALLET_FORMAT', fpath, `Formato no soportado: ${formatName}.`);
          return;
        }
        const format = formats[formatName];
        if (!isObject(format)) {
          pushError(errors, 'INVALID_PALLET_FORMAT', fpath, 'El formato debe ser un objeto.');
          return;
        }
        ['palletLengthMm', 'palletWidthMm', 'palletHeightMm', 'boxesPerLayer', 'maxLayers'].forEach(field => {
          if (!isPosInt(format[field])) {
            pushError(errors, 'INVALID_PALLET_PARAMETER', `${fpath}.${field}`, 'Debe ser entero positivo.');
          }
        });
        if (!isNonEmptyString(format.layerPattern)) {
          pushError(errors, 'MISSING_LAYER_PATTERN', `${fpath}.layerPattern`, 'layerPattern obligatorio.');
        }
        if (!isObject(box) || !isPosInt(box.lengthMm) || !isPosInt(box.widthMm) || !isPosInt(box.heightMm)) {
          return;
        }
        if (!isPosInt(format.palletLengthMm) || !isPosInt(format.palletWidthMm) ||
            !isPosInt(format.boxesPerLayer) || !isPosInt(format.maxLayers) ||
            !isPosInt(format.palletHeightMm)) {
          return;
        }

        // La caja debe caber en la base del palet (dimensión mínima).
        if (box.lengthMm > Math.max(format.palletLengthMm, format.palletWidthMm) ||
            box.widthMm > Math.max(format.palletLengthMm, format.palletWidthMm)) {
          pushError(errors, 'BOX_LARGER_THAN_PALLET', fpath, 'La caja excede la base del palet.');
        }

        // Capacidad por capa: comprobación NECESARIA por área (no suficiente).
        const palletArea = format.palletLengthMm * format.palletWidthMm;
        const boxArea = box.lengthMm * box.widthMm;
        const maxByArea = Math.floor(palletArea / boxArea);
        if (format.boxesPerLayer > maxByArea) {
          pushError(errors, 'INVALID_LAYER_CAPACITY', `${fpath}.boxesPerLayer`,
            `${format.boxesPerLayer} cajas/capa exceden la capacidad por área del palet (${maxByArea}).`);
        }

        const capacity = format.boxesPerLayer * format.maxLayers;
        if (capacity <= 0) {
          pushError(errors, 'INVALID_CAPACITY', fpath, 'Capacidad calculada no válida.');
        }

        const totalHeight = format.palletHeightMm + format.maxLayers * box.heightMm;
        if (totalHeight > globals.maxTowerHeightMm) {
          pushError(errors, 'PALLET_EXCEEDS_TOWER_HEIGHT', fpath,
            `Altura total ${totalHeight} mm excede el gálibo ${globals.maxTowerHeightMm} mm.`);
        }

        if (format.boxHeightMm !== undefined && format.boxHeightMm !== box.heightMm) {
          pushError(errors, 'BOX_HEIGHT_MISMATCH', `${fpath}.boxHeightMm`,
            'boxHeightMm no coincide con box.heightMm.');
        }
      });

      // La salvaguarda de override necesita un formato EURO de referencia.
      const euro = formats.EURO;
      const metro = formats.METROCHEP;
      if (isObject(overrideGuard) && overrideGuard.blockMetrochepBelowEuroCapacity === true && !isObject(euro)) {
        pushError(errors, 'MISSING_EURO_FOR_OVERRIDE_GUARD', `${path}.palletization.overrideGuard`,
          'blockMetrochepBelowEuroCapacity requiere un formato EURO declarado.');
      }

      // El modelo físico asume que METROCHEP (base 1200x1000) no tiene menos
      // capacidad que EURO (base 1200x800) para el mismo artículo.
      if (isObject(euro) && isObject(metro) &&
          isPosInt(euro.boxesPerLayer) && isPosInt(euro.maxLayers) &&
          isPosInt(metro.boxesPerLayer) && isPosInt(metro.maxLayers)) {
        const euroCapacity = euro.boxesPerLayer * euro.maxLayers;
        const metroCapacity = metro.boxesPerLayer * metro.maxLayers;
        if (metroCapacity < euroCapacity) {
          pushError(errors, 'INCOMPATIBLE_FORMAT_CAPACITY', `${path}.palletization.formats.METROCHEP`,
            `La capacidad METROCHEP (${metroCapacity}) no puede ser inferior a la EURO (${euroCapacity}).`);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Referencias cruzadas de alias de stock
    // -----------------------------------------------------------------------
    articles.forEach((article, index) => {
      if (!isObject(article) || !isObject(article.stockAliases)) return;
      const path = `$.articles[${index}](${article.id}).stockAliases`;
      for (const alias of Object.keys(article.stockAliases)) {
        // El alias suelto no puede ser el id de otro artículo (ambigüedad).
        if (ids.has(alias) && alias !== article.id) {
          pushError(errors, 'AMBIGUOUS_STOCK_ALIAS', `${path}.${alias}`,
            `El alias "${alias}" coincide con el id del artículo ${alias}.`);
        }
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  function formatIssues(result) {
    if (!result || !result.errors) return '';
    return result.errors.map(e => `- [${e.code}] ${e.path}: ${e.message}`).join('\n');
  }

  return {
    SCHEMA_VERSION,
    ALLOWED_STATUS,
    ALLOWED_FORMATS,
    ALLOWED_STRATEGIES,
    validateCatalog,
    formatIssues
  };
});

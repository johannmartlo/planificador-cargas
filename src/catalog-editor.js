/**
 * V4.8 — Editor de catálogo de artículos.
 *
 * Funciones puras (sin DOM) para crear/editar/activar artículos reutilizando
 * el validador existente (`catalog-schema.js`) y para persistir el catálogo
 * en el almacenamiento local del navegador.
 *
 * Persistencia: `localStorage` del navegador. Es una persistencia REAL para
 * este dispositivo/navegador, pero NO es configuración compartida de
 * producción. La UI debe etiquetarla como local.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./catalog-schema.js'));
  } else {
    root.LogisticsCatalogEditor = factory(root.LogisticsCatalogSchema);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schema) {
  'use strict';

  if (!schema || typeof schema.validateCatalog !== 'function') {
    throw new Error('LogisticsCatalogEditor requiere catalog-schema.js cargado antes.');
  }

  const STORAGE_KEY = 'planificador-catalog-v1';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function num(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function text(value) {
    return String(value === undefined || value === null ? '' : value).trim();
  }

  function splitCodes(value) {
    return text(value).split(',').map(s => s.trim()).filter(Boolean);
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function derivePattern(value) {
    const clean = text(value);
    if (!clean) return '';
    return escapeRegex(clean).replace(/\s+/g, '\\s+');
  }

  /** Catálogo por defecto en el formato de `catalog/catalog.json`. */
  function catalogDataFromDefault(defaultCatalog) {
    return clone({
      schemaVersion: defaultCatalog.schemaVersion,
      catalogVersion: defaultCatalog.catalogVersion,
      globals: defaultCatalog.globals || {},
      platforms: defaultCatalog.platforms || { canonical: [], aliases: {} },
      articles: defaultCatalog.articles || []
    });
  }

  function createDraft() {
    return {
      id: '',
      name: '',
      shortName: '',
      status: 'ACTIVE',
      gisCodes: '',
      pattern: '',
      boxLength: '',
      boxWidth: '',
      boxHeight: '',
      euroPalletLength: '',
      euroPalletWidth: '',
      euroBoxesPerLayer: '',
      euroMaxLayers: '',
      metroPalletLength: '',
      metroPalletWidth: '',
      metroBoxesPerLayer: '',
      metroMaxLayers: ''
    };
  }

  function firstFormat(article) {
    const formats = (article && article.palletization && article.palletization.formats) || {};
    return formats.EURO || formats.METROCHEP || null;
  }

  function draftFromArticle(article) {
    const draft = createDraft();
    if (!article) return draft;
    const identification = article.identification || {};
    const patterns = identification.patterns || [];
    const formats = (article.palletization && article.palletization.formats) || {};
    const euro = formats.EURO || {};
    const metro = formats.METROCHEP || {};
    const box = article.box || {};
    draft.id = article.id || '';
    draft.name = article.name || '';
    draft.shortName = article.shortName || '';
    draft.status = article.status || 'ACTIVE';
    draft.gisCodes = (identification.gisCodes || []).join(', ');
    draft.pattern = patterns[0] ? patterns[0].value : '';
    draft.boxLength = box.lengthMm === undefined ? '' : box.lengthMm;
    draft.boxWidth = box.widthMm === undefined ? '' : box.widthMm;
    draft.boxHeight = box.heightMm === undefined ? '' : box.heightMm;
    draft.euroPalletLength = euro.palletLengthMm === undefined ? '' : euro.palletLengthMm;
    draft.euroPalletWidth = euro.palletWidthMm === undefined ? '' : euro.palletWidthMm;
    draft.euroBoxesPerLayer = euro.boxesPerLayer === undefined ? '' : euro.boxesPerLayer;
    draft.euroMaxLayers = euro.maxLayers === undefined ? '' : euro.maxLayers;
    draft.metroPalletLength = metro.palletLengthMm === undefined ? '' : metro.palletLengthMm;
    draft.metroPalletWidth = metro.palletWidthMm === undefined ? '' : metro.palletWidthMm;
    draft.metroBoxesPerLayer = metro.boxesPerLayer === undefined ? '' : metro.boxesPerLayer;
    draft.metroMaxLayers = metro.maxLayers === undefined ? '' : metro.maxLayers;
    return draft;
  }

  function buildFormat(formatName, prefix, draft, existingFormat, articleId) {
    const bpl = num(draft[prefix + 'BoxesPerLayer']);
    const layers = num(draft[prefix + 'MaxLayers']);
    const palletLength = num(draft[prefix + 'PalletLength']);
    const palletWidth = num(draft[prefix + 'PalletWidth']);
    if (bpl === null || layers === null || palletLength === null || palletWidth === null) {
      return null;
    }
    const sameLayout = existingFormat && existingFormat.boxesPerLayer === bpl;
    const layerPattern = sameLayout && existingFormat.layerPattern
      ? existingFormat.layerPattern
      : `${bpl}_PER_LAYER`;
    return {
      palletLengthMm: palletLength,
      palletWidthMm: palletWidth,
      palletHeightMm: existingFormat && existingFormat.palletHeightMm !== undefined
        ? existingFormat.palletHeightMm
        : 144,
      boxesPerLayer: bpl,
      maxLayers: layers,
      layerPattern,
      isRigid: existingFormat && existingFormat.isRigid !== undefined ? existingFormat.isRigid : true,
      capacitySource: existingFormat && existingFormat.capacitySource
        ? existingFormat.capacitySource
        : 'USER_CONFIGURED',
      verified: existingFormat && existingFormat.verified !== undefined ? existingFormat.verified : false,
      name: existingFormat && existingFormat.name
        ? existingFormat.name
        : `${articleId} · ${formatName}`
    };
  }

  function buildArticle(data, draft, originalId) {
    const existingIndex = originalId
      ? data.articles.findIndex(a => a.id === originalId)
      : -1;
    const existing = existingIndex >= 0 ? clone(data.articles[existingIndex]) : null;
    const id = text(originalId || draft.id).toUpperCase();
    const name = text(draft.name);
    const shortName = text(draft.shortName) || name;
    const gisCodes = splitCodes(draft.gisCodes);
    const patternValue = text(draft.pattern) || derivePattern(shortName || name);
    const box = {
      lengthMm: num(draft.boxLength),
      widthMm: num(draft.boxWidth),
      heightMm: num(draft.boxHeight)
    };
    const formats = {};
    const existingFormats = (existing && existing.palletization && existing.palletization.formats) || {};
    const euro = buildFormat('EURO', 'euro', draft, existingFormats.EURO, id);
    const metro = buildFormat('METROCHEP', 'metro', draft, existingFormats.METROCHEP, id);
    if (euro) formats.EURO = euro;
    if (metro) formats.METROCHEP = metro;

    const identification = {
      ...((existing && existing.identification) || {}),
      gisCodes,
      patterns: patternValue ? [{ value: patternValue, flags: 'i' }] : [],
      varietyDetection: (existing && existing.identification && existing.identification.varietyDetection) || { mode: 'NONE' }
    };

    if (existing) {
      existing.id = id;
      existing.status = draft.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      existing.name = name;
      existing.shortName = shortName;
      existing.identification = identification;
      existing.box = box;
      existing.palletization = {
        ...(existing.palletization || {}),
        formats
      };
      return existing;
    }

    return {
      id,
      status: draft.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      name,
      shortName,
      hasMonovarietalRestriction: false,
      identification,
      stockAliases: {},
      varieties: [],
      defaultVarietyId: null,
      box,
      palletization: { formats },
      planning: {
        allocationStrategy: 'HAMILTON',
        fifoPriorityVariety: null,
        varietyPreference: []
      }
    };
  }

  function validateCatalogData(data) {
    const result = schema.validateCatalog(data);
    return { valid: result.valid, errors: result.errors, warnings: result.warnings };
  }

  /**
   * Aplica un borrador sobre una copia del catálogo. No muta `data`.
   * @param {Object} data Catálogo completo.
   * @param {Object} draft Campos del formulario.
   * @param {string|null} originalId id original en edición; null para alta.
   */
  function applyDraft(data, draft, originalId) {
    if (!data || !Array.isArray(data.articles)) {
      return { ok: false, errors: [{ code: 'INVALID_CATALOG', message: 'Catálogo no disponible.' }] };
    }
    const next = clone(data);
    const index = originalId
      ? next.articles.findIndex(a => a.id === originalId)
      : -1;
    if (originalId && index < 0) {
      return { ok: false, errors: [{ code: 'ARTICLE_NOT_FOUND', message: `No existe el artículo ${originalId}.` }] };
    }
    const article = buildArticle(next, draft, originalId);
    if (index >= 0) {
      next.articles[index] = article;
    } else {
      next.articles.push(article);
    }
    const validation = validateCatalogData(next);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors, warnings: validation.warnings };
    }
    return {
      ok: true,
      data: next,
      article,
      isNew: index < 0,
      warnings: validation.warnings
    };
  }

  function setStatus(data, id, status) {
    const next = clone(data);
    const article = next.articles.find(a => a.id === id);
    if (!article) {
      return { ok: false, errors: [{ code: 'ARTICLE_NOT_FOUND', message: `No existe el artículo ${id}.` }] };
    }
    article.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const validation = validateCatalogData(next);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors, warnings: validation.warnings };
    }
    return { ok: true, data: next, article, warnings: validation.warnings };
  }

  function loadCatalog(defaultData, storage) {
    const fallback = clone(defaultData);
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
        error: { code: 'INVALID_LOCAL_CATALOG', message: 'El catálogo local guardado no es JSON válido.' }
      };
    }
    const validation = validateCatalogData(parsed);
    if (!parsed || !Array.isArray(parsed.articles) || !validation.valid) {
      return {
        data: fallback,
        source: 'default',
        error: {
          code: 'INVALID_LOCAL_CATALOG',
          message: 'El catálogo local guardado no es válido; se usa el catálogo por defecto.',
          errors: validation.errors || []
        }
      };
    }
    return { data: parsed, source: 'local', error: null };
  }

  function saveCatalog(data, storage) {
    if (!storage) {
      return {
        ok: false,
        code: 'STORAGE_UNAVAILABLE',
        errors: [{ code: 'STORAGE_UNAVAILABLE', message: 'No hay almacenamiento local disponible; no se ha guardado nada.' }]
      };
    }
    const validation = validateCatalogData(data);
    if (!validation.valid) {
      return { ok: false, code: 'INVALID_CATALOG', errors: validation.errors };
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      return {
        ok: false,
        code: 'STORAGE_WRITE_FAILED',
        errors: [{ code: 'STORAGE_WRITE_FAILED', message: 'No se pudo escribir en el almacenamiento local.' }]
      };
    }
    return { ok: true };
  }

  function resetCatalog(storage) {
    if (!storage) return { ok: false, code: 'STORAGE_UNAVAILABLE' };
    try {
      storage.removeItem(STORAGE_KEY);
      return { ok: true };
    } catch (err) {
      return { ok: false, code: 'STORAGE_WRITE_FAILED' };
    }
  }

  return {
    STORAGE_KEY,
    createDraft,
    draftFromArticle,
    applyDraft,
    setStatus,
    loadCatalog,
    saveCatalog,
    resetCatalog,
    catalogDataFromDefault,
    validateCatalogData,
    derivePattern,
    firstFormat
  };
});

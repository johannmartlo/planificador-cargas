/**
 * Parser y Normalizador de Previsiones Logísticas
 *
 * Módulo puro desacoplado del DOM.
 * Interpreta texto bruto copiado directamente de emails o ERPs sin depender
 * de posiciones fijas ni tabuladores exclusivos.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const catalogModule = require('./catalog.js');
    module.exports = factory(catalogModule);
  } else {
    root.LogisticsParser = factory(root.LogisticsCatalog);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalogModule) {
  'use strict';

  const { DEFAULT_CATALOG, normalizePlatform, identifyProduct } = catalogModule;

  /**
   * Interpreta texto bruto de una previsión y produce registros normalizados y explicables.
   *
   * @param {string} rawText - Texto copiado íntegro del correo o ERP.
   * @param {Object} [catalogConfig] - Configuración opcional de catálogo.
   * @returns {{
   *   lines: Array<Object>,
   *   detectedDate: string|null,
   *   parsingErrors: Array<Object>,
   *   parsingWarnings: Array<Object>
   * }}
   */
  function parseRawText(rawText, catalogConfig = DEFAULT_CATALOG) {
    const catalog = catalogConfig || DEFAULT_CATALOG;
    const lines = [];
    const parsingErrors = [];
    const parsingWarnings = [];

    if (typeof rawText !== 'string') {
      parsingErrors.push({
        code: 'INVALID_INPUT_TYPE',
        message: 'La entrada debe ser una cadena de texto (string).'
      });
      return { lines: [], detectedDate: null, parsingErrors, parsingWarnings };
    }

    const rawLines = rawText.split(/\r\n|\r|\n/);
    const validDeliveryDates = [];

    // Lista de plataformas conocidas ordenadas por longitud descendente para evitar colisiones
    const knownPlatformNames = Object.keys((catalog.platforms && catalog.platforms.aliases) || DEFAULT_CATALOG.platforms.aliases)
      .sort((a, b) => b.length - a.length);

    for (let i = 0; i < rawLines.length; i++) {
      const originalLine = rawLines[i];
      const lineNumber = i + 1;

      // 1. Normalización de espacios no separables y trim
      const cleanLine = originalLine.replace(/[\u00A0\u202F]/g, ' ').trim();
      if (!cleanLine) {
        continue; // Ignorar líneas en blanco sin generar error
      }

      const lineId = `line_${lineNumber}`;
      const lineErrors = [];

      // 2. Extracción de CANTIDAD (último entero positivo de la línea)
      // Debe haber al menos un espacio/tab antes del número para no tomar dígitos de palabras
      const quantityMatch = cleanLine.match(/(?:^|[\s\t]+)(\d+)\s*$/);
      let requestedQuantity = null;

      if (quantityMatch) {
        const parsedQty = parseInt(quantityMatch[1], 10);
        if (Number.isInteger(parsedQty) && parsedQty >= 0) {
          requestedQuantity = parsedQty;
        } else {
          lineErrors.push({
            code: 'INVALID_QUANTITY_FORMAT',
            message: `Cantidad inválida o negativa: "${quantityMatch[1]}".`
          });
        }
      } else {
        lineErrors.push({
          code: 'MISSING_QUANTITY',
          message: 'No se pudo identificar una cantidad entera válida al final de la línea.'
        });
      }

      // Resto de la línea antes de la cantidad final para evitar falsos positivos
      const lineWithoutQty = quantityMatch
        ? cleanLine.slice(0, cleanLine.lastIndexOf(quantityMatch[0])).trim()
        : cleanLine;

      // 3. Extracción de FECHA DE ENTREGA (DD/MM/YYYY)
      const dateMatches = Array.from(lineWithoutQty.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g));
      let deliveryDate = '';

      if (dateMatches.length === 1) {
        deliveryDate = dateMatches[0][1];
      } else if (dateMatches.length > 1) {
        // Criterio documentado: Si hay múltiples fechas DD/MM/YYYY en la misma línea,
        // se adopta la última (que precede al código GIS y artículo en las previsiones estándar)
        // y se emite un warning explícito.
        deliveryDate = dateMatches[dateMatches.length - 1][1];
        parsingWarnings.push({
          code: 'MULTIPLE_DATES_IN_LINE',
          message: `Línea ${lineNumber}: Múltiples fechas detectadas (${dateMatches.map(m => m[1]).join(', ')}). Se adoptó: ${deliveryDate}.`,
          context: { lineNumber, dates: dateMatches.map(m => m[1]), chosen: deliveryDate }
        });
      } else {
        lineErrors.push({
          code: 'MISSING_DELIVERY_DATE',
          message: 'No se detectó fecha de entrega en formato DD/MM/YYYY.'
        });
      }

      // 4. Extracción de TIMESTAMP DE ORIGEN (cabecera con zona horaria)
      // Ejemplo: Tue Aug 25 2026 00:00:00 GMT+0200 (hora de verano de Europa central)
      const timestampMatch = lineWithoutQty.match(/\b[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}(?:\s*\([^)]*\))?/);
      const sourceDate = timestampMatch ? timestampMatch[0].trim() : null;

      // 5. Extracción y normalización de PLATAFORMA (primer campo lógico)
      let rawPlatform = '';
      const upperLine = lineWithoutQty.toUpperCase();

      // Búsqueda por coincidencia de alias conocidos al inicio de la línea
      for (const alias of knownPlatformNames) {
        const regex = new RegExp(`^${alias}(?:[\\s\\t]+|$)`, 'i');
        if (regex.test(lineWithoutQty)) {
          rawPlatform = alias;
          break;
        }
      }

      if (!rawPlatform) {
        // Fallback: si hay timestamp, todo lo que esté antes del timestamp es la plataforma
        if (timestampMatch) {
          rawPlatform = lineWithoutQty.slice(0, lineWithoutQty.indexOf(timestampMatch[0])).trim();
        } else if (deliveryDate && lineWithoutQty.includes(deliveryDate)) {
          rawPlatform = lineWithoutQty.slice(0, lineWithoutQty.indexOf(deliveryDate)).trim();
        } else {
          // Si no hay timestamp ni fecha, tomar la primera palabra
          rawPlatform = (lineWithoutQty.split(/[\s\t]+/)[0] || '').trim();
        }
      }

      const platform = normalizePlatform(rawPlatform, catalog);
      if (!platform) {
        lineErrors.push({
          code: 'MISSING_PLATFORM',
          message: 'No se pudo identificar la plataforma de destino.'
        });
      }

      // 6. Extracción de CÓDIGO GIS (4 a 6 dígitos numéricos tras la fecha de entrega)
      let gisCode = '';
      let textAfterDate = '';

      if (deliveryDate && lineWithoutQty.includes(deliveryDate)) {
        textAfterDate = lineWithoutQty.slice(lineWithoutQty.indexOf(deliveryDate) + deliveryDate.length).trim();
      } else {
        textAfterDate = lineWithoutQty;
      }

      const gisMatch = textAfterDate.match(/\b(\d{4,6})\b/);
      if (gisMatch) {
        gisCode = gisMatch[1];
      } else {
        // Fallback: buscar en toda la línea excluyendo el año de la fecha o el offset GMT
        const allNumMatches = Array.from(lineWithoutQty.matchAll(/\b(\d{4,6})\b/g));
        for (const m of allNumMatches) {
          const val = m[1];
          if (deliveryDate && deliveryDate.includes(val)) continue;
          if (lineWithoutQty.includes(`GMT+${val}`) || lineWithoutQty.includes(`GMT-${val}`)) continue;
          gisCode = val;
          break;
        }
      }

      // 7. Extracción de DESCRIPCIÓN DEL PRODUCTO
      // Es el texto entre el GIS (o fecha) y el final de la línea
      let productDescription = '';
      if (gisCode && textAfterDate.includes(gisCode)) {
        productDescription = textAfterDate.slice(textAfterDate.indexOf(gisCode) + gisCode.length).trim();
      } else if (textAfterDate) {
        productDescription = textAfterDate.trim();
      }

      // Normalizar espacios internos superfluos sin alterar mayúsculas ni caracteres originales
      productDescription = productDescription.replace(/[\s\t]+/g, ' ').trim();

      if (!gisCode && !productDescription) {
        lineErrors.push({
          code: 'MISSING_PRODUCT_IDENTIFIERS',
          message: 'No se encontró código GIS ni descripción de producto en la línea.'
        });
      }

      // 8. IDENTIFICACIÓN DE PRODUCTO Y VARIEDAD MEDIANTE CATÁLOGO
      // El GIS tiene prioridad absoluta
      const productInfo = identifyProduct(gisCode, productDescription, catalog);
      const productId = productInfo.productId;
      const varietyId = productInfo.varietyId;

      if (productId === 'UNKNOWN') {
        lineErrors.push({
          code: 'UNKNOWN_PRODUCT',
          message: `Producto no reconocido para GIS "${gisCode}" o descripción "${productDescription}".`
        });
      }

      const isValid = lineErrors.length === 0;

      if (isValid && deliveryDate) {
        validDeliveryDates.push(deliveryDate);
      }

      if (!isValid) {
        parsingErrors.push({
          lineNumber,
          lineId,
          rawText: originalLine,
          errors: lineErrors
        });
      }

      lines.push({
        id: lineId,
        rawText: originalLine,
        lineNumber,
        platform,
        deliveryDate,
        sourceDate,
        gisCode,
        productDescription,
        productId,
        varietyId,
        requestedQuantity,
        isValid,
        parseErrors: lineErrors
      });
    }

    // 9. DETERMINACIÓN DE FECHA GLOBAL (detectedDate)
    let detectedDate = null;
    const uniqueDates = Array.from(new Set(validDeliveryDates));

    if (uniqueDates.length === 1) {
      detectedDate = uniqueDates[0];
    } else if (uniqueDates.length > 1) {
      detectedDate = uniqueDates[0]; // Se selecciona la primera fecha pero se reporta warning estructurado
      parsingWarnings.push({
        code: 'MULTIPLE_GLOBAL_DELIVERY_DATES',
        message: `Se detectaron múltiples fechas de entrega distintas en la previsión: ${uniqueDates.join(', ')}.`,
        context: { uniqueDates }
      });
    }

    return {
      lines,
      detectedDate,
      detectedDates: uniqueDates,
      parsingErrors,
      parsingWarnings
    };
  }

  /**
   * Consolida la demanda agrupada por producto, variedad y plataforma,
   * descartando líneas inválidas y aplicando exclusiones.
   *
   * @param {Array<Object>} orderLines - Array de líneas obtenido de parseRawText.
   * @param {Array<Object>} [exclusions] - Lista de exclusiones ({ type: 'PRODUCT'|'PLATFORM'|'LINE', target: string }).
   * @returns {{
   *   activeLines: Array<Object>,
   *   platforms: Array<string>,
   *   demandsByProduct: Object<string, Object<string, number>>,
   *   demandsByProductVariety: Object<string, Object<string, Object<string, number>>>,
   *   totalByProduct: Object<string, number>,
   *   totalGeneral: number
   * }}
   */
  function aggregateDemands(orderLines, exclusions = []) {
    if (!Array.isArray(orderLines)) {
      return {
        activeLines: [],
        platforms: [],
        demandsByProduct: {},
        demandsByProductVariety: {},
        totalByProduct: {},
        totalGeneral: 0
      };
    }

    const excludedProductIds = new Set();
    const excludedPlatforms = new Set();
    const excludedLineIds = new Set();

    for (const ex of exclusions) {
      if (ex.type === 'PRODUCT') excludedProductIds.add(ex.target);
      if (ex.type === 'PLATFORM') excludedPlatforms.add(ex.target);
      if (ex.type === 'LINE') excludedLineIds.add(ex.target);
    }

    // Filtrar líneas válidas y no excluidas
    const activeLines = orderLines.filter(line => {
      if (!line || !line.isValid) return false;
      if (excludedLineIds.has(line.id)) return false;
      if (excludedProductIds.has(line.productId)) return false;
      if (excludedPlatforms.has(line.platform)) return false;
      return true;
    });

    const platformsSet = new Set();
    const demandsByProduct = {};
    const demandsByProductVariety = {};
    const totalByProduct = {};
    let totalGeneral = 0;

    for (const line of activeLines) {
      const prodId = line.productId;
      const varietyKey = line.varietyId || 'NONE';
      const plat = line.platform;
      const qty = Number(line.requestedQuantity) || 0;

      platformsSet.add(plat);

      // 1. Agrupación por producto y plataforma
      if (!demandsByProduct[prodId]) {
        demandsByProduct[prodId] = {};
        totalByProduct[prodId] = 0;
      }
      demandsByProduct[prodId][plat] = (demandsByProduct[prodId][plat] || 0) + qty;
      totalByProduct[prodId] += qty;
      totalGeneral += qty;

      // 2. Agrupación por producto, variedad y plataforma
      if (!demandsByProductVariety[prodId]) {
        demandsByProductVariety[prodId] = {};
      }
      if (!demandsByProductVariety[prodId][varietyKey]) {
        demandsByProductVariety[prodId][varietyKey] = {};
      }
      demandsByProductVariety[prodId][varietyKey][plat] = (demandsByProductVariety[prodId][varietyKey][plat] || 0) + qty;
    }

    // Orden canónico de plataformas
    const canonicalOrder = DEFAULT_CATALOG.platforms.canonical;
    const sortedPlatforms = Array.from(platformsSet).sort((a, b) => {
      let idxA = canonicalOrder.indexOf(a);
      let idxB = canonicalOrder.indexOf(b);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB || a.localeCompare(b);
    });

    // Rellenar con 0 las plataformas activas en las matrices para facilitar su consumo
    for (const prodId of Object.keys(demandsByProduct)) {
      for (const p of sortedPlatforms) {
        if (demandsByProduct[prodId][p] === undefined) {
          demandsByProduct[prodId][p] = 0;
        }
      }
    }

    return {
      activeLines,
      platforms: sortedPlatforms,
      demandsByProduct,
      demandsByProductVariety,
      totalByProduct,
      totalGeneral
    };
  }

  return {
    parseRawText,
    parseForecast: parseRawText,
    aggregateDemands
  };
});

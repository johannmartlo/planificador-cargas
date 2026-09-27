/**
 * PHASE 19 — Planificador de Carga · MOBILE
 * Google Apps Script: CAPA DE HOSTING EXCLUSIVAMENTE.
 *
 * Este archivo NO contiene lógica de negocio. Todo el motor logístico
 * (parser, Hamilton, cocktail-solver, paletizer, orchestrator) y toda la
 * interfaz (ui.js, mobile.css) se sirven al navegador tal cual y se ejecutan
 * EN EL CLIENTE, exactamente igual que en la versión local.
 *
 * Responsabilidad única de este archivo:
 *   1. Servir la SPA mediante HTML Service.
 *   2. Inyectar los archivos estáticos como plantillas HTML.
 *
 * Prohibido por diseño (§4 de la fase): base de datos, autenticación propia,
 * usuarios, roles, sincronización, APIs nuevas o cualquier regla de
 * planificación. No existe ninguna llamada a google.script.run desde el cliente.
 */

/** Nombre de la plantilla principal (sin extensión). */
var INDEX_TEMPLATE = 'index';

/** Título de la pestaña del navegador. */
var APP_TITLE = 'Planificador de Carga — Hoja de Expedición Digital';

/**
 * Punto de entrada de la aplicación web.
 *
 * Devuelve la SPA completa. No se ejecuta todavía ningún deployment (§17).
 *
 * @param {Object} e Evento de la petición (no se usa: la app es 100% cliente).
 * @return {HtmlOutput} La aplicación lista para servir.
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile(INDEX_TEMPLATE);
  var output = template.evaluate();

  output.setTitle(APP_TITLE);

  // CRÍTICO PARA MÓVIL (FASE 18.3).
  // La documentación de HtmlOutput lo dice literalmente: "Meta tags included
  // directly in an Apps Script HTML file are ignored". El <meta name="viewport">
  // escrito en index.html NO llega al navegador: HtmlService lo elimina.
  //
  // Consecuencia si falta esta línea: iOS/Android no recibe viewport alguno, así
  // que maqueta la página en un viewport virtual de ~980 px y luego ENCOGE todo
  // (~0,4x) para que quepa en la pantalla. Resultado: la app se ve diminuta y,
  // además, las media queries de móvil (<480 px) nunca se disparan — se activa
  // el tramo 480-1023 (KPI a 6 columnas, steppers en línea). Es exactamente el
  // síntoma de "web de escritorio reducida".
  //
  // addMetaTag es la ÚNICA vía efectiva. Solo admite 4 nombres: viewport,
  // apple-mobile-web-app-capable, mobile-web-app-capable y google-site-verification.
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover');

  // La app puede embeberse en un iframe de Google Sites / Workspace.
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  return output;
}

/**
 * Devuelve el contenido íntegro de un archivo del proyecto como cadena.
 *
 * Se usa desde los scriptlets `<?!= include('SRC_...') ?>` de index.html para
 * inyectar sin escape:
 *   - SRC_mobile_css.html  (copia verbatim de src/mobile.css)
 *   - SRC_*.html           (copia verbatim de cada módulo de src/)
 *
 * IMPORTANTE — por qué `getRawContent()` y NO `createHtmlOutputFromFile()`:
 * los SRC_*.html no son HTML, son JavaScript y CSS en crudo. Pasar su texto por
 * el parser HTML de HtmlService (createHtmlOutputFromFile + getContent) hace que
 * secuencias del propio código — genéricos de JSDoc como `Array<Object>` u
 * `Object<string, number>`, y fragmentos de plantilla HTML de ui.js — se
 * interpreten como etiquetas y el parser aborte con "Malformed HTML content".
 * `HtmlTemplate.getRawContent()` devuelve el archivo tal cual, sin parsearlo ni
 * evaluar scriptlets, de modo que el módulo llega al navegador byte a byte
 * dentro del <script>/<style> que ya aporta index.html (no se añade ninguna
 * etiqueta aquí: hacerlo duplicaría el envoltorio).
 *
 * @param {string} filename Nombre del archivo dentro del proyecto GAS.
 * @return {string} Contenido literal del archivo.
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).getRawContent();
}

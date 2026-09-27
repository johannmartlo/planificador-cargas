/**
 * PHASE 18 — VISUAL QA (§23)
 *
 * No hay motor de render en Node, así que este script resuelve la CASCADA REAL
 * de src/mobile.css para cada viewport exigido y comprueba el criterio clave de
 * la fase: que el shell móvil NO parezca un escritorio comprimido, que no haya
 * overflow horizontal y que los objetivos táctiles y safe-areas existan.
 *
 * Uso: node tests/mobile-visual-qa.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const CSS = fs.readFileSync(path.join(SRC, 'mobile.css'), 'utf8');

// ===========================================================================
// 1. Parser de CSS (bloques anidados de un nivel)
// ===========================================================================
const { extractRules } = require(path.join(__dirname, 'helpers', 'css-rules.js'));
const rules = extractRules(CSS);

// ===========================================================================
// 2. Evaluación de media queries y de selectores
// ===========================================================================
function mediaMatches(media, ctx) {
  if (!media) return true;
  return media.split(/\s+and\s+/).map(s => s.trim()).every(raw => {
    // Cada condición llega con sus paréntesis: "(max-width: 1023.98px)"
    const part = raw.replace(/^\(/, '').replace(/\)$/, '').trim();
    let m;
    if ((m = part.match(/^max-width:\s*([0-9.]+)px$/))) return ctx.width <= parseFloat(m[1]);
    if ((m = part.match(/^min-width:\s*([0-9.]+)px$/))) return ctx.width >= parseFloat(m[1]);
    if (part === 'hover: none') return ctx.hoverNone === true;
    if (part.startsWith('prefers-reduced-motion')) return false;
    return false;
  });
}

function matchCompound(el, compound) {
  const re = /(^[a-zA-Z][\w-]*)|(\.[\w-]+)|(#[\w-]+)|(\[[^\]]+\])|(:[\w-]+(?:\([^)]*\))?)/g;
  let m;
  let matchedAny = false;
  while ((m = re.exec(compound)) !== null) {
    matchedAny = true;
    const tok = m[0];
    if (tok[0] === '.') {
      if (!el.classes.includes(tok.slice(1))) return false;
    } else if (tok[0] === '#') {
      if (el.id !== tok.slice(1)) return false;
    } else if (tok[0] === '[') {
      const am = tok.match(/^\[([\w-]+)(?:([~^$*|]?=)"?([^"\]]*)"?)?\]$/);
      if (!am) return false;
      const name = am[1], op = am[2], value = am[3];
      const actual = el.attrs[name];
      if (actual === undefined) return false;
      if (op === '=' && String(actual) !== String(value)) return false;
      if (op === '*=' && !String(actual).includes(value)) return false;
    } else if (tok[0] === ':') {
      // Estado interactivo: en reposo el elemento NO tiene el estado aplicado,
      // de modo que el compuesto no coincide (equivale a :not(:hover)).
      if (/^:(hover|active|focus|focus-visible|focus-within)/.test(tok)) return false;
      if (tok.startsWith(':not(')) {
        if (matchCompound(el, tok.slice(5, -1))) return false;
      } else if (tok.startsWith(':nth-child(')) {
        const arg = tok.slice(11, -1).replace(/\s+/g, '');
        const idx = el.siblingIndex;
        let ok = false;
        let mm;
        if ((mm = arg.match(/^(\d+)n\+(\d+)$/))) {
          const k = +mm[1], b = +mm[2];
          ok = idx >= b && (idx - b) % k === 0;
        } else if ((mm = arg.match(/^(\d+)n$/))) {
          ok = idx % +mm[1] === 0;
        } else if (/^\d+$/.test(arg)) {
          ok = idx === +arg;
        }
        if (!ok) return false;
      } else {
        return false; // pseudo no evaluable en reposo
      }
    } else {
      if (el.tag !== tok.toLowerCase()) return false;
    }
  }
  return matchedAny;
}

/**
 * Descompone un selector en pasos { combinator, compound }.
 * Soporta el combinador descendiente (espacio) y el hijo directo ('>').
 */
function parseSelectorSteps(sel) {
  const steps = [];
  const re = /\s*(>)\s*|\s+/g;
  let last = 0;
  let m;
  let pendingCombinator = null;
  const pushCompound = (text, combinator) => {
    const c = text.trim();
    if (c) steps.push({ combinator: combinator || ' ', compound: c });
  };
  while ((m = re.exec(sel)) !== null) {
    pushCompound(sel.slice(last, m.index), pendingCombinator);
    pendingCombinator = m[1] === '>' ? '>' : ' ';
    last = m.index + m[0].length;
  }
  pushCompound(sel.slice(last), pendingCombinator);
  if (steps.length > 0) steps[0].combinator = null;
  return steps;
}

function selectorMatches(el, sel) {
  const steps = parseSelectorSteps(sel);
  if (steps.length === 0) return false;
  const key = steps[steps.length - 1];
  if (!matchCompound(el, key.compound)) return false;

  let node = el.parent;
  for (let i = steps.length - 2; i >= 0; i--) {
    const step = steps[i];
    if (step.combinator === '>') {
      if (!node || !matchCompound(node, step.compound)) return false;
      node = node.parent;
    } else {
      let found = false;
      let cursor = node;
      while (cursor) {
        if (matchCompound(cursor, step.compound)) { found = true; node = cursor.parent; break; }
        cursor = cursor.parent;
      }
      if (!found) return false;
    }
  }
  return true;
}

function specificity(sel) {
  let a = 0, b = 0, c = 0;
  const re = /(#[A-Za-z_][\w-]*)|(\.[A-Za-z_][\w-]*)|(\[[^\]]+\])|(:[A-Za-z-]+(?:\([^)]*\))?)|(^|\s)([a-zA-Z][\w-]*)/g;
  let m;
  while ((m = re.exec(sel)) !== null) {
    if (m[1]) a++;
    else if (m[2] || m[3] || m[4]) b++;
    else if (m[6]) c++;
  }
  return a * 10000 + b * 100 + c;
}

const IMPORTANT = 1000000;

/** Resuelve una propiedad para un elemento, con cascada y !important. */
function resolve(el, prop, ctx) {
  let best = null;
  for (const rule of rules) {
    if (!mediaMatches(rule.media, ctx)) continue;
    if (!(prop in rule.decls)) continue;
    const important = /!important/.test(rule.decls[prop]) ? IMPORTANT : 0;
    const value = rule.decls[prop].replace(/\s*!important\s*/, '');
    for (const sel of rule.selectors) {
      if (!selectorMatches(el, sel)) continue;
      const weight = specificity(sel) + important;
      if (!best || weight >= best.weight) best = { value, weight, order: rule.order };
    }
  }
  return best ? best.value : null;
}

const SHOWN = ['block', 'flex', 'grid', 'inline-flex'];

/** display efectivo, honrando el atributo hidden sobre el propio nodo. */
function display(el, ctx) {
  const own = resolve(el, 'display', ctx);
  if (el.attrs.hidden !== undefined && !SHOWN.includes(own)) return 'none';
  return own || 'block';
}

/** ¿Es visible el nodo, considerando también a sus ancestros? */
function visible(el, ctx) {
  let node = el;
  while (node) {
    if (node.attrs.hidden !== undefined) {
      if (!SHOWN.includes(resolve(node, 'display', ctx))) return false;
    }
    if (node === el) {
      if (display(node, ctx) === 'none') return false;
    } else if (resolve(node, 'display', ctx) === 'none') {
      return false;
    }
    node = node.parent;
  }
  return true;
}

// ===========================================================================
// 3. Árbol DOM que resume el shell móvil real
// ===========================================================================
function makeEl(tag, opts) {
  opts = opts || {};
  const node = {
    tag: String(tag).toLowerCase(),
    id: opts.id || '',
    classes: String(opts.classes || '').split(/\s+/).filter(Boolean),
    attrs: {},
    parent: null,
    children: [],
    siblingIndex: 0
  };
  if (opts.id) node.attrs.id = opts.id;
  if (opts.classes) node.attrs.class = opts.classes;
  for (const [k, v] of Object.entries(opts.attrs || {})) node.attrs[k] = v;
  return node;
}

function attach(parent, child) {
  child.parent = parent;
  child.siblingIndex = parent.children.length + 1;
  parent.children.push(child);
  return child;
}

function buildDom(view) {
  const html = makeEl('html', { attrs: { 'data-theme': 'dark' } });
  const body = attach(html, makeEl('body'));

  const header = attach(body, makeEl('header', { id: 'mobile-header', classes: 'mobile-only' }));
  const mhRow = attach(header, makeEl('div', { classes: 'mh-row' }));
  attach(attach(mhRow, makeEl('div', { classes: 'mh-left' })), makeEl('span', { classes: 'mh-dot' }));
  const mhRight = attach(mhRow, makeEl('div', { classes: 'mh-right' }));
  attach(mhRight, makeEl('span', { id: 'badge-delivery-date' }));
  attach(mhRight, makeEl('span', { id: 'badge-plan-status' }));
  attach(mhRight, makeEl('button', { id: 'btn-theme-toggle' }));

  attach(body, makeEl('header', { classes: 'desktop-only' }));

  const main = attach(body, makeEl('main', { attrs: { 'data-view': view } }));

  // Resumen compacto (§5)
  const kpi = attach(main, makeEl('section', { id: 'mobile-kpi-summary', classes: 'mobile-only' }));
  const grid = attach(kpi, makeEl('div', { classes: 'mk-grid' }));
  const kpiIds = ['mkpi-boxes', 'mkpi-assigned', 'mkpi-pending', 'mkpi-platforms', 'mkpi-pallets', 'mkpi-towers'];
  kpiIds.forEach(id => {
    const cell = attach(grid, makeEl('div', {
      classes: 'mk-cell' + (id === 'mkpi-assigned' ? ' is-assigned' : '') +
        (id === 'mkpi-pending' ? ' is-pending is-zero' : '')
    }));
    attach(cell, makeEl('span', { classes: 'mk-value', id }));
    attach(cell, makeEl('span', { classes: 'mk-label' }));
  });
  attach(kpi, makeEl('div', { classes: 'mk-foot', id: 'mkpi-foot' }));

  // Previsión (§11)
  const prevision = attach(main, makeEl('section', { id: 'prevision-section', attrs: { 'data-view': 'forecast' } }));
  attach(prevision, makeEl('textarea', { id: 'tsv-input' }));
  attach(prevision, makeEl('button', { id: 'btn-analyze' }));
  attach(prevision, makeEl('div', { id: 'forecast-analysis-card', attrs: { hidden: 'hidden' } }));

  // Stock (§12)
  const stock = attach(main, makeEl('section', { id: 'stock-section', attrs: { 'data-view': 'stock' } }));
  const stockRow = attach(stock, makeEl('div', { classes: 'grid grid-cols-12 gap-3 py-2 items-center text-sm' }));
  const stepper = attach(stockRow, makeEl('div', { classes: 'stock-stepper' }));
  attach(stepper, makeEl('button', { classes: 'stock-step' }));
  attach(stepper, makeEl('input', { id: 'stock-pera', attrs: { type: 'number' } }));
  attach(stepper, makeEl('span', { classes: 'stock-unit' }));
  attach(stepper, makeEl('button', { classes: 'stock-step' }));

  // Locks (§13)
  const locks = attach(main, makeEl('section', { id: 'locks-section', attrs: { 'data-view': 'locks' } }));
  const pills = attach(locks, makeEl('div', { id: 'lock-platform-pills' }));
  attach(pills, makeEl('button', { classes: 'btn-select-lock-plat', attrs: { 'data-lock-plat': 'CENTRO' } }));
  const lockActions = attach(locks, makeEl('div', { id: 'lock-actions-container' }));
  const lockGrid = attach(lockActions, makeEl('div', { classes: 'grid grid-cols-2 sm:grid-cols-4 gap-2' }));
  attach(lockGrid, makeEl('button', { classes: 'btn-lock-action', id: 'btn-lock-pera' }));

  // Opciones avanzadas con la tabla técnica
  const options = attach(main, makeEl('section', { id: 'options-section', attrs: { 'data-view': 'options' } }));
  const details = attach(options, makeEl('details'));
  attach(details, makeEl('summary'));
  const scrollWrap = attach(details, makeEl('div', { classes: 'overflow-x-auto' }));
  const table = attach(scrollWrap, makeEl('table'));
  const tbody = attach(table, makeEl('tbody'));
  const tr = attach(tbody, makeEl('tr'));
  for (let c = 1; c <= 8; c++) attach(tr, makeEl('td'));

  // Resultados: tarjetas de plataforma (§8)
  const results = attach(main, makeEl('div', { id: 'results-column' }));
  const cards = attach(results, makeEl('div', { id: 'platform-plan-cards-container' }));
  const card = attach(cards, makeEl('div', { classes: 'digital-loading-card', attrs: { 'data-platform': 'CENTRO' } }));
  const cardHead = attach(card, makeEl('div', { classes: 'flex items-center justify-between' }));
  attach(cardHead, makeEl('h3'));
  attach(cardHead, makeEl('span', { classes: 'card-badge' }));
  // FASE 18.2: el marcado real (src/ui.js) incluye una fila con el TOTAL de la
  // plataforma antes de las filas de producto. El modelo debe reproducirla o
  // las comprobaciones de jerarquía medirían el elemento equivocado.
  const totalRow = attach(card, makeEl('div', { classes: 'mt-0.5 flex items-baseline justify-between' }));
  attach(totalRow, makeEl('span', { classes: 'text-2xl font-mono font-extrabold card-boxes tabular-nums tracking-tight' }));
  attach(totalRow, makeEl('span', { classes: 'text-[11px] font-mono font-semibold uppercase tracking-wider' }));
  const prodRow = attach(card, makeEl('div', { classes: 'grid grid-cols-12 gap-1 items-center py-1 px-1' }));
  attach(prodRow, makeEl('div', { classes: 'col-span-6 text-prod truncate' }));
  attach(prodRow, makeEl('div', { classes: 'col-span-3 card-boxes' }));
  attach(prodRow, makeEl('div', { classes: 'col-span-3 badge-pallet' }));
  attach(card, makeEl('button', { classes: 'btn-platform-detail', attrs: { 'data-platform': 'CENTRO' } }));

  attach(main, makeEl('section', { id: 'warnings-errors-section', attrs: { hidden: 'hidden' } }));
  attach(main, makeEl('section', { id: 'actions-toolbar', classes: 'hidden', attrs: { 'data-view': 'more' } }));

  // Vista "MÁS"
  const moreSection = attach(main, makeEl('section', { id: 'mobile-more-section', classes: 'mobile-only' }));
  const mmList = attach(moreSection, makeEl('div', { classes: 'mm-list' }));
  for (const id of ['btn-more-export-pdf', 'btn-more-export-whatsapp', 'btn-more-print']) {
    attach(mmList, makeEl('button', { classes: 'mm-item', id }));
  }

  // Detalle de plataforma (§9)
  const modal = attach(main, makeEl('div', {
    id: 'platform-detail-modal',
    classes: 'platform-detail-modal mobile-only',
    attrs: { hidden: 'hidden', role: 'dialog' }
  }));
  const pdmHead = attach(modal, makeEl('div', { classes: 'pdm-head' }));
  const pdmTitle = attach(pdmHead, makeEl('div', { classes: 'pdm-title' }));
  attach(pdmTitle, makeEl('span', { classes: 'pdm-kicker' }));
  attach(pdmTitle, makeEl('span', { classes: 'pdm-name', id: 'pdm-platform-name' }));
  attach(pdmHead, makeEl('button', { classes: 'pdm-close', id: 'pdm-close' }));
  const pdmBody = attach(modal, makeEl('div', { classes: 'pdm-body', id: 'pdm-body' }));
  const hero = attach(pdmBody, makeEl('div', { classes: 'pdm-hero' }));
  for (let k = 0; k < 3; k++) attach(hero, makeEl('div'));
  const prod = attach(pdmBody, makeEl('div', { classes: 'pdm-prod' }));
  const prodHead = attach(prod, makeEl('div', { classes: 'pdm-prod-head' }));
  const prodInfo = attach(prodHead, makeEl('div'));
  attach(prodInfo, makeEl('div', { classes: 'pdm-prod-name' }));
  attach(prodInfo, makeEl('span', { classes: 'pdm-prod-var' }));
  const prodBoxes = attach(prodHead, makeEl('div', { classes: 'pdm-prod-boxes' }));
  attach(prodBoxes, makeEl('b'));
  const tower = attach(pdmBody, makeEl('div', { classes: 'pdm-tower' }));
  const towerHead = attach(tower, makeEl('div', { classes: 'pdm-tower-head' }));
  attach(towerHead, makeEl('span', { classes: 'pdm-tower-name' }));
  attach(towerHead, makeEl('span', { classes: 'pdm-tower-h' }));
  const towerBody = attach(tower, makeEl('div', { classes: 'pdm-tower-body' }));
  const tpallet = attach(towerBody, makeEl('div', { classes: 'pdm-tpallet' }));
  attach(tpallet, makeEl('div', { classes: 'pdm-tpallet-top' }));
  attach(tpallet, makeEl('div', { classes: 'pdm-tpallet-sub' }));

  attach(body, makeEl('footer', { classes: 'desktop-only' }));

  const tabbar = attach(body, makeEl('nav', { id: 'mobile-tabbar', classes: 'mobile-only' }));
  for (const v of ['forecast', 'stock', 'plan', 'more']) {
    const tab = attach(tabbar, makeEl('button', { classes: 'mt-tab', attrs: { 'data-nav-view': v } }));
    attach(tab, makeEl('span', { classes: 'mt-ico' }));
    attach(tab, makeEl('span'));
  }

  return { html, body, main };
}

function collect(root, pred) {
  const out = [];
  (function walk(n) {
    for (const c of n.children) {
      if (pred(c)) out.push(c);
      walk(c);
    }
  })(root);
  return out;
}
const byId = (root, id) => collect(root, n => n.id === id)[0] || null;
const byClass = (root, cls) => collect(root, n => n.classes.includes(cls));
/** Localiza por conjunto de clases, robusto frente a tokens de Tailwind extra. */
const byClasses = (root, classes) => {
  const want = classes.split(/\s+/).filter(Boolean);
  return collect(root, n => want.every(c => n.classes.includes(c)));
};

// ===========================================================================
// 4. Comprobaciones
// ===========================================================================
const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: (e && e.message) || String(e) }); }
}

const VIEWPORTS = [
  { w: 320, h: 568, label: '320x568' },
  { w: 360, h: 800, label: '360x800' },
  { w: 375, h: 812, label: '375x812' },
  { w: 390, h: 844, label: '390x844' },
  { w: 430, h: 932, label: '430x932' },
  { w: 480, h: 800, label: '480x800' }
];

const VIEW_TARGET = {
  forecast: 'prevision-section',
  stock: 'stock-section',
  locks: 'locks-section',
  options: 'options-section',
  more: 'actions-toolbar'
};
// El resumen compacto vive SÓLO en la vista PLAN, por eso se comprueba aparte.
const ROUTED_IDS = ['prevision-section', 'stock-section', 'locks-section',
  'options-section', 'results-column', 'mobile-more-section'];

for (const vp of VIEWPORTS) {
  const ctx = { width: vp.w, height: vp.h, hoverNone: true };
  const dom = buildDom('plan');

  check(`${vp.label} · shell móvil activo (header + resumen + tabbar)`, () => {
    assert.strictEqual(display(byId(dom.body, 'mobile-header'), ctx), 'block', 'header móvil');
    assert.strictEqual(display(byId(dom.body, 'mobile-kpi-summary'), ctx), 'block', 'resumen móvil');
    assert.strictEqual(display(byId(dom.body, 'mobile-tabbar'), ctx), 'grid', 'tabbar');
  });

  check(`${vp.label} · el shell de escritorio queda oculto`, () => {
    const desktops = dom.body.children.filter(c => c.classes.includes('desktop-only'));
    assert.ok(desktops.length >= 2, 'esperados header y footer desktop-only');
    for (const e of desktops) {
      assert.strictEqual(display(e, ctx), 'none', `desktop-only visible: ${e.tag}`);
    }
  });

  check(`${vp.label} · vista PLAN: sólo resumen + plan + incidencias`, () => {
    assert.strictEqual(display(byId(dom.main, 'mobile-kpi-summary'), ctx), 'block');
    assert.strictEqual(display(byId(dom.main, 'results-column'), ctx), 'block');
    for (const id of ['prevision-section', 'stock-section', 'locks-section',
      'options-section', 'mobile-more-section']) {
      assert.strictEqual(display(byId(dom.main, id), ctx), 'none', `${id} visible en PLAN`);
    }
  });

  for (const view of Object.keys(VIEW_TARGET)) {
    check(`${vp.label} · vista ${view.toUpperCase()} aísla su sección`, () => {
      const d = buildDom(view);
      for (const id of ROUTED_IDS) {
        const node = byId(d.main, id);
        if (!node) continue;
        const shown = display(node, ctx);
        if (id === VIEW_TARGET[view]) {
          assert.notStrictEqual(shown, 'none', `${id} debería verse en ${view}`);
        } else if (id === 'mobile-more-section') {
          assert.strictEqual(shown, view === 'more' ? 'block' : 'none',
            `${id} visibilidad incorrecta en ${view}`);
        } else {
          assert.strictEqual(shown, 'none', `${id} no debería verse en ${view}`);
        }
      }
    });
  }

  check(`${vp.label} · sin scroll horizontal`, () => {
    assert.strictEqual(resolve(dom.html, 'overflow-x', ctx), 'hidden', 'html sin overflow-x hidden');

    const gridCols = resolve(byClass(dom.main, 'mk-grid')[0], 'grid-template-columns', ctx);
    assert.strictEqual(gridCols, vp.w >= 480 ? 'repeat(6, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))');

    const wrap = byClass(dom.main, 'overflow-x-auto')[0];
    assert.strictEqual(resolve(wrap, 'overflow-x', ctx), 'visible',
      'la tabla técnica mantiene el scroll horizontal');

    // Sólo declaraciones reales (se excluyen condiciones @media y min/max-width)
    const dangerous = Array.from(CSS.matchAll(/(^|[;{\s])width:\s*(\d+)px/g))
      .map(m => Number(m[2])).filter(v => v > vp.w);
    assert.deepStrictEqual(dangerous, [], `anchos fijos > ${vp.w}px: ${dangerous.join(', ')}`);
  });

  check(`${vp.label} · plataformas apiladas en una sola columna`, () => {
    const cards = byId(dom.main, 'platform-plan-cards-container');
    assert.strictEqual(resolve(cards, 'display', ctx), 'flex');
    assert.strictEqual(resolve(cards, 'flex-direction', ctx), 'column');
  });

  check(`${vp.label} · la fila de producto es una composición móvil, no una tabla`, () => {
    const card = byClass(dom.main, 'digital-loading-card')[0];
    const prodRow = byClass(card, 'grid')[0];
    // FASE 18.2: producto + palets a la izquierda y las CAJAS dominando a la
    // derecha. Sigue sin ser una tabla de escritorio comprimida: es una
    // composición de dos zonas con el nombre sin truncar.
    assert.strictEqual(resolve(prodRow, 'display', ctx), 'grid', 'la fila debe componerse en grid');
    const areas = resolve(prodRow, 'grid-template-areas', ctx) || '';
    assert.ok(/prod/.test(areas), `la fila no declara el área de producto: ${areas}`);
    assert.ok(/boxes/.test(areas), `la fila no declara el área de cajas: ${areas}`);
    const cols = resolve(prodRow, 'grid-template-columns', ctx) || '';
    assert.ok(/minmax\(0,\s*1fr\)/.test(cols),
      `la fila no reserva una columna elástica (riesgo de overflow): ${cols}`);
    assert.ok(/auto/.test(cols), `la fila no reserva la columna de la cifra: ${cols}`);

    const prodName = byClass(card, 'col-span-6')[0];
    assert.strictEqual(resolve(prodName, 'white-space', ctx), 'normal', 'el nombre no debe truncarse');
    assert.strictEqual(resolve(prodName, 'overflow', ctx), 'visible');
    assert.strictEqual(resolve(prodName, 'grid-area', ctx), 'prod', 'el producto debe ir a la izquierda');

    const boxes = byClass(prodRow, 'card-boxes')[0];
    assert.strictEqual(resolve(boxes, 'grid-area', ctx), 'boxes', 'las cajas deben ir a la derecha');
    assert.ok(parseFloat(resolve(boxes, 'font-size', ctx)) >= 17,
      'las cajas deben ser legibles de un vistazo');
  });

  check(`${vp.label} · detalle de plataforma a pantalla completa y cerrado por defecto`, () => {
    const modal = byId(dom.main, 'platform-detail-modal');
    assert.strictEqual(resolve(modal, 'position', ctx), 'fixed');
    assert.strictEqual(resolve(modal, 'inset', ctx), '0');
    assert.strictEqual(visible(modal, ctx), false, 'el detalle debe arrancar cerrado');
    const head = byClass(modal, 'pdm-head')[0];
    assert.ok(head, 'no se localizó la cabecera del detalle');
    assert.strictEqual(resolve(head, 'position', ctx), 'sticky');
    const closeBtn = byId(modal, 'pdm-close');
    assert.ok(closeBtn, 'no se localizó el botón de cierre del detalle');
    assert.strictEqual(resolve(closeBtn, 'width', ctx), 'var(--m-touch)');
  });

  check(`${vp.label} · tabbar inferior: 4 destinos >=56px con safe-area`, () => {
    const tabbar = byId(dom.body, 'mobile-tabbar');
    assert.strictEqual(resolve(tabbar, 'position', ctx), 'fixed');
    assert.strictEqual(resolve(tabbar, 'bottom', ctx), '0');
    assert.strictEqual(resolve(tabbar, 'grid-template-columns', ctx), 'repeat(4, minmax(0, 1fr))');
    assert.strictEqual(resolve(tabbar, 'padding-bottom', ctx), 'env(safe-area-inset-bottom, 0px)');
    const tab = byClass(tabbar, 'mt-tab')[0];
    assert.ok(tab, 'no se localizó ningún destino de la tabbar');
    assert.strictEqual(resolve(tab, 'min-height', ctx), 'var(--m-nav-h)');
    assert.strictEqual(resolve(tab, 'touch-action', ctx), 'manipulation');
  });

  check(`${vp.label} · header compacto, sticky y con safe-area`, () => {
    const header = byId(dom.body, 'mobile-header');
    assert.strictEqual(resolve(header, 'position', ctx), 'sticky');
    assert.strictEqual(resolve(header, 'top', ctx), '0');
    assert.strictEqual(resolve(header, 'padding-top', ctx), 'env(safe-area-inset-top, 0px)');
    const btn = byId(header, 'btn-theme-toggle');
    assert.strictEqual(resolve(btn, 'width', ctx), 'var(--m-touch)');
    assert.strictEqual(resolve(btn, 'height', ctx), 'var(--m-touch)');
  });

  check(`${vp.label} · main reserva espacio para la tabbar`, () => {
    const pad = resolve(dom.main, 'padding-bottom', ctx);
    assert.ok(pad && pad.includes('env(safe-area-inset-bottom, 0px)'), `sin safe-area: ${pad}`);
    // FASE 18.1: la tabbar crece a 68px, la reserva sube de 76px a 96px.
    assert.ok(pad.includes('96px'), `espacio insuficiente para la tabbar: ${pad}`);
  });

  check(`${vp.label} · stock con inputs y steppers táctiles`, () => {
    const input = byId(dom.main, 'stock-pera');
    assert.strictEqual(resolve(input, 'height', ctx), 'var(--m-touch-lg)');
    assert.ok(parseFloat(resolve(input, 'font-size', ctx)) >= 17, 'fuente del stock pequeña');
    const step = byClass(dom.main, 'stock-step')[0];
    assert.strictEqual(resolve(step, 'width', ctx), 'var(--m-touch-lg)');
    assert.strictEqual(resolve(step, 'height', ctx), 'var(--m-touch-lg)');
  });

  check(`${vp.label} · previsión con textarea amplio y acción primaria de 52px`, () => {
    const tsv = byId(dom.main, 'tsv-input');
    assert.ok(resolve(tsv, 'min-height', ctx).includes('vh'), 'textarea no amplio en móvil');
    // FASE 18.1: 16px es el mínimo que evita el auto-zoom de iOS al enfocar.
    assert.ok(parseFloat(resolve(tsv, 'font-size', ctx)) >= 16, 'el textarea provoca auto-zoom en iOS (<16px)');
    const btn = byId(dom.main, 'btn-analyze');
    assert.strictEqual(resolve(btn, 'min-height', ctx), 'var(--m-touch-lg)');
    assert.strictEqual(resolve(btn, 'width', ctx), '100%');
  });

  check(`${vp.label} · locks apilados con objetivos táctiles`, () => {
    const pill = byClass(dom.main, 'btn-select-lock-plat')[0];
    assert.strictEqual(resolve(pill, 'min-height', ctx), 'var(--m-touch)');
    const action = byClass(dom.main, 'btn-lock-action')[0];
    assert.strictEqual(resolve(action, 'min-height', ctx), 'var(--m-touch-lg)');
    const lockGrid = byClasses(dom.main, 'grid grid-cols-2')[0];
    assert.ok(lockGrid, 'no se localizó la rejilla de acciones de bloqueo');
    // 320-479: una sola columna. 480-1023 (tablet vertical): dos columnas.
    const expectedLocks = vp.w >= 480 ? 'repeat(2, minmax(0, 1fr))' : '1fr';
    assert.strictEqual(resolve(lockGrid, 'grid-template-columns', ctx), expectedLocks,
      `rejilla de locks incorrecta en ${vp.label}`);
  });

  check(`${vp.label} · la tabla técnica pasa a tarjetas apiladas`, () => {
    const optionsSection = byId(dom.main, 'options-section');
    assert.ok(optionsSection, 'no se localizó #options-section');
    const wrap = byClass(optionsSection, 'overflow-x-auto')[0];
    assert.ok(wrap, 'no se localizó el contenedor de la tabla técnica');
    const table = wrap.children[0];
    assert.ok(table, 'no se localizó la tabla técnica');
    assert.strictEqual(resolve(table, 'display', ctx), 'block');
    const tbody = collect(table, n => n.tag === 'tbody')[0];
    assert.ok(tbody, 'no se localizó el <tbody> de la tabla técnica');
    const tr = tbody.children[0];
    assert.strictEqual(resolve(tr, 'display', ctx), 'block');
    const td = tr.children[0];
    assert.strictEqual(resolve(td, 'display', ctx), 'block');
    assert.strictEqual(resolve(td, 'text-align', ctx), 'left');
    assert.strictEqual(resolve(td, 'white-space', ctx), 'normal');
  });

  check(`${vp.label} · "MÁS" con botones de 52px a ancho completo`, () => {
    const item = byClass(dom.main, 'mm-item')[0];
    assert.strictEqual(resolve(item, 'min-height', ctx), 'var(--m-touch-lg)');
    assert.strictEqual(resolve(item, 'width', ctx), '100%');
    assert.strictEqual(resolve(item, 'touch-action', ctx), 'manipulation');
  });

  check(`${vp.label} · jerarquía tipográfica y legibilidad`, () => {
    const card = byClass(dom.main, 'digital-loading-card')[0];
    const platformName = card.children[0].children[0];
    const platformTotal = byClass(card, 'card-boxes')[0];                  // total de la plataforma
    const prodBoxes = byClass(byClass(card, 'grid')[0], 'card-boxes')[0];   // cajas de un producto
    const kpiValue = byClass(dom.main, 'mk-value')[0];
    const foot = byId(dom.body, 'mkpi-foot');

    const sizeOf = n => parseFloat(resolve(n, 'font-size', ctx));
    const compact = vp.w <= 360; // tramo móvil estrecho: un punto menos
    assert.ok(sizeOf(platformName) >= (compact ? 16 : 17),
      `nombre de plataforma ${sizeOf(platformName)}px demasiado pequeño`);
    assert.ok(sizeOf(kpiValue) >= (compact ? 16 : 17),
      `valor KPI ${sizeOf(kpiValue)}px demasiado pequeño`);
    assert.ok(sizeOf(foot) >= 9, `pie del resumen ${sizeOf(foot)}px < 9px`);

    // FASE 18.2 · jerarquía operativa: el TOTAL de la plataforma manda, después
    // la cifra de cada producto, y ambas pesan más que el nombre.
    assert.ok(sizeOf(platformTotal) >= (compact ? 26 : 28),
      `total de plataforma ${sizeOf(platformTotal)}px demasiado pequeño`);
    assert.ok(sizeOf(prodBoxes) >= (compact ? 22 : 24),
      `cajas de producto ${sizeOf(prodBoxes)}px demasiado pequeñas`);
    assert.ok(sizeOf(platformTotal) > sizeOf(prodBoxes),
      `el total (${sizeOf(platformTotal)}px) debe imponerse a la cifra de producto (${sizeOf(prodBoxes)}px)`);
    assert.ok(sizeOf(prodBoxes) > sizeOf(platformName),
      `las cajas (${sizeOf(prodBoxes)}px) deben pesar más que el nombre (${sizeOf(platformName)}px)`);
  });

  check(`${vp.label} · sin hover obligatorio (táctil puro)`, () => {
    // En reposo ningún estado :hover está aplicado (el matcher lo excluye, como
    // hace el navegador). Lo relevante es que TODA regla :hover del shell móvil
    // esté además acotada a (hover: none) para neutralizarse en táctil.
    const hoverRules = rules.filter(r => r.selectors.some(s => /:hover/.test(s)));
    assert.ok(hoverRules.length > 0, 'no se encontró ninguna regla :hover en mobile.css');
    for (const r of hoverRules) {
      assert.ok(r.media && r.media.includes('hover: none'),
        `regla :hover sin acotar a táctil: ${r.selectors.join(', ')} [${r.media}]`);
    }
    // El hover de escritorio de la tarjeta no deja borde activo en reposo táctil
    const card = byClass(dom.main, 'digital-loading-card')[0];
    const border = resolve(card, 'border-color', ctx);
    assert.ok(border === null || border !== 'var(--clr-border-active)',
      `el borde activo de hover quedó aplicado en táctil: ${border}`);
  });
}

// ===========================================================================
// 4b. FASE 18.1 · SUELO DE LEGIBILIDAD Y TACTILIDAD
// ===========================================================================
check('legibilidad · ninguna declaración de la capa móvil baja de 11px', () => {
  // Se recorren las reglas que aplican en algún viewport móvil exigido.
  const mobileCtx = [
    { width: 320, height: 568, hoverNone: true },
    { width: 360, height: 800, hoverNone: true },
    { width: 390, height: 844, hoverNone: true },
    { width: 430, height: 932, hoverNone: true },
    { width: 480, height: 800, hoverNone: true }
  ];
  const offenders = [];
  for (const rule of rules) {
    const size = rule.decls['font-size'];
    if (!size) continue;
    const n = parseFloat(size);
    if (isNaN(n) || n >= 11) continue;
    const applies = mobileCtx.some(ctx => mediaMatches(rule.media, ctx));
    if (applies) offenders.push(`${rule.selectors.join(', ')} = ${n}px [${rule.media || 'global'}]`);
  }
  assert.deepStrictEqual(offenders, [], `texto por debajo del suelo de 11px:\n        ${offenders.join('\n        ')}`);
});

check('tactilidad · ningún objetivo táctil declarado por debajo de 44px', () => {
  // Botones, inputs y controles interactivos del shell móvil.
  const TARGETS = /(^|[\s,])(button|input|select|textarea|summary)\b|\.mt-tab|\.stock-step|\.mm-item|\.btn-|\.pdm-close/;
  // Los pseudo-elementos son decorativos (p. ej. la barra indicadora de 2px del
  // destino activo), no superficies táctiles.
  const DECORATIVE = /::(before|after)/;
  const offenders = [];
  for (const rule of rules) {
    const applies = mediaMatches(rule.media, { width: 390, height: 844, hoverNone: true });
    if (!applies) continue;
    if (!rule.selectors.some(s => TARGETS.test(s) && !DECORATIVE.test(s))) continue;
    for (const prop of ['min-height', 'height']) {
      const v = rule.decls[prop];
      if (!v) continue;
      const n = parseFloat(v);
      if (isNaN(n)) continue;              // vh/%/env/var: no comparable
      if (n < 44) offenders.push(`${rule.selectors.join(', ')} ${prop}=${n}px`);
    }
  }
  assert.deepStrictEqual(offenders, [], `objetivos táctiles < 44px:\n        ${offenders.join('\n        ')}`);
});

// ===========================================================================
// 5. Criterio clave y no-regresión de escritorio
// ===========================================================================
check('criterio clave · el móvil NO replica la estructura de escritorio', () => {
  const ctx = { width: 390, height: 844, hoverNone: true };
  const dom = buildDom('plan');

  assert.strictEqual(resolve(byId(dom.main, 'mobile-kpi-summary'), 'display', ctx), 'block');
  assert.strictEqual(resolve(byClass(dom.main, 'mk-grid')[0], 'display', ctx), 'grid');
  assert.strictEqual(resolve(byId(dom.main, 'platform-plan-cards-container'), 'flex-direction', ctx), 'column');
  assert.strictEqual(resolve(byId(dom.body, 'mobile-tabbar'), 'position', ctx), 'fixed');
  assert.strictEqual(resolve(byId(dom.main, 'platform-detail-modal'), 'position', ctx), 'fixed');

  const detailBtn = byClass(dom.main, 'btn-platform-detail')[0];
  assert.strictEqual(resolve(detailBtn, 'display', ctx), 'flex');
  assert.strictEqual(resolve(detailBtn, 'width', ctx), '100%');
  assert.strictEqual(resolve(detailBtn, 'min-height', ctx), 'var(--m-touch-lg)');

  assert.strictEqual(resolve(byId(dom.body, 'mobile-header'), 'display', ctx), 'block');
});

check('no-regresión · a 1280px el shell móvil está OCULTO y no filtra maquetación', () => {
  const ctx = { width: 1280, height: 900, hoverNone: false };
  const dom = buildDom('plan');
  // FASE 18.4 · BUG CORREGIDO. Este test comprobaba que "ninguna regla móvil
  // aplica" a 1280px, lo que NO equivale a estar oculto: si no aplica ninguna
  // regla, el elemento conserva el `display` por defecto del navegador (block)
  // y el chrome móvil (header, KPI, MÁS, tabbar) SE VEÍA en escritorio. Había
  // que exigir explícitamente display: none.
  assert.strictEqual(resolve(byId(dom.body, 'mobile-header'), 'display', ctx), 'none',
    'el header móvil se ve en escritorio');
  assert.strictEqual(resolve(byId(dom.body, 'mobile-tabbar'), 'display', ctx), 'none',
    'la tabbar móvil se ve en escritorio');
  assert.strictEqual(resolve(byId(dom.main, 'mobile-kpi-summary'), 'display', ctx), 'none',
    'el resumen KPI móvil se ve en escritorio');
  assert.strictEqual(resolve(byId(dom.main, 'platform-detail-modal'), 'display', ctx), 'none',
    'el modal móvil se ve en escritorio');

  // Y ninguna regla de MAQUETACIÓN móvil debe filtrarse al escritorio.
  assert.strictEqual(resolve(byId(dom.body, 'mobile-tabbar'), 'position', ctx), null);
  assert.strictEqual(resolve(byClass(dom.main, 'digital-loading-card')[0], 'padding', ctx), null);
  assert.strictEqual(resolve(byId(dom.main, 'platform-detail-modal'), 'position', ctx), null);
  assert.strictEqual(resolve(byId(dom.main, 'results-column'), 'width', ctx), null);
  assert.strictEqual(resolve(dom.main, 'padding-bottom', ctx), null);
  assert.strictEqual(resolve(byClass(dom.main, 'mk-grid')[0], 'grid-template-columns', ctx), null);
});

// ===========================================================================
// Informe
// ===========================================================================
const byViewport = {};
for (const r of results) {
  const key = r.name.split(' · ')[0];
  byViewport[key] = byViewport[key] || { pass: 0, fail: 0 };
  byViewport[key][r.ok ? 'pass' : 'fail']++;
}

let failed = 0;
console.log('\n=== FASE 18 · VISUAL QA (cascada CSS resuelta) ===\n');
console.log(`Reglas CSS parseadas: ${rules.length} (con media: ${rules.filter(r => r.media).length})\n`);
for (const r of results) {
  if (r.ok) {
    console.log(`  PASS  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}
console.log('\nResumen por viewport:');
for (const [k, v] of Object.entries(byViewport)) {
  console.log(`  ${k.padEnd(16)} ${v.pass} PASS / ${v.fail} FAIL`);
}
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
process.exit(failed === 0 ? 0 : 1);
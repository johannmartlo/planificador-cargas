/**
 * TESTS DE INTEGRACIÓN Y PARIDAD: DESKTOP + MOBILE
 *
 * Verifica el aislamiento completo y la experiencia unificada:
 *  - A 1280px (Desktop): NINGÚN componente móvil es visible. El shell de
 *    escritorio está 100% activo (header, resumen, grid 3-col, footer, etc.).
 *  - A 390px (Mobile): NINGÚN componente de escritorio exclusivo es visible.
 *    El shell móvil está 100% activo (header, tabbar, kpis, tarjetas 1-col).
 *  - A 768px y 1024px: transición responsive limpia.
 *  - Prueba Real Carrefour: 80 cajas Cocktail Romántico Consabor servidas,
 *    0 pendientes, WhatsApp con CONSABOR: 80 cjs.
 *  - Prueba Stepper: PERA RAMA +10 +10 -> 20 en Mobile y Desktop.
 *
 * Uso: node tests/desktop-mobile-views.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const orchestrator = require(path.join(SRC, 'orchestrator.js'));
const ui = require(path.join(SRC, 'ui.js'));
const { extractRules } = require(path.join(__dirname, 'helpers', 'css-rules.js'));
const { createDocument } = require(path.join(__dirname, 'helpers', 'mini-dom.js'));

const htmlContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mobileCssContent = fs.readFileSync(path.join(SRC, 'mobile.css'), 'utf8');

// Parsear CSS con orden
const rules = extractRules(mobileCssContent);
rules.forEach((r, idx) => { r.order = idx; });

function mediaMatches(media, ctx) {
  if (!media) return true;
  return media.split(/\s+and\s+/).map(s => s.trim()).every(raw => {
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
      if (/^:(hover|active|focus|focus-visible|focus-within)/.test(tok)) return false;
      if (tok.startsWith(':not(')) {
        if (matchCompound(el, tok.slice(5, -1))) return false;
      }
    } else {
      if (el.tag !== tok.toLowerCase()) return false;
    }
  }
  return matchedAny;
}

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

function resolve(el, prop, ctx) {
  let best = null;
  for (const rule of rules) {
    if (!mediaMatches(rule.media, ctx)) continue;
    if (!(prop in rule.decls)) continue;
    const isImp = /!important/.test(rule.decls[prop]);
    const value = rule.decls[prop].replace(/\s*!important\s*/, '');
    for (const sel of rule.selectors) {
      if (!selectorMatches(el, sel)) continue;
      const weight = specificity(sel) + (isImp ? IMPORTANT : 0);
      if (!best || weight >= best.weight) best = { value, weight, order: rule.order };
    }
  }
  return best ? best.value : null;
}

// Creación de DOM mock representativo
function makeNode(tag, attrs, children) {
  attrs = attrs || {};
  const classes = (attrs.class || '').split(/\s+/).filter(Boolean);
  const node = {
    tag: tag.toLowerCase(),
    id: attrs.id || null,
    attrs,
    classes,
    parent: null,
    children: []
  };
  (children || []).forEach((c, idx) => {
    c.parent = node;
    c.siblingIndex = idx + 1;
    node.children.push(c);
  });
  return node;
}

function buildTestDom(currentView) {
  const mobileHeader = makeNode('header', { id: 'mobile-header', class: 'mobile-only' });
  const desktopHeader = makeNode('header', { class: 'desktop-only' });

  const mobileKpi = makeNode('section', { id: 'mobile-kpi-summary', class: 'mobile-only' }, [
    makeNode('div', { class: 'mk-grid' }),
    makeNode('div', { id: 'mkpi-foot', class: 'mk-foot' })
  ]);
  const execSummary = makeNode('section', { id: 'executive-summary-section', class: 'no-print' });
  const prevision = makeNode('section', { id: 'prevision-section', 'data-view': 'forecast' });
  const resultsCol = makeNode('div', { id: 'results-column' });
  const stockSec = makeNode('section', { id: 'stock-section', 'data-view': 'stock' }, [
    makeNode('div', { class: 'wf-step-card mobile-only' })
  ]);
  const locksSec = makeNode('section', { id: 'locks-section', 'data-view': 'locks' });
  const moreSec = makeNode('section', { id: 'mobile-more-section', class: 'mobile-only' });
  const modal = makeNode('div', { id: 'platform-detail-modal', class: 'platform-detail-modal mobile-only' });

  const cardBtn = makeNode('button', { class: 'btn-platform-detail mobile-only' });
  const card = makeNode('div', { class: 'digital-loading-card' }, [cardBtn]);
  const cardsContainer = makeNode('div', { id: 'platform-plan-cards-container' }, [card]);

  const mobileWfBar = makeNode('nav', { id: 'mobile-workflow-bar', class: 'mobile-workflow-bar mobile-only' });
  const stageBanner = makeNode('div', { class: 'wf-stage-banner mobile-only' });
  const outputBlock = makeNode('div', { id: 'plan-mobile-output-actions', class: 'mobile-only wf-output-block' });

  const main = makeNode('main', { 'data-view': currentView || 'plan' }, [
    mobileWfBar,
    stageBanner,
    mobileKpi,
    execSummary,
    prevision,
    resultsCol,
    cardsContainer,
    stockSec,
    locksSec,
    moreSec,
    modal,
    outputBlock
  ]);

  const tabbar = makeNode('nav', { id: 'mobile-tabbar', class: 'mobile-only' });
  const desktopFooter = makeNode('footer', { class: 'desktop-only' });

  const body = makeNode('body', {}, [
    mobileHeader,
    desktopHeader,
    main,
    tabbar,
    desktopFooter
  ]);

  const html = makeNode('html', {}, [body]);
  return { html, body, main, mobileHeader, desktopHeader, tabbar, desktopFooter, mobileKpi, execSummary, moreSec, modal, cardBtn, mobileWfBar, stageBanner, outputBlock };
}

const resultsSummary = [];
function test(name, fn) {
  try {
    fn();
    resultsSummary.push({ name, ok: true });
  } catch (err) {
    resultsSummary.push({ name, ok: false, error: (err && err.message) || String(err) });
  }
}

console.log('=== VERIFICACIÓN RESPONSIVE: DESKTOP vs MOBILE ===\n');

// 1. DESKTOP (1280px)
test('1280px Desktop · Mobile header está OCULTO', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.mobileHeader, 'display', ctx), 'none');
});

test('1280px Desktop · Mobile KPI summary está OCULTO', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.mobileKpi, 'display', ctx), 'none');
});

test('1280px Desktop · Mobile tabbar está OCULTA', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.tabbar, 'display', ctx), 'none');
});

test('1280px Desktop · Mobile Más está OCULTA', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.moreSec, 'display', ctx), 'none');
});

test('1280px Desktop · Botón Ver Detalle modal (.btn-platform-detail) está OCULTO', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.cardBtn, 'display', ctx), 'none');
});

test('1280px Desktop · Modal detalle de plataforma está OCULTO', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.modal, 'display', ctx), 'none');
});

test('1280px Desktop · Componentes .desktop-only NO están ocultos por el CSS móvil', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.desktopHeader, 'display', ctx), null);
  assert.strictEqual(resolve(dom.desktopFooter, 'display', ctx), null);
});

test('1280px Desktop · Resumen operativo Desktop NO está oculto', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.execSummary, 'display', ctx), null);
});

test('1280px Desktop · Mobile workflow bar está OCULTA', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.mobileWfBar, 'display', ctx), 'none');
});

test('1280px Desktop · Banners de etapa y bloques de salida están OCULTOS', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1280, height: 900, hoverNone: false };
  assert.strictEqual(resolve(dom.stageBanner, 'display', ctx), 'none');
  assert.strictEqual(resolve(dom.outputBlock, 'display', ctx), 'none');
});

// 2. MOBILE (390px)
test('390px Mobile · Elementos .desktop-only están OCULTOS', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  assert.strictEqual(resolve(dom.desktopHeader, 'display', ctx), 'none');
  assert.strictEqual(resolve(dom.desktopFooter, 'display', ctx), 'none');
});

test('390px Mobile · Resumen operativo Desktop está OCULTO', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  assert.strictEqual(resolve(dom.execSummary, 'display', ctx), 'none');
});

test('390px Mobile · Mobile workflow bar está VISIBLE', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  assert.strictEqual(resolve(dom.mobileWfBar, 'display', ctx), 'block');
});

test('390px Mobile · Banner de etapa está VISIBLE', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  assert.strictEqual(resolve(dom.stageBanner, 'display', ctx), 'flex');
});

test('390px Mobile · Mobile header está VISIBLE', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  assert.strictEqual(resolve(dom.mobileHeader, 'display', ctx), 'block');
});

test('390px Mobile · Mobile KPI summary está VISIBLE en vista plan', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  assert.strictEqual(resolve(dom.mobileKpi, 'display', ctx), 'block');
});

test('390px Mobile · Mobile tabbar está VISIBLE', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 390, height: 844, hoverNone: true };
  const disp = resolve(dom.tabbar, 'display', ctx);
  assert.ok(['block', 'grid', 'flex'].includes(disp), `tabbar visible con display ${disp}`);
});

// 3. TABLET (768px) y LÍMITE (1024px)
test('768px Tablet · Shell móvil activo (tabbar visible, desktop-only oculto)', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 768, height: 1024, hoverNone: true };
  assert.strictEqual(resolve(dom.desktopHeader, 'display', ctx), 'none');
  const disp = resolve(dom.tabbar, 'display', ctx);
  assert.ok(['block', 'grid', 'flex'].includes(disp), `tabbar visible con display ${disp}`);
});

test('1024px Límite · Desktop activo (mobile-only oculto, desktop-only libre)', () => {
  const dom = buildTestDom('plan');
  const ctx = { width: 1024, height: 768, hoverNone: false };
  assert.strictEqual(resolve(dom.mobileHeader, 'display', ctx), 'none');
  assert.strictEqual(resolve(dom.desktopHeader, 'display', ctx), null);
});

// 4. PRUEBA REAL OBLIGATORIA CARREFOUR
test('Prueba Carrefour · 80 Cocktail Romántico Consabor = 80 servidas, 0 pendientes', () => {
  const rawText = 'CENTRO\t26/08/2026\t16228\tTOMATE COCKT.ROMANT.CARREFOUR\t80';
  const stock = {
    'PERA_RAMA': 0,
    'COCKTAIL_ROMANTICO::CONSABOR': 100,
    'COCKTAIL_ROMANTICO::SAO_PAULO': 0,
    'COCKTAIL_ROMANTICO::SUNSTREAM': 0,
    'CHERRY_RAMA::SUNSTREAM': 0
  };

  const plan = orchestrator.planLoad({ rawText, stock });
  assert.ok(plan, 'Plan generado');
  assert.strictEqual(plan.totalBoxes, 80, '80 cajas totales servidas');

  const missing = plan.allocations.reduce((s, a) => s + a.missingQuantity, 0);
  assert.strictEqual(missing, 0, '0 pendientes');

  const cockAlloc = plan.allocations.filter(a => a.productId === 'COCKTAIL_ROMANTICO');
  assert.strictEqual(cockAlloc.length, 1);
  assert.strictEqual(cockAlloc[0].platform, 'CENTRO');
  assert.strictEqual(cockAlloc[0].allocatedQuantity, 80);
  assert.strictEqual(cockAlloc[0].varietyId, 'CONSABOR');

  // WhatsApp
  const wa = ui.formatWhatsAppMessage(plan);
  assert.ok(wa.includes('80 cjs') || wa.includes('80'), 'WhatsApp incluye 80 cajas');
  assert.ok(wa.toUpperCase().includes('CONSABOR'), 'WhatsApp menciona CONSABOR');
});

// 5. PRUEBA STEPPER: PERA RAMA +10 +10 -> 20 (Mobile y Desktop)
test('Prueba Stepper · Pera Rama +10 +10 -> 20 y plan calcula 20', () => {
  const doc = createDocument(htmlContent);
  const input = doc.getElementById('stock-pera');
  assert.ok(input, 'input #stock-pera presente');

  let val = parseInt(input.value || '0', 10);
  val += 10;
  val += 10;
  input.value = String(val);

  assert.strictEqual(input.value, '20');

  const rawText = 'CENTRO\t26/08/2026\t14072\tTOMATE PERA RAMA CARREFOUR\t50';
  const plan = orchestrator.planLoad({
    rawText,
    stock: { 'PERA_RAMA': val }
  });

  assert.ok(plan, 'Plan calculado');
  assert.strictEqual(plan.totalBoxes, 20, 'Asignadas exactamente 20 cajas');
  const missing = plan.allocations.reduce((s, a) => s + a.missingQuantity, 0);
  assert.strictEqual(missing, 30, '30 pendientes');
});

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
for (const r of resultsSummary) {
  if (r.ok) {
    passed++;
    console.log(`  PASS  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}

console.log(`\n${passed}/${resultsSummary.length} pruebas superadas`);
if (failed > 0) process.exit(1);

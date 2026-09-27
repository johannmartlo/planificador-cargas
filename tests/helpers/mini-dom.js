/**
 * PHASE 18 — Minimal DOM harness for headless Mobile Shell testing.
 *
 * NOT a general-purpose DOM. It implements just enough of the surface used by
 * `UIController.bindMobileShell()`, `setView()`, `renderMobileKpis()` and
 * `openPlatformDetail()` so those methods can be exercised in Node against the
 * REAL PlanningResult. No business logic is stubbed.
 */
'use strict';

function matchesSelector(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  const sel = selector.trim();

  // Consultas compuestas simples usadas por el shell: "tag#id", "#id .cls", "#id"
  const spaceParts = sel.split(/\s+/);
  if (spaceParts.length === 2) {
    return matchesSelector(el, spaceParts[1]) && !!(el.closest && el.closest(spaceParts[0]));
  }

  // Soporte de selectores de atributo: [attr="val"], .cls[attr="val"], o múltiples [a="1"][b="2"]
  let baseSel = sel;
  const bracketIdx = sel.indexOf('[');
  const attrs = [];
  if (bracketIdx !== -1) {
    baseSel = sel.slice(0, bracketIdx);
    const attrPart = sel.slice(bracketIdx);
    const attrRe = /\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]/g;
    let m;
    while ((m = attrRe.exec(attrPart)) !== null) {
      attrs.push({ name: m[1], val: m[2] });
    }
  }

  for (const { name, val } of attrs) {
    const actual = el.getAttribute(name);
    if (val !== undefined) {
      if (actual !== val) return false;
    } else {
      if (actual === null) return false;
    }
  }

  if (!baseSel) return true;
  if (baseSel.startsWith('#')) return el.id === baseSel.slice(1);
  if (baseSel.startsWith('.')) return el.classList.contains(baseSel.slice(1));

  return el.tagName.toLowerCase() === baseSel.toLowerCase();
}

class ClassList {
  constructor(el) { this.el = el; this._set = new Set(); }
  add(...names) { names.forEach(n => n && this._set.add(n)); }
  remove(...names) { names.forEach(n => this._set.delete(n)); }
  contains(name) { return this._set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this._set.has(name) : !!force;
    if (on) this._set.add(name); else this._set.delete(name);
    return on;
  }
  get value() { return Array.from(this._set).join(' '); }
  toString() { return this.value; }
}

class Element {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = String(tagName || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.classList = new ClassList(this);
    this.style = {};
    this.textContent = '';
    this._innerHTML = '';
    this._listeners = {};
    this.hidden = false;
    this.value = '';
    this.disabled = false;
  }

  get id() { return this.attributes.id || ''; }
  set id(v) { this.attributes.id = v; }

  get className() { return this.classList.value; }
  set className(v) {
    this.classList._set = new Set(String(v || '').split(/\s+/).filter(Boolean));
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = value;
    if (name === 'id') this.attributes.id = String(value);
    if (name === 'hidden') this.hidden = true;
  }
  getAttribute(name) {
    if (name === 'class') return this.className;
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'hidden') this.hidden = false;
  }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }

  get innerHTML() {
    if (this._innerHTML) return this._innerHTML;
    // Nodo construido programáticamente (appendChild / createElement):
    // se reconstruye el marcado desde el subárbol.
    if (this.children.length > 0) return this.children.map(serialize).join('');
    return '';
  }
  set innerHTML(html) {
    this._innerHTML = String(html == null ? '' : html);
    this.children = parseFragment(this._innerHTML, this);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }

  addEventListener(type, handler) {
    (this._listeners[type] = this._listeners[type] || []).push(handler);
  }
  removeEventListener(type, handler) {
    const list = this._listeners[type] || [];
    const i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(evt) {
    const type = evt && evt.type;
    (this._listeners[type] || []).forEach(h => h.call(this, evt));
    return true;
  }

  /**
   * Simula un clic con propagación (burbujeo) hasta el ancestro registrado,
   * replicando el comportamiento del navegador: `event.target` es el nodo
   * pulsado y `event.currentTarget` el nodo cuyo listener se ejecuta.
   * Imprescindible para probar la delegación de eventos del shell móvil.
   */
  click() {
    const evt = { type: 'click', bubbles: true, target: this, currentTarget: this };
    this.dispatchEvent(evt);
    if (!evt.bubbles) return;
    let node = this.parentNode;
    while (node) {
      evt.currentTarget = node;
      (node._listeners ? (node._listeners.click || []) : []).forEach(h => h.call(node, evt));
      node = node.parentNode;
    }
  }
  focus() { this._focused = true; }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const out = [];
    const walk = node => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }
}

/**
 * Serializa un subárbol de nodos de vuelta a HTML.
 * Necesario porque el contenido que UIController inserta vía innerHTML se
 * materializa como NODOS: un nodo raíz creado por appendChild no guarda texto.
 */
function serialize(node) {
  if (!node) return '';
  if (node.nodeType === 3) return node.textContent;
  const tag = node.tagName.toLowerCase();
  const attrs = Object.keys(node.attributes)
    .map(k => {
      const v = node.attributes[k];
      return v === '' ? ` ${k}` : ` ${k}="${String(v).replace(/"/g, '&quot;')}"`;
    })
    .join('');
  const inner = node.children.map(serialize).join('');
  return `<${tag}${attrs}>${inner}</${tag}>`;
}
/**
 * Parser de fragmento deliberadamente pequeño: soporta etiquetas anidadas y
 * atributos, que es todo lo que producen los renders del Mobile Shell.
 * No interpreta entidades ni comentarios anidados complejos.
 */
function parseFragment(html, parent) {
  const roots = [];
  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let lastIndex = 0;
  let m;

  const pushText = text => {
    if (!text) return;
    const target = stack.length > 0 ? stack[stack.length - 1] : null;
    if (!target) return;
    for (const ch of target.children) {
      if (ch.nodeType === 3) {
        ch.textContent += text;
        return;
      }
    }
    const t = new Element('#text');
    t.nodeType = 3;
    t.textContent = text;
    t.parentNode = target;
    target.children.push(t);
  };

  while ((m = tagRe.exec(html)) !== null) {
    pushText(html.slice(lastIndex, m.index));
    lastIndex = tagRe.lastIndex;

    const isClose = m[1] === '/';
    const tag = m[2];
    const attrs = m[3] || '';
    const selfClosing = m[4] === '/' || /^(br|img|input|hr|meta|link)$/i.test(tag);

    if (isClose) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName.toLowerCase() === tag.toLowerCase()) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const el = new Element(tag);
    const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*"([^"]*)")?/g;
    let a;
    while ((a = attrRe.exec(attrs)) !== null) {
      if (!a[1]) continue;
      el.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
    }

    if (stack.length > 0) {
      const parentEl = stack[stack.length - 1];
      el.parentNode = parentEl;
      parentEl.children.push(el);
    } else {
      el.parentNode = parent;
      roots.push(el);
    }

    if (!selfClosing) stack.push(el);
  }
  pushText(html.slice(lastIndex));
  return roots;
}

/**
 * Crea un document con el markup indicado. El markup por defecto reproduce los
 * anclajes relevantes del index.html real (mismos IDs).
 */
function createDocument(bodyHtml) {
  const doc = {
    _listeners: {},
    documentElement: new Element('html'),
    body: new Element('body'),
    createElement: tag => new Element(tag),
    serialize,
    getElementById(id) {
      // Búsqueda por atributo: robusta frente a un parseo imperfecto del
      // marcado de prueba (el navegador garantiza lo mismo con su parser real).
      const byAttr = doc.body.querySelectorAll('#' + id)[0];
      if (byAttr) return byAttr;
      const all = [];
      const walk = node => {
        for (const child of node.children) {
          all.push(child);
          walk(child);
        }
      };
      walk(doc.body);
      return all.find(el => el.nodeType === 1 && el.getAttribute('id') === id) || null;
    },
    querySelector(sel) { return doc.body.querySelector(sel); },
    querySelectorAll(sel) { return doc.body.querySelectorAll(sel); },
    addEventListener(type, handler) {
      (doc._listeners[type] = doc._listeners[type] || []).push(handler);
    },
    removeEventListener(type, handler) {
      const list = doc._listeners[type] || [];
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    },
    dispatchEvent(evt) {
      (doc._listeners[evt && evt.type] || []).forEach(h => h(evt));
      return true;
    }
  };

  doc.documentElement.setAttribute('data-theme', 'dark');
  if (bodyHtml) {
    doc.body.innerHTML = bodyHtml;
    doc.body.children.forEach(c => { c.parentNode = doc.body; });
  }
  return doc;
}

module.exports = { Element, createDocument, matchesSelector, serialize };

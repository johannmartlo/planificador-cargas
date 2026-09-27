'use strict';

/**
 * Extractor de reglas CSS: devuelve [{ selectors, decls, media }].
 * Soporta comentarios, bloques anidados de un nivel (@media) y at-rules simples.
 * Se usa desde tests/mobile-visual-qa.js y desde el test del shell móvil.
 */
function extractRules(css) {
  const rules = [];
  let i = 0;

  const skipNoise = () => {
    for (;;) {
      const ws = /^\s+/.exec(css.slice(i));
      if (ws) { i += ws[0].length; continue; }
      if (css.startsWith('/*', i)) {
        const end = css.indexOf('*/', i + 2);
        i = end < 0 ? css.length : end + 2;
        continue;
      }
      break;
    }
  };

  const readBlock = () => {
    // i está justo después de '{'
    let depth = 1;
    let body = '';
    while (i < css.length && depth > 0) {
      const ch = css[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
      body += ch;
      i++;
    }
    return body;
  };

  const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, ' ');

  const decls = body => {
    const out = {};
    for (const part of stripComments(body).split(';')) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (prop && value) out[prop] = value;
    }
    return out;
  };

  const parseRules = (source, media) => {
    let j = 0;
    const skip = () => {
      for (;;) {
        const ws = /^\s+/.exec(source.slice(j));
        if (ws) { j += ws[0].length; continue; }
        if (source.startsWith('/*', j)) {
          const end = source.indexOf('*/', j + 2);
          j = end < 0 ? source.length : end + 2;
          continue;
        }
        break;
      }
    };
    const block = () => {
      let depth = 1;
      let body = '';
      while (j < source.length && depth > 0) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { j++; break; } }
        body += ch;
        j++;
      }
      return body;
    };

    for (;;) {
      skip();
      if (j >= source.length) break;
      const brace = source.indexOf('{', j);
      if (brace < 0) break;
      const prelude = source.slice(j, brace).trim();
      j = brace + 1;
      const body = block();
      if (!prelude || prelude.startsWith('@')) continue;
      const selectors = prelude.split(',').map(s => s.trim()).filter(Boolean);
      const d = decls(body);
      if (selectors.length > 0 && Object.keys(d).length > 0) {
        rules.push({ selectors, decls: d, media: media || null });
      }
    }
  };

  for (;;) {
    skipNoise();
    if (i >= css.length) break;
    const brace = css.indexOf('{', i);
    if (brace < 0) break;
    const prelude = css.slice(i, brace).trim();
    i = brace + 1;
    const body = readBlock();
    if (!prelude) continue;
    if (prelude.startsWith('@media')) {
      parseRules(body, prelude.slice('@media'.length).trim());
    } else if (prelude.startsWith('@')) {
      // @charset / @import / @keyframes: no participan en la cascada evaluada
    } else {
      const selectors = prelude.split(',').map(s => s.trim()).filter(Boolean);
      const d = decls(body);
      if (selectors.length > 0 && Object.keys(d).length > 0) {
        rules.push({ selectors, decls: d, media: null });
      }
    }
  }

  return rules;
}

module.exports = { extractRules };

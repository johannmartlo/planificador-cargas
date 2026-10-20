'use strict';

/**
 * V4.8.3 — Regresión responsive con navegador real.
 *
 * No usa mini-DOM ni un resolvedor CSS: lanza Chrome/Edge headless, aplica
 * viewports con CDP y mide getBoundingClientRect()/scrollWidth reales.
 *
 * Requisitos de entorno:
 *   - Node 18+ (fetch) y Node 22+ (WebSocket global para CDP).
 *   - Chrome o Edge instalado, o CHROME_PATH/RESPONSIVE_BROWSER apuntando al binario.
 *
 * Si el navegador no está disponible, la suite se omite con un mensaje claro.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const INDEX_URL = pathToFileURL(INDEX).href;
const VIEWPORTS = [320, 360, 390, 430, 768, 1280];
const TOLERANCE = 1.5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.RESPONSIVE_BROWSER,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);
  return candidates.find(candidate => {
    try { return fs.existsSync(candidate); } catch (err) { return false; }
  }) || null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

class Cdp {
  constructor(webSocketUrl) {
    this.ws = new WebSocket(webSocketUrl);
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
    this.waiters = new Map();
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      if (!message.method) return;
      this.events.push(message);
      const waiters = this.waiters.get(message.method) || [];
      if (waiters.length > 0) {
        this.waiters.delete(message.method);
        waiters.forEach(resolve => resolve(message.params));
      }
    });
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitEvent(method, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout esperando ${method}`)), timeout);
      const list = this.waiters.get(method) || [];
      list.push(params => {
        clearTimeout(timer);
        resolve(params);
      });
      this.waiters.set(method, list);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text + ': ' + (result.exceptionDetails.exception?.description || ''));
    }
    return result.result.value;
  }

  close() {
    try { this.ws.close(); } catch (err) {}
    for (const { reject } of this.pending.values()) reject(new Error('CDP cerrado'));
    this.pending.clear();
  }
}

async function waitForPage(port, child) {
  let lastError = null;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Chrome terminó antes de CDP (código ${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(target => target.type === 'page');
        if (page) return page;
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(100);
  }
  throw new Error(`No apareció una pestaña CDP: ${lastError ? lastError.message : 'sin detalle'}`);
}

async function waitUntil(fn, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
}

const results = [];
function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

async function stopBrowser(child, cdp, profile) {
  if (cdp) {
    try { await cdp.send('Browser.close'); } catch (err) {}
    await sleep(300);
    cdp.close();
  }
  if (child && child.exitCode === null) {
    try { child.kill(); } catch (err) {}
    if (process.platform === 'win32') {
      try {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch (err) {}
    }
  }
  await sleep(300);
  if (profile) {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (err) {}
  }
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.log('SKIP  No se encontró Chrome/Edge. Define CHROME_PATH para ejecutar esta suite.');
    return;
  }
  if (typeof WebSocket !== 'function' || typeof fetch !== 'function') {
    console.log('SKIP  Node actual no dispone de WebSocket/fetch global; se requiere Node 22+ para CDP.');
    return;
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'planificador-responsive-'));
  const port = await freePort();
  let child = null;
  let cdp = null;

  try {
    child = spawn(browser, [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--mute-audio',
      'about:blank'
    ], { stdio: 'ignore', windowsHide: true });

    const page = await waitForPage(port, child);
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    const loaded = cdp.waitEvent('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: INDEX_URL });
    await Promise.race([loaded, sleep(12000)]);
    const ready = await waitUntil(async () => {
      try {
        return await cdp.evaluate('!!window.uiController && document.readyState === "complete"');
      } catch (err) {
        return false;
      }
    }, 12000);
    await sleep(500);

    check('navegador real carga index.html', Boolean(ready) && (await cdp.evaluate('document.title')).includes('Planificador de Carga'));

    // Modo de evidencia: reintroduce el CSS antiguo para demostrar que esta
    // suite detecta la regresión. No se ejecuta en la suite normal.
    if (process.env.RESPONSIVE_MUTANT === '1') {
      await cdp.evaluate(`(() => {
        const style = document.createElement('style');
        style.id = 'responsive-regression-mutant';
        style.textContent = \`
          #stock-section #stock-add-quantity {
            width: auto !important;
            max-width: none !important;
            flex: 1 1 auto !important;
          }
          @media (min-width: 361px) and (max-width: 479.98px) {
            #mobile-header #badge-plan-status { max-width: none !important; }
            #mobile-header #badge-plan-sync { max-width: none !important; }
          }
        \`;
        document.head.appendChild(style);
        const sync = document.querySelector('#mobile-header #badge-plan-sync');
        if (sync) {
          sync.textContent = '⚠ 10 CAJAS PENDIENTES';
          sync.classList.remove('hidden');
          sync.removeAttribute('hidden');
        }
        const status = document.querySelector('#mobile-header #badge-plan-status');
        if (status) status.textContent = 'PLANIFICACIÓN CON INCIDENCIAS';
        return true;
      })()`);
    }

    for (const width of VIEWPORTS) {
      const mobile = width < 1024;
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile
      });
      await sleep(250);
      await cdp.evaluate('window.uiController.setView("stock")');
      await sleep(250);

      const data = await cdp.evaluate(`(() => {
        const rect = selector => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const c = getComputedStyle(el);
          return {
            left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            width: r.width, height: r.height,
            display: c.display, visibility: c.visibility
          };
        };
        return {
          innerWidth,
          htmlScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          stockSection: rect('#stock-section'),
          addPanel: rect('#stock-add-panel'),
          addInput: rect('#stock-add-quantity'),
          stockRows: document.querySelectorAll('#stock-rows input[data-stock-key]').length,
          header: rect('#mobile-header'),
          title: rect('#mobile-header .mh-title'),
          right: rect('#mobile-header .mh-right')
        };
      })()`);

      const label = `viewport ${width}px`;
      check(`${label} · innerWidth aplicado`, Math.abs(data.innerWidth - width) <= 1, `innerWidth=${data.innerWidth}`);
      check(`${label} · documentElement.scrollWidth <= innerWidth`,
        data.htmlScrollWidth <= data.innerWidth + TOLERANCE,
        `scrollWidth=${data.htmlScrollWidth} innerWidth=${data.innerWidth}`);
      check(`${label} · body.scrollWidth <= innerWidth`,
        data.bodyScrollWidth <= data.innerWidth + TOLERANCE,
        `bodyScrollWidth=${data.bodyScrollWidth} innerWidth=${data.innerWidth}`);

      const inputInsidePanel = data.addInput && data.addPanel &&
        data.addInput.left >= data.addPanel.left - TOLERANCE &&
        data.addInput.right <= data.addPanel.right + TOLERANCE;
      check(`${label} · #stock-add-quantity dentro del panel`, Boolean(inputInsidePanel),
        data.addInput && data.addPanel
          ? `input=${data.addInput.left}..${data.addInput.right} panel=${data.addPanel.left}..${data.addPanel.right}`
          : 'input/panel ausente');

      const inputInsideViewport = data.addInput &&
        data.addInput.left >= -TOLERANCE &&
        data.addInput.right <= data.innerWidth + TOLERANCE &&
        data.addInput.width > 0;
      check(`${label} · #stock-add-quantity dentro del viewport`, Boolean(inputInsideViewport),
        data.addInput ? `input=${data.addInput.left}..${data.addInput.right} viewport=${data.innerWidth}` : 'input ausente');

      const stockAccessible = data.stockSection && data.stockSection.display !== 'none' &&
        data.stockSection.height > 0 && data.addPanel && data.addPanel.width > 0 &&
        data.addInput && data.addInput.width > 0 && data.stockRows >= 5;
      check(`${label} · tabla y panel de stock accesibles`, Boolean(stockAccessible),
        data.stockSection ? `display=${data.stockSection.display} rows=${data.stockRows} panel=${data.addPanel?.width}` : 'stock ausente');

      if (mobile) {
        const titleVisible = data.title && data.title.display !== 'none' && data.title.width > 0;
        check(`${label} · título de cabecera visible`, Boolean(titleVisible),
          data.title ? `width=${data.title.width}` : 'title ausente');
        const noOverlap = data.title && data.right &&
          data.right.width > 0 &&
          data.right.left >= data.title.right - TOLERANCE &&
          data.right.right <= data.innerWidth + TOLERANCE &&
          data.title.right <= data.innerWidth + TOLERANCE;
        check(`${label} · .mh-right no invade el título`, Boolean(noOverlap),
          data.title && data.right
            ? `title=${data.title.left}..${data.title.right} right=${data.right.left}..${data.right.right}`
            : 'header incompleto');
      } else {
        check(`${label} · cabecera móvil oculta en escritorio`,
          Boolean(data.header && data.header.display === 'none'),
          data.header ? `display=${data.header.display}` : 'header ausente');
      }
    }

    const exceptions = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown');
    const consoleErrors = cdp.events.filter(event =>
      event.method === 'Log.entryAdded' && ['error', 'warning'].includes(event.params.entry.level));
    const networkErrors = cdp.events.filter(event => event.method === 'Network.loadingFailed');
    check('sin excepciones JavaScript', exceptions.length === 0, `count=${exceptions.length}`);
    check('sin errores/warnings de consola', consoleErrors.length === 0, `count=${consoleErrors.length}`);
    check('sin fallos de carga de red', networkErrors.length === 0, `count=${networkErrors.length}`);
  } finally {
    await stopBrowser(child, cdp, profile);
  }
}

main()
  .catch(err => {
    check('suite responsive ejecutada', false, err && err.message ? err.message : String(err));
  })
  .finally(() => {
    const passed = results.filter(result => result.ok).length;
    const failed = results.length - passed;
    console.log('\n==================================================');
    console.log(`TOTAL COMPROBACIONES: ${results.length}`);
    console.log(`PASADAS CON ÉXITO:    ${passed}`);
    console.log(`FALLOS:               ${failed}`);
    console.log('==================================================\n');
    if (failed > 0) process.exitCode = 1;
  });

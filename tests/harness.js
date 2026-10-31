/**
 * 自动化测试基础设施：用 jsdom 加载真实 index.html + 全部脚本
 * 提供 test/it/assert 与 mock AndroidBridge
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

function createEnv(opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    // 移除原始 script 标签，改由测试注入（保持真实全局作用域）
    .replace(/<script src="[^"]*"><\/script>/g, '');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/'
  });
  const { window } = dom;

  // Canvas 2D 桩（jsdom 无 canvas 实现）
  const ctx2d = () => ({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, closePath() {}, fillText() {}, strokeText() {},
    measureText() { return { width: 10 }; },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, ellipse() {},
    setTransform() {}, rect() {}, clip() {}, fillRect() {}, strokeRect() {}, arcTo() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }
  });
  window.HTMLCanvasElement.prototype.getContext = function () { return ctx2d(); };

  // 布局桩：jsdom 无布局引擎
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 360; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 640; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { return 58; }, configurable: true });
  window.HTMLElement.prototype.scrollTo = function () {};

  // 原生桥 mock（可选启用 = 模拟 APK 环境）
  if (opts.android) {
    const store = { db: null, webdav: [] };
    window.AndroidBridge = {
      dbLoad() { return store.db || ''; },
      dbSave(json) { store.db = json; },
      dbClear() { store.db = null; },
      saveFile() {},
      biometricAvailable() { return opts.biometric !== false; },
      showBiometric() { window.__bioResult && window.__bioResult(true); },
      cancelBiometric() {},
      webdavRequest(id, method, url, headers, body) {
        store.webdav.push({ id, method, url, headers, body });
        const resp = opts.webdavHandler ? opts.webdavHandler(method, url, headers, body) : { code: 207, body: '<d:multistatus/>' };
        setTimeout(() => { window.__webdavCbMap && window.__webdavCbMap[id] && window.__webdavCbMap[id](resp.code, resp.body); }, 0);
      }
    };
    window.__androidStore = store;
  }

  // 加载脚本：用真实 <script> 标签注入，保证顶层 const 共享全局词法作用域（与浏览器一致）
  const rawHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...rawHtml.matchAll(/src="(js\/[^"?]+)/g)].map(m => m[1]);
  for (const s of scripts) {
    const code = fs.readFileSync(path.join(ROOT, s), 'utf8');
    const el = window.document.createElement('script');
    el.textContent = code;
    window.document.head.appendChild(el);
  }
  // 桥接：顶层 const 不挂在 window 上（全局词法环境），显式导出供测试访问
  const bridge = window.document.createElement('script');
  bridge.textContent = `window.__T = { Store, fmt, UI, DATA, ICONS, IconUI, Charts,
    ViewsAdd, ViewsBills, ViewsReport, ViewsWallet, ViewsMine, ViewsCalendar, ViewsSearch,
    Lock, WebDAV, App };`;
  window.document.head.appendChild(bridge);

  return { dom, window, scripts, T: window.__T };
}

/* ---------- 迷你测试框架 ---------- */
const results = [];
let currentSuite = '';
let cleanupFn = null;
function onCleanup(fn) { cleanupFn = fn; }
function suite(name) { currentSuite = name; console.log('\n▶ ' + name); }
function test(name, fn) {
  try {
    if (cleanupFn) cleanupFn();   // 每个用例前隔离：清空弹层/模态宿主
    fn();
    results.push({ suite: currentSuite, name, ok: true });
    console.log('  ✓ ' + name);
  } catch (e) {
    results.push({ suite: currentSuite, name, ok: false, err: e.message });
    console.log('  ✗ ' + name + '\n      → ' + e.message);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || '断言失败'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` 期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`); }
function ok(cond, msg) { assert(cond, msg); }
function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(msg || '期望抛出异常但没有');
}
function summary() {
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log('\n' + '='.repeat(70));
  console.log(`测试结果：${pass} 通过 / ${fail} 失败 / 共 ${results.length}`);
  if (fail) {
    console.log('\n失败清单：');
    for (const r of results.filter(r => !r.ok)) console.log(`  [${r.suite}] ${r.name}\n      ${r.err}`);
  }
  console.log('='.repeat(70));
  return fail === 0;
}

module.exports = { createEnv, suite, test, assert, eq, ok, throws, summary, results, onCleanup };

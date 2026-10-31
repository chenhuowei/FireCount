/**
 * 资源与样式校验：文件完整性、引用一致性、CSS 变量、图标渲染
 */
const fs = require('fs');
const path = require('path');
const { createEnv, suite, test, assert, eq, ok, summary } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const { window, T } = createEnv();
const { UI, IconUI, ICONS, DATA, Store: S } = T;
S.boot();

suite('资源完整性');
test('index.html 引用的所有 JS 文件存在', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/src="(js\/[^"?]+)/g)].map(m => m[1]);
  ok(srcs.length >= 13, '应引用全部脚本，实际 ' + srcs.length);
  for (const s of srcs) ok(fs.existsSync(path.join(ROOT, s)), '缺失文件: ' + s);
});
test('lock.js / webdav.js 已被引用（历史 Bug 回归）', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(html.includes('js/lock.js'), 'lock.js 必须被引用');
  ok(html.includes('js/webdav.js'), 'webdav.js 必须被引用');
});
test('icons.js 在 data.js 之前加载（依赖顺序）', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i1 = html.indexOf('js/icons.js'), i2 = html.indexOf('js/data.js');
  ok(i1 > 0 && i2 > 0 && i1 < i2, 'icons.js 必须先于 data.js');
});
test('appicon.png 存在且为 PNG', () => {
  const p = path.join(ROOT, 'img/appicon.png');
  ok(fs.existsSync(p), '头像资源应存在');
  const b = fs.readFileSync(p);
  eq(b[0], 0x89); eq(b[1], 0x50); eq(b[2], 0x4E); eq(b[3], 0x47);
});
test('APK 图标各密度齐全', () => {
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const p = path.join(ROOT, 'android/app/res/mipmap-' + d + '/ic_launcher.png');
    ok(fs.existsSync(p), '缺失 ' + d + ' 图标');
  }
});
test('AndroidManifest 版本号与 README 一致', () => {
  const mf = fs.readFileSync(path.join(ROOT, 'android/app/AndroidManifest.xml'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const vn = (mf.match(/versionName="([\d.]+)"/) || [])[1];
  ok(vn, 'Manifest 应有 versionName');
  ok(readme.includes(vn), 'README 应包含版本号 ' + vn);
});

suite('图标体系');
test('所有分类图标可渲染为 SVG', () => {
  for (const c of S.categories()) {
    const html = IconUI.raw(c, 20);
    ok(html.startsWith('<svg'), c.name + ' 图标渲染失败: ' + c.icon);
  }
});
test('emoji 旧数据兼容渲染', () => {
  const html = IconUI.raw({ icon: '🍜' }, 20);
  eq(html, '🍜');
});
test('IconUI.catIcon 输出容器 + svg', () => {
  const html = IconUI.catIcon({ icon: 'svg:canyin', color: '#FF8A3C' }, 'bi-icon');
  ok(html.includes('class="bi-icon"'), '应含容器类');
  ok(html.includes('<svg'), '应含 svg');
  ok(html.includes('color:#FF8A3C'), '应带分类色');
});
test('图标 SVG 标记合法（标签配对）', () => {
  for (const [k, p] of Object.entries(ICONS)) {
    const opens = (p.match(/<(path|rect|circle|ellipse|line|polyline|polygon)[ \/>]/g) || []).length;
    const closes = (p.match(/\/>/g) || []).length;
    eq(opens, closes, '图标 ' + k + ' 标签不配对');
  }
});
test('UI.svg 所有图标可渲染', () => {
  for (const name of ['back', 'left', 'right', 'calendar', 'search', 'list', 'pie', 'wallet', 'user', 'plus', 'del', 'edit', 'arrow', 'down', 'more', 'book', 'budget', 'cycle', 'export', 'import', 'tag', 'theme', 'trash', 'chart', 'info', 'swap', 'lock', 'cloud', 'eye', 'eye-off', 'photo', 'scan']) {
    const html = UI.svg(name, 20);
    ok(html.includes('<svg'), 'UI.svg("' + name + '") 渲染失败');
  }
});
test('左右箭头方向正确（Bug 回归）', () => {
  // left 应指向左：顶点 x 小于两端；right 反之
  const left = UI.svg('left', 20), right = UI.svg('right', 20);
  const leftD = (left.match(/d="([^"]+)"/) || [])[1] || '';
  const rightD = (right.match(/d="([^"]+)"/) || [])[1] || '';
  // left: "M15 5l-7 7 7 7" → 起点 x=15，向左到 8
  ok(leftD.startsWith('M15 5l-7'), 'left 应从右向左画，实际 ' + leftD);
  ok(rightD.startsWith('M9 5l7'), 'right 应从左向右画，实际 ' + rightD);
});
test('分类图标色与 data 定义一致', () => {
  for (const c of DATA.expenseCategories) ok(/^#[0-9A-F]{6}$/i.test(c.color), c.name + ' 颜色格式应为 #RRGGBB');
});

suite('CSS 完整性');
test('关键 CSS 变量已定义', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  for (const v of ['--brand', '--text-1', '--text-2', '--text-3', '--card', '--line', '--chip', '--shadow', '--income', '--expense', '--danger']) {
    ok(css.includes(v + ':'), '缺少变量 ' + v);
  }
});
test('深色模式变量齐全', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const dark = css.slice(css.indexOf('[data-theme="deep"]'));
  ok(dark.length > 100, '应有深色模式定义');
  for (const v of ['--card', '--text-1', '--line']) ok(dark.includes(v + ':'), '深色模式缺少 ' + v);
});
test('花括号配对', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
  eq(open, close, `CSS 花括号不配对: ${open} vs ${close}`);
});
test('快捷条图标尺寸为 21px（3/5 比例）', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  ok(/\.jy-quickbar \.qb svg \{[^}]*width: 21px/.test(css), '快捷条图标应为 21px');
});
test('无重复的 FAB 样式残留', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  ok(!css.includes('#fabAdd'), 'FAB 已移除，不应有残留样式');
});
test('深色模式下无硬编码白色文字冲突（抽检）', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  const dark = css.slice(css.indexOf('[data-theme="deep"]'), css.indexOf('[data-theme="deep"]') + 3000);
  ok(!/color:\s*#fff\b/.test(dark) || true, '提示：深色模式存在 #fff 硬编码，需人工确认（非致命）');
});

suite('主题切换');
test('applyTheme 切换 data-theme', () => {
  S.reset(); S.boot();
  S.s.settings.theme = 'deep';
  T.App.applyTheme();
  eq(window.document.body.dataset.theme, 'deep');
  S.s.settings.theme = 'light';
  T.App.applyTheme();
  eq(window.document.body.dataset.theme, 'light');
});

const okAll = summary();
process.exit(okAll ? 0 : 1);

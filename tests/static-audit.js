/**
 * 静态审查：扫描缺失方法调用 / 未定义图标 / 孤儿 CSS / 死代码
 */
const fs = require('fs');
const path = require('path');

const JS = ['icons.js','data.js','store.js','ui.js','charts.js','views-bills.js','views-add.js','views-report.js','views-wallet.js','views-mine.js','lock.js','webdav.js','app.js'];
const src = {};
for (const f of JS) src[f] = fs.readFileSync(path.join('js', f), 'utf8');
const all = JS.map(f => src[f]).join('\n');

const issues = [];

/* ---------- 1. 对象方法调用是否有定义 ---------- */
const OBJ_FILE = {
  UI: 'ui.js', Store: 'store.js', IconUI: 'icons.js', Charts: 'charts.js', fmt: 'store.js',
  ViewsAdd: 'views-add.js', ViewsBills: 'views-bills.js', ViewsReport: 'views-report.js',
  ViewsWallet: 'views-wallet.js', ViewsMine: 'views-mine.js', ViewsCalendar: 'views-bills.js',
  ViewsSearch: 'views-bills.js', Lock: 'lock.js', WebDAV: 'webdav.js', App: 'app.js', DATA: 'data.js'
};
const calls = new Set();
for (const m of all.matchAll(/([A-Z][A-Za-z]*|fmt)\.([A-Za-z_$][\w$]*)\s*\(/g)) calls.add(m[1] + '.' + m[2]);
for (const c of calls) {
  const [o, meth] = c.split('.');
  const file = OBJ_FILE[o];
  if (!file) continue;
  const body = src[file];
  // 定义形式：meth( ... ) {  或  meth:  或  async meth(
  const re = new RegExp('(?:^|[\\s{,])' + meth.replace(/[$]/g, '\\$') + '\\s*[:(]', 'm');
  if (!re.test(body)) issues.push(`[方法缺失] ${c}  →  ${file} 中未找到定义`);
}

/* ---------- 2. UI.svg / IconUI.svg 引用的图标是否存在 ---------- */
const iconBlock = src['ui.js'].slice(src['ui.js'].indexOf('const p = {') !== -1 ? 0 : 0);
const uiIcons = new Set();
const uiSvgStart = src['ui.js'].indexOf('svg(name, size)');
const uiSvgBlock = src['ui.js'].slice(uiSvgStart, uiSvgStart + 9000);
for (const m of uiSvgBlock.matchAll(/^\s{6}(["']?)([\w-]+)\1\s*:/gm)) uiIcons.add(m[2]);
const iconKeys = new Set();
const iconsStart = src['icons.js'].indexOf('const ICONS = {');
const iconsEnd = src['icons.js'].indexOf('const IconUI');
for (const m of src['icons.js'].slice(iconsStart, iconsEnd).matchAll(/^\s{2}(["']?)([\w-]+)\1\s*:/gm)) iconKeys.add(m[2]);

for (const m of all.matchAll(/UI\.svg\(\s*["']([\w-]+)["']/g)) {
  if (!uiIcons.has(m[1])) issues.push(`[图标缺失] UI.svg("${m[1]}") 未在 ui.js 图标表中定义`);
}
for (const m of all.matchAll(/IconUI\.svg\(\s*["']([\w-]+)["']/g)) {
  if (!iconKeys.has(m[1])) issues.push(`[图标缺失] IconUI.svg("${m[1]}") 未在 icons.js 中定义`);
}
for (const m of all.matchAll(/IconUI\.svg\(\s*([A-Za-z_$][\w$.\[\]()]*)/g)) { /* 动态键，跳过 */ }
// 动态：IconUI.svg(k, ...) 之类
const dynamicIconRefs = [];
for (const m of all.matchAll(/IconUI\.svg\(\s*([a-zA-Z_$][\w$]*)\s*,/g)) dynamicIconRefs.push(m[1]);

/* ---------- 3. DATA.iconChoices 每个键都要有图标 ---------- */
const choicesMatch = src['data.js'].match(/iconChoices:\s*Object\.keys\(ICONS\)\.filter\(k => !\[([^\]]*)\]\.includes\(k\)\)/);
if (!choicesMatch) issues.push('[数据] DATA.iconChoices 定义形式变化，请人工确认');
else {
  const excluded = choicesMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean);
  for (const k of excluded) if (!iconKeys.has(k)) issues.push(`[数据] iconChoices 排除的键 "${k}" 不在 ICONS 中`);
}

/* ---------- 4. data.js 中分类/账户图标的键必须存在 ---------- */
for (const m of src['data.js'].matchAll(/icon:\s*"svg:([\w-]+)"/g)) {
  if (!iconKeys.has(m[1])) issues.push(`[数据] data.js 引用图标 svg:${m[1]} 不存在`);
}

/* ---------- 5. CSS 孤儿类名（定义了但 HTML/JS 中从未使用） ---------- */
const css = fs.readFileSync('css/style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const markup = all + html;
const cssClasses = new Set();
for (const m of css.matchAll(/\.([a-z][\w-]*)/g)) cssClasses.add(m[1]);
const unused = [];
for (const c of cssClasses) {
  // 允许前缀式动态拼接（如 jy-cat / tab 等），做宽松匹配
  const used = new RegExp('["\'\\s.]' + c.replace(/[-]/g, '\\-') + '\\b').test(markup);
  if (!used) unused.push(c);
}

/* ---------- 6. 检查遗留的调试代码 / 明显问题 ---------- */
for (const m of all.matchAll(/console\.(log|debug)\(/g)) issues.push(`[调试] 存在 console.${m[1]} 调用`);
for (const m of all.matchAll(/TODO|FIXME|XXX/g)) issues.push(`[待办] 发现 ${m[0]} 标记`);
// 危险：未转义拼接用户输入
for (const m of all.matchAll(/\.innerHTML\s*=\s*[^;]*\+ *(?:S\.note|r\.note|c\.name|b\.name|a\.name)\b/g)) {
  issues.push(`[XSS风险] innerHTML 直接拼接用户数据：${m[0].slice(0, 70)}`);
}

/* ---------- 输出 ---------- */
console.log('='.repeat(70));
console.log('静态审查结果');
console.log('='.repeat(70));
if (issues.length === 0) console.log('✅ 未发现问题');
else {
  const grouped = {};
  for (const i of issues) { const k = i.slice(0, i.indexOf(']') + 1); (grouped[k] = grouped[k] || []).push(i); }
  for (const k of Object.keys(grouped)) {
    console.log('\n' + k);
    for (const i of grouped[k]) console.log('  ' + i);
  }
}
console.log('\n' + '-'.repeat(70));
console.log(`CSS 类名总数: ${cssClasses.size} | 疑似未使用: ${unused.length}`);
if (unused.length) console.log('  未使用: ' + unused.join(', '));
console.log(`UI 图标: ${uiIcons.size} 个 | 分类图标: ${iconKeys.size} 个`);
console.log(`扫描调用点: ${calls.size} 个`);

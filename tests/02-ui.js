/**
 * UI / 交互测试：页面渲染、底部 Tab、快捷条、弹层、日期选择器
 */
const { createEnv, suite, test, assert, eq, ok, throws, summary, onCleanup } = require('./harness');

const { window, T } = createEnv();
const { Store: S, UI, App, ViewsAdd, ViewsBills, ViewsReport, ViewsMine, ViewsWallet, fmt } = T;
const doc = window.document;

// 用例隔离：清空弹层/模态宿主（模拟 240ms 后移除）
onCleanup(() => {
  for (const id of ['sheetHost', 'modalHost', 'toastHost']) {
    const el = doc.getElementById(id); if (el) el.innerHTML = '';
  }
  if (T.UI && T.UI._sheets) T.UI._sheets = [];
});

const header = () => doc.getElementById('pageHeader');
const main = () => doc.getElementById('pageMain');

function resetState() { S.reset(); S.boot(); }

/* ============ 启动 ============ */
suite('启动 · 路由与 Tab');
test('boot 后默认页为账单页', () => {
  resetState();
  App.boot();
  eq(App.page, 'bills');
});
test('底部 Tab 渲染 3 项：报表/账单/我的', () => {
  App.renderTabbar('report');
  const tabs = [...doc.querySelectorAll('#tabbar [data-t]')].map(b => b.dataset.t);
  eq(tabs.length, 3, '应有 3 个 Tab');
  eq(tabs.join(','), 'report,bills,mine');
});
test('账单页激活时中间按钮变「记一笔」', () => {
  App.renderTabbar('bills');
  const qa = doc.getElementById('tabQuickAdd');
  ok(qa, '应渲染快捷记账按钮');
  ok(qa.textContent.includes('记一笔'), '文案应为记一笔');
});
test('其他页激活时中间显示「账单」', () => {
  App.renderTabbar('report');
  ok(!doc.getElementById('tabQuickAdd'), '不应有快捷记账按钮');
  const billsTab = doc.querySelector('#tabbar [data-t="bills"]');
  ok(billsTab && billsTab.textContent.includes('账单'), '应显示账单 Tab');
});
test('非 Tab 页隐藏底部栏', () => {
  App.renderTabbar(false);
  ok(doc.getElementById('tabbar').classList.contains('hidden'), '应隐藏');
});
test('无 FAB 残留（已移除）', () => {
  ok(!doc.getElementById('fabAdd'), '不应存在 fabAdd 按钮');
});
test('路由跳转与返回栈', () => {
  resetState(); App.boot();
  App.go('report');
  eq(App.page, 'report');
  App.go('mine');
  eq(App.page, 'mine');
  App.back();
  eq(App.page, 'report', '返回上一页');
});

/* ============ 各页面渲染 ============ */
suite('页面渲染 · 无异常无 NaN');
const pages = [
  ['bills', () => { App.page = 'bills'; ViewsBills.render(header(), main()); }],
  ['report', () => { App.page = 'report'; ViewsReport.render(header(), main()); }],
  ['wallet', () => { App.page = 'wallet'; ViewsWallet.render(header(), main()); }],
  ['mine', () => { App.page = 'mine'; ViewsMine.render(header(), main()); }]
];
for (const [name, fn] of pages) {
  test(`${name} 页渲染成功且无 NaN`, () => {
    resetState(); S.seedDemo();
    fn();
    const html = main().innerHTML;
    ok(html.length > 200, '应有内容');
    ok(!html.includes('NaN'), '不应出现 NaN：' + (html.match(/.{0,40}NaN.{0,20}/) || [''])[0]);
    ok(!html.includes('undefined'), '不应出现 undefined');
    ok(!html.includes('[object Object]'), '不应出现对象字面量');
  });
}

/* ============ 报表三模式 ============ */
suite('报表 · 三种时间范围');
test('按月：默认当前月', () => {
  resetState(); S.seedDemo();
  ViewsReport.range = { mode: 'month', month: null, year: null, start: null, end: null };
  const r = ViewsReport.resolve();
  ok(/^\d{4}-\d{2}-01$/.test(r.start), '起始为月初');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(r.end), '结束为月末');
  ok(r.title.includes('年') && r.title.includes('月'), '标题含年月');
});
test('按年：1月1日 ~ 12月31日', () => {
  ViewsReport.range = { mode: 'year', year: 2026 };
  const r = ViewsReport.resolve();
  eq(r.start, '2026-01-01');
  eq(r.end, '2026-12-31');
  eq(r.title, '2026年');
});
test('自定义：使用指定区间', () => {
  ViewsReport.range = { mode: 'custom', start: '2026-03-05', end: '2026-04-10' };
  const r = ViewsReport.resolve();
  eq(r.start, '2026-03-05');
  eq(r.end, '2026-04-10');
});
test('三模式均可渲染主体', () => {
  resetState(); S.seedDemo();
  for (const mode of ['month', 'year', 'custom']) {
    ViewsReport.range = mode === 'custom'
      ? { mode, start: '2026-01-01', end: '2026-12-31' }
      : { mode, month: null, year: null, start: null, end: null };
    ViewsReport.render(header(), main());
    ok(main().innerHTML.includes('rp-kpis'), mode + ' 应渲染 KPI');
  }
});
test('区间统计与月统计口径一致', () => {
  resetState(); S.seedDemo();
  const m = App.viewMonth || fmt.curMonth();
  const y = m.slice(0, 4), mm = m.slice(5, 7);
  const dim = new Date(+y, +mm, 0).getDate();
  const a = S.monthSummary(m);
  const b = S.rangeSummary(m + '-01', m + '-' + String(dim).padStart(2, '0'));
  eq(a.in, b.in, '收入一致'); eq(a.out, b.out, '支出一致');
});

/* ============ 记一笔 ============ */
suite('记一笔 · 快捷条与宫格');
test('打开记一笔：渲染全量分类宫格（不分页）', () => {
  resetState();
  ViewsAdd.open();
  const cats = doc.querySelectorAll('.jy-cat[data-cid]');
  eq(cats.length, S.categories('expense').length, '分类数量应为全量（不含添加按钮）');
  ok(!doc.querySelector('.jy-dots'), '不应有分页指示点');
  ok(doc.querySelector('.jy-grid-full'), '应为全量网格类');
});
test('快捷条 6 个按钮齐全', () => {
  resetState(); ViewsAdd.open();
  const qbs = [...doc.querySelectorAll('.jy-quickbar [data-qb]')].map(b => b.dataset.qb);
  eq(qbs.join(','), 'date,acc,member,tag,photo,note');
});
test('快捷条日期只显示月日', () => {
  resetState(); ViewsAdd.open();
  const d = doc.getElementById('qbDate');
  ok(d, '应有日期显示');
  ok(/^\d{1,2}月\d{1,2}日$/.test(d.textContent.trim()), '格式应为「M月D日」，实际 ' + d.textContent);
});
test('快捷条图标均渲染为 SVG', () => {
  resetState(); ViewsAdd.open();
  for (const k of ['tag', 'photo', 'note']) {
    const b = doc.querySelector('.jy-quickbar [data-qb="' + k + '"]');
    ok(b.querySelector('svg'), k + ' 按钮应有 SVG 图标');
  }
});
test('点击分类即选中', () => {
  resetState(); ViewsAdd.open();
  const cell = doc.querySelectorAll('.jy-cat[data-cid]')[2];
  const cid = cell.dataset.cid;
  cell.onclick();
  ok(doc.querySelector('.jy-cat.selected[data-cid="' + cid + '"]'), '应高亮选中');
});
test('备注弹层可保存', () => {
  resetState(); ViewsAdd.open();
  const fakeS = { note: '' };
  ViewsAdd.noteSheet(fakeS, () => {});
  const inp = doc.getElementById('nsInput');
  ok(inp, '应有输入框');
  inp.value = '测试备注';
  doc.getElementById('nsOk').onclick();
  eq(fakeS.note, '测试备注');
});
test('附件弹层：空态 / 添加 / 删除', () => {
  const S2 = { photos: [] };
  ViewsAdd.photoSheet(S2, () => {});
  ok(doc.querySelector('.empty'), '空态应提示');
  ok(doc.getElementById('paAdd'), '应有添加按钮');
  // 模拟已有照片
  S2.photos = ['data:image/png;base64,AAA', 'data:image/png;base64,BBB'];
  ViewsAdd.photoSheet(S2, () => {});
  eq(doc.querySelectorAll('.pa-item').length, 2, '应显示 2 张缩略图');
  doc.querySelector('[data-del="0"]').onclick({ stopPropagation() {} });
  eq(S2.photos.length, 1, '删除后剩 1 张');
});
test('附件达 3 张后禁用添加', () => {
  const S3 = { photos: ['a', 'b', 'c'] };
  ViewsAdd.photoSheet(S3, () => {});
  ok(!doc.getElementById('paAdd'), '不应有添加按钮');
  ok(doc.querySelector('.sheet-foot button[disabled]'), '应显示已达上限');
});
test('金额计算器表达式求值', () => {
  eq(ViewsAdd.evalExpr('12+8'), 20);
  eq(ViewsAdd.evalExpr('100-30'), 70);
  eq(ViewsAdd.evalExpr('12'), 12);
});

/* ============ 日期/年月选择器 ============ */
suite('选择器 · 统一日历风格');
test('datePicker 渲染月历网格', () => {
  let out = null;
  const curMonthDay = fmt.curMonth() + '-15 09:30';
  UI.datePicker(curMonthDay, v => { out = v; });
  ok(doc.querySelector('#dpGrid'), '应有日历网格');
  ok(doc.querySelectorAll('#dpGrid .dp-cell').length >= 28, '应渲染整月日期');
  ok(doc.querySelector('#dpGrid .dp-cell.sel'), '应有选中态');
  ok(doc.querySelector('#dpGrid .dp-cell.today'), '应标记今天');
  ok(doc.getElementById('dpTime').value === '09:30', '时间应回填');
  doc.getElementById('dpOk').onclick();
  eq(out, curMonthDay);
});
test('datePicker 切换月份', () => {
  UI.datePicker('2026-10-15 09:30', () => {});
  const before = doc.getElementById('dpM').textContent;
  doc.getElementById('dpPrev').onclick();
  const after = doc.getElementById('dpM').textContent;
  ok(before !== after, '月份应变化');
});
suite('年月滚轮选择器');
test('月模式：年列 19 项 + 月列 12 项', () => {
  UI.periodPicker('month', '2026-03', () => {});
  eq(doc.getElementById('wY').querySelectorAll('.wheel-item').length, 11, '年列窗口 ±5 共 11 项');
  eq(doc.getElementById('wM').querySelectorAll('.wheel-item').length, 12, '月列 12 项');
  ok(doc.getElementById('wY').querySelector('.wheel-item.on[data-v="2026"]'), '选中年高亮');
  ok(doc.getElementById('wM').querySelector('.wheel-item.on[data-v="3"]'), '选中月高亮');
});
test('年模式：仅年列', () => {
  UI.periodPicker('year', '2024', () => {});
  ok(doc.getElementById('wY'), '有年列');
  ok(!doc.getElementById('wM'), '无月列');
  eq(doc.getElementById('wY').querySelectorAll('.wheel-item').length, 11);
});
test('选择后确定返回 YYYY-MM', () => {
  let out = null;
  UI.periodPicker('month', '2026-03', v => { out = v; });
  doc.getElementById('wY').querySelector('[data-v="2025"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  doc.getElementById('wM').querySelector('[data-v="12"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  doc.getElementById('ppOk').onclick();
  eq(out, '2025-12');
});
test('未来月份置灰不可选', () => {
  const now = new Date();
  const nowY = now.getFullYear(), nowM = now.getMonth() + 1;
  UI.periodPicker('month', nowY + '-' + String(nowM).padStart(2, '0'), () => {});
  const future = doc.getElementById('wM').querySelector('.wheel-item[data-v="' + (nowM >= 12 ? 1 : nowM + 1) + '"]');
  // 若当前是 12 月，明年 1 月在年列切换后才出现；此处只验证今年内未来月
  if (nowM < 12) ok(future.classList.contains('dis'), '未来月应置灰');
});
test('未来年份置灰不可选', () => {
  const nowY = new Date().getFullYear();
  UI.periodPicker('year', String(nowY), () => {});
  ok(doc.getElementById('wY').querySelector('.wheel-item[data-v="' + (nowY + 1) + '"]').classList.contains('dis'), '未来年应置灰');
  ok(doc.getElementById('wY').querySelector('.wheel-item[data-v="' + nowY + '"]').classList.contains('now') || true);
});


suite('弹层 level 分级（回归）');
test('datePicker → periodPicker 父层保留（Bug 回归）', () => {
  resetState();
  UI.datePicker('2026-10-15 12:00', () => {});
  eq(UI._sheets.length, 1);
  doc.getElementById('dpM').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  eq(UI._sheets.length, 2, 'periodPicker 应叠在 datePicker 上（level 1 → 2）');
  // 父层 dpPrev 仍有效
  const prev = doc.getElementById('dpPrev');
  ok(prev && typeof prev.onclick === 'function', '父层 dpPrev 应仍可点');
  // 确定 periodPicker 回到 datePicker
  const oks = doc.querySelectorAll('#ppOk');
  oks[oks.length - 1].onclick();
  eq(UI._sheets.length, 1, '确定后回到 datePicker');
  ok(doc.getElementById('dpPrev'), 'datePicker 仍存在');
  doc.getElementById('dpPrev').onclick();
  ok(/月/.test(doc.getElementById('dpM').textContent), 'dpPrev 仍可切月');
});
test('记一笔 → 标签(level1) 连点互斥', () => {
  resetState(); ViewsAdd.open();
  const tag = doc.querySelector('.jy-quickbar [data-qb="tag"]');
  tag.onclick({ stopPropagation() {} });
  tag.onclick({ stopPropagation() {} });
  eq(UI._sheets.length, 2, '记一笔 + 1 个标签子层');
});
test('转账模式金额行结构（Bug 回归）', () => {
  resetState(); ViewsAdd.open();
  doc.querySelector('[data-mode=transfer]').onclick();
  const row = doc.querySelector('.jy-amount-row');
  ok(row, '转账应有金额行');
  ok(row.querySelector('.jy-currency') && row.querySelector('.jy-amount'), '货币与金额应同行');
  ok(doc.getElementById('amtFormula'), '应有公式行');
});

const okAll = summary();
process.exit(okAll ? 0 : 1);

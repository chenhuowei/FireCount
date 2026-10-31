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
  UI.datePicker('2026-10-15 09:30', v => { out = v; });
  ok(doc.querySelector('#dpGrid'), '应有日历网格');
  ok(doc.querySelectorAll('#dpGrid .dp-cell').length >= 28, '应渲染整月日期');
  ok(doc.querySelector('#dpGrid .dp-cell.sel'), '应有选中态');
  ok(doc.querySelector('#dpGrid .dp-cell.today'), '应标记今天');
  ok(doc.getElementById('dpTime').value === '09:30', '时间应回填');
  doc.getElementById('dpOk').onclick();
  eq(out, '2026-10-15 09:30');
});
test('datePicker 切换月份', () => {
  UI.datePicker('2026-10-15 09:30', () => {});
  const before = doc.getElementById('dpM').textContent;
  doc.getElementById('dpPrev').onclick();
  const after = doc.getElementById('dpM').textContent;
  ok(before !== after, '月份应变化');
});
test('periodPicker 月份网格', () => {
  let out = null;
  UI.periodPicker('month', '2026-03', v => { out = v; });
  eq(doc.querySelectorAll('.pp-cell').length, 12, '12 个月份格');
  ok(doc.querySelector('.pp-cell.on'), '当前月高亮');
  doc.querySelectorAll('.pp-cell:not(.dis)')[0].onclick();
  eq(out, '2026-01');
});
test('periodPicker 年份网格', () => {
  let out = null;
  UI.periodPicker('year', '2026', v => { out = v; });
  eq(doc.querySelectorAll('.pp-cell').length, 12, '12 个年份格');
  ok(doc.querySelector('.pp-cell.now'), '当前年应有标记');
  doc.querySelectorAll('.pp-cell:not(.dis)')[0].onclick();
  ok(/^\d{4}$/.test(out), '返回 4 位年份');
});
test('未来月份置灰不可选', () => {
  const now = new Date();
  UI.periodPicker('month', fmt.curMonth(), () => {});
  const nowY = now.getFullYear(), nowM = now.getMonth() + 1;
  if (nowM < 12) {
    const cells = [...doc.querySelectorAll('.pp-cell')];
    const future = cells[nowM]; // 下个月
    ok(future && future.classList.contains('dis'), '未来月份应置灰');
  }
});

/* ============ 我的页 ============ */
suite('我的页');
test('头像使用 App 图标', () => {
  resetState(); ViewsMine.render(header(), main());
  const img = doc.querySelector('.me-avatar img');
  ok(img, '应有头像图片');
  ok(img.getAttribute('src').includes('appicon'), '应引用 appicon.png');
});
test('关于入口显示版本号', () => {
  const cell = [...doc.querySelectorAll('.cell[data-go="about"]')][0];
  ok(cell, '应有关于入口');
  ok(/1.0.6/.test(cell.textContent), '应显示版本 1.0.6');
});
test('钱包/账单入口存在', () => {
  ok(doc.querySelector('.cell[data-go="wallet"]'), '应有钱包入口');
  ok(doc.querySelector('.cell[data-go="bills"]'), '应有账单入口');
});
test('无周期记账入口（已移除）', () => {
  ok(!doc.querySelector('.cell[data-go="cycles"]'), '不应有周期记账');
});

/* ============ 清空数据 ============ */
suite('清空数据 · 确认码');
test('弹层生成 6 位确认码且含四类字符', () => {
  resetState(); S.seedDemo();
  ViewsMine.wipeSheet();
  const code = doc.getElementById('wipeCode').textContent.trim();
  eq(code.length, 6, '应为 6 位');
  ok(/[A-Z]/.test(code), '含大写');
  ok(/[a-z]/.test(code), '含小写');
  ok(/[0-9]/.test(code), '含数字');
  ok(/[!@#%&*+=?]/.test(code), '含符号');
});
test('输入错误确认码时按钮禁用', () => {
  resetState(); ViewsMine.wipeSheet();
  const inp = doc.getElementById('wipeInput');
  inp.value = 'wrong1';
  inp.oninput();
  ok(doc.getElementById('wipeGo').disabled, '应禁用');
});
test('输入正确确认码后可清空', () => {
  resetState(); S.seedDemo(); ViewsMine.wipeSheet();
  const code = doc.getElementById('wipeCode').textContent.trim();
  const inp = doc.getElementById('wipeInput');
  inp.value = code;
  inp.oninput();
  ok(!doc.getElementById('wipeGo').disabled, '应启用');
  const n = S.s.records.length;
  ok(n > 0, '清空前应有数据');
  doc.getElementById('wipeGo').onclick();
  eq(S.s.records.length, 0, '清空后无账单');
});
test('换一个可重新生成', () => {
  ViewsMine.wipeSheet();
  const c1 = doc.getElementById('wipeCode').textContent;
  doc.getElementById('wipeRegen').onclick();
  const c2 = doc.getElementById('wipeCode').textContent;
  ok(c1 !== c2, '应生成新码');
});

/* ============ 账单页 ============ */
suite('账单页');
test('按月分组渲染', () => {
  resetState(); S.seedDemo();
  App.viewMonth = fmt.curMonth();
  ViewsBills.render(header(), main());
  ok(doc.querySelectorAll('.day-group').length > 0, '应有日期分组');
  ok(main().innerHTML.includes('本月支出'), '应有月汇总');
});
test('月份切换按钮存在且方向正确', () => {
  const prev = doc.getElementById('mPrev'), next = doc.getElementById('mNext');
  ok(prev && next, '应有切换按钮');
  ok(prev.querySelector('svg') && next.querySelector('svg'), '应有箭头图标');
});
test('转账记录显示图标（Bug 回归）', () => {
  resetState();
  const accs = S.s.accounts;
  S.addRecord({ type: 'transfer', amount: 100, accountId: accs[0].id, toAccountId: accs[1].id, date: fmt.curMonth() + '-05 10:00' });
  App.viewMonth = fmt.curMonth();
  ViewsBills.render(header(), main());
  const html = main().innerHTML;
  ok(html.includes('转账'), '应显示转账记录');
  // 图标容器内必须有 svg，不能是空 div
  const m = html.match(/<div class="bi-icon"[^>]*>([\s\S]*?)<\/div>/);
  ok(m && m[1].includes('<svg'), '转账图标应为 SVG，实际: ' + (m ? m[1].slice(0, 60) : '无'));
});


/* ============ 安全与边界 ============ */
suite('安全 · XSS 与边界');
test('弹层标题转义（分类名含标签）', () => {
  UI.sheet({ title: '<img src=x onerror=alert(1)>' });
  const t = doc.querySelector('.sheet-title');
  ok(!t.querySelector('img'), '标题中的 HTML 不应被解析');
  ok(t.textContent.includes('<img'), '应作为纯文本显示');
});
test('分类名含特殊字符渲染不破坏结构', () => {
  resetState();
  S.addCategory('expense', '<b>粗</b>', 'svg:canyin', '#FF0000');
  ViewsMine.render(header(), main());
  ok(!main().querySelector('b'), '分类名中的标签不应被解析');
});
test('金额为 0 的账单不参与排行', () => {
  resetState();
  S.addRecord({ type: 'expense', amount: 0, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: fmt.curMonth() + '-01 10:00' });
  ViewsReport.range = { mode: 'month', month: App.viewMonth || fmt.curMonth(), year: null, start: null, end: null };
  ViewsReport.render(header(), main());
  ok(!main().innerHTML.includes('NaN'), '不应出现 NaN');
});
test('空数据时各页面正常渲染', () => {
  S.reset(); S.boot();
  for (const fn of [
    () => ViewsBills.render(header(), main()),
    () => { ViewsReport.range = { mode: 'month', month: fmt.curMonth(), year: null, start: null, end: null }; ViewsReport.render(header(), main()); },
    () => ViewsWallet.render(header(), main()),
    () => ViewsMine.render(header(), main())
  ]) {
    fn();
    ok(main().innerHTML.length > 50, '空态也应有内容');
    ok(!main().innerHTML.includes('NaN'), '空态不应 NaN');
  }
});
test('转账模式快捷条隐藏账户/成员', () => {
  resetState(); ViewsAdd.open();
  // 切到转账
  const seg = doc.querySelectorAll('.seg button');
  const trans = [...seg].find(b => b.dataset.m === 'transfer' || b.textContent.includes('转账'));
  if (trans) { trans.onclick(); 
    const qbs = [...doc.querySelectorAll('.jy-quickbar [data-qb]')].map(b => b.dataset.qb);
    ok(!qbs.includes('acc'), '转账模式不应有账户按钮');
    ok(!qbs.includes('member'), '转账模式不应有成员按钮');
  } else ok(true, '转账入口未找到，跳过');
});
test('成员列表为空时点击成员按钮不崩溃', () => {
  resetState();
  S.s.settings.members = [];
  ViewsAdd.open();
  const btn = doc.querySelector('.jy-quickbar [data-qb="member"]');
  if (btn) btn.onclick({ stopPropagation() {} });
  ok(true, '不应抛异常');
});


suite('记一笔 · 布局固定（快捷条常驻）');
function openAdd(mode) {
  doc.getElementById('sheetHost').innerHTML = ''; if (UI._sheets) UI._sheets = [];
  resetState(); ViewsAdd.open();
  if (mode) {
    const b = [...doc.querySelectorAll('#modeRow .jy-mode')].find(x => x.dataset.mode === mode);
    if (b) b.onclick();
  }
}
test('sheet-body 使用 flex 固定布局', () => {
  openAdd();
  const body = doc.querySelector('#sheetHost .sheet-body');
  ok(body.classList.contains('jy-sheet-body'), '应加 jy-sheet-body 类');
  ok(doc.getElementById('jyKeys'), '键盘应存在');
  eq(doc.getElementById('jyKeys').parentElement.classList.contains('sheet'), true, '键盘应在 sheet 下（不随内容滚动）');
});
test('快捷条位于分类宫格之后、键盘之前', () => {
  openAdd();
  const jyBody = doc.getElementById('jyBody');
  const kids = [...jyBody.children];
  const iGrid = kids.findIndex(k => k.classList.contains('jy-grid-wrap'));
  const iQB = kids.findIndex(k => k.classList.contains('jy-quickbar'));
  ok(iGrid >= 0 && iQB >= 0, '宫格与快捷条都应存在');
  ok(iQB > iGrid, '快捷条应在宫格之后');
});
test('三种模式都有快捷条且事件已绑定', () => {
  for (const mode of ['expense', 'income', 'transfer']) {
    openAdd(mode);
    const qb = doc.querySelector('.jy-quickbar');
    ok(qb, mode + ' 模式应有快捷条');
    const btns = [...qb.querySelectorAll('[data-qb]')];
    ok(btns.length >= 4, mode + ' 快捷条按钮不足');
    ok(btns.every(b => !!b.onclick), mode + ' 快捷条按钮事件未绑定');
    ok(btns.some(b => b.dataset.qb === 'date'), mode + ' 缺少日期按钮');
  }
});
test('转账模式快捷条隐藏账户/成员', () => {
  openAdd('transfer');
  const qbs = [...doc.querySelectorAll('.jy-quickbar [data-qb]')].map(b => b.dataset.qb);
  eq(qbs.join(','), 'date,tag,photo,note', '转账模式应只保留日期/标签/附件/备注');
});
test('切换模式后快捷条不重复', () => {
  openAdd('expense');
  const b = [...doc.querySelectorAll('#modeRow .jy-mode')].find(x => x.dataset.mode === 'income');
  b.onclick();
  eq(doc.querySelectorAll('.jy-quickbar').length, 1, '应只有一个快捷条');
  eq(doc.querySelectorAll('.jy-quickbar [data-qb]').length, 6, '按钮不应重复');
});


suite('弹层单例（连点不叠加）');
test('连点工具按钮只保留一个弹层', async () => {
  openAdd();
  const btn = doc.querySelector('.jy-quickbar [data-qb="tag"]');
  for (let i = 0; i < 5; i++) btn.onclick({ stopPropagation() {} });
  eq(doc.querySelectorAll('#sheetHost .sheet').length, 1, '连点 5 次应只有 1 个弹层');
  eq(UI._sheets.length, 1, '栈深度应为 1');
});
test('各弹层入口连点均不叠加', async () => {
  const cases = [
    ['附件', () => ViewsAdd.photoSheet({ photos: [] }, () => {})],
    ['备注', () => ViewsAdd.noteSheet({ note: '' }, () => {})],
    ['账户', () => ViewsAdd.pickAccount('accountId', { accountId: '' }, () => {})],
    ['导出', () => ViewsMine.exportSheet()],
    ['导入', () => ViewsMine.importSheet()],
    ['清空', () => ViewsMine.wipeSheet()],
    ['成员', () => ViewsMine.membersSheet()],
    ['币种', () => ViewsMine.currencySheet()],
    ['应用锁', () => Lock.settingsSheet()],
    ['WebDAV', () => WebDAV.settingsSheet()],
    ['日期', () => UI.datePicker('2026-10-31 12:00', () => {})]
  ];
  for (const [name, open] of cases) {
    doc.getElementById('sheetHost').innerHTML = ''; if (UI._sheets) UI._sheets = [];
    open(); open(); open();
    const n = doc.querySelectorAll('#sheetHost .sheet').length;
    eq(n, 1, name + ' 连点 3 次应只有 1 个弹层，实际 ' + n);
  }
});
test('closeSheet 渐隐动画后节点被移除', async () => {
  doc.getElementById('sheetHost').innerHTML = ''; if (UI._sheets) UI._sheets = [];
  ViewsMine.exportSheet();
  eq(doc.querySelectorAll('#sheetHost .sheet').length, 1);
  UI.closeSheet();
  await new Promise(r => setTimeout(r, 300));
  eq(doc.querySelectorAll('#sheetHost .sheet').length, 0, '关闭后节点应移除');
  eq(UI._sheets.length, 0, '栈应清空');
});
test('切换打开不同弹层，旧的立即移除', () => {
  doc.getElementById('sheetHost').innerHTML = ''; if (UI._sheets) UI._sheets = [];
  ViewsMine.exportSheet();
  ViewsMine.importSheet();
  eq(doc.querySelectorAll('#sheetHost .sheet').length, 1, '旧弹层应立即移除');
  ok(doc.querySelector('#wdRestore') || doc.getElementById('impFile') || doc.querySelector('#sheetHost .sheet'), '新弹层正常');
});


suite('记一笔 · 子弹层机制');
test('记一笔主层无扫码按钮（已移除）', () => {
  openAdd();
  const head = doc.querySelector('#sheetHost .sheet-head');
  ok(head, '应有弹层头');
  ok(!head.querySelector('.hd-btn[data-close2] svg'), '不应有右上角扫码图标');
  ok(doc.querySelector('#sheetHost .sheet-head').textContent.includes('记一笔'), '标题应为记一笔');
});
test('从记一笔打开子层，关闭子层后记一笔仍在', () => {
  openAdd();
  App.page = 'bills';   // 模拟从账单页打开（openAdd 内 resetState 会重置 App 状态）
  doc.querySelector('.jy-quickbar [data-qb="tag"]').onclick({ stopPropagation() {} });
  eq(UI._sheets.length, 2, '主层+子层');
  UI.closeSheet();  // 关闭子层
  ok(doc.getElementById('jyKeys'), '关闭子层后记一笔键盘应仍在');
  ok(doc.getElementById('jyBody'), '记一笔内容应仍在');
  eq(App.page, 'bills', '不应退出到其他页面');
});
test('子层互斥：连点子层按钮只保留一个子层', () => {
  openAdd();
  const tag = doc.querySelector('.jy-quickbar [data-qb="tag"]');
  tag.onclick({ stopPropagation() {} });
  tag.onclick({ stopPropagation() {} });
  tag.onclick({ stopPropagation() {} });
  eq(UI._sheets.length, 2, '应为 主层 + 1 个子层');
  // 等渐隐移除后 DOM 也应为 2
});
test('关闭主层时子层一并关闭', async () => {
  openAdd();
  doc.querySelector('.jy-quickbar [data-qb="photo"]').onclick({ stopPropagation() {} });
  eq(UI._sheets.length, 2);
  UI.closeSheet();  // 关子层
  UI.closeSheet();  // 关主层
  await new Promise(r => setTimeout(r, 300));
  eq(doc.querySelectorAll('#sheetHost .sheet').length, 0, '应全部关闭');
  eq(UI._sheets.length, 0, '栈应清空');
});

const okAll = summary();
process.exit(okAll ? 0 : 1);

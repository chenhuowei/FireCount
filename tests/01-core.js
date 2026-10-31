/**
 * 核心逻辑测试：数据层 / 记账 / 导入导出 / 统计
 */
const { createEnv, suite, test, assert, eq, ok, throws, summary } = require('./harness');

const { window, T } = createEnv();
const S = T.Store, fmt = T.fmt, WebDAV = T.WebDAV, Lock = T.Lock;

/* ============ 数据层 ============ */
suite('数据层 · 初始化');
test('boot 生成默认账本/账户/分类', () => {
  S.boot();
  ok(S.s.books.length >= 1, '应有默认账本');
  ok(S.s.accounts.length >= 1, '应有默认账户');
  eq(S.categories('expense').length, 24, '支出分类 24 项（与用户 Excel 数据一致）');
  eq(S.categories('income').length, 9, '收入分类 9 项');
});
test('分类按 order 排序', () => {
  const cats = S.categories('expense');
  for (let i = 1; i < cats.length; i++) ok(cats[i - 1].order <= cats[i].order, 'order 应升序');
});
test('分类图标均为 svg: 前缀且键存在', () => {
  for (const c of S.categories()) ok(/^svg:/.test(c.icon), c.name + ' 图标应为 svg: 前缀');
});

suite('数据层 · 记账 CRUD');
test('addRecord 写入并可查', () => {
  const before = S.s.records.length;
  const r = S.addRecord({ type: 'expense', amount: 25.5, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 12:00', note: '午饭' });
  eq(S.s.records.length, before + 1);
  eq(r.amount, 25.5);
  ok(r.id, '应有 id');
});
test('updateRecord 修改生效', () => {
  const r = S.s.records[S.s.records.length - 1];
  S.updateRecord(r.id, { amount: 30 });
  eq(S.category(r.categoryId).id, 'ce_canyin');
  eq(S.s.records.find(x => x.id === r.id).amount, 30);
});
test('deleteRecord 删除生效', () => {
  const r = S.addRecord({ type: 'expense', amount: 1, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-02 10:00' });
  const n = S.s.records.length;
  S.deleteRecord(r.id);
  eq(S.s.records.length, n - 1);
});
test('addRecord 默认值完整（tags/photos/member）', () => {
  const r = S.addRecord({ amount: 5, date: '2026-10-03 10:00' });
  ok(Array.isArray(r.tags) && Array.isArray(r.photos), 'tags/photos 应为数组');
  ok(r.member, '应有默认成员');
});

/* ============ 统计 ============ */
suite('统计 · 月/区间汇总');
test('monthSummary 收支分离正确', () => {
  S.reset(); S.boot();
  S.addRecord({ type: 'income', amount: 1000, categoryId: 'ci_gongzi', accountId: S.s.accounts[0].id, date: '2026-05-10 09:00' });
  S.addRecord({ type: 'expense', amount: 300, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-05-11 09:00' });
  S.addRecord({ type: 'expense', amount: 200, categoryId: 'ce_gouwu', accountId: S.s.accounts[0].id, date: '2026-05-12 09:00' });
  const sum = S.monthSummary('2026-05');
  eq(sum.in, 1000); eq(sum.out, 500); eq(sum.balance, 500);
});
test('转账不计入收支', () => {
  const accs = S.s.accounts;
  S.addRecord({ type: 'transfer', amount: 999, accountId: accs[0].id, toAccountId: accs[1].id, date: '2026-05-13 09:00' });
  const sum = S.monthSummary('2026-05');
  eq(sum.in, 1000, '收入不受转账影响');
  eq(sum.out, 500, '支出不受转账影响');
});
test('rangeSummary 区间含端点', () => {
  const r = S.rangeSummary('2026-05-10', '2026-05-11');
  eq(r.in, 1000); eq(r.out, 300);
});
test('byCategory 汇总与排序', () => {
  const list = S.byCategory('2026-05', 'expense');
  eq(list.length, 2);
  eq(list[0].amount, 300, '金额降序');
});
test('rangeByCategory 与 byCategory 一致', () => {
  const a = S.byCategory('2026-05', 'expense');
  const b = S.rangeByCategory('2026-05-01', '2026-05-31', 'expense');
  eq(a.length, b.length);
  eq(a[0].amount, b[0].amount);
});
test('monthDaysWithRecords 统计正确', () => {
  eq(S.monthDaysWithRecords('2026-05'), 4, '4 天有记录（含转账日）');
});

/* ============ 账户余额 ============ */
suite('账户 · 余额计算');
test('钱包汇总：支出使资产减少', () => {
  S.reset(); S.boot();
  const cash = S.s.accounts[0];
  const before = S.accountBalance(cash.id);
  S.addRecord({ type: 'expense', amount: 300, categoryId: 'ce_canyin', accountId: cash.id, date: '2026-06-01 10:00' });
  eq(S.accountBalance(cash.id), before - 300, '支出后余额减少 300');
  const w = S.walletSummary();
  ok(typeof w.asset === 'number' && typeof w.debt === 'number' && typeof w.net === 'number', '汇总字段齐全');
  eq(w.net, Math.round((w.asset - w.debt) * 100) / 100, '净资产 = 资产 - 负债');
});
test('转账双向变动余额', () => {
  S.reset(); S.boot();
  const a = S.s.accounts[0], b = S.s.accounts[1];
  a.initial = 1000; b.initial = 0;
  S.addRecord({ type: 'transfer', amount: 400, accountId: a.id, toAccountId: b.id, date: '2026-06-02 10:00' });
  eq(S.accountBalance(a.id), 600, '转出账户减少');
  eq(S.accountBalance(b.id), 400, '转入账户增加');
});

/* ============ 预算 ============ */
suite('预算');
test('setBudget / budgetSpent', () => {
  S.reset(); S.boot();
  S.setBudget('2026-07', { total: 1000, perCategory: {} });
  S.addRecord({ type: 'expense', amount: 250, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-07-05 10:00' });
  eq(S.budget('2026-07').total, 1000);
  eq(S.budgetSpent('2026-07'), 250);
  eq(S.categoryBudgetSpent('2026-07', 'ce_canyin'), 250);
});

/* ============ 导入导出 ============ */
suite('导入导出 · JSON');
test('exportJSON → replaceState 往返一致', () => {
  S.reset(); S.boot();
  S.addRecord({ type: 'expense', amount: 12.34, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-08-01 10:00', note: '测试' });
  const json = S.exportJSON();
  const n = S.s.records.length;
  S.replaceState(JSON.parse(json));
  eq(S.s.records.length, n);
  eq(S.s.records[0].amount, 12.34);
});
test('exportCSV 含 BOM 与表头', () => {
  const csv = S.exportCSV();
  ok(csv.charCodeAt(0) === 0xFEFF, '应含 UTF-8 BOM');
  ok(csv.includes('日期') && csv.includes('金额'), '应含表头');
  ok(csv.includes('12.34'), '应含数据');
});

suite('导入导出 · CSV/XLSX');
test('口袋格式 CSV 导入（正负号判收支）', () => {
  S.reset(); S.boot();
  const csv = '时间,账目分类,金额\n2026-09-01 09:00,餐饮,-35.50\n2026-09-05 10:00,工资,8000';
  const r = S.importKdjzCSV(csv, 'append');
  eq(r.added, 2);
  const recs = S.s.records;
  eq(recs.find(x => x.type === 'expense').amount, 35.5);
  eq(recs.find(x => x.type === 'income').amount, 8000);
});
test('余额变更行被跳过', () => {
  S.reset(); S.boot();
  const csv = '时间,账目分类,金额\n2026-09-01 09:00,余额变更,1000';
  const r = S.importKdjzCSV(csv, 'append');
  eq(r.added, 0);
  eq(S.s.records.length, 0);
});
test('重复导入全部去重', () => {
  S.reset(); S.boot();
  const csv = '时间,账目分类,金额\n2026-09-01 09:00,餐饮,-35.50';
  S.importKdjzCSV(csv, 'append');
  const r2 = S.importKdjzCSV(csv, 'append');
  eq(r2.added, 0, '第二次应全部跳过');
  eq(S.s.records.length, 1);
});
test('未知分类自动创建且带图标', () => {
  S.reset(); S.boot();
  const csv = '时间,账目分类,金额\n2026-09-01 09:00,全新分类名,-10';
  S.importKdjzCSV(csv, 'append');
  const c = S.s.categories.find(x => x.name === '全新分类名');
  ok(c, '应自动创建分类');
  ok(/^svg:/.test(c.icon), '应有 svg 图标');
});
test('覆盖模式清空当前账本', () => {
  S.reset(); S.boot();
  S.addRecord({ type: 'expense', amount: 99, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-09-01 08:00', note: '旧数据' });
  const csv = '时间,账目分类,金额\n2026-09-10 09:00,餐饮,-20';
  S.importKdjzCSV(csv, 'replace');
  eq(S.s.records.length, 1, '应只剩新导入的 1 笔');
  eq(S.s.records[0].amount, 20);
});
test('无表头文件抛出明确错误', () => {
  throws(() => S.importKdjzCSV('随便,一行\n数据,没有表头', 'append'), '应抛错');
});
test('表头前置说明行可跳过', () => {
  S.reset(); S.boot();
  const csv = '口袋记账导出\n导出时间：2026-10-01\n时间,账目分类,金额\n2026-09-01 09:00,餐饮,-10';
  const r = S.importKdjzCSV(csv, 'append');
  eq(r.added, 1);
});
test('引号内逗号不被拆分', () => {
  S.reset(); S.boot();
  const csv = '时间,账目分类,金额,备注\n2026-09-01 09:00,餐饮,-10,"麦当劳,汉堡"';
  S.importKdjzCSV(csv, 'append');
  eq(S.s.records[0].note, '麦当劳,汉堡');
});
test('Excel 序列日期转换', () => {
  S.reset(); S.boot();
  const rows = [['时间', '金额'], [45870.5, -55]];
  S.importRows(rows, 'append');
  ok(/^2025-0?8-/.test(S.s.records[0].date) || /^2025-/.test(S.s.records[0].date), '序列日期应转为 YYYY-MM-DD，实际 ' + S.s.records[0].date);
});

/* ============ 账本 / 标签 / 分类管理 ============ */
suite('账本 · 标签 · 分类');
test('新建账本后记录隔离', () => {
  S.reset(); S.boot();
  const b1 = S.book().id;
  S.addRecord({ type: 'expense', amount: 10, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 10:00' });
  const nb = S.addBook('工作');
  S.s.currentBookId = nb.id;
  eq(S.bookRecords().length, 0, '新账本应为空');
  S.s.currentBookId = b1;
  eq(S.bookRecords().length, 1);
});
test('标签增删与账单剥离', () => {
  S.reset(); S.boot();
  S.addTag('报销');
  ok(S.tags().includes('报销'));
  const r = S.addRecord({ type: 'expense', amount: 10, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 10:00', tags: ['报销'] });
  S.deleteTag('报销');
  ok(!S.tags().includes('报销'), '标签应删除');
  ok(!S.s.records.find(x => x.id === r.id).tags.includes('报销'), '账单上的标签应剥离');
});
test('分类排序持久化', () => {
  S.reset(); S.boot();
  const cats = S.categories('expense');
  const last = cats[cats.length - 1];
  S.updateCategory(last.id, { order: -1 });
  eq(S.categories('expense')[0].id, last.id);
});
test('有账单的分类不可删除', () => {
  S.reset(); S.boot();
  S.addRecord({ type: 'expense', amount: 10, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 10:00' });
  eq(S.deleteCategory('ce_canyin'), false, '应拒绝删除');
  const custom = S.addCategory('expense', '测试类', 'svg:canyin', '#FF0000');
  eq(S.deleteCategory(custom.id), true, '空分类可删除');
});

/* ============ 搜索 ============ */
suite('搜索');
test('按备注/分类/金额搜索', () => {
  S.reset(); S.boot();
  S.addRecord({ type: 'expense', amount: 88, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 10:00', note: '星巴克咖啡' });
  eq(S.searchRecords('星巴克').length, 1);
  eq(S.searchRecords('餐饮').length, 1, '按分类名可搜');
  eq(S.searchRecords('88').length, 1, '按金额可搜');
  eq(S.searchRecords('不存在的东西').length, 0);
});

/* ============ 工具函数 ============ */
suite('工具函数');
test('fmt.monthDay 格式正确', () => {
  eq(fmt.monthDay('2026-10-05'), '10月5日');
  eq(fmt.monthDay('2026-01-31'), '1月31日');
});
test('fmt.dayLabel 今天/昨天', () => {
  const today = fmt.YMD(new Date());
  eq(fmt.dayLabel(today), '今天');
  const y = new Date(); y.setDate(y.getDate() - 1);
  eq(fmt.dayLabel(fmt.YMD(y)), '昨天');
});
test('fmt.money 两位小数', () => {
  eq(fmt.money(1234.5), '1,234.50');
  eq(fmt.money(0), '0.00');
});


suite('分类 · 与用户数据一致');
test('支出分类与 Excel 完全一致（24 项同名同序）', () => {
  const expect = ['餐饮','买菜','生活用品','交通','药品','零食','酒水饮料','水果','衣服鞋包','房租','护肤彩妆','数码产品','理发','医疗','话费','聚会','旅游','礼物','学习','红包','家装','娱乐','股票','电影'];
  eq(S.categories('expense').map(c => c.name).join(','), expect.join(','));
});
test('每个分类都有可渲染图标', () => {
  for (const c of S.categories()) ok(/^svg:/.test(c.icon), c.name + ' 应为 svg 图标');
});
test('syncCategories 补齐缺失 + 清理无引用旧内置 + 保留自定义', () => {
  S.reset();
  S.s = S.freshState();
  S.s.categories = [
    { id: 'ce_canyin', type: 'expense', name: '餐饮', icon: 'svg:canyin', color: '#FF8A3C', order: 0, custom: false },
    { id: 'ce_gouwu', type: 'expense', name: '购物', icon: 'svg:gouwu', color: '#F5588A', order: 1, custom: false },
    { id: 'ce_chongwu', type: 'expense', name: '宠物', icon: 'svg:chongwu', color: '#F97316', order: 2, custom: false },
    { id: 'ce_taobao', type: 'expense', name: '淘宝', icon: 'svg:taobao', color: '#FF6A00', order: 3, custom: false },
    { id: 'ce_mine', type: 'expense', name: '我的自定义', icon: 'svg:canyin', color: '#000', order: 99, custom: true }
  ];
  S.s.records = [{ id: 'r1', type: 'expense', amount: 10, categoryId: 'ce_taobao', accountId: 'a', date: '2026-10-01 10:00', tags: [], photos: [] }];
  S.syncCategories();
  const names = S.categories('expense').map(c => c.name);
  ok(names.includes('买菜'), '应补齐新默认分类');
  eq(S.category('ce_gouwu').name, '生活用品', 'ce_gouwu 应同步为生活用品');
  ok(!names.includes('宠物'), '无引用的旧内置应清理');
  ok(names.includes('淘宝'), '有账单引用的旧内置应保留');
  ok(names.includes('我的自定义'), '自定义分类应保留');
  ok(S.category('ce_taobao'), '账单引用仍有效');
});
test('Excel 24 分类导入零新建、零未映射', () => {
  S.reset(); S.boot();
  const names = S.categories('expense').map(c => c.name);
  const before = names.length;
  const rows = [['时间', '账目分类', '金额'], ...names.map((n, i) => ['2026-09-' + String(i + 1).padStart(2, '0') + ' 10:00', n, -10])];
  S.importRows(rows, 'append');
  eq(S.categories('expense').length, before, '不应新建分类');
  eq(S.s.records.filter(r => !r.categoryId).length, 0, '不应有未映射账单');
  eq(new Set(S.s.records.map(r => S.category(r.categoryId).name)).size, 24, '24 类应各自映射');
});


suite('备份内容 · 完整性 vs 安全性');
test('备份包含全部配置数据（不只账单）', () => {
  S.reset(); S.boot();
  S.s.settings.theme = 'deep';
  S.s.settings.currency = String.fromCharCode(36); // $
  S.s.settings.members = ['我', '老婆'];
  S.addTag('报销');
  S.setBudget('2026-10', { total: 5000, perCategory: { ce_canyin: 1500 } });
  S.addCategory('expense', '自定义类', 'svg:canyin', '#123456');
  const acc = S.s.accounts[0];
  acc.creditLimit = 50000; acc.billDay = 5; acc.repayDay = 20;
  S.addRecord({ type: 'expense', amount: 100, categoryId: 'ce_canyin', accountId: acc.id, date: '2026-10-01 10:00' });

  const j = JSON.parse(S.exportJSON());
  eq(j.books.length >= 1, true, '账本');
  eq(j.accounts.length >= 1, true, '账户');
  eq(j.accounts[0].creditLimit, 50000, '账户配置（信用卡额度）');
  eq(j.accounts[0].billDay, 5, '账户配置（账单日）');
  eq(j.categories.filter(c => c.custom).length, 1, '自定义分类');
  eq(j.records.length, 1, '账单');
  eq(j.budgets['2026-10'].total, 5000, '预算');
  eq(j.settings.theme, 'deep', '主题');
  eq(j.settings.currency, String.fromCharCode(36), '币种');
  eq(j.settings.members.length, 2, '成员');
  ok(j.settings.tags.includes('报销'), '标签');
});
test('备份不携带 WebDAV 账号密码（安全）', () => {
  const c = WebDAV.cfg();
  c.user = 'me@x.com'; c.pass = 'SECRET_PASSWORD'; c.dir = '/firecount/';
  const raw = S.exportJSON();
  ok(!raw.includes('SECRET_PASSWORD'), '备份不得包含应用密码');
  ok(!raw.includes('me@x.com'), '备份不得包含 WebDAV 账号');
  const j = JSON.parse(raw);
  eq(j.settings.webdav.pass, undefined, 'pass 应被剥离');
  eq(j.settings.webdav.user, undefined, 'user 应被剥离');
});
test('备份不携带应用锁 PIN/答案哈希（安全）', () => {
  const lk = Lock.cfg();
  lk.enabled = true; lk.pinSalt = 'aa'; lk.pinHash = 'deadbeef'; lk.answerSalt = 'bb'; lk.answerHash = 'cafebabe';
  const j = JSON.parse(S.exportJSON());
  eq(j.settings.lock.enabled, false, '恢复后不应自动上锁');
  eq(j.settings.lock.pinHash, '', 'PIN 哈希应清空');
  eq(j.settings.lock.answerHash, '', '答案哈希应清空');
});
test('恢复备份保留本机 WebDAV 凭证', () => {
  S.reset(); S.boot();
  const w = WebDAV.cfg(); w.user = 'local@x.com'; w.pass = 'LOCAL_PASS';
  const backup = JSON.parse(S.exportJSON());
  S.reset(); S.boot();
  const w2 = WebDAV.cfg(); w2.user = 'local@x.com'; w2.pass = 'LOCAL_PASS';
  S.replaceState(backup);
  eq(WebDAV.cfg().pass, 'LOCAL_PASS', '本机凭证应保留');
});
test('恢复备份后配置数据完整回填', () => {
  S.reset(); S.boot();
  S.setBudget('2026-10', { total: 5000, perCategory: { ce_canyin: 1500 } });
  S.addCategory('expense', '自定义类', 'svg:canyin', '#123456');
  S.s.settings.members = ['我', '老婆'];
  S.addRecord({ type: 'expense', amount: 100, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 10:00' });
  const backup = JSON.parse(S.exportJSON());
  S.reset(); S.boot();
  S.replaceState(backup);
  eq(S.s.records.length, 1, '账单恢复');
  eq(S.s.budgets['2026-10'].total, 5000, '预算恢复');
  eq(S.s.categories.filter(c => c.custom).length, 1, '自定义分类恢复');
  eq(S.s.settings.members.length, 2, '成员恢复');
});

const okAll = summary();
process.exit(okAll ? 0 : 1);

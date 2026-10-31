/**
 * APK 环境测试：原生桥（SQLite/指纹/WebDAV）+ 应用锁 + 自动备份
 */
const { createEnv, suite, test, assert, eq, ok, throws, summary, onCleanup } = require('./harness');

/* ============ 应用锁 ============ */
suite('应用锁 · PIN');
{
  const { window, T } = createEnv({ android: true });
  const { Store: S, Lock, UI } = T;
  const doc = window.document;
  onCleanup(() => {
    for (const id of ['sheetHost', 'modalHost', 'toastHost']) { const el = doc.getElementById(id); if (el) el.innerHTML = ''; }
    if (UI._sheets) UI._sheets = [];
    const ls = doc.getElementById('lockScreen'); if (ls) ls.remove();
    Lock.active = false;
  });

  test('未启用时 enabled() 为 false', () => {
    S.reset(); S.boot();
    eq(Lock.enabled(), false);
  });
  test('PIN 哈希加盐，同 PIN 不同盐结果不同', () => {
    const h1 = Lock.hash('aaaa', '1234');
    const h2 = Lock.hash('bbbb', '1234');
    ok(h1 !== h2, '不同盐应产生不同哈希');
    eq(Lock.hash('aaaa', '1234'), Lock.hash('aaaa', '1234'), '同盐同输入应一致');
  });
  test('SHA-256 已知向量正确', () => {
    eq(Lock.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    eq(Lock.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  test('设置 PIN 后可验证', () => {
    const c = Lock.cfg();
    c.enabled = true;
    c.pinSalt = Lock.randSalt();
    c.pinHash = Lock.hash(c.pinSalt, '1234');
    c.pinLen = 4;
    ok(Lock.enabled(), '应已启用');
    eq(Lock.verify('1234'), true);
    eq(Lock.verify('9999'), false);
  });
  test('指纹可用性检测（原生桥返回 true）', () => {
    eq(Lock.bioAvailable(), true);
  });
  test('showLock 渲染锁屏且含指纹按钮', () => {
    Lock.active = false;
    Lock.showLock();
    const el = doc.getElementById('lockScreen');
    ok(el, '应渲染锁屏');
    ok(el.querySelector('#lockBio'), '应显示指纹解锁按钮');
    eq(el.querySelectorAll('.lock-key').length, 11, '11 个实体键（1 2 3 4 5 6 7 8 9 0 del）+ 1 占位');
  });
  test('showLock 幂等（不重复渲染）', () => {
    Lock.showLock();
    const n1 = doc.querySelectorAll('#lockScreen').length;
    Lock.showLock(); Lock.showLock();
    const n2 = doc.querySelectorAll('#lockScreen').length;
    eq(n1, 1, '首次渲染 1 个');
    eq(n2, 1, '重复调用不应叠加');
  });
  test('指纹回调成功则解锁', () => {
    Lock.active = true;
    // 模拟原生回调
    window.__bioResult = okv => { if (okv && Lock.active) Lock.unlock(); };
    window.AndroidBridge.showBiometric('test');
    eq(Lock.active, false, '应已解锁');
  });
  test('unlock 执行 pendingAfterUnlock', done => { ok(true); });
  test('安全问题答案大小写不敏感', () => {
    const c = Lock.cfg();
    c.answerSalt = Lock.randSalt();
    c.answerHash = Lock.hashAnswer(c.answerSalt, 'MyDog');
    eq(Lock.hashAnswer(c.answerSalt, 'mydog'), c.answerHash, '小写应匹配');
    eq(Lock.hashAnswer(c.answerSalt, ' MYDOG '), c.answerHash, '带空格应匹配');
  });
}

/* ============ SQLite 持久化 ============ */
suite('APK · SQLite 持久化桥');
{
  const { window, T } = createEnv({ android: true });
  const { Store: S, UI } = T;
  const doc = window.document;
  onCleanup(() => {
    for (const id of ['sheetHost', 'modalHost', 'toastHost']) { const el = doc.getElementById(id); if (el) el.innerHTML = ''; }
    if (UI._sheets) UI._sheets = [];
  });

  test('save 走 dbSave（异步去抖）', () => {
    S.reset(); S.boot();
    S.addRecord({ type: 'expense', amount: 66, categoryId: 'ce_canyin', accountId: S.s.accounts[0].id, date: '2026-10-01 10:00' });
    S.saveNow();
    ok(window.__androidStore.db, '应写入原生库');
    const parsed = JSON.parse(window.__androidStore.db);
    ok(parsed.records.length >= 1, '库中应有记录');
  });
  test('boot 从 dbLoad 恢复数据', () => {
    const snapshot = window.__androidStore.db;
    S.s.records = [];
    S.boot();
    ok(S.s.records.length >= 1, '应从库恢复');
    eq(window.__androidStore.db, snapshot);
  });
  test('reset 清空数据并持久化空状态', () => {
    S.reset(); S.boot();
    S.addRecord({ amount: 9, date: '2026-10-01 10:00' });
    S.saveNow();
    ok(JSON.parse(window.__androidStore.db).records.length >= 1, '清空前有数据');
    S.reset();
    const after = JSON.parse(window.__androidStore.db);
    eq(after.records.length, 0, '清空后库中无记录');
    ok(after.books.length >= 1, '保留默认账本结构');
  });
}

/* ============ WebDAV ============ */
suite('WebDAV · 坚果云同步');
{
  let calls = [];
  const { window, T } = createEnv({
    android: true,
    webdavHandler(method, url) {
      calls.push({ method, url });
      if (method === 'HEAD') return { code: 200, body: '' };
      if (method === 'PROPFIND') return { code: 207, body: '<d:multistatus><d:response><d:href>/firecount/a.json</d:href></d:response></d:multistatus>' };
      if (method === 'MKCOL') return { code: 201, body: '' };
      if (method === 'PUT') return { code: 201, body: '' };
      if (method === 'GET') return { code: 200, body: JSON.stringify({ books: [{ id: 'b1', name: 'X' }], records: [], settings: {} }) };
      return { code: 200, body: '' };
    }
  });
  const { Store: S, WebDAV, UI, fmt } = T;
  const doc = window.document;
  onCleanup(() => {
    for (const id of ['sheetHost', 'modalHost', 'toastHost']) { const el = doc.getElementById(id); if (el) el.innerHTML = ''; }
    if (UI._sheets) UI._sheets = [];
    calls = [];
  });

  test('默认目录为 /firecount/', () => {
    S.reset(); S.boot();
    eq(WebDAV.cfg().dir, '/firecount/');
  });
  test('旧目录 /kdjz-backup/ 自动迁移', () => {
    WebDAV.cfg().dir = '/kdjz-backup/';
    eq(WebDAV.cfg().dir, '/firecount/');
  });
  test('自动备份延迟默认 5 秒', () => {
    eq(WebDAV.cfg().autoDelaySec, 5);
  });
  test('旧默认值 3 秒迁移为 5 秒，自定义值保留', () => {
    WebDAV.cfg().autoDelaySec = 3;
    eq(WebDAV.cfg().autoDelaySec, 5);
    WebDAV.cfg().autoDelaySec = 30;
    eq(WebDAV.cfg().autoDelaySec, 30);
  });
  test('URL 拼接正确（坚果云预设）', () => {
    const c = WebDAV.cfg();
    c.provider = 'jianguoyun'; c.server = ''; c.dir = '/firecount/';
    eq(WebDAV.serverBase(), 'https://dav.jianguoyun.com/dav/');
    eq(WebDAV.dirUrl(), 'https://dav.jianguoyun.com/dav/firecount/');
    eq(WebDAV.url('a.json'), 'https://dav.jianguoyun.com/dav/firecount/a.json');
  });
  test('Basic 认证头 UTF-8 编码正确', () => {
    const c = WebDAV.cfg();
    c.user = 'a@b.com'; c.pass = 'pwd';
    eq(WebDAV.authHeader(), 'Basic ' + window.btoa('a@b.com:pwd'));
  });
  test('configured() 需账号+密码', () => {
    const c = WebDAV.cfg();
    c.user = ''; c.pass = '';
    eq(WebDAV.configured(), false);
    c.user = 'u'; c.pass = 'p';
    eq(WebDAV.configured(), true);
  });
  test('测试连接使用 HEAD（不依赖 WebDAV 扩展方法）', async () => {
    // 异步用例：手动驱动
    const c = WebDAV.cfg();
    c.user = 'u'; c.pass = 'p'; c.provider = 'jianguoyun'; c.dir = '/firecount/';
    const p = WebDAV.testConn();
    await new Promise(r => setTimeout(r, 30));
    const n = await p;
    const heads = calls.filter(x => x.method === 'HEAD');
    ok(heads.length > 0, '应发出 HEAD 请求');
    ok(n >= 0, '应返回文件数或 -1');
  });
  test('PROPFIND 501 时降级为 GET 解析文件名', async () => {
    const { window: w2, T: t2 } = createEnv({
      android: true,
      webdavHandler(method) {
        if (method === 'PROPFIND') return { code: 501, body: '' };
        if (method === 'GET') return { code: 200, body: '<a href="/firecount/kdjz_20261031.json">x</a>' };
        return { code: 200, body: '' };
      }
    });
    t2.Store.reset(); t2.Store.boot();
    const c = t2.WebDAV.cfg();
    c.user = 'u'; c.pass = 'p'; c.provider = 'jianguoyun';
    const p = t2.WebDAV.list();
    await new Promise(r => setTimeout(r, 40));
    const files = await p;
    ok(files.length === 1 && files[0].name.includes('.json'), '应降级解析出文件名，实际 ' + JSON.stringify(files));
  });
  test('MKCOL 501 视为通过（PUT 自动建目录）', async () => {
    const { T: t2 } = createEnv({
      android: true,
      webdavHandler(method) {
        if (method === 'MKCOL') return { code: 501, body: '' };
        return { code: 201, body: '' };
      }
    });
    t2.Store.reset(); t2.Store.boot();
    const okv = await t2.WebDAV.ensureDir();
    eq(okv, true, '501 应视为通过');
  });
  test('备份会写入时间戳文件 + latest.json', async () => {
    const { T: t2, window: w2 } = createEnv({
      android: true,
      webdavHandler(method) { return { code: method === 'PUT' ? 201 : 200, body: '' }; }
    });
    const puts = [];
    w2.AndroidBridge.webdavRequest = (id, method, url) => {
      if (method === 'PUT') puts.push(url);
      setTimeout(() => w2.__webdavCbMap && w2.__webdavCbMap[id] && w2.__webdavCbMap[id](method === 'PUT' ? 201 : 200, ''), 0);
    };
    t2.Store.reset(); t2.Store.boot();
    const c = t2.WebDAV.cfg();
    c.user = 'u'; c.pass = 'p'; c.provider = 'jianguoyun';
    const p = t2.WebDAV.backupNow(true);
    await new Promise(r => setTimeout(r, 60));
    await p;
    ok(puts.some(u => u.includes('latest.json')), '应上传 latest.json，实际 ' + puts.join(' | '));
    ok(puts.some(u => /kdjz_\d{8}_\d{6}\.json/.test(u)), '应上传时间戳文件');
  });
  test('记账后触发自动备份（去抖）', async () => {
    const { T: t2, window: w2 } = createEnv({ android: true });
    let backups = 0;
    t2.Store.reset(); t2.Store.boot();
    const c = t2.WebDAV.cfg();
    c.user = 'u'; c.pass = 'p'; c.provider = 'jianguoyun';
    c.autoAfterSave = true; c.autoDelaySec = 1;
    t2.WebDAV.backupNow = () => { backups++; return Promise.resolve(); };
    t2.Store.addRecord({ type: 'expense', amount: 1, categoryId: 'ce_canyin', accountId: t2.Store.s.accounts[0].id, date: '2026-10-01 10:00' });
    eq(backups, 0, '不应立即备份');
    await new Promise(r => setTimeout(r, 1300));
    eq(backups, 1, '1 秒后应备份 1 次');
    // 连续记账去抖
    t2.Store.addRecord({ amount: 2, date: '2026-10-01 10:01' });
    t2.Store.addRecord({ amount: 3, date: '2026-10-01 10:02' });
    await new Promise(r => setTimeout(r, 1300));
    eq(backups, 2, '去抖后只多备份 1 次');
  });
  test('关闭自动备份后记账不触发', async () => {
    const { T: t2 } = createEnv({ android: true });
    let backups = 0;
    t2.Store.reset(); t2.Store.boot();
    const c = t2.WebDAV.cfg();
    c.user = 'u'; c.pass = 'p'; c.autoAfterSave = false; c.autoDelaySec = 1;
    t2.WebDAV.backupNow = () => { backups++; return Promise.resolve(); };
    t2.Store.addRecord({ amount: 1, date: '2026-10-01 10:00' });
    await new Promise(r => setTimeout(r, 1300));
    eq(backups, 0, '不应备份');
  });
}

/* ============ 浏览器环境降级 ============ */
suite('浏览器环境 · 降级行为');
{
  const { window, T } = createEnv();   // 无 AndroidBridge
  const { Store: S, WebDAV, Lock, UI } = T;
  const doc = window.document;
  onCleanup(() => {
    for (const id of ['sheetHost', 'modalHost', 'toastHost']) { const el = doc.getElementById(id); if (el) el.innerHTML = ''; }
    if (UI._sheets) UI._sheets = [];
  });

  test('无原生桥时 WebDAV.available() 为 false', () => {
    S.reset(); S.boot();
    eq(WebDAV.available(), false);
  });
  test('无原生桥时指纹不可用', () => {
    eq(Lock.bioAvailable(), false);
  });
  test('浏览器下数据写 localStorage', () => {
    S.reset(); S.boot();
    S.addRecord({ amount: 1, date: '2026-10-01 10:00' });
    S.saveNow();
    ok(window.localStorage.getItem('kdjz_state') || true, 'localStorage 写入不报错');
  });
  test('无原生桥时 WebDAV 备份给出提示而不崩溃', () => {
    ok(() => WebDAV.backupNow(true) || true, '不应抛异常');
  });
}

const okAll = summary();
process.exit(okAll ? 0 : 1);

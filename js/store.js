/* ============================================================
 * 数据层：localStorage 持久化 + 业务计算
 * 数据模型对齐 APK 证据：
 *  - 多账本 Books（BooksManageActivity）
 *  - 账户 Account（AccountAddActivity / 信用卡 creditdetail_*）
 *  - 记录 Record（AddNewRecordActivity：支出/收入/转账）
 *  - 预算 Budget（BudgetActivity_v3：月总预算 + 分类预算）
 *  - 周期记账 Cycle（NoticeAddActivity 定期提醒）
 * ============================================================ */
"use strict";

const Store = {
  KEY: "kdjz_clone_state_v1",
  s: null, // 当前状态

  /* ---------- 存储适配层 ----------
     APK 环境：AndroidBridge.dbSave/dbLoad → 原生 SQLite（无 localStorage 容量限制）
     浏览器环境：localStorage；SQLite 为空时自动从 localStorage 迁移旧数据 */
  storageGet() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.dbLoad) {
        const fromDb = window.AndroidBridge.dbLoad();
        if (fromDb) return fromDb;
      }
    } catch (e) { console.warn("dbLoad failed, fallback localStorage", e); }
    try { return localStorage.getItem(this.KEY) || ""; } catch (e) { return ""; }
  },
  storagePut(json) {
    let dbOk = false;
    try {
      if (window.AndroidBridge && window.AndroidBridge.dbSave) {
        window.AndroidBridge.dbSave(json);
        dbOk = true;
      }
    } catch (e) { console.warn("dbSave failed", e); }
    if (dbOk) return true; // SQLite 已持久化，不再镜像 localStorage（避免配额溢出）
    try { localStorage.setItem(this.KEY, json); return true; }
    catch (e) {
      console.error("localStorage save failed:", e);
      if (typeof UI !== "undefined" && UI.toast) UI.toast("本地存储空间不足，最新数据可能未保存");
      return false;
    }
  },

  /* ---------- 初始化 ---------- */
  boot() {
    const raw = this.storageGet();
    if (raw) {
      try { this.s = JSON.parse(raw); this.migrate(); } catch (e) { console.warn("state parse fail", e); }
    }
    if (!this.s) this.s = this.freshState();
    this.save();
  },
  freshState() {
    const now = Date.now();
    const bookId = "b_" + now;
    const cats = [];
    DATA.expenseCategories.forEach((c, i) => cats.push({ id: "ce_" + c.key, type: "expense", name: c.name, icon: c.icon, color: c.color, order: i, custom: false }));
    DATA.incomeCategories.forEach((c, i) => cats.push({ id: "ci_" + c.key, type: "income", name: c.name, icon: c.icon, color: c.color, order: i, custom: false }));
    const acc = (name, type, icon, color, init) => ({
      id: "a_" + type + "_" + now + "_" + Math.random().toString(36).slice(2, 6),
      name, type, icon, color, initial: init, creditLimit: 0, billDay: 0, repayDay: 0, note: "", createdAt: now
    });
    return {
      version: 1,
      books: [{ id: bookId, name: "默认账本" }],
      currentBookId: bookId,
      accounts: [
        acc("现金", "cash", "💰", "#F59E0B", 800),
        acc("支付宝", "virtual", "🔷", "#0EA5E9", 2350),
        acc("微信支付", "virtual", "💬", "#22C55E", 1200),
        acc("储蓄卡", "bank", "🏦", "#3B82F6", 38000)
      ],
      categories: cats,
      records: [],
      budgets: {},             // { "2026-10": { total: 4000, perCategory: { catId: 1200 } } }
      cycles: [],              // 周期记账
      settings: { theme: "light", currency: "¥", members: ["我"], tags: ["报销"], createdAt: now }
    };
  },
  migrate() {
    const s = this.s;
    if (!s.books) this.s = this.freshState();
    s.settings = s.settings || { theme: "light", currency: "¥", members: ["我"], createdAt: Date.now() };
    s.budgets = s.budgets || {};
    s.cycles = s.cycles || [];
    /* 旧版 reimburse 布尔 → 标签数组 */
    if (!s.settings.tags) {
      s.settings.tags = ["报销"];
      for (const r of s.records) {
        r.tags = r.reimburse ? ["报销"] : (r.tags || []);
        delete r.reimburse;
      }
    }
  },
  save() {
    /* APK（原生桥）：去抖合并——批量写入（如演示数据 100 笔）只落一次盘，
       避免同步桥逐笔阻塞 UI；浏览器（localStorage）保持同步直写 */
    if (window.AndroidBridge && window.AndroidBridge.dbSave) {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.saveNow(), 300);
    } else {
      this.storagePut(JSON.stringify(this.s));
    }
    /* 自动云备份钩子：记账后 N 秒自动推坚果云（内部再去抖，只推最后一次） */
    try { if (window.WebDAV) WebDAV.onDataSetChanged(); } catch (e) {}
    return true;
  },
  saveNow() {
    clearTimeout(this._saveTimer);
    return this.storagePut(JSON.stringify(this.s));
  },
  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    try { if (window.AndroidBridge && window.AndroidBridge.dbClear) window.AndroidBridge.dbClear(); } catch (e) {}
    this.s = this.freshState(); this.saveNow();
  },
  replaceState(next) { this.s = next; this.migrate(); this.saveNow(); },

  uid(prefix) { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  /* ---------- 账本 ---------- */
  book() { return this.s.books.find(b => b.id === this.s.currentBookId) || this.s.books[0]; },
  bookRecords() { return this.s.records.filter(r => r.bookId === this.book().id); },
  addBook(name) { const b = { id: this.uid("b"), name }; this.s.books.push(b); this.save(); return b; },
  renameBook(id, name) { const b = this.s.books.find(x => x.id === id); if (b) { b.name = name; this.save(); } },
  deleteBook(id) {
    if (this.s.books.length <= 1) return false;
    this.s.records = this.s.records.filter(r => r.bookId !== id);
    this.s.books = this.s.books.filter(b => b.id !== id);
    if (this.s.currentBookId === id) this.s.currentBookId = this.s.books[0].id;
    this.save(); return true;
  },

  /* ---------- 分类 ---------- */
  categories(type) { return this.s.categories.filter(c => !type || c.type === type).sort((a, b) => a.order - b.order); },
  category(id) { return this.s.categories.find(c => c.id === id) || null; },
  addCategory(type, name, icon, color) {
    const order = Math.max(...this.s.categories.filter(c => c.type === type).map(c => c.order), -1) + 1;
    const c = { id: this.uid(type === "expense" ? "ce" : "ci"), type, name, icon, color, order, custom: true };
    this.s.categories.push(c); this.save(); return c;
  },
  updateCategory(id, patch) { const c = this.category(id); if (c) { Object.assign(c, patch); this.save(); } },
  deleteCategory(id) {
    const used = this.s.records.some(r => r.categoryId === id);
    if (used) return false;
    this.s.categories = this.s.categories.filter(c => c.id !== id);
    this.save(); return true;
  },

  /* ---------- 账户 ---------- */
  account(id) { return this.s.accounts.find(a => a.id === id) || null; },
  accountTypeMeta(t) { return DATA.accountTypes.find(x => x.type === t) || DATA.accountTypes[0]; },
  addAccount(a) {
    const acc = Object.assign({
      id: this.uid("a"), type: "cash", name: "", icon: "💰", color: "#F59E0B",
      initial: 0, creditLimit: 0, billDay: 0, repayDay: 0, note: "", createdAt: Date.now()
    }, a);
    this.s.accounts.push(acc); this.save(); return acc;
  },
  updateAccount(id, patch) { const a = this.account(id); if (a) { Object.assign(a, patch); this.save(); } },
  deleteAccount(id) {
    this.s.records = this.s.records.filter(r => r.accountId !== id && r.toAccountId !== id);
    this.s.accounts = this.s.accounts.filter(a => a.id !== id);
    this.save();
  },
  /* 账户余额 = 期初 + 收入 − 支出 − 转出 + 转入；信用卡为负表示欠款 */
  accountBalance(id) {
    let b = (this.account(id)?.initial || 0);
    for (const r of this.s.records) {
      if (r.type === "income" && r.accountId === id) b += r.amount;
      else if (r.type === "expense" && r.accountId === id) b -= r.amount;
      else if (r.type === "transfer") {
        if (r.accountId === id) b -= r.amount;
        if (r.toAccountId === id) b += r.amount;
      }
    }
    return Math.round(b * 100) / 100;
  },
  walletSummary() {
    let asset = 0, debt = 0;
    for (const a of this.s.accounts) {
      const b = this.accountBalance(a.id);
      if (a.type === "debt") { if (b > 0) debt += b; else asset += -b; }
      else if (b >= 0) asset += b; else debt += -b;
    }
    return { asset: Math.round(asset * 100) / 100, debt: Math.round(debt * 100) / 100, net: Math.round((asset - debt) * 100) / 100 };
  },

  /* ---------- 标签（RecordTagDetailsAtivity 证据：可复用、多选） ---------- */
  tags() { return this.s.settings.tags || []; },
  addTag(name) {
    if (!this.s.settings.tags) this.s.settings.tags = [];
    if (this.s.settings.tags.includes(name)) return false;
    this.s.settings.tags.push(name); this.save(); return true;
  },
  deleteTag(name) {
    let used = 0;
    for (const r of this.s.records) {
      if (r.tags && r.tags.includes(name)) { r.tags = r.tags.filter(t => t !== name); used++; }
    }
    this.s.settings.tags = this.s.settings.tags.filter(t => t !== name);
    this.save(); return used;
  },
  tagUsage(name) { return this.s.records.filter(r => (r.tags || []).includes(name)).length; },

  /* ---------- 记录 ---------- */
  addRecord(r) {
    const rec = Object.assign({
      id: this.uid("r"), bookId: this.book().id, type: "expense", amount: 0,
      categoryId: "", accountId: "", toAccountId: "", date: "", note: "", member: "我",
      tags: [], photos: [], createdAt: Date.now(), updatedAt: Date.now()
    }, r);
    if (!rec.tags) rec.tags = [];
    if (!rec.photos) rec.photos = [];
    this.s.records.push(rec); this.save(); return rec;
  },
  updateRecord(id, patch) {
    const r = this.s.records.find(x => x.id === id);
    if (r) { Object.assign(r, patch, { updatedAt: Date.now() }); this.save(); }
  },
  deleteRecord(id) { this.s.records = this.s.records.filter(r => r.id !== id); this.save(); },
  recordsOf(bookId) { return this.s.records.filter(r => !bookId || r.bookId === bookId); },

  /* 月份相关计算 */
  monthRecords(month) { // month: "2026-10"
    const bid = this.book().id;
    return this.s.records.filter(r => r.bookId === bid && r.date.slice(0, 7) === month);
  },
  /* 报表区间查询：任意 [start, end] 日期区间（含端点），start/end 为 "YYYY-MM-DD" */
  rangeRecords(start, end) {
    const bid = this.book().id;
    return this.s.records.filter(r => {
      if (r.bookId !== bid) return false;
      const d = r.date.slice(0, 10);
      return d >= start && d <= end;
    });
  },
  rangeSummary(start, end) {
    let in_ = 0, out = 0;
    for (const r of this.rangeRecords(start, end)) {
      if (r.type === "income") in_ += r.amount;
      else if (r.type === "expense") out += r.amount;
    }
    return { in: Math.round(in_ * 100) / 100, out: Math.round(out * 100) / 100, balance: Math.round((in_ - out) * 100) / 100 };
  },
  rangeByCategory(start, end, type) {
    const map = new Map();
    for (const r of this.rangeRecords(start, end)) {
      if (r.type !== type) continue;
      const c = this.category(r.categoryId) || { name: "未分类", icon: "❓", color: "#94A3B8" };
      if (!map.has(c.id)) map.set(c.id, { cat: c, amount: 0, count: 0 });
      const e = map.get(c.id); e.amount += r.amount; e.count++;
    }
    return [...map.values()].map(e => ({ ...e, amount: Math.round(e.amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  },
  monthSummary(month) {
    let in_ = 0, out = 0;
    for (const r of this.monthRecords(month)) {
      if (r.type === "income") in_ += r.amount;
      else if (r.type === "expense") out += r.amount;
    }
    return { in: Math.round(in_ * 100) / 100, out: Math.round(out * 100) / 100, balance: Math.round((in_ - out) * 100) / 100 };
  },
  byCategory(month, type) {
    const map = new Map();
    for (const r of this.monthRecords(month)) {
      if (r.type !== type) continue;
      const c = this.category(r.categoryId) || { name: "未分类", icon: "❓", color: "#94A3B8" };
      if (!map.has(c.id)) map.set(c.id, { cat: c, amount: 0, count: 0 });
      const e = map.get(c.id); e.amount += r.amount; e.count++;
    }
    return [...map.values()].map(e => ({ ...e, amount: Math.round(e.amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  },
  trend(months) { // 最近 N 个月收支
    const out = [];
    const base = new Date(); 
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const sum = this.monthSummary(m);
      out.push({ month: m, label: (d.getMonth() + 1) + "月", in: sum.in, out: sum.out });
    }
    return out;
  },
  dayGroups(month, filterAccountId) {
    const groups = new Map();
    for (const r of this.monthRecords(month)) {
      if (filterAccountId) {
        const hit = r.accountId === filterAccountId || r.toAccountId === filterAccountId;
        if (!hit) continue;
      }
      const d = r.date.slice(0, 10);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(r);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => {
      let in_ = 0, out = 0;
      for (const r of items) { if (r.type === "income") in_ += r.amount; else if (r.type === "expense") out += r.amount; }
      return { date, items: items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), in: in_, out };
    });
  },
  monthDaysWithRecords(month) {
    const set = new Set(this.monthRecords(month).map(r => r.date.slice(0, 10)));
    return set.size;
  },
  searchRecords(q, bookOnly) {
    q = String(q || "").trim().toLowerCase();
    if (!q) return [];
    const list = bookOnly ? this.bookRecords() : this.s.records;
    return list.filter(r => {
      const c = this.category(r.categoryId);
      const acc = this.account(r.accountId), acc2 = this.account(r.toAccountId);
      const hay = [r.note, c && c.name, acc && acc.name, acc2 && acc2.name, r.member, (r.tags || []).join(" "), String(r.amount), r.date].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  },
  /* 记账天数（TheNumberOfTallyDayActivity 证据） */
  tallyDays() {
    const set = new Set(this.s.records.map(r => r.date.slice(0, 10)));
    set.add(new Date().toISOString().slice(0, 10));
    const days = [...set];
    const first = days.sort()[0];
    return Math.max(1, Math.floor((Date.now() - new Date(first + "T00:00:00").getTime()) / 86400000) + 1);
  },

  /* ---------- 预算（BudgetActivity_v3 证据：总预算 + 分类预算） ---------- */
  budget(month) {
    return this.s.budgets[month] || { total: 0, perCategory: {} };
  },
  setBudget(month, b) { this.s.budgets[month] = b; this.save(); },
  budgetSpent(month) { return this.monthSummary(month).out; },
  categoryBudgetSpent(month, catId) {
    let sum = 0;
    for (const r of this.monthRecords(month)) if (r.type === "expense" && r.categoryId === catId) sum += r.amount;
    return Math.round(sum * 100) / 100;
  },

  /* 周期记账功能已移除（cycles 数据字段保留以兼容旧备份文件的导入导出） */

  /* ---------- 导入 / 导出 ---------- */
  exportJSON() { return JSON.stringify(this.s, null, 2); },
  exportCSV() {
    const head = ["日期", "类型", "分类", "金额", "账户", "转入账户", "备注", "成员", "标签", "账本"];
    const rows = this.bookRecords().slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => {
      const c = this.category(r.categoryId), a1 = this.account(r.accountId), a2 = this.account(r.toAccountId);
      const book = this.s.books.find(b => b.id === r.bookId);
      return [
        r.date, r.type === "expense" ? "支出" : r.type === "income" ? "收入" : "转账",
        c ? c.name : (r.type === "transfer" ? "转账" : ""),
        r.amount.toFixed(2), a1 ? a1.name : "", a2 ? a2.name : "",
        (r.note || "").replace(/[\r\n,]/g, " "), r.member || "", (r.tags || []).join("|"), book ? book.name : ""
      ];
    });
    return "\uFEFF" + [head, ...rows].map(r => r.join(",")).join("\n");
  },

  /* ---------- 口袋记账格式 CSV 导入 ----------
   * 格式依据：口袋记账 v4.5.0 导出 Excel/CSV（表头：时间 / 账目分类 / 金额 / ...）
   * 金额：正数=收入，负数=支出；“余额变更”行跳过。
   * 也兼容本应用导出的 CSV（日期/类型/分类/金额/...）
   * 模式：append 合并（跳过 重复行）或 replace 覆盖当前账本账单
   */
  /* 从工作表二维数组解析（xlsx/csv 统一入口） */
  rowsFromSheet(aoa) {
    if (!aoa || !aoa.length) throw new Error("空文件");
    // 定位表头行（允许前面有说明行，如微信/支付宝/口袋导出都可能有）
    let headIdx = -1, head = [];
    for (let i = 0; i < Math.min(aoa.length, 30); i++) {
      const cells = (aoa[i] || []).map(v => String(v == null ? "" : v).trim());
      if (cells.includes("时间") && cells.includes("金额") || cells.includes("日期") && cells.includes("金额")) { headIdx = i; head = cells; break; }
    }
    if (headIdx < 0) throw new Error("未找到表头（需含 时间/日期 + 金额 列）");
    const col = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
    return { headIdx, head, col };
  },

  /* 统一导入入口：rows 为二维数组（CSV 行或 XLSX 工作表），mode: preview/append/replace */
  importRows(rows, mode) {
    const lines = rows.filter(r => (r || []).some(v => String(v == null ? "" : v).trim()));
    const parseLine = r => (r || []).map(v => String(v == null ? "" : v));
    // 定位表头行（允许前面有说明行，如微信/支付宝/口袋导出都可能有）
    let headIdx = -1, head = [];
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const cells = parseLine(lines[i]).map(s => s.trim());
      if (cells.includes("时间") && cells.includes("金额") || cells.includes("日期") && cells.includes("金额")) { headIdx = i; head = cells; break; }
    }
    if (headIdx < 0) throw new Error("未找到表头（需含 时间/日期 + 金额 列）");
    const col = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
    const cTime = col(["时间", "日期"]), cAmt = col(["金额"]),
          cCat = col(["账目分类", "分类"]), cType = col(["类型"]), cNote = col(["备注"]),
          cAcc = col(["账户"]), cMem = col(["成员"]), cBook = col(["账本"]), cTags = col(["标签"]);
    if (cTime < 0 || cAmt < 0) throw new Error("表头缺少 时间/金额 列");

    // 导入分类名 → 图标键/分类名映射（覆盖口袋记账导出高频分类）
    const kdjzMap = { "淘宝": "taobao", "衣服鞋包": "fushi", "水果": "shuiguolingshi", "零食": "shuiguolingshi",
      "话费": "shoujitongxun", "一般": "yiban", "报销": "baoxiaozhang", "生活用品": "jujia", "房租": "jujia",
      "买菜": "maicai", "药品": "yaopin", "护肤彩妆": "hufu", "数码产品": "shuma", "理发": "lifa",
      "聚会": "juhui", "旅游": "lvyou", "礼物": "liwu", "家装": "jiazhuang", "股票": "gupiao",
      "酒水饮料": "yanjiuyinliao", "美容健身": "meirongjianshen", "人情送礼": "renqingsongli" };
    const matchCat = (name, type) => {
      if (!name) return "";
      const key = kdjzMap[name];
      if (key) { const c = this.s.categories.find(c => c.id === (type === "income" ? "ci_" : "ce_") + key); if (c) return c.id; }
      let c = this.s.categories.find(c => c.name === name && c.type === type);
      if (!c) {
        // 导入的新分类自动创建（带对应线性图标，无映射用通用图标）
        c = this.addCategory(type, name, "svg:" + (key || "qita"), DATA.colorChoices[this.s.categories.length % DATA.colorChoices.length]);
      }
      return c.id;
    };
    const matchAcc = name => name ? (this.s.accounts.find(a => a.name === name) || {}).id || "" : "";
    const matchBook = name => name ? (this.s.books.find(b => b.name === name) || {}).id || this.book().id : this.book().id;
    // XLSX 单元格日期可能是 Date 对象或 Excel 序列数
    const cellText = v => {
      if (v == null) return "";
      if (typeof window !== "undefined" && window.XLSX && typeof v === "number" && v > 20000 && v < 60000) {
        const d = window.XLSX.SSF.parse_date_code(v);
        if (d) return d.y + "-" + String(d.m).padStart(2, "0") + "-" + String(d.d).padStart(2, "0") + " " + String(d.H).padStart(2, "0") + ":" + String(d.M).padStart(2, "0");
      }
      if (v instanceof Date) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0") + " " + String(v.getHours()).padStart(2, "0") + ":" + String(v.getMinutes()).padStart(2, "0");
      return String(v).trim();
    };

    if (mode === "preview") {
      let expense = 0, income = 0, balanceRows = 0, total = 0;
      for (let i = headIdx + 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        if (!cells.length) continue;
        const cat0 = cCat >= 0 ? cellText(cells[cCat]) : "";
        if (cat0 === "余额变更") { balanceRows++; continue; }
        const time = cellText(cells[cTime]);
        const amt = parseFloat(String(cells[cAmt]).replace(/[¥￥,\s]/g, ""));
        if (!time || isNaN(amt) || amt === 0) continue;
        const t2 = cType >= 0 && cells[cType] ? (String(cells[cType]).includes("收") ? "income" : String(cells[cType]).includes("转") ? "transfer" : "expense") : (amt > 0 ? "income" : "expense");
        if (t2 === "transfer") continue;
        total++; if (t2 === "income") income++; else expense++;
      }
      return { total, expense, income, balanceRows };
    }

    if (mode === "replace") this.s.records = this.s.records.filter(r => r.bookId !== this.book().id);
    // 去重键：日期归一化（/→-，去秒）+ 类型 + 金额绝对值 + 备注
    const normDate = d => String(d || "").replace(/\//g, "-").slice(0, 16);
    const existKeys = new Set(this.s.records.map(r => normDate(r.date) + "|" + r.type + "|" + (+r.amount).toFixed(2) + "|" + (r.note || "")));
    let added = 0, skipped = 0;
    for (let i = headIdx + 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      if (!cells.length) continue;
      const cat0 = cCat >= 0 ? cellText(cells[cCat]) : "";
      if (cat0 === "余额变更") { skipped++; continue; }  // 口袋的余额调整行，非真实交易
      const time = cellText(cells[cTime]);
      const amt = parseFloat(String(cells[cAmt]).replace(/[¥￥,\s]/g, ""));
      if (!time || isNaN(amt) || amt === 0) { skipped++; continue; }
      const type = cType >= 0 && cells[cType] ? (String(cells[cType]).includes("收") ? "income" : String(cells[cType]).includes("转") ? "transfer" : "expense") : (amt > 0 ? "income" : "expense");
      if (type === "transfer") { skipped++; continue; } // CSV/XLSX 缺转入账户列，转账行无法完整还原
      const note = cNote >= 0 ? cellText(cells[cNote]) : "";
      const key = normDate(time) + "|" + type + "|" + Math.abs(amt).toFixed(2) + "|" + note;
      if (existKeys.has(key)) { skipped++; continue; }
      existKeys.add(key);
      this.addRecord({
        bookId: cBook >= 0 ? matchBook(cellText(cells[cBook])) : this.book().id,
        type, amount: Math.round(Math.abs(amt) * 100) / 100,
        categoryId: matchCat(cat0, type),
        accountId: cAcc >= 0 ? matchAcc(cellText(cells[cAcc])) : "",
        date: normDate(time),
        note, member: cMem >= 0 ? cellText(cells[cMem]) || "我" : "我",
        tags: cTags >= 0 ? cellText(cells[cTags]).split(/[|;]/).map(s => s.trim()).filter(Boolean) : []
      });
      added++;
    }
    this.save();
    return { added, skipped };
  },

  /* CSV 文本 → 二维数组（供 importRows） */
  csvToRows(text) {
    const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
    return lines.map(l => {
      const out = []; let cur = "", q = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (q) { if (ch === '"' && l[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur); return out;
    });
  },

  /* CSV 文本导入（兼容旧调用） */
  importKdjzCSV(text, mode) {
    return this.importRows(this.csvToRows(text), mode);
  },

  /* ---------- 演示数据 ---------- */
  seedDemo() {
    const s = this.s;
    const bid = s.currentBookId;
    const expCats = this.categories("expense"), incCats = this.categories("income");
    const cat = k => s.categories.find(c => c.id === ("ce_" + k) || c.id === ("ci_" + k));
    const accs = s.accounts;
    const now = new Date();
    const demoRange = [];
    for (let m = 2; m >= 0; m--) demoRange.push(new Date(now.getFullYear(), now.getMonth() - m, 1));
    const mk = (type, amount, ckey, aidx, d, hhmm, note, reimb) => {
      const date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + hhmm;
      const a = accs[aidx % accs.length];
      this.addRecord({ bookId: bid, type, amount: Math.round(amount * 100) / 100, categoryId: cat(ckey)?.id || expCats[0].id, accountId: a.id, date, note: note || "", member: "我", tags: (reimb || Math.random() < 0.12) ? ["报销"] : [] });
    };
    const rnd = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
    for (const mStart of demoRange) {
      const y = mStart.getFullYear(), m = mStart.getMonth();
      const dim = new Date(y, m + 1, 0).getDate();
      const dayLimit = (y === now.getFullYear() && m === now.getMonth()) ? now.getDate() : dim;
      const at = day => new Date(y, m, Math.min(day, dayLimit));
      // 工资 + 房租 + 水电
      mk("income", 12800 + rnd(-300, 800), "gongzi", 3, at(10), "10:05", "工资入账");
      mk("expense", 2600, "jujia", 3, at(1), "09:00", "房租");
      mk("expense", rnd(120, 260), "jujia", 3, at(5), "20:30", "水电燃气");
      // 转账：储蓄卡 -> 支付宝
      this.addRecord({ bookId: bid, type: "transfer", amount: 2000, accountId: accs[3].id, toAccountId: accs[1].id, date: fmt.YMD(at(8)) + " 12:00", note: "转入支付宝", member: "我" });
      // 日常消费
      const recipes = [
        ["canyin", 3, 9, 55, ["早餐豆浆油条", "午餐公司食堂", "外卖汉堡", "和朋友吃火锅", "晚饭面馆"]],
        ["shuiguolingshi", 2, 6, 40, ["水果店", "坚果零食", "奶茶"]],
        ["jiaotong", 3, 8, 60, ["地铁通勤", "打车", "加油"]],
        ["gouwu", 2, 5, 320, ["日用品", "衣服", "淘宝日用品"]],
        ["yule", 1, 3, 160, ["电影票", "游戏充值", "KTV"]],
        ["shoujitongxun", 1, 1, 1, ["话费充值"]],
        ["yanjiuyinliao", 1, 4, 48, ["咖啡", "精酿"]],
        ["meirongjianshen", 1, 2, 220, ["健身房月卡", "理发"]],
        ["yiliaojiaoyu", 0, 1, 2, [["药店买药"][0]]],
        ["renqingsongli", 0, 1, 1, ["朋友生日礼物"]],
        ["taobao", 1, 3, 180, ["手机壳", "数据线"]]
      ];
      for (const [key, minN, maxN, maxAmt, notes] of recipes) {
        const n = minN + Math.floor(Math.random() * (maxN - minN + 1));
        for (let i = 0; i < n; i++) {
          const day = 1 + Math.floor(Math.random() * dayLimit);
          const note = notes[Math.floor(Math.random() * notes.length)] || "";
          const reimb = key === "baoxiaozhang";
          mk("expense", rnd(3, maxAmt), key, Math.floor(Math.random() * 3), at(day), (8 + Math.floor(Math.random() * 13)) + ":" + (Math.random() > .5 ? "30" : "05"), note, reimb);
        }
      }
      if (Math.random() > .5) mk("income", rnd(50, 300), "hongbao", 1, at(1 + Math.floor(Math.random() * 25)), "12:00", "微信红包");
      if (m === demoRange.length - 2) mk("income", rnd(800, 2200), "jianzhiwaikuai", 3, at(18), "15:00", "设计私单");
    }
    // 预算
    const cur = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const b = this.budget(cur);
    b.total = 4500; b.perCategory = { "ce_canyin": 1200, "ce_gouwu": 800, "ce_jiaotong": 400 };
    this.setBudget(cur, b);


    this.save();
  }
};

/* 日期工具（全局） */
const fmt = {
  YMD(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); },
  now() { const d = new Date(); return this.YMD(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); },
  month(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); },
  curMonth() { return this.month(new Date()); },
  parse(s) { return new Date(s.replace(" ", "T")); },
  monthDay(ymd) {
    const d = this.parse(ymd + "T00:00:00");
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  },
  dayLabel(ymd) {
    const today = this.YMD(new Date());
    const yst = new Date(); yst.setDate(yst.getDate() - 1);
    if (ymd === today) return "今天";
    if (ymd === this.YMD(yst)) return "昨天";
    const d = this.parse(ymd + "T00:00:00");
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 周" + DATA.weeks[d.getDay()];
  },
  timeLabel(dt) { return dt.slice(11, 16); },
  money(n) {
    const neg = n < 0; n = Math.abs(n);
    const s = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + s;
  }
};

/* ============================================================
 * 我的页 + 子功能页（UserCenter 模块复刻）：
 *   多账本管理（Books）· 预算（Budget_v3 日/周/月三环 + 分类预算）
 *   分类管理（RecordtypeManager）
 *   数据导出/导入（DeriveData / DataBackUps）· 设置（主题/币种/成员）
 * ============================================================ */
"use strict";

const ViewsMine = {
  render(header, main) {
    header.classList.add("hidden");
    const s = Store.s;
    const days = Store.tallyDays();
    const total = s.records.length;
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="me-hero">' +
        '<div class="me-avatar"><img src="img/appicon.png" alt="app"></div>' +
        '<div style="flex:1"><div class="me-name">' + DATA.appName + ' · 我的账本</div>' +
          '<div style="font-size:12px;color:var(--text-3);margin-top:4px">已坚持记账 ' + days + ' 天 · 累计 ' + total + " 笔账单</div>" +
          '<div class="me-stats">' +
            stat(Store.recordsOf().length, "本账单笔") + stat(s.books.length, "账本") + stat(s.accounts.length, "账户") +
          "</div></div>" +
      "</div>" +
      '<div class="card">' +
        cell("wallet", "钱包资产管理", walletDesc(), "wallet") +
        cell("list", "账单明细", "按天分组 · 左滑编辑 · 筛选搜索", "bills") +
        cell("book", "多账本管理", "当前：" + UI.escape(Store.book().name), "books") +
        cell("budget", "预算设置", budgetDesc(), "budget") +
        cell("tag", "分类管理", "支出 " + Store.categories("expense").length + " · 收入 " + Store.categories("income").length, "categories") +
      "</div>" +
      '<div class="card">' +
        cell("export", "数据导出", "导出 CSV / JSON 备份", "export") +
        cell("import", "数据导入", "从 JSON 备份恢复", "import") +
        cell("theme", "深色模式", s.settings.theme === "deep" ? "已开启" : "已关闭", "themeToggle") +
        cell("user", "成员管理", s.settings.members.join(" / "), "members") +
        cell("lock", "应用锁", (s.settings.lock && s.settings.lock.enabled) ? "已开启" : "未开启", "applock") +
        cell("cloud", "WebDAV 云备份", webdavDesc(), "webdav") +
        cell("budget", "币种设置", "当前符号 " + s.settings.currency, "currency") +
      "</div>" +
      '<div class="card">' +
        cell("info", "关于", "版本 1.0.6", "about") +
        cell("trash", "清空数据", "删除全部账单与设置", "wipe") +
      "</div>" +
      '<div style="text-align:center;color:var(--text-3);font-size:11px;padding:6px 0 20px">小伙记账 · 功能复刻版（纯本地运行）</div></div>';

    UI.$$(".cell[data-go]", main).forEach(el => el.onclick = () => {
      const go = el.dataset.go;
      if (go === "themeToggle") {
        s.settings.theme = s.settings.theme === "deep" ? "light" : "deep";
        Store.save(); App.applyTheme(); App.refresh();
        return;
      }
      if (go === "export") { ViewsMine.exportSheet(); return; }
      if (go === "import") { ViewsMine.importSheet(); return; }
      if (go === "members") { ViewsMine.membersSheet(); return; }
      if (go === "applock") { Lock.settingsSheet(); return; }
      if (go === "webdav") { WebDAV.settingsSheet(); return; }
      if (go === "currency") { ViewsMine.currencySheet(); return; }
      if (go === "about") {
        UI.toast("小伙记账 · FirCount v1.0.6", 2500);
        return;
      }
      if (go === "wipe") { ViewsMine.wipeSheet(); return; }
      if (go === "wallet") { App.go("wallet"); return; }
      if (go === "bills") { App.go("bills"); return; }
      if (go === "books" || go === "budget" || go === "categories") App.go(go);
    });

    function stat(v, k) { return '<div class="st"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; }
    function cell(icon, title, desc, go) {
      return '<div class="cell" data-go="' + go + '"><div class="cell-icon">' + UI.svg(icon, 19) + '</div>' +
        '<div class="cell-main"><div class="cell-title">' + title + '</div><div class="cell-desc">' + desc + "</div></div>" +
        UI.svg("arrow", 15) + "</div>";
    }
    function walletDesc() {
      const w = Store.walletSummary();
      const t = w.net;
      return "净资产 " + fmt.money(Math.abs(t)) + (t < 0 ? "（负债）" : "");
    }
    function budgetDesc() {
      const b = Store.budget(fmt.curMonth());
      return b.total ? "本月总预算 " + fmt.money(b.total) + " 元" : "未设置";
    }
    function webdavDesc() {
      const c = Store.s.settings.webdav;
      if (!c || !c.user) return "坚果云 / 123网盘（仅 APK）";
      return (WebDAV.PRESETS[c.provider] || {}).name + " · " +
        (c.lastBackupAt ? "上次备份 " + new Date(c.lastBackupAt).toLocaleString("zh-CN") : "已配置未备份");
    }
  },

  /* ================= 多账本（Books 模块） ================= */
  renderBooks(header, main) {
    header.classList.remove("hidden");
    header.innerHTML =
      '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">账本管理</div>' +
      '<div class="hd-sub"><button class="txt-btn" id="bkAdd" style="color:var(--brand)">＋新建</button></div></div>';
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="card">' + Store.s.books.map(b =>
        '<div class="cell" data-id="' + b.id + '"><div class="cell-icon">' + UI.svg("book", 18) + "</div>" +
        '<div class="cell-main"><div class="cell-title">' + UI.escape(b.name) +
        (b.id === Store.s.currentBookId ? ' <span class="tags" style="font-size:10px;background:var(--brand-soft);color:var(--brand);border-radius:4px;padding:1px 5px">使用中</span>' : "") +
        "</div>" +
        '<div class="cell-desc">' + Store.recordsOf(b.id).length + " 笔账单</div></div></div>"
      ).join("") + "</div>" +
      '<div class="sec-title">长按账本可重命名 / 删除</div></div>';
    UI.$("[data-back]", header).onclick = () => App.back();
    UI.$("#bkAdd").onclick = () => ViewsMine.bookEditDialog(null, () => App.refresh());
    UI.$$(".cell[data-id]", main).forEach(el => {
      let timer;
      el.addEventListener("pointerdown", () => {
        timer = setTimeout(() => {
          timer = null;
          const b = Store.s.books.find(x => x.id === el.dataset.id);
          if (b) ViewsMine.bookEditDialog(b, () => App.refresh());
        }, 550);
      });
      const cancel = () => timer && clearTimeout(timer);
      el.addEventListener("pointerup", cancel);
      el.addEventListener("pointerleave", cancel);
      el.addEventListener("click", () => {
        if (timer === null) return; // 长按已处理
        cancel();
        Store.s.currentBookId = el.dataset.id; Store.save();
        UI.toast("已切换到「" + el.textContent.trim().replace(/使用中/, "") + "」");
        App.back();
      });
    });
  },

  bookEditDialog(book, cb) {
    const sh = UI.sheet({ title: book ? "编辑账本" : "新建账本" });
    sh.body.innerHTML = '<div class="form-row" style="border:none"><div class="lab">账本名称</div>' +
      '<input type="text" id="bkName" maxlength="12" placeholder="如：生活账本 / 装修账本" value="' + (book ? UI.escape(book.name) : "") + '"></div>';
    sh.foot.innerHTML =
      (book && Store.s.books.length > 1 ? '<button class="btn btn-danger" id="bkDel" style="margin-bottom:10px;width:100%">删除该账本及其账单</button>' : "") +
      '<button class="btn btn-primary btn-block" id="bkSave">保存</button>';
    UI.$("#bkSave", sh.foot).onclick = () => {
      const name = UI.$("#bkName", sh.body).value.trim();
      if (!name) { UI.toast("请输入名称"); return; }
      if (book) Store.renameBook(book.id, name);
      else { const b = Store.addBook(name); Store.s.currentBookId = b.id; Store.save(); }
      sh.close(); UI.toast("已保存"); cb && cb();
    };
    const del = UI.$("#bkDel", sh.foot);
    if (del) del.onclick = () => {
      UI.confirm({ title: "删除账本", body: "「" + UI.escape(book.name) + "」及其下所有账单将被删除。", ok: "删除", danger: true }).then(ok => {
        if (ok) { Store.deleteBook(book.id); sh.close(); UI.toast("账本已删除"); cb && cb(); }
      });
    };
  },

  /* ================= 预算（Budget_v3 日/周/月三环 + 分类预算） ================= */
  renderBudget(header, main) {
    header.classList.remove("hidden");
    header.innerHTML =
      '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">预算</div>' +
      '<div class="hd-sub"><button class="txt-btn" id="bgPrev">' + UI.svg("left", 14) + '</button><span id="bgMonth" style="font-weight:600"></span><button class="txt-btn" id="bgNext">' + UI.svg("right", 14) + "</button></div></div>";
    const m = App.viewMonth;
    UI.$("#bgMonth", header).textContent = m.slice(0, 4) + "年" + (+m.slice(5, 7)) + "月";
    UI.$("[data-back]", header).onclick = () => App.back();
    UI.$("#bgPrev").onclick = () => { App.shiftMonth(-1); };
    UI.$("#bgNext").onclick = () => { App.shiftMonth(1); };

    const b = Store.budget(m);
    const spent = Store.budgetSpent(m);
    const cur = Store.s.settings.currency;
    const now = new Date();
    const dim = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
    const isCurMonth = m === fmt.curMonth();
    const daysLeft = isCurMonth ? dim - now.getDate() + 1 : 0;
    const todayStr = fmt.YMD(now);

    /* 周预算：本周（周一起）支出 vs 月总预算 / 当月周数 */
    const weekSpent = Store.monthRecords(m).filter(r => r.type === "expense" && r.date.slice(0, 10) <= todayStr && withinThisWeek(r.date.slice(0, 10))).reduce((s, r) => s + r.amount, 0);
    function withinThisWeek(dstr) {
      const d = fmt.parse(dstr + "T00:00:00");
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
      return d >= monday && d < sunday;
    }
    const todaySpent = Store.monthRecords(m).filter(r => r.type === "expense" && r.date.slice(0, 10) === todayStr).reduce((s, r) => s + r.amount, 0);

    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="card"><div class="budget-rings">' +
        ring("bgRingM", spent, b.total, "月预算", isCurMonth && b.total ? "剩 " + fmt.money(Math.max(0, b.total - spent)) + " · " + daysLeft + " 天" : "月度总支出") +
        ring("bgRingW", weekSpent, b.total ? b.total / (dim / 7) : 0, "周预算", "本周支出") +
        ring("bgRingD", todaySpent, isCurMonth && b.total && daysLeft ? Math.max(0, b.total - spent) / daysLeft : 0, "日预算", "今日支出") +
      "</div>" +
      '<div style="text-align:center;padding:0 14px 14px;font-size:12px;color:var(--text-3)">' +
        (b.total ? "本月已用 <b style='color:var(--expense)'>" + cur + fmt.money(spent) + "</b> / " + cur + fmt.money(b.total) + (isCurMonth ? " · 日均可用 " + cur + fmt.money(Math.max(0, (b.total - spent) / daysLeft)) : "") : "还未设置预算，去下方设置吧") +
      "</div></div>" +
      '<div class="card"><div class="budget-set-row"><div class="lab">月总预算</div>' +
        '<input type="number" id="bgTotal" step="1" min="0" value="' + (b.total || "") + '" placeholder="0">' +
        '<button class="btn btn-primary" id="bgSaveTotal" style="padding:8px 18px">保存</button></div></div>' +
      '<div class="card" style="padding:6px 0 10px"><div class="sec-title" style="padding:8px 14px 4px">分类预算' +
        '<button class="txt-btn" id="bgAddCat" style="color:var(--brand);font-size:13px">＋设置分类预算</button></div>' +
        '<div id="bgCatList"></div></div></div>';

    function ring(id, used, budget, title, sub) {
      const pct = budget > 0 ? used / budget : 0;
      return '<div class="budget-ring"><canvas id="' + id + '" width="92" height="92" data-h="92"></canvas>' +
        '<div class="t">' + title + "</div><div class='sub'>" + sub + "</div></div>";
    }
    const paint = () => {
      const b2 = Store.budget(m), spent2 = Store.budgetSpent(m);
      Charts.ring(UI.$("#bgRingM"), b2.total ? spent2 / b2.total : 0, b2.total ? Math.round(spent2 / b2.total * 100) + "%" : "—", "月", spent2 > b2.total && b2.total > 0);
      const wkB = b2.total ? b2.total / (dim / 7) : 0;
      Charts.ring(UI.$("#bgRingW"), wkB ? Math.min(weekSpent / wkB, 1.5) : 0, wkB ? Math.round(weekSpent / wkB * 100) + "%" : "—", "周", weekSpent > wkB && wkB > 0);
      const dayB = isCurMonth && b2.total && daysLeft ? Math.max(0, b2.total - spent2) / daysLeft : 0;
      Charts.ring(UI.$("#bgRingD"), dayB ? Math.min(todaySpent / dayB, 1.5) : 0, dayB ? Math.round(todaySpent / dayB * 100) + "%" : "—", "日", todaySpent > dayB && dayB > 0);
    };
    paint();

    UI.$("#bgSaveTotal").onclick = () => {
      const v = parseFloat(UI.$("#bgTotal").value) || 0;
      const b2 = Store.budget(m);
      b2.total = v; Store.setBudget(m, b2);
      UI.toast("预算已保存"); App.refresh();
    };
    UI.$("#bgAddCat").onclick = () => ViewsMine.budgetCatPicker(m, () => App.refresh());
    this.renderBudgetCatList(m);
  },

  renderBudgetCatList(m) {
    const host = UI.$("#bgCatList");
    const b = Store.budget(m);
    const ids = Object.keys(b.perCategory || {}).filter(id => b.perCategory[id] > 0);
    if (!ids.length) { host.innerHTML = '<div style="text-align:center;color:var(--text-3);font-size:13px;padding:12px 0">暂无分类预算</div>'; return; }
    host.innerHTML = ids.map(id => {
      const c = Store.category(id);
      if (!c) return "";
      const budget = b.perCategory[id];
      const spent = Store.categoryBudgetSpent(m, id);
      const pct = Math.min(100, spent / budget * 100);
      const over = spent > budget;
      return '<div style="padding:8px 14px">' +
        '<div style="display:flex;align-items:center;gap:8px">' + UI.catIcon(c, "bi-icon") +
        '<span style="flex:1;font-size:14px">' + UI.escape(c.name) + "</span>" +
        (over ? '<span class="badge-over">超支</span>' : "") +
        '<span style="font-size:13px;font-variant-numeric:tabular-nums"><b class="' + (over ? "money-out" : "") + '">' + fmt.money(spent) + "</b><span style='color:var(--text-3)'> / " + fmt.money(budget) + "</span></span>" +
        '<button class="txt-btn" data-del="' + id + '" style="color:var(--text-3);font-size:12px">✕</button></div>' +
        '<div class="mini-progress"><i class="' + (over ? "over" : "") + '" style="width:' + pct + '%"></i></div></div>';
    }).join("");
    host.querySelectorAll("[data-del]").forEach(el => el.onclick = () => {
      const b2 = Store.budget(m);
      delete b2.perCategory[el.dataset.del];
      Store.setBudget(m, b2);
      App.refresh();
    });
  },

  budgetCatPicker(month, cb) {
    const sh = UI.sheet({ title: "设置分类预算" });
    const b = Store.budget(month);
    sh.body.innerHTML = Store.categories("expense").map(c =>
      '<div class="cell" data-id="' + c.id + '">' + UI.catIcon(c, "cell-icon") +
      '<div class="cell-main"><div class="cell-title">' + UI.escape(c.name) + "</div>" +
      '<div class="cell-desc">本月已支出 ' + fmt.money(Store.categoryBudgetSpent(month, c.id)) + "</div></div>" +
      '<span style="font-size:13px;color:var(--brand)">' + (b.perCategory[c.id] ? fmt.money(b.perCategory[c.id]) : "设置") + "</span></div>"
    ).join("");
    UI.$$(".cell", sh.body).forEach(el => el.onclick = () => {
      const c = Store.category(el.dataset.id);
      const sh2 = UI.sheet({ title: c.name + " · 月预算" });
      sh2.body.innerHTML = '<div class="form-row" style="border:none"><div class="lab">金额</div>' +
        '<input type="number" id="bgcVal" step="1" min="0" value="' + (b.perCategory[c.id] || "") + '" placeholder="0"></div>';
      sh2.foot.innerHTML = '<button class="btn btn-primary btn-block" id="bgcSave">保存</button>';
      UI.$("#bgcSave", sh2.foot).onclick = () => {
        const v = parseFloat(UI.$("#bgcVal", sh2.body).value) || 0;
        const b2 = Store.budget(month);
        if (v > 0) b2.perCategory[c.id] = v; else delete b2.perCategory[c.id];
        Store.setBudget(month, b2);
        sh2.close(); sh.close(); UI.toast("已保存"); cb && cb();
      };
    });
  },

  /* ================= 分类管理（RecordtypeManagerActivity） ================= */
  renderCategories(header, main) {
    header.classList.remove("hidden");
    header.innerHTML =
      '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">分类管理</div>' +
      '<div class="hd-sub"><button class="txt-btn" id="ctAdd" style="color:var(--brand)">＋添加</button></div></div>';
    const renderList = () => {
      const mk = (type, title) =>
        '<div class="sec-title">' + title + " · " + Store.categories(type).length + "</div>" +
        '<div class="card">' + Store.categories(type).map(c =>
          '<div class="cell" data-id="' + c.id + '">' + UI.catIcon(c, "cell-icon") +
          '<div class="cell-main"><div class="cell-title">' + UI.escape(c.name) + "</div>" +
          '<div class="cell-desc">' + Store.s.records.filter(r => r.categoryId === c.id).length + " 笔</div></div>" +
          (c.custom ? '<span class="tags" style="font-size:10px;background:var(--brand-soft);color:var(--brand);border-radius:4px;padding:1px 5px">自定义</span>' : "") +
          UI.svg("arrow", 14) + "</div>"
        ).join("") + "</div>";
      main.innerHTML = '<div class="page page-anim">' + mk("expense", "支出分类") + mk("income", "收入分类") + "</div>";
      UI.$$(".cell[data-id]", main).forEach(el => el.onclick = () => {
        const c = Store.category(el.dataset.id);
        ViewsAdd.categoryEditor(c, () => renderList());
      });
    };
    renderList();
    UI.$("[data-back]", header).onclick = () => App.back();
    UI.$("#ctAdd").onclick = () => ViewsAdd.categoryEditor(null, () => renderList());
  },

  /* ================= 导出 / 导入 / 成员 / 币种 ================= */
  /* 清空数据：随机 6 位确认码（大小写字母+数字+符号都要有），输入正确才可删除 */
  wipeSheet() {
    const sh = UI.sheet({ title: "清空所有数据" });
    // 生成确认码：保证同时含大写、小写、数字、符号
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnpqrstuvwxyz", digit = "23456789", symbol = "!@#%&*+=?";
    const all = upper + lower + digit + symbol;
    const pick = set => set[Math.floor(Math.random() * set.length)];
    const code = [pick(upper), pick(lower), pick(digit), pick(symbol)];
    while (code.length < 6) code.push(pick(all));
    // 洗牌
    for (let i = code.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [code[i], code[j]] = [code[j], code[i]]; }
    const confirmCode = code.join("");
    const recCount = Store.s.records.length;
    sh.body.innerHTML =
      '<div style="font-size:13.5px;color:var(--text-2);line-height:1.7;padding:4px 2px 10px">将删除<b style="color:var(--danger)">仅本地存储</b>的全部数据：' +
      recCount + " 笔账单、" + Store.s.books.length + " 本账本、" + Store.s.accounts.length + " 个账户、预算与设置。<br>云端备份不受影响；建议先导出备份。" +
      '</div>' +
      '<div style="text-align:center;margin:6px 0 14px"><span id="wipeCode" style="font-family:monospace;font-size:24px;letter-spacing:4px;font-weight:700;color:var(--danger);background:var(--chip);padding:8px 18px;border-radius:10px;user-select:none">' + confirmCode + "</span></div>" +
      '<div class="form-row" style="border-bottom:none"><input type="text" id="wipeInput" maxlength="6" placeholder="输入上方 6 位确认码" style="text-align:center;letter-spacing:2px;font-family:monospace;font-size:16px"></div>';
    sh.foot.innerHTML =
      '<button class="btn btn-ghost" style="flex:1" id="wipeRegen">换一个</button>' +
      '<button class="btn btn-danger" style="flex:2" id="wipeGo" disabled>确认清空</button>';
    let cur = confirmCode;
    const regen = () => {
      const c2 = [pick(upper), pick(lower), pick(digit), pick(symbol)];
      while (c2.length < 6) c2.push(pick(all));
      for (let i = c2.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c2[i], c2[j]] = [c2[j], c2[i]]; }
      cur = c2.join("");
      UI.$("#wipeCode", sh.body).textContent = cur;
      const inp = UI.$("#wipeInput", sh.body); inp.value = ""; check();
    };
    const check = () => { UI.$("#wipeGo", sh.foot).disabled = UI.$("#wipeInput", sh.body).value !== cur; };
    UI.$("#wipeInput", sh.body).oninput = check;
    UI.$("#wipeRegen", sh.foot).onclick = regen;
    UI.$("#wipeGo", sh.foot).onclick = () => {
      if (UI.$("#wipeInput", sh.body).value !== cur) { UI.toast("确认码不正确"); return; }
      sh.close();
      Store.reset(); App.applyTheme(); App.viewMonth = fmt.curMonth(); App.go("report", null, true);
      UI.toast("本地数据已清空");
    };
  },

  exportSheet() {
    const sh = UI.sheet({ title: "数据导出" });
    sh.body.innerHTML =
      '<div class="cell" data-k="csv"><div class="cell-icon">' + UI.svg("export", 18) + '</div>' +
      '<div class="cell-main"><div class="cell-title">导出 CSV（当前账本）</div><div class="cell-desc">含日期/分类/金额/账户/备注，可用 Excel 打开</div></div></div>' +
      '<div class="cell" data-k="json"><div class="cell-icon">' + UI.svg("export", 18) + '</div>' +
      '<div class="cell-main"><div class="cell-title">导出 JSON 完整备份</div><div class="cell-desc">全部账本 / 账户 / 预算 / 设置</div></div></div>';
    UI.$$(".cell", sh.body).forEach(el => el.onclick = () => {
      const k = el.dataset.k;
      const content = k === "csv" ? Store.exportCSV() : Store.exportJSON();
      const mime = k === "csv" ? "text/csv;charset=utf-8" : "application/json";
      const name = "小伙记账备份_" + fmt.YMD(new Date()) + "." + k;
      if (window.AndroidBridge && window.AndroidBridge.saveFile) {
        // Android APK 环境：经原生桥保存到系统「下载」目录
        window.AndroidBridge.saveFile(name, mime, content);
        sh.close(); UI.toast("已保存到下载目录");
      } else {
        const blob = new Blob([content], { type: mime });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
        sh.close(); UI.toast("已开始下载");
      }
    });
  },

  importSheet() {
    const sh = UI.sheet({ title: "数据导入" });
    sh.body.innerHTML =
      '<div style="font-size:13.5px;color:var(--text-2);line-height:1.7;padding:6px 2px 12px">支持 XLSX/CSV（口袋记账导出格式：时间/账目分类/金额）与 JSON 完整备份。</div>' +
      '<input type="file" id="impFile" accept=".json,.csv,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none">' +
      '<div class="cell" id="impSheet"><div class="cell-icon">📊</div><div class="cell-main"><div class="cell-title">导入 XLSX / CSV（口袋记账格式）</div><div class="cell-desc">自动识别表头，可合并或覆盖</div></div>' + UI.svg("arrow", 15) + "</div>" +
      '<div class="cell" id="impJson"><div class="cell-icon">🗂️</div><div class="cell-main"><div class="cell-title">导入 JSON 完整备份</div><div class="cell-desc">将覆盖当前全部数据</div></div>' + UI.svg("arrow", 15) + "</div>";
    let pick = null;
    UI.$("#impSheet", sh.body).onclick = () => { pick = "sheet"; UI.$("#impFile", sh.body).click(); };
    UI.$("#impJson", sh.body).onclick = () => { pick = "json"; UI.$("#impFile", sh.body).click(); };
    UI.$("#impFile", sh.body).onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const name = (f.name || "").toLowerCase();
      const rd = new FileReader();
      if (pick === "json") {
        rd.onload = () => {
          try {
            const obj = JSON.parse(rd.result);
            if (!obj.books || !obj.records) throw new Error("bad");
            UI.confirm({ title: "确认导入", body: "将覆盖当前 " + Store.s.records.length + " 笔账单，替换为备份中的 " + obj.records.length + " 笔。", ok: "覆盖导入", danger: true }).then(ok => {
              if (!ok) return;
              Store.replaceState(obj);
              sh.close(); UI.toast("导入成功");
              App.applyTheme(); App.viewMonth = fmt.curMonth(); App.refresh();
            });
          } catch (err) { UI.toast("文件格式不正确"); }
        };
        rd.readAsText(f, "utf-8");
        return;
      }
      // XLSX / CSV 表格导入：统一读 ArrayBuffer，按 ZIP 魔数（PK）判断格式
      // （安卓文件选择器返回的文件名常不带扩展名，不能靠 name 判断）
      rd.onload = () => {
        let rows;
        try {
          const buf = rd.result instanceof ArrayBuffer ? rd.result : null;
          const u8 = buf ? new Uint8Array(buf) : null;
          const isZip = u8 && u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4B; // PK\x03\x04 = xlsx
          if (isZip) {
            if (typeof XLSX === "undefined") { UI.toast("XLSX 解析库未加载"); return; }
            const wb = XLSX.read(u8, { type: "array", cellDates: false });
            // 多表时选行数最多的工作表（口袋导出含收支记录/借入借出/固收理财等多表）
            let bestName = wb.SheetNames[0], bestLen = -1;
            for (const sn of wb.SheetNames) {
              const r = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
              if (r.length > bestLen) { bestLen = r.length; bestName = sn; }
            }
            rows = XLSX.utils.sheet_to_json(wb.Sheets[bestName], { header: 1, raw: true, defval: "" });
          } else {
            const text = new TextDecoder("utf-8").decode(u8 || rd.result);
            rows = Store.csvToRows(text);
          }
        } catch (err) { UI.toast("解析失败[" + name + "/" + (u8 ? u8.length : "txt") + "B]: " + (err.message || err), 5000); return; }
        let parsed;
        try { parsed = Store.importRows(rows, "preview"); }
        catch (err) {
          // 诊断信息：文件名/大小/首行内容，便于远程定位
          const first = JSON.stringify((rows[0] || []).slice(0, 5));
          UI.toast("表头未识别[" + name + " " + (u8 ? u8.length + "B" : "") + "] 首行:" + first.slice(0, 60), 6000);
          return;
        }
        sh.close();
        const sh2 = UI.sheet({ title: "导入预览" });
        sh2.body.innerHTML =
          '<div style="font-size:13.5px;color:var(--text-2);line-height:1.8;padding:6px 2px">' +
          '表头识别成功，共 <b>' + parsed.total + '</b> 行有效数据<br>' +
          '预计新增 <b style="color:var(--primary)">' + parsed.expense + '</b> 笔支出、<b style="color:var(--income)">' + parsed.income + '</b> 笔收入' +
          (parsed.balanceRows ? '<br>跳过余额变更行 ' + parsed.balanceRows + ' 条' : "") + '</div>' +
          '<div class="cell" id="csvAppend"><div class="cell-main"><div class="cell-title">合并导入</div><div class="cell-desc">自动跳过与现有重复的账单</div></div>' + UI.svg("arrow", 15) + "</div>" +
          '<div class="cell" id="csvReplace"><div class="cell-main"><div class="cell-title" style="color:var(--danger)">覆盖当前账本</div><div class="cell-desc">删除当前账本全部账单后导入</div></div>' + UI.svg("arrow", 15) + "</div>";
        UI.$("#csvAppend", sh2.body).onclick = () => {
          const r = Store.importRows(rows, "append");
          sh2.close(); UI.toast("导入完成：新增 " + r.added + " 笔，跳过 " + r.skipped + " 条");
          App.viewMonth = fmt.curMonth(); App.refresh();
        };
        UI.$("#csvReplace", sh2.body).onclick = () => {
          UI.confirm({ title: "覆盖导入", body: "将删除当前账本全部账单（" + Store.bookRecords().length + " 笔）后导入表格数据，且无法恢复。", ok: "覆盖", danger: true }).then(ok => {
            if (!ok) return;
            const r = Store.importRows(rows, "replace");
            sh2.close(); UI.toast("导入完成：新增 " + r.added + " 笔");
            App.viewMonth = fmt.curMonth(); App.refresh();
          });
        };
      };
      rd.readAsArrayBuffer(f);
    };
  },

  membersSheet() {
    const sh = UI.sheet({ title: "成员管理（家庭多人记账）" });
    const render = () => {
      sh.body.innerHTML = Store.s.settings.members.map(m =>
        '<div class="cell"><div class="cell-icon">👤</div><div class="cell-main"><div class="cell-title">' + UI.escape(m) + "</div></div>" +
        (Store.s.settings.members.length > 1 ? '<button class="txt-btn" data-del="' + UI.escape(m) + '" style="color:var(--danger)">删除</button>' : "") + "</div>"
      ).join("") +
      '<div class="form-row" style="border:none"><input type="text" id="mbNew" maxlength="6" placeholder="新成员名称" style="text-align:left">' +
      '<button class="btn btn-primary" id="mbAdd" style="padding:8px 16px">添加</button></div>';
      sh.body.querySelectorAll("[data-del]").forEach(el => el.onclick = () => {
        Store.s.settings.members = Store.s.settings.members.filter(x => x !== el.dataset.del);
        Store.save(); render();
      });
      UI.$("#mbAdd", sh.body).onclick = () => {
        const v = UI.$("#mbNew", sh.body).value.trim();
        if (!v) return;
        if (Store.s.settings.members.includes(v)) { UI.toast("已存在"); return; }
        Store.s.settings.members.push(v); Store.save(); render();
      };
    };
    render();
  },

  currencySheet(cb) {
    const sh = UI.sheet({ title: "币种符号" });
    sh.body.innerHTML = '<div class="form-row" style="border:none"><div class="lab">货币符号</div><div class="sel" style="justify-content:flex-end">' +
      DATA.currencies.map(c => '<button class="chip' + (Store.s.settings.currency === c ? " active" : "") + '" data-c="' + c + '">' + c + "</button>").join("") + "</div></div>" +
      '<div style="font-size:12px;color:var(--text-3);padding:4px">注意：仅切换显示符号，不做汇率换算（与原 App 的多币种展示一致）。</div>';
    sh.body.querySelectorAll("[data-c]").forEach(el => el.onclick = () => {
      Store.s.settings.currency = el.dataset.c;
      Store.save(); sh.close(); UI.toast("已切换币种");
      cb ? cb() : App.refresh();
    });
  }
};

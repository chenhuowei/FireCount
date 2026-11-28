/* ============================================================
 * 明细页：
 *   账本切换 / 月份切换 / 账户筛选 / 日历 / 搜索
 *   按天分组的账单列表 + 左滑编辑删除（bill_list_btn_bianji/shanchu 证据）
 * 附：日历视图 与 搜索
 * ============================================================ */
"use strict";

const ViewsBills = {
  render(header, main) {
    header.classList.add("hidden");
    const m = App.billMonth;
    const sum = Store.monthSummary(m);
    const book = Store.book();
    const y = +m.slice(0, 4), mm = +m.slice(5, 7);
    const filtering = !!App.billFilter.account;
    const fAcc = filtering ? Store.account(App.billFilter.account) : null;
    main.innerHTML =
      '<div class="page-anim">' +
      '<div class="bill-top">' +
        '<div class="bill-month-row">' +
          '<button class="bill-book-btn" id="bBookBtn">' + UI.svg("book", 15) + UI.escape(book.name) + UI.svg("down", 13) + "</button>" +
          '<div class="bill-month-switch">' +
            '<button id="mPrev">' + UI.svg("left", 16) + "</button>" +
            '<div class="cur" id="mTitle" style="cursor:pointer">' + y + "年" + mm + "月</div>" +
            '<button id="mNext">' + UI.svg("right", 16) + "</button>" +
          "</div>" +
        "</div>" +
        '<div class="bill-sum">' +
          '<div class="item"><div class="lab">本月支出</div><div class="val">' + fmt.money(sum.out) + "</div></div>" +
          '<div class="item"><div class="lab">本月收入</div><div class="val">' + fmt.money(sum.in) + "</div></div>" +
          '<div class="item"><div class="lab">结余</div><div class="val">' + (sum.balance >= 0 ? "+" : "") + fmt.money(sum.balance) + "</div></div>" +
        "</div>" +
      "</div>" +
      '<div class="bill-tools">' +
        '<button class="tool' + (filtering ? " active" : "") + '" id="tFilter">' + (filtering ? UI.escape(fAcc.name) : "全部账户") + UI.svg("down", 13) + "</button>" +
        '<button class="tool" id="tCal">' + UI.svg("calendar", 16) + "日历</button>" +
        '<button class="tool" id="tSearch">' + UI.svg("search", 15) + "搜索</button>" +
      "</div>" +
      '<div id="billList"></div>' +
      "</div>";
    UI.$("#mTitle").onclick = () => UI.periodPicker("month", App.billMonth, v => { App.billMonth = v; App.refresh({ skipAnim: true }); });
    UI.$("#mPrev").onclick = () => App.shiftMonth(-1);
    UI.$("#mNext").onclick = () => App.shiftMonth(1);
    UI.$("#bBookBtn").onclick = () => ViewsBills.bookSheet();
    UI.$("#tCal").onclick = () => App.go("calendar");
    UI.$("#tSearch").onclick = () => App.go("search");
    UI.$("#tFilter").onclick = () => ViewsBills.filterSheet();
    this.renderList();
  },

  _listKey: null, visibleCount: 30, pageSize: 30,

  renderList() {
    const host = UI.$("#billList");
    const groups = Store.dayGroups(App.billMonth, App.billFilter.account);
    const cur = Store.s.settings.currency;
    // 空状态也要重置分页 key，否则切到无数据月再切回会保留旧的 visibleCount
    const key = App.billMonth + "|" + (App.billFilter.account || "") + "|" + Store.s.currentBookId;
    if (this._listKey !== key) { this._listKey = key; this.visibleCount = this.pageSize; }
    if (!groups.length) {
      const hasAny = Store.s.records.length > 0;
      host.innerHTML =
        '<div class="empty"><div class="big">📒</div><div class="t1">' +
        (hasAny ? "本月暂无账单" : "还没有账单，记第一笔吧") + "</div>" +
        '<div class="btns">' +
        '<button class="btn btn-primary" onclick="A.openAdd()">' + UI.svg("plus", 15) + "记一笔</button>" +
        (hasAny ? "" : '<button class="btn btn-ghost" onclick="A.loadDemo()">载入演示数据</button>') +
        "</div></div>";
      return;
    }
    // 分页：按整天显示，不切断日组
    const paged = groups.slice(0, this.visibleCount);
    const total = groups.length;
    let html = "";
    for (const g of paged) {
      html += '<div class="day-group"><div class="day-head"><span class="d">' + fmt.dayLabel(g.date) + "</span>" +
        '<span class="sums">' + (g.in ? '<span class="money-in">收 ' + fmt.money(g.in) + "</span>" : "") +
        (g.out ? '<span class="money-out">支 ' + fmt.money(g.out) + "</span>" : "") + "</span></div>";
      for (const r of g.items) html += ViewsBills.itemHTML(r, cur);
      html += "</div>";
    }
    const shown = paged.length;
    if (shown < total) {
      html += '<div class="load-more" id="loadMore">加载更多 · 已显示 ' + shown + "/" + total + " 天</div>";
    }
    host.innerHTML = html;
    const lm = UI.$("#loadMore", host);
    if (lm) lm.onclick = () => {
      const main = UI.$("#pageMain"), top = main ? main.scrollTop : 0;
      this.visibleCount += this.pageSize;
      this.renderList();
      if (main) main.scrollTop = top;
    };
    this.bindSwipe(host);
  },

  itemHTML(r, cur) {
    const c = Store.category(r.categoryId);
    let icon, title, sub, amt, amtCls, tag = "";
    if (r.type === "transfer") {
      const a1 = Store.account(r.accountId), a2 = Store.account(r.toAccountId);
      icon = '<div class="bi-icon" style="background:#3B82F622;color:#3B82F6">' + UI.svg("swap", 20) + "</div>";
      title = "转账";
      sub = (a1 ? a1.name : "?") + " → " + (a2 ? a2.name : "?");
      amtCls = "money-flat";
      amt = fmt.money(r.amount);
    } else {
      icon = UI.catIcon(c);
      title = c ? c.name : "未分类";
      const acc = Store.account(r.accountId);
      sub = [acc && acc.name, r.note, fmt.timeLabel(r.date)].filter(Boolean).join(" · ");
      amtCls = r.type === "income" ? "money-in" : "money-out";
      amt = (r.type === "income" ? "+" : "-") + fmt.money(r.amount);
    }
    tag = (r.tags || []).map(t => '<span class="tags">#' + UI.escape(t) + "</span>").join("");
    return (
      '<div class="bill-item" data-id="' + UI.escAttr(r.id) + '">' +
      '<div class="bi-acts"><button class="a-edit" data-act="edit">' + UI.svg("edit", 16) + '编辑</button>' +
      '<button class="a-del" data-act="del">' + UI.svg("trash", 16) + "删除</button></div>" +
      '<div class="bi-inner">' + icon +
      '<div class="bi-main"><div class="bi-title">' + UI.escape(title) + tag + "</div>" +
      '<div class="bi-sub"><span class="bi-sub-txt">' + UI.escape(sub) + "</span>" +
      (r.photos && r.photos.length ? '<img class="bi-thumb" src="' + UI.escAttr(UI.safeImgSrc(r.photos[0])) + '" onclick="event.stopPropagation();A.viewPhoto(this.src)">' : "") +
      "</div></div>" +
      '<div class="bi-amt ' + amtCls + '"><small>' + cur + "</small>" + amt + "</div>" +
      "</div></div>"
    );
  },

  /* 触摸左滑编辑/删除 + 点击编辑 + 桌面 hover 的 ⋯ */
  /* 事件委托：容器只绑 4 个监听器，子项频繁重渲染也无需逐项绑定 */
  bindSwipe(root) {
    if (!root || root.__swipeBound) return;
    root.__swipeBound = true;
    let openItem = null;
    const st = new WeakMap();
    const closeOpen = () => {
      if (openItem) { const el = openItem.querySelector(".bi-inner"); if (el) el.style.transform = ""; openItem = null; }
    };
    const itemOf = e => {
      if (!e.target || !e.target.closest) return null;
      const it = e.target.closest(".bill-item");
      return it && root.contains(it) ? it : null;
    };
    root.addEventListener("touchstart", e => {
      const item = itemOf(e); if (!item) return;
      const t = e.touches[0];
      st.set(item, { sx: t.clientX, sy: t.clientY, dx: 0, dragging: true, swiped: false });
    }, { passive: true });
    root.addEventListener("touchmove", e => {
      const item = itemOf(e); if (!item) return;
      const s = st.get(item); if (!s || !s.dragging) return;
      const t = e.touches[0], mx = t.clientX - s.sx, my = t.clientY - s.sy;
      if (Math.abs(mx) > Math.abs(my)) { s.dx = Math.max(Math.min(mx, 0), -136); if (Math.abs(mx) > 12) s.swiped = true; }
    }, { passive: true });
    root.addEventListener("touchend", e => {
      const item = itemOf(e); if (!item) return;
      const s = st.get(item); if (!s || !s.dragging) return;
      s.dragging = false;
      const inner = item.querySelector(".bi-inner");
      if (openItem && !root.contains(openItem)) openItem = null;
      if (s.dx < -50) { closeOpen(); openItem = item; if (inner) inner.style.transform = "translateX(-136px)"; }
      else { if (inner) inner.style.transform = ""; if (openItem === item) openItem = null; }
      if (s.swiped) setTimeout(() => { s.swiped = false; }, 350); // 防滑动后误触发点击
    }, { passive: true });
    root.addEventListener("click", e => {
      const item = itemOf(e); if (!item) return;
      const act = e.target.closest ? e.target.closest(".bi-acts button") : null;
      const r = Store.s.records.find(x => x.id === item.dataset.id);
      if (act) {
        if (!r) return;
        if (act.dataset.act === "edit") { closeOpen(); ViewsAdd.open(r); }
        else {
          UI.confirm({ title: "删除账单", body: "删除后无法恢复，确定删除这条账单吗？", ok: "删除", danger: true }).then(ok => {
            if (ok) { Store.deleteRecord(r.id); UI.toast("已删除"); App.refresh(); }
          });
        }
        return;
      }
      const s = st.get(item);
      if (s && s.swiped) return;
      if (openItem && !root.contains(openItem)) openItem = null;
      if (openItem && openItem !== item) { closeOpen(); return; }
      if (openItem === item) { closeOpen(); return; }
      if (r) ViewsAdd.open(r); // 点击即进入编辑
    });
  },

  bookSheet() {
    const sh = UI.sheet({ title: "切换账本" });
    sh.body.innerHTML =
      Store.s.books.map(b =>
        '<div class="cell" data-id="' + UI.escAttr(b.id) + '"><div class="cell-main"><div class="cell-title">' + UI.escape(b.name) + "</div>" +
        '<div class="cell-desc">' + Store.recordsOf(b.id).length + ' 笔账单</div></div>' +
        (b.id === Store.s.currentBookId ? '<span style="color:var(--brand)">✓</span>' : "") + "</div>"
      ).join("") +
      '<div class="sec-title">新建 / 管理账本请到「我的 → 多账本管理」</div>';
    UI.$$(".cell", sh.body).forEach(c => c.onclick = () => {
      Store.s.currentBookId = c.dataset.id; Store.save();
      sh.close(); App.refresh();
    });
  },

  filterSheet() {
    const sh = UI.sheet({ title: "选择账户" });
    sh.body.innerHTML =
      '<div class="cell" data-id=""><div class="cell-icon">🗂️</div><div class="cell-main"><div class="cell-title">全部账户</div></div>' +
      (!App.billFilter.account ? '<span style="color:var(--brand)">✓</span>' : "") + "</div>" +
      Store.s.accounts.map(a =>
        '<div class="cell" data-id="' + UI.escAttr(a.id) + '">' + UI.accIcon(a, "cell-icon") +
        '<div class="cell-main"><div class="cell-title">' + UI.escape(a.name) + "</div></div>" +
        (App.billFilter.account === a.id ? '<span style="color:var(--brand)">✓</span>' : "") + "</div>"
      ).join("");
    UI.$$(".cell", sh.body).forEach(c => c.onclick = () => {
      App.billFilter.account = c.dataset.id || null;
      sh.close(); App.refresh();
    });
  }
};

/* ================= 日历视图 ================= */
const ViewsCalendar = {
  render(header, main) {
    const m = App.billMonth;
    const y = +m.slice(0, 4), mm = +m.slice(5, 7);
    const first = new Date(y, mm - 1, 1);
    const days = new Date(y, mm, 0).getDate();
    const todayStr = fmt.YMD(new Date());
    const stats = new Map(); // date -> {in, out}
    for (const r of Store.monthRecords(m)) {
      const d = r.date.slice(0, 10);
      if (!stats.has(d)) stats.set(d, { in: 0, out: 0 });
      const e = stats.get(d);
      if (r.type === "income") e.in += r.amount; else if (r.type === "expense") e.out += r.amount;
    }
    header.classList.remove("hidden");
    header.innerHTML =
      '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">日历记账</div></div>';
    let cells = "";
    for (let i = 0; i < first.getDay(); i++) cells += "<div class='cal-cell dim'></div>";
    for (let d = 1; d <= days; d++) {
      const ds = y + "-" + String(mm).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      const st = stats.get(ds);
      cells +=
        '<div class="cal-cell' + (ds === todayStr ? " today" : "") + '" data-d="' + ds + '">' +
        '<div class="d">' + d + "</div>" +
        (st ? '<div class="io">' + (st.in ? '<div class="i">+' + fmt.money(st.in) + "</div>" : "") + (st.out ? '<div class="o">-' + fmt.money(st.out) + "</div>" : "") + "</div>" : "") +
        "</div>";
    }
    const sum = Store.monthSummary(m);
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="card" style="padding:6px 10px 12px">' +
      '<div class="cal-head"><button id="cPrev">' + UI.svg("left", 15) + '</button><div class="m">' + y + "年" + mm + '月</div><button id="cNext">' + UI.svg("right", 15) + "</button></div>" +
      '<div class="cal-week">' + ["日", "一", "二", "三", "四", "五", "六"].map(w => "<span>" + w + "</span>").join("") + "</div>" +
      '<div class="cal-grid">' + cells + "</div></div>" +
      '<div class="card" style="display:flex;padding:14px">' +
      '<div style="flex:1;text-align:center"><div style="font-size:12px;color:var(--text-3)">本月收入</div><div class="money-in" style="font-weight:700;margin-top:4px">' + fmt.money(sum.in) + "</div></div>" +
      '<div style="flex:1;text-align:center"><div style="font-size:12px;color:var(--text-3)">本月支出</div><div class="money-out" style="font-weight:700;margin-top:4px">' + fmt.money(sum.out) + "</div></div>" +
      '<div style="flex:1;text-align:center"><div style="font-size:12px;color:var(--text-3)">结余</div><div style="font-weight:700;margin-top:4px">' + (sum.balance >= 0 ? "+" : "") + fmt.money(sum.balance) + "</div></div>" +
      "</div></div>";
    UI.$("[data-back]", header).onclick = () => App.back();
    UI.$("#cPrev").onclick = () => { App.shiftMonth(-1); };
    UI.$("#cNext").onclick = () => { App.shiftMonth(1); };
    UI.$$(".cal-cell[data-d]", main).forEach(c => c.onclick = () => ViewsCalendar.daySheet(c.dataset.d));
  },

  daySheet(ds) {
    const list = Store.bookRecords().filter(r => r.date.slice(0, 10) === ds);
    const sh = UI.sheet({ title: fmt.dayLabel(ds) + " · " + ds.slice(5) });
    if (!list.length) sh.body.innerHTML = '<div class="empty"><div class="big">🌤️</div><div class="t1">这一天没有账单</div></div>';
    else sh.body.innerHTML = list.map(r => ViewsBills.itemHTML(r, Store.s.settings.currency)).join("");
    ViewsBills.bindSwipe(sh.body);
  }
};

/* ================= 搜索 ================= */
const ViewsSearch = {
  render(header, main) {
    header.classList.remove("hidden");
    header.innerHTML = '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">搜索账单</div></div>';
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="search-bar">' + UI.svg("search") +
      '<input id="searchInput" placeholder="搜索备注 / 分类 / 账户 / 标签 / 金额" autocomplete="off">' +
      '<button id="searchClear" class="txt-btn hidden" style="font-size:13px;color:var(--brand)">清空</button></div>' +
      '<div id="searchResults"><div class="empty"><div class="big">🔍</div><div class="t1">输入关键词，查找历史账单</div></div></div></div>';
    UI.$("[data-back]", header).onclick = () => App.back();
    const input = UI.$("#searchInput"), results = UI.$("#searchResults");
    let timer = null;
    const run = () => {
      const q = input.value.trim();
      UI.$("#searchClear").classList.toggle("hidden", !q);
      if (!q) { results.innerHTML = '<div class="empty"><div class="big">🔍</div><div class="t1">输入关键词，查找历史账单</div></div>'; return; }
      const list = Store.searchRecords(q, false);
      if (!list.length) { results.innerHTML = '<div class="empty"><div class="big">🤷</div><div class="t1">没有找到相关账单</div></div>'; return; }
      results.innerHTML =
        '<div class="sec-title">共 ' + (list.total || list.length) + " 条结果" + (list.total > 100 ? "（显示前 100 条）" : "") + "</div>" +
        '<div class="day-group" style="margin:0 0 12px">' + list.map(r => ViewsBills.itemHTML(r, Store.s.settings.currency)).join("") + "</div>";
      ViewsBills.bindSwipe(results);
    };
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 200); };
    UI.$("#searchClear").onclick = () => { input.value = ""; run(); input.focus(); };
    setTimeout(() => input.focus(), 100);
  }
};

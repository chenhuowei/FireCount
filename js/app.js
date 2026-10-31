/* ============================================================
 * 应用入口：路由 / 底部 Tab（报表 · 记一笔 · 我的）
 * 启动流程：载入状态 → 渲染
 * ============================================================ */
"use strict";

const App = {
  page: "report",
  stack: [],
  viewMonth: fmt.curMonth(),
  billFilter: { account: null },

  PAGES: {
    bills:      { render: (h, m, p) => ViewsBills.render(h, m) },
    report:     { render: (h, m, p) => ViewsReport.render(h, m), tab: true },
    wallet:     { render: (h, m, p) => ViewsWallet.render(h, m) },
    mine:       { render: (h, m, p) => ViewsMine.render(h, m), tab: true },
    calendar:   { render: (h, m, p) => ViewsCalendar.render(h, m) },
    search:     { render: (h, m, p) => ViewsSearch.render(h, m) },
    books:      { render: (h, m, p) => ViewsMine.renderBooks(h, m) },
    budget:     { render: (h, m, p) => ViewsMine.renderBudget(h, m) },
    categories: { render: (h, m, p) => ViewsMine.renderCategories(h, m) },
    accountDetail: { render: (h, m, p) => ViewsWallet.renderDetail(h, m, p) }
  },

  boot() {
    Store.boot();
    this.applyTheme();
    this.viewMonth = fmt.curMonth();
    // 首次使用且无记录 → 直接给出演示入口的空状态
    const hashPage = (location.hash || "").replace("#/", "");
    this.go(this.PAGES[hashPage] ? hashPage : "report", null, true);
    Lock.init();            // 应用锁：启动验证（若启用）
    WebDAV.initAuto();      // WebDAV：6 小时自动备份检查
    if (location.hash === "#add") this.openQuickAdd(); // 快捷方式入口
  },

  /* 长按图标快捷记账入口（被应用锁拦截时自动延迟到解锁后执行） */
  openQuickAdd() {
    if (Lock.active) { Lock.pendingAfterUnlock = () => ViewsAdd.open(); return; }
    ViewsAdd.open();
  },

  /* 原生快捷动作分发（需求③：去同步） */
  __appAction(type) {
    if (type === "sync") {
      if (!WebDAV.available()) { UI.toast("仅 APK 版支持云同步"); return; }
      if (!WebDAV.configured()) { UI.toast("请先在「更多 → WebDAV 同步」中配置坚果云账号"); return; }
      UI.toast("正在同步备份…");
      WebDAV.backupNow(true);
    }
  },

  applyTheme() {
    document.body.dataset.theme = Store.s.settings.theme;
  },

  go(page, params, replace) {
    if (!this.PAGES[page]) page = "report";
    if (!replace) this.stack.push({ page: this.page, params: this.params });
    this.page = page; this.params = params;
    history.replaceState(null, "", "#/" + page);
    this.render();
  },

  back() {
    const prev = this.stack.pop();
    this.page = prev ? prev.page : "report";
    this.params = prev ? prev.params : null;
    history.replaceState(null, "", "#/" + this.page);
    this.render();
  },

  refresh() { this.render(); },

  render() {
    const header = UI.$("#pageHeader"), main = UI.$("#pageMain");
    main.scrollTop = 0;
    const conf = this.PAGES[this.page];
    conf.render(header, main, this.params);
    this.renderTabbar(conf.tab && this.page);
  },

  renderTabbar(activeTab) {
    const bar = UI.$("#tabbar");
    if (!activeTab) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    const tabs = [
      { id: "report", icon: "pie", label: "报表" },
      { id: "__add", icon: "plus", label: "记一笔", center: true },
      { id: "mine", icon: "user", label: "我的" }
    ];
    bar.innerHTML = tabs.map(t =>
      t.center
        ? '<button class="tab-jy' + (activeTab === "__add" ? " active" : "") + '"><span class="jy-ball">' + UI.svg("plus", 26) + '</span><span class="jy-label">记一笔</span></button>'
        : '<button class="tab' + (activeTab === t.id ? " active" : "") + '" data-t="' + t.id + '">' + UI.svg(t.icon) + "<span>" + t.label + "</span></button>"
    ).join("");
    bar.querySelectorAll("[data-t]").forEach(b => b.onclick = () => this.go(b.dataset.t));
    bar.querySelector(".tab-jy").onclick = () => ViewsAdd.open();
  },

  shiftMonth(delta) {
    const y = +this.viewMonth.slice(0, 4), m = +this.viewMonth.slice(5, 7);
    const d = new Date(y, m - 1 + delta, 1);
    this.viewMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    this.render();
  }
};

/* 供原生桥调用的全局入口（const 声明不挂 window，需显式暴露） */
window.__appAction = t => App.__appAction(t);
window.__openQuickAdd = () => App.openQuickAdd();

/* 供模板 onclick 调用的动作 */
window.A = {
  openAdd: () => ViewsAdd.open(),
  viewPhoto: src => UI.viewPhoto(src),
  loadDemo: () => {
    const has = Store.s.records.length > 0;
    const doIt = () => {
      Store.seedDemo();
      App.viewMonth = fmt.curMonth();
      UI.toast("演示数据已载入");
      App.refresh();
    };
    if (has) {
      UI.confirm({ title: "载入演示数据", body: "将在现有数据基础上，追加近 3 个月的演示账单与预算。", ok: "载入" }).then(ok => ok && doIt());
    } else doIt();
  }
};

document.addEventListener("DOMContentLoaded", () => App.boot());

/* 切后台/关闭页面前强制落盘（去抖窗口内的最后变更不丢失） */
document.addEventListener("visibilitychange", () => { if (document.hidden) Store.saveNow(); });
window.addEventListener("pagehide", () => Store.saveNow());

/* ============================================================
 * 系统返回桥 + 左缘滑动返回（逐级：关闭弹层 → 返回上级页面 → 退出）
 * Android 返回键/边缘手势经 MainActivity 调用 window.nativeBack()
 * ============================================================ */
window.nativeBack = function () {
  try {
    const overlay = document.querySelector(".photo-viewer, #modalHost .modal-mask");
    if (overlay) { overlay.click(); return true; }
    if (UI._sheets && UI._sheets.length) { UI.closeSheet(); return true; }
    if (App.stack && App.stack.length) { App.back(); return true; }
  } catch (e) { console.warn("nativeBack", e); }
  return false;
};

/* 左缘滑动手势（网页层生效，兼容三键导航与浏览器环境） */
(function installEdgeBack() {
  const EDGE = 28, TRIGGER = 72, MAX_Y = 64;
  let sx = 0, sy = 0, tracking = false, hint = null, hintX = 0;
  const ensureHint = () => {
    if (hint || !tracking) return;
    hint = document.createElement("div");
    hint.className = "edge-hint";
    hint.innerHTML = UI.svg("back", 20);
    document.body.appendChild(hint);
  };
  const dropHint = () => { if (hint) { hint.remove(); hint = null; } };
  document.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (t.clientX <= EDGE) { tracking = true; sx = t.clientX; sy = t.clientY; hintX = 0; }
    else tracking = false;
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dy) > MAX_Y) { dropHint(); return; }
    if (dx > 20) { ensureHint(); hintX = Math.min(dx * 0.45, 44); hint.style.transform = "translate(" + hintX + "px, -50%)"; hint.style.opacity = String(Math.min(1, dx / 60)); }
    else if (hint && dx < 10) dropHint();
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    dropHint();
    if (dx > TRIGGER && Math.abs(t.clientY - sy) <= MAX_Y) window.nativeBack();
  });
  document.addEventListener("touchcancel", () => { tracking = false; dropHint(); });
})();

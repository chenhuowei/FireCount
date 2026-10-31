/* ============================================================
 * 报表页（modules.Report 复刻）：
 *   三种时间范围：按月（默认当前月）/ 按年 / 自定义日期区间（精确到日）
 *   分类占比环形图 + 分类排行 + 收支趋势折线 + KPI
 * ============================================================ */
"use strict";

const ViewsReport = {
  type: "expense",   // 当前查看支出/收入
  range: { mode: "month", month: null, year: null, start: null, end: null }, // 查询范围

  /* 计算当前范围的 [start,end] 与标题 */
  resolve() {
    const r = this.range;
    const now = new Date();
    const ym = m => m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0");
    const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (r.mode === "month") {
      if (!r.month) r.month = ym(now);
      const [y, mm] = r.month.split("-").map(Number);
      const start = r.month + "-01";
      const end = ymd(new Date(y, mm, 0));
      return { start, end, title: y + "年" + mm + "月" };
    }
    if (r.mode === "year") {
      if (!r.year) r.year = now.getFullYear();
      return { start: r.year + "-01-01", end: r.year + "-12-31", title: r.year + "年" };
    }
    // custom
    if (!r.start || !r.end) {
      const s = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), e = ymd(now);
      r.start = s; r.end = e;
    }
    return { start: r.start, end: r.end, title: r.start.slice(5).replace("-", "/") + " ~ " + r.end.slice(5).replace("-", "/") };
  },

  shiftMonth(delta) { App.shiftMonth(delta); },
  shiftYear(delta) {
    this.range.year = (this.range.year || new Date().getFullYear()) + delta;
    App.refresh();
  },

  render(header, main) {
    header.classList.add("hidden");
    const R = this.resolve();
    const t = this.type;
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="rp-modebar"><div class="sel" id="rpMode">' +
        [["month", "按月"], ["year", "按年"], ["custom", "自定义"]].map(([v, l]) =>
          '<button class="chip' + (this.range.mode === v ? " active" : "") + '" data-mode="' + v + '">' + l + "</button>").join("") +
      "</div></div>" +
      '<div class="rp-monthbar" id="rpNav"></div>' +
      '<div class="rp-toggle"><button data-t="expense" class="' + (t === "expense" ? "active" : "") + '">支出分析</button><button data-t="income" class="' + (t === "income" ? "active" : "") + '">收入分析</button></div>' +
      '<div id="rpBody"></div></div>';

    // 模式切换
    main.querySelectorAll("#rpMode [data-mode]").forEach(b => b.onclick = () => {
      this.range.mode = b.dataset.mode;
      App.refresh();
    });

    this.renderNav();
    main.querySelectorAll(".rp-toggle button").forEach(b => b.onclick = () => {
      ViewsReport.type = b.dataset.t;
      App.refresh();
    });
    this.renderBody();
  },

  /* 按模式渲染导航条：月切换 / 年切换 / 双日期选择 */
  renderNav() {
    const nav = UI.$("#rpNav");
    const R = this.resolve();
    if (this.range.mode === "month") {
      nav.innerHTML =
        '<button id="rPrev">' + UI.svg("left", 14) + '</button><div class="m" id="rTitle" style="cursor:pointer">' + R.title + '</div><button id="rNext">' + UI.svg("right", 14) + "</button>";
      UI.$("#rPrev").onclick = () => App.shiftMonth(-1);
      UI.$("#rNext").onclick = () => App.shiftMonth(1);
      UI.$("#rTitle").onclick = () => UI.periodPicker("month", this.range.month || App.viewMonth, v => { App.viewMonth = v; this.range.month = v; App.refresh(); });
      this.range.month = App.viewMonth;
    } else if (this.range.mode === "year") {
      nav.innerHTML =
        '<button id="rPrev">' + UI.svg("left", 14) + '</button><div class="m" id="rTitle" style="cursor:pointer">' + R.title + '</div><button id="rNext">' + UI.svg("right", 14) + "</button>";
      UI.$("#rPrev").onclick = () => this.shiftYear(-1);
      UI.$("#rNext").onclick = () => this.shiftYear(1);
      UI.$("#rTitle").onclick = () => UI.periodPicker("year", String(this.range.year || new Date().getFullYear()), v => { this.range.year = +v; App.refresh(); });
    } else {
      nav.innerHTML =
        '<div class="rp-datefld" id="rStart">' + fmt.monthDay(this.range.start) + '</div>' +
        '<span class="sep">至</span>' +
        '<div class="rp-datefld" id="rEnd">' + fmt.monthDay(this.range.end) + '</div>';
      UI.$("#rStart").onclick = () => UI.datePicker(this.range.start + " 12:00", v => {
        this.range.start = v.slice(0, 10);
        if (this.range.end < this.range.start) this.range.end = this.range.start;
        App.refresh();
      });
      UI.$("#rEnd").onclick = () => UI.datePicker(this.range.end + " 23:59", v => {
        this.range.end = v.slice(0, 10);
        if (this.range.end < this.range.start) this.range.start = this.range.end;
        App.refresh();
      });
    }
  },

  renderBody() {
    const host = UI.$("#rpBody");
    if (!host) return;
    const R = this.resolve();
    const t = this.type;
    const cur = Store.s.settings.currency;
    const sum = Store.rangeSummary(R.start, R.end);
    const entries = Store.rangeByCategory(R.start, R.end, t);
    const recs = Store.rangeRecords(R.start, R.end).filter(r => r.type === t);
    const total = t === "expense" ? sum.out : sum.in;

    /* KPI */
    const maxOne = recs.length ? Math.max(...recs.map(r => r.amount)) : 0;
    const daySet = new Set(Store.rangeRecords(R.start, R.end).map(r => r.date.slice(0, 10)));
    const dayCount = daySet.size;
    // 区间天数
    const ds = new Date(R.start + "T00:00:00"), de = new Date(R.end + "T00:00:00");
    const spanDays = Math.max(1, Math.round((de - ds) / 86400000) + 1);
    const avgDay = t === "expense" && dayCount ? sum.out / dayCount : 0;
    const avgAllDay = sum.out / spanDays;

    let html =
      '<div class="rp-kpis">' +
        kpi("总" + (t === "expense" ? "支出" : "收入"), cur + fmt.money(t === "expense" ? sum.out : sum.in)) +
        kpi("账单笔数", recs.length) +
        kpi("最高单笔", cur + fmt.money(maxOne)) +
        kpi("记账天数", dayCount + "/" + spanDays + "天") +
      "</div>";

    /* 饼图 + 图例 */
    const top = entries.slice(0, 8);
    const rest = entries.slice(8);
    const pieEntries = top.map(e => ({ label: e.cat.name, value: e.amount, color: e.cat.color }));
    if (rest.length) pieEntries.push({ label: "其他", value: rest.reduce((s, e) => s + e.amount, 0), color: "#94A3B8" });
    html +=
      '<div class="card"><canvas id="rpPie" class="chart" data-h="230" data-center="' + (t === "expense" ? "总支出" : "总收入") + '"></canvas>' +
      '<div class="rp-legend">' +
        (entries.length ? entries.slice(0, 10).map(e =>
          '<div class="lg"><span class="dot" style="background:' + e.cat.color + '"></span>' +
          '<span class="nm" style="display:inline-flex;align-items:center;gap:5px">' + UI.catIcon(e.cat, "rp-ico") + " " + UI.escape(e.cat.name) + "</span>" +
          '<span class="ct">' + e.count + "笔</span>" +
          '<span class="amt">' + cur + fmt.money(e.amount) + "</span></div>"
        ).join("") : '<div style="text-align:center;color:var(--text-3);padding:10px 0">该范围内暂无' + (t === "expense" ? "支出" : "收入") + "账单</div>") +
      "</div></div>";

    /* 趋势折线：月模式展示近6个月；年/自定义模式展示区间内按月聚合（跨度过大则省略） */
    let lineBlock = "";
    const monthDiff = (new Date(R.end + "T00:00:00").getFullYear() - new Date(R.start + "T00:00:00").getFullYear()) * 12
      + (new Date(R.end + "T00:00:00").getMonth() - new Date(R.start + "T00:00:00").getMonth()) + 1;
    if (this.range.mode === "month") {
      const tr = Store.trend(6);
      lineBlock = this._lineCard("收支趋势 · 近 6 个月", tr);
    } else if (monthDiff <= 24) {
      const tr = this._trendBetween(R.start, R.end);
      lineBlock = this._lineCard("收支趋势 · 区间按月", tr);
    }
    html += lineBlock;

    /* 分类排行 */
    const maxAmt = entries.length ? entries[0].amount : 1;
    html +=
      '<div class="card" style="padding:8px 2px 12px"><div class="sec-title" style="padding:4px 14px 4px">' + (t === "expense" ? "支出" : "收入") + "排行</div>" +
      (entries.length ? entries.slice(0, 12).map((e, i) =>
        '<div class="rank-row"><span class="rk">' + (i + 1) + "</span>" + UI.catIcon(e.cat, "rk-ico") + '<span class="rn">' + UI.escape(e.cat.name) + "</span>" +
        '<span class="bar-zone"><i class="bar" style="width:' + Math.max(4, e.amount / maxAmt * 100) + '%"></i></span>' +
        '<span class="amt">' + fmt.money(e.amount) + "</span></div>"
      ).join("") : '<div style="text-align:center;color:var(--text-3);padding:16px 0">暂无数据</div>') +
      "</div>";

    host.innerHTML = html;
    Charts.pie(UI.$("#rpPie"), pieEntries);
    if (lineBlock) {
      const tr = this.range.mode === "month" ? Store.trend(6) : this._trendBetween(R.start, R.end);
      Charts.line(UI.$("#rpLine"), tr.map(x => x.label), [
        { name: "支出", color: "#FF5E3A", values: tr.map(x => x.out) },
        { name: "收入", color: "#2BB673", values: tr.map(x => x.in) }
      ]);
    }

    function kpi(k, v) {
      return '<div class="rp-kpi"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
    }
  },

  _lineCard(title, tr) {
    return '<div class="card" style="padding:12px 6px 8px">' +
      '<div class="sec-title" style="padding:0 10px 8px">' + title + "</div>" +
      '<canvas id="rpLine" class="chart" data-h="180"></canvas>' +
      '<div style="display:flex;justify-content:center;gap:18px;padding:8px 0 4px;font-size:12px;color:var(--text-2)">' +
      '<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#FF5E3A;margin-right:5px"></i>支出</span>' +
      '<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#2BB673;margin-right:5px"></i>收入</span></div></div>';
  },

  /* 区间内按自然月聚合收支 */
  _trendBetween(start, end) {
    const out = [];
    let d = new Date(start.slice(0, 7) + "-01T00:00:00");
    const endM = end.slice(0, 7);
    let guard = 0;
    while (guard++ < 300) {
      const m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const sum = Store.monthSummary(m);
      out.push({ month: m, label: (d.getMonth() + 1) + "月", in: sum.in, out: sum.out });
      if (m === endM) break;
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }
};

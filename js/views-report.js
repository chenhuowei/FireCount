/* ============================================================
 * 报表页（modules.Report 复刻）：
 *   分类占比环形图 + 分类排行（MainReportActivity）
 *   收支趋势折线（report_linechart_layout）
 *   消费统计 KPI（expense_report_statistics：最高单笔/日均/记账天数）
 * ============================================================ */
"use strict";

const ViewsReport = {
  type: "expense", // 当前查看支出/收入

  render(header, main) {
    header.classList.add("hidden");
    const m = App.viewMonth;
    const y = +m.slice(0, 4), mm = +m.slice(5, 7);
    const sum = Store.monthSummary(m);
    const t = this.type;
    const total = t === "expense" ? sum.out : sum.in;
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="rp-monthbar"><button id="rPrev">' + UI.svg("left", 14) + '</button><div class="m">' + y + "年" + mm + '月</div><button id="rNext">' + UI.svg("right", 14) + "</button></div>" +
      '<div class="rp-toggle"><button data-t="expense" class="' + (t === "expense" ? "active" : "") + '">支出分析</button><button data-t="income" class="' + (t === "income" ? "active" : "") + '">收入分析</button></div>' +
      '<div id="rpBody"></div></div>';
    UI.$("#rPrev").onclick = () => App.shiftMonth(-1);
    UI.$("#rNext").onclick = () => App.shiftMonth(1);
    main.querySelectorAll(".rp-toggle button").forEach(b => b.onclick = () => {
      ViewsReport.type = b.dataset.t;
      App.refresh();
    });
    this.renderBody();
  },

  renderBody() {
    const host = UI.$("#rpBody");
    const m = App.viewMonth;
    const t = this.type;
    const sum = Store.monthSummary(m);
    const entries = Store.byCategory(m, t);
    const total = entries.reduce((s, e) => s + e.amount, 0);
    const cur = Store.s.settings.currency;

    /* KPI（expense_report_statistics 证据） */
    const recs = Store.monthRecords(m).filter(r => r.type === t);
    const maxOne = recs.length ? Math.max(...recs.map(r => r.amount)) : 0;
    const dayCount = Store.monthDaysWithRecords(m);
    const avgDay = t === "expense" ? (dayCount ? sum.out / dayCount : 0) : 0;
    const dim = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
    const avgMonthDay = sum.out / dim;

    let html =
      '<div class="rp-kpis">' +
        kpi("总" + (t === "expense" ? "支出" : "收入"), cur + fmt.money(t === "expense" ? sum.out : sum.in)) +
        kpi("账单笔数", recs.length) +
        kpi("最高单笔", cur + fmt.money(maxOne)) +
        kpi("记账天数", dayCount + "天") +
      "</div>";

    /* 饼图 + 图例 */
    const top = entries.slice(0, 8);
    const rest = entries.slice(8);
    const pieEntries = top.map(e => ({ label: e.cat.name, value: e.amount, color: e.cat.color }));
    if (rest.length) {
      pieEntries.push({ label: "其他", value: rest.reduce((s, e) => s + e.amount, 0), color: "#94A3B8" });
    }
    html +=
      '<div class="card"><canvas id="rpPie" class="chart" data-h="230" data-center="' + (t === "expense" ? "总支出" : "总收入") + '"></canvas>' +
      '<div class="rp-legend">' +
        (entries.length ? entries.slice(0, 10).map((e, i) =>
          '<div class="lg"><span class="dot" style="background:' + e.cat.color + '"></span>' +
          '<span class="nm" style="display:inline-flex;align-items:center;gap:5px">' + UI.catIcon(e.cat, "rp-ico") + " " + UI.escape(e.cat.name) + '</span>' +
          '<span class="ct">' + e.count + "笔</span>" +
          '<span class="amt">' + cur + fmt.money(e.amount) + "</span></div>"
        ).join("") : '<div style="text-align:center;color:var(--text-3);padding:10px 0">本月暂无' + (t === "expense" ? "支出" : "收入") + "账单</div>") +
      "</div></div>";

    /* 趋势折线（近 6 个月） */
    const tr = Store.trend(6);
    html +=
      '<div class="card" style="padding:12px 6px 8px">' +
      '<div class="sec-title" style="padding:0 10px 8px">收支趋势 · 近 6 个月</div>' +
      '<canvas id="rpLine" class="chart" data-h="180"></canvas>' +
      '<div style="display:flex;justify-content:center;gap:18px;padding:8px 0 4px;font-size:12px;color:var(--text-2)">' +
      '<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#FF5E3A;margin-right:5px"></i>支出</span>' +
      '<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#2BB673;margin-right:5px"></i>收入</span></div></div>';

    /* 分类排行 */
    const maxAmt = entries.length ? entries[0].amount : 1;
    html +=
      '<div class="card" style="padding:8px 2px 12px"><div class="sec-title" style="padding:4px 14px 4px">' + (t === "expense" ? "支出" : "收入") + "排行</div>" +
      (entries.length ? entries.slice(0, 12).map((e, i) =>
        '<div class="rank-row"><span class="rk">' + (i + 1) + '</span>' + UI.catIcon(e.cat, "rk-ico") + '<span class="rn">' + UI.escape(e.cat.name) + "</span>" +
        '<span class="bar-zone"><i class="bar" style="width:' + Math.max(4, e.amount / maxAmt * 100) + '%"></i></span>' +
        '<span class="amt">' + fmt.money(e.amount) + "</span></div>"
      ).join("") : '<div style="text-align:center;color:var(--text-3);padding:16px 0">暂无数据</div>') +
      "</div>";

    host.innerHTML = html;
    Charts.pie(UI.$("#rpPie"), pieEntries);
    Charts.line(UI.$("#rpLine"), tr.map(x => x.label), [
      { name: "支出", color: "#FF5E3A", values: tr.map(x => x.out) },
      { name: "收入", color: "#2BB673", values: tr.map(x => x.in) }
    ]);

    function kpi(k, v) {
      return '<div class="rp-kpi"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
    }
  }
};

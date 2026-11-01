/* ============================================================
 * 钱包页：
 *   净资产总览（资产 vs 负债）/ 账户分组列表（钱包 Tab）
 *   账户详情（含信用卡额度/账单日/还款日）
 *   添加/编辑账户
 *   转账
 * ============================================================ */
"use strict";

const ViewsWallet = {
  render(header, main) {
    header.classList.remove("hidden");
    header.innerHTML =
      '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">资产管理</div>' +
      '<div class="hd-sub"></div></div>';
    UI.$("[data-back]", header).onclick = () => App.back();
    const wl = Store.walletSummary();
    const cur = Store.s.settings.currency;
    const groups = DATA.accountTypes
      .map(t => ({ meta: t, list: Store.s.accounts.filter(a => a.type === t.type) }))
      .filter(g => g.list.length);
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="card wl-hero">' +
        '<div class="h">净资产（资产 − 负债，含期初余额）</div>' +
        '<div class="v">' + cur + " " + fmt.money(wl.net) + "</div>" +
        '<div class="sub">' +
          '<div class="s"><div class="k">总资产</div><div class="n money-in">' + cur + " " + fmt.money(wl.asset) + '</div></div>' +
          '<div class="s"><div class="k">总负债</div><div class="n money-out">' + cur + " " + fmt.money(wl.debt) + "</div></div>" +
        "</div></div>" +
      '<div style="display:flex;gap:10px;margin-bottom:12px">' +
        '<button class="btn btn-primary" style="flex:1" id="wTransfer">' + UI.svg("swap", 16) + "账户转账</button>" +
        '<button class="btn btn-ghost" style="flex:1" id="wAdd">＋ 添加账户</button>' +
      "</div>" +
      (groups.length ? groups.map(g =>
        '<div class="sec-title" style="display:flex;align-items:center;gap:6px">' + IconUI.svg(g.meta.icon.split(":")[1] || "cash", 16, g.meta.color) + " " + g.meta.name + " · " + g.list.length + "</div>" +
        '<div class="card">' + g.list.map(a => ViewsWallet.accItemHTML(a, cur)).join("") + "</div>"
      ).join("") : '<div class="empty"><div class="big">👛</div><div class="t1">还没有账户</div></div>') +
      "</div>";
    UI.$("#wTransfer").onclick = () => ViewsWallet.transferSheet();
    UI.$("#wAdd").onclick = () => ViewsWallet.addAccountSheet();
    UI.$$(".acc-item", main).forEach(el => el.onclick = () => App.go("accountDetail", { id: el.dataset.id }));
  },

  accItemHTML(a, cur) {
    const bal = Store.accountBalance(a.id);
    const meta = Store.accountTypeMeta(a.type);
    let right, desc = meta.name;
    if (a.type === "credit" && a.creditLimit) {
      const used = bal < 0 ? -bal : 0;
      right = '<div class="ab"><div class="n">' + fmt.money(bal) + '</div><div class="d">额度 ' + fmt.money(a.creditLimit) + " · 可用 " + fmt.money(Math.max(0, a.creditLimit - used)) + "</div></div>";
      if (a.billDay || a.repayDay) desc = (a.billDay ? "账单日 " + a.billDay + "日" : "") + (a.billDay && a.repayDay ? " · " : "") + (a.repayDay ? "还款日 " + a.repayDay + "日" : "");
    } else {
      right = '<div class="ab"><div class="n ' + (bal < 0 ? "money-out" : "") + '">' + fmt.money(bal) + '</div><div class="d">余额</div></div>';
    }
    return '<div class="acc-item" data-id="' + a.id + '">' + UI.accIcon(a, "ai") +
      '<div style="flex:1;min-width:0"><div class="an">' + UI.escape(a.name) + '</div><div class="ad">' + UI.escape(desc) + "</div></div>" +
      right + "</div>";
  },

  /* ---------- 账户详情 ---------- */
  renderDetail(header, main, params) {
    const a = Store.account(params.id);
    if (!a) { App.back(); return; }
    const cur = Store.s.settings.currency;
    const bal = Store.accountBalance(a.id);
    const recs = Store.s.records
      .filter(r => r.accountId === a.id || r.toAccountId === a.id)
      .sort((x, y) => y.date.localeCompare(x.date)).slice(0, 60);
    let stat = { in: 0, out: 0 };
    recs.forEach(r => {
      if (r.type === "income") stat.in += r.amount;
      else if (r.type === "expense") stat.out += r.amount;
    });
    header.classList.remove("hidden");
    header.innerHTML =
      '<div class="hd"><button class="hd-btn" data-back>' + UI.svg("back") + '</button><div class="hd-title">' + UI.escape(a.name) + "</div>" +
      '<div class="hd-sub"><button class="txt-btn" id="accEdit">编辑</button><button class="txt-btn" id="accDel" style="color:var(--danger)">删除</button></div></div>';
    main.innerHTML =
      '<div class="page page-anim">' +
      '<div class="card wl-hero">' +
        '<div class="h">' + (a.type === "credit" ? "当前欠款（负数）/ 余额" : "当前余额") + "</div>" +
        '<div class="v ' + (bal < 0 ? "money-out" : "") + '">' + cur + " " + fmt.money(bal) + "</div>" +
        '<div class="sub">' +
          '<div class="s"><div class="k">收入</div><div class="n money-in">' + fmt.money(stat.in) + '</div></div>' +
          '<div class="s"><div class="k">支出</div><div class="n money-out">' + fmt.money(stat.out) + '</div></div>' +
          (a.type === "credit" && a.creditLimit ? '<div class="s"><div class="k">额度</div><div class="n">' + fmt.money(a.creditLimit) + "</div></div>" : "") +
        "</div>" +
        (a.type === "credit" ? creditInfoHTML(a) : "") +
      "</div>" +
      '<div class="sec-title" style="margin-top:4px">账户流水</div>' +
      (recs.length ? '<div class="day-group" style="margin:0 0 12px">' + recs.map(r => ViewsWallet.recLineHTML(r, a, cur)).join("") + "</div>"
        : '<div class="empty"><div class="big">🧾</div><div class="t1">该账户暂无流水</div></div>') +
      "</div>";
    UI.$("[data-back]", header).onclick = () => App.back();
    UI.$("#accEdit").onclick = () => ViewsWallet.addAccountSheet(a);
    UI.$("#accDel").onclick = () => {
      UI.confirm({
        title: "删除账户", body: "删除「" + UI.escape(a.name) + "」将同时删除其下所有账单记录，且无法恢复。", ok: "删除", danger: true
      }).then(ok => {
        if (ok) { Store.deleteAccount(a.id); UI.toast("账户已删除"); App.back(); }
      });
    };

    function creditInfoHTML(acc) {
      const rows = [];
      if (acc.creditLimit) rows.push(["信用额度", fmt.money(acc.creditLimit)]);
      if (acc.billDay) rows.push(["账单日", "每月 " + acc.billDay + " 日"]);
      if (acc.repayDay) rows.push(["还款日", "每月 " + acc.repayDay + " 日"]);
      if (!rows.length) return "";
      return '<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">' +
        rows.map(r => '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-2);padding:4px 0"><span>' + r[0] + '</span><span style="color:var(--text-1);font-weight:600">' + r[1] + "</span></div>").join("") + "</div>";
    }
  },

  recLineHTML(r, a, cur) {
    const c = Store.category(r.categoryId);
    let title, amt, cls, icon;
    if (r.type === "transfer") {
      const out = r.accountId === a.id;
      const other = Store.account(out ? r.toAccountId : r.accountId);
      title = (out ? "转出 → " : "转入 ← ") + (other ? other.name : "?");
      cls = "money-flat"; amt = (out ? "-" : "+") + fmt.money(r.amount);
      icon = '<div class="bi-icon" style="background:#3B82F622;color:#3B82F6">' + UI.svg("swap", 20) + '</div>';
    } else {
      title = (c ? c.name : "未分类") + (r.note ? " · " + r.note : "");
      cls = r.type === "income" ? "money-in" : "money-out";
      amt = (r.type === "income" ? "+" : "-") + fmt.money(r.amount);
      icon = UI.catIcon(c);
    }
    return '<div class="bill-item" data-id="' + r.id + '"><div class="bi-inner">' + icon +
      '<div class="bi-main"><div class="bi-title" style="font-size:14px">' + UI.escape(title) + "</div>" +
      '<div class="bi-sub"><span class="bi-sub-txt">' + r.date + "</span>" +
      (r.photos && r.photos.length ? '<img class="bi-thumb" src="' + r.photos[0] + '" onclick="event.stopPropagation();A.viewPhoto(this.src)">' : "") +
      "</div></div>" +
      '<div class="bi-amt ' + cls + '" style="font-size:15px"><small>' + cur + "</small>" + amt + "</div></div></div>";
  },

  /* ---------- 添加 / 编辑账户 ---------- */
  addAccountSheet(editAcc, cb) {
    const editing = !!editAcc;
    const sh = UI.sheet({ title: editing ? "编辑账户" : "添加账户" });
    const S = editing
      ? { ...editAcc }
      : { type: "cash", name: "", icon: "", color: "", initial: 0, creditLimit: 0, billDay: 0, repayDay: 0 };
    const render = () => {
      const meta = Store.accountTypeMeta(S.type);
      sh.body.innerHTML =
        (editing ? "" :
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:4px 0 10px">' +
          DATA.accountTypes.map(t =>
            '<button class="jy-cat' + (S.type === t.type ? " selected" : "") + '" data-t="' + t.type + '">' +
            '<div class="ci" style="background:' + t.color + '22;color:' + t.color + '">' + IconUI.raw(t, 24) + '</div><div class="cn">' + t.name + "</div></button>"
          ).join("") + "</div>") +
        '<div class="form-row"><div class="lab">名称</div><input type="text" id="accName" maxlength="10" placeholder="' + (S.type === "bank" ? "如：招商银行" : "账户名称") + '" value="' + UI.escape(S.name || "") + '"></div>' +
        '<div class="form-row"><div class="lab">图标</div><div class="sel">' +
          presetsOf(S.type).map(p => '<button class="chip' + (S.icon === p.icon ? " active" : "") + '" data-icon="' + p.icon + '" data-nm="' + UI.escape(p.name) + '">' + p.icon + " " + p.name + "</button>").join("") +
          '<button class="chip' + (!presetsOf(S.type).some(p => p.icon === S.icon) && S.icon ? " active" : "") + '" data-icon="⭐">⭐ 自定义</button></div></div>' +
        '<div class="form-row"><div class="lab">' + (S.type === "credit" ? "当前欠款" : "期初余额") + '</div><input type="number" id="accInit" step="0.01" value="' + (S.initial || 0) + '"></div>' +
        (S.type === "credit" ?
          '<div class="form-row"><div class="lab">信用额度</div><input type="number" id="accLimit" step="0.01" value="' + (S.creditLimit || 0) + '"></div>' +
          '<div class="form-row"><div class="lab">账单日</div><input type="number" id="accBill" min="0" max="31" value="' + (S.billDay || 0) + '" placeholder="1-31"></div>' +
          '<div class="form-row"><div class="lab">还款日</div><input type="number" id="accRepay" min="0" max="31" value="' + (S.repayDay || 0) + '" placeholder="1-31"></div>'
          : "");
      sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="accSave">保存</button>';
      sh.body.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
        S.type = b.dataset.t;
        S.icon = ""; S.name = "";
        render();
      });
      sh.body.querySelectorAll("[data-icon]").forEach(b => b.onclick = () => {
        S.icon = b.dataset.icon;
        if (b.dataset.nm && !S.name) S.name = b.dataset.nm;
        render();
      });
      UI.$("#accSave", sh.foot).onclick = () => {
        const name = UI.$("#accName", sh.body).value.trim();
        if (!name) { UI.toast("请输入账户名称"); return; }
        const meta2 = Store.accountTypeMeta(S.type);
        const data = {
          type: S.type, name,
          icon: S.icon || meta2.icon, color: S.color || meta2.color,
          initial: parseFloat(UI.$("#accInit", sh.body).value) || 0,
          creditLimit: S.type === "credit" ? (parseFloat((UI.$("#accLimit", sh.body) || {}).value) || 0) : 0,
          billDay: S.type === "credit" ? (parseInt((UI.$("#accBill", sh.body) || {}).value) || 0) : 0,
          repayDay: S.type === "credit" ? (parseInt((UI.$("#accRepay", sh.body) || {}).value) || 0) : 0
        };
        let saved;
        if (editing) { Store.updateAccount(editAcc.id, data); saved = Store.account(editAcc.id); }
        else saved = Store.addAccount(data);
        sh.close(); UI.toast("已保存");
        App.refresh();
        cb && cb(saved);
      };
    };
    render();

    function presetsOf(type) {
      if (type === "virtual") return DATA.virtualPresets;
      if (type === "card") return DATA.cardPresets;
      if (type === "bank") return DATA.banks.slice(0, 8).map(b => ({ name: b, icon: "🏦" }));
      if (type === "cash") return [{ name: "现金", icon: "💰" }, { name: "零钱", icon: "🪙" }];
      if (type === "credit") return [{ name: "信用卡", icon: "💳" }];
      if (type === "invest") return [{ name: "基金", icon: "📊" }, { name: "股票", icon: "📈" }];
      return [{ name: "负债", icon: "⚠️" }];
    }
  },

  /* ---------- 转账 ---------- */
  transferSheet() {
    const sh = UI.sheet({ title: "账户转账" });
    const S = {
      from: Store.s.accounts[0]?.id,
      to: Store.s.accounts[1]?.id || Store.s.accounts[0]?.id,
      amount: "", date: fmt.now(), note: ""
    };
    const render = () => {
      sh.body.innerHTML =
        '<div class="jy-transfer-box">' +
          '<div class="row row-chips"><div class="lab">转出账户</div>' + ViewsAdd.accountChipsHTML("from", S.from) + "</div>" +
          '<div class="row row-chips"><div class="lab">转入账户</div>' + ViewsAdd.accountChipsHTML("to", S.to) + "</div>" +
          '<div class="row"><div class="lab">金额</div><input type="number" id="tfAmt" step="0.01" placeholder="0.00" value="' + S.amount + '" style="border:none;background:none;outline:none;text-align:right;font-size:16px;font-weight:700;width:100%"></div>' +
          '<div class="row" data-k="date"><div class="lab">时间</div><div class="val" id="tfDate">' + fmt.dayLabel(S.date.slice(0, 10)) + " " + fmt.timeLabel(S.date) + " " + UI.svg("arrow", 14) + "</div></div>" +
          '<div class="row"><div class="lab">备注</div><input type="text" id="tfNote" maxlength="40" placeholder="选填" value="' + UI.escape(S.note) + '" style="border:none;background:none;outline:none;text-align:right;width:100%"></div>' +
        "</div>";
      sh.body.querySelectorAll(".pick-chip[data-id]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        S[el.dataset.f] = el.dataset.id;
        render();
      });
      sh.body.querySelectorAll("[data-addchip]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        ViewsWallet.addAccountSheet(null, acc => { S[el.dataset.f] = acc.id; render(); });
      });
      sh.body.querySelector('[data-k="date"]').onclick = () => UI.datePicker(S.date, v => { S.date = v; render(); });
      UI.$("#tfAmt", sh.body).oninput = e => { S.amount = e.target.value; };
      UI.$("#tfNote", sh.body).oninput = e => { S.note = e.target.value; };
      ViewsAdd.centerChips(sh.body);
    };
    render();
    sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="tfSave">确认转账</button>';
    UI.$("#tfSave", sh.foot).onclick = () => {
      const amt = parseFloat(S.amount);
      if (!amt || amt <= 0) { UI.toast("请输入转账金额"); return; }
      if (!S.from || !S.to) { UI.toast("请选择账户"); return; }
      if (S.from === S.to) { UI.toast("转出与转入账户不能相同"); return; }
      Store.addRecord({
        type: "transfer", amount: Math.round(amt * 100) / 100, accountId: S.from, toAccountId: S.to,
        date: S.date, note: (S.note || "").trim(), member: "我"
      });
      sh.close(); UI.toast("转账成功");
      const rm = S.date.slice(0, 7);
      if (rm !== App.billMonth) App.billMonth = rm;
      App.refresh();
    };
  }
};

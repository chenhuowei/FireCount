/* ============================================================
 * 记一笔（add_new_record.xml + keyboard_number.xml 复刻）
 *   支出 / 收入 / 转账 三模式（jiyibi_btn_zhichu/shouru/zhuanzhang 证据）
 *   分类宫格分页 + 计算器键盘（仅 + −，与原 App 键盘一致）
 *   属性行：时间 / 账户 / 成员 / 备注 / 报销
 * ============================================================ */
"use strict";

const ViewsAdd = {
  /* ---------- 平铺横滑直选（替代底部弹层选择） ---------- */
  accountChipsHTML(field, selectedId) {
    const chips = Store.s.accounts.map(a =>
      '<button class="pick-chip' + (a.id === selectedId ? " active" : "") + '" data-f="' + field + '" data-id="' + a.id + '">' +
      '<span class="pc-ico" style="color:' + (a.color || Store.accountTypeMeta(a.type).color) + '">' + IconUI.raw(a, 15) + "</span>" + UI.escape(a.name) + "</button>"
    ).join("");
    return '<div class="chip-scroll">' + chips +
      '<button class="pick-chip add" data-f="' + field + '" data-addchip>＋</button></div>';
  },
  memberChipsHTML(selected) {
    return '<div class="chip-scroll">' + Store.s.settings.members.map(m =>
      '<button class="pick-chip' + (m === selected ? " active" : "") + '" data-member="' + UI.escape(m) + '">' + UI.escape(m) + "</button>"
    ).join("") + "</div>";
  },
  tagChipsHTML(selected) {
    return '<div class="chip-scroll">' + Store.tags().map(t =>
      '<button class="pick-chip' + (selected.includes(t) ? " active" : "") + '" data-tag="' + UI.escape(t) + '">#' + UI.escape(t) + "</button>"
    ).join("") +
      '<button class="pick-chip add" data-addtag>＋</button></div>';
  },
  /* 标签管理：新增 / 删除（删除同时从账单剥离），S 传入时自动勾选新增标签 */
  tagManagerSheet(S, onChange) {
    const sh = UI.sheet({ title: "标签管理" });
    const render = () => {
      const tags = Store.tags();
      sh.body.innerHTML =
        '<div class="form-row" style="border:none"><input type="text" id="tgNew" maxlength="8" placeholder="新标签名称（8 字以内）" style="text-align:left">' +
        '<button class="btn btn-primary" id="tgAdd" style="padding:8px 16px;flex:none">添加</button></div>' +
        (tags.length ? '<div class="card" style="margin-top:4px">' + tags.map(t =>
          '<div class="cell"><div class="cell-main"><div class="cell-title">#' + UI.escape(t) + "</div>" +
          '<div class="cell-desc">' + Store.tagUsage(t) + " 笔账单使用" + (S && S.tags && S.tags.includes(t) ? " · 本次已选" : "") + "</div></div>" +
          '<button class="txt-btn" data-deltag="' + UI.escape(t) + '" style="color:var(--danger)">删除</button></div>'
        ).join("") + "</div>"
          : '<div class="empty" style="padding:26px"><div class="t1">还没有标签</div></div>');
      UI.$("#tgAdd", sh.body).onclick = () => {
        const v = UI.$("#tgNew", sh.body).value.trim();
        if (!v) { UI.toast("请输入标签名称"); return; }
        if (!Store.addTag(v)) { UI.toast("标签已存在"); return; }
        if (S && S.tags && !S.tags.includes(v)) S.tags.push(v);
        UI.toast("已添加 #" + v);
        render(); onChange && onChange();
      };
      sh.body.querySelectorAll("[data-deltag]").forEach(b => b.onclick = () => {
        const t = b.dataset.deltag;
        const used = Store.tagUsage(t);
        UI.confirm({
          title: "删除标签",
          body: "将删除标签 #" + UI.escape(t) + (used ? "，并从 " + used + " 笔账单中移除该标记" : "") + "。",
          ok: "删除", danger: true
        }).then(ok => {
          if (!ok) return;
          Store.deleteTag(t);
          if (S && S.tags) S.tags = S.tags.filter(x => x !== t);
          UI.toast("已删除"); render(); onChange && onChange();
        });
      });
    };
    render();
  },
  /* 选中项自动滚动到可视区域中间 */
  centerChips(root) {
    UI.$$(".chip-scroll", root).forEach(w => {
      const act = w.querySelector(".pick-chip.active");
      if (act) w.scrollLeft = act.offsetLeft - w.clientWidth / 2 + act.offsetWidth / 2;
    });
  },

  /* 打开记一笔；传入 record 则为编辑模式 */
  open(record) {
    const editing = !!record;
    const S = {
      _id: editing ? record.id : null,
      mode: editing ? record.type : "expense",
      expr: editing ? String(record.amount) : "",
      categoryId: editing ? record.categoryId : "",
      accountId: editing ? record.accountId : (Store.s.accounts[0] || {}).id,
      toAccountId: editing ? record.toAccountId : (Store.s.accounts[1] || Store.s.accounts[0] || {}).id,
      date: editing ? record.date : fmt.now(),
      note: editing ? (record.note || "") : "",
      member: editing ? (record.member || "我") : (Store.s.settings.members[0] || "我"),
      tags: editing ? (record.tags || []).slice() : [],
      photos: editing ? (record.photos || []).slice() : [],
      editing
    };
    const sh = UI.sheet({
      title: editing ? "编辑账单" : "记一笔",
      right: UI.svg("scan", 20),
      onRight: close => { UI.toast("网页复刻版暂不支持扫码记账（QrcodeResultActivity）"); }
    });
    sh.sheet.style.maxHeight = "100%";
    sh.sheet.style.height = "100%";
    sh.sheet.style.borderRadius = "0";

    sh.body.innerHTML =
      '<div class="jy-mode-row" id="modeRow">' +
        '<button class="jy-mode" data-mode="expense">支出</button>' +
        '<button class="jy-mode" data-mode="income">收入</button>' +
        '<button class="jy-mode" data-mode="transfer">转账</button>' +
      "</div>" +
      '<div id="jyBody"></div>';
    sh.body.style.padding = "0 10px 6px";
    /* 计算器键盘固定在弹层底部（不随内容滚动，与原 App 一致） */
    const kb = document.createElement("div");
    kb.className = "jy-keyboard";
    kb.id = "jyKeys";
    kb.style.margin = "0 10px calc(10px + env(safe-area-inset-bottom))";
    sh.sheet.appendChild(kb);

    const body = UI.$("#jyBody", sh.body);
    const renderBody = () => {
      if (S.mode === "transfer") {
        body.innerHTML =
          '<div class="jy-transfer-box">' +
            '<div class="row row-chips"><div class="lab">转出账户</div>' + ViewsAdd.accountChipsHTML("accountId", S.accountId) + "</div>" +
            '<div class="row row-chips"><div class="lab">转入账户</div>' + ViewsAdd.accountChipsHTML("toAccountId", S.toAccountId) + "</div>" +
          "</div>" + amountZoneHTML();
      } else {
        const cats = Store.categories(S.mode);
        const chosen = Store.category(S.categoryId) || cats[0];
        if (!S.categoryId && chosen) S.categoryId = chosen.id;
        // 全量平铺宫格（不分页，可换行滚动）
        const catHTML =
          '<div class="jy-grid-page jy-grid-full">' + cats.map(c =>
            '<div class="jy-cat' + (c.id === S.categoryId ? " selected" : "") + '" data-cid="' + c.id + '">' +
            '<div class="ci" style="background:' + c.color + '22;color:' + c.color + '">' + IconUI.raw(c, 24) + "</div>" +
            '<div class="cn">' + UI.escape(c.name) + "</div></div>"
          ).join("") +
          '<div class="jy-cat" data-addcat><div class="ci" style="background:var(--chip);color:var(--brand)">＋</div><div class="cn">添加</div></div>' +
          "</div>";
        const acc = Store.account(S.accountId);
        // 计算器上方单行快捷条：月日 / 现金 / 我 / 标签+ / 附件+ / 备注+
        const quickBar =
          '<div class="jy-quickbar">' +
            '<button class="qb" data-qb="date">' + UI.svg("calendar", 14) + '<span id="qbDate">' + fmt.monthDay(S.date.slice(0, 10)) + '</span></button>' +
            (S.mode === "transfer" ? "" :
              '<button class="qb" data-qb="acc"><span>' + UI.escape((Store.account(S.accountId) || { name: "现金" }).name) + '</span></button>') +
            (S.mode === "transfer" ? "" :
              '<button class="qb" data-qb="member"><span>' + UI.escape(S.member || "我") + '</span></button>') +
            '<button class="qb" data-qb="tag" title="标签">' + UI.svg("tag", 16) + (S.tags.length ? '<i class="qb-badge">' + S.tags.length + '</i>' : '') + '</button>' +
            '<button class="qb" data-qb="photo" title="附件">' + UI.svg("photo", 16) + (S.photos.length ? '<i class="qb-badge">' + S.photos.length + '</i>' : '') + '</button>' +
            '<button class="qb" data-qb="note" title="备注">' + UI.svg("edit", 16) + (S.note ? '<i class="qb-dot"></i>' : '') + '</button>' +
          "</div>";
        body.innerHTML =
          '<div class="jy-amount-zone">' +
            '<div class="jy-cat-chosen">' +
              '<div class="ci" style="background:' + (chosen ? chosen.color : "#ccc") + '22;color:' + (chosen ? chosen.color : "#999") + '">' + (chosen ? IconUI.raw(chosen, 26) : "?") + "</div>" +
              '<div class="cn">' + (chosen ? UI.escape(chosen.name) : "请选择分类") + "</div>" +
            "</div>" + amountZoneHTML() +
          "</div>" +
          '<div class="jy-grid-wrap"><div class="jy-grid-pages" id="jyPages">' + catHTML + "</div></div>" +
          quickBar;
        body.querySelectorAll(".jy-cat[data-cid]").forEach(el => {
          el.onclick = () => { S.categoryId = el.dataset.cid; renderBody(); };
          // 长按：排序模式（拖动换位）或弹出操作（编辑/移除）
          let lpTimer = null, lpFired = false;
          const startLP = () => { lpFired = false; lpTimer = setTimeout(() => { lpFired = true; ViewsAdd.catLongPress(el.dataset.cid, () => renderBody()); }, 450); };
          el.addEventListener("touchstart", startLP, { passive: true });
          el.addEventListener("touchend", () => clearTimeout(lpTimer), { passive: true });
          el.addEventListener("touchmove", () => clearTimeout(lpTimer), { passive: true });
          el.addEventListener("touchcancel", () => clearTimeout(lpTimer));
          // 桌面预览：右键等同长按
          el.addEventListener("contextmenu", e => { e.preventDefault(); ViewsAdd.catLongPress(el.dataset.cid, () => renderBody()); });
        });
        const addBtn = body.querySelector("[data-addcat]");
        if (addBtn) addBtn.onclick = () => ViewsAdd.categoryEditor(null, c => { S.categoryId = c.id; renderBody(); });
        // 快捷条：月日/现金/我/标签+/附件+/备注+
        body.querySelectorAll(".qb[data-qb]").forEach(b => b.onclick = e => {
          e.stopPropagation();
          const k = b.dataset.qb;
          if (k === "date") UI.datePicker(S.date, v => { S.date = v; renderBody(); });
          else if (k === "acc") ViewsAdd.pickAccount("accountId", S, () => renderBody());
          else if (k === "member") {
            // 成员轮换选择（单选，点一下换下一位）
            const members = (Store.s.settings.members || []).filter(Boolean);
            if (!members.length) { UI.toast("请先在「我的 → 成员管理」添加成员"); return; }
            const idx = members.indexOf(S.member || "我");
            S.member = members[(idx + 1) % members.length];
            renderBody();
          }
          else if (k === "tag") ViewsAdd.tagManagerSheet(S, () => renderBody());
          else if (k === "photo") ViewsAdd.photoSheet(S, () => renderBody());
          else if (k === "note") ViewsAdd.noteSheet(S, () => renderBody());
        });
      }
      /* 隐藏附件 input（快捷条触发） */
      const attrs = document.createElement("div");
      attrs.style.display = "none";
      attrs.innerHTML = '<input type="file" id="jyPhotoFile" accept="image/*" multiple style="display:none">';
      body.appendChild(attrs);

      body.querySelectorAll(".pick-chip[data-id]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        S[el.dataset.f] = el.dataset.id;
        renderBody();
      });
      body.querySelectorAll(".pick-chip[data-member]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        S.member = el.dataset.member;
        renderBody();
      });
      body.querySelectorAll(".pick-chip[data-tag]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        const t = el.dataset.tag, i = S.tags.indexOf(t);
        if (i >= 0) S.tags.splice(i, 1); else S.tags.push(t);
        renderBody();
      });
      body.querySelectorAll("[data-addchip]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        const f = el.dataset.f;
        ViewsWallet.addAccountSheet(null, acc => { S[f] = acc.id; renderBody(); });
      });
      body.querySelectorAll("[data-addtag]").forEach(el => el.onclick = e => {
        e.stopPropagation();
        ViewsAdd.tagManagerSheet(S, () => renderBody());
      });
      /* 附件：快捷条触发选图（自动压缩），已有照片时点开管理弹层 */
      const photoInput = body.querySelector("#jyPhotoFile");
      if (photoInput) photoInput.onchange = async e => {
        const files = [...e.target.files].slice(0, 3 - S.photos.length);
        e.target.value = "";
        for (const f of files) {
          try { S.photos.push(await UI.compressImage(f)); }
          catch (err) { UI.toast(err.message || "图片处理失败"); }
        }
        renderBody();
      };
      const curBtn = body.querySelector("#curBtn");
      if (curBtn) curBtn.onclick = () => ViewsMine.currencySheet(() => renderBody());
      ViewsAdd.centerChips(body);
      renderKeys();
    };

    function amountZoneHTML() {
      const v = ViewsAdd.evalExpr(S.expr);
      const hasOp = /[+\-]/.test(S.expr.slice(1));
      return (
        '<div class="jy-amount-row">' +
        '<button class="jy-currency" id="curBtn">' + Store.s.settings.currency + "</button>" +
        '<div class="jy-amount' + (hasOp ? " has-op" : "") + '" id="amtShow">' + (v == null ? "0.00" : fmt.money(v)) + "</div></div>" +
        '<div class="jy-formula" id="amtFormula">' + (hasOp ? S.expr + " = " + fmt.money(v) : "") + "</div>"
      );
    }

    /* 键盘输入只刷新金额区（不重建面板，避免手机端打字卡顿） */
    const patchAmount = () => {
      const amtEl = sh.sheet.querySelector(".jy-amount");
      const fxEl = sh.sheet.querySelector("#amtFormula");
      const okKey = sh.sheet.querySelector('.jy-key[data-k="ok"]');
      const v = ViewsAdd.evalExpr(S.expr);
      const hasOp = /[+\-]/.test(S.expr.slice(1));
      if (amtEl) {
        amtEl.textContent = v == null ? "0.00" : fmt.money(v);
        amtEl.classList.toggle("has-op", hasOp);
      }
      if (fxEl) fxEl.textContent = hasOp ? S.expr + " = " + fmt.money(v) : "";
      if (okKey) okKey.classList.toggle("disabled", !ViewsAdd.canSave(S));
    };

    const KEYS = [
      { k: "7" }, { k: "8" }, { k: "9" }, { k: "del", cls: "func", icon: "del" },
      { k: "4" }, { k: "5" }, { k: "6" }, { k: "+", cls: "op" },
      { k: "1" }, { k: "2" }, { k: "3" }, { k: "-", cls: "op" },
      { k: "C", cls: "func" }, { k: "0" }, { k: "." }, { k: "ok", cls: "ok" }
    ];
    const renderKeys = () => {
      const host = UI.$("#jyKeys", sh.sheet);
      if (!host) return;
      host.innerHTML = KEYS.map(k => {
        const inner = k.icon ? UI.svg(k.icon, 20) : k.k === "ok" ? "OK" : k.k;
        const dis = k.k === "ok" && !ViewsAdd.canSave(S) ? " disabled" : "";
        return '<button class="jy-key ' + (k.cls || "") + dis + '" data-k="' + k.k + '">' + inner + "</button>";
      }).join("");
      host.querySelectorAll(".jy-key").forEach(b => b.onclick = () => ViewsAdd.key(S, b.dataset.k, patchAmount));
    };

    /* 模式切换 */
    UI.$$("#modeRow .jy-mode", sh.body).forEach(b => b.onclick = () => {
      if (S.mode === b.dataset.mode) return;
      S.mode = b.dataset.mode;
      if (S.mode !== "transfer") {
        const ok = Store.categories(S.mode).some(c => c.id === S.categoryId);
        if (!ok) S.categoryId = Store.categories(S.mode)[0]?.id || "";
      }
      renderBody();
    });

    /* 物理键盘支持 */
    const onKey = e => {
      if (e.target.tagName === "INPUT") return;
      const map = { Enter: "ok", Backspace: "del", Escape: "close", "+": "+", "-": "-", ".": ".", C: "C", c: "C" };
      if (/^[0-9]$/.test(e.key)) { ViewsAdd.key(S, e.key, patchAmount); e.preventDefault(); }
      else if (map[e.key]) {
        e.preventDefault();
        if (map[e.key] === "close") { sh.close(); return; }
        ViewsAdd.key(S, map[e.key], patchAmount);
      }
    };
    document.addEventListener("keydown", onKey);
    const origClose = sh.close.bind(sh);
    sh.close = () => { document.removeEventListener("keydown", onKey); origClose(); };

    renderBody();
  },

  /* 键盘输入处理 */
  key(S, k, rerender) {
    if (k === "ok") {
      if (ViewsAdd.canSave(S)) ViewsAdd.save(S);
      return;
    }
    if (k === "del") { S.expr = S.expr.slice(0, -1); rerender(); return; }
    if (k === "C") { S.expr = ""; rerender(); return; }
    if (k === "+" || k === "-") {
      if (!S.expr) S.expr = "0" + k;
      else if (/[+\-]$/.test(S.expr)) S.expr = S.expr.slice(0, -1) + k;
      else S.expr += k;
      rerender(); return;
    }
    if (k === ".") {
      const last = S.expr.split(/[+\-]/).pop();
      if (last.includes(".")) return;
      S.expr = S.expr === "" || /[+\-]$/.test(S.expr) ? S.expr + "0." : S.expr + ".";
      rerender(); return;
    }
    // 数字
    if (S.expr.length >= 24) return;
    const last = S.expr.split(/[+\-]/).pop();
    if (/^0$/.test(last) && k !== ".") {
      S.expr = S.expr.slice(0, -1) + k; // 0 开头替换
    } else if (/^\d+\.\d{2}$/.test(last)) {
      return; // 两位小数
    } else S.expr += k;
    rerender();
  },

  evalExpr(expr) {
    if (!expr) return null;
    if (!/[+\-]/.test(expr.slice(1))) return parseFloat(expr) || null;
    const toks = expr.match(/\d+\.?\d*|[+\-]/g);
    if (!toks) return null;
    let acc = parseFloat(toks[0]);
    for (let i = 1; i < toks.length; i += 2) {
      const v = parseFloat(toks[i + 1]);
      if (isNaN(v)) break;
      acc = toks[i] === "+" ? acc + v : acc - v;
    }
    return Math.round(acc * 100) / 100;
  },

  canSave(S) {
    const amt = ViewsAdd.evalExpr(S.expr);
    if (!amt || amt <= 0) return false;
    if (S.mode === "transfer") return !!S.accountId && !!S.toAccountId && S.accountId !== S.toAccountId;
    return !!S.categoryId && !!S.accountId;
  },

  save(S) {
    const amt = ViewsAdd.evalExpr(S.expr);
    const data = {
      type: S.mode, amount: amt,
      categoryId: S.mode === "transfer" ? "" : S.categoryId,
      accountId: S.accountId, toAccountId: S.mode === "transfer" ? S.toAccountId : "",
      date: S.date, note: S.note.trim(), member: S.member, tags: S.tags.slice(), photos: S.photos.slice()
    };
    if (S._id) Store.updateRecord(S._id, data);
    else Store.addRecord(data);
    UI.closeSheet();
    UI.toast(S.editing ? "已保存修改" : "记账成功");
    // 若记录月份与当前查看月份不同，自动跳转
    const rm = data.date.slice(0, 7);
    if (rm !== App.viewMonth) App.viewMonth = rm;
    App.refresh();
  },

  pickAccount(field, S, cb) {
    const sh = UI.sheet({ title: "选择账户" });
    sh.body.innerHTML = Store.s.accounts.map(a =>
      '<div class="cell" data-id="' + a.id + '">' + UI.accIcon(a, "cell-icon") +
      '<div class="cell-main"><div class="cell-title">' + UI.escape(a.name) + "</div>" +
      '<div class="cell-desc">' + Store.accountTypeMeta(a.type).name + "</div></div>" +
      (S[field] === a.id ? '<span style="color:var(--brand)">✓</span>' : UI.svg("arrow", 15)) + "</div>"
    ).join("") +
    '<div class="cell" data-add><div class="cell-icon" style="color:var(--brand)">＋</div><div class="cell-main"><div class="cell-title" style="color:var(--brand)">新建账户</div></div></div>';
    UI.$$(".cell", sh.body).forEach(c => c.onclick = () => {
      if (c.dataset.add) { sh.close(); App.go("wallet"); ViewsWallet.addAccountSheet(); return; }
      S[field] = c.dataset.id; sh.close(); cb && cb();
    });
  },

  /* 分类编辑器（新建 / 编辑自定义分类） */
  /* 备注编辑弹层 */
  /* 附件管理：缩略图预览 / 删除 / 新增（最多 3 张） */
  photoSheet(S, onChange) {
    const sh = UI.sheet({ title: "账单附件" });
    const render = () => {
      sh.body.innerHTML =
        (S.photos.length
          ? '<div class="pa-grid">' + S.photos.map((p, i) =>
              '<div class="pa-item"><img src="' + p + '" data-view="' + i + '" alt="附件' + (i + 1) + '">' +
              '<button class="pa-del" data-del="' + i + '">✕</button></div>').join("") + "</div>"
          : '<div class="empty" style="padding:20px 0"><div class="big">📎</div><div class="t1">还没有附件</div></div>') +
        '<div class="sec-title">最多 3 张，图片自动压缩至 ~720px 存储</div>';
      sh.body.querySelectorAll("[data-view]").forEach(img => img.onclick = () => UI.viewPhoto(img.src));
      sh.body.querySelectorAll("[data-del]").forEach(b => b.onclick = e => {
        e.stopPropagation();
        S.photos.splice(+b.dataset.del, 1);
        render(); onChange && onChange();
      });
    };
    render();
    sh.foot.innerHTML = S.photos.length < 3
      ? '<button class="btn btn-primary btn-block" id="paAdd">＋ 添加图片</button>'
      : '<button class="btn btn-ghost btn-block" disabled>已达上限 3 张</button>';
    const add = UI.$("#paAdd", sh.foot);
    if (add) add.onclick = () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
      inp.onchange = async e => {
        const files = [...e.target.files].slice(0, 3 - S.photos.length);
        for (const f of files) {
          try { S.photos.push(await UI.compressImage(f)); }
          catch (err) { UI.toast(err.message || "图片处理失败"); }
        }
        render();
        sh.foot.innerHTML = S.photos.length < 3
          ? '<button class="btn btn-primary btn-block" id="paAdd">＋ 添加图片</button>'
          : '<button class="btn btn-ghost btn-block" disabled>已达上限 3 张</button>';
        const a2 = UI.$("#paAdd", sh.foot);
        if (a2) a2.onclick = add.onclick;
        onChange && onChange();
      };
      inp.click();
    };
  },

  noteSheet(S, onChange) {
    const sh = UI.sheet({ title: "备注" });
    sh.body.innerHTML =
      '<div style="padding:4px 2px 10px"><input type="text" id="nsInput" maxlength="60" placeholder="点击填写备注" value="' + UI.escape(S.note) + '" style="width:100%;border:none;background:var(--chip);border-radius:10px;padding:12px;font-size:15px;outline:none"></div>';
    sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="nsOk">确定</button>';
    setTimeout(() => { const i = UI.$("#nsInput", sh.body); if (i) i.focus(); }, 80);
    const save = () => {
      S.note = UI.$("#nsInput", sh.body).value.trim();
      sh.close(); onChange && onChange();
    };
    UI.$("#nsOk", sh.foot).onclick = save;
    UI.$("#nsInput", sh.body).addEventListener("keydown", e => { if (e.key === "Enter") save(); });
  },

  /* 分类长按菜单：编辑 / 移除（仅自定义分类可移除） */
  catLongPress(cid, refresh) {
    const c = Store.category(cid);
    if (!c) return;
    const sh = UI.sheet({ title: c.name });
    sh.body.innerHTML =
      '<div class="cell" id="lpEdit"><div class="cell-icon">✏️</div><div class="cell-main"><div class="cell-title">编辑分类</div></div>' + UI.svg("arrow", 15) + '</div>' +
      '<div class="cell" id="lpSort"><div class="cell-icon">↕️</div><div class="cell-main"><div class="cell-title">拖动排序</div><div class="cell-desc">进入排序模式，长按图标上下拖动换位</div></div></div>' +
      (c.custom
        ? '<div class="cell" id="lpDel"><div class="cell-icon">🗑️</div><div class="cell-main"><div class="cell-title" style="color:var(--danger)">移除分类</div><div class="cell-desc">仅可移除自定义分类，不影响已记账单</div></div></div>'
        : '<div class="sec-title">内置分类不可移除</div>');
    UI.$("#lpEdit", sh.body).onclick = () => { sh.close(); ViewsAdd.categoryEditor(c, refresh); };
    UI.$("#lpSort", sh.body).onclick = () => { sh.close(); ViewsAdd.catSortMode(c.type, refresh); };
    const del = UI.$("#lpDel", sh.body);
    if (del) del.onclick = () => {
      sh.close();
      UI.confirm({ title: "移除分类", body: "移除「" + UI.escape(c.name) + "」？已记账单会保留并归入未分类。", ok: "移除", danger: true }).then(ok => {
        if (!ok) return;
        if (Store.deleteCategory(c.id)) { UI.toast("已移除"); refresh && refresh(); }
        else UI.toast("该分类下仍有账单，无法移除");
      });
    };
  },

  /* 分类排序模式：长按图标拖动换位，实时保存 order */
  catSortMode(type, refresh) {
    const sh = UI.sheet({ title: "拖动排序 · " + (type === "expense" ? "支出" : "收入") + "分类" });
    const cats = Store.categories(type);
    sh.body.innerHTML =
      '<div class="sec-title">长按任意分类图标拖动到目标位置，松手即保存</div>' +
      '<div id="sortList" style="display:flex;flex-direction:column;gap:6px;padding:4px 0 10px">' +
        cats.map((c, i) =>
          '<div class="sort-item" draggable="true" data-cid="' + c.id + '">' +
          '<span class="si-idx">' + (i + 1) + '</span>' +
          '<span class="si-ico" style="background:' + c.color + '22;color:' + c.color + '">' + IconUI.raw(c, 20) + '</span>' +
          '<span class="si-nm">' + UI.escape(c.name) + '</span>' +
          '<span class="si-grip">☰</span></div>').join("") +
      '</div>';
    // 拖拽排序（HTML5 DnD，桌面可靠；移动端用长按+touch 模拟由 CSS touch-action 支持）
    const list = UI.$("#sortList", sh.body);
    let dragEl = null;
    list.querySelectorAll(".sort-item").forEach(el => {
      el.addEventListener("dragstart", () => { dragEl = el; el.classList.add("dragging"); });
      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        // 保存新顺序
        const ids = [...list.querySelectorAll(".sort-item")].map(x => x.dataset.cid);
        ids.forEach((id, i) => Store.updateCategory(id, { order: i }));
        UI.toast("排序已保存");
        refresh && refresh();
      });
      el.addEventListener("dragover", e => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        if (!dragEl || dragEl === el) return;
        const after = (e.clientY - rect.top) > rect.height / 2;
        if (after) el.after(dragEl); else el.before(dragEl);
      });
      // 移动端触摸拖拽
      let ty = 0, dragging = false;
      el.addEventListener("touchstart", e => { ty = e.touches[0].clientY; dragging = false; }, { passive: true });
      el.addEventListener("touchmove", e => {
        const dy = e.touches[0].clientY - ty;
        if (!dragging && Math.abs(dy) > 14) { dragging = true; dragEl = el; el.classList.add("dragging"); e.preventDefault(); }
        if (dragging) {
          e.preventDefault();
          const over = [...list.querySelectorAll(".sort-item")].find(x => {
            if (x === el) return false;
            const r = x.getBoundingClientRect();
            return e.touches[0].clientY >= r.top && e.touches[0].clientY <= r.bottom;
          });
          if (over) { const r = over.getBoundingClientRect(); (e.touches[0].clientY > r.top + r.height / 2) ? over.after(el) : over.before(el); }
        }
      }, { passive: false });
      el.addEventListener("touchend", () => {
        if (dragging) {
          dragging = false; el.classList.remove("dragging");
          const ids = [...list.querySelectorAll(".sort-item")].map(x => x.dataset.cid);
          ids.forEach((id, i) => Store.updateCategory(id, { order: i }));
          UI.toast("排序已保存");
          refresh && refresh();
        }
      });
    });
  },

  categoryEditor(cat, cb) {
    const isNew = !cat;
    const sh = UI.sheet({ title: isNew ? "添加分类" : "编辑分类" });
    const S = { icon: cat ? cat.icon : "svg:" + (DATA.iconChoices[0] || "canyin"), color: cat ? cat.color : DATA.colorChoices[0], type: cat ? cat.type : "expense" };
    sh.body.innerHTML =
      (isNew ? '<div class="seg" id="catTypeSeg" style="margin-bottom:6px"><button data-t="expense" class="active">支出分类</button><button data-t="income">收入分类</button></div>' : "") +
      '<div class="form-row"><div class="lab">名称</div><input type="text" id="catName" maxlength="6" placeholder="最多 6 个字" value="' + (cat ? UI.escape(cat.name) : "") + '"></div>' +
      '<div class="form-row" style="flex-direction:column;align-items:stretch"><div class="lab" style="width:auto">图标</div>' +
      '<div class="emoji-grid" id="iconGrid" style="margin-top:6px">' +
        DATA.iconChoices.map(k => '<button data-e="svg:' + k + '" data-icon="1" class="' + (S.icon === "svg:" + k ? "active" : "") + '" style="color:' + S.color + '">' + IconUI.svg(k, 21) + "</button>").join("") +
        DATA.emojiChoices.slice(0, 18).map(e => '<button data-e="' + e + '" class="' + (e === S.icon ? "active" : "") + '">' + e + "</button>").join("") +
      "</div></div>" +
      '<div class="form-row" style="flex-direction:column;align-items:stretch"><div class="lab" style="width:auto">颜色</div>' +
      '<div class="color-row" id="colorRow" style="margin-top:6px">' + DATA.colorChoices.map(c => '<i data-c="' + c + '" style="background:' + c + '" class="' + (c === S.color ? "active" : "") + "'></i>").join("") + "</div></div>";
    sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="catSave">保存</button>';
    if (isNew) {
      sh.body.querySelectorAll("#catTypeSeg button").forEach(b => b.onclick = () => {
        S.type = b.dataset.t;
        sh.body.querySelectorAll("#catTypeSeg button").forEach(x => x.classList.toggle("active", x === b));
      });
    }
    sh.body.querySelectorAll("#iconGrid button").forEach(b => b.onclick = () => {
      S.icon = b.dataset.e;
      sh.body.querySelectorAll("#iconGrid button").forEach(x => x.classList.toggle("active", x === b));
    });
    sh.body.querySelectorAll("#colorRow i").forEach(el => el.onclick = () => {
      S.color = el.dataset.c;
      sh.body.querySelectorAll("#colorRow i").forEach(x => x.classList.toggle("active", x === el));
    });
    UI.$("#catSave", sh.foot).onclick = () => {
      const name = UI.$("#catName", sh.body).value.trim();
      if (!name) { UI.toast("请输入分类名称"); return; }
      let c;
      if (isNew) c = Store.addCategory(S.type, name, S.icon, S.color);
      else { Store.updateCategory(cat.id, { name, icon: S.icon, color: S.color }); c = Store.category(cat.id); }
      sh.close(); UI.toast("已保存");
      cb && cb(c);
    };
  }
};

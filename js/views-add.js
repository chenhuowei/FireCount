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
        const PER = 8, pages = [];
        for (let i = 0; i < cats.length; i += PER) pages.push(cats.slice(i, i + PER));
        const catHTML = pages.map((pg, pi) =>
          '<div class="jy-grid-page">' + pg.map(c =>
            '<div class="jy-cat' + (c.id === S.categoryId ? " selected" : "") + '" data-cid="' + c.id + '">' +
            '<div class="ci" style="background:' + c.color + '22;color:' + c.color + '">' + IconUI.raw(c, 24) + "</div>" +
            '<div class="cn">' + UI.escape(c.name) + "</div></div>"
          ).join("") +
          (pi === pages.length - 1 ? '<div class="jy-cat" data-addcat><div class="ci" style="background:var(--chip);color:var(--brand)">＋</div><div class="cn">添加</div></div>' : "") +
          "</div>"
        ).join("");
        const acc = Store.account(S.accountId);
        body.innerHTML =
          '<div class="jy-amount-zone">' +
            '<div class="jy-cat-chosen">' +
              '<div class="ci" style="background:' + (chosen ? chosen.color : "#ccc") + '22;color:' + (chosen ? chosen.color : "#999") + '">' + (chosen ? IconUI.raw(chosen, 26) : "?") + "</div>" +
              '<div class="cn">' + (chosen ? UI.escape(chosen.name) : "请选择分类") + "</div>" +
            "</div>" + amountZoneHTML() +
          "</div>" +
          '<div class="jy-grid-wrap"><div class="jy-grid-pages" id="jyPages">' + catHTML + "</div>" +
          '<div class="jy-dots" id="jyDots">' + pages.map((_, i) => "<i class='" + (i === 0 ? "on" : "") + "'></i>").join("") + "</div></div>";
        body.querySelectorAll(".jy-cat[data-cid]").forEach(el => el.onclick = () => {
          S.categoryId = el.dataset.cid; renderBody();
        });
        const addBtn = body.querySelector("[data-addcat]");
        if (addBtn) addBtn.onclick = () => ViewsAdd.categoryEditor(null, c => { S.categoryId = c.id; renderBody(); });
        const pager = body.querySelector("#jyPages"), dots = body.querySelectorAll("#jyDots i");
        pager.addEventListener("scroll", () => {
          const idx = Math.round(pager.scrollLeft / pager.clientWidth);
          dots.forEach((d, i) => d.classList.toggle("on", i === idx));
        }, { passive: true });
      }
      /* 属性行（时间/备注）+ 平铺直选（账户/成员/标签） */
      const attrs = document.createElement("div");
      attrs.className = "jy-attrs";
      attrs.innerHTML =
        '<div class="jy-attr" data-a="date"><div class="lab">时间</div><div class="val">' + fmt.dayLabel(S.date.slice(0, 10)) + " " + fmt.timeLabel(S.date) + "</div></div>" +
        (S.mode === "transfer" ? "" :
          '<div class="jy-attr jy-attr-chips"><div class="lab">账户</div>' + ViewsAdd.accountChipsHTML("accountId", S.accountId) + "</div>") +
        (S.mode === "transfer" ? "" :
          '<div class="jy-attr jy-attr-chips"><div class="lab">成员</div>' + ViewsAdd.memberChipsHTML(S.member) + "</div>") +
        '<div class="jy-attr jy-attr-chips"><div class="lab">标签</div>' + ViewsAdd.tagChipsHTML(S.tags) + "</div>" +
        '<div class="jy-attr" style="align-items:center"><div class="lab">附件</div><div class="photo-row">' +
          S.photos.map((p, i) =>
            '<div class="photo-thumb"><img src="' + p + '" onclick="event.stopPropagation();A.viewPhoto(this.src)">' +
            '<button class="ph-del" data-delphoto="' + i + '">✕</button></div>').join("") +
          (S.photos.length < 3 ? '<button class="photo-add" data-addphoto title="添加图片附件">＋</button>' : "") +
        "</div>" +
        '<input type="file" id="jyPhotoFile" accept="image/*" multiple style="display:none"></div>' +
        '<div class="jy-attr" style="padding:4px 14px"><div class="lab">备注</div>' +
        '<input type="text" id="jyNote" placeholder="点击填写备注" value="' + UI.escape(S.note) + '" maxlength="60"></div>';
      body.appendChild(attrs);
      /* 平铺直选：账户 / 成员 / 标签 点击即选中，＋ 快速新建 */
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
      /* 附件：＋ 选图（自动压缩）、✕ 删除 */
      const addPhotoBtn = body.querySelector("[data-addphoto]");
      const photoInput = body.querySelector("#jyPhotoFile");
      if (addPhotoBtn) addPhotoBtn.onclick = e => { e.stopPropagation(); photoInput.click(); };
      if (photoInput) photoInput.onchange = async e => {
        const files = [...e.target.files].slice(0, 3 - S.photos.length);
        e.target.value = "";
        for (const f of files) {
          try { S.photos.push(await UI.compressImage(f)); }
          catch (err) { UI.toast(err.message || "图片处理失败"); }
        }
        renderBody();
      };
      body.querySelectorAll("[data-delphoto]").forEach(b => b.onclick = e => {
        e.stopPropagation();
        S.photos.splice(+b.dataset.delphoto, 1);
        renderBody();
      });
      attrs.querySelectorAll(".jy-attr").forEach(el => el.onclick = e => {
        if (e.target.id === "jyNote") return;
        const a = el.dataset.a;
        if (a === "date") {
          UI.datePicker(S.date, v => { S.date = v; renderBody(); });
        }
      });
      const noteEl = body.querySelector("#jyNote");
      if (noteEl) noteEl.oninput = () => { S.note = noteEl.value; };
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

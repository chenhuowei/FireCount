/* ============================================================
 * UI 基础组件：toast / 确认框 / 底部弹层 / SVG 图标 / 工具
 * ============================================================ */
"use strict";

const UI = {
  $(sel, root) { return (root || document).querySelector(sel); },
  $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; },

  svg(name, size) {
    const p = {
      back: '<path d="M15 4l-8 8 8 8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      left: '<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      right: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      list: '<path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      pie: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 3.5a8.5 8.5 0 018.3 6.6L12 12z" fill="currentColor"/>',
      wallet: '<rect x="3" y="6" width="18" height="14" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 10h18" stroke="currentColor" stroke-width="0"/><circle cx="16.5" cy="13" r="1.6" fill="currentColor"/><path d="M6 6V5a2 2 0 012-2.6h9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      user: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4.5 20.5c1.2-3.5 4-5.5 7.5-5.5s6.3 2 7.5 5.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
      scan: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      del: '<path d="M9 3h6M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1M5 6h14M8 6l1 14h6l1-14" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      edit: '<path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="1.8"/>',
      arrow: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      down: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      more: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
      book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M8 7h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      budget: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 1.9-2.5.9-2.5 1.9 1 1.8 2.5 1.8 2.5-.7 2.5-1.7" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
      cycle: '<path d="M20 12a8 8 0 11-2.3-5.6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 3v4h-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      export: '<path d="M12 15V4M8 8l4-4 4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      import: '<path d="M12 4v11M8 11l4 4 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
      tag: '<path d="M4 4h7l9 9-7 7-9-9V4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/>',
      theme: '<path d="M12 3a9 9 0 109 9c-5 1.5-10.5-4-9-9z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
      trash: '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6.5 7l1 13h9l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      chart: '<path d="M4 20V10M10 20V4M16 20v-8M21 20H3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      info: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/>',
      swap: '<path d="M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      lock: '<rect x="5" y="11" width="14" height="9" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor"/>',
      cloud: '<path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118.2 9.6 4 4 0 0117.5 18H7z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
      eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>',
      "eye-off": '<path d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.9 5.9A9.5 9.5 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3.2 4M6.6 8A16 16 0 002.5 12S6 18.5 12 18.5a9 9 0 004.3-1.1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M9.9 9.9a3 3 0 004.2 4.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    }[name] || "";
    return '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '">' + p + "</svg>";
  },

  catIcon(cat, cls) {
    if (!cat) return '<div class="bi-icon" style="background:#94A3B822">❓</div>';
    return IconUI.catIcon(cat, cls);
  },
  accIcon(acc, cls) {
    if (!acc) return "";
    const m = Store.accountTypeMeta(acc.type);
    const bg = acc.color || m.color;
    const icon = acc.icon || m.icon;
    const mSvg = /^svg:(\w+)$/.exec(icon);
    if (mSvg && IconUI.has(mSvg[1]))
      return '<div class="' + (cls || "bi-icon") + '" style="background:' + bg + '22;color:' + bg + '">' + IconUI.svg(mSvg[1], 20) + "</div>";
    return '<div class="' + (cls || "bi-icon") + '" style="background:' + bg + '22">' + icon + "</div>";
  },

  /* ---------- Toast ---------- */
  toast(msg, ms) {
    const host = UI.$("#toastHost");
    host.innerHTML = '<div class="toast">' + String(msg).replace(/</g, "&lt;") + "</div>";
    const t = host.firstChild;
    setTimeout(() => { t.classList.add("out"); setTimeout(() => { if (t.parentNode) t.remove(); }, 260); }, ms || 1800);
  },

  /* ---------- 确认框 ---------- */
  confirm(opts) {
    return new Promise(resolve => {
      const host = UI.$("#modalHost");
      host.innerHTML =
        '<div class="modal-mask"></div><div class="modal-wrap"><div class="modal">' +
        '<div class="m-title">' + opts.title + "</div>" +
        '<div class="m-body">' + (opts.body || "") + "</div>" +
        '<div class="m-btns">' +
        '<button class="btn btn-ghost" data-r="0">' + (opts.cancel || "取消") + "</button>" +
        '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-r="1">' + (opts.ok || "确定") + "</button>" +
        "</div></div></div>";
      const wrap = host.querySelector(".modal-wrap"), mask = host.querySelector(".modal-mask"), modal = host.querySelector(".modal");
      requestAnimationFrame(() => { mask.style.opacity = 1; modal.classList.add("on"); });
      const done = v => {
        mask.style.opacity = 0; modal.classList.remove("on");
        resolve(v); // 立即返回结果，避免定时器被节流时延迟业务回调
        setTimeout(() => { host.innerHTML = ""; }, 200);
      };
      modal.addEventListener("click", e => {
        const b = e.target.closest("[data-r]");
        if (b) done(b.dataset.r === "1");
      });
      mask.addEventListener("click", () => done(false));
    });
  },

  /* ---------- 底部弹层（支持堆叠：记一笔之上再开分类/账户选择器） ---------- */
  _sheets: [],
  sheet(opts) {
    const host = UI.$("#sheetHost");
    const node = document.createElement("div");
    node.innerHTML =
      '<div class="sheet-mask"></div><div class="sheet-wrap"><div class="sheet">' +
      '<div class="sheet-head">' +
      '<button class="hd-btn" data-close>' + (opts.closeIcon === false ? "" : UI.svg("back")) + "</button>" +
      '<div class="sheet-title">' + (opts.title || "") + "</div>" +
      '<button class="hd-btn" data-close2>' + (opts.right || "") + "</button>" +
      "</div>" +
      '<div class="sheet-body"></div>' +
      '<div class="sheet-foot"></div>' +
      "</div></div>";
    host.appendChild(node);
    const wrap = node.querySelector(".sheet-wrap"), mask = node.querySelector(".sheet-mask"), sheet = node.querySelector(".sheet");
    requestAnimationFrame(() => { mask.style.opacity = 1; sheet.classList.add("on"); });
    const entry = { node };
    const close = () => {
      mask.style.opacity = 0; sheet.classList.remove("on");
      setTimeout(() => { node.remove(); }, 240);
      UI._sheets = UI._sheets.filter(x => x !== entry);
      opts.onClose && opts.onClose();
    };
    entry.close = close;
    UI._sheets.push(entry);
    node.querySelector("[data-close]").onclick = close;
    node.querySelector("[data-close2]").onclick = e => { e.stopPropagation(); if (opts.onRight) opts.onRight(close); else close(); };
    mask.onclick = close;
    return { host: node, sheet, body: node.querySelector(".sheet-body"), close, foot: node.querySelector(".sheet-foot") };
  },
  closeSheet() {
    const top = UI._sheets[UI._sheets.length - 1];
    if (top) top.close();
  },

  /* 通用日期选择弹层（今天/昨天/自定义） */
  datePicker(current, cb) {
    const sh = UI.sheet({ title: "选择时间" });
    const items = [
      { lab: "今天", d: new Date() },
      { lab: "昨天", d: new Date(Date.now() - 86400000) }
    ];
    sh.body.innerHTML =
      items.map((it, i) =>
        '<div class="cell" data-i="' + i + '"><div class="cell-main"><div class="cell-title">' + it.lab +
        "</div></div>" + UI.svg("arrow", 16) + "</div>").join("") +
      '<div class="form-row" style="border:none"><div class="lab">选择日期</div>' +
      '<input type="date" id="dpInput" value="' + (current || fmt.YMD(new Date())) + '"></div>';
    UI.$$(".cell", sh.body).forEach(c => c.onclick = () => {
      const it = items[+c.dataset.i];
      sh.close();
      cb(fmt.YMD(it.d) + " " + (current ? current.slice(11, 16) : "12:00"));
    });
    UI.$("#dpInput", sh.body).onchange = e => {
      if (!e.target.value) return;
      sh.close();
      cb(e.target.value + " " + (current ? current.slice(11, 16) : "12:00"));
    };
  },

  escape(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },

  /* ---------- 账单附件（图片） ---------- */
  /* 本地压缩：长边缩到 maxEdge、JPEG 输出，控制 localStorage 体积 */
  compressImage(file, maxEdge, quality) {
    maxEdge = maxEdge || 720; quality = quality || 0.62;
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("图片解析失败"));
        img.src = rd.result;
      };
      rd.onerror = () => reject(new Error("图片读取失败"));
      rd.readAsDataURL(file);
    });
  },
  /* 全屏查看附件 */
  viewPhoto(src) {
    const host = UI.$("#modalHost");
    host.innerHTML = '<div class="photo-viewer"><img src="' + src + '" alt="账单附件"></div>';
    host.querySelector(".photo-viewer").onclick = () => { host.innerHTML = ""; };
  }
};

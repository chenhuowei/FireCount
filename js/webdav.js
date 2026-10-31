/* ============================================================
 * WebDAV 云备份（需求②，仅 APK 版：浏览器受 CORS 限制）
 *   预设：坚果云 / 123网盘 / 自定义
 *   原生桥 AndroidBridge.webdavRequest(id, method, url, headers, body)
 *   自动：打开时检查 + 运行中每 30 分钟检查，距上次备份 ≥6h 触发
 * ============================================================ */
"use strict";

const WebDAV = {
  AUTO_MS: 6 * 3600 * 1000,
  CHECK_MS: 30 * 60 * 1000,
  _timer: null, _seq: 0, _busy: false,

  PRESETS: {
    jianguoyun: { name: "坚果云", server: "https://dav.jianguoyun.com/dav/", hint: "需在坚果云网页版「安全选项」生成应用密码（非登录密码）" },
    pan123: { name: "123网盘", server: "https://webdav.123pan.com/webdav/", hint: "账号为手机号，密码在 123网盘 App「设置」里开启 WebDAV 后生成" },
    custom: { name: "自定义", server: "", hint: "填入任意 WebDAV 服务地址（仅支持 https）" }
  },

  cfg() {
    const s = Store.s.settings;
    if (!s.webdav) s.webdav = { provider: "jianguoyun", server: "", user: "", pass: "", dir: "/kdjz-backup/", keepN: 10, lastBackupAt: 0 };
    return s.webdav;
  },
  available() {
    try { return !!(window.AndroidBridge && typeof window.AndroidBridge.webdavRequest === "function"); }
    catch (e) { return false; }
  },
  configured() { const c = this.cfg(); return !!(c.user && c.pass && (c.server || this.PRESETS[c.provider])); },
  serverBase() { const c = this.cfg(); return (c.server || this.PRESETS[c.provider].server).replace(/\/+$/, "") + "/"; },
  dirPath() { const d = this.cfg().dir || "/kdjz-backup/"; return "/" + d.replace(/^\/+|\/+$/g, "") + "/"; },
  url(name) { return this.serverBase() + this.dirPath().replace(/^\//, "") + encodeURIComponent(name); },
  dirUrl() { return this.serverBase() + this.dirPath().replace(/^\//, ""); },

  authHeader() {
    const c = this.cfg();
    return "Basic " + btoa(unescape(encodeURIComponent(c.user + ":" + c.pass)));
  },

  /* 原生请求桥（回调式） */
  req(method, url, headers, body) {
    return new Promise((resolve, reject) => {
      if (!this.available()) { reject(new Error("仅 APK 版支持 WebDAV")); return; }
      const id = ++this._seq;
      const timeout = setTimeout(() => {
        delete window.__webdavCbMap[id];
        reject(new Error("请求超时"));
      }, 60000);
      window.__webdavCbMap = window.__webdavCbMap || {};
      window.__webdavCbMap[id] = (code, respBody) => {
        clearTimeout(timeout);
        delete window.__webdavCbMap[id];
        resolve({ code, body: respBody || "" });
      };
      const h = Object.assign({ "Authorization": this.authHeader() }, headers || {});
      const headerStr = Object.keys(h).map(k => k + ": " + h[k]).join("\n");
      try {
        window.AndroidBridge.webdavRequest(id, method, url, headerStr, body || "");
      } catch (e) { clearTimeout(timeout); reject(e); }
    });
  },

  /* ---------- 操作 ---------- */
  async ensureDir() {
    const r = await this.req("MKCOL", this.dirUrl(), null, null);
    if (r.code >= 200 && r.code < 300) return true;         // 201 创建
    if (r.code === 405 || r.code === 301 || r.code === 403) return true; // 已存在
    throw new Error("创建目录失败 (" + r.code + ")");
  },

  async testConn() {
    if (!this.configured()) throw new Error("请先填写服务器与账号");
    // 分步诊断：逐步报告卡在哪一环，便于定位坚果云常见问题
    // ① 基础连通性（不带证书校验失败的干扰，直接请求目录）
    let r = await this.req("PROPFIND", this.dirUrl(), { "Depth": "0", "Content-Type": "application/xml" },
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"/>');
    if (r.code === -1) throw new Error("网络不通：" + r.body + "（检查手机网络/系统时间是否正确）");
    if (r.code === 401) throw new Error("认证失败（401）：坚果云必须用「应用密码」而非登录密码（网页版→账户信息→安全选项→添加应用密码）");
    if (r.code === 403) throw new Error("被拒绝（403）：坚果云免费版同一应用密码最多 2 台设备同时连接、每月流量超限也会 403；请到坚果云网页版确认应用密码状态与流量，或重新生成一个应用密码");
    if (r.code === 404) {
      // 目录不存在 → 尝试创建
      const mk = await this.req("MKCOL", this.dirUrl(), null, null);
      if (mk.code !== 201 && mk.code !== 405) throw new Error("备份目录不存在且创建失败 (" + mk.code + ")");
      r = await this.req("PROPFIND", this.dirUrl(), { "Depth": "1", "Content-Type": "application/xml" },
        '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/></d:prop></d:propfind>');
    } else if (r.code !== 207 && r.code !== 200) {
      throw new Error("连接失败 (" + r.code + ")：" + (r.body || "").slice(0, 80));
    } else {
      r = await this.req("PROPFIND", this.dirUrl(), { "Depth": "1", "Content-Type": "application/xml" },
        '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/></d:prop></d:propfind>');
    }
    if (r.code !== 207 && r.code !== 200) throw new Error("列目录失败 (" + r.code + ")");
    const n = this.parseList(r.body).length;
    return n;
  },

  async backupNow(manual) {
    if (this._busy) { if (manual) UI.toast("正在备份中…"); return; }
    if (!this.available()) { UI.toast("仅 APK 版支持 WebDAV"); return; }
    if (!this.configured()) { if (manual) { UI.toast("请先配置 WebDAV"); } return; }
    this._busy = true;
    try {
      await this.ensureDir();
      const name = "kdjz_" + fmt.YMD(new Date()).replace(/-/g, "") + "_" +
        new Date().toTimeString().slice(0, 8).replace(/:/g, "") + ".json";
      const content = Store.exportJSON();
      const r = await this.req("PUT", this.url(name), { "Content-Type": "application/json" }, content);
      if (r.code < 200 || r.code >= 300) throw new Error("上传失败 (" + r.code + ")");
      await this.req("PUT", this.url("latest.json"), { "Content-Type": "application/json" }, content);
      this.cfg().lastBackupAt = Date.now();
      Store.save();
      // 清理旧备份
      try {
        const files = await this.list();
        const keep = this.cfg().keepN || 10;
        const old = files.filter(f => f.name !== "latest.json").slice(keep);
        for (const f of old) await this.req("DELETE", this.url(f.name));
      } catch (e) { /* 清理失败不影响备份结果 */ }
      UI.toast(manual ? "备份成功：" + name : "已自动备份（6 小时定时）");
    } catch (e) {
      UI.toast("备份失败：" + (e.message || e));
    } finally {
      this._busy = false;
      if (typeof App !== "undefined" && App.page === "mine") App.refresh();
    }
  },

  async list() {
    const r = await this.req("PROPFIND", this.dirUrl(), { "Depth": "1", "Content-Type": "application/xml" },
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/></d:prop></d:propfind>');
    if (r.code !== 207 && r.code !== 200) throw new Error("读取备份列表失败 (" + r.code + ")");
    return this.parseList(r.body).filter(f => f.name.endsWith(".json"));
  },

  parseList(xml) {
    const out = [];
    try {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const all = doc.getElementsByTagName("*");
      for (const node of all) {
        if (node.localName !== "response" && node.localName !== "D:response") continue;
        let href = "", mtime = "";
        for (const child of node.getElementsByTagName("*")) {
          if (child.localName === "href") href = child.textContent;
          if (child.localName === "getlastmodified") mtime = child.textContent;
        }
        const isDir = [...node.getElementsByTagName("*")].some(n => n.localName === "collection");
        if (isDir) continue;
        const name = decodeURIComponent(href.split("/").filter(Boolean).pop() || "");
        if (name) out.push({ name, mtime });
      }
    } catch (e) { /* XML 解析失败返回空 */ }
    out.sort((a, b) => b.name.localeCompare(a.name));
    return out;
  },

  async restore(name) {
    const r = await this.req("GET", this.url(name));
    if (r.code !== 200) throw new Error("下载失败 (" + r.code + ")");
    let obj;
    try { obj = JSON.parse(r.body); } catch (e) { throw new Error("备份文件损坏"); }
    if (!obj.records || !obj.books) throw new Error("不是有效的备份文件");
    const ok = await UI.confirm({
      title: "恢复备份",
      body: "将用备份「" + UI.escape(name) + "」(" + obj.records.length + " 笔账单) <b style='color:var(--danger)'>覆盖当前全部数据</b>。建议先手动备份。",
      ok: "覆盖恢复", danger: true
    });
    if (!ok) return;
    Store.replaceState(obj);
    UI.toast("恢复成功");
    App.applyTheme();
    App.viewMonth = fmt.curMonth();
    App.go("bills");
  },

  /* ---------- 自动备份 ---------- */
  initAuto() {
    if (!this.available() || !this.configured()) return;
    this.check();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.check(), this.CHECK_MS);
  },
  check() {
    if (!this.configured() || this._busy) return;
    if (Date.now() - (this.cfg().lastBackupAt || 0) >= this.AUTO_MS) this.backupNow(false);
  },

  /* ---------- 设置页 ---------- */
  settingsSheet() {
    const avail = this.available();
    const c = this.cfg();
    const sh = UI.sheet({ title: "WebDAV 云备份" });
    sh.body.innerHTML =
      (avail ? "" : '<div style="background:var(--brand-soft);color:var(--brand);border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.6;margin-bottom:6px">WebDAV 备份仅在 <b>APK 版</b>可用（浏览器版受跨域限制，请使用"数据导出/导入"）。以下配置可先保存，装回 APK 后生效。</div>') +
      '<div class="form-row"><div class="lab">平台</div><div class="sel">' +
        Object.keys(this.PRESETS).map(k =>
          '<button class="chip' + (c.provider === k ? " active" : "") + '" data-p="' + k + '">' + this.PRESETS[k].name + "</button>").join("") + "</div></div>" +
      '<div class="form-row"><div class="lab">服务器</div><input type="text" id="wdServer" placeholder="' + this.PRESETS[c.provider].server + '" value="' + UI.escape(c.server) + '"></div>' +
      '<div class="form-row"><div class="lab">账号</div><input type="text" id="wdUser" autocomplete="off" value="' + UI.escape(c.user) + '"></div>' +
      '<div class="form-row"><div class="lab">密码</div><input type="password" id="wdPass" autocomplete="new-password" value="' + UI.escape(c.pass) + '"></div>' +
      '<div class="form-row"><div class="lab">目录</div><input type="text" id="wdDir" value="' + UI.escape(c.dir) + '"></div>' +
      '<div class="form-row"><div class="lab">保留份数</div><div class="sel">' +
        [5, 10, 20].map(n => '<button class="chip' + (c.keepN === n ? " active" : "") + '" data-n="' + n + '">' + n + " 份</button>").join("") + "</div></div>" +
      '<div class="sec-title" id="wdHint">' + this.PRESETS[c.provider].hint + "</div>" +
      '<div class="sec-title">上次备份：' + (c.lastBackupAt ? new Date(c.lastBackupAt).toLocaleString("zh-CN") : "从未备份") +
        (c.lastBackupAt ? " · 自动备份每 6 小时（应用打开时）" : "") + "</div>";
    sh.foot.innerHTML =
      '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-ghost" style="flex:1" id="wdTest">测试连接</button>' +
      '<button class="btn btn-primary" style="flex:1" id="wdBackup">立即备份</button>' +
      '<button class="btn btn-ghost" style="flex:1" id="wdList">恢复</button>' +
      "</div>" + (avail ? '<button class="btn btn-ghost btn-block" style="margin-top:10px" id="wdSaveOnly">保存配置</button>' : "");

    const saveCfg = () => {
      c.server = UI.$("#wdServer", sh.body).value.trim();
      c.user = UI.$("#wdUser", sh.body).value.trim();
      c.pass = UI.$("#wdPass", sh.body).value.trim();
      c.dir = UI.$("#wdDir", sh.body).value.trim() || "/kdjz-backup/";
      Store.save();
    };
    sh.body.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
      c.provider = b.dataset.p; Store.save(); sh.close(); this.settingsSheet();
    });
    sh.body.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
      c.keepN = +b.dataset.n; Store.save(); b.parentElement.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === b));
    });
    const t = UI.$("#wdTest", sh.foot);
    if (t) t.onclick = async () => {
      saveCfg();
      if (!avail) { UI.toast("仅 APK 版可测试连接"); return; }
      UI.toast("正在连接…");
      try { const n = await this.testConn(); UI.toast("✅ 连接成功，目录内 " + n + " 个文件"); }
      catch (e) { UI.toast((e.message || "连接失败"), 4000); }
    };
    const bk = UI.$("#wdBackup", sh.foot);
    if (bk) bk.onclick = () => { saveCfg(); sh.close(); this.backupNow(true); };
    const ls = UI.$("#wdList", sh.foot);
    if (ls) ls.onclick = async () => {
      saveCfg();
      if (!avail) { UI.toast("仅 APK 版可恢复"); return; }
      try { await this.listSheet(); } catch (e) { UI.toast(e.message || "读取失败"); }
    };
    const so = UI.$("#wdSaveOnly", sh.foot);
    if (so) so.onclick = () => { saveCfg(); sh.close(); UI.toast("配置已保存"); this.initAuto(); };
  },

  async listSheet() {
    const files = await this.list();
    const sh = UI.sheet({ title: "云端备份（点击恢复）" });
    if (!files.length) sh.body.innerHTML = '<div class="empty"><div class="big">☁️</div><div class="t1">暂无备份</div></div>';
    else sh.body.innerHTML = files.map(f =>
      '<div class="cell" data-f="' + UI.escape(f.name) + '"><div class="cell-icon">' + UI.svg("export", 16) + "</div>" +
      '<div class="cell-main"><div class="cell-title">' + UI.escape(f.name === "latest.json" ? "latest（最近一次）" : f.name) + "</div>" +
      '<div class="cell-desc">' + (f.mtime || "") + "</div></div>" +
      '<button class="txt-btn" data-del="' + UI.escape(f.name) + '" style="color:var(--danger)">删除</button></div>'
    ).join("");
    sh.body.querySelectorAll("[data-f]").forEach(el => el.onclick = async e => {
      if (e.target.dataset.del) return;
      const name = el.dataset.f;
      sh.close();
      try { await this.restore(name); } catch (err) { UI.toast(err.message || "恢复失败"); }
    });
    sh.body.querySelectorAll("[data-del]").forEach(b => b.onclick = async e => {
      e.stopPropagation();
      const name = b.dataset.del;
      const ok = await UI.confirm({ title: "删除云端备份", body: name, ok: "删除", danger: true });
      if (!ok) return;
      await this.req("DELETE", this.url(name));
      UI.toast("已删除"); sh.close();
      this.listSheet().catch(() => {});
    });
  }
};

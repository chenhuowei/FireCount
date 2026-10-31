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
    if (!s.webdav) s.webdav = { provider: "jianguoyun", server: "", user: "", pass: "", dir: "/firecount/", keepN: 10, lastBackupAt: 0, autoAfterSave: true, autoDelaySec: 5 };
    if (s.webdav.dir === "/kdjz-backup/") s.webdav.dir = "/firecount/"; // 旧配置迁移
    if (s.webdav.autoDelaySec === 3) s.webdav.autoDelaySec = 5; // 旧默认值迁移
    if (s.webdav.autoAfterSave === undefined) s.webdav.autoAfterSave = true;
    return s.webdav;
  },
  available() {
    try { return !!(window.AndroidBridge && typeof window.AndroidBridge.webdavRequest === "function"); }
    catch (e) { return false; }
  },
  configured() { const c = this.cfg(); return !!(c.user && c.pass && (c.server || this.PRESETS[c.provider])); },
  serverBase() { const c = this.cfg(); return (c.server || this.PRESETS[c.provider].server).replace(/\/+$/, "") + "/"; },
  dirPath() { const d = this.cfg().dir || "/firecount/"; return "/" + d.replace(/^\/+|\/+$/g, "") + "/"; },
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
    if (r.code === 501) return true; // 部分环境 MKCOL 发不出（反射限制），坚果云 PUT 会自动创建父目录
    throw new Error("创建目录失败 (" + r.code + ")");
  },

  async testConn() {
    if (!this.configured()) throw new Error("请先填写服务器与账号");
    // 用 HEAD（标准方法，所有 HttpURLConnection 可靠支持）验证连通+凭证。
    // 不用 PROPFIND：部分 Android 环境反射注入 method 后请求行错乱，服务器回 501。
    let r = await this.req("HEAD", this.dirUrl(), null, null);
    if (r.code === -1) throw new Error("网络不通：" + r.body + "（检查手机网络/系统时间是否正确）");
    if (r.code === 401) throw new Error("认证失败（401）：坚果云必须用「应用密码」而非登录密码（网页版→账户信息→安全选项→添加应用密码）");
    if (r.code === 403) throw new Error("被拒绝（403）：坚果云免费版同一应用密码最多 2 台设备同时连接、每月流量超限也会 403；请到坚果云网页版确认应用密码状态与流量，或重新生成一个应用密码");
    if (r.code === 404) {
      // 目录不存在：先试 MKCOL，501（服务器不认）时忽略——坚果云 PUT 会自动创建父目录
      const mk = await this.req("MKCOL", this.dirUrl(), null, null);
      if (mk.code !== 201 && mk.code !== 405 && mk.code !== 501) {
        // 再验证一次（可能只是目录尚未创建，PUT 能自动建）
        const probe = await this.req("HEAD", this.dirUrl(), null, null);
        if (probe.code === 404) throw new Error("备份目录不存在且创建失败 (" + mk.code + ")，可手动在坚果云网页版创建目录后再试");
      }
      r = await this.req("HEAD", this.dirUrl(), null, null);
    }
    if (r.code >= 200 && r.code < 400) {
      // 通过。文件数用 PROPFIND 试一下（501 则降级返回 -1 不阻塞）
      try {
        const pf = await this.req("PROPFIND", this.dirUrl(), { "Depth": "1", "Content-Type": "application/xml" },
          '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/></d:prop></d:propfind>');
        if (pf.code === 207 || pf.code === 200) return this.parseList(pf.body).length;
      } catch (e) {}
      return -1; // 连接本身验证通过，文件数未知
    }
    throw new Error("连接失败 (" + r.code + ")：" + (r.body || "").slice(0, 80));
  },

  async backupNow(manual) {
    if (this._busy) { if (manual) UI.toast("正在备份中…"); return; }
    if (!this.available()) { if (manual) UI.toast("仅 APK 版支持 WebDAV"); return; }
    if (!this.configured()) { if (manual) { UI.toast("请先配置 WebDAV"); } return; }
    this._busy = true;
    Store.saveNow(); // 确保待备份内容已落盘
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
    // PROPFIND 列目录；部分 Android 环境反射注入 method 后服务器回 501，
    // 降级方案：坚果云 GET 目录会返回 200+HTML（含文件链接），或提示改用 latest.json 恢复
    const r = await this.req("PROPFIND", this.dirUrl(), { "Depth": "1", "Content-Type": "application/xml" },
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getlastmodified/></d:prop></d:propfind>');
    if (r.code === 207 || r.code === 200) return this.parseList(r.body).filter(f => f.name.endsWith(".json"));
    if (r.code === 501) {
      // 降级：GET 目录 URL（坚果云返回 HTML 列表，从 href 里抽 .json 文件名）
      const g = await this.req("GET", this.dirUrl(), null, null);
      if (g.code >= 200 && g.code < 300) {
        const names = [];
        const re = /([\w\-]+\.json)/g; let m;
        while ((m = re.exec(g.body)) !== null) if (!names.includes(m[1])) names.push(m[1]);
        if (names.length) return names.map(n => ({ name: n, mtime: "" }));
        throw new Error("目录可访问但无法解析文件列表，可用「恢复 latest」恢复最近备份");
      }
      throw new Error("读取备份列表失败 (" + g.code + ")");
    }
    throw new Error("读取备份列表失败 (" + r.code + ")");
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
    App.go("report");
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
  /* 需求：记账后 N 秒自动备份 —— 去抖：连续记账只备份最后一次 */
  onDataSetChanged() {
    const c = this.cfg();
    if (c.autoAfterSave === false || !this.available() || !this.configured()) return;
    clearTimeout(this._saveBackupTimer);
    const delay = Math.max(1, +c.autoDelaySec || 5) * 1000;
    this._saveBackupTimer = setTimeout(() => this.backupNow(false), delay);
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
      '<div class="form-row wd-pass-row"><div class="lab">应用密码</div>' +
        '<input type="password" id="wdPass" autocomplete="new-password" value="' + UI.escape(c.pass) + '">' +
        '<button type="button" class="wd-eye" id="wdEye" data-on="0" aria-label="显示/隐藏密码">' + UI.svg("scan", 18) + '</button></div>' +
      '<div class="form-row"><div class="lab">目录</div><input type="text" id="wdDir" value="' + UI.escape(c.dir) + '"></div>' +
      '<div class="form-row"><div class="lab">保留份数</div><div class="sel">' +
        [5, 10, 20].map(n => '<button class="chip' + (c.keepN === n ? " active" : "") + '" data-n="' + n + '">' + n + " 份</button>").join("") + "</div></div>" +
      '<div class="form-row"><div class="lab">自动备份</div><div class="sel">' +
        '<button class="chip' + (c.autoAfterSave === false ? "" : " active") + '" data-auto="on">记账后 ' + (c.autoDelaySec || 5) + ' 秒</button>' +
        '<button class="chip' + (c.autoAfterSave === false ? " active" : "") + '" data-auto="off">仅手动/6小时</button></div></div>' +
      '<div class="form-row" id="wdDelayRow"><div class="lab">延迟秒数</div><input type="number" id="wdDelay" min="1" max="3600" value="' + (+c.autoDelaySec || 5) + '"></div>' +
      '<div class="sec-title" id="wdHint">' + this.PRESETS[c.provider].hint + "</div>" +
      '<div class="sec-title">上次备份：' + (c.lastBackupAt ? new Date(c.lastBackupAt).toLocaleString("zh-CN") : "从未备份") +
        (c.lastBackupAt ? " · 自动备份每 6 小时（应用打开时）" : "") + "</div>";
    sh.foot.innerHTML =
      '<button class="btn btn-primary btn-block" id="wdRestore">从云端下载数据恢复</button>' +
      '<div style="display:flex;gap:10px;margin-top:10px">' +
      '<button class="btn btn-ghost" style="flex:1" id="wdTest">测试连接</button>' +
      '<button class="btn btn-primary" style="flex:1" id="wdBackup">立即备份</button>' +
      "</div>" + (avail ? '<button class="btn btn-ghost btn-block" style="margin-top:10px" id="wdSaveOnly">保存配置</button>' : "");

    const saveCfg = () => {
      c.server = UI.$("#wdServer", sh.body).value.trim();
      c.user = UI.$("#wdUser", sh.body).value.trim();
      c.pass = UI.$("#wdPass", sh.body).value.trim();
      c.dir = UI.$("#wdDir", sh.body).value.trim() || "/firecount/";
      Store.save();
    };
    // 密码显示/隐藏切换
    const eye = UI.$("#wdEye", sh.body);
    const eyeSvg = on => UI.svg(on ? "eye-off" : "eye", 18);
    eye.innerHTML = eyeSvg(0);
    eye.onclick = () => {
      const on = eye.dataset.on === "1";
      eye.dataset.on = on ? "0" : "1";
      UI.$("#wdPass", sh.body).type = on ? "password" : "text";
      eye.innerHTML = eyeSvg(on ? 0 : 1);
    };
    sh.body.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
      c.provider = b.dataset.p; Store.save(); sh.close(); this.settingsSheet();
    });
    sh.body.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
      c.keepN = +b.dataset.n; Store.save(); b.parentElement.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === b));
    });
    sh.body.querySelectorAll("[data-auto]").forEach(b => b.onclick = () => {
      c.autoAfterSave = b.dataset.auto !== "off";
      saveCfg();
      b.parentElement.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === b));
      UI.$("#wdDelayRow", sh.body).style.display = c.autoAfterSave ? "flex" : "none";
      UI.toast(c.autoAfterSave ? "已开启：记账后 " + (c.autoDelaySec || 5) + " 秒自动备份" : "已关闭自动备份");
    });
    // 延迟秒数可配置（1~3600 秒），失焦/回车保存
    const delayInput = UI.$("#wdDelay", sh.body);
    const saveDelay = () => {
      const raw = parseInt(delayInput.value, 10);
      // 空/非数字回退默认 5；数字则钳制到 1~3600（输入 0 应钳到 1）
      const v = isNaN(raw) ? 5 : Math.min(3600, Math.max(1, raw));
      if (String(v) !== delayInput.value) delayInput.value = v;
      c.autoDelaySec = v; Store.save();
    };
    delayInput.onchange = saveDelay;
    delayInput.onblur = saveDelay;
    UI.$("#wdDelayRow", sh.body).style.display = c.autoAfterSave ? "flex" : "none";
    const t = UI.$("#wdTest", sh.foot);
    if (t) t.onclick = async () => {
      saveCfg();
      if (!avail) { UI.toast("仅 APK 版可测试连接"); return; }
      UI.toast("正在连接…");
      try { const n = await this.testConn(); UI.toast(n >= 0 ? "✅ 连接成功，目录内 " + n + " 个文件" : "✅ 连接成功"); }
      catch (e) { UI.toast((e.message || "连接失败"), 4000); }
    };
    const bk = UI.$("#wdBackup", sh.foot);
    if (bk) bk.onclick = () => { saveCfg(); sh.close(); this.backupNow(true); };
    const ls = UI.$("#wdRestore", sh.foot);
    if (ls) ls.onclick = async () => {
      saveCfg();
      if (!avail) { UI.toast("仅 APK 版可恢复"); return; }
      UI.toast("正在读取云端备份…");
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

/* const 声明不挂 window，供 store.js 的 save() 钩子调用 */
window.WebDAV = WebDAV;

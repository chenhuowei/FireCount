/* ============================================================
 * 应用锁（需求①）
 *   PIN 主锁（SHA-256 哈希存储，纯 JS 实现无环境依赖）
 *   忘记 PIN → 安全问题验证 → 重置（数据保留）
 *   APK 指纹快速解锁（window.AndroidBridge.showBiometric）
 *   自动锁定：启动必验 + 切后台按配置时长重验
 * ============================================================ */
"use strict";

const Lock = {
  active: false,             // 锁屏是否展示中
  unlockedOnce: false,       // 本次会话是否已解锁过
  pendingAfterUnlock: null,  // 解锁后待执行（快捷记账等）
  hiddenAt: 0,

  /* ---------- SHA-256（纯 JS） ---------- */
  sha256(msg) {
    function rr(v, s) { return (v >>> s) | (v << (32 - s)); }
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const utf8 = unescape(encodeURIComponent(msg));
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[off+i*4]<<24)|(bytes[off+i*4+1]<<16)|(bytes[off+i*4+2]<<8)|bytes[off+i*4+3];
      for (let i = 16; i < 64; i++) {
        const s0 = rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3);
        const s1 = rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);
        w[i] = (w[i-16]+s0+w[i-7]+s1)|0;
      }
      let [a,b,c,d,e,f,g,h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rr(e,6)^rr(e,11)^rr(e,25);
        const ch = (e&f)^(~e&g);
        const t1 = (h+S1+ch+K[i]+w[i])|0;
        const S0 = rr(a,2)^rr(a,13)^rr(a,22);
        const mj = (a&b)^(a&c)^(b&c);
        const t2 = (S0+mj)|0;
        h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
      }
      H = [ (H[0]+a)|0,(H[1]+b)|0,(H[2]+c)|0,(H[3]+d)|0,(H[4]+e)|0,(H[5]+f)|0,(H[6]+g)|0,(H[7]+h)|0 ];
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  },

  randSalt() {
    let s = "";
    for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    return s;
  },
  hash(salt, text) { return this.sha256(salt + "·" + text); },
  hashAnswer(salt, text) { return this.hash(salt, String(text || "").trim().toLowerCase()); },

  /* ---------- 配置 ---------- */
  cfg() {
    const s = Store.s.settings;
    if (!s.lock) s.lock = { enabled: false, pinHash: "", pinSalt: "", pinLen: 4, question: "", answerHash: "", answerSalt: "", autoLockSec: 0 };
    return s.lock;
  },
  enabled() { const c = this.cfg(); return c.enabled && c.pinHash; },
  bioAvailable() {
    try { return !!(window.AndroidBridge && window.AndroidBridge.biometricAvailable && window.AndroidBridge.biometricAvailable()); }
    catch (e) { return false; }
  },

  /* ---------- 生命周期 ---------- */
  init() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { this.hiddenAt = Date.now(); return; }
      if (!this.enabled() || this.active) return;
      if (!this.unlockedOnce) return; // 启动必验由 boot 时 showLock 处理
      const auto = this.cfg().autoLockSec;
      if (auto < 0) return; // 仅启动时
      if ((Date.now() - this.hiddenAt) / 1000 >= auto) this.showLock();
    });
    if (this.enabled()) this.showLock();
  },

  verify(pin) { const c = this.cfg(); return this.hash(c.pinSalt, pin) === c.pinHash; },

  /* ---------- 锁屏 ---------- */
  showLock() {
    if (this.active) return;
    this.active = true;
    const pinLen = this.cfg().pinLen;
    const el = document.createElement("div");
    el.id = "lockScreen";
    el.innerHTML =
      '<div class="lock-inner">' +
        '<div class="lock-logo">🐷</div>' +
        '<div class="lock-title">应用已锁定</div>' +
        '<div class="lock-sub">输入 PIN 码解锁</div>' +
        '<div class="lock-dots" id="lockDots"></div>' +
        '<div class="lock-err" id="lockErr"></div>' +
        '<div class="lock-pad" id="lockPad"></div>' +
        (this.bioAvailable()
          ? '<button class="lock-bio" id="lockBio">' + UI.svg("user", 18) + ' 指纹解锁</button>' : "") +
        '<button class="lock-forgot" id="lockForgot">忘记 PIN？</button>' +
      "</div>";
    document.body.appendChild(el);
    const dots = el.querySelector("#lockDots");
    let input = "", locked = false;

    const renderDots = () => {
      dots.innerHTML = Array.from({ length: pinLen }, (_, i) => "<i" + (i < input.length ? " class='on'" : "") + "></i>").join("");
    };
    const pad = el.querySelector("#lockPad");
    pad.innerHTML = [1,2,3,4,5,6,7,8,9,"",0,"del"].map(k =>
      k === "" ? "<span></span>" :
      '<button class="lock-key" data-k="' + k + '">' + (k === "del" ? UI.svg("del", 20) : k) + "</button>"
    ).join("");
    pad.addEventListener("click", e => {
      if (locked) return;
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const k = b.dataset.k;
      if (k === "del") input = input.slice(0, -1);
      else if (input.length < pinLen) input += k;
      el.querySelector("#lockErr").textContent = "";
      renderDots();
      if (input.length === pinLen) {
        if (this.verify(input)) { this.unlock(); }
        else {
          locked = true;
          el.querySelector("#lock-inner")?.classList.remove("shake");
          el.querySelector(".lock-inner").classList.add("shake");
          el.querySelector("#lockErr").textContent = "PIN 码错误";
          setTimeout(() => { input = ""; locked = false; renderDots(); }, 500);
        }
      }
    });
    renderDots();

    const bio = el.querySelector("#lockBio");
    if (bio) bio.onclick = () => {
      window.__bioResult = ok => { if (ok && this.active) this.unlock(); };
      try { window.AndroidBridge.showBiometric("验证指纹以解锁口袋记账"); }
      catch (e) { UI.toast("指纹不可用"); }
    };
    el.querySelector("#lockForgot").onclick = () => this.forgotFlow();
  },

  unlock() {
    const el = document.getElementById("lockScreen");
    if (el) el.remove();
    this.active = false;
    this.unlockedOnce = true;
    if (this.pendingAfterUnlock) {
      const fn = this.pendingAfterUnlock;
      this.pendingAfterUnlock = null;
      setTimeout(fn, 120);
    }
  },

  /* ---------- 忘记 PIN：安全问题 → 重置 ---------- */
  forgotFlow() {
    const c = this.cfg();
    if (!c.question) { UI.toast("未设置安全问题，无法找回"); return; }
    const sh = UI.sheet({ title: "忘记 PIN" });
    sh.body.innerHTML =
      '<div class="form-row" style="flex-direction:column;align-items:stretch">' +
      '<div class="lab" style="width:auto">安全问题：' + UI.escape(c.question) + "</div>" +
      '<input type="text" id="fkAns" placeholder="输入答案" style="margin-top:8px"></div>';
    sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="fkOk">验证并重置 PIN</button>';
    UI.$("#fkOk", sh.foot).onclick = () => {
      const ans = UI.$("#fkAns", sh.body).value;
      if (this.hashAnswer(c.answerSalt, ans) !== c.answerHash) { UI.toast("答案不正确"); return; }
      sh.close();
      this.setupPin("设置新 PIN", () => {
        UI.toast("PIN 已重置");
        if (this.active) this.unlock();
      });
    };
  },

  /* ---------- PIN 设置流程（两次输入） ---------- */
  setupPin(title, cb) {
    let first = null;
    const step = (label) => {
      this.pinSheet(title + " · " + label, pin => {
        if (first === null) { first = pin; step("再次输入确认"); }
        else if (first !== pin) { first = null; UI.toast("两次输入不一致，请重新设置"); step("输入新 PIN"); }
        else {
          const c = this.cfg();
          c.pinSalt = this.randSalt();
          c.pinHash = this.hash(c.pinSalt, pin);
          c.pinLen = pin.length;
          Store.save();
          cb && cb();
        }
      });
    };
    step("输入新 PIN（4~6 位）");
  },

  /* PIN 输入弹层（长度 4~6 自适应：确认键提交） */
  pinSheet(title, cb) {
    const sh = UI.sheet({ title });
    let input = "";
    sh.body.innerHTML =
      '<div class="lock-dots big" id="psDots"></div><div class="lock-err" id="psErr"></div>' +
      '<div class="lock-pad" id="psPad"></div>';
    sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="psOk">确定</button>';
    const dots = sh.body.querySelector("#psDots");
    const pad = sh.body.querySelector("#psPad");
    const render = () => { dots.innerHTML = Array.from({ length: 6 }, (_, i) => "<i" + (i < input.length ? " class='on'" : "") + "></i>").join(""); };
    pad.innerHTML = [1,2,3,4,5,6,7,8,9,"",0,"del"].map(k =>
      k === "" ? "<span></span>" : '<button class="lock-key" data-k="' + k + '">' + (k === "del" ? UI.svg("del", 20) : k) + "</button>"
    ).join("");
    pad.addEventListener("click", e => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const k = b.dataset.k;
      if (k === "del") input = input.slice(0, -1);
      else if (input.length < 6) input += k;
      render();
    });
    render();
    UI.$("#psOk", sh.foot).onclick = () => {
      if (input.length < 4) { sh.body.querySelector("#psErr").textContent = "至少 4 位"; return; }
      sh.close();
      cb(input);
    };
  },

  /* ---------- 设置页 ---------- */
  settingsSheet() {
    const render = () => {
      const sh = UI.sheet({ title: "应用锁" });
      const c = this.cfg();
      sh.body.innerHTML =
        '<div class="cell" id="lkToggle"><div class="cell-icon">' + UI.svg("lock", 18) + "</div>" +
        '<div class="cell-main"><div class="cell-title">启用应用锁</div><div class="cell-desc">启动及切后台后需验证 PIN</div></div>' +
        '<span class="chip' + (c.enabled ? " active" : "") + '">' + (c.enabled ? "已开启" : "未开启") + "</span></div>" +
        (c.enabled ? (
          '<div class="cell" id="lkChange"><div class="cell-icon">🔢</div><div class="cell-main"><div class="cell-title">修改 PIN</div></div>' + UI.svg("arrow", 15) + "</div>" +
          '<div class="cell" id="lkQ"><div class="cell-icon">❓</div><div class="cell-main"><div class="cell-title">安全问题</div>' +
          '<div class="cell-desc">' + (c.question ? UI.escape(c.question) : "未设置（忘记 PIN 将无法找回）") + "</div></div>" + UI.svg("arrow", 15) + "</div>" +
          '<div class="cell" style="flex-wrap:wrap"><div class="cell-icon">⏱️</div><div class="cell-main" style="min-width:100%"><div class="cell-title">切后台后重新锁定</div>' +
          '<div class="sel" style="margin-top:8px">' +
            [[-1, "仅启动时"], [0, "切回立即"], [60, "1 分钟后"], [300, "5 分钟后"]].map(([v, l]) =>
              '<button class="chip' + (c.autoLockSec === v ? " active" : "") + '" data-auto="' + v + '">' + l + "</button>").join("") +
          "</div></div></div>"
        ) : "") +
        (this.bioAvailable() ? '<div class="sec-title">指纹解锁已在 APK 中可用（验证 PIN 失败时可点"指纹解锁"）</div>' : "");
      sh.body.querySelector("#lkToggle").onclick = () => {
        if (c.enabled) {
          this.pinSheet("输入当前 PIN", pin => {
            if (!this.verify(pin)) { UI.toast("PIN 错误"); return; }
            c.enabled = false; Store.save();
            sh.close(); UI.toast("应用锁已关闭");
            App.refresh();
          });
        } else {
          this.setupPin("开启应用锁", () => {
            const cc = this.cfg();
            cc.enabled = true;
            this.askQuestion(() => { sh.close(); UI.toast("应用锁已开启"); App.refresh(); }, () => { sh.close(); App.refresh(); });
          });
        }
      };
      const ch = sh.body.querySelector("#lkChange");
      if (ch) ch.onclick = () => {
        this.pinSheet("输入当前 PIN", pin => {
          if (!this.verify(pin)) { UI.toast("PIN 错误"); return; }
          this.setupPin("修改 PIN", () => { UI.toast("PIN 已修改"); sh.close(); });
        });
      };
      const qb = sh.body.querySelector("#lkQ");
      if (qb) qb.onclick = () => this.askQuestion(() => UI.toast("已保存"), null, true);
      sh.body.querySelectorAll("[data-auto]").forEach(b => b.onclick = () => {
        c.autoLockSec = +b.dataset.auto; Store.save(); sh.close(); this.settingsSheet();
      });
    };
    render();
  },

  askQuestion(cb, cancelCb, keepOpen) {
    const c = this.cfg();
    const sh = UI.sheet({ title: "安全问题" });
    sh.body.innerHTML =
      '<div class="form-row"><div class="lab">问题</div><input type="text" id="qQ" maxlength="20" placeholder="如：我的第一只宠物叫什么？" value="' + UI.escape(c.question || "") + '"></div>' +
      '<div class="form-row"><div class="lab">答案</div><input type="text" id="qA" maxlength="20" placeholder="答案不区分大小写"></div>' +
      '<div class="sec-title">忘记 PIN 时用此问题验证身份，答案正确可重置 PIN（数据保留）</div>';
    sh.foot.innerHTML = '<button class="btn btn-primary btn-block" id="qSave">保存</button>';
    UI.$("#qSave", sh.foot).onclick = () => {
      const q = UI.$("#qQ", sh.body).value.trim();
      const a = UI.$("#qA", sh.body).value.trim();
      if (!q || !a) { UI.toast("请填写问题与答案"); return; }
      c.question = q;
      c.answerSalt = this.randSalt();
      c.answerHash = this.hashAnswer(c.answerSalt, a);
      Store.save();
      sh.close(); UI.toast("安全问题已保存");
      cb && cb();
    };
  }
};

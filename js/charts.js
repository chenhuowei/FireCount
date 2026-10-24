/* ============================================================
 * 无依赖 Canvas 图表：环形饼图 / 双折线 / 进度环（报表证据：report_linechart_layout + 饼图）
 * ============================================================ */
"use strict";

const Charts = {
  setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const h = canvas.dataset.h ? +canvas.dataset.h : (canvas.clientHeight || 220);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  },

  /* 环形饼图 entries: [{label, value, color}] */
  pie(canvas, entries) {
    const { ctx, w, h } = this.setup(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = entries.reduce((s, e) => s + e.value, 0);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8, r = R * 0.62;
    if (!total) {
      ctx.beginPath(); ctx.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2);
      ctx.lineWidth = R - r; ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--line") || "#EEF0F3";
      ctx.stroke();
      ctx.fillStyle = "#9CA3AF"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("暂无数据", cx, cy + 4);
      return;
    }
    let a = -Math.PI / 2;
    for (const e of entries) {
      const ang = e.value / total * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a, a + ang);
      ctx.arc(cx, cy, r, a + ang, a, true);
      ctx.closePath();
      ctx.fillStyle = e.color; ctx.fill();
      if (e.value / total > 0.04) {
        const mid = a + ang / 2, lr = (R + r) / 2;
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(Math.round(e.value / total * 100) + "%", cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr);
      }
      a += ang;
    }
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text-1") || "#222";
    ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(fmt.money(total), cx, cy - 8);
    ctx.fillStyle = "#9CA3AF"; ctx.font = "11px sans-serif";
    ctx.fillText(canvas.dataset.center || "合计", cx, cy + 11);
  },

  /* 双折线图 series: [{name,color,values[]}], labels: [] */
  line(canvas, labels, series) {
    const { ctx, w, h } = this.setup(canvas);
    ctx.clearRect(0, 0, w, h);
    const padL = 8, padR = 8, padT = 14, padB = 22;
    const iw = w - padL - padR, ih = h - padT - padB;
    const all = series.flatMap(s => s.values);
    const max = Math.max(...all, 1) * 1.12;
    const x = i => padL + (labels.length === 1 ? iw / 2 : iw * i / (labels.length - 1));
    const y = v => padT + ih * (1 - v / max);
    const css = v => getComputedStyle(document.body).getPropertyValue(v).trim() || "#9CA3AF";
    // 网格
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const gy = padT + ih * g / 3;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
    }
    // x 轴标签
    ctx.fillStyle = css("--text-3"); ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    labels.forEach((l, i) => ctx.fillText(l, x(i), h - 7));
    for (const s of series) {
      // 折线
      ctx.beginPath();
      s.values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
      // 面积
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
      grad.addColorStop(0, s.color + "33"); grad.addColorStop(1, s.color + "05");
      ctx.lineTo(x(s.values.length - 1), padT + ih); ctx.lineTo(x(0), padT + ih); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      // 点
      s.values.forEach((v, i) => {
        ctx.beginPath(); ctx.arc(x(i), y(v), 3, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.stroke();
      });
    }
  },

  /* 预算进度环（budget_v3 环形证据；percent 0~n，>1 超支） */
  ring(canvas, percent, centerTop, centerSub, over) {
    const { ctx, w, h } = this.setup(canvas);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 6, lw = 9;
    const css = v => getComputedStyle(document.body).getPropertyValue(v).trim() || "#EEF0F3";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = lw; ctx.strokeStyle = css("--line"); ctx.stroke();
    const p = Math.min(percent, 1);
    const color = over ? "#E5484D" : getComputedStyle(document.body).getPropertyValue("--brand").trim() || "#FF7A2E";
    if (p > 0.005) {
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.strokeStyle = color; ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = over ? "#E5484D" : css("--text-1");
    ctx.font = "bold 17px sans-serif"; ctx.textBaseline = "alphabetic";
    ctx.fillText(centerTop, cx, cy + 2);
    ctx.fillStyle = css("--text-3"); ctx.font = "10px sans-serif";
    ctx.fillText(centerSub, cx, cy + 18);
  }
};

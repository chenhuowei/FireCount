// 小伙记账启动图标：翻开的小账本 + 账目行 + ¥徽章（纯像素 + zlib PNG，无依赖）
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, draw) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const o = 1 + x * 4;
      row[o] = r; row[o + 1] = g; row[o + 2] = b; row[o + 3] = a;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
const smooth = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* 几何基元（SDF + 1px 抗锯齿） */
function rrCover(x, y, x0, y0, x1, y1, r) { // 圆角矩形（sdBox(b-r) - r，标准公式）
  const qx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r);
  const qy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return 1 - smooth(-1.2, 1.2, d);
}
function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(px - ax - abx * t, py - ay - aby * t);
}
function lineCover(x, y, ax, ay, bx, by, w) { return smooth(w / 2 + 1, w / 2 - 1, segDist(x, y, ax, ay, bx, by)); }
function circCover(x, y, cx, cy, r) { return smooth(r + 1.2, r - 1.2, Math.hypot(x - cx, y - cy)); }

function mix(dst, src, a) {
  dst[0] += (src[0] - dst[0]) * a; dst[1] += (src[1] - dst[1]) * a;
  dst[2] += (src[2] - dst[2]) * a; dst[3] = Math.max(dst[3], a);
}

function makeIcon(S) {
  const u = S / 192;
  /* --- SDF 工具 --- */
  const smooth = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const rrCover = (x, y, x0, y0, x1, y1, r) => {
    const qx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r);
    const qy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    return 1 - smooth(-1.2, 1.2, d);
  };
  const segDist = (px, py, ax, ay, bx, by) => {
    const abx = bx - ax, aby = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1)));
    return Math.hypot(px - ax - abx * t, py - ay - aby * t);
  };
  const lineCover = (x, y, ax, ay, bx, by, w) => smooth(w / 2 + 1, w / 2 - 1, segDist(x, y, ax, ay, bx, by));
  const circCover = (x, y, cx, cy, r) => smooth(r + 1.2, r - 1.2, Math.hypot(x - cx, y - cy));
  const ellCover = (x, y, cx, cy, rx, ry) => smooth(1.2, -1.2, Math.hypot((x - cx) / rx, (y - cy) / ry) - 1);
  const mix = (dst, src, a) => {
    dst[0] += (src[0] - dst[0]) * a; dst[1] += (src[1] - dst[1]) * a;
    dst[2] += (src[2] - dst[2]) * a; dst[3] = Math.max(dst[3], a);
  };

  /* --- 色板：火焰主题 --- */
  const cream = [239, 164, 95];     // 背景 奶油橙 #EFA45F
  const creamHi = [247, 186, 126];  // 背景高光
  const bookC = [252, 247, 238];    // 账本 米白
  const bookEdge = [226, 200, 168]; // 账本页缘
  const flameDeep = [226, 110, 28]; // 火焰 焦糖橙
  const flameGold = [247, 178, 62]; // 火焰 暖金
  const flameCore = [255, 218, 150];// 火焰芯
  const ink = [214, 96, 22];        // 账目行
  const white = [255, 255, 255];

  return png(S, (x, y) => {
    // 1) 背景：奶油橙，柔和径向高光（左上偏亮）
    let px = [...cream, 0];
    const hi = circCover(x, y, 58 * u, 52 * u, 150 * u) * 0.35;
    if (hi > 0) mix(px, creamHi, hi);

    // 2) 火焰：从账本中缝上方升起，与账本融为一体（先画火焰，账本压住下沿）
    //    外焰（焦糖橙）：水滴形 = 大圆 + 上尖。用两段圆弧近似。
    const fx = 96 * u, fyBase = 92 * u;             // 火焰中轴，底部埋进账本
    const fW = 44 * u, fH = 88 * u;                // 外焰宽/高
    // 外焰形状：底部半圆(r=fW/2) + 上方收尖（两翼贝塞尔近似：宽度随高度余弦收窄）
    const outerFlame = (() => {
      const dy = fyBase - y;                        // 相对焰底向上
      if (dy < -fW / 2 || dy > fH) return 0;
      if (dy <= 0) return circCover(x, y, fx, fyBase, fW / 2); // 底部圆
      // 上部：宽度线性-余弦收窄到尖端
      const t = dy / fH;                            // 0→1
      const w = (fW / 2) * Math.cos(t * Math.PI / 2.3);
      const inW = Math.abs(x - fx) < w ? 1 - smooth(w - 1, w + 1, Math.abs(x - fx)) : 0;
      // 顶部收圆
      const cap = circCover(x, y, fx, fyBase - fH + fW / 2.4, fW / 2.4);
      return Math.max(inW, cap * (dy > fH - fW / 2 ? 1 : 0));
    })();
    // 内焰（暖金）：略小偏下
    const innerFlame = (() => {
      const dy = fyBase - y;
      const w2 = fW * 0.62, h2 = fH * 0.62;
      if (dy < -w2 / 2 || dy > h2) return 0;
      if (dy <= 0) return circCover(x, y, fx, fyBase, w2 / 2);
      const t = dy / h2;
      const w = (w2 / 2) * Math.cos(t * Math.PI / 2.4);
      const inW = Math.abs(x - fx) < w ? 1 - smooth(w - 1, w + 1, Math.abs(x - fx)) : 0;
      const cap = circCover(x, y, fx, fyBase - h2 + w2 / 2.5, w2 / 2.5);
      return Math.max(inW, cap * (dy > h2 - w2 / 2 ? 1 : 0));
    })();
    if (outerFlame > 0) mix(px, flameDeep, outerFlame);
    if (innerFlame > 0) mix(px, flameGold, innerFlame);

    // 3) 账本：米白翻开双页，页沿略高于火焰底，使火焰像从账本里升起
    const pageTop = 86 * u, pageBot = 160 * u, gap = 5 * u;
    const L0 = 26 * u, L1 = 94 * u - gap, R0 = 98 * u + gap, R1 = 166 * u;
    // 焰底被账本上沿裁掉一点：账本先画，火焰底部自然被覆盖
    const pgL = rrCover(x, y, L0, pageTop, L1, pageBot, 10 * u);
    const pgR = rrCover(x, y, R0, pageTop, R1, pageBot, 10 * u);
    const page = Math.max(pgL, pgR);
    // 账本底衬（微微偏深的米色边，增加层次）
    const pageBack = rrCover(x, y, L0 - 5 * u, pageTop - 5 * u, R1 + 5 * u, pageBot + 5 * u, 12 * u);
    if (pageBack > 0) mix(px, bookEdge, pageBack * 0.9);
    if (page > 0) mix(px, bookC, page);
    // 中缝阴影
    const spine = Math.min(
      smooth(L1 - 16 * u, L1, x) * pgL,
      smooth(R0 + 16 * u, R0, x) * pgR
    ) * 0.12;
    if (spine > 0) mix(px, [205, 190, 170], spine);

    // 4) 账目行：每页 2 条（浅一点，让火焰当主角）
    const inL = pgL > 0.5, inR = pgR > 0.5;
    const rows = [108, 132];
    for (let i = 0; i < 2; i++) {
      let ax, bx;
      if (inL) { ax = L0 + 14 * u; bx = (i === 0 ? L1 - 14 * u : L1 - 30 * u); }
      else if (inR) { ax = R0 + 14 * u; bx = (i === 0 ? R1 - 14 * u : R1 - 30 * u); }
      else continue;
      const c = lineCover(x, y, ax, rows[i] * u, bx, rows[i] * u, 8 * u);
      if (c > 0) mix(px, ink, c * page * 0.85);
    }

    // 5) 火焰芯：白色小水滴在焰心（画在账本之后，仅上段可见）
    const coreR = 12 * u, coreCy = fyBase - fH * 0.42;
    const core = circCover(x, y, fx, coreCy, coreR);
    if (core > 0 && y < pageTop + 6 * u) mix(px, flameCore, core);

    // 6) 文字「小伙记账」：暖白，账本下方。SDF 画 4 个简笔汉字过于复杂，
    //    用 4 个等宽圆角块模拟文字条（品牌感占位），或用小号 ¥ 徽章保持记账语义。
    //    选择：底部暖白横条带 + 中央 ¥，与火焰/账本构成三角视觉。
    const tx0 = 46 * u, tx1 = 146 * u, ty0 = 170 * u, ty1 = 182 * u;
    const tx = rrCover(x, y, tx0, ty0, tx1, ty1, 6 * u);
    if (tx > 0) mix(px, white, tx * 0.95);
    const inTx = tx > 0.5;
    if (inTx) {
      // 迷你 ¥
      const wx = 96 * u, wy = 176 * u, w = 2.6 * u;
      const strokes = [
        [wx - 4.5 * u, wy - 4.5 * u, wx, wy + 1 * u],
        [wx + 4.5 * u, wy - 4.5 * u, wx, wy + 1 * u],
        [wx, wy - 4.5 * u, wx, wy + 5 * u],
        [wx - 4 * u, wy + 0.5 * u, wx + 4 * u, wy + 0.5 * u],
        [wx - 4 * u, wy + 3 * u, wx + 4 * u, wy + 3 * u]
      ];
      let yen = 0;
      for (const st of strokes) yen = Math.max(yen, lineCover(x, y, st[0], st[1], st[2], st[3], w));
      if (yen > 0) mix(px, flameDeep, yen);
    }

    return [Math.round(px[0]), Math.round(px[1]), Math.round(px[2]), 255];
  });
}

const outDir = process.argv[2];
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, "xxxhdpi": 192 };
for (const [d, s] of Object.entries(dens)) {
  const dir = path.join(outDir, "mipmap-" + d);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ic_launcher.png"), makeIcon(s));
  console.log("icon", d, s + "px");
}

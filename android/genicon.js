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
  // 工具
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
  const mix = (dst, src, a) => {
    dst[0] += (src[0] - dst[0]) * a; dst[1] += (src[1] - dst[1]) * a;
    dst[2] += (src[2] - dst[2]) * a; dst[3] = Math.max(dst[3], a);
  };

  const white = [255, 255, 255];
  const ink = [240, 96, 10];       // 账目行深橙
  const inkSoft = [255, 158, 94];  // 淡橙行
  const green = [43, 182, 115];    // ¥ 徽章绿

  return png(S, (x, y) => {
    // 1) 背景：对角渐变（左上亮橙 → 右下深橙），比上下渐变更现代
    const t = (x / S + y / S) / 2;
    let px = [255 - 22 * t, 122 - 46 * t, 46 - 22 * t, 0];

    // 2) 底部柔光：账本脚下的一层浅色投影，增加立体感
    const shadow = smooth(158 * u, 138 * u, y) * 0.22;
    if (shadow > 0) mix(px, [180, 60, 0], shadow);

    // 3) 翻开的双页：更大更圆，带中缝阴影
    const pageTop = 40 * u, pageBot = 152 * u, gap = 6 * u;
    const L0 = 30 * u, L1 = 95 * u - gap, R0 = 97 * u + gap, R1 = 162 * u;
    const pgL = rrCover(x, y, L0, pageTop, L1, pageBot, 9 * u);
    const pgR = rrCover(x, y, R0, pageTop, R1, pageBot, 9 * u);
    const page = Math.max(pgL, pgR);
    if (page > 0) mix(px, white, page);
    // 中缝阴影：靠中缝一侧渐变灰，增强立体
    const spine = Math.min(
      smooth(L1 - 14 * u, L1, x) * pgL,
      smooth(R0 + 14 * u, R0, x) * pgR
    ) * 0.13;
    if (spine > 0) mix(px, [200, 200, 205], spine);

    // 4) 账目行：左页3条（第2条短）+ 右页3条（第2条短），一深一淡交替更有记账感
    const inL = pgL > 0.5, inR = pgR > 0.5;
    const rows = [66, 94, 122];
    for (let i = 0; i < 3; i++) {
      let ax, bx;
      if (inL) { ax = L0 + 13 * u; bx = (i === 1 ? L1 - 24 * u : L1 - 13 * u); }
      else if (inR) { ax = R0 + 13 * u; bx = (i === 1 ? R1 - 24 * u : R1 - 13 * u); }
      else continue;
      const c = lineCover(x, y, ax, rows[i] * u, bx, rows[i] * u, 8 * u);
      if (c > 0) mix(px, i === 1 ? inkSoft : ink, c * page);
    }

    // 5) ¥ 徽章：更大更圆润，白描边一圈提升精致度
    const bc = 138 * u, bcy = 140 * u, br = 34 * u;
    const badge = circCover(x, y, bc, bcy, br);
    const ring = Math.abs(Math.hypot(x - bc, y - bcy) - (br + 4 * u)) < 2.2 * u ? 1 : 0;
    if (badge > 0) mix(px, green, badge);
    if (ring > 0 && badge > 0.4) mix(px, white, ring * 0.9);
    const inB = badge > 0.5;
    if (inB) {
      const w = 7 * u, ox = bc, oy = bcy;
      const strokes = [
        [ox - 12 * u, oy - 14 * u, ox, oy + 1 * u],
        [ox + 12 * u, oy - 14 * u, ox, oy + 1 * u],
        [ox, oy - 14 * u, ox, oy + 16 * u],
        [ox - 11 * u, oy + 3 * u, ox + 11 * u, oy + 3 * u],
        [ox - 11 * u, oy + 10.5 * u, ox + 11 * u, oy + 10.5 * u]
      ];
      let yen = 0;
      for (const st of strokes) yen = Math.max(yen, lineCover(x, y, st[0], st[1], st[2], st[3], w));
      if (yen > 0) mix(px, white, yen);
    }
    return [Math.round(px[0]), Math.round(px[1]), Math.round(px[2]), Math.round(255 * 1)];
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

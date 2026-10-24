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
  // 画布坐标（以 192 为基准等比缩放）
  const u = S / 192;
  const corner = 42 * u; // （保留：如需圆角源图可用）
  const pageTop = 46 * u, pageBot = 150 * u, gap = 5 * u;
  const L0 = 34 * u, L1 = 94 * u - gap, R0 = 98 * u + gap, R1 = 158 * u;
  const lineC = [240, 96, 10];      // 账目行：深橙
  const badgeC = [43, 182, 115];    // 徽章：绿
  const white = [255, 255, 255];
  return png(S, (x, y) => {
    // 1) 背景：满幅橙色渐变（全出血方形，圆角交给系统遮罩）
    const bgA = rrCover(x, y, 0, 0, S, S, 0);
    if (bgA <= 0) return [0, 0, 0, 0];
    const t = y / S;
    let px = [255 - 12 * t, 122 - 42 * t, 46 - 26 * t, 0];
    // 2) 翻开的两页（白）
    const pgL = rrCover(x, y, L0, pageTop, L1, pageBot, 7 * u);
    const pgR = rrCover(x, y, R0, pageTop, R1, pageBot, 7 * u);
    const page = Math.max(pgL, pgR);
    if (page > 0) mix(px, white, page);
    // 3) 每页 3 条账目行（左页第2条短，形成节奏）
    const inL = pgL > 0.5, inR = pgR > 0.5;
    const ly = [72, 98, 124];
    for (let i = 0; i < 3; i++) {
      let ax, bx;
      if (inL) { ax = L0 + 11 * u; bx = (i === 1 ? L1 - 20 * u : L1 - 11 * u); }
      else if (inR) { ax = R0 + 11 * u; bx = (i === 1 ? R1 - 20 * u : R1 - 11 * u); }
      else continue;
      const c = lineCover(x, y, ax, ly[i] * u, bx, ly[i] * u, 7.5 * u);
      if (c > 0) mix(px, lineC, c * page);
    }
    // 4) 右下角 ¥ 徽章（绿圆 + 白色笔画）
    const bc = 132 * u, bcy = 136 * u, br = 30 * u;
    const badge = circCover(x, y, bc, bcy, br);
    if (badge > 0) mix(px, badgeC, badge);
    const inB = badge > 0.5;
    if (inB) {
      const w = 6.5 * u, ox = bc, oy = bcy;
      const strokes = [
        [ox - 11 * u, oy - 13 * u, ox, oy + 1 * u],           // ¥ 左斜
        [ox + 11 * u, oy - 13 * u, ox, oy + 1 * u],           // ¥ 右斜
        [ox, oy - 13 * u, ox, oy + 15 * u],                   // 竖
        [ox - 10 * u, oy + 3 * u, ox + 10 * u, oy + 3 * u],   // 上横
        [ox - 10 * u, oy + 10 * u, ox + 10 * u, oy + 10 * u]  // 下横
      ];
      let yen = 0;
      for (const s of strokes) yen = Math.max(yen, lineCover(x, y, s[0], s[1], s[2], s[3], w));
      if (yen > 0) mix(px, white, yen);
    }
    return [Math.round(px[0]), Math.round(px[1]), Math.round(px[2]), Math.round(255 * bgA)];
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

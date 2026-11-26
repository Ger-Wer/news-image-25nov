// news-image-25nov: draws the world news of 25 November 2026 as one 1024x1024
// newspaper page (header + five story panels) and writes it to
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output). Node 22+, standard library
// only. Deterministic: two runs write byte-identical PNGs. It never deletes
// anything; it only writes the one output file.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------- canvas ----------
const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 4);

const PAPER = [0xf2, 0xed, 0xe3];
const PANEL = [0xfb, 0xf8, 0xf1];
const WHITE = [0xff, 0xff, 0xff];
const INK = [0x23, 0x26, 0x2c];
const GRAY = [0x8a, 0x8f, 0x98];
const DARK = [0x4a, 0x4f, 0x58];
const RED = [0xc0, 0x39, 0x2b];
const ORANGE = [0xe6, 0x7e, 0x22];
const BLUE = [0x3d, 0x5a, 0x80];

function px(x, y, color) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = color[0];
  img[i + 1] = color[1];
  img[i + 2] = color[2];
  img[i + 3] = 255;
}

function fill(x0, y0, w, h, color) {
  x0 |= 0;
  y0 |= 0;
  w |= 0;
  h |= 0;
  const xa = Math.max(x0, 0);
  const xb = Math.min(x0 + w, W);
  const ya = Math.max(y0, 0);
  const yb = Math.min(y0 + h, H);
  if (xb <= xa || yb <= ya) return;
  const [r, g, b] = color;
  for (let y = ya; y < yb; y++) {
    let i = (y * W + xa) * 4;
    for (let x = xa; x < xb; x++) {
      img[i] = r;
      img[i + 1] = g;
      img[i + 2] = b;
      img[i + 3] = 255;
      i += 4;
    }
  }
}

function rectBorder(x, y, w, h, t, color) {
  fill(x, y, w, t, color);
  fill(x, y + h - t, w, t, color);
  fill(x, y, t, h - 2 * t, color);
  fill(x + w - t, y, t, h - 2 * t, color);
}

function line(x0, y0, x1, y1, t, color) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    fill(x0 - (t >> 1), y0 - (t >> 1), t, t, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function circle(cx, cy, r, color) {
  r = Math.max(1, Math.round(r));
  for (let y = -r; y <= r; y++) {
    const x2 = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -x2; x <= x2; x++) px(cx + x, cy + y, color);
  }
}

function tri(x1, y1, x2, y2, x3, y3, color) {
  const pts = [[x1, y1], [x2, y2], [x3, y3]];
  const minY = Math.max(0, Math.ceil(Math.min(y1, y2, y3)));
  const maxY = Math.min(H - 1, Math.floor(Math.max(y1, y2, y3)));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let e = 0; e < 3; e++) {
      const a = pts[e];
      const b = pts[(e + 1) % 3];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    if (xs.length >= 2) {
      xs.sort((p, q) => p - q);
      const xa = Math.max(0, Math.ceil(xs[0]));
      const xb = Math.min(W - 1, Math.floor(xs[xs.length - 1]));
      for (let x = xa; x <= xb; x++) px(x, y, color);
    }
  }
}

// ---------- tiny 5x7 pixel font (uppercase A-Z, 0-9, . : ' - ( ) / & %) ----------
const FONT = {
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  'A': [14, 17, 17, 31, 17, 17, 17],
  'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14],
  'D': [30, 17, 17, 17, 17, 17, 30],
  'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16],
  'G': [14, 17, 16, 23, 17, 17, 15],
  'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14],
  'J': [7, 2, 2, 2, 2, 18, 12],
  'K': [17, 18, 20, 24, 20, 18, 17],
  'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 21, 17, 17, 17],
  'N': [17, 25, 21, 19, 17, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14],
  'P': [30, 17, 17, 30, 16, 16, 16],
  'Q': [14, 17, 17, 17, 21, 18, 13],
  'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30],
  'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14],
  'V': [17, 17, 17, 17, 17, 10, 4],
  'W': [17, 17, 17, 21, 21, 27, 17],
  'X': [17, 17, 10, 4, 10, 17, 17],
  'Y': [17, 17, 10, 4, 4, 4, 4],
  'Z': [31, 1, 2, 4, 8, 16, 31],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 6, 6],
  ':': [0, 12, 12, 0, 12, 12, 0],
  "'": [12, 12, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '%': [25, 26, 2, 4, 8, 22, 3],
};

function drawText(s, x, y, scale, color) {
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const glyph = FONT[s[i]];
    if (glyph) {
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (16 >> col)) fill(cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += 6 * scale;
  }
}

function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}

function drawTextCenter(s, y, scale, color) {
  drawText(s, Math.round((W - textWidth(s, scale)) / 2), y, scale, color);
}

// ---------- PNG encoder (raw RGBA + zlib deflate + CRC32) ----------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- icons (local coords 0..124 inside each panel box) ----------
function iconTariffs(bx, by) {
  fill(bx + 32, by + 16, 60, 92, WHITE);
  rectBorder(bx + 32, by + 16, 60, 92, 3, INK);
  fill(bx + 42, by + 30, 40, 4, GRAY);
  fill(bx + 42, by + 42, 40, 4, GRAY);
  fill(bx + 42, by + 54, 24, 4, GRAY);
  drawText('%', bx + 47, by + 64, 6, RED);
}

function iconRefinery(bx, by) {
  fill(bx + 14, by + 102, 96, 4, INK); // ground
  fill(bx + 72, by + 44, 18, 58, WHITE); // big tower
  rectBorder(bx + 72, by + 44, 18, 58, 3, INK);
  fill(bx + 75, by + 58, 12, 2, GRAY);
  fill(bx + 75, by + 72, 12, 2, GRAY);
  fill(bx + 75, by + 86, 12, 2, GRAY);
  fill(bx + 42, by + 64, 18, 38, WHITE); // small tower
  rectBorder(bx + 42, by + 64, 18, 38, 3, INK);
  fill(bx + 45, by + 78, 12, 2, GRAY);
  fill(bx + 58, by + 72, 16, 5, INK); // pipe
  circle(bx + 81, by + 35, 7, ORANGE); // fire on big tower
  circle(bx + 81, by + 38, 4, RED);
  circle(bx + 96, by + 22, 6, GRAY); // smoke
  circle(bx + 107, by + 12, 4, GRAY);
}

function iconRocket(bx, by) {
  // station, top right
  fill(bx + 56, by + 26, 22, 9, BLUE);
  rectBorder(bx + 56, by + 26, 22, 9, 2, INK);
  fill(bx + 102, by + 26, 18, 9, BLUE);
  rectBorder(bx + 102, by + 26, 18, 9, 2, INK);
  fill(bx + 78, by + 28, 4, 5, INK);
  fill(bx + 98, by + 28, 4, 5, INK);
  circle(bx + 90, by + 30, 9, WHITE);
  for (let y = -9; y <= 9; y++) {
    const x2 = Math.floor(Math.sqrt(81 - y * y));
    for (let x = -x2; x <= x2; x++) {
      if (Math.sqrt(x * x + y * y) <= 6) px(bx + 90 + x, by + 30 + y, INK);
    }
  }
  // rocket from bottom-left to top-right
  const x0 = bx + 26;
  const y0 = by + 94;
  const d = 0.7071;
  // u along the axis toward the top-right (the station), v perpendicular
  const p = (u, v) => [x0 + (u - v) * d, y0 - (u + v) * d];
  const body = (u, v) => {
    const [wx, wy] = p(u, v);
    px(wx, wy, WHITE);
  };
  const edge = (u, v) => {
    const [wx, wy] = p(u, v);
    px(wx, wy, INK);
  };
  for (let u = -18; u <= 36; u += 0.5) {
    let half = 0;
    if (u >= -16 && u <= 20) half = 8;
    else if (u > 20 && u <= 34) half = 10 * (1 - (u - 20) / 14);
    else if (u > -18 && u < -16) half = 8 * (u + 18) / 2;
    else continue;
    for (let v = -half; v <= half; v += 0.5) {
      if (Math.abs(v) >= half - 0.5 || u < -14) edge(u, v);
      else body(u, v);
    }
  }
  // window
  const [wx, wy] = p(4, 0);
  circle(wx, wy, 3, RED);
  // flame at the tail
  const [fx, fy] = p(-16, 0);
  const [fl1x, fl1y] = p(-16, -7);
  const [fl2x, fl2y] = p(-16, 7);
  const [ftx, fty] = p(-32, 0);
  tri(fx, fy, fl1x, fl1y, ftx, fty, ORANGE);
  tri(fx, fy, fl2x, fl2y, ftx, fty, ORANGE);
  const [fc1x, fc1y] = p(-16, -3);
  const [fc2x, fc2y] = p(-16, 3);
  const [fctx, fcty] = p(-26, 0);
  tri(fx, fy, fc1x, fc1y, fctx, fcty, RED);
  tri(fx, fy, fc2x, fc2y, fctx, fcty, RED);
}

function iconCourt(bx, by) {
  fill(bx + 14, by + 100, 96, 4, INK); // steps
  fill(bx + 20, by + 94, 84, 6, INK);
  fill(bx + 16, by + 32, 92, 10, INK); // entablature
  tri(bx + 62, by + 8, bx + 12, by + 32, bx + 112, by + 32, WHITE); // pediment
  line(bx + 62, by + 8, bx + 12, by + 32, 3, INK);
  line(bx + 62, by + 8, bx + 112, by + 32, 3, INK);
  for (const cx of [20, 44, 68, 92]) {
    fill(bx + cx, by + 42, 14, 52, WHITE); // columns
    rectBorder(bx + cx, by + 42, 14, 52, 3, INK);
  }
  circle(bx + 62, by + 22, 4, RED); // seal on the pediment
}

function iconTanker(bx, by) {
  fill(bx + 10, by + 106, 104, 4, INK); // ground
  fill(bx + 34, by + 54, 14, 32, ORANGE); // fire
  tri(bx + 41, by + 22, bx + 34, by + 54, bx + 48, by + 54, ORANGE);
  tri(bx + 41, by + 34, bx + 37, by + 54, bx + 45, by + 54, RED);
  tri(bx + 61, by + 32, bx + 55, by + 54, bx + 67, by + 54, ORANGE);
  circle(bx + 50, by + 18, 5, GRAY); // smoke
  circle(bx + 64, by + 10, 4, GRAY);
  fill(bx + 16, by + 54, 62, 36, WHITE); // tank
  rectBorder(bx + 16, by + 54, 62, 36, 3, INK);
  fill(bx + 78, by + 62, 26, 28, RED); // cab
  rectBorder(bx + 78, by + 62, 26, 28, 3, INK);
  fill(bx + 84, by + 68, 12, 10, WHITE); // window
  for (const cx of [30, 56, 90]) {
    circle(bx + cx, by + 96, 9, INK); // wheels
    circle(bx + cx, by + 96, 3, WHITE);
  }
}

// ---------- page layout ----------
const STORIES = [
  { icon: iconTariffs, head: 'US TARIFFS ON 14 PARTNERS', d1: 'NEW DUTIES 20-40% FOR BIGGEST', d2: 'TRADING PARTNERS - HEARINGS 25 JAN' },
  { icon: iconRefinery, head: 'HOUTHIS HIT SAUDI REFINERY', d1: 'STRIKE ON RAS-TANURA OIL PLANT', d2: 'RIYADH TOWER HIT - 11 WOUNDED' },
  { icon: iconRocket, head: "SHENZHOU-24: PAKISTAN'S FIRST", d1: 'ASTRONAUT MUHAMMAD ZISHAN ALI', d2: 'FIRST FOREIGNER ON TIANGONG' },
  { icon: iconCourt, head: 'NETANYAHU BRIBERY CASE DROPPED', d1: 'JUDGES RECOMMEND LIFTING', d2: 'THE MOST SERIOUS BRIBERY CASE' },
  { icon: iconTanker, head: 'CAIRO FUEL TANKER FIRE', d1: 'OVERTURNED ON THE RING ROAD', d2: 'AT LEAST 30 DEAD IN THE FIRE' },
];

function render() {
  fill(0, 0, W, H, PAPER); // background
  // header
  fill(24, 20, 976, 4, RED); // red rule
  drawTextCenter('WORLD NEWS', 40, 3, GRAY);
  drawTextCenter('25 NOVEMBER 2026', 82, 6, INK); // date, well clear of neighbours
  fill(24, 140, 976, 3, INK);
  fill(24, 147, 976, 1, INK);
  // five story rows
  const top0 = 163;
  const rowH = 160;
  const gap = 9;
  for (let i = 0; i < 5; i++) {
    const T = top0 + i * (rowH + gap);
    fill(24, T, 976, 2, INK); // separator
    // icon box
    fill(24, T + 18, 124, 124, PANEL);
    rectBorder(24, T + 18, 124, 124, 2, INK);
    STORIES[i].icon(24, T + 18);
    // red tick + headline (headline ends >= 50 px before the number badge)
    fill(152, T + 20, 8, 28, RED);
    drawText(STORIES[i].head, 170, T + 20, 4, INK);
    drawText(STORIES[i].d1, 170, T + 62, 3, DARK);
    drawText(STORIES[i].d2, 170, T + 90, 3, DARK);
    // story number badge, top right
    const num = '0' + (i + 1);
    drawText(num, 1000 - textWidth(num, 4), T + 20, 4, GRAY);
  }
  fill(24, 1008, 976, 2, INK); // footer rule
}

// ---------- run ----------
render();
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePng(W, H, img);
writeFileSync(join(outDir, 'entry.png'), png);
console.log('wrote ' + join(outDir, 'entry.png') + ' (' + png.length + ' bytes)');

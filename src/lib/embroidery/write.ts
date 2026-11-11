import { JEF_PALETTE, PEC_BLANK, PEC_PALETTE } from './palettes';
import { analyse, bounds, DEFAULT_THREADS, nearestIndex, type Pattern, type Thread } from './pattern';

/*
 * Écriture des formats DST, EXP, JEF et PES (version 1, avec bloc PEC et vignettes).
 * Les déplacements trop longs pour un format sont découpés en plusieurs points ou sauts.
 */

type RecCmd = 'stitch' | 'jump' | 'trim' | 'color' | 'end';
interface Rec { dx: number; dy: number; cmd: RecCmd; x: number; y: number }

class Out {
  private a: number[] = [];
  u8(v: number) { this.a.push(v & 255); return this; }
  u16le(v: number) { return this.u8(v).u8(v >> 8); }
  u24le(v: number) { return this.u8(v).u8(v >> 8).u8(v >> 16); }
  u32le(v: number) { return this.u16le(v & 0xffff).u16le(Math.floor(v / 65536) & 0xffff); }
  i32le(v: number) { return this.u32le(v < 0 ? v + 0x100000000 : v); }
  f32le(v: number) { const b = new Uint8Array(new Float32Array([v]).buffer); b.forEach((x) => this.u8(x)); return this; }
  ascii(s: string) { for (const c of s) this.u8(c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 0x3f); return this; }
  bytes(b: ArrayLike<number>) { for (let i = 0; i < b.length; i++) this.u8(b[i]); return this; }
  get pos() { return this.a.length; }
  set16le(at: number, v: number) { this.a[at] = v & 255; this.a[at + 1] = (v >> 8) & 255; }
  set24le(at: number, v: number) { this.a[at] = v & 255; this.a[at + 1] = (v >> 8) & 255; this.a[at + 2] = (v >> 16) & 255; }
  set32le(at: number, v: number) { this.set16le(at, v & 0xffff); this.set16le(at + 2, Math.floor(v / 65536)); }
  result() { return Uint8Array.from(this.a); }
}

/** Points relatifs, découpés au pas maximal du format, terminés par « end ». */
function records(p: Pattern, max: number): Rec[] {
  const out: Rec[] = [];
  let x = 0, y = 0;
  const step = (tx: number, ty: number, cmd: 'stitch' | 'jump') => {
    tx = Math.round(tx);
    ty = Math.round(ty);
    const dx = tx - x, dy = ty - y;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / max));
    for (let i = 1; i <= n; i++) {
      const nx = x + Math.round((dx * i) / n) - Math.round((dx * (i - 1)) / n);
      const ny = y + Math.round((dy * i) / n) - Math.round((dy * (i - 1)) / n);
      out.push({ dx: nx - x, dy: ny - y, cmd, x: nx, y: ny });
      x = nx;
      y = ny;
    }
  };
  for (const s of p.stitches) {
    if (s.cmd === 'end') break;
    if (s.cmd === 'trim') out.push({ dx: 0, dy: 0, cmd: 'trim', x, y });
    else if (s.cmd === 'color') {
      if (Math.round(s.x) !== x || Math.round(s.y) !== y) step(s.x, s.y, 'jump');
      out.push({ dx: 0, dy: 0, cmd: 'color', x, y });
    } else step(s.x, s.y, s.cmd);
  }
  // Pas de changement de couleur en fin de motif, ni de sauts orphelins.
  while (out.length && (out[out.length - 1].cmd === 'color' || out[out.length - 1].cmd === 'trim')) out.pop();
  out.push({ dx: 0, dy: 0, cmd: 'end', x, y });
  return out;
}

/** Fils utilisés, un par bloc de couleur. */
function usedThreads(p: Pattern): Thread[] {
  const n = p.stitches.filter((s) => s.cmd === 'color').length + 1;
  return Array.from({ length: n }, (_, i) => p.threads[i] ?? DEFAULT_THREADS[i % DEFAULT_THREADS.length]);
}

const padName = (name: string | undefined, n: number) => (name || 'Motif').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '_').slice(0, n).padEnd(n, ' ');

/* ---- DST ---- */

function dstRecord(dx: number, dy: number, cmd: RecCmd): number[] {
  let x = dx, y = -dy;
  let b0 = 0, b1 = 0, b2 = 0;
  if (cmd === 'color') return [0, 0, 0xc3];
  if (cmd === 'end') return [0, 0, 0xf3];
  if (cmd === 'jump') b2 |= 0x80;
  b2 |= 0x03;
  const tern = (v: number, specs: [number, number, number, number, number][]) => {
    // [seuil, poids, octet(0,1,2), bit +, bit −]
    for (const [lim, w, byte, plus, minus] of specs) {
      const set = (n: number) => { if (byte === 0) b0 |= 1 << n; else if (byte === 1) b1 |= 1 << n; else b2 |= 1 << n; };
      if (v > lim) { set(plus); v -= w; }
      if (v < -lim) { set(minus); v += w; }
    }
    if (v !== 0) throw new Error('Déplacement DST hors limites.');
  };
  tern(x, [[40, 81, 2, 2, 3], [13, 27, 1, 2, 3], [4, 9, 0, 2, 3], [1, 3, 1, 0, 1], [0, 1, 0, 0, 1]]);
  tern(y, [[40, 81, 2, 5, 4], [13, 27, 1, 5, 4], [4, 9, 0, 5, 4], [1, 3, 1, 7, 6], [0, 1, 0, 7, 6]]);
  return [b0, b1, b2];
}

export function writeDst(p: Pattern): Uint8Array {
  const recs = records(p, 121);
  const b = bounds(p);
  const s = analyse(p);
  const o = new Out();
  const last = recs[recs.length - 1];
  const sign = (v: number) => `${v >= 0 ? '+' : '-'}${String(Math.abs(v)).padStart(5, ' ')}`;
  o.ascii(`LA:${padName(p.name, 16)}\r`)
    .ascii(`ST:${String(recs.length).padStart(7, ' ')}\r`)
    .ascii(`CO:${String(s.colorChanges).padStart(3, ' ')}\r`)
    .ascii(`+X:${String(Math.abs(Math.round(b.maxX))).padStart(5, ' ')}\r`)
    .ascii(`-X:${String(Math.abs(Math.round(b.minX))).padStart(5, ' ')}\r`)
    .ascii(`+Y:${String(Math.abs(Math.round(b.maxY))).padStart(5, ' ')}\r`)
    .ascii(`-Y:${String(Math.abs(Math.round(b.minY))).padStart(5, ' ')}\r`)
    .ascii(`AX:${sign(last.x)}\r`).ascii(`AY:${sign(-last.y)}\r`)
    .ascii('MX:+    0\r').ascii('MY:+    0\r').ascii('PD:******\r').u8(0x1a);
  while (o.pos < 512) o.u8(0x20);
  for (const r of recs) {
    if (r.cmd === 'trim') {
      // Coupe : trois sauts qui se compensent, compris comme une coupe par les machines.
      o.bytes(dstRecord(2, 2, 'jump')).bytes(dstRecord(-4, -4, 'jump')).bytes(dstRecord(2, 2, 'jump'));
    } else o.bytes(dstRecord(r.dx, r.dy, r.cmd));
  }
  return o.result();
}

/* ---- EXP ---- */

export function writeExp(p: Pattern): Uint8Array {
  const o = new Out();
  for (const r of records(p, 127)) {
    if (r.cmd === 'stitch') o.u8(r.dx).u8(-r.dy);
    else if (r.cmd === 'jump') o.u8(0x80).u8(0x04).u8(r.dx).u8(-r.dy);
    else if (r.cmd === 'trim') o.bytes([0x80, 0x80, 0x07, 0x00]);
    else if (r.cmd === 'color') o.bytes([0x80, 0x01, 0x00, 0x00]);
  }
  return o.result();
}

/* ---- JEF ---- */

export function writeJef(p: Pattern, date = new Date()): Uint8Array {
  const recs = records(p, 127);
  const threads = usedThreads(p);
  const palette: number[] = [];
  threads.forEach((t, i) => {
    let idx = nearestIndex(t.hex, JEF_PALETTE);
    if (i > 0 && idx === palette[i - 1] && t.hex !== threads[i - 1].hex) {
      // Deux fils voisins différents sur la même couleur Janome : on prend la deuxième plus proche.
      idx = nearestIndex(t.hex, JEF_PALETTE.map((x, k) => (k === idx ? null : x)));
    }
    palette.push(idx);
  });
  const b = bounds(p);
  const w = Math.round(b.maxX - b.minX), h = Math.round(b.maxY - b.minY);
  const hoop = w < 500 && h < 500 ? 1 : w < 1260 && h < 1100 ? 3 : w < 1400 && h < 2000 ? 2 : w < 2000 && h < 2000 ? 4 : 0;
  const hw = Math.round(w / 2), hh = Math.round(h / 2);
  const o = new Out();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const points = 1 + recs.reduce((n, r) => n + (r.cmd === 'stitch' ? 1 : r.cmd === 'jump' || r.cmd === 'color' ? 2 : 0), 0);
  o.u32le(0x74 + palette.length * 8).u32le(0x14).ascii(stamp).u8(0).u8(0).u32le(palette.length).u32le(points).u32le(hoop);
  o.u32le(hw).u32le(hh).u32le(hw).u32le(hh);
  for (const [ex, ey] of [[550 - hw, 550 - hh], [250 - hw, 250 - hh], [700 - hw, 1000 - hh], [700 - hw, 1000 - hh]]) {
    if (Math.min(ex, ey) >= 0) o.i32le(ex).i32le(ey).i32le(ex).i32le(ey);
    else o.i32le(-1).i32le(-1).i32le(-1).i32le(-1);
  }
  for (const idx of palette) o.u32le(idx);
  for (let i = 0; i < palette.length; i++) o.u32le(0x0d);
  for (const r of recs) {
    if (r.cmd === 'stitch') o.u8(r.dx).u8(-r.dy);
    else if (r.cmd === 'color') o.u8(0x80).u8(0x01).u8(r.dx).u8(-r.dy);
    else if (r.cmd === 'jump') o.u8(0x80).u8(0x02).u8(r.dx).u8(-r.dy);
  }
  o.u8(0x80).u8(0x10);
  return o.result();
}

/* ---- PEC / PES ---- */

function markBit(g: number[], x: number, y: number) {
  const i = y * 6 + Math.floor(x / 8);
  if (x >= 0 && x < 48 && i >= 0 && i < g.length) g[i] |= 1 << (x % 8);
}

function icon(points: { x: number; y: number }[], b: { minX: number; minY: number; maxX: number; maxY: number }, buffer: number): number[] {
  const g = [...PEC_BLANK];
  const dw = b.maxX - b.minX || 1, dh = b.maxY - b.minY || 1;
  const scale = Math.min((48 - buffer) / dw, (38 - buffer) / dh);
  const tx = -((b.maxX + b.minX) / 2) * scale + 24;
  const ty = -((b.maxY + b.minY) / 2) * scale + 19;
  for (const p of points) markBit(g, Math.floor(p.x * scale + tx), Math.floor(p.y * scale + ty));
  return g;
}

function pecValue(o: Out, v: number, long: boolean, flag = 0) {
  if (!long && v > -64 && v < 63) o.u8(v & 0x7f);
  else {
    const x = (v & 0x0fff) | 0x8000 | (flag << 8);
    o.u8(x >> 8).u8(x);
  }
}

function writePec(o: Out, p: Pattern, recs: Rec[], pecIndices: number[]) {
  const start = o.pos;
  o.ascii(`LA:${padName(p.name, 8).padEnd(16, ' ')}\r`);
  o.bytes([0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0xff, 0x00]);
  o.u8(6).u8(38);
  o.bytes(new Array(12).fill(0x20));
  o.u8(pecIndices.length - 1).bytes(pecIndices);
  while (o.pos < start + 512) o.u8(0x20);
  const b = bounds(p);
  const blockStart = o.pos;
  o.u8(0).u8(0).u24le(0).bytes([0x31, 0xff, 0xf0]);
  o.u16le(Math.round(b.maxX - b.minX)).u16le(Math.round(b.maxY - b.minY)).u16le(0x1e0).u16le(0x1b0);
  let jumping = true, init = true, colorTwo = true;
  for (const r of recs) {
    if (r.cmd === 'stitch') {
      if (jumping) {
        if (r.dx !== 0 && r.dy !== 0) { pecValue(o, 0, false); pecValue(o, 0, false); }
        jumping = false;
      }
      pecValue(o, r.dx, false);
      pecValue(o, r.dy, false);
    } else if (r.cmd === 'jump') {
      jumping = true;
      const flag = init ? 0x10 : 0x20;
      pecValue(o, r.dx, true, flag);
      pecValue(o, r.dy, true, flag);
    } else if (r.cmd === 'color') {
      if (jumping) { pecValue(o, 0, false); pecValue(o, 0, false); jumping = false; }
      o.u8(0xfe).u8(0xb0).u8(colorTwo ? 2 : 1);
      colorTwo = !colorTwo;
    } else if (r.cmd === 'end') {
      o.u8(0xff);
      break;
    }
    init = false;
  }
  o.set24le(blockStart + 2, o.pos - blockStart);
  // Vignettes : le motif entier, puis un dessin par couleur.
  const all = p.stitches.filter((s) => s.cmd === 'stitch');
  o.bytes(icon(all, b, 4));
  for (const block of analyse(p).blocks) o.bytes(icon(block.runs.flat(), b, 5));
}

/** PES version 1 : en-tête et blocs « CEmbOne / CSewSeg », puis bloc PEC. */
export function writePes(p: Pattern): Uint8Array {
  const recs = records(p, 2047);
  const threads = usedThreads(p);
  // Index PEC distincts pour des fils distincts (comme les logiciels Brother).
  const free = [...PEC_PALETTE];
  const byHex = new Map<string, number>();
  for (const t of threads) {
    if (byHex.has(t.hex)) continue;
    const i = nearestIndex(t.hex, free);
    if (i < 0) break;
    byHex.set(t.hex, i);
    free[i] = null;
  }
  const pecIndices = threads.map((t) => byHex.get(t.hex) ?? nearestIndex(t.hex, PEC_PALETTE));
  const colorCodes = threads.map((t) => nearestIndex(t.hex, PEC_PALETTE));

  const o = new Out();
  o.ascii('#PES0001');
  const pecPlaceholder = o.pos;
  o.u32le(0);
  const b = bounds(p);
  const width = b.maxX - b.minX, height = b.maxY - b.minY;
  o.u16le(1).u16le(1).u16le(1).u16le(0xffff).u16le(0);
  o.u16le(7).ascii('CEmbOne');
  for (let i = 0; i < 8; i++) o.u16le(0);
  const tx = 350 + 650 - width / 2, ty = 100 + height + 900 - height / 2;
  o.f32le(1).f32le(0).f32le(0).f32le(1).f32le(tx).f32le(ty);
  o.u16le(1).u16le(0).u16le(0).u16le(Math.trunc(width)).u16le(Math.trunc(height));
  o.bytes([0, 0, 0, 0, 0, 0, 0, 0]);
  const sectionsAt = o.pos;
  o.u16le(0);
  o.u16le(0xffff).u16le(0);
  o.u16le(7).ascii('CSewSeg');
  // Segments : suites de points cousus (drapeau 0) et sauts (drapeau 1), relatifs au coin bas gauche.
  const ax = b.minX, ay = b.maxY;
  const segs: { pts: [number, number][]; color: number; flag: number }[] = [];
  let colorIdx = 0;
  let sx = 0, sy = 0;
  let run: [number, number][] = [];
  let runCmd: 'stitch' | 'jump' | undefined;
  let jumpEnd: [number, number] | undefined;
  const flush = () => {
    if (runCmd === 'stitch' && run.length) segs.push({ pts: run, color: colorCodes[colorIdx] ?? 0, flag: 0 });
    if (runCmd === 'jump' && jumpEnd) segs.push({ pts: [[sx - ax, sy - ay], jumpEnd], color: colorCodes[colorIdx] ?? 0, flag: 1 });
    run = [];
    runCmd = undefined;
    jumpEnd = undefined;
  };
  for (const s of p.stitches) {
    if (s.cmd === 'stitch') {
      if (runCmd !== 'stitch') flush();
      runCmd = 'stitch';
      sx = s.x;
      sy = s.y;
      run.push([s.x - ax, s.y - ay]);
    } else if (s.cmd === 'jump') {
      if (runCmd !== 'jump') flush();
      runCmd = 'jump';
      jumpEnd = [s.x - ax, s.y - ay];
    } else if (s.cmd === 'color') {
      flush();
      colorIdx++;
    }
  }
  flush();
  const colorLog: [number, number][] = [];
  let prevColor = -1;
  segs.forEach((sg, i) => {
    if (i > 0) o.u16le(0x8003);
    if (sg.color !== prevColor) {
      colorLog.push([i, sg.color]);
      prevColor = sg.color;
    }
    o.u16le(sg.flag).u16le(sg.color).u16le(sg.pts.length);
    for (const [x, y] of sg.pts) o.u16le(Math.trunc(x) & 0xffff).u16le(Math.trunc(y) & 0xffff);
  });
  o.u16le(colorLog.length);
  for (const [sec, code] of colorLog) o.u16le(sec).u16le(code);
  o.set16le(sectionsAt, segs.length);
  o.u16le(0).u16le(0);
  o.set32le(pecPlaceholder, o.pos);
  writePec(o, p, recs, pecIndices);
  return o.result();
}

export type OutputFormat = 'PES' | 'DST' | 'JEF' | 'EXP';

export function writePattern(p: Pattern, fmt: OutputFormat): Uint8Array {
  if (fmt === 'PES') return writePes(p);
  if (fmt === 'DST') return writeDst(p);
  if (fmt === 'JEF') return writeJef(p);
  return writeExp(p);
}

/** Ce que l'on perd en convertissant vers un format. */
export function conversionNotes(p: Pattern, fmt: OutputFormat): string[] {
  const notes: string[] = [];
  if (fmt === 'DST' || fmt === 'EXP') notes.push('Ce format n’enregistre pas les couleurs des fils : la machine affichera ses couleurs par défaut, l’ordre des changements de couleur est conservé.');
  if (fmt === 'PES' || fmt === 'JEF') notes.push(`Les couleurs sont ramenées à la plus proche de la palette ${fmt === 'PES' ? 'Brother' : 'Janome'}.`);
  if (fmt === 'EXP' || fmt === 'JEF') notes.push('Les coupes de fil sont transmises sous forme de sauts : selon la machine, il faudra peut-être couper à la main.');
  const s = analyse(p);
  if (s.widthMm > 200 || s.heightMm > 300) notes.push(`Motif de ${s.widthMm.toFixed(0)} × ${s.heightMm.toFixed(0)} mm : vérifiez qu’il tient dans le cadre de votre machine.`);
  return notes;
}

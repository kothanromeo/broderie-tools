import { JEF_PALETTE, PEC_PALETTE } from './palettes';
import { EmbroideryError, type Format, type Pattern, type Stitch, type Thread } from './pattern';

/*
 * Lecture des formats de broderie machine. Coordonnées en dixièmes de millimètre, Y vers le bas.
 *   DST (Tajima) : en-tête texte de 512 octets, puis points de 3 octets en ternaire équilibré.
 *   PES/PEC (Brother) : en-tête PES facultatif, puis bloc PEC (palette de 64 fils, points sur 7 ou 12 bits).
 *   JEF (Janome) : en-tête binaire, index de couleurs Janome, points de 2 octets signés.
 *   EXP (Melco, Bernina) : uniquement des points de 2 octets signés, codes d'échappement 0x80.
 */

class Bytes {
  pos = 0;
  constructor(public b: Uint8Array) {}
  get left() { return this.b.length - this.pos; }
  u8() { if (this.pos >= this.b.length) throw new EmbroideryError('Fichier tronqué.'); return this.b[this.pos++]; }
  u16le() { return this.u8() | (this.u8() << 8); }
  u24le() { return this.u8() | (this.u8() << 8) | (this.u8() << 16); }
  u32le() { return (this.u8() | (this.u8() << 8) | (this.u8() << 16)) + this.u8() * 0x1000000; }
  i32le() { const v = this.u32le(); return v > 0x7fffffff ? v - 0x100000000 : v; }
  str(n: number) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8()); return s; }
  skip(n: number) { this.pos += n; }
}

const s8 = (b: number) => (b > 127 ? b - 256 : b);
const latin1 = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
const empty = (format: Format): Pattern => ({ format, stitches: [], threads: [], meta: {}, warnings: [] });

/** Ajoute un point en relatif. */
class Builder {
  x = 0;
  y = 0;
  constructor(public p: Pattern) {}
  add(dx: number, dy: number, cmd: Stitch['cmd']) {
    this.x += dx;
    this.y += dy;
    this.p.stitches.push({ x: this.x, y: this.y, cmd });
  }
}

/* ---- DST ---- */

const bit = (b: number, n: number) => (b >> n) & 1;
function dstDx(b0: number, b1: number, b2: number) {
  return bit(b2, 2) * 81 - bit(b2, 3) * 81 + bit(b1, 2) * 27 - bit(b1, 3) * 27 + bit(b0, 2) * 9 - bit(b0, 3) * 9
    + bit(b1, 0) * 3 - bit(b1, 1) * 3 + bit(b0, 0) - bit(b0, 1);
}
function dstDy(b0: number, b1: number, b2: number) {
  return -(bit(b2, 5) * 81 - bit(b2, 4) * 81 + bit(b1, 5) * 27 - bit(b1, 4) * 27 + bit(b0, 5) * 9 - bit(b0, 4) * 9
    + bit(b1, 7) * 3 - bit(b1, 6) * 3 + bit(b0, 7) - bit(b0, 6));
}

export function readDst(buf: Uint8Array): Pattern {
  if (buf.length < 512) throw new EmbroideryError('Fichier DST trop court : l’en-tête de 512 octets est incomplet.');
  if (String.fromCharCode(buf[0], buf[1], buf[2]) !== 'LA:') throw new EmbroideryError('Ce fichier n’a pas l’en-tête d’un DST (il devrait commencer par « LA: »).');
  const p = empty('DST');
  const header = String.fromCharCode(...buf.subarray(0, 512));
  for (const line of header.split(/[\r\n\x1a]/)) {
    const m = line.match(/^([A-Z+-]{2}):(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'LA') p.name = latin1(v);
    else if (k === 'TC') {
      const [hex, name, code] = v.split(',').map((x) => x.trim());
      if (/^#?[0-9a-f]{6}$/i.test(hex)) p.threads.push({ hex: hex.replace('#', '').toLowerCase(), name, code });
    } else p.meta[k] = latin1(v);
  }
  const b = new Builder(p);
  let jumps = 0;
  for (let i = 512; i + 3 <= buf.length; i += 3) {
    const [b0, b1, b2] = [buf[i], buf[i + 1], buf[i + 2]];
    const dx = dstDx(b0, b1, b2);
    const dy = dstDy(b0, b1, b2);
    if ((b2 & 0xf3) === 0xf3) {
      b.add(0, 0, 'end');
      break;
    }
    if ((b2 & 0xc3) === 0xc3) b.add(dx, dy, 'color');
    else if ((b2 & 0x83) === 0x83) { b.add(dx, dy, 'jump'); jumps++; continue; }
    else b.add(dx, dy, 'stitch');
    jumps = 0;
  }
  return markTrims(p, 3);
}

/** DST et EXP n'ont pas de commande de coupe : trois sauts consécutifs ou plus valent une coupe. */
function markTrims(p: Pattern, count: number): Pattern {
  const out: Stitch[] = [];
  let run: Stitch[] = [];
  const flush = () => {
    if (run.length >= count) out.push({ ...run[0], cmd: 'trim' });
    out.push(...run);
    run = [];
  };
  for (const s of p.stitches) {
    if (s.cmd === 'jump') run.push(s);
    else {
      flush();
      out.push(s);
    }
  }
  flush();
  p.stitches = out;
  return p;
}

/* ---- PEC / PES ---- */

const PEC_JUMP = 0x10, PEC_TRIM = 0x20, PEC_LONG = 0x80;
const s12 = (v: number) => { v &= 0xfff; return v > 0x7ff ? v - 0x1000 : v; };
const s7 = (v: number) => (v > 63 ? v - 128 : v);

function readPecBlock(r: Bytes, p: Pattern, chart: Thread[]) {
  const start = r.pos;
  r.skip(3); // LA:
  const label = latin1(r.str(16));
  if (label && !p.name) p.name = label;
  r.pos = start + 48;
  const colorChanges = r.u8();
  const count = colorChanges + 1;
  const indices: number[] = [];
  for (let i = 0; i < count; i++) indices.push(r.u8());
  if (chart.length >= count) p.threads = chart.slice(0, count);
  else {
    const fromChart = new Map<number, Thread>();
    p.threads = indices.map((idx) => {
      const pal = PEC_PALETTE[idx % PEC_PALETTE.length];
      if (chart.length) {
        // Fils déclarés en en-tête PES : attribués dans l'ordre des couleurs PEC distinctes.
        if (!fromChart.has(idx)) fromChart.set(idx, chart.shift() ?? { hex: pal?.hex ?? '000000', name: pal?.name });
        return fromChart.get(idx)!;
      }
      return pal ? { hex: pal.hex, name: pal.name, code: pal.code, brand: 'Brother' } : { hex: '000000' };
    });
  }
  r.pos = start + 512 + 2;
  r.u24le(); // longueur du bloc de points
  r.pos = start + 512 + 16;
  const b = new Builder(p);
  while (r.left >= 2) {
    let v1 = r.u8();
    let v2 = r.u8();
    if (v1 === 0xff && v2 === 0x00) break;
    if (v1 === 0xfe && v2 === 0xb0) {
      r.skip(1);
      b.add(0, 0, 'color');
      continue;
    }
    let jump = false, trim = false, x: number, y: number;
    if (v1 & PEC_LONG) {
      if (v1 & PEC_TRIM) trim = true;
      if (v1 & PEC_JUMP) jump = true;
      x = s12((v1 << 8) | v2);
      v2 = r.u8();
    } else x = s7(v1);
    if (v2 & PEC_LONG) {
      if (v2 & PEC_TRIM) trim = true;
      if (v2 & PEC_JUMP) jump = true;
      y = s12((v2 << 8) | r.u8());
    } else y = s7(v2);
    if (trim) {
      b.add(0, 0, 'trim');
      b.add(x, y, 'jump');
    } else b.add(x, y, jump ? 'jump' : 'stitch');
  }
  b.add(0, 0, 'end');
}

function pesString(r: Bytes) {
  const n = r.u8();
  return n ? latin1(r.str(n)) : '';
}

function readPesThreads(r: Bytes, p: Pattern, version: number): Thread[] {
  r.skip(4);
  const fields = ['name', 'category', 'author', 'keywords', 'comments'];
  for (const f of fields) {
    const v = pesString(r);
    if (v) p.meta[f] = v;
  }
  if (p.meta.name) p.name = p.meta.name;
  if (version < 5) return [];
  if (version >= 9) {
    r.skip(14);
    pesString(r);
    r.skip(version >= 10 ? 38 : 30);
  } else r.skip(version === 5 ? 24 : version === 8 ? 38 : 36);
  pesString(r);
  r.skip(version >= 9 ? 34 : version === 8 ? 26 : 24);
  if (r.u16le() || r.u16le() || r.u16le()) return []; // remplissages programmables, motifs, plumes : structure non lue
  const n = r.u16le();
  const threads: Thread[] = [];
  for (let i = 0; i < n; i++) {
    const code = pesString(r);
    const hex = [r.u8(), r.u8(), r.u8()].map((v) => v.toString(16).padStart(2, '0')).join('');
    r.skip(5);
    const name = pesString(r);
    const brand = pesString(r);
    pesString(r);
    threads.push({ hex, name: name || undefined, code: code || undefined, brand: brand || undefined });
  }
  return threads;
}

export function readPes(buf: Uint8Array): Pattern {
  const r = new Bytes(buf);
  const magic = r.str(8);
  if (magic === '#PEC0001') {
    const p = empty('PEC');
    readPecBlock(r, p, []);
    return p;
  }
  if (!magic.startsWith('#PES')) throw new EmbroideryError('Ce fichier n’est pas un PES (signature #PES absente).');
  const p = empty('PES');
  p.version = magic;
  const pecPos = r.u32le();
  if (pecPos <= 12 || pecPos >= buf.length) throw new EmbroideryError('Fichier PES abîmé : position du bloc PEC invalide.');
  const v = Number(magic.slice(4)) / (magic === '#PES0001' ? 1 : 10);
  let chart: Thread[] = [];
  try {
    if (v >= 4) chart = readPesThreads(r, p, Math.floor(v));
  } catch {
    p.warnings.push('Informations de fils de l’en-tête PES illisibles : couleurs de la palette Brother utilisées.');
  }
  r.pos = pecPos;
  readPecBlock(r, p, chart);
  return p;
}

/* ---- JEF ---- */

export function readJef(buf: Uint8Array): Pattern {
  const r = new Bytes(buf);
  const p = empty('JEF');
  const stitchOffset = r.u32le();
  if (stitchOffset < 116 || stitchOffset > buf.length) throw new EmbroideryError('Ce fichier n’a pas la structure d’un JEF.');
  r.skip(4);
  const date = r.str(14);
  if (/^\d{14}$/.test(date)) p.meta.date = `${date.slice(6, 8)}/${date.slice(4, 6)}/${date.slice(0, 4)}`;
  r.pos = 24;
  const colors = r.u32le();
  if (colors > 255) throw new EmbroideryError('Ce fichier n’a pas la structure d’un JEF.');
  r.pos = 116;
  for (let i = 0; i < colors; i++) {
    const idx = Math.abs(r.i32le());
    const t = JEF_PALETTE[idx % JEF_PALETTE.length];
    p.threads.push(t ? { hex: t.hex, name: t.name, code: t.code, brand: 'Janome' } : { hex: '000000', name: 'Arrêt' });
  }
  r.pos = stitchOffset;
  const b = new Builder(p);
  while (r.left >= 2) {
    const a = r.u8(), c = r.u8();
    if (a !== 0x80) {
      b.add(s8(a), -s8(c), 'stitch');
      continue;
    }
    if (c === 0x10) break;
    if (r.left < 2) break;
    const x = s8(r.u8()), y = -s8(r.u8());
    if (c === 0x02) b.add(x, y, 'jump');
    else if (c === 0x01) {
      b.add(0, 0, 'color');
      if (x || y) b.add(x, y, 'jump');
    } else break;
  }
  b.add(0, 0, 'end');
  return markTrims(p, 3);
}

/* ---- EXP ---- */

export function readExp(buf: Uint8Array): Pattern {
  const r = new Bytes(buf);
  const p = empty('EXP');
  const b = new Builder(p);
  while (r.left >= 2) {
    const a = r.u8(), c = r.u8();
    if (a !== 0x80) {
      b.add(s8(a), -s8(c), 'stitch');
      continue;
    }
    if (r.left < 2) break;
    const x = s8(r.u8()), y = -s8(r.u8());
    if (c === 0x80) b.add(0, 0, 'trim');
    else if (c === 0x02) b.add(x, y, 'stitch');
    else if (c === 0x04) b.add(x, y, 'jump');
    else if (c === 0x01) {
      b.add(0, 0, 'color');
      if (x || y) b.add(x, y, 'jump');
    } else break;
  }
  b.add(0, 0, 'end');
  return p;
}

/* ---- Détection ---- */

export const FORMATS: Format[] = ['PES', 'PEC', 'DST', 'JEF', 'EXP'];

export function detect(buf: Uint8Array, fileName = ''): Format | undefined {
  const head = String.fromCharCode(...buf.subarray(0, 8));
  if (head.startsWith('#PES')) return 'PES';
  if (head === '#PEC0001') return 'PEC';
  if (head.startsWith('LA:') && buf.length >= 512) return 'DST';
  const ext = fileName.split('.').pop()?.toUpperCase();
  if (ext && (FORMATS as string[]).includes(ext)) return ext as Format;
  return undefined;
}

export function readPattern(buf: Uint8Array, fileName = ''): Pattern {
  const fmt = detect(buf, fileName);
  const ext = fileName.split('.').pop()?.toUpperCase() ?? '';
  if (!fmt) {
    if (['VP3', 'HUS', 'VIP', 'XXX', 'PCS', 'SEW', 'ART', 'EMB'].includes(ext)) {
      throw new EmbroideryError(`Le format .${ext.toLowerCase()} n’est pas encore pris en charge. Formats lus : PES, PEC, DST, JEF, EXP.`);
    }
    throw new EmbroideryError('Format de broderie non reconnu. Formats lus : PES, PEC, DST, JEF, EXP.');
  }
  const p = fmt === 'PES' || fmt === 'PEC' ? readPes(buf) : fmt === 'DST' ? readDst(buf) : fmt === 'JEF' ? readJef(buf) : readExp(buf);
  const pts = p.stitches.filter((s) => s.cmd === 'stitch');
  if (!pts.length || pts.every((s) => s.x === pts[0].x && s.y === pts[0].y)) {
    throw new EmbroideryError('Aucun point de broderie dans ce fichier : il est vide ou ce n’est pas le format annoncé.');
  }
  if (!p.name) p.name = fileName.replace(/\.[^.]+$/, '');
  return p;
}

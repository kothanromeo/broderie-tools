/*
 * Modèle commun d'un motif de broderie : une suite de points en coordonnées absolues,
 * en dixièmes de millimètre, l'axe Y orienté vers le bas (comme à l'écran).
 */

export type Cmd = 'stitch' | 'jump' | 'trim' | 'color' | 'end';

export interface Stitch {
  x: number;
  y: number;
  cmd: Cmd;
}

export interface Thread {
  /** Couleur « rrggbb ». */
  hex: string;
  name?: string;
  code?: string;
  brand?: string;
}

export type Format = 'PES' | 'PEC' | 'DST' | 'JEF' | 'EXP';

export interface Pattern {
  format: Format;
  /** Version de format (ex. « #PES0060 »), si connue. */
  version?: string;
  name?: string;
  stitches: Stitch[];
  threads: Thread[];
  meta: Record<string, string>;
  warnings: string[];
}

export class EmbroideryError extends Error {}

/** Fils par défaut quand le fichier n'en donne pas (DST, EXP) : couleurs bien distinctes. */
export const DEFAULT_THREADS: Thread[] = [
  '1f3a93', 'd62828', '2a9d8f', 'f4a261', '6a4c93', '2b2d42', 'e9c46a', '8ac926', 'ff006e', '3a86ff', '8d6e63', '00b4d8',
].map((hex, i) => ({ hex, name: `Couleur ${i + 1}` }));

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Emprise des points cousus (les sauts ne comptent pas). */
export function bounds(p: Pattern): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of p.stitches) {
    if (s.cmd !== 'stitch') continue;
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

export interface ColorBlock {
  thread: Thread;
  /** Index dans la liste des fils. */
  index: number;
  stitches: number;
  /** Segments cousus continus (sans saut ni coupe). */
  runs: Stitch[][];
  /** Longueur de fil cousu, en mm. */
  lengthMm: number;
}

export interface Stats {
  stitches: number;
  jumps: number;
  trims: number;
  colorChanges: number;
  widthMm: number;
  heightMm: number;
  threadLengthM: number;
  blocks: ColorBlock[];
}

/** Découpe le motif en blocs de couleur et en segments cousus continus. */
export function analyse(p: Pattern): Stats {
  const blocks: ColorBlock[] = [];
  let colorIndex = 0;
  const threadAt = (i: number) => p.threads[i] ?? DEFAULT_THREADS[i % DEFAULT_THREADS.length];
  let block: ColorBlock = { thread: threadAt(0), index: 0, stitches: 0, runs: [], lengthMm: 0 };
  let run: Stitch[] = [];
  let stitches = 0, jumps = 0, trims = 0, colorChanges = 0;
  let prev: Stitch | undefined;
  const closeRun = () => {
    if (run.length > 1) block.runs.push(run);
    run = [];
  };
  for (const s of p.stitches) {
    switch (s.cmd) {
      case 'stitch':
        stitches++;
        block.stitches++;
        if (prev && run.length) block.lengthMm += Math.hypot(s.x - prev.x, s.y - prev.y) / 10;
        if (!run.length && prev) run.push({ ...prev, cmd: 'stitch' });
        run.push(s);
        break;
      case 'jump':
        jumps++;
        closeRun();
        break;
      case 'trim':
        trims++;
        closeRun();
        break;
      case 'color':
        closeRun();
        if (block.stitches) blocks.push(block);
        colorChanges++;
        colorIndex++;
        block = { thread: threadAt(colorIndex), index: colorIndex, stitches: 0, runs: [], lengthMm: 0 };
        break;
      case 'end':
        break;
    }
    prev = s;
  }
  closeRun();
  if (block.stitches) blocks.push(block);
  const b = bounds(p);
  return {
    stitches, jumps, trims, colorChanges,
    widthMm: (b.maxX - b.minX) / 10,
    heightMm: (b.maxY - b.minY) / 10,
    threadLengthM: blocks.reduce((t, x) => t + x.lengthMm, 0) / 1000,
    blocks,
  };
}

/* ---- Couleurs ---- */

export const rgb = (hex: string) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

/** Distance « red mean » (compuphase), la même que les logiciels de broderie libres. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const rm = Math.round((r1 + r2) / 2);
  const r = r1 - r2, g = g1 - g2, bl = b1 - b2;
  return (((512 + rm) * r * r) >> 8) + 4 * g * g + (((767 - rm) * bl * bl) >> 8);
}

/** Index de la couleur la plus proche dans une palette (les entrées nulles sont ignorées). */
export function nearestIndex(hex: string, palette: ({ hex: string } | null)[]): number {
  let best = -1;
  let bestDist = Infinity;
  palette.forEach((t, i) => {
    if (!t) return;
    const d = colorDistance(hex, t.hex);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/* ---- Cadres usuels ---- */

export const HOOPS: { label: string; w: number; h: number }[] = [
  { label: '100 × 100 mm', w: 100, h: 100 },
  { label: '130 × 180 mm', w: 130, h: 180 },
  { label: '160 × 260 mm', w: 160, h: 260 },
  { label: '200 × 200 mm', w: 200, h: 200 },
  { label: '200 × 300 mm', w: 200, h: 300 },
  { label: '240 × 360 mm', w: 240, h: 360 },
];

/** Plus petit cadre usuel qui contient le motif (dans un sens ou dans l'autre). */
export function smallestHoop(widthMm: number, heightMm: number) {
  return HOOPS.find((h) => (widthMm <= h.w && heightMm <= h.h) || (widthMm <= h.h && heightMm <= h.w));
}

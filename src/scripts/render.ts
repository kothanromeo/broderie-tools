import { bounds, DEFAULT_THREADS, rgb, type Pattern } from '../lib/embroidery/pattern';

/* Dessin d'un motif sur un canvas : fil en relief, sauts en option, zoom et simulation pas à pas. */

export interface RenderOptions {
  /** Nombre de points à dessiner (simulation) ; Infinity pour tout. */
  upTo: number;
  showJumps: boolean;
  realistic: boolean;
  background: string;
  zoom: number;
  panX: number;
  panY: number;
}

interface Piece {
  color: string;
  /** Points cousus continus, en coordonnées du motif. */
  pts: [number, number][];
  /** Index du premier point (dans l'ordre de couture). */
  first: number;
  jump: boolean;
}

/** Prépare les morceaux à dessiner, dans l'ordre de couture. */
export function pieces(p: Pattern): { list: Piece[]; total: number } {
  const list: Piece[] = [];
  let color = 0;
  const hex = (i: number) => '#' + (p.threads[i] ?? DEFAULT_THREADS[i % DEFAULT_THREADS.length]).hex;
  let cur: Piece | undefined;
  let n = 0;
  let prev: { x: number; y: number } | undefined;
  for (const s of p.stitches) {
    if (s.cmd === 'stitch') {
      if (!cur) {
        cur = { color: hex(color), pts: prev ? [[prev.x, prev.y]] : [], first: n, jump: false };
        list.push(cur);
      }
      cur.pts.push([s.x, s.y]);
      n++;
    } else if (s.cmd === 'jump') {
      if (prev && (cur || list.length)) list.push({ color: '#9aa3ad', pts: [[prev.x, prev.y], [s.x, s.y]], first: n, jump: true });
      cur = undefined;
    } else if (s.cmd === 'trim') cur = undefined;
    else if (s.cmd === 'color') {
      color++;
      cur = undefined;
    }
    prev = s;
  }
  return { list, total: n };
}

const shade = (hex: string, f: number) => {
  const [r, g, b] = rgb(hex.slice(1));
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
};

export function draw(canvas: HTMLCanvasElement, p: Pattern, prepared: ReturnType<typeof pieces>, o: RenderOptions) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = o.background;
  ctx.fillRect(0, 0, W, H);
  const b = bounds(p);
  const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
  const base = Math.min((W * 0.92) / w, (H * 0.92) / h);
  const scale = base * o.zoom;
  const tx = W / 2 - ((b.minX + b.maxX) / 2) * scale + o.panX;
  const ty = H / 2 - ((b.minY + b.maxY) / 2) * scale + o.panY;
  ctx.setTransform(scale, 0, 0, scale, tx, ty);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Épaisseur d'un fil de broderie : environ 0,4 mm, jamais moins d'un pixel à l'écran.
  const thread = Math.max(4, 1.1 / scale);
  for (const pc of prepared.list) {
    if (pc.first >= o.upTo) break;
    let pts = pc.pts;
    if (!pc.jump && pc.first + pts.length - 1 > o.upTo) pts = pts.slice(0, Math.max(1, o.upTo - pc.first + 1));
    if (pts.length < 2) continue;
    if (pc.jump) {
      if (!o.showJumps) continue;
      ctx.setLineDash([6 / scale, 6 / scale]);
      ctx.strokeStyle = pc.color;
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    if (o.realistic) {
      // Chaque point est un petit cylindre : ombre, corps, reflet.
      for (const [width, color] of [[thread * 1.15, shade(pc.color, -0.45)], [thread * 0.8, pc.color], [thread * 0.28, shade(pc.color, 0.45)]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 1; i < pts.length; i++) {
          ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = pc.color;
      ctx.lineWidth = Math.max(1 / scale, thread * 0.5);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

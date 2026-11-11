import type { Pattern, Stitch } from './pattern';

/*
 * Motif de démonstration dessiné par programme : une fleur à six pétales (remplissage),
 * un cœur en point satin, une tige et deux feuilles. Environ 80 × 95 mm, quatre couleurs.
 */

export function sampleFlower(): Pattern {
  const st: Stitch[] = [];
  const K = 1.7; // échelle : le dessin est conçu en unités réduites
  const add = (x: number, y: number, cmd: Stitch['cmd'] = 'stitch') => st.push({ x: Math.round(x * K), y: Math.round(y * K), cmd });
  const jumpTo = (x: number, y: number) => {
    const last = st[st.length - 1];
    if (last && Math.hypot(last.x - x * K, last.y - y * K) > 50) st.push({ ...last, cmd: 'trim' });
    add(x, y, 'jump');
  };

  /** Remplissage d'une ellipse tournée, par lignes alternées. */
  const fillEllipse = (cx: number, cy: number, rx: number, ry: number, angle: number, spacing = 4, stitch = 28) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const tr = (x: number, y: number): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos];
    let first = true;
    let dir = 1;
    for (let y = -ry + spacing / 2; y <= ry; y += spacing) {
      const half = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
      if (half < 2) continue;
      const xs = dir > 0 ? [-half, half] : [half, -half];
      const n = Math.max(1, Math.round((2 * half) / stitch));
      const [sx, sy] = tr(xs[0], y);
      if (first) {
        jumpTo(sx, sy);
        first = false;
      }
      for (let i = 0; i <= n; i++) add(...tr(xs[0] + ((xs[1] - xs[0]) * i) / n, y));
      dir = -dir;
    }
  };

  // 1. Pétales (rose)
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 - Math.PI / 2;
    fillEllipse(Math.cos(a) * 140, -120 + Math.sin(a) * 140, 105, 62, a);
  }
  st.push({ ...st[st.length - 1], cmd: 'color' });

  // 2. Cœur en satin (jaune) : zigzag sur deux cercles concentriques
  jumpTo(70, -120);
  for (let i = 0; i <= 220; i++) {
    const a = (i / 220) * Math.PI * 2;
    const r = i % 2 ? 72 : 30;
    add(Math.cos(a) * r, -120 + Math.sin(a) * r);
  }
  // remplissage du centre
  fillEllipse(0, -120, 32, 32, 0, 5, 20);
  st.push({ ...st[st.length - 1], cmd: 'color' });

  // 3. Tige (vert foncé) : point triple
  jumpTo(0, 20);
  for (let i = 0; i <= 30; i++) {
    const y = 20 + i * 18;
    const x = Math.sin(i / 6) * 25;
    add(x, y);
    if (i > 0) {
      add(x - 2, y - 18);
      add(x, y);
    }
  }
  st.push({ ...st[st.length - 1], cmd: 'color' });

  // 4. Feuilles (vert clair)
  fillEllipse(-110, 300, 95, 38, -0.5);
  fillEllipse(110, 400, 95, 38, 0.5);
  st.push({ ...st[st.length - 1], cmd: 'end' });

  return {
    format: 'PES',
    name: 'Fleur',
    stitches: st,
    threads: [
      { hex: 'e8578f', name: 'Rose' },
      { hex: 'f6c445', name: 'Jaune' },
      { hex: '2e6b3a', name: 'Vert foncé' },
      { hex: '7cbf5a', name: 'Vert clair' },
    ],
    meta: {},
    warnings: [],
  };
}

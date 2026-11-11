import { analyse, smallestHoop, type Pattern, type Stats } from '../lib/embroidery/pattern';
import { readPattern } from '../lib/embroidery/read';
import { conversionNotes, writePattern, type OutputFormat } from '../lib/embroidery/write';
import { bindThanks, thanksCard, waitCard } from './creator';
import { draw, pieces, type RenderOptions } from './render';
import { bindDrop, download, esc } from './ui';

const BACKGROUNDS: Record<string, string> = { blanc: '#ffffff', lin: '#efe6d5', jean: '#3c4f6b', noir: '#141414' };
const BRANDS: Record<OutputFormat, string> = { PES: 'Brother, Babylock, Bernette', DST: 'Tajima et la plupart des machines', JEF: 'Janome, Elna', EXP: 'Melco, Bernina' };
const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

function minutes(s: Stats) {
  // Vitesse moyenne d'une brodeuse domestique : 650 points par minute, plus ~30 s par changement de fil.
  return Math.round(s.stitches / 650 + s.colorChanges * 0.5);
}

function infoHtml(p: Pattern, s: Stats, mode: string): string {
  const hoop = smallestHoop(s.widthMm, s.heightMm);
  const colors = s.blocks.map((b, i) => `<li><span class="swatch" style="background:#${esc(b.thread.hex)}"></span>
    <span><strong>${i + 1}. ${esc(b.thread.name || '#' + b.thread.hex)}</strong>${b.thread.code ? ` <small>${esc(b.thread.brand ?? '')} ${esc(b.thread.code)}</small>` : ''}<br>
    <small>${nf(b.stitches)} points · ${nf(b.lengthMm / 1000, 1)} m de fil</small></span></li>`).join('');
  const convert = (['PES', 'DST', 'JEF', 'EXP'] as OutputFormat[]).map((f) => `<button type="button" class="btn ${f === p.format ? 'ghost' : mode === 'convert' ? '' : 'secondary'}" data-convert="${f}" title="${BRANDS[f]}">${f}</button>`).join('');
  return `<div class="emb-info card">
      <h3 style="margin-top:0">${esc(p.name || 'Motif')}</h3>
      <dl class="kv">
        <dt>Format</dt><dd>${p.format}${p.version ? ` <small class="mono">${esc(p.version)}</small>` : ''}</dd>
        <dt>Dimensions</dt><dd><strong>${nf(s.widthMm, 1)} × ${nf(s.heightMm, 1)} mm</strong> <small>(${nf(s.widthMm / 25.4, 2)} × ${nf(s.heightMm / 25.4, 2)} in)</small></dd>
        <dt>Cadre minimal</dt><dd>${hoop ? hoop.label : '<span class="neg">plus grand que 240 × 360 mm</span>'}</dd>
        <dt>Points</dt><dd>${nf(s.stitches)}</dd>
        <dt>Couleurs</dt><dd>${s.blocks.length} <small>(${s.colorChanges} changement${s.colorChanges > 1 ? 's' : ''} de fil)</small></dd>
        <dt>Coupes · sauts</dt><dd>${s.trims} · ${s.jumps}</dd>
        <dt>Fil</dt><dd>environ ${nf(s.threadLengthM, 1)} m</dd>
        <dt>Durée estimée</dt><dd>environ ${minutes(s)} min</dd>
      </dl>
      <h4>Fils, dans l’ordre</h4>
      <ul class="threads">${colors}</ul>
      <h4>Convertir en</h4>
      <div class="btn-row">${convert}</div>
      <div data-notes class="hint"></div>
    </div>`;
}

export function mountViewer(root: HTMLElement) {
  const drop = root.querySelector<HTMLElement>('[data-drop]')!;
  const out = root.querySelector<HTMLElement>('[data-result]')!;
  const mode = root.dataset.mode ?? 'view';
  let raf = 0;
  let onResize: (() => void) | undefined;

  const show = (p: Pattern) => {
    const s = analyse(p);
    const prepared = pieces(p);
    const o: RenderOptions = { upTo: Infinity, showJumps: false, realistic: true, background: BACKGROUNDS.blanc, zoom: 1, panX: 0, panY: 0 };
    out.hidden = false;
    out.innerHTML = `${p.warnings.length ? `<div class="notice">${p.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="emb-layout">
        <div class="emb-stage">
          <div class="emb-canvas-wrap"><canvas data-canvas aria-label="Aperçu du motif ${esc(p.name ?? '')}"></canvas></div>
          <div class="emb-controls">
            <label class="choice"><input type="checkbox" data-opt="realistic" checked /> Fil en relief</label>
            <label class="choice"><input type="checkbox" data-opt="showJumps" /> Afficher les sauts</label>
            <label class="inline">Fond <select data-bg>${Object.keys(BACKGROUNDS).map((k) => `<option value="${k}">${k}</option>`).join('')}</select></label>
            <button type="button" class="btn ghost small-btn" data-reset-view title="Recentrer">Recentrer</button>
            <button type="button" class="btn ghost small-btn" data-png>Image PNG</button>
          </div>
          <div class="emb-sim">
            <button type="button" class="btn small-btn" data-play aria-label="Lancer la simulation">▶ Simuler la broderie</button>
            <input type="range" min="0" max="${s.stitches}" value="${s.stitches}" step="1" data-range aria-label="Avancement de la broderie" />
            <span class="hint" data-count>${nf(s.stitches)} / ${nf(s.stitches)} points</span>
          </div>
          <p class="hint">Molette ou pincement pour zoomer, glisser pour déplacer.</p>
        </div>
        ${infoHtml(p, s, mode)}
      </div>
      ${thanksCard('conversion')}
      <div class="btn-row" style="margin-top:1rem"><button type="button" class="btn ghost" data-reset>Ouvrir un autre fichier</button></div>`;
    bindThanks(out);

    const canvas = out.querySelector<HTMLCanvasElement>('[data-canvas]')!;
    const range = out.querySelector<HTMLInputElement>('[data-range]')!;
    const count = out.querySelector<HTMLElement>('[data-count]')!;
    const resize = () => {
      const wrap = canvas.parentElement!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = wrap.clientWidth;
      const ratio = Math.min(1.3, Math.max(0.6, s.heightMm / Math.max(s.widthMm, 1)));
      const height = Math.round(Math.min(720, Math.max(300, width * ratio)));
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      paint();
    };
    const paint = () => draw(canvas, p, prepared, o);
    const setUpTo = (n: number) => {
      o.upTo = n >= s.stitches ? Infinity : n;
      range.value = String(Math.min(n, s.stitches));
      count.textContent = `${nf(Math.min(n, s.stitches))} / ${nf(s.stitches)} points`;
      paint();
    };

    out.querySelectorAll<HTMLInputElement>('[data-opt]').forEach((c) => c.addEventListener('change', () => {
      (o as unknown as Record<string, boolean>)[c.dataset.opt!] = c.checked;
      paint();
    }));
    out.querySelector<HTMLSelectElement>('[data-bg]')!.addEventListener('change', (e) => {
      o.background = BACKGROUNDS[(e.target as HTMLSelectElement).value];
      paint();
    });
    range.addEventListener('input', () => {
      cancelAnimationFrame(raf);
      setUpTo(Number(range.value));
    });
    out.querySelector('[data-play]')!.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      // Avancement réglé sur l'horloge (environ 12 s pour tout le motif), quel que soit le nombre d'images par seconde.
      const from = o.upTo === Infinity ? 0 : Number(range.value);
      const duration = 12_000 * (1 - from / Math.max(s.stitches, 1));
      const t0 = performance.now();
      const tick = (now: number) => {
        const n = Math.round(from + (s.stitches - from) * Math.min(1, (now - t0) / Math.max(duration, 1)));
        setUpTo(n);
        if (n < s.stitches) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    out.querySelector('[data-reset-view]')!.addEventListener('click', () => {
      Object.assign(o, { zoom: 1, panX: 0, panY: 0 });
      paint();
    });

    // Zoom à la molette et déplacement à la souris ou au doigt.
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / rect.width;
      const mx = (e.clientX - rect.left) * dpr - canvas.width / 2 - o.panX;
      const my = (e.clientY - rect.top) * dpr - canvas.height / 2 - o.panY;
      const nz = Math.min(40, Math.max(0.5, o.zoom * f));
      const k = nz / o.zoom;
      o.panX -= mx * (k - 1);
      o.panY -= my * (k - 1);
      o.zoom = nz;
      paint();
    }, { passive: false });
    let drag: { x: number; y: number } | undefined;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dpr = canvas.width / canvas.getBoundingClientRect().width;
      o.panX += (e.clientX - drag.x) * dpr;
      o.panY += (e.clientY - drag.y) * dpr;
      drag = { x: e.clientX, y: e.clientY };
      paint();
    });
    canvas.addEventListener('pointerup', () => (drag = undefined));
    canvas.addEventListener('dblclick', () => {
      Object.assign(o, { zoom: 1, panX: 0, panY: 0 });
      paint();
    });

    out.querySelector('[data-png]')!.addEventListener('click', () => {
      const big = document.createElement('canvas');
      const k = 1600 / Math.max(s.widthMm, s.heightMm, 1);
      big.width = Math.round(Math.max(s.widthMm * k, 200));
      big.height = Math.round(Math.max(s.heightMm * k, 200));
      draw(big, p, prepared, { ...o, upTo: Infinity, zoom: 1, panX: 0, panY: 0 });
      big.toBlob((b) => b && download(b, `${(p.name || 'motif').replace(/[^\w-]+/g, '-')}.png`, 'image/png'), 'image/png');
    });
    out.querySelectorAll<HTMLButtonElement>('[data-convert]').forEach((btn) => btn.addEventListener('click', () => {
      const fmt = btn.dataset.convert as OutputFormat;
      const notes = conversionNotes(p, fmt);
      try {
        const bytes = writePattern(p, fmt);
        download(bytes, `${(p.name || 'motif').replace(/[^\w-]+/g, '-')}.${fmt.toLowerCase()}`, 'application/octet-stream');
        out.querySelector<HTMLElement>('[data-notes]')!.innerHTML = `<p class="pos">Fichier ${fmt} téléchargé (${BRANDS[fmt]}).</p>${notes.map((n) => `<p>${esc(n)}</p>`).join('')}`;
      } catch (e) {
        out.querySelector<HTMLElement>('[data-notes]')!.innerHTML = `<p class="neg">Conversion impossible : ${esc(e instanceof Error ? e.message : e)}</p>`;
      }
    }));
    out.querySelector('[data-reset]')!.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      out.hidden = true;
      drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = resize;
    window.addEventListener('resize', resize);
    resize();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const open = (bytes: Uint8Array, name: string) => {
    out.hidden = false;
    out.innerHTML = waitCard('Lecture du motif…');
    setTimeout(() => {
      try {
        show(readPattern(bytes, name));
      } catch (e) {
        out.innerHTML = `<div class="banner err"><div><strong>Lecture impossible</strong><p>${esc(e instanceof Error ? e.message : e)}</p></div></div>`;
      }
    }, 20);
  };

  bindDrop(drop, root.querySelector('[data-file]')!, async (file) => open(new Uint8Array(await file.arrayBuffer()), file.name));
  root.querySelector('[data-sample]')!.addEventListener('click', async () => {
    const { sampleFlower } = await import('../lib/embroidery/sample');
    show(sampleFlower());
  });
}

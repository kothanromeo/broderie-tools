import { describe, expect, it } from 'vitest';
import { analyse, bounds, colorDistance, EmbroideryError, nearestIndex, smallestHoop } from '../src/lib/embroidery/pattern';
import { JEF_PALETTE, PEC_PALETTE } from '../src/lib/embroidery/palettes';
import { detect, readPattern } from '../src/lib/embroidery/read';
import { sampleFlower } from '../src/lib/embroidery/sample';
import { conversionNotes, writePattern, type OutputFormat } from '../src/lib/embroidery/write';

const flower = sampleFlower();
const pts = (p: ReturnType<typeof sampleFlower>) => p.stitches.filter((s) => s.cmd === 'stitch').map((s) => `${s.x},${s.y}`);

describe('Motif de démonstration', () => {
  it('a quatre couleurs et une taille réaliste', () => {
    const s = analyse(flower);
    expect(s.colorChanges).toBe(3);
    expect(s.blocks.length).toBe(4);
    expect(s.stitches).toBeGreaterThan(1500);
    expect(s.widthMm).toBeGreaterThan(60);
    expect(s.widthMm).toBeLessThan(100);
    expect(s.heightMm).toBeGreaterThan(130);
    expect(smallestHoop(s.widthMm, s.heightMm)?.label).toBe('130 × 180 mm');
    expect(smallestHoop(90, 90)?.label).toBe('100 × 100 mm');
    expect(smallestHoop(250, 400)).toBeUndefined();
  });
});

describe('Conversion aller-retour', () => {
  for (const fmt of ['PES', 'DST', 'JEF', 'EXP'] as OutputFormat[]) {
    it(`${fmt} : mêmes points, mêmes changements de couleur`, () => {
      const bytes = writePattern(flower, fmt);
      const back = readPattern(bytes, `fleur.${fmt.toLowerCase()}`);
      expect(back.format).toBe(fmt);
      expect(pts(back)).toEqual(pts(flower));
      expect(analyse(back).colorChanges).toBe(3);
      expect(bounds(back)).toEqual(bounds(flower));
      if (fmt === 'PES') expect(back.threads.length).toBe(4);
    });
  }

  it('PES : couleurs ramenées à la palette Brother', () => {
    const back = readPattern(writePattern(flower, 'PES'), 'fleur.pes');
    for (const [i, t] of back.threads.entries()) expect(colorDistance(t.hex, flower.threads[i].hex)).toBeLessThan(12000);
  });

  it('découpe les grands déplacements', () => {
    const big = { ...flower, stitches: [{ x: 0, y: 0, cmd: 'jump' as const }, { x: 0, y: 0, cmd: 'stitch' as const }, { x: 900, y: -700, cmd: 'jump' as const }, { x: 1000, y: -700, cmd: 'stitch' as const }, { x: 1000, y: -700, cmd: 'end' as const }] };
    for (const fmt of ['DST', 'JEF', 'EXP'] as OutputFormat[]) {
      const back = readPattern(writePattern(big, fmt), `x.${fmt.toLowerCase()}`);
      expect(pts(back).at(-1)).toBe('1000,-700');
    }
  });
});

describe('Détection et erreurs', () => {
  it('reconnaît les formats par leur signature', () => {
    expect(detect(writePattern(flower, 'PES'))).toBe('PES');
    expect(detect(writePattern(flower, 'DST'))).toBe('DST');
    expect(detect(writePattern(flower, 'JEF'), 'a.jef')).toBe('JEF');
    expect(detect(new Uint8Array([1, 2, 3]), 'a.txt')).toBeUndefined();
  });
  it('refuse les fichiers illisibles', () => {
    expect(() => readPattern(new Uint8Array([1, 2, 3]), 'motif.vp3')).toThrow(/vp3/);
    expect(() => readPattern(new TextEncoder().encode('bonjour'), 'x.txt')).toThrow(EmbroideryError);
    expect(() => readPattern(new Uint8Array(600), 'x.dst')).toThrow(EmbroideryError);
  });
  it('signale ce que la conversion fait perdre', () => {
    expect(conversionNotes(flower, 'DST')[0]).toMatch(/couleurs/);
    expect(conversionNotes(flower, 'PES')[0]).toMatch(/Brother/);
  });
});

describe('Palettes', () => {
  it('trouvent la couleur la plus proche', () => {
    expect(PEC_PALETTE.length).toBe(65);
    expect(JEF_PALETTE.length).toBe(79);
    expect(PEC_PALETTE[nearestIndex('ff0000', PEC_PALETTE)]!.name).toBe('Red');
    expect(nearestIndex('000000', PEC_PALETTE)).toBeGreaterThan(0);
  });
});

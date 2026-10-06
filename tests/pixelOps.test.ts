import { describe, expect, it } from 'vitest';
import type { Pixels } from '../src/model/pngCodec';
import * as ops from '../src/pixel/ops';

const R = [255, 0, 0, 255] as const;
const T = [0, 0, 0, 0] as const;

/** Rows of characters: '.' transparent, 'r' red, 'b' blue, 'g' green. */
const colours: Record<string, ops.Rgba> = { '.': T, r: R, b: [0, 0, 255, 255], g: [0, 255, 0, 255] };
function img(...rows: string[]): Pixels {
  const px = ops.createPixels(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ops.setPixel(px, x, y, colours[ch])));
  return px;
}
function show(px: Pixels): string[] {
  const rev = Object.fromEntries(Object.entries(colours).map(([k, v]) => [v.join(), k]));
  return Array.from({ length: px.height }, (_, y) =>
    Array.from({ length: px.width }, (_, x) => rev[ops.getPixel(px, x, y).join()] ?? '?').join(''),
  );
}
const pts = (p: ops.Point[]) => p.map((q) => `${q.x},${q.y}`);

describe('line', () => {
  it('horizontal includes both ends', () => {
    expect(pts(ops.line(1, 4, 6, 4))).toEqual(['1,4', '2,4', '3,4', '4,4', '5,4', '6,4']);
  });
  it('diagonal', () => {
    expect(pts(ops.line(0, 0, 3, 3))).toEqual(['0,0', '1,1', '2,2', '3,3']);
  });
  it('reverse direction covers the same pixels', () => {
    expect(pts(ops.line(6, 4, 1, 4)).sort()).toEqual(pts(ops.line(1, 4, 6, 4)).sort());
  });
  it('is gap free for a shallow slope', () => {
    const p = ops.line(0, 0, 10, 3);
    expect(p).toHaveLength(11);
    for (let i = 1; i < p.length; i++) {
      expect(Math.abs(p[i].x - p[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p[i].y - p[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });
  it('single point', () => {
    expect(pts(ops.line(2, 2, 2, 2))).toEqual(['2,2']);
  });
});

describe('constraints', () => {
  it('snaps a line to horizontal, vertical or 45 degrees', () => {
    expect(ops.constrainLine(0, 0, 10, 2)).toEqual({ x: 10, y: 0 });
    expect(ops.constrainLine(0, 0, 2, -10)).toEqual({ x: 0, y: -10 });
    expect(ops.constrainLine(0, 0, 6, 5)).toEqual({ x: 6, y: 6 });
    expect(ops.constrainLine(5, 5, 2, 1)).toEqual({ x: 1, y: 1 });
  });
  it('snaps a rectangle to a square', () => {
    expect(ops.constrainSquare(2, 2, 6, 4)).toEqual({ x: 6, y: 6 });
    expect(ops.constrainSquare(2, 2, 0, 5)).toEqual({ x: -1, y: 5 });
  });
});

describe('rectangles', () => {
  it('outline sets only the border', () => {
    const px = ops.createPixels(8, 8);
    for (const p of ops.rectOutline(2, 2, 6, 5)) ops.setPixel(px, p.x, p.y, R);
    expect(show(px).slice(2, 6)).toEqual(['..rrrrr.', '..r...r.', '..r...r.', '..rrrrr.']);
  });
  it('filled covers every pixel', () => {
    expect(ops.rectFill(2, 2, 6, 5)).toHaveLength(5 * 4);
  });
  it('same rectangle in any drag direction', () => {
    expect(pts(ops.rectOutline(6, 5, 2, 2)).sort()).toEqual(pts(ops.rectOutline(2, 2, 6, 5)).sort());
    expect(pts(ops.rectFill(6, 5, 2, 2)).sort()).toEqual(pts(ops.rectFill(2, 2, 6, 5)).sort());
  });
  it('degenerate rectangles have no duplicate pixels', () => {
    expect(ops.rectOutline(3, 3, 3, 3)).toHaveLength(1);
    expect(ops.rectOutline(1, 3, 4, 3)).toHaveLength(4);
    expect(ops.rectOutline(3, 1, 3, 4)).toHaveLength(4);
  });
  it('clips to the canvas', () => {
    const b = { width: 4, height: 4 };
    expect(ops.rectFill(-2, -2, 1, 1, b)).toHaveLength(4);
    expect(ops.rectFill(3, 3, 9, 9, b)).toHaveLength(1);
    expect(ops.rectFill(10, 10, 12, 12, b)).toHaveLength(0);
    // only the right column (x=2, y 0..2) and bottom row (y=2, x 0..1) are inside
    expect(ops.rectOutline(-1, -1, 2, 2, b)).toHaveLength(5);
  });
});

describe('floodFill', () => {
  it('fills only the bounded connected region', () => {
    const px = img('.r..', '.r..', '.r..');
    expect(ops.floodFill(px, 2, 1, colours.b).sort((a, b) => a - b)).toEqual([2, 3, 6, 7, 10, 11]);
    expect(show(px)).toEqual(['.r..', '.r..', '.r..']); // not modified
  });
  it('does not connect diagonally', () => {
    expect(ops.floodFill(img('b.', '.b'), 0, 0, R)).toEqual([0]);
  });
  it('is a no-op when the colour is already equal', () => {
    expect(ops.floodFill(img('rr', 'rr'), 0, 0, R)).toEqual([]);
  });
  it('matches exact RGBA including alpha', () => {
    const px = img('rr');
    ops.setPixel(px, 1, 0, [255, 0, 0, 128]);
    expect(ops.floodFill(px, 0, 0, colours.b)).toEqual([0]);
  });
  it('ignores off-canvas starts', () => {
    expect(ops.floodFill(img('..'), 5, 0, R)).toEqual([]);
  });
});

describe('flip', () => {
  it('canvas horizontal', () => {
    const px = img('rb.', 'g..');
    ops.flip(px, 'h');
    expect(show(px)).toEqual(['.br', '..g']);
  });
  it('selection vertical swaps rows and leaves the rest', () => {
    const px = img('rrr.', 'bbb.', '....', 'gggg');
    ops.flip(px, 'v', { x: 0, y: 0, w: 3, h: 2 });
    expect(show(px)).toEqual(['bbb.', 'rrr.', '....', 'gggg']);
  });
});

describe('rotate', () => {
  it('canvas 4x2 clockwise becomes 2x4 with top-left at top-right', () => {
    const out = ops.rotatePixels(img('rbbb', 'gggg'), 'cw');
    expect([out.width, out.height]).toEqual([2, 4]);
    expect(show(out)).toEqual(['gr', 'gb', 'gb', 'gb']);
  });
  it('counter-clockwise undoes clockwise', () => {
    const px = img('rbb', 'ggg');
    expect(show(ops.rotatePixels(ops.rotatePixels(px, 'cw'), 'ccw'))).toEqual(show(px));
  });
  it('square selection rotates in place', () => {
    const px = img('....', '.rb.', '.gg.', '....');
    const rect = ops.rotateRegion(px, { x: 1, y: 1, w: 2, h: 2 }, 'ccw');
    expect(rect).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(show(px)).toEqual(['....', '.bg.', '.rg.', '....']);
  });
  it('non-square selection turns about its centre', () => {
    const px = img('......', '......', '.rrrr.', '.bbbb.', '......', '......');
    const rect = ops.rotateRegion(px, { x: 1, y: 2, w: 4, h: 2 }, 'cw');
    expect(rect).toEqual({ x: 2, y: 1, w: 2, h: 4 });
    expect(show(px)).toEqual(['......', '..br..', '..br..', '..br..', '..br..', '......']);
  });
  it('clips the part past the canvas edge', () => {
    const px = img('rrrr', 'bbbb');
    const rect = ops.rotateRegion(px, { x: 0, y: 0, w: 4, h: 2 }, 'cw');
    expect(rect).toEqual({ x: 1, y: -1, w: 2, h: 4 });
    expect(show(px)).toEqual(['.br.', '.br.']);
  });
});

describe('resize', () => {
  const four = () => img('rrrr', 'rrrr', 'rrrr', 'rrrr');
  it('grows from the top-left anchor', () => {
    expect(show(ops.resize(four(), 6, 6, { ax: 0, ay: 0 }))).toEqual([
      'rrrr..',
      'rrrr..',
      'rrrr..',
      'rrrr..',
      '......',
      '......',
    ]);
  });
  it('grows from the centre anchor', () => {
    const rows = show(ops.resize(four(), 8, 8, { ax: 1, ay: 1 }));
    expect(rows[1]).toBe('........');
    expect(rows[2]).toBe('..rrrr..');
    expect(rows[5]).toBe('..rrrr..');
    expect(rows[6]).toBe('........');
  });
  it('shrinks keeping the bottom-right region', () => {
    const px = img('......', '......', '..rrrr', '..rbbr', '..rbbr', '..rrrr');
    expect(show(ops.resize(px, 4, 4, { ax: 2, ay: 2 }))).toEqual(['rrrr', 'rbbr', 'rbbr', 'rrrr']);
  });
  it('does not scale', () => {
    expect(show(ops.resize(img('r'), 3, 1, { ax: 0, ay: 0 }))).toEqual(['r..']);
  });
  it('rejects invalid sizes', () => {
    expect(ops.validateSize(0, 5)).not.toBeNull();
    expect(ops.validateSize(5, 5000)).not.toBeNull();
    expect(ops.validateSize(2.5, 5)).not.toBeNull();
    expect(ops.validateSize(1, 4096)).toBeNull();
    expect(() => ops.resize(four(), 0, 4, { ax: 0, ay: 0 })).toThrow();
  });
});

describe('blit', () => {
  it('transparent source pixels keep what is underneath', () => {
    const dst = img('rrr');
    ops.blit(dst, img('.b'), 0, 0); // transparent pixel at x=0 leaves red, blue lands at x=1
    expect(show(dst)).toEqual(['rbr']);
    ops.blit(dst, img('.b'), 1, 0);
    expect(show(dst)).toEqual(['rbb']);
  });
  it('clips off-canvas parts', () => {
    const dst = img('...', '...');
    ops.blit(dst, img('bb', 'bb'), 2, 1);
    expect(show(dst)).toEqual(['...', '..b']);
    ops.blit(dst, img('gg', 'gg'), -1, -1);
    expect(show(dst)).toEqual(['g..', '..b']);
    ops.blit(dst, img('rr'), 10, 10);
    expect(show(dst)).toEqual(['g..', '..b']);
  });
});

describe('flatten', () => {
  const layer = (px: Pixels, visible = true) => ({ px, visible });
  it('shows the top opaque pixel over the bottom one', () => {
    expect(ops.getPixel(ops.flatten([layer(img('b')), layer(img('r'))]), 0, 0)).toEqual(R);
  });
  it('lets transparent pixels show through', () => {
    const out = ops.flatten([layer(img('gb')), layer(img('.r'))]);
    expect(show(out)).toEqual(['gr']);
  });
  it('composites semi-transparent pixels with known values', () => {
    const half = ops.createPixels(1, 1);
    ops.setPixel(half, 0, 0, [255, 0, 0, 128]);
    // red at 128/255 over opaque blue: 255*a, 255*(1-a)
    const over = ops.flatten([layer(img('b')), layer(half)]);
    expect(ops.getPixel(over, 0, 0)).toEqual([128, 0, 127, 255]);
    // over a transparent pixel the colour and alpha are kept
    const alone = ops.flatten([layer(img('.')), layer(half)]);
    expect(ops.getPixel(alone, 0, 0)).toEqual([255, 0, 0, 128]);
  });
  it('keeps the exact RGBA of a single layer, including transparent pixels with colour', () => {
    const px = ops.createPixels(2, 1);
    ops.setPixel(px, 0, 0, [10, 20, 30, 0]);
    ops.setPixel(px, 1, 0, [10, 20, 30, 128]);
    expect(Array.from(ops.flatten([layer(px)]).data)).toEqual(Array.from(px.data));
  });
  it('ignores hidden layers and returns a new image', () => {
    const bottom = img('b');
    const out = ops.flatten([layer(bottom), layer(img('r'), false)]);
    expect(show(out)).toEqual(['b']);
    expect(out).not.toBe(bottom);
    expect(show(ops.flatten([layer(img('r'), false)]))).toEqual(['.']);
  });
});

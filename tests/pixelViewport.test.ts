import { describe, expect, it } from 'vitest';
import { MAX_SCALE, MIN_GRID_SCALE, MIN_SCALE, Viewport, offsetAfterGrow } from '../src/pixel/viewport';

describe('Viewport coordinate mapping', () => {
  it('maps screen points to pixels at several zooms and offsets', () => {
    const v = new Viewport();
    v.scale = 1;
    expect(v.toImage(0, 0)).toEqual({ x: 0, y: 0 });
    expect(v.toImage(5.9, 7.1)).toEqual({ x: 5, y: 7 });

    v.scale = 10;
    v.ox = 100;
    v.oy = 50;
    expect(v.toImage(100, 50)).toEqual({ x: 0, y: 0 });
    expect(v.toImage(109.9, 59.9)).toEqual({ x: 0, y: 0 });
    expect(v.toImage(110, 60)).toEqual({ x: 1, y: 1 });
    expect(v.toImage(135, 85)).toEqual({ x: 3, y: 3 });

    v.scale = 0.5;
    v.ox = -20;
    v.oy = 0;
    expect(v.toImage(0, 4)).toEqual({ x: 40, y: 8 });
  });

  it('reports pixels left of / above the image as negative', () => {
    const v = new Viewport();
    v.scale = 8;
    v.ox = 40;
    v.oy = 40;
    expect(v.toImage(39, 39)).toEqual({ x: -1, y: -1 });
    expect(v.toImage(0, 0)).toEqual({ x: -5, y: -5 });
  });

  it('toScreen is the inverse of toImage at pixel corners', () => {
    const v = new Viewport();
    v.scale = 7;
    v.ox = 13;
    v.oy = -9;
    const s = v.toScreen(4, 6);
    expect(v.toImage(s.x, s.y)).toEqual({ x: 4, y: 6 });
  });
});

describe('Viewport zoom and pan', () => {
  it('keeps the pixel under the pointer when zooming', () => {
    const v = new Viewport();
    v.scale = 4;
    v.ox = 30;
    v.oy = 20;
    const before = v.toImage(200, 150);
    v.zoomAt(200, 150, 2);
    expect(v.scale).toBe(8);
    expect(v.toImage(200, 150)).toEqual(before);
    v.zoomAt(200, 150, 0.5);
    expect(v.toImage(200, 150)).toEqual(before);
  });

  it('clamps the zoom range', () => {
    const v = new Viewport();
    v.zoomAt(0, 0, 1e6);
    expect(v.scale).toBe(MAX_SCALE);
    v.zoomAt(0, 0, 1e-9);
    expect(v.scale).toBe(MIN_SCALE);
  });

  it('pans by the pointer delta', () => {
    const v = new Viewport();
    v.panBy(12, -5);
    expect([v.ox, v.oy]).toEqual([12, -5]);
  });
});

describe('Viewport fit', () => {
  it('uses a whole-number scale and centres the image', () => {
    const v = new Viewport();
    v.fit(32, 32, 800, 600, 24);
    expect(v.scale).toBe(17); // floor(552 / 32)
    expect(v.ox).toBe(Math.round((800 - 32 * 17) / 2));
    expect(v.oy).toBe(Math.round((600 - 32 * 17) / 2));
  });

  it('shrinks below 1x for images larger than the view', () => {
    const v = new Viewport();
    v.fit(4000, 1000, 800, 600, 0);
    expect(v.scale).toBeCloseTo(0.2);
    expect(v.toImage(0, v.oy).x).toBeLessThanOrEqual(0);
    expect(v.oy).toBeGreaterThan(0); // letterboxed vertically, so centred
  });

  it('copes with a view smaller than the margin', () => {
    const v = new Viewport();
    v.fit(16, 16, 10, 10, 24);
    expect(v.scale).toBeGreaterThanOrEqual(MIN_SCALE);
  });
});

describe('Viewport grid threshold', () => {
  it('shows the grid only at or above the minimum pixel size', () => {
    const v = new Viewport();
    v.scale = MIN_GRID_SCALE - 1;
    expect(v.gridVisible).toBe(false);
    v.scale = MIN_GRID_SCALE;
    expect(v.gridVisible).toBe(true);
  });
});

describe('Viewport growth compensation', () => {
  it('moves the origin left by growth * scale so old pixels stay put', () => {
    expect(offsetAfterGrow(100, 4, 10)).toBe(60);
    expect(offsetAfterGrow(100, -3, 2)).toBe(106);
    expect(offsetAfterGrow(100, 0, 8)).toBe(100);
  });
  it('keeps the screen position of an old pixel after left/top growth', () => {
    const v = new Viewport();
    v.scale = 8;
    v.ox = 50;
    v.oy = 30;
    const before = v.toScreen(5, 7); // old pixel (5, 7)
    v.compensateGrowth(4, 2); // it is now pixel (9, 9)
    expect(v.toScreen(9, 9)).toEqual(before);
  });
});

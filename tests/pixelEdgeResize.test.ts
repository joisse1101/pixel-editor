import { describe, expect, it } from 'vitest';
import { PixelDocument } from '../src/pixel/document';
import { dragAnchor, dragSize, edgeCursor, hitEdges, previewRect, type Edges } from '../src/pixel/edgeResize';
import { getPixel, setPixel } from '../src/pixel/ops';
import { Viewport } from '../src/pixel/viewport';

const none: Edges = { left: false, right: false, top: false, bottom: false };
const only = (k: keyof Edges): Edges => ({ ...none, [k]: true });
// 10x10 image drawn at (100, 50), 10 screen px per image px: occupies x 100..200, y 50..150.
const view = { ox: 100, oy: 50, scale: 10 };
const hit = (x: number, y: number) => hitEdges(x, y, view, 10, 10);

describe('hitEdges', () => {
  it('selects each edge just outside the boundary', () => {
    expect(hit(97, 100)).toEqual(only('left'));
    expect(hit(203, 100)).toEqual(only('right'));
    expect(hit(150, 47)).toEqual(only('top'));
    expect(hit(150, 153)).toEqual(only('bottom'));
  });

  it('selects corners as two edges', () => {
    expect(hit(97, 47)).toEqual({ ...none, left: true, top: true });
    expect(hit(203, 153)).toEqual({ ...none, right: true, bottom: true });
    expect(hit(203, 47)).toEqual({ ...none, right: true, top: true });
    expect(hit(97, 153)).toEqual({ ...none, left: true, bottom: true });
  });

  it('ignores presses on or inside the image, including its outermost pixels', () => {
    expect(hit(100, 100)).toBeNull(); // left column
    expect(hit(199, 100)).toBeNull(); // right column
    expect(hit(150, 50)).toBeNull(); // top row
    expect(hit(150, 149)).toBeNull(); // bottom row
    expect(hit(150, 100)).toBeNull();
  });

  it('ignores points beyond the grab zone', () => {
    expect(hit(90, 100)).toBeNull();
    expect(hit(210, 100)).toBeNull();
    expect(hit(150, 40)).toBeNull();
    expect(hit(150, 160)).toBeNull();
  });

  it('works with the viewport pan and zoom values', () => {
    const v = new Viewport();
    v.scale = 4;
    v.ox = 20;
    v.oy = 20;
    expect(hitEdges(17, 40, v, 8, 8)).toEqual(only('left'));
    expect(hitEdges(20, 40, v, 8, 8)).toBeNull();
  });
});

describe('edgeCursor', () => {
  it('maps edges and corners to resize cursors', () => {
    expect(edgeCursor(only('left'))).toBe('ew-resize');
    expect(edgeCursor(only('right'))).toBe('ew-resize');
    expect(edgeCursor(only('top'))).toBe('ns-resize');
    expect(edgeCursor(only('bottom'))).toBe('ns-resize');
    expect(edgeCursor({ ...none, left: true, top: true })).toBe('nwse-resize');
    expect(edgeCursor({ ...none, right: true, bottom: true })).toBe('nwse-resize');
    expect(edgeCursor({ ...none, right: true, top: true })).toBe('nesw-resize');
    expect(edgeCursor({ ...none, left: true, bottom: true })).toBe('nesw-resize');
  });
});

describe('dragSize', () => {
  const start = { w: 32, h: 32 };
  it('grows to the right and bottom with positive deltas', () => {
    expect(dragSize(only('right'), start, 8, 5)).toEqual({ w: 40, h: 32 });
    expect(dragSize(only('bottom'), start, 5, 3)).toEqual({ w: 32, h: 35 });
  });
  it('grows to the left and top with negative deltas', () => {
    expect(dragSize(only('left'), start, -4, 0)).toEqual({ w: 36, h: 32 });
    expect(dragSize(only('top'), start, 0, 3)).toEqual({ w: 32, h: 29 });
  });
  it('changes both dimensions for a corner', () => {
    expect(dragSize({ ...none, right: true, bottom: true }, start, 5, 2)).toEqual({ w: 37, h: 34 });
  });
  it('holds the size at 1 and 4096', () => {
    expect(dragSize(only('right'), start, -100, 0).w).toBe(1);
    expect(dragSize(only('left'), start, 100, 0).w).toBe(1);
    expect(dragSize(only('right'), start, 9999, 0).w).toBe(4096);
  });
});

describe('dragAnchor and previewRect', () => {
  it('anchors the opposite side', () => {
    expect(dragAnchor(only('right'))).toEqual({ ax: 0, ay: 0 });
    expect(dragAnchor(only('left'))).toEqual({ ax: 2, ay: 0 });
    expect(dragAnchor({ ...none, left: true, top: true })).toEqual({ ax: 2, ay: 2 });
  });
  it('places the preview outline in old image coordinates', () => {
    const start = { w: 32, h: 32 };
    expect(previewRect(only('right'), start, { w: 40, h: 32 })).toEqual({ x: 0, y: 0, w: 40, h: 32 });
    expect(previewRect(only('left'), start, { w: 36, h: 32 })).toEqual({ x: -4, y: 0, w: 36, h: 32 });
    expect(previewRect(only('top'), start, { w: 32, h: 29 })).toEqual({ x: 0, y: 3, w: 32, h: 29 });
  });
});

describe('applying an edge drag to the document', () => {
  const R = [255, 0, 0, 255] as const;
  it('growing the left edge shifts pixels right and undo restores them', () => {
    const d = new PixelDocument(8, 8);
    d.addLayer();
    setPixel(d.layers[0].px, 1, 1, R);
    d.history.clear();
    const edges = only('left');
    const size = dragSize(edges, { w: 8, h: 8 }, -4, 0);
    d.resize(size.w, size.h, dragAnchor(edges));
    expect([d.width, d.height]).toEqual([12, 8]);
    expect(getPixel(d.layers[0].px, 5, 1)).toEqual(R);
    d.undo();
    expect([d.width, d.layers[1].px.width]).toEqual([8, 8]);
    expect(getPixel(d.layers[0].px, 1, 1)).toEqual(R);
  });
  it('shrinking from the top removes rows from every layer', () => {
    const d = new PixelDocument(4, 6);
    d.addLayer();
    setPixel(d.layers[0].px, 0, 3, R);
    d.history.clear();
    const edges = only('top');
    const size = dragSize(edges, { w: 4, h: 6 }, 0, 3);
    d.resize(size.w, size.h, dragAnchor(edges));
    expect(d.layers.map((l) => l.px.height)).toEqual([3, 3]);
    expect(getPixel(d.layers[0].px, 0, 0)).toEqual(R);
    d.undo();
    expect(d.layers.map((l) => l.px.height)).toEqual([6, 6]);
  });
});

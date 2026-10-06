import { describe, expect, it } from 'vitest';
import { History, type ImageHolder, type Layer } from '../src/pixel/history';
import { createPixels, getPixel, setPixel, type Rgba } from '../src/pixel/ops';

const R: Rgba = [255, 0, 0, 255];
const B: Rgba = [0, 0, 255, 128];
const makeLayer = (id: number, w = 4, h = 4): Layer => ({ id, name: `L${id}`, visible: true, px: createPixels(w, h) });
const makeHolder = (...layers: Layer[]): ImageHolder => ({
  layers,
  activeIndex: 0,
  get px() {
    return this.layers[this.activeIndex].px;
  },
});
const setup = () => {
  const holder = makeHolder(makeLayer(1));
  return { holder, h: new History(holder) };
};
const stroke = (h: History, ...writes: [number, Rgba][]) => {
  h.beginStroke();
  for (const [i, c] of writes) h.write(i, c);
  return h.endStroke();
};
const at = (holder: ImageHolder, x: number, y: number) => getPixel(holder.px, x, y);

describe('History strokes', () => {
  it('undoes and redoes a whole stroke as one step', () => {
    const { holder, h } = setup();
    stroke(h, [0, R], [1, R], [2, B]);
    expect(at(holder, 2, 0)).toEqual(B);
    expect(h.undo()).toBe(true);
    expect([0, 1, 2].map((x) => at(holder, x, 0))).toEqual([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe(true);
    expect(at(holder, 0, 0)).toEqual(R);
    expect(at(holder, 2, 0)).toEqual(B);
  });

  it('restores the first value when a pixel is written twice in a stroke', () => {
    const { holder, h } = setup();
    stroke(h, [0, R]);
    stroke(h, [0, B], [0, [1, 2, 3, 4]]);
    h.undo();
    expect(at(holder, 0, 0)).toEqual(R);
  });

  it('adds no step when nothing changed', () => {
    const { h } = setup();
    expect(stroke(h, [0, [0, 0, 0, 0]])).toBe(false);
    expect(stroke(h)).toBe(false);
    expect(h.canUndo).toBe(false);
    expect(h.isDirty).toBe(false);
  });

  it('abortStroke restores pixels and records nothing', () => {
    const { holder, h } = setup();
    h.beginStroke();
    h.write(0, R);
    h.abortStroke();
    expect(at(holder, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(h.canUndo).toBe(false);
  });

  it('discards redo steps on a new edit', () => {
    const { h } = setup();
    stroke(h, [0, R]);
    h.undo();
    expect(h.canRedo).toBe(true);
    stroke(h, [1, B]);
    expect(h.canRedo).toBe(false);
  });
});

describe('History snapshots', () => {
  it('undoes and redoes a resize with the removed pixels intact', () => {
    const { holder, h } = setup();
    stroke(h, [15, R]); // pixel (3,3)
    const small = createPixels(2, 2);
    h.snapshot(small);
    expect(holder.px).toBe(small);
    h.undo();
    expect([holder.px.width, holder.px.height]).toEqual([4, 4]);
    expect(at(holder, 3, 3)).toEqual(R);
    h.redo();
    expect(holder.px).toBe(small);
  });

  it('diffs before a snapshot still apply after undoing past it', () => {
    const { holder, h } = setup();
    stroke(h, [0, R]);
    h.snapshot(createPixels(2, 2));
    stroke(h, [3, B]);
    h.undo();
    h.undo();
    expect(holder.px.width).toBe(4);
    h.undo();
    expect(at(holder, 0, 0)).toEqual([0, 0, 0, 0]);
    h.redo();
    h.redo();
    h.redo();
    expect(at(holder, 1, 1)).toEqual(B);
    expect(holder.px.width).toBe(2);
  });
});

describe('History dirty flag', () => {
  it('is clean after markSaved and again after undoing back to it', () => {
    const { h } = setup();
    stroke(h, [0, R]);
    expect(h.isDirty).toBe(true);
    h.markSaved();
    expect(h.isDirty).toBe(false);
    stroke(h, [1, R]);
    expect(h.isDirty).toBe(true);
    h.undo();
    expect(h.isDirty).toBe(false);
    h.undo();
    expect(h.isDirty).toBe(true);
    h.redo();
    expect(h.isDirty).toBe(false);
  });

  it('stays dirty when the saved state was discarded by branching', () => {
    const { h } = setup();
    stroke(h, [0, R]);
    h.markSaved();
    h.undo();
    stroke(h, [1, B]);
    h.undo();
    h.redo();
    expect(h.isDirty).toBe(true);
    h.undo();
    expect(h.isDirty).toBe(true);
  });

  it('clear makes the current image the saved state', () => {
    const { holder, h } = setup();
    setPixel(holder.px, 0, 0, R);
    stroke(h, [1, R]);
    h.clear();
    expect(h.isDirty).toBe(false);
    expect(h.canUndo).toBe(false);
  });
});

describe('History with layers', () => {
  const two = () => {
    const holder = makeHolder(makeLayer(1), makeLayer(2));
    return { holder, h: new History(holder) };
  };
  const pixelOf = (holder: ImageHolder, layer: number, x: number, y: number) => getPixel(holder.layers[layer].px, x, y);

  it('undoes a diff on a non-active layer and makes it active again', () => {
    const { holder, h } = two();
    stroke(h, [0, R]);
    holder.activeIndex = 1;
    stroke(h, [1, B]);
    holder.activeIndex = 0;
    h.undo();
    expect(holder.activeIndex).toBe(1);
    expect(pixelOf(holder, 1, 1, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelOf(holder, 0, 0, 0)).toEqual(R);
    h.undo();
    expect(holder.activeIndex).toBe(0);
    expect(pixelOf(holder, 0, 0, 0)).toEqual([0, 0, 0, 0]);
    holder.activeIndex = 1;
    h.redo();
    expect(holder.activeIndex).toBe(0);
    expect(pixelOf(holder, 0, 0, 0)).toEqual(R);
    h.redo();
    expect(holder.activeIndex).toBe(1);
    expect(pixelOf(holder, 1, 1, 0)).toEqual(B);
  });

  it('abortStroke restores the layer the stroke started on', () => {
    const { holder, h } = two();
    holder.activeIndex = 1;
    h.beginStroke();
    h.write(0, R);
    holder.activeIndex = 0;
    h.abortStroke();
    expect(pixelOf(holder, 1, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('interleaves structure snapshots with diffs', () => {
    const { holder, h } = two();
    stroke(h, [0, R]); // layer 1
    const added = makeLayer(3);
    h.snapshot({ layers: [...holder.layers, added], activeIndex: 2 });
    expect(holder.layers).toHaveLength(3);
    stroke(h, [2, B]); // on the new layer
    h.undo();
    h.undo();
    expect(holder.layers.map((l) => l.id)).toEqual([1, 2]);
    h.undo();
    expect(pixelOf(holder, 0, 0, 0)).toEqual([0, 0, 0, 0]);
    h.redo();
    h.redo();
    h.redo();
    expect(holder.layers.map((l) => l.id)).toEqual([1, 2, 3]);
    expect(pixelOf(holder, 0, 0, 0)).toEqual(R);
    expect(pixelOf(holder, 2, 2, 0)).toEqual(B);
  });

  it('restores a deleted layer with its pixels', () => {
    const { holder, h } = two();
    holder.activeIndex = 1;
    stroke(h, [5, R]);
    h.snapshot({ layers: [holder.layers[0]], activeIndex: 0 });
    h.undo();
    expect(holder.layers).toHaveLength(2);
    expect(pixelOf(holder, 1, 1, 1)).toEqual(R);
  });

  it('keeps current visibility when a snapshot is restored', () => {
    const { holder, h } = two();
    h.snapshot({ layers: holder.layers.map((l) => ({ ...l, name: 'x' })), activeIndex: 0 });
    holder.layers[1].visible = false;
    h.undo();
    expect(holder.layers[1].visible).toBe(false);
    h.redo();
    expect(holder.layers[1].visible).toBe(false);
  });
});

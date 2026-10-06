import { describe, expect, it } from 'vitest';
import { History, type ImageHolder } from '../src/pixel/history';
import { createPixels, getPixel, setPixel, type Rgba } from '../src/pixel/ops';

const R: Rgba = [255, 0, 0, 255];
const B: Rgba = [0, 0, 255, 128];
const setup = () => {
  const holder: ImageHolder = { px: createPixels(4, 4) };
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

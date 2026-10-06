import { describe, expect, it } from 'vitest';
import { PixelDocument } from '../src/pixel/document';
import { getPixel, line, rectFill, setPixel, type Rgba } from '../src/pixel/ops';

const R: Rgba = [255, 0, 0, 255];
const B: Rgba = [0, 0, 255, 255];
const T: Rgba = [0, 0, 0, 0];
const at = (d: PixelDocument, x: number, y: number) => getPixel(d.px, x, y);
const snapshot = (d: PixelDocument) => [d.width, d.height, Array.from(d.px.data)];

/** Runs `edit` and checks it is exactly one undo step that restores the previous image. */
function expectOneStep(d: PixelDocument, edit: () => void) {
  const before = snapshot(d);
  edit();
  const after = snapshot(d);
  expect(after).not.toEqual(before);
  expect(d.undo()).toBe(true);
  expect(snapshot(d)).toEqual(before);
  expect(d.history.canUndo).toBe(false);
  expect(d.redo()).toBe(true);
  expect(snapshot(d)).toEqual(after);
}

/** Draws a 4x4 red block at (2,2) in a fresh 8x8 document and marks it as the base state. */
function withBlock(): PixelDocument {
  const d = new PixelDocument(8, 8);
  for (const p of rectFill(2, 2, 5, 5)) setPixel(d.px, p.x, p.y, R);
  d.history.clear();
  return d;
}

describe('PixelDocument basics', () => {
  it('starts as a transparent 32x32 canvas with nothing to save', () => {
    const d = new PixelDocument();
    expect([d.width, d.height]).toEqual([32, 32]);
    expect(Array.from(d.px.data).every((v) => v === 0)).toBe(true);
    expect(d.isDirty).toBe(false);
  });

  it('newImage rejects invalid sizes and clears history', () => {
    const d = new PixelDocument(4, 4);
    d.commitShape([{ x: 0, y: 0 }], R);
    expect(() => d.newImage(0, 5)).toThrow();
    expect(() => d.newImage(5000, 5)).toThrow();
    expect(() => d.newImage(2.5, 5)).toThrow();
    expect(d.width).toBe(4);
    d.newImage(16, 24);
    expect([d.width, d.height]).toEqual([16, 24]);
    expect(d.history.canUndo).toBe(false);
    expect(d.isDirty).toBe(false);
  });
});

describe('PixelDocument edits are single steps', () => {
  it('pencil stroke', () => {
    const d = new PixelDocument(8, 8);
    expectOneStep(d, () => {
      d.beginStroke();
      d.paint(line(0, 0, 7, 3), R);
      d.paint(line(7, 3, 7, 7), R);
      d.endStroke();
    });
  });

  it('pencil replaces rather than blends', () => {
    const d = new PixelDocument(2, 2);
    d.commitShape([{ x: 0, y: 0 }], R);
    d.commitShape([{ x: 0, y: 0 }], [10, 20, 30, 128]);
    expect(at(d, 0, 0)).toEqual([10, 20, 30, 128]);
  });

  it('eraser stroke and off-canvas points', () => {
    const d = withBlock();
    expectOneStep(d, () => {
      d.beginStroke();
      d.paint([{ x: 2, y: 2 }, { x: -1, y: 0 }, { x: 99, y: 99 }], T);
      d.endStroke();
    });
  });

  it('fill', () => {
    const d = withBlock();
    expectOneStep(d, () => expect(d.fill(0, 0, B)).toBe(true));
  });

  it('a no-op fill adds no step', () => {
    const d = withBlock();
    expect(d.fill(3, 3, R)).toBe(false);
    expect(d.history.canUndo).toBe(false);
    expect(d.isDirty).toBe(false);
  });

  it('shape commit', () => {
    const d = new PixelDocument(8, 8);
    expectOneStep(d, () => d.commitShape(rectFill(1, 1, 3, 3), B));
  });

  it('delete selection keeps the selection', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    expectOneStep(d, () => d.deleteSelection());
    expect(d.selection).toEqual({ x: 2, y: 2, w: 2, h: 2 });
  });

  it('flip canvas and flip selection', () => {
    const d = new PixelDocument(4, 2);
    d.commitShape([{ x: 0, y: 0 }], R);
    d.history.clear();
    expectOneStep(d, () => d.flip('h'));
    expect(at(d, 3, 0)).toEqual(R);
    const s = withBlock();
    s.select({ x: 2, y: 2, w: 4, h: 4 });
    s.px.data.fill(0);
    setPixel(s.px, 2, 2, R);
    s.history.clear();
    expectOneStep(s, () => s.flip('v'));
    expect(at(s, 2, 5)).toEqual(R);
  });

  it('rotate canvas swaps size and undo restores it', () => {
    const d = new PixelDocument(4, 2);
    d.commitShape([{ x: 0, y: 0 }], R);
    d.history.clear();
    expectOneStep(d, () => d.rotate('cw'));
    expect([d.width, d.height]).toEqual([2, 4]);
    expect(at(d, 1, 0)).toEqual(R);
    d.undo();
    expect([d.width, d.height]).toEqual([4, 2]);
  });

  it('rotate non-square selection follows the pixels', () => {
    const d = new PixelDocument(6, 6);
    for (const p of rectFill(1, 2, 4, 3)) setPixel(d.px, p.x, p.y, R);
    d.history.clear();
    d.select({ x: 1, y: 2, w: 4, h: 2 });
    expectOneStep(d, () => d.rotate('cw'));
    expect(d.selection).toEqual({ x: 2, y: 1, w: 2, h: 4 });
    expect(at(d, 1, 2)).toEqual(T);
    expect(at(d, 2, 1)).toEqual(R);
  });

  it('resize is one step and clears the selection', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    expect(() => d.resize(0, 4, { ax: 0, ay: 0 })).toThrow();
    expect(d.selection).not.toBeNull();
    expectOneStep(d, () => d.resize(4, 4, { ax: 2, ay: 2 }));
    expect(d.selection).toBeNull();
  });
});

describe('PixelDocument move, copy and paste', () => {
  it('move is one step, leaves transparent behind and the selection follows', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    expectOneStep(d, () => {
      expect(d.beginMove(false)).toBe(true);
      d.moveTo(3, 2);
      d.moveTo(4, 2);
      d.endMove();
    });
    expect(d.selection).toEqual({ x: 4, y: 2, w: 2, h: 2 });
  });

  it('shows the lifted source as cleared while dragging', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    d.beginMove(false);
    expect(at(d, 2, 2)).toEqual(T);
    d.cancel();
    expect(at(d, 2, 2)).toEqual(R);
    expect(d.selection).toEqual({ x: 2, y: 2, w: 2, h: 2 });
    expect(d.history.canUndo).toBe(false);
  });

  it('transparent source pixels do not overwrite on drop', () => {
    const d = new PixelDocument(6, 1);
    setPixel(d.px, 0, 0, R); // selection: [R, transparent]
    setPixel(d.px, 3, 0, B);
    d.history.clear();
    d.select({ x: 0, y: 0, w: 2, h: 1 });
    d.beginMove(false);
    d.moveTo(2, 0);
    d.endMove();
    expect(at(d, 2, 0)).toEqual(R);
    expect(at(d, 3, 0)).toEqual(B);
  });

  it('moving partly off canvas clips and clips the selection', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 4, h: 4 });
    d.beginMove(false);
    d.moveTo(6, 6);
    d.endMove();
    expect(at(d, 7, 7)).toEqual(R);
    expect(d.selection).toEqual({ x: 6, y: 6, w: 2, h: 2 });
    d.undo();
    expect(at(d, 5, 5)).toEqual(R);
  });

  it('alt-drag copy keeps the original', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    expectOneStep(d, () => {
      d.beginMove(true);
      d.moveTo(2, 6);
      d.endMove();
    });
    expect(at(d, 2, 2)).toEqual(R);
    expect(at(d, 2, 6)).toEqual(R);
  });

  it('a drop at the same place adds no step', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    d.beginMove(false);
    d.endMove();
    expect(d.history.canUndo).toBe(false);
  });

  it('paste stays floating and movable until committed, then is one step', () => {
    const d = withBlock();
    expect(d.paste({ x: 0, y: 0 })).toBe(false); // nothing copied
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    expect(d.copySelection()).toBe(true);
    d.select(null);
    expectOneStep(d, () => {
      expect(d.paste({ x: 0, y: 0 })).toBe(true);
      expect(at(d, 0, 0)).toEqual(T); // not written yet
      d.beginMove(false);
      d.moveTo(0, 5);
      d.endMove();
      expect(d.floating).not.toBeNull();
      d.select(null); // commits
    });
    expect(at(d, 0, 5)).toEqual(R);
  });

  it('Esc cancels a pending paste', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 2, h: 2 });
    d.copySelection();
    d.paste({ x: 0, y: 0 });
    d.cancel();
    expect(d.floating).toBeNull();
    expect(d.selection).toBeNull();
    expect(d.history.canUndo).toBe(false);
  });

  it('Esc clears a plain selection without touching the image', () => {
    const d = withBlock();
    d.select({ x: 2, y: 2, w: 9, h: 9 });
    expect(d.selection).toEqual({ x: 2, y: 2, w: 6, h: 6 });
    d.cancel();
    expect(d.selection).toBeNull();
    expect(d.history.canUndo).toBe(false);
  });
});

describe('PixelDocument dirty tracking', () => {
  it('is clean after save and after undoing back to it', () => {
    const d = new PixelDocument(4, 4);
    d.commitShape([{ x: 0, y: 0 }], R);
    d.markSaved();
    expect(d.isDirty).toBe(false);
    d.commitShape([{ x: 1, y: 1 }], B);
    expect(d.isDirty).toBe(true);
    d.undo();
    expect(d.isDirty).toBe(false);
  });
});

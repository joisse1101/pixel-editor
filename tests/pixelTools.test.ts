import { describe, expect, it, vi } from 'vitest';
import { ColorState } from '../src/pixel/colors';
import { PixelDocument } from '../src/pixel/document';
import { getPixel, type Rgba } from '../src/pixel/ops';
import { ToolController, type ToolEvent, type ToolView } from '../src/pixel/tools';

const R: Rgba = [255, 0, 0, 255];
const B: Rgba = [0, 0, 255, 255];
const T: Rgba = [0, 0, 0, 0];
const LEFT: ToolEvent = { button: 0, shiftKey: false, altKey: false };
const RIGHT: ToolEvent = { ...LEFT, button: 2 };

function setup(w = 16, h = 16) {
  const doc = new PixelDocument(w, h);
  const colors = new ColorState();
  colors.setColor(R);
  const view: ToolView = { preview: null, redraw: vi.fn() };
  const onColor = vi.fn();
  const tools = new ToolController(doc, view, colors, onColor);
  const at = (x: number, y: number) => getPixel(doc.px, x, y);
  return { doc, colors, view, tools, onColor, at };
}
const pt = (x: number, y: number) => ({ x, y });

describe('pencil', () => {
  it('sets a clicked pixel exactly, including alpha, as one step', () => {
    const { doc, colors, tools, at } = setup();
    colors.setColor([10, 20, 30, 128]);
    tools.down(pt(2, 2), LEFT);
    tools.up();
    expect(at(2, 2)).toEqual([10, 20, 30, 128]);
    colors.setColor([50, 60, 70, 64]);
    tools.down(pt(2, 2), LEFT);
    tools.up();
    expect(at(2, 2)).toEqual([50, 60, 70, 64]); // replaced, not blended
    expect(doc.undo()).toBe(true);
    expect(at(2, 2)).toEqual([10, 20, 30, 128]);
    expect(doc.undo()).toBe(true);
    expect(at(2, 2)).toEqual(T);
  });

  it('leaves no gaps on a fast drag and undoes as one step', () => {
    const { doc, tools, at } = setup();
    tools.down(pt(0, 0), LEFT);
    tools.move(pt(10, 3), LEFT);
    tools.up();
    for (const [x, y] of [[0, 0], [3, 1], [5, 2], [10, 3]]) expect(at(x, y)).toEqual(R);
    doc.undo();
    expect(Array.from(doc.px.data).every((v) => v === 0)).toBe(true);
    expect(doc.history.canUndo).toBe(false);
  });

  it('ignores points off the canvas', () => {
    const { tools, at } = setup(4, 4);
    tools.down(pt(-3, 1), LEFT);
    tools.move(pt(6, 1), LEFT);
    tools.up();
    expect(at(0, 1)).toEqual(R);
    expect(at(3, 1)).toEqual(R);
  });
});

describe('eraser and right-click', () => {
  it('eraser tool clears pixels', () => {
    const { doc, tools, at } = setup();
    doc.commitShape([pt(1, 1), pt(2, 1)], R);
    tools.tool = 'eraser';
    tools.down(pt(1, 1), LEFT);
    tools.move(pt(2, 1), LEFT);
    tools.up();
    expect(at(1, 1)).toEqual(T);
    expect(at(2, 1)).toEqual(T);
  });

  it('right-drag with the pencil erases and keeps the colour and recent list', () => {
    const { doc, colors, tools, at } = setup();
    doc.commitShape([pt(1, 1), pt(2, 1)], B);
    tools.down(pt(1, 1), RIGHT);
    tools.move(pt(2, 1), RIGHT);
    tools.up();
    expect(at(1, 1)).toEqual(T);
    expect(at(2, 1)).toEqual(T);
    expect(colors.color).toEqual(R);
    expect(colors.recent).toEqual([]);
  });

  it('right-click erases with the fill tool too', () => {
    const { doc, tools, at } = setup(3, 3);
    doc.commitShape([pt(0, 0)], B);
    tools.tool = 'fill';
    tools.down(pt(0, 0), RIGHT);
    expect(at(0, 0)).toEqual(T);
  });

  it('does nothing for the select tool (handled separately)', () => {
    const { doc, tools } = setup();
    tools.tool = 'select';
    tools.down(pt(1, 1), RIGHT);
    expect(doc.history.canUndo).toBe(false);
  });
});

describe('eyedropper', () => {
  it('picks the exact RGBA without touching the history', () => {
    const { doc, colors, tools, onColor } = setup();
    doc.commitShape([pt(3, 3)], [10, 20, 30, 128]);
    doc.history.clear();
    tools.tool = 'eyedropper';
    tools.down(pt(3, 3), LEFT);
    expect(colors.color).toEqual([10, 20, 30, 128]);
    expect(onColor).toHaveBeenCalled();
    expect(doc.history.canUndo).toBe(false);
    tools.down(pt(5, 5), LEFT);
    expect(colors.color).toEqual(T);
  });

  it('Alt+click picks with pencil, fill, line and rectangle', () => {
    for (const tool of ['pencil', 'fill', 'line', 'rect'] as const) {
      const { doc, colors, tools, at } = setup();
      doc.commitShape([pt(3, 3)], B);
      doc.history.clear();
      tools.tool = tool;
      tools.down(pt(3, 3), { ...LEFT, altKey: true });
      tools.up();
      expect(colors.color).toEqual(B);
      expect(at(3, 3)).toEqual(B);
      expect(doc.history.canUndo).toBe(false);
    }
  });
});

describe('fill', () => {
  it('fills once per click and skips a same-colour fill', () => {
    const { doc, tools, at } = setup(4, 4);
    tools.tool = 'fill';
    tools.down(pt(0, 0), LEFT);
    expect(at(3, 3)).toEqual(R);
    tools.down(pt(0, 0), LEFT);
    doc.undo();
    expect(at(3, 3)).toEqual(T);
    expect(doc.history.canUndo).toBe(false);
  });
});

describe('line and rectangle', () => {
  it('previews while dragging and writes only on release, as one step', () => {
    const { doc, view, tools, at } = setup();
    tools.tool = 'line';
    tools.down(pt(1, 4), LEFT);
    tools.move(pt(6, 4), LEFT);
    expect([...view.preview!.points]).toHaveLength(6);
    expect(at(3, 4)).toEqual(T);
    tools.up();
    expect(view.preview).toBeNull();
    for (let x = 1; x <= 6; x++) expect(at(x, 4)).toEqual(R);
    doc.undo();
    expect(at(3, 4)).toEqual(T);
    expect(doc.history.canUndo).toBe(false);
  });

  it('Shift constrains a line to 45 degrees and a rectangle to a square', () => {
    const a = setup();
    a.tools.tool = 'line';
    a.tools.down(pt(0, 0), LEFT);
    a.tools.move(pt(6, 5), { ...LEFT, shiftKey: true });
    a.tools.up();
    expect(a.at(5, 5)).toEqual(R);
    expect(a.at(6, 5)).toEqual(T);

    const b = setup();
    b.tools.tool = 'rect';
    b.tools.filled = true;
    b.tools.down(pt(1, 1), LEFT);
    b.tools.move(pt(4, 7), { ...LEFT, shiftKey: true });
    b.tools.up();
    expect(b.at(7, 7)).toEqual(R); // square 1..7, not the dragged 1..4 x 1..7
    expect(b.at(7, 1)).toEqual(R);
    expect(b.at(8, 1)).toEqual(T);
  });

  it('Esc cancels with the image unchanged', () => {
    const { doc, view, tools } = setup();
    tools.tool = 'rect';
    tools.down(pt(1, 1), LEFT);
    tools.move(pt(5, 5), LEFT);
    expect(tools.cancelDrag()).toBe(true);
    expect(view.preview).toBeNull();
    tools.up();
    expect(doc.history.canUndo).toBe(false);
    expect(Array.from(doc.px.data).every((v) => v === 0)).toBe(true);
    expect(tools.cancelDrag()).toBe(false);
  });

  it('draws outline or filled rectangles in any direction, clipped to the canvas', () => {
    const o = setup(8, 8);
    o.tools.tool = 'rect';
    o.tools.down(pt(6, 5), LEFT);
    o.tools.move(pt(2, 2), LEFT);
    o.tools.up();
    expect(o.at(2, 2)).toEqual(R);
    expect(o.at(4, 3)).toEqual(T); // interior untouched
    expect(o.at(6, 5)).toEqual(R);

    const f = setup(4, 4);
    f.tools.tool = 'rect';
    f.tools.filled = true;
    f.tools.down(pt(2, 2), LEFT);
    f.tools.move(pt(9, 9), LEFT);
    f.tools.up();
    expect(f.at(3, 3)).toEqual(R);
    expect(f.doc.undo()).toBe(true);
  });

  it('right-drag erases the shape instead and keeps the colour', () => {
    const { doc, view, colors, tools, at } = setup(6, 6);
    doc.commitShape([pt(1, 1), pt(2, 1), pt(3, 1)], B);
    tools.tool = 'line';
    tools.down(pt(1, 1), RIGHT);
    tools.move(pt(3, 1), RIGHT);
    expect(view.preview!.color).not.toEqual(T);
    tools.up();
    expect(at(2, 1)).toEqual(T);
    expect(colors.color).toEqual(R);
  });
});

describe('recent colours', () => {
  it('records red, blue, red as red then blue', () => {
    const { colors, tools } = setup();
    for (const c of [R, B, R]) {
      colors.setColor(c);
      tools.down(pt(0, 0), LEFT);
      tools.up();
    }
    expect(colors.recent).toEqual([R, B]);
  });
});

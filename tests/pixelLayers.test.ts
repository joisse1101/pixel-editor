import { describe, expect, it } from 'vitest';
import type { FileHandle } from '../src/io/files';
import { PixelDocument } from '../src/pixel/document';
import { createPixels, getPixel, setPixel, type Rgba } from '../src/pixel/ops';

const R: Rgba = [255, 0, 0, 255];
const B: Rgba = [0, 0, 255, 255];
const T: Rgba = [0, 0, 0, 0];

const names = (d: PixelDocument) => d.layers.map((l) => l.name);
const sizes = (d: PixelDocument) => d.layers.map((l) => [l.px.width, l.px.height]);
const layerAt = (d: PixelDocument, i: number, x: number, y: number) => getPixel(d.layers[i].px, x, y);
const solid = (w: number, h: number, c: Rgba) => {
  const px = createPixels(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(px, x, y, c);
  return px;
};

/** Three 4x4 layers a, b, c (c on top, active); the bottom one has a red pixel at (0,0). No history. */
function threeLayers(): PixelDocument {
  const d = new PixelDocument(4, 4);
  setPixel(d.layers[0].px, 0, 0, R); // not blank, so the first import adds a layer instead of adopting
  d.addLayers([
    { name: 'b', px: createPixels(4, 4) },
    { name: 'c', px: createPixels(4, 4) },
  ]);
  d.renameLayer(0, 'a');
  d.history.clear();
  return d;
}

/** Checks the edit is exactly one undo step on the layer list. */
function expectOneStep(d: PixelDocument, edit: () => void) {
  const before = names(d);
  const active = d.activeIndex;
  edit();
  expect(names(d)).not.toEqual(before);
  expect(d.undo()).toBe(true);
  expect(names(d)).toEqual(before);
  expect(d.activeIndex).toBe(active);
  expect(d.history.canUndo).toBe(false);
  expect(d.redo()).toBe(true);
}

describe('PixelDocument layers', () => {
  it('starts with one layer and px follows the active layer', () => {
    const d = new PixelDocument(4, 4);
    expect(d.layers).toHaveLength(1);
    d.addLayer();
    d.history.clear();
    d.commitShape([{ x: 1, y: 1 }], R);
    expect(d.px).toBe(d.layers[1].px);
    expect(layerAt(d, 0, 1, 1)).toEqual(T);
    expect(layerAt(d, 1, 1, 1)).toEqual(R);
  });

  it('setActive commits a floating paste to its own layer and keeps selection and clipboard', () => {
    const d = threeLayers();
    d.setActive(0);
    d.select({ x: 0, y: 0, w: 2, h: 2 });
    expect(d.copySelection()).toBe(true);
    d.setActive(1);
    expect(d.selection).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    d.paste({ x: 2, y: 2 });
    expect(d.floating).not.toBeNull();
    d.setActive(2);
    expect(d.floating).toBeNull();
    expect(d.activeIndex).toBe(2);
    expect(layerAt(d, 1, 2, 2)).toEqual(R);
    expect(layerAt(d, 2, 2, 2)).toEqual(T);
    expect(d.clipboard).not.toBeNull();
    expect(d.history.canUndo).toBe(true);
  });

  it('copies across layers and leaves the source unchanged', () => {
    const d = threeLayers();
    d.setActive(0);
    d.select({ x: 0, y: 0, w: 1, h: 1 });
    d.copySelection();
    d.setActive(2);
    d.paste({ x: 3, y: 3 });
    d.select(null);
    expect(layerAt(d, 2, 3, 3)).toEqual(R);
    expect(layerAt(d, 0, 3, 3)).toEqual(T);
    expect(layerAt(d, 0, 0, 0)).toEqual(R);
  });

  it('adds a layer above the active one as one undoable step', () => {
    const d = threeLayers();
    d.setActive(0);
    expectOneStep(d, () => d.addLayer());
    expect(d.activeIndex).toBe(1);
    expect(d.layers).toHaveLength(4);
  });

  it('deletes a layer, activates the nearest, keeps the last, and undo restores pixels', () => {
    const d = threeLayers();
    d.setActive(0);
    expect(d.deleteLayer()).toBe(true);
    expect(names(d)).toEqual(['b', 'c']);
    expect(d.activeIndex).toBe(0);
    d.undo();
    expect(names(d)).toEqual(['a', 'b', 'c']);
    expect(layerAt(d, 0, 0, 0)).toEqual(R);
    d.setActive(2);
    d.deleteLayer();
    expect(d.activeIndex).toBe(1);
    const one = new PixelDocument(2, 2);
    expect(one.deleteLayer()).toBe(false);
    expect(one.layers).toHaveLength(1);
  });

  it('deleting a non-active layer keeps the active layer active', () => {
    const d = threeLayers();
    d.setActive(2);
    d.deleteLayer(0);
    expect(d.activeLayer.name).toBe('c');
    expect(d.activeIndex).toBe(1);
  });

  it('renames and moves layers as undoable steps', () => {
    const d = threeLayers();
    d.setActive(1);
    expect(d.renameLayer(1, '  mid  ')).toBe(true);
    expect(names(d)).toEqual(['a', 'mid', 'c']);
    expect(d.renameLayer(1, '   ')).toBe(false);
    d.undo();
    expect(names(d)).toEqual(['a', 'b', 'c']);
    expect(d.moveLayer(1, 2)).toBe(true);
    expect(names(d)).toEqual(['a', 'c', 'b']);
    expect(d.activeLayer.name).toBe('b');
    expect(d.moveLayer(2, 2)).toBe(false);
    expect(d.moveLayer(2, 3)).toBe(false);
    d.undo();
    expect(names(d)).toEqual(['a', 'b', 'c']);
    expect(d.activeLayer.name).toBe('b');
    d.redo();
    expect(names(d)).toEqual(['a', 'c', 'b']);
  });

  it('moves a layer across several positions as one undo step', () => {
    const d = threeLayers();
    d.addLayer();
    d.renameLayer(d.activeIndex, 'd');
    d.setActive(1);
    expect(names(d)).toEqual(['a', 'b', 'c', 'd']);
    expect(d.moveLayer(0, 3)).toBe(true);
    expect(names(d)).toEqual(['b', 'c', 'd', 'a']);
    expect(d.activeLayer.name).toBe('b');
    expect(d.moveLayer(3, 0)).toBe(true);
    expect(names(d)).toEqual(['a', 'b', 'c', 'd']);
    d.moveLayer(0, 3);
    d.undo();
    expect(names(d)).toEqual(['a', 'b', 'c', 'd']);
    expect(d.activeLayer.name).toBe('b');
  });

  it('moving a layer in place records no undo step', () => {
    const d = threeLayers();
    expect(d.moveLayer(1, 1)).toBe(false);
    expect(d.history.canUndo).toBe(false);
    expect(names(d)).toEqual(['a', 'b', 'c']);
  });

  it('duplicates the active layer above it with independent pixels', () => {
    const d = threeLayers();
    d.setActive(0);
    d.setVisible(0, false);
    d.duplicateLayer();
    expect(names(d)).toEqual(['a', 'a copy', 'b', 'c']);
    expect(d.activeIndex).toBe(1);
    expect(d.layers[1].visible).toBe(false);
    expect(layerAt(d, 1, 0, 0)).toEqual(R);
    d.commitShape([{ x: 0, y: 0 }], B);
    expect(layerAt(d, 1, 0, 0)).toEqual(B);
    expect(layerAt(d, 0, 0, 0)).toEqual(R);
    d.undo();
    expect(layerAt(d, 1, 0, 0)).toEqual(R);
    d.undo();
    expect(names(d)).toEqual(['a', 'b', 'c']);
  });

  it('visibility is not an undo step and does not mark the document dirty', () => {
    const d = threeLayers();
    d.setVisible(1, false);
    expect(d.layers[1].visible).toBe(false);
    expect(d.isDirty).toBe(false);
    expect(d.history.canUndo).toBe(false);
  });

  it('undoing an edit on another layer re-activates that layer', () => {
    const d = threeLayers();
    d.setActive(0);
    d.commitShape([{ x: 1, y: 1 }], B);
    d.setActive(2);
    d.undo();
    expect(d.activeIndex).toBe(0);
    expect(layerAt(d, 0, 1, 1)).toEqual(T);
  });

  it('canvas resize, flip and rotate apply to every layer as one step', () => {
    const d = threeLayers();
    setPixel(d.layers[2].px, 3, 0, B);
    d.history.clear();
    d.resize(6, 6, { ax: 2, ay: 2 });
    expect(sizes(d)).toEqual([[6, 6], [6, 6], [6, 6]]);
    expect(layerAt(d, 0, 2, 2)).toEqual(R);
    expect(layerAt(d, 2, 5, 2)).toEqual(B);
    d.undo();
    expect(sizes(d)).toEqual([[4, 4], [4, 4], [4, 4]]);
    expect(layerAt(d, 0, 0, 0)).toEqual(R);
    expect(d.history.canUndo).toBe(false);

    d.flip('h');
    expect(layerAt(d, 0, 3, 0)).toEqual(R);
    expect(layerAt(d, 2, 0, 0)).toEqual(B);
    d.undo();
    expect(layerAt(d, 0, 0, 0)).toEqual(R);
    expect(d.history.canUndo).toBe(false);

    const wide = new PixelDocument(4, 2);
    wide.addLayer();
    wide.history.clear();
    setPixel(wide.layers[0].px, 0, 0, R);
    setPixel(wide.layers[1].px, 0, 0, B);
    wide.rotate('cw');
    expect(sizes(wide)).toEqual([[2, 4], [2, 4]]);
    expect(layerAt(wide, 0, 1, 0)).toEqual(R);
    expect(layerAt(wide, 1, 1, 0)).toEqual(B);
    wide.undo();
    expect(sizes(wide)).toEqual([[4, 2], [4, 2]]);
    expect(layerAt(wide, 0, 0, 0)).toEqual(R);
    expect(wide.history.canUndo).toBe(false);
  });

  it('flip of a selection touches the active layer only', () => {
    const d = threeLayers();
    setPixel(d.layers[1].px, 0, 0, B);
    d.setActive(0);
    d.select({ x: 0, y: 0, w: 2, h: 1 });
    d.flip('h');
    expect(layerAt(d, 0, 1, 0)).toEqual(R);
    expect(layerAt(d, 0, 0, 0)).toEqual(T);
    expect(layerAt(d, 1, 0, 0)).toEqual(B);
  });

  it('newImage and load reset to a single layer with no history', () => {
    const d = threeLayers();
    d.addLayer();
    d.newImage(5, 5);
    expect(d.layers).toHaveLength(1);
    expect(d.history.canUndo).toBe(false);
    expect(d.isDirty).toBe(false);
    d.addLayer();
    d.load(solid(3, 2, R), 'sprite');
    expect(names(d)).toEqual(['sprite']);
    expect([d.width, d.height]).toEqual([3, 2]);
    expect(d.history.canUndo).toBe(false);
  });
});

describe('PixelDocument addLayers', () => {
  it('adopts the first PNG size for a blank document and stays clean', () => {
    const d = new PixelDocument(32, 32);
    expect(d.addLayers([{ name: 'a.png', px: solid(6, 4, R) }])).toBe(true);
    expect([d.width, d.height]).toEqual([6, 4]);
    expect(names(d)).toEqual(['a.png']);
    expect(d.isDirty).toBe(false);
    expect(d.undo()).toBe(true);
    expect([d.width, d.height]).toEqual([32, 32]);
    expect(d.isDirty).toBe(true);
  });

  it('adds same-size layers above, in order, without resizing', () => {
    const d = new PixelDocument(4, 4);
    setPixel(d.px, 0, 0, R);
    d.history.clear();
    const grown = d.addLayers([
      { name: 'x', px: solid(4, 4, B) },
      { name: 'y', px: solid(4, 4, R) },
    ]);
    expect(grown).toBe(false);
    expect(names(d)).toEqual(['Layer 1', 'x', 'y']);
    expect(d.activeLayer.name).toBe('y');
    expect(d.isDirty).toBe(true);
    expect(layerAt(d, 0, 0, 0)).toEqual(R);
  });

  it('grows every layer for a larger PNG, anchored top-left, and undoes', () => {
    const d = new PixelDocument(4, 4);
    setPixel(d.px, 3, 3, R);
    d.history.clear();
    expect(d.addLayers([{ name: 'big', px: solid(6, 5, B) }])).toBe(true);
    expect([d.width, d.height]).toEqual([6, 5]);
    expect(sizes(d)).toEqual([[6, 5], [6, 5]]);
    expect(layerAt(d, 0, 3, 3)).toEqual(R);
    expect(layerAt(d, 0, 5, 4)).toEqual(T);
    expect(layerAt(d, 1, 5, 4)).toEqual(B);
    d.undo();
    expect(names(d)).toEqual(['Layer 1']);
    expect([d.width, d.height]).toEqual([4, 4]);
    expect(layerAt(d, 0, 3, 3)).toEqual(R);
  });

  it('pads a smaller PNG at the top-left', () => {
    const d = new PixelDocument(4, 4);
    setPixel(d.px, 0, 0, R);
    d.history.clear();
    d.addLayers([{ name: 'small', px: solid(2, 2, B) }]);
    expect([d.width, d.height]).toEqual([4, 4]);
    expect(layerAt(d, 1, 1, 1)).toEqual(B);
    expect(layerAt(d, 1, 2, 2)).toEqual(T);
  });

  it('uses the largest width and height across files of mixed sizes', () => {
    const d = new PixelDocument(4, 4);
    setPixel(d.px, 0, 0, R);
    d.history.clear();
    d.addLayers([
      { name: 'wide', px: solid(8, 2, B) },
      { name: 'tall', px: solid(3, 7, R) },
    ]);
    expect([d.width, d.height]).toEqual([8, 7]);
    expect(d.layers.every((l) => l.px.width === 8 && l.px.height === 7)).toBe(true);
    d.undo();
    expect([d.width, d.height]).toEqual([4, 4]);
    expect(d.layers).toHaveLength(1);
  });

  it('throws and changes nothing when the result is too large', () => {
    const d = new PixelDocument(4, 4);
    setPixel(d.px, 0, 0, R);
    d.history.clear();
    expect(() => d.addLayers([{ name: 'huge', px: createPixels(5000, 1) }])).toThrow();
    expect(d.layers).toHaveLength(1);
    expect(d.history.canUndo).toBe(false);
  });
});

describe('PixelDocument layer source link', () => {
  const handle = { createWritable: async () => ({ write: async () => {}, close: async () => {} }) } as unknown as FileHandle;
  const link = (name: string) => ({ handle, name });
  const sourceNames = (d: PixelDocument) => d.layers.map((l) => l.source?.name);

  function linked(): PixelDocument {
    const d = new PixelDocument(4, 4);
    d.addLayers([
      { name: 'a', px: solid(4, 4, R), source: link('a.png') },
      { name: 'b', px: solid(4, 4, B), source: link('b.png') },
    ]);
    return d;
  }

  it('stores the source per imported layer and leaves others unlinked', () => {
    const d = new PixelDocument(4, 4);
    d.addLayers([{ name: 'x', px: solid(4, 4, R) }]);
    d.addLayers([{ name: 'a', px: solid(4, 4, B), source: link('a.png') }]);
    expect(sourceNames(d)).toEqual([undefined, 'a.png']);
    d.addLayer();
    expect(sourceNames(d)).toEqual([undefined, 'a.png', undefined]);
  });

  it('keeps the link through rename, move, canvas resize, and undo/redo', () => {
    const d = linked();
    d.renameLayer(0, 'renamed');
    expect(sourceNames(d)).toEqual(['a.png', 'b.png']);
    d.moveLayer(0, 1);
    expect(sourceNames(d)).toEqual(['b.png', 'a.png']);
    d.resize(6, 6, { ax: 0, ay: 0 });
    expect(sourceNames(d)).toEqual(['b.png', 'a.png']);
    d.undo();
    d.undo();
    d.undo();
    expect(sourceNames(d)).toEqual(['a.png', 'b.png']);
    d.redo();
    d.redo();
    d.redo();
    expect(sourceNames(d)).toEqual(['b.png', 'a.png']);
  });

  it('keeps the link when a grown canvas pads the layers', () => {
    const d = linked();
    d.addLayers([{ name: 'big', px: solid(8, 8, R) }]);
    expect(sourceNames(d)).toEqual(['a.png', 'b.png', undefined]);
  });

  it('returns the link with an undone delete', () => {
    const d = linked();
    d.deleteLayer(0);
    expect(sourceNames(d)).toEqual(['b.png']);
    d.undo();
    expect(sourceNames(d)).toEqual(['a.png', 'b.png']);
  });

  it('does not copy the link to a duplicate', () => {
    const d = linked();
    d.duplicateLayer();
    expect(sourceNames(d)).toEqual(['a.png', 'b.png', undefined]);
  });
});

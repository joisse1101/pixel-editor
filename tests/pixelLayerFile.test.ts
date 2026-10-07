import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileHandle } from '../src/io/files';
import { PixelDocument } from '../src/pixel/document';
import { saveAllowed, saveLayerFile } from '../src/pixel/layerFile';
import { createPixels, getPixel, setPixel, type Rgba } from '../src/pixel/ops';
import { decodeImageFile } from '../src/pixel/pngFile';

afterEach(() => vi.unstubAllGlobals());

const R: Rgba = [255, 0, 0, 255];
const B: Rgba = [0, 0, 255, 128];

function fileHandle(name: string, fail = false) {
  const writes: Uint8Array[] = [];
  const handle = {
    name,
    getFile: async () => new File([], name),
    createWritable: async () => {
      if (fail) throw new Error('permission denied');
      return {
        write: async (d: string | Uint8Array) => void writes.push(d as Uint8Array),
        close: async () => {},
      };
    },
  } as unknown as FileHandle;
  return { handle, writes };
}

function stubFileAccess() {
  vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn() });
}

function twoLinked(fail = false) {
  const a = fileHandle('a.png');
  const b = fileHandle('b.png', fail);
  const d = new PixelDocument(4, 4);
  const px = createPixels(4, 4);
  setPixel(px, 1, 1, R);
  const px2 = createPixels(4, 4);
  setPixel(px2, 2, 2, B);
  d.addLayers([
    { name: 'a', px, source: { handle: a.handle, name: 'a.png' } },
    { name: 'b', px: px2, source: { handle: b.handle, name: 'b.png' } },
  ]);
  return { d, a, b };
}

describe('saveLayerFile', () => {
  it('writes the exact layer pixels for a hidden, half-transparent layer', async () => {
    stubFileAccess();
    const { d, a, b } = twoLinked();
    d.layers[0].visible = false;
    d.layers[0].opacity = 0.5;
    await saveLayerFile(d.layers[0]);
    expect(b.writes).toHaveLength(0);
    const back = await decodeImageFile(a.writes[0]);
    expect(Array.from(back.data)).toEqual(Array.from(d.layers[0].px.data));
    expect(getPixel(back, 1, 1)).toEqual(R);
    expect(getPixel(back, 2, 2)).toEqual([0, 0, 0, 0]);
  });

  it('leaves the document dirty state and history alone', async () => {
    stubFileAccess();
    const { d } = twoLinked();
    const before = [d.isDirty, d.history.canUndo, d.layers.length];
    await saveLayerFile(d.layers[1]);
    expect([d.isDirty, d.history.canUndo, d.layers.length]).toEqual(before);
  });

  it('rejects and changes nothing when the write fails', async () => {
    stubFileAccess();
    const { d } = twoLinked(true);
    const before = Array.from(d.layers[1].px.data);
    await expect(saveLayerFile(d.layers[1])).rejects.toThrow('permission denied');
    expect(Array.from(d.layers[1].px.data)).toEqual(before);
    expect(d.layers).toHaveLength(2);
  });

  it('rejects a layer with no source', async () => {
    const d = new PixelDocument(2, 2);
    await expect(saveLayerFile(d.layers[0])).rejects.toThrow('no source');
  });
});

describe('saveAllowed', () => {
  const { d } = twoLinked();
  const h = fileHandle('x.png').handle;

  it('is off with two linked layers until Save As completes', () => {
    expect(saveAllowed(d.layers, null, false)).toBe(false);
    expect(saveAllowed(d.layers, h, true)).toBe(false);
    expect(saveAllowed(d.layers, h, false)).toBe(true);
  });

  it('stays on after Save As when more linked layers arrive', () => {
    const more = twoLinked().d;
    more.addLayers([{ name: 'c', px: createPixels(4, 4), source: { handle: h, name: 'c.png' } }]);
    expect(saveAllowed(more.layers, h, false)).toBe(true);
  });

  it('follows the usual rules with at most one linked layer', () => {
    const one = twoLinked().d;
    one.deleteLayer(0);
    expect(saveAllowed(one.layers, null, false)).toBe(true);
    expect(saveAllowed(new PixelDocument(2, 2).layers, null, false)).toBe(true);
  });
});

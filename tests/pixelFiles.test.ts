import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBytes, saveText } from '../src/io/files';
import { decodeImageFile, encodeImageFile } from '../src/pixel/pngFile';
import { createPixels } from '../src/pixel/ops';

afterEach(() => vi.unstubAllGlobals());

describe('PNG round trip', () => {
  it('keeps every RGBA value, including alpha 0 and alpha 128', async () => {
    const px = createPixels(3, 2);
    px.data.set([10, 20, 30, 128, 0, 0, 0, 0, 255, 255, 255, 255, 9, 8, 7, 0, 1, 2, 3, 4, 250, 251, 252, 253]);
    const back = await decodeImageFile(await encodeImageFile(px));
    expect([back.width, back.height]).toEqual([3, 2]);
    expect(Array.from(back.data)).toEqual(Array.from(px.data));
  });

  it('raises an error for a file that is not an image', async () => {
    const fallback = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(decodeImageFile(new TextEncoder().encode('hello'), fallback)).rejects.toThrow('Not a valid image');
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('uses the fallback when the codec cannot read the file', async () => {
    const px = createPixels(1, 1);
    const fallback = vi.fn().mockResolvedValue(px);
    expect(await decodeImageFile(new Uint8Array([1, 2, 3]), fallback)).toBe(px);
  });
});

describe('saving', () => {
  function stubDom(api: Record<string, unknown>) {
    const click = vi.fn();
    const anchor = { href: '', download: '', click };
    vi.stubGlobal('window', api);
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    return { anchor, click };
  }

  it('downloads when the picker API is missing', async () => {
    const { anchor, click } = stubDom({});
    const res = await saveBytes(new Uint8Array([1]), null, 'a.png');
    expect(res).toEqual({ handle: null, name: 'a.png' });
    expect(anchor.download).toBe('a.png');
    expect(click).toHaveBeenCalledOnce();
  });

  it('writes binary data to a picked file, then reuses the handle', async () => {
    const write = vi.fn();
    const handle = { name: 'sprite.png', createWritable: async () => ({ write, close: async () => {} }), getFile: vi.fn() };
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    stubDom({ showOpenFilePicker: vi.fn(), showSaveFilePicker });
    const bytes = new Uint8Array([1, 2]);

    const first = await saveBytes(bytes, null, 'a.png');
    expect(first?.handle).toBe(handle);
    expect(showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ types: [expect.objectContaining({ accept: { 'image/png': ['.png'] } })] }));
    expect(write).toHaveBeenCalledWith(bytes);

    await saveBytes(bytes, handle, 'a.png');
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    await saveBytes(bytes, handle, 'a.png', true);
    expect(showSaveFilePicker).toHaveBeenCalledTimes(2);
  });

  it('still saves text through the same path', async () => {
    const { anchor } = stubDom({});
    expect(await saveText('{}', null, 'Office.json')).toEqual({ handle: null, name: 'Office.json' });
    expect(anchor.download).toBe('Office.json');
  });

  it('returns null when the user cancels', async () => {
    const abort = Object.assign(new DOMException('x', 'AbortError'));
    stubDom({ showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn().mockRejectedValue(abort) });
    expect(await saveBytes(new Uint8Array(), null, 'a.png')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { ColorState, fromHex, MAX_RECENT, toHex } from '../src/pixel/colors';

describe('hex conversion', () => {
  it('round trips and keeps the alpha separate', () => {
    expect(toHex([255, 0, 128, 40])).toBe('#ff0080');
    expect(fromHex('#ff0080', 40)).toEqual([255, 0, 128, 40]);
    expect(fromHex('#FF0080')).toEqual([255, 0, 128, 255]);
  });

  it('rejects invalid colours', () => {
    expect(fromHex('red')).toBeNull();
    expect(fromHex('#fff')).toBeNull();
  });
});

describe('ColorState', () => {
  it('defaults to opaque black', () => {
    expect(new ColorState().color).toEqual([0, 0, 0, 255]);
  });

  it('keeps alpha when the RGB changes and clamps alpha', () => {
    const s = new ColorState();
    s.setAlpha(128);
    s.setRgb('#102030');
    expect(s.color).toEqual([16, 32, 48, 128]);
    s.setAlpha(999);
    expect(s.color[3]).toBe(255);
    s.setAlpha(-4);
    expect(s.color[3]).toBe(0);
    expect(s.setRgb('nope')).toBe(false);
  });

  it('puts the most recent colour first without duplicates', () => {
    const s = new ColorState();
    s.markUsed([1, 1, 1, 255]);
    s.markUsed([2, 2, 2, 255]);
    s.markUsed([1, 1, 1, 255]);
    expect(s.recent).toEqual([
      [1, 1, 1, 255],
      [2, 2, 2, 255],
    ]);
  });

  it('treats the same RGB with another alpha as a different colour', () => {
    const s = new ColorState();
    s.markUsed([1, 1, 1, 255]);
    s.markUsed([1, 1, 1, 128]);
    expect(s.recent).toHaveLength(2);
  });

  it('holds at most 16, dropping the oldest', () => {
    const s = new ColorState();
    for (let i = 0; i < MAX_RECENT + 4; i++) s.markUsed([i, 0, 0, 255]);
    expect(s.recent).toHaveLength(MAX_RECENT);
    expect(s.recent[0]).toEqual([MAX_RECENT + 3, 0, 0, 255]);
    expect(s.recent.at(-1)).toEqual([4, 0, 0, 255]);
  });
});

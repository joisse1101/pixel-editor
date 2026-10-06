import { describe, expect, it } from 'vitest';
import { blockFromSheetRect } from '../src/editor/block';
import { transformBlock } from '../src/editor/orientation';
import type { Block, Project } from '../src/model/types';

/** A w x h block whose tile ids are letters in row-major order. */
const mk = (w: number, h: number): Block => ({
  width: w,
  height: h,
  cells: Array.from({ length: w * h }, (_, i) => ({
    dx: i % w,
    dy: Math.floor(i / w),
    tile: { id: String(i), sheetId: 's', flipX: false, flipY: false, rotation: 0 as const, extra: {} },
  })),
});
const at = (b: Block, dx: number, dy: number) => b.cells.find((c) => c.dx === dx && c.dy === dy)!.tile;

describe('block orientation', () => {
  it('flips a 2x1 block horizontally: B left of A, each mirrored', () => {
    const f = transformBlock(mk(2, 1), 'flipH');
    expect(at(f, 0, 0).id).toBe('1');
    expect(at(f, 1, 0).id).toBe('0');
    expect(at(f, 0, 0).flipX).toBe(true);
  });

  it('flips a 1x2 block vertically', () => {
    const f = transformBlock(mk(1, 2), 'flipV');
    expect(at(f, 0, 0).id).toBe('1');
    expect(at(f, 0, 1).id).toBe('0');
  });

  it('rotates a 2x1 block into 1x2 with the left tile on top', () => {
    const r = transformBlock(mk(2, 1), 'rotateCW');
    expect([r.width, r.height]).toEqual([1, 2]);
    expect(at(r, 0, 0).id).toBe('0');
    expect(at(r, 0, 1).id).toBe('1');
    expect(at(r, 0, 0).rotation).toBe(90);
  });

  it('rotates a 3x2 block clockwise to 2x3', () => {
    const r = transformBlock(mk(3, 2), 'rotateCW');
    expect([r.width, r.height]).toEqual([2, 3]);
    // 0 1 2 / 3 4 5 -> 3 0 / 4 1 / 5 2
    expect(at(r, 0, 0).id).toBe('3');
    expect(at(r, 1, 0).id).toBe('0');
    expect(at(r, 0, 2).id).toBe('5');
    expect(at(r, 1, 2).id).toBe('2');
  });

  it.each([
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 2],
  ])('four rotations return a %ix%i block to the original', (w, h) => {
    let b = mk(w, h);
    for (let i = 0; i < 4; i++) b = transformBlock(b, 'rotateCW');
    expect(b).toEqual(mk(w, h));
    for (let i = 0; i < 4; i++) b = transformBlock(b, 'rotateCCW');
    expect(b).toEqual(mk(w, h));
  });

  it('CCW undoes CW and double flips are identity on layout', () => {
    const b = mk(3, 2);
    expect(transformBlock(transformBlock(b, 'rotateCW'), 'rotateCCW')).toEqual(b);
    const ff = transformBlock(transformBlock(b, 'flipH'), 'flipH');
    expect(ff.cells.map((c) => [c.dx, c.dy, c.tile.id])).toEqual(b.cells.map((c) => [c.dx, c.dy, c.tile.id]));
  });
});

describe('blockFromSheetRect', () => {
  it('uses the sheet column count, not the block width', () => {
    const project = { tileSize: 16, sheets: [{ id: 's', width: 80, height: 48 }] } as unknown as Project;
    const b = blockFromSheetRect(project, { sheetId: 's', col: 1, row: 1, w: 2, h: 2 });
    // 5 columns: ids are row*5+col -> 6,7 / 11,12
    expect(b.cells.map((c) => c.tile.id)).toEqual(['6', '7', '11', '12']);
    expect([b.width, b.height]).toEqual([2, 2]);
  });
});

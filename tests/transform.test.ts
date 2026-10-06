import { describe, expect, it } from 'vitest';
import { transformPixels } from '../src/model/transform';
import type { Rotation } from '../src/model/types';

// 2x2 tile, one distinct pixel per corner. Layout:  A B
//                                                   C D
const px = (v: number) => [v, 0, 0, 255];
const tile = new Uint8ClampedArray([...px(1), ...px(2), ...px(3), ...px(4)]);
const read = (d: Uint8ClampedArray) => [d[0], d[4], d[8], d[12]];

const cases: [boolean, boolean, Rotation, number[]][] = [
  [false, false, 0, [1, 2, 3, 4]],
  [true, false, 0, [2, 1, 4, 3]], // mirrored horizontally
  [false, true, 0, [3, 4, 1, 2]], // mirrored vertically
  [true, true, 0, [4, 3, 2, 1]],
  [false, false, 90, [3, 1, 4, 2]], // clockwise
  [false, false, 180, [4, 3, 2, 1]],
  [false, false, 270, [2, 4, 1, 3]],
  [true, false, 90, [4, 2, 3, 1]], // flip first, then rotate
];

describe('transformPixels', () => {
  it.each(cases)('flipX=%s flipY=%s rotation=%s', (fx, fy, rot, expected) => {
    expect(read(transformPixels(tile, 2, fx, fy, rot))).toEqual(expected);
  });

  it('covers all 8 distinct orientations of an asymmetric tile', () => {
    const seen = new Set<string>();
    for (const fx of [false, true]) {
      for (const rot of [0, 90, 180, 270] as Rotation[]) {
        seen.add(read(transformPixels(tile, 2, fx, false, rot)).join());
      }
    }
    expect(seen.size).toBe(8);
  });
});

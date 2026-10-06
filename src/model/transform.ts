import type { Rotation } from './types';

/**
 * Returns a copy of square RGBA pixel data after flipping (X, then Y) and then rotating
 * clockwise by `rotation` degrees. This is the effective transform order for placed tiles.
 */
export function transformPixels(
  src: Uint8ClampedArray,
  size: number,
  flipX: boolean,
  flipY: boolean,
  rotation: Rotation,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  const last = size - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Source position in the rotated image, before the flip is undone.
      let fx: number;
      let fy: number;
      switch (rotation) {
        case 90:
          fx = y;
          fy = last - x;
          break;
        case 180:
          fx = last - x;
          fy = last - y;
          break;
        case 270:
          fx = last - y;
          fy = x;
          break;
        default:
          fx = x;
          fy = y;
      }
      const sx = flipX ? last - fx : fx;
      const sy = flipY ? last - fy : fy;
      const s = (sy * size + sx) * 4;
      const d = (y * size + x) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      dst[d + 3] = src[s + 3];
    }
  }
  return dst;
}

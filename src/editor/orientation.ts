import type { Rotation } from '../model/types';

export interface Orientation {
  flipX: boolean;
  flipY: boolean;
  rotation: Rotation;
}

export type OrientOp = 'flipH' | 'flipV' | 'rotateCW' | 'rotateCCW';

const norm = (deg: number): Rotation => ((((deg % 360) + 360) % 360) as Rotation);

/**
 * Applies an on-screen operation to an orientation. Orientation means "flip, then rotate
 * clockwise", and ops act on what is drawn, so mirroring a rotated tile mirrors the picture
 * the user sees. Uses M * R(a) = R(-a) * M for a horizontal mirror M.
 */
export function applyOrientOp(o: Orientation, op: OrientOp): Orientation {
  switch (op) {
    case 'rotateCW':
      return { ...o, rotation: norm(o.rotation + 90) };
    case 'rotateCCW':
      return { ...o, rotation: norm(o.rotation - 90) };
    case 'flipH':
      return { flipX: !o.flipX, flipY: o.flipY, rotation: norm(-o.rotation) };
    case 'flipV':
      return { flipX: !o.flipX, flipY: o.flipY, rotation: norm(180 - o.rotation) };
  }
}

import type { Block, Rotation } from '../model/types';

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

/** Maps each cell position, keeping its layer, and applies `op` to each tile's own orientation. */
function mapBlock(
  block: Block,
  width: number,
  height: number,
  pos: (dx: number, dy: number) => [number, number],
  op: OrientOp,
): Block {
  return {
    width,
    height,
    cells: block.cells.map((c) => {
      const [dx, dy] = pos(c.dx, c.dy);
      return { ...c, dx, dy, tile: { ...c.tile, ...applyOrientOp(c.tile, op) } };
    }),
  };
}

/** Flips or rotates a whole block: its layout is transformed and every tile's orientation follows. */
export function transformBlock(block: Block, op: OrientOp): Block {
  const { width: w, height: h } = block;
  switch (op) {
    case 'flipH':
      return mapBlock(block, w, h, (dx, dy) => [w - 1 - dx, dy], op);
    case 'flipV':
      return mapBlock(block, w, h, (dx, dy) => [dx, h - 1 - dy], op);
    case 'rotateCW':
      return mapBlock(block, h, w, (dx, dy) => [h - 1 - dy, dx], op);
    case 'rotateCCW':
      return mapBlock(block, h, w, (dx, dy) => [dy, w - 1 - dx], op);
  }
}

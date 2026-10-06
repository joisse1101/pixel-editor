import type { Block, Project } from '../model/types';

/** Palette rectangle in tile columns and rows of one sheet. */
export interface SheetRect {
  sheetId: string;
  col: number;
  row: number;
  w: number;
  h: number;
}

/** Expands a palette rectangle into a block of tile ids, using the sheet's own column count. */
export function blockFromSheetRect(project: Project, r: SheetRect): Block {
  const sheet = project.sheets.find((s) => s.id === r.sheetId);
  if (!sheet) throw new Error(`Unknown sheet ${r.sheetId}`);
  const cols = Math.floor(sheet.width / project.tileSize);
  const cells: Block['cells'] = [];
  for (let dy = 0; dy < r.h; dy++) {
    for (let dx = 0; dx < r.w; dx++) {
      cells.push({
        dx,
        dy,
        tile: {
          id: String((r.row + dy) * cols + r.col + dx),
          sheetId: r.sheetId,
          flipX: false,
          flipY: false,
          rotation: 0,
          extra: {},
        },
      });
    }
  }
  return { width: r.w, height: r.h, cells };
}

/**
 * The block repeated over the rectangle between the press and current cells, anchored at the press
 * cell, as one block with its top-left at (x, y). Used to preview a rectangle fill.
 */
export function tiledBlock(block: Block, press: [number, number], current: [number, number]): { block: Block; x: number; y: number } {
  const x0 = Math.min(press[0], current[0]);
  const y0 = Math.min(press[1], current[1]);
  const width = Math.abs(press[0] - current[0]) + 1;
  const height = Math.abs(press[1] - current[1]) + 1;
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const byPos = new Map(block.cells.map((c) => [`${c.dx},${c.dy}`, c.tile]));
  const cells: Block['cells'] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = byPos.get(`${mod(x0 + dx - press[0], block.width)},${mod(y0 + dy - press[1], block.height)}`);
      if (tile) cells.push({ dx, dy, tile });
    }
  }
  return { block: { width, height, cells }, x: x0, y: y0 };
}

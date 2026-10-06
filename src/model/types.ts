import type { Pixels } from './pngCodec';

export type Rotation = 0 | 90 | 180 | 270;

/** Fields we don't model are kept here and written back unchanged. */
export type Extra = Record<string, unknown>;

export interface Attribute {
  id: string;
  key: string;
  value: unknown;
}

export interface PlacedTile {
  /** Tile index inside the sprite sheet (row-major), as a string like in Office.json. */
  id: string;
  sheetId: string;
  flipX: boolean;
  flipY: boolean;
  rotation: Rotation;
  extra: Extra;
}

export interface Layer {
  id: string;
  name: string;
  description: string;
  collider: boolean;
  /** Editor visibility. Saved to Office.json only when false; never used by the Phaser export. */
  visible: boolean;
  isAutoTile: boolean;
  rules: unknown[];
  defaultTileVariants: unknown[];
  /** Keyed by "x,y" in cell coordinates. One tile per cell. */
  cells: Map<string, PlacedTile>;
  extra: Extra;
}

export interface SpriteSheet {
  id: string;
  /** Display name (imported file name without extension); saved as `name`, optional. */
  name?: string;
  /** PNG data URL, written back untouched unless the sheet changes. */
  dataUrl: string;
  width: number;
  height: number;
  /** Tile id -> attributes. */
  attributes: Record<string, Attribute[]>;
  extra: Extra;
  /** Decoded image, set by the browser loader. */
  bitmap?: ImageBitmap;
  /** Exact RGBA pixels, set by the loader; used by the Phaser bake. */
  pixels?: Pixels;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  tileSize: number;
  sheets: SpriteSheet[];
  /** Same order as the file: first layer is drawn on top, last at the bottom. */
  layers: Layer[];
  settings: Extra;
  /** Cached Sprite Fusion bake; regenerated on save. */
  exports: unknown;
  extra: Extra;
}

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export function parseCellKey(key: string): [number, number] {
  const [x, y] = key.split(',');
  return [Number(x), Number(y)];
}

/** A rectangle of tiles: the brush, a copied selection and the pending paste all use this shape. */
export interface BlockCell {
  dx: number;
  dy: number;
  /** Source layer; absent for a palette brush, which always goes to the blue layer. */
  layerId?: string;
  tile: PlacedTile;
}

export interface Block {
  width: number;
  height: number;
  cells: BlockCell[];
}

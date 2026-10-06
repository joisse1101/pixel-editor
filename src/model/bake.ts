import { getMapBounds } from './office';
import { bytesToDataUrl, encodePng, type Pixels } from './pngCodec';
import { transformPixels } from './transform';
import { cellKey, type Attribute, type PlacedTile, type Project } from './types';

export const SHEET_COLUMNS = 8;

export interface TiledProperty {
  name: string;
  type: 'string' | 'bool' | 'int' | 'float';
  value: string | boolean | number;
}

export interface TiledMap {
  compressionlevel: number;
  height: number;
  infinite: boolean;
  layers: {
    id: number;
    name: string;
    opacity: number;
    type: 'tilelayer';
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    data: number[];
    properties: TiledProperty[];
  }[];
  nextlayerid: number;
  nextobjectid: number;
  orientation: 'orthogonal';
  renderorder: string;
  tiledversion: string;
  tileheight: number;
  tilesets: {
    firstgid: number;
    name: string;
    tilewidth: number;
    tileheight: number;
    margin: number;
    spacing: number;
    columns: number;
    tilecount: number;
    image: string;
    imagewidth: number;
    imageheight: number;
    tiles: { id: number; properties: TiledProperty[] }[];
  }[];
  tilewidth: number;
  type: 'map';
  version: string;
  width: number;
}

export interface Bake {
  /** One entry per unique tile, in GID order (gid = index + 1), as transformed RGBA pixels. */
  tiles: Uint8ClampedArray[];
  /** Content hash of each unique tile, same order. */
  hashes: string[];
  /** The packed spritesheet, 8 tiles wide. */
  sheet: Pixels;
  map: TiledMap;
}

export const SHEET_IMAGE_NAME = 'spritesheet.png';

function fnv1a(data: Uint8ClampedArray): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data[i], 0x01000193);
  return h >>> 0;
}

const sameBytes = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

function tileProperties(attrs: Attribute[] | undefined): TiledProperty[] {
  return (attrs ?? []).map((a) => {
    const v = a.value;
    if (typeof v === 'boolean') return { name: a.key, type: 'bool', value: v };
    if (typeof v === 'number') return { name: a.key, type: Number.isInteger(v) ? 'int' : 'float', value: v };
    return { name: a.key, type: 'string', value: String(v) };
  });
}

/** Copies the tile's source pixels and applies its flip and rotation. */
export function renderTile(project: Project, tile: PlacedTile): Uint8ClampedArray {
  const sheet = project.sheets.find((s) => s.id === tile.sheetId);
  if (!sheet?.pixels) throw new Error(`Sprite sheet ${tile.sheetId} has no decoded pixels`);
  const ts = project.tileSize;
  const cols = Math.floor(sheet.width / ts);
  const index = Number(tile.id);
  const sx = (index % cols) * ts;
  const sy = Math.floor(index / cols) * ts;
  const src = new Uint8ClampedArray(ts * ts * 4);
  for (let y = 0; y < ts; y++) {
    const from = ((sy + y) * sheet.width + sx) * 4;
    src.set(sheet.pixels.data.subarray(from, from + ts * 4), y * ts * 4);
  }
  return transformPixels(src, ts, tile.flipX, tile.flipY, tile.rotation);
}

/**
 * Bakes the project into a Tiled map and its spritesheet. Layers are walked bottom to top and cells
 * row by row; tiles are deduplicated by pixel content (and attributes) with first-seen GIDs.
 */
export function bakeProject(project: Project): Bake {
  const ts = project.tileSize;
  const b = getMapBounds(project);
  const tiles: Uint8ClampedArray[] = [];
  const hashes: string[] = [];
  const attrs: TiledProperty[][] = [];
  const buckets = new Map<string, number[]>();

  const gidFor = (tile: PlacedTile): number => {
    const pixels = renderTile(project, tile);
    // Colour under fully transparent pixels is invisible; zero it so equal-looking tiles share a slot.
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 0) pixels.fill(0, i - 3, i);
    const sheet = project.sheets.find((s) => s.id === tile.sheetId)!;
    const props = tileProperties(sheet.attributes[tile.id]);
    const sig = JSON.stringify(props);
    const hash = fnv1a(pixels).toString(16);
    const bucketKey = `${hash}|${sig}`;
    const bucket = buckets.get(bucketKey) ?? [];
    for (const i of bucket) if (sameBytes(tiles[i], pixels)) return i + 1;
    tiles.push(pixels);
    hashes.push(hash);
    attrs.push(props);
    bucket.push(tiles.length - 1);
    buckets.set(bucketKey, bucket);
    return tiles.length;
  };

  const layers: TiledMap['layers'] = [];
  for (let i = project.layers.length - 1; i >= 0; i--) {
    const layer = project.layers[i];
    const data = new Array<number>(b.width * b.height).fill(0);
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const tile = layer.cells.get(cellKey(x + b.x, y + b.y));
        if (tile) data[y * b.width + x] = gidFor(tile);
      }
    }
    layers.push({
      id: layers.length + 1,
      name: layer.name,
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      x: 0,
      y: 0,
      width: b.width,
      height: b.height,
      data,
      properties: [{ name: 'collider', type: 'bool', value: layer.collider }],
    });
  }

  const rows = Math.max(1, Math.ceil(tiles.length / SHEET_COLUMNS));
  const sheet: Pixels = { width: SHEET_COLUMNS * ts, height: rows * ts, data: new Uint8ClampedArray(SHEET_COLUMNS * ts * rows * ts * 4) };
  tiles.forEach((pixels, i) => {
    const ox = (i % SHEET_COLUMNS) * ts;
    const oy = Math.floor(i / SHEET_COLUMNS) * ts;
    for (let y = 0; y < ts; y++) {
      sheet.data.set(pixels.subarray(y * ts * 4, (y + 1) * ts * 4), ((oy + y) * sheet.width + ox) * 4);
    }
  });

  const map: TiledMap = {
    compressionlevel: -1,
    height: b.height,
    infinite: false,
    layers,
    nextlayerid: layers.length + 1,
    nextobjectid: 1,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.11.0',
    tileheight: ts,
    tilesets: [
      {
        firstgid: 1,
        name: 'spritefusion',
        tilewidth: ts,
        tileheight: ts,
        margin: 0,
        spacing: 0,
        columns: SHEET_COLUMNS,
        tilecount: SHEET_COLUMNS * rows,
        image: SHEET_IMAGE_NAME,
        imagewidth: sheet.width,
        imageheight: sheet.height,
        tiles: attrs.flatMap((properties, i) => (properties.length ? [{ id: i, properties }] : [])),
      },
    ],
    tilewidth: ts,
    type: 'map',
    version: '1.10',
    width: b.width,
  };
  return { tiles, hashes, sheet, map };
}

/** The Sprite Fusion style `exports` cache for Office.json, regenerated from a bake. */
export async function bakeExports(bake: Bake): Promise<{ spritesheet: string; tiles: { id: string; hash: string }[] }> {
  return {
    spritesheet: bytesToDataUrl(await encodePng(bake.sheet)),
    tiles: bake.hashes.map((hash, i) => ({ id: String(i), hash })),
  };
}

/** The two files Phaser loads. */
export async function bakeFiles(bake: Bake): Promise<{ mapJson: string; spritesheetPng: Uint8Array }> {
  return { mapJson: JSON.stringify(bake.map), spritesheetPng: await encodePng(bake.sheet) };
}

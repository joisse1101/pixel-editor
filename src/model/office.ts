import { pngSizeFromDataUrl } from './png';
import {
  cellKey,
  parseCellKey,
  type Attribute,
  type Extra,
  type Layer,
  type PlacedTile,
  type Project,
  type Rotation,
  type SpriteSheet,
} from './types';

export class ProjectParseError extends Error {}

function omit(obj: Record<string, unknown>, keys: string[]): Extra {
  const out: Extra = {};
  for (const k of Object.keys(obj)) if (!keys.includes(k)) out[k] = obj[k];
  return out;
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const ROTATIONS = [0, 90, 180, 270];

/** Parses Office.json text or an already parsed object. Throws ProjectParseError. */
export function parseOfficeJson(input: string | unknown): Project {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new ProjectParseError('File is not valid JSON');
    }
  }
  if (!isObject(raw)) throw new ProjectParseError('File is not an Office.json project');
  for (const key of ['layers', 'spriteSheets', 'tileSize']) {
    if (raw[key] === undefined) throw new ProjectParseError(`Missing "${key}"`);
  }
  if (!Array.isArray(raw.layers)) throw new ProjectParseError('"layers" must be an array');
  if (!isObject(raw.spriteSheets)) throw new ProjectParseError('"spriteSheets" must be an object');
  const tileSize = raw.tileSize;
  if (typeof tileSize !== 'number' || !Number.isInteger(tileSize) || tileSize <= 0) {
    throw new ProjectParseError('"tileSize" must be a positive integer');
  }

  const sheets: SpriteSheet[] = Object.entries(raw.spriteSheets).map(([id, s]) => {
    if (!isObject(s) || typeof s.base64 !== 'string') {
      throw new ProjectParseError(`Sprite sheet ${id} has no image`);
    }
    let size;
    try {
      size = pngSizeFromDataUrl(s.base64);
    } catch (e) {
      throw new ProjectParseError(`Sprite sheet ${id}: ${(e as Error).message}`);
    }
    const sheet: SpriteSheet = {
      id,
      dataUrl: s.base64,
      width: size.width,
      height: size.height,
      attributes: (s.attributes ?? {}) as Record<string, Attribute[]>,
      extra: omit(s, ['base64', 'attributes', 'name']),
    };
    if (typeof s.name === 'string' && s.name !== '') sheet.name = s.name;
    return sheet;
  });
  const sheetIds = new Set(sheets.map((s) => s.id));

  const layers: Layer[] = raw.layers.map((l: any, i: number) => {
    if (!isObject(l) || !Array.isArray(l.tiles)) {
      throw new ProjectParseError(`Layer ${i} has no tiles array`);
    }
    const cells = new Map<string, PlacedTile>();
    for (const t of l.tiles) {
      const cx = t.x / tileSize;
      const cy = t.y / tileSize;
      if (!Number.isInteger(cx) || !Number.isInteger(cy)) {
        throw new ProjectParseError(`Layer "${l.name}" has a tile off the grid at ${t.x},${t.y}`);
      }
      if (!sheetIds.has(t.spriteSheetId)) {
        throw new ProjectParseError(`Layer "${l.name}" uses unknown sprite sheet ${t.spriteSheetId}`);
      }
      const key = cellKey(cx, cy);
      if (cells.has(key)) {
        throw new ProjectParseError(`Layer "${l.name}" has two tiles in cell ${key}`);
      }
      const rotation = t.rotation ?? 0;
      if (!ROTATIONS.includes(rotation)) {
        throw new ProjectParseError(`Layer "${l.name}" has invalid rotation ${rotation}`);
      }
      cells.set(key, {
        id: String(t.id),
        sheetId: t.spriteSheetId,
        flipX: t.scaleX === -1,
        flipY: t.scaleY === -1,
        rotation: rotation as Rotation,
        extra: omit(t, ['id', 'x', 'y', 'spriteSheetId', 'scaleX', 'scaleY', 'rotation']),
      });
    }
    return {
      id: l.id,
      name: l.name,
      description: l.description ?? '',
      collider: !!l.collider,
      visible: l.visible !== false,
      isAutoTile: !!l.isAutoTile,
      rules: l.rules ?? [],
      defaultTileVariants: l.defaultTileVariants ?? [],
      cells,
      extra: omit(l, ['id', 'name', 'description', 'tiles', 'collider', 'visible', 'isAutoTile', 'rules', 'defaultTileVariants']),
    };
  });

  const settings: Extra = isObject(raw.settings) ? { ...raw.settings } : {};
  // Legacy map size/origin are derived from the tiles now; drop them so they are not written back.
  delete settings.mapSize;
  delete settings.mapOrigin;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    tileSize,
    sheets,
    layers,
    settings,
    exports: raw.exports,
    extra: omit(raw, ['id', 'name', 'description', 'tileSize', 'spriteSheets', 'layers', 'settings', 'exports']),
  };
}

/** Builds the Office.json object. Rotation is written only when set. */
export function serializeOfficeJson(p: Project): Record<string, unknown> {
  const spriteSheets: Record<string, unknown> = {};
  for (const s of p.sheets) {
    spriteSheets[s.id] = { base64: s.dataUrl, attributes: s.attributes, ...(s.name ? { name: s.name } : {}), ...s.extra };
  }
  const layers = p.layers.map((l) => {
    const tiles = [...l.cells].map(([key, t]) => {
      const [cx, cy] = parseCellKey(key);
      const out: Record<string, unknown> = {
        id: t.id,
        x: cx * p.tileSize,
        y: cy * p.tileSize,
        spriteSheetId: t.sheetId,
        scaleX: t.flipX ? -1 : 1,
        scaleY: t.flipY ? -1 : 1,
        ...t.extra,
      };
      if (t.rotation !== 0) out.rotation = t.rotation;
      return out;
    });
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      tiles,
      collider: l.collider,
      isAutoTile: l.isAutoTile,
      rules: l.rules,
      defaultTileVariants: l.defaultTileVariants,
      ...(l.visible ? {} : { visible: false }),
      ...l.extra,
    };
  });
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tileSize: p.tileSize,
    spriteSheets,
    layers,
    settings: p.settings,
    exports: p.exports,
    ...p.extra,
  };
}

/** Selector label: `<name> (<cols>x<rows>)`, with `Sheet <n>` when the sheet has no name. */
export function sheetLabel(p: Project, index: number): string {
  const s = p.sheets[index];
  const cols = Math.floor(s.width / p.tileSize);
  const rows = Math.floor(s.height / p.tileSize);
  return `${s.name || `Sheet ${index + 1}`} (${cols}x${rows})`;
}

/** File name without its last extension, used to name an imported sheet. */
export function sheetNameFromFile(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export interface MapBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Smallest rectangle in absolute cells containing every filled cell on any layer (hidden layers
 * included), or null when nothing is filled. This is the exported extent.
 */
export function getMapBounds(p: Project): MapBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const l of p.layers) {
    for (const key of l.cells.keys()) {
      const [x, y] = parseCellKey(key);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function countTiles(p: Project): number {
  return p.layers.reduce((n, l) => n + l.cells.size, 0);
}

/** Loads text into a new project; on failure the current project is returned unchanged. */
export function tryLoadProject(
  text: string,
  current: Project | null,
): { project: Project | null; error?: string } {
  try {
    return { project: parseOfficeJson(text) };
  } catch (e) {
    if (e instanceof ProjectParseError) return { project: current, error: e.message };
    throw e;
  }
}

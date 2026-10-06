import { pngSizeFromDataUrl } from './png';
import {
  cellKey,
  parseCellKey,
  type Attribute,
  type Extra,
  type Layer,
  type MapOrigin,
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
    return {
      id,
      dataUrl: s.base64,
      width: size.width,
      height: size.height,
      attributes: (s.attributes ?? {}) as Record<string, Attribute[]>,
      extra: omit(s, ['base64', 'attributes']),
    };
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
      isAutoTile: !!l.isAutoTile,
      rules: l.rules ?? [],
      defaultTileVariants: l.defaultTileVariants ?? [],
      cells,
      extra: omit(l, ['id', 'name', 'description', 'tiles', 'collider', 'isAutoTile', 'rules', 'defaultTileVariants']),
    };
  });

  const settings: Extra = isObject(raw.settings) ? { ...raw.settings } : {};
  let mapSize: Project['mapSize'];
  if (settings.mapSize !== undefined) {
    const ms = settings.mapSize as any;
    if (!isObject(ms) || !Number.isInteger(ms.width) || !Number.isInteger(ms.height) || ms.width < 1 || ms.height < 1) {
      throw new ProjectParseError('"settings.mapSize" must have positive integer width and height');
    }
    mapSize = { width: ms.width, height: ms.height };
    delete settings.mapSize;
  }

  let mapOrigin: MapOrigin | undefined;
  if (settings.mapOrigin !== undefined) {
    const mo = settings.mapOrigin as any;
    if (!isObject(mo) || !Number.isInteger(mo.x) || !Number.isInteger(mo.y)) {
      throw new ProjectParseError('"settings.mapOrigin" must have integer x and y');
    }
    mapOrigin = { x: mo.x, y: mo.y };
    delete settings.mapOrigin;
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    tileSize,
    sheets,
    layers,
    settings,
    mapSize,
    mapOrigin,
    exports: raw.exports,
    extra: omit(raw, ['id', 'name', 'description', 'tileSize', 'spriteSheets', 'layers', 'settings', 'exports']),
  };
}

/** Builds the Office.json object. Rotation and mapSize are written only when set. */
export function serializeOfficeJson(p: Project): Record<string, unknown> {
  const spriteSheets: Record<string, unknown> = {};
  for (const s of p.sheets) {
    spriteSheets[s.id] = { base64: s.dataUrl, attributes: s.attributes, ...s.extra };
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
      ...l.extra,
    };
  });
  const settings: Extra = { ...p.settings };
  if (p.mapSize) settings.mapSize = { width: p.mapSize.width, height: p.mapSize.height };
  if (p.mapOrigin) settings.mapOrigin = { x: p.mapOrigin.x, y: p.mapOrigin.y };
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tileSize: p.tileSize,
    spriteSheets,
    layers,
    settings,
    exports: p.exports,
    ...p.extra,
  };
}

/**
 * Map rectangle in absolute cells. Sprite Fusion positions are not zero-based, so without
 * explicit settings the origin is the minimum tile cell and the size spans to the maximum.
 */
export function getMapBounds(p: Project): { x: number; y: number; width: number; height: number } {
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
  const empty = minX === Infinity;
  const x = p.mapOrigin?.x ?? (empty ? 0 : minX);
  const y = p.mapOrigin?.y ?? (empty ? 0 : minY);
  return {
    x,
    y,
    width: p.mapSize?.width ?? (empty ? 0 : maxX - x + 1),
    height: p.mapSize?.height ?? (empty ? 0 : maxY - y + 1),
  };
}

export function getMapSize(p: Project): { width: number; height: number } {
  const { width, height } = getMapBounds(p);
  return { width, height };
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

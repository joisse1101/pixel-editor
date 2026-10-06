import { describe, expect, it } from 'vitest';
import { bakeExports, bakeFiles, bakeProject, renderTile, type TiledMap } from '../src/model/bake';
import { getMapBounds, serializeOfficeJson } from '../src/model/office';
import { dataUrlToBytes, decodePng, type Pixels } from '../src/model/pngCodec';
import { cellKey, type Project } from '../src/model/types';
import { loadMapJson, loadSampleProject, loadSpritesheetPng } from './fixtures';

const TS = 16;

/** Source-over composite of one RGBA tile into a buffer. */
function blit(out: Uint8ClampedArray, outWidth: number, ox: number, oy: number, src: Uint8ClampedArray, srcWidth: number, sx: number, sy: number): void {
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      const s = ((sy + y) * srcWidth + sx + x) * 4;
      const d = ((oy + y) * outWidth + ox + x) * 4;
      const a = src[s + 3] / 255;
      for (let c = 0; c < 3; c++) out[d + c] = src[s + c] * a + out[d + c] * (1 - a);
      out[d + 3] = src[s + 3] + out[d + 3] * (1 - a);
    }
  }
}

/** Draws a Tiled map layer by layer from a tile sheet. */
function renderMap(map: TiledMap, sheet: Pixels): Uint8ClampedArray {
  const out = new Uint8ClampedArray(map.width * map.height * TS * TS * 4);
  const cols = map.tilesets[0].columns;
  for (const layer of map.layers) {
    layer.data.forEach((gid, i) => {
      if (!gid) return;
      const index = gid - 1;
      blit(out, map.width * TS, (i % map.width) * TS, Math.floor(i / map.width) * TS, sheet.data, sheet.width, (index % cols) * TS, Math.floor(index / cols) * TS);
    });
  }
  return out;
}

/** Draws the project straight from the source sheets, like the editor canvas does. */
function renderEditor(project: Project): Uint8ClampedArray {
  const b = getMapBounds(project);
  const out = new Uint8ClampedArray(b.width * b.height * TS * TS * 4);
  for (let i = project.layers.length - 1; i >= 0; i--) {
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const tile = project.layers[i].cells.get(cellKey(x + b.x, y + b.y));
        if (tile) blit(out, b.width * TS, x * TS, y * TS, renderTile(project, tile), TS, 0, 0);
      }
    }
  }
  return out;
}

/** Number of pixels where any channel differs by more than `tolerance`. */
function diffCount(a: Uint8ClampedArray, b: Uint8ClampedArray, tolerance = 0): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if ([0, 1, 2, 3].some((c) => Math.abs(a[i + c] - b[i + c]) > tolerance)) n++;
  }
  return n;
}

/** A project with one empty layer holding the given tiles on a fresh map rectangle. */
async function tinyProject(width: number, place: (project: Project) => void): Promise<Project> {
  const project = await loadSampleProject();
  for (const l of project.layers) l.cells.clear();
  place(project);
  project.mapOrigin = { x: 0, y: 0 };
  project.mapSize = { width, height: 1 };
  return project;
}

describe('bake', () => {
  it('dedupes by pixels with first-seen gids: sample bakes to <= 104 unique tiles', async () => {
    const bake = bakeProject(await loadSampleProject());
    expect(bake.tiles.length).toBeLessThanOrEqual(104);
    const all = bake.map.layers.flatMap((l) => l.data);
    expect(Math.max(...all)).toBe(bake.tiles.length);
    // Walking layers bottom to top, row-major, each new gid is exactly one above the highest so far.
    let next = 1;
    for (const gid of all) {
      if (gid === 0) continue;
      if (gid === next) next++;
      else expect(gid).toBeLessThan(next);
    }
  });

  it('shares one slot for identical tiles and splits flipped variants that differ', async () => {
    const source = await loadSampleProject();
    // Pick a placed tile whose horizontal flip looks different (symmetric tiles would share a slot).
    const tile = [...source.layers[0].cells.values()].find((t) => {
      const a = renderTile(source, t);
      return renderTile(source, { ...t, flipX: true }).some((v, i) => v !== a[i]);
    })!;
    const base = renderTile(source, tile);
    const flippedDiffers = renderTile(source, { ...tile, flipX: !tile.flipX }).some((v, i) => v !== base[i]);
    expect(flippedDiffers).toBe(true);

    const project = await tinyProject(51, (p) => {
      for (let x = 0; x < 50; x++) p.layers[0].cells.set(cellKey(x, 0), { ...tile });
      p.layers[0].cells.set(cellKey(50, 0), { ...tile, flipX: !tile.flipX });
    });
    const bake = bakeProject(project);
    const data = bake.map.layers.at(-1)!.data;
    expect(new Set(data.slice(0, 50)).size).toBe(1);
    expect(bake.tiles).toHaveLength(2);
    expect(data[50]).not.toBe(data[0]);
  });

  it('packs 8 columns wide with growing height', async () => {
    const bake = bakeProject(await loadSampleProject());
    expect(bake.sheet.width).toBe(128);
    expect(bake.sheet.height).toBe(Math.ceil(bake.tiles.length / 8) * TS);
    expect(bake.map.tilesets[0]).toMatchObject({ columns: 8, imagewidth: 128, imageheight: bake.sheet.height });
  });

  it('builds a dense Tiled map bottom to top with 0 for empty cells', async () => {
    const project = await loadSampleProject();
    const m = bakeProject(project).map;
    expect(m).toMatchObject({ width: 40, height: 26, tilewidth: 16, tileheight: 16, orientation: 'orthogonal', infinite: false });
    expect(m.layers).toHaveLength(10);
    expect(m.layers.every((l) => l.data.length === 1040 && l.width === 40 && l.height === 26)).toBe(true);
    const bottomUp = [...project.layers].reverse();
    expect(m.layers.map((l) => l.name)).toEqual(bottomUp.map((l) => l.name));
    expect(m.layers.map((l) => l.data.filter((g) => g !== 0).length)).toEqual(bottomUp.map((l) => l.cells.size));
  });

  it('exports the resized map size', async () => {
    const project = await loadSampleProject();
    project.mapSize = { width: 50, height: 30 };
    const m = bakeProject(project).map;
    expect(m.width).toBe(50);
    expect(m.height).toBe(30);
    expect(m.layers.every((l) => l.data.length === 1500)).toBe(true);
  });

  it('writes collider layer properties and tile attributes matching the sample map.json', async () => {
    const bake = bakeProject(await loadSampleProject());
    const ref = loadMapJson();
    expect(bake.map.layers.map((l) => l.properties)).toEqual(ref.layers.map((l: any) => l.properties));
    const props = (m: any) => m.tilesets[0].tiles.map((t: any) => JSON.stringify(t.properties)).sort();
    expect(props(bake.map)).toEqual(props(ref));
  });

  it('copies attributes to every exported variant of a tile', async () => {
    const source = await loadSampleProject();
    const tile = [...source.layers[0].cells.values()].find((t) => {
      const a = renderTile(source, t);
      return renderTile(source, { ...t, flipX: true, rotation: 90 }).some((v, i) => v !== a[i]);
    })!;
    const project = await tinyProject(2, (p) => {
      p.sheets.find((s) => s.id === tile.sheetId)!.attributes[tile.id] = [{ id: 'a', key: 'interaction', value: 'water' }];
      p.layers[0].cells.set(cellKey(0, 0), { ...tile, flipX: false, rotation: 0 });
      p.layers[0].cells.set(cellKey(1, 0), { ...tile, flipX: true, rotation: 90 });
    });
    const bake = bakeProject(project);
    const data = bake.map.layers.at(-1)!.data;
    const tiles = bake.map.tilesets[0].tiles;
    expect(new Set(data).size).toBe(2);
    for (const gid of data) {
      expect(tiles.find((t) => t.id === gid - 1)?.properties).toEqual([{ name: 'interaction', type: 'string', value: 'water' }]);
    }
  });

  it('renders pixel-identical to the editor and to the sample bake', async () => {
    const project = await loadSampleProject();
    const files = await bakeFiles(bakeProject(project));
    const baked = renderMap(JSON.parse(files.mapJson), await decodePng(files.spritesheetPng));
    expect(diffCount(baked, renderEditor(project))).toBe(0);
    const reference = renderMap(loadMapJson(), await decodePng(new Uint8Array(loadSpritesheetPng())));
    // Sprite Fusion's bake rounds semi-transparent colours by +-1 (premultiplied alpha); ours is exact.
    expect(diffCount(baked, reference, 1)).toBe(0);
  });

  it('save regenerates exports to match the bake', async () => {
    const project = await loadSampleProject();
    const bake = bakeProject(project);
    project.exports = await bakeExports(bake);
    const saved = serializeOfficeJson(project) as any;
    expect(saved.exports.tiles).toEqual(bake.hashes.map((hash, i) => ({ id: String(i), hash })));
    const sheet = await decodePng(dataUrlToBytes(saved.exports.spritesheet));
    expect([sheet.width, sheet.height]).toEqual([bake.sheet.width, bake.sheet.height]);
    expect(diffCount(sheet.data, bake.sheet.data)).toBe(0);
  });
});

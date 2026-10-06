import { describe, expect, it } from 'vitest';
import { countTiles, getMapBounds, parseOfficeJson, serializeOfficeJson, tryLoadProject } from '../src/model/office';
import { loadOfficeJson } from './fixtures';

describe('Office.json model', () => {
  it('loads the sample: 10 layers, 1850 tiles, 16 sheets', () => {
    const p = parseOfficeJson(loadOfficeJson());
    expect(p.layers).toHaveLength(10);
    expect(countTiles(p)).toBe(1850);
    expect(p.sheets).toHaveLength(16);
    expect(p.tileSize).toBe(16);
    expect(p.layers.every((l) => [...l.cells.values()].every((t) => t.rotation === 0))).toBe(true);
  });

  it('rejects invalid input and keeps the current project', () => {
    const current = parseOfficeJson(loadOfficeJson());
    for (const bad of ['not json', '{}', JSON.stringify({ layers: [], spriteSheets: {} })]) {
      const r = tryLoadProject(bad, current);
      expect(r.error).toBeTruthy();
      expect(r.project).toBe(current);
    }
    const noSheets = JSON.stringify({ layers: [], tileSize: 16 });
    expect(tryLoadProject(noSheets, current).error).toMatch(/spriteSheets/);
  });

  it('round-trips the sample without changing any original field', () => {
    const original = loadOfficeJson() as any;
    const saved = serializeOfficeJson(parseOfficeJson(original));
    expect(saved).toEqual(original);
    expect(JSON.stringify(saved)).toBe(JSON.stringify(original));
  });

  it('import -> save -> import yields an equal project', () => {
    const a = parseOfficeJson(loadOfficeJson());
    const b = parseOfficeJson(JSON.parse(JSON.stringify(serializeOfficeJson(a))));
    expect(b).toEqual(a);
  });

  it('writes rotation only when set, and reads it back', () => {
    const p = parseOfficeJson(loadOfficeJson());
    const tile = [...p.layers[0].cells.values()][0];
    tile.rotation = 90;
    const out: any = JSON.parse(JSON.stringify(serializeOfficeJson(p)));
    expect(out.layers[0].tiles[0].rotation).toBe(90);
    expect(out.layers[0].tiles[1].rotation).toBeUndefined();
    const again = parseOfficeJson(out);
    expect([...again.layers[0].cells.values()][0].rotation).toBe(90);
  });

  it('derives origin (21,4) and size 40x26 from the tile bounding box', () => {
    const p = parseOfficeJson(loadOfficeJson());
    expect(getMapBounds(p)).toEqual({ x: 21, y: 4, width: 40, height: 26 });
  });

  it('bounds two distant tiles on different layers as 16x6', () => {
    const p = parseOfficeJson(loadOfficeJson());
    for (const l of p.layers) l.cells.clear();
    const tile = { id: '0', sheetId: p.sheets[0].id, flipX: false, flipY: false, rotation: 0 as const, extra: {} };
    p.layers[0].cells.set('-5,3', tile);
    p.layers[1].cells.set('10,-2', tile);
    expect(getMapBounds(p)).toEqual({ x: -5, y: -2, width: 16, height: 6 });
  });

  it('includes hidden layers in the bounds', () => {
    const p = parseOfficeJson(loadOfficeJson());
    const before = getMapBounds(p)!;
    const tile = [...p.layers[0].cells.values()][0];
    p.layers[1].visible = false;
    p.layers[1].cells.set('100,100', tile);
    const b = getMapBounds(p)!;
    expect(b.x + b.width - 1).toBe(100);
    expect(b.x).toBe(before.x);
  });

  it('returns null for an empty project', () => {
    const p = parseOfficeJson(loadOfficeJson());
    for (const l of p.layers) l.cells.clear();
    expect(getMapBounds(p)).toBeNull();
  });

  it('ignores legacy mapSize and mapOrigin on load and does not write them back', () => {
    const raw: any = loadOfficeJson();
    raw.settings = { ...raw.settings, mapSize: { width: 50, height: 30 }, mapOrigin: { x: 0, y: 0 } };
    const p = parseOfficeJson(raw);
    expect(countTiles(p)).toBe(countTiles(parseOfficeJson(loadOfficeJson())));
    const out: any = serializeOfficeJson(p);
    expect(out.settings.mapSize).toBeUndefined();
    expect(out.settings.mapOrigin).toBeUndefined();
    expect(getMapBounds(p)).toEqual({ x: 21, y: 4, width: 40, height: 26 });
  });
});

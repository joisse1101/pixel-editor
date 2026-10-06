import { describe, expect, it } from 'vitest';
import { countTiles, getMapBounds, getMapSize, parseOfficeJson, serializeOfficeJson, tryLoadProject } from '../src/model/office';
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

  it('writes rotation and mapSize only when set, and reads them back', () => {
    const p = parseOfficeJson(loadOfficeJson());
    const tile = [...p.layers[0].cells.values()][0];
    tile.rotation = 90;
    p.mapSize = { width: 50, height: 30 };
    const out: any = JSON.parse(JSON.stringify(serializeOfficeJson(p)));
    expect(out.layers[0].tiles[0].rotation).toBe(90);
    expect(out.layers[0].tiles[1].rotation).toBeUndefined();
    expect(out.settings.mapSize).toEqual({ width: 50, height: 30 });
    const again = parseOfficeJson(out);
    expect([...again.layers[0].cells.values()][0].rotation).toBe(90);
    expect(getMapSize(again)).toEqual({ width: 50, height: 30 });
  });

  it('derives origin (21,4) and size 40x26 from tile bounds when settings are absent', () => {
    const p = parseOfficeJson(loadOfficeJson());
    expect(getMapBounds(p)).toEqual({ x: 21, y: 4, width: 40, height: 26 });
    expect(getMapSize(p)).toEqual({ width: 40, height: 26 });
  });

  it('does not add mapSize or mapOrigin on an unedited save', () => {
    const out: any = serializeOfficeJson(parseOfficeJson(loadOfficeJson()));
    expect(out.settings.mapSize).toBeUndefined();
    expect(out.settings.mapOrigin).toBeUndefined();
  });

  it('round-trips an explicit mapOrigin and supports negative cells', () => {
    const p = parseOfficeJson(loadOfficeJson());
    p.mapOrigin = { x: -3, y: 2 };
    p.layers[0].cells.set('-3,2', [...p.layers[0].cells.values()][0]);
    const out: any = JSON.parse(JSON.stringify(serializeOfficeJson(p)));
    expect(out.settings.mapOrigin).toEqual({ x: -3, y: 2 });
    const again = parseOfficeJson(out);
    expect(again.layers[0].cells.has('-3,2')).toBe(true);
    expect(getMapBounds(again)).toMatchObject({ x: -3, y: 2 });
  });
});

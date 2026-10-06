import { describe, expect, it } from 'vitest';
import { Editor, type Brush } from '../src/editor/editor';
import { createBlankProject, isMapEmpty, parseOfficeJson, serializeOfficeJson, tileSizeImpact } from '../src/model/office';
import type { Project } from '../src/model/types';
import { loadOfficeJson } from './fixtures';

const sample = () => parseOfficeJson(loadOfficeJson());
const brush = (project: Project): Brush => ({ sheetId: project.sheets[0].id, id: '1', flipX: false, flipY: false, rotation: 0 });

describe('createBlankProject / isMapEmpty', () => {
  it('has one empty layer, no sheets and the given size and name', () => {
    const p = createBlankProject(32, 'Dungeon');
    expect(p).toMatchObject({ tileSize: 32, name: 'Dungeon', sheets: [] });
    expect(p.layers).toHaveLength(1);
    expect(isMapEmpty(p)).toBe(true);
  });

  it('is not empty once any layer has a cell, and round-trips through save', () => {
    const e = new Editor(sample());
    expect(isMapEmpty(e.project)).toBe(false);
    const blank = createBlankProject(16, 'X');
    const again = parseOfficeJson(JSON.parse(JSON.stringify(serializeOfficeJson(blank))));
    expect(again.tileSize).toBe(16);
    expect(isMapEmpty(again)).toBe(true);
  });
});

describe('tileSizeImpact', () => {
  it('reports nothing without sheets', () => {
    expect(tileSizeImpact(createBlankProject(16, 'X'), 32)).toEqual({ attributeCount: 0, partialSheets: 0 });
  });

  it('counts attributes and partial sheets', () => {
    const p = sample();
    const s = p.sheets[0];
    s.attributes = { '1': [{ id: 'a', key: 'k', value: 1 }, { id: 'b', key: 'k', value: 2 }] };
    expect(tileSizeImpact(p, s.width).partialSheets).toBeLessThanOrEqual(p.sheets.length);
    expect(tileSizeImpact(p, 1).partialSheets).toBe(0);
    expect(tileSizeImpact(p, s.width + 1).partialSheets).toBe(p.sheets.length);
    expect(tileSizeImpact(p, 1).attributeCount).toBeGreaterThanOrEqual(2);
  });
});

describe('Editor.setTileSize', () => {
  const emptied = () => {
    const p = sample();
    for (const l of p.layers) l.cells.clear();
    return new Editor(p);
  };

  it('changes size, clears attributes, marks dirty and notifies', () => {
    const e = emptied();
    e.project.sheets[0].attributes = { '1': [{ id: 'a', key: 'k', value: 1 }] };
    let calls = 0;
    e.onChange = () => calls++;
    expect(e.setTileSize(32)).toEqual({ changed: true });
    expect(e.project.tileSize).toBe(32);
    expect(e.project.sheets.every((s) => Object.keys(s.attributes).length === 0)).toBe(true);
    expect(e.dirty).toBe(true);
    expect(calls).toBe(1);
  });

  it('rejects invalid values', () => {
    const e = emptied();
    const size = e.project.tileSize;
    for (const n of [0, -4, 1.5, NaN]) expect(e.setTileSize(n)).toEqual({ changed: false, reason: 'invalid' });
    expect(e.project.tileSize).toBe(size);
    expect(e.dirty).toBe(false);
  });

  it('refuses while tiles exist and leaves the project unchanged', () => {
    const e = new Editor(sample());
    const size = e.project.tileSize;
    const attrs = JSON.stringify(e.project.sheets.map((s) => s.attributes));
    expect(e.setTileSize(32)).toEqual({ changed: false, reason: 'not-empty' });
    expect(e.project.tileSize).toBe(size);
    expect(JSON.stringify(e.project.sheets.map((s) => s.attributes))).toBe(attrs);
    expect(e.dirty).toBe(false);
  });

  it('works again after the last tile is erased', () => {
    const e = new Editor(createBlankProject(16, 'X'));
    e.project.sheets.push(sample().sheets[0]);
    e.stroke(() => e.paint(0, 0, 0, brush(e.project)));
    expect(e.setTileSize(8).changed).toBe(false);
    e.stroke(() => e.erase(0, 0, 0));
    expect(e.setTileSize(8).changed).toBe(true);
  });
});

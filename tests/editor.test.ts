import { describe, expect, it } from 'vitest';
import { applyOrientOp, type Orientation, type OrientOp } from '../src/editor/orientation';
import { Editor, type Brush } from '../src/editor/editor';
import { countTiles, parseOfficeJson, serializeOfficeJson } from '../src/model/office';
import { cellKey, type Rotation } from '../src/model/types';
import { transformPixels } from '../src/model/transform';
import { loadOfficeJson } from './fixtures';

const sample = () => parseOfficeJson(loadOfficeJson());
const brush = (over: Partial<Brush> = {}): Brush => ({
  sheetId: sample().sheets[0].id,
  id: '3',
  flipX: false,
  flipY: false,
  rotation: 0,
  ...over,
});

describe('paint and erase', () => {
  it('paints an empty cell and replaces an occupied one (one tile per cell)', () => {
    const e = new Editor(sample());
    const before = countTiles(e.project);
    e.stroke(() => e.paint(0, 0, 0, brush({ id: '1' })));
    expect(e.project.layers[0].cells.get(cellKey(0, 0))?.id).toBe('1');
    e.stroke(() => e.paint(0, 0, 0, brush({ id: '2' })));
    expect(e.project.layers[0].cells.get(cellKey(0, 0))?.id).toBe('2');
    expect(countTiles(e.project)).toBe(before + 1);
  });

  it('stores flip and rotation of the brush', () => {
    const e = new Editor(sample());
    e.stroke(() => e.paint(0, 0, 0, brush({ flipX: true, rotation: 90 })));
    const out: any = serializeOfficeJson(e.project);
    const t = out.layers[0].tiles.find((t: any) => t.x === 0 && t.y === 0);
    expect(t).toMatchObject({ scaleX: -1, scaleY: 1, rotation: 90 });
  });

  it('erases on the active layer only', () => {
    const p = sample();
    // find a cell with tiles on two layers
    let found: [number, number, number, number] | null = null;
    outer: for (const [key] of p.layers[0].cells) {
      for (let j = 1; j < p.layers.length; j++) {
        if (p.layers[j].cells.has(key)) {
          const [x, y] = key.split(',').map(Number);
          found = [x, y, 0, j];
          break outer;
        }
      }
    }
    expect(found).not.toBeNull();
    const [x, y, a, b] = found!;
    const e = new Editor(p);
    e.stroke(() => e.erase(a, x, y));
    expect(p.layers[a].cells.has(cellKey(x, y))).toBe(false);
    expect(p.layers[b].cells.has(cellKey(x, y))).toBe(true);
  });
});

describe('undo / redo', () => {
  it('reverts a multi-cell stroke in one step and redoes it', () => {
    const e = new Editor(sample());
    const before = JSON.stringify(serializeOfficeJson(e.project));
    e.stroke(() => {
      for (let x = 0; x < 5; x++) e.paint(0, x, 0, brush());
      e.erase(0, 21, 10);
    });
    const after = JSON.stringify(serializeOfficeJson(e.project));
    expect(after).not.toBe(before);
    expect(e.undo()).toBe(true);
    expect(JSON.stringify(serializeOfficeJson(e.project))).toBe(before);
    expect(e.canUndo()).toBe(false);
    expect(e.redo()).toBe(true);
    expect(JSON.stringify(serializeOfficeJson(e.project))).toBe(after);
  });

  it('restores the pre-stroke tile when one cell is hit twice in a stroke', () => {
    const e = new Editor(sample());
    const original = e.project.layers[0].cells.get(cellKey(21, 10));
    e.stroke(() => {
      e.paint(0, 21, 10, brush({ id: '7' }));
      e.paint(0, 21, 10, brush({ id: '8' }));
    });
    e.undo();
    expect(e.project.layers[0].cells.get(cellKey(21, 10))).toBe(original);
  });

  it('records nothing for a no-op stroke and clears redo on a new edit', () => {
    const e = new Editor(sample());
    e.stroke(() => e.erase(0, -50, -50));
    expect(e.canUndo()).toBe(false);
    expect(e.dirty).toBe(false);
    e.stroke(() => e.paint(0, 0, 0, brush()));
    e.undo();
    expect(e.canRedo()).toBe(true);
    e.stroke(() => e.paint(0, 1, 1, brush()));
    expect(e.canRedo()).toBe(false);
  });
});

describe('orientation ops on placed tiles', () => {
  it('rotates clockwise and stores rotation 90', () => {
    const e = new Editor(sample());
    e.stroke(() => e.paint(0, 0, 0, brush()));
    e.stroke(() => e.transform(0, 0, 0, 'rotateCW'));
    expect(e.project.layers[0].cells.get(cellKey(0, 0))?.rotation).toBe(90);
  });

  it('flip/rotate ops match mirroring or rotating the drawn picture', () => {
    const size = 3;
    const src = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) src.set([i + 1, 0, 0, 255], i * 4);
    const draw = (o: Orientation) => transformPixels(src, size, o.flipX, o.flipY, o.rotation);
    const mirrorH = (d: Uint8ClampedArray) => transformPixels(d, size, true, false, 0);
    const mirrorV = (d: Uint8ClampedArray) => transformPixels(d, size, false, true, 0);
    const rot = (d: Uint8ClampedArray, r: Rotation) => transformPixels(d, size, false, false, r);
    const ops: [OrientOp, (d: Uint8ClampedArray) => Uint8ClampedArray][] = [
      ['flipH', mirrorH],
      ['flipV', mirrorV],
      ['rotateCW', (d) => rot(d, 90)],
      ['rotateCCW', (d) => rot(d, 270)],
    ];
    for (const fx of [false, true]) {
      for (const fy of [false, true]) {
        for (const r of [0, 90, 180, 270] as Rotation[]) {
          const o: Orientation = { flipX: fx, flipY: fy, rotation: r };
          for (const [op, picture] of ops) {
            expect(Array.from(draw(applyOrientOp(o, op)))).toEqual(Array.from(picture(draw(o))));
          }
        }
      }
    }
  });
});

describe('map resize', () => {
  it('grows without touching tiles and saves origin and size', () => {
    const e = new Editor(sample());
    const before = countTiles(e.project);
    expect(e.tilesOutside(50, 30)).toBe(0);
    expect(e.resizeMap(50, 30)).toBe(0);
    expect(countTiles(e.project)).toBe(before);
    const saved: any = serializeOfficeJson(e.project);
    expect(saved.settings.mapSize).toEqual({ width: 50, height: 30 });
    expect(saved.settings.mapOrigin).toEqual({ x: 21, y: 4 });
    expect(e.dirty).toBe(true);
  });

  it('shrinking reports and removes only tiles outside the new bounds', () => {
    const e = new Editor(sample());
    const before = countTiles(e.project);
    const outside = e.tilesOutside(40, 20);
    expect(outside).toBeGreaterThan(0);
    expect(countTiles(e.project)).toBe(before); // counting changes nothing
    expect(e.resizeMap(40, 20)).toBe(outside);
    expect(countTiles(e.project)).toBe(before - outside);
    for (const l of e.project.layers) {
      for (const key of l.cells.keys()) expect(Number(key.split(',')[1])).toBeLessThan(4 + 20);
    }
    expect(e.canUndo()).toBe(false);
  });

  it('rejects invalid sizes', () => {
    const e = new Editor(sample());
    expect(() => e.resizeMap(0, 5)).toThrow();
    expect(() => e.resizeMap(2.5, 5)).toThrow();
  });
});

describe('layer management', () => {
  const names = (e: Editor) => e.project.layers.map((l) => l.name);

  it('adds, renames and deletes layers, reflected in the saved file', () => {
    const e = new Editor(sample());
    e.addLayer(0, 'Overlay');
    expect(names(e)[0]).toBe('Overlay');
    expect(e.project.layers[0].cells.size).toBe(0);
    e.renameLayer(0, 'Top');
    const saved: any = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    expect(saved.layers).toHaveLength(11);
    expect(saved.layers[0]).toMatchObject({ name: 'Top', tiles: [], collider: false });
    e.deleteLayer(0);
    expect(e.project.layers).toHaveLength(10);
    expect(e.dirty).toBe(true);
  });

  it('reorders layers and keeps the new order on save and re-import', () => {
    const e = new Editor(sample());
    const before = names(e);
    e.moveLayer(2, 0);
    expect(names(e)).toEqual([before[2], before[0], before[1], ...before.slice(3)]);
    const again = parseOfficeJson(JSON.parse(JSON.stringify(serializeOfficeJson(e.project))));
    expect(again.layers.map((l) => l.name)).toEqual(names(e));
  });

  it('toggles the collider flag and writes it to the file', () => {
    const e = new Editor(sample());
    const was = e.project.layers[1].collider;
    e.setCollider(1, !was);
    const saved: any = serializeOfficeJson(e.project);
    expect(saved.layers[1].collider).toBe(!was);
  });

  it('saves a hidden layer as visible:false, omits it when visible, and keeps tiles', () => {
    const e = new Editor(sample());
    const original = JSON.stringify(serializeOfficeJson(e.project));
    expect(original).not.toContain('"visible"');
    const tiles = e.project.layers[1].cells.size;
    e.setVisible(1, false);
    expect(e.dirty).toBe(true);
    const saved: any = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    expect(saved.layers[1].visible).toBe(false);
    expect(saved.layers[1].tiles).toHaveLength(tiles);
    expect(saved.layers[0]).not.toHaveProperty('visible');
    expect(parseOfficeJson(saved).layers[1].visible).toBe(false);
    e.setVisible(1, true);
    expect(JSON.stringify(serializeOfficeJson(e.project))).toBe(original);
  });

  it('clears undo history when a layer is deleted so undo cannot hit a missing layer', () => {
    const e = new Editor(sample());
    e.stroke(() => e.paint(1, 0, 0, brush()));
    e.deleteLayer(1);
    expect(e.canUndo()).toBe(false);
    expect(e.undo()).toBe(false);
  });
});

function pngDataUrl(width: number, height: number): string {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return `data:image/png;base64,${b.toString('base64')}`;
}

describe('sprite sheets', () => {
  it('imports a 64x32 PNG as a new sheet and writes it into the saved file', () => {
    const e = new Editor(sample());
    const url = pngDataUrl(64, 32);
    const { sheet, partial } = e.addSheet(url);
    expect(partial).toBe(false);
    expect([sheet.width / 16, sheet.height / 16]).toEqual([4, 2]);
    expect((sheet.width / 16) * (sheet.height / 16)).toBe(8);
    const saved: any = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    expect(saved.spriteSheets[sheet.id].base64).toBe(url);
    expect(parseOfficeJson(saved).sheets).toHaveLength(17);
    expect(e.dirty).toBe(true);
  });

  it('flags partial tiles and rejects images smaller than a tile', () => {
    const e = new Editor(sample());
    expect(e.addSheet(pngDataUrl(70, 40)).partial).toBe(true);
    expect(() => e.addSheet(pngDataUrl(8, 32))).toThrow();
    expect(() => e.addSheet('data:image/jpeg;base64,AAAA')).toThrow();
  });

  it('refuses to delete a sheet with placed tiles and reports the count, allows unused ones', () => {
    const e = new Editor(sample());
    const used = e.project.sheets.find((s) => e.sheetUsage(s.id) > 0)!;
    const count = e.sheetUsage(used.id);
    expect(count).toBeGreaterThan(0);
    expect(e.deleteSheet(used.id)).toEqual({ deleted: false, usage: count });
    expect(e.project.sheets).toContain(used);
    const { sheet } = e.addSheet(pngDataUrl(32, 32));
    expect(e.deleteSheet(sheet.id)).toEqual({ deleted: true });
    expect(e.project.sheets).not.toContain(sheet);
  });
});

describe('tile attributes', () => {
  it('adds, edits and removes attributes and round-trips them through Office.json', () => {
    const e = new Editor(sample());
    const sheet = e.project.sheets[0];
    const a = e.addAttribute(sheet.id, '5', 'interaction', 'door');
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    let saved: any = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    expect(saved.spriteSheets[sheet.id].attributes['5']).toEqual([{ id: a.id, key: 'interaction', value: 'door' }]);
    expect(parseOfficeJson(saved).sheets[0].attributes['5'][0].value).toBe('door');

    e.updateAttribute(sheet.id, '5', a.id, 'interaction', 'water');
    saved = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    expect(saved.spriteSheets[sheet.id].attributes['5'][0].value).toBe('water');

    e.removeAttribute(sheet.id, '5', a.id);
    saved = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    expect(saved.spriteSheets[sheet.id].attributes).not.toHaveProperty('5');
  });
});

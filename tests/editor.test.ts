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

describe('sheet rename and reorder', () => {
  it('renames a sheet and rejects an empty name', () => {
    const e = new Editor(sample());
    const id = e.project.sheets[0].id;
    expect(e.renameSheet(id, '  Office tiles ')).toBe(true);
    expect(e.project.sheets[0].name).toBe('Office tiles');
    expect(e.renameSheet(id, '   ')).toBe(false);
    expect(e.project.sheets[0].name).toBe('Office tiles');
  });

  it('moves a sheet up and down and stops at the edges', () => {
    const e = new Editor(sample());
    const ids = e.project.sheets.map((s) => s.id);
    expect(e.moveSheet(ids[2], -1)).toBe(1);
    expect(e.project.sheets.map((s) => s.id).slice(0, 3)).toEqual([ids[0], ids[2], ids[1]]);
    e.dirty = false;
    expect(e.moveSheet(ids[0], -1)).toBe(0);
    const last = ids.length - 1;
    expect(e.moveSheet(e.project.sheets[last].id, 1)).toBe(last);
    expect(e.dirty).toBe(false);
  });

  it('keeps the order through save and reload without touching tiles', () => {
    const e = new Editor(sample());
    const ids = e.project.sheets.map((s) => s.id);
    e.moveSheet(ids[2], -1);
    const out = JSON.parse(JSON.stringify(serializeOfficeJson(e.project)));
    const again = parseOfficeJson(out);
    expect(again.sheets.map((s) => s.id).slice(0, 3)).toEqual([ids[0], ids[2], ids[1]]);
    expect(serializeOfficeJson(again).layers).toEqual(serializeOfficeJson(sample()).layers);
  });

  it('names an added sheet', () => {
    const e = new Editor(sample());
    const url = e.project.sheets[0].dataUrl;
    expect(e.addSheet(url, 'Imported').sheet.name).toBe('Imported');
    expect(e.addSheet(url).sheet.name).toBeUndefined();
  });
});

describe('block operations', () => {
  const emptyEditor = (layers = 2) => {
    const p = sample();
    for (const l of p.layers) l.cells.clear();
    p.layers.length = layers;
    return new Editor(p);
  };
  const tile = (id: string) => ({
    id,
    sheetId: 's',
    flipX: false,
    flipY: false,
    rotation: 0 as Rotation,
    extra: {},
  });
  const block2x2 = (layerId?: string) => ({
    width: 2,
    height: 2,
    cells: [0, 1, 2, 3].map((i) => ({ dx: i % 2, dy: Math.floor(i / 2), layerId, tile: tile(String(i)) })),
  });
  const id = (e: Editor, li: number, x: number, y: number) => e.project.layers[li].cells.get(cellKey(x, y))?.id;
  const r = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

  it('paintBlock stamps a 2x2 block in its layout and replaces existing tiles', () => {
    const e = emptyEditor();
    e.stroke(() => e.paint(0, 6, 5, brush({ id: '9' })));
    e.stroke(() => e.paintBlock(0, 5, 5, block2x2()));
    expect([id(e, 0, 5, 5), id(e, 0, 6, 5), id(e, 0, 5, 6), id(e, 0, 6, 6)]).toEqual(['0', '1', '2', '3']);
    expect(countTiles(e.project)).toBe(4);
  });

  it('fillRect tiles a 6x4 fill with a 2x2 block from the press cell', () => {
    const e = emptyEditor();
    e.stroke(() => e.fillRect(0, [0, 0], [5, 3], block2x2()));
    expect(countTiles(e.project)).toBe(24);
    expect(id(e, 0, 4, 2)).toBe('0');
    expect(id(e, 0, 5, 3)).toBe('3');
  });

  it('fillRect clips a pattern in a 3x3 fill', () => {
    const e = emptyEditor();
    e.stroke(() => e.fillRect(0, [0, 0], [2, 2], block2x2()));
    expect(countTiles(e.project)).toBe(9);
    expect(id(e, 0, 2, 2)).toBe('0');
    expect(id(e, 0, 3, 3)).toBeUndefined();
  });

  it('fillRect dragged up and left anchors the pattern at the press cell', () => {
    const e = emptyEditor();
    e.stroke(() => e.fillRect(0, [5, 5], [3, 3], block2x2()));
    expect(id(e, 0, 5, 5)).toBe('0');
    expect(id(e, 0, 4, 5)).toBe('1');
    expect(id(e, 0, 5, 4)).toBe('2');
    expect(id(e, 0, 4, 4)).toBe('3');
  });

  it('deleteRect skips layers that are not listed', () => {
    const e = emptyEditor(3);
    e.stroke(() => {
      for (let li = 0; li < 3; li++) e.paint(li, 1, 1, brush());
    });
    e.stroke(() => e.deleteRect([0, 1], r(0, 0, 2, 2)));
    expect([id(e, 0, 1, 1), id(e, 1, 1, 1), id(e, 2, 1, 1)]).toEqual([undefined, undefined, '3']);
  });

  it('moveCells moves, copies, handles overlap and keeps negative coordinates', () => {
    const e = emptyEditor();
    e.stroke(() => e.paintBlock(0, 0, 0, block2x2()));
    e.stroke(() => e.moveCells([0], r(0, 0, 1, 1), 1, 0, false));
    expect([id(e, 0, 0, 0), id(e, 0, 1, 0), id(e, 0, 2, 0), id(e, 0, 1, 1), id(e, 0, 2, 1)]).toEqual([
      undefined,
      '0',
      '1',
      '2',
      '3',
    ]);
    e.stroke(() => e.moveCells([0], r(1, 0, 2, 1), 5, 0, true));
    expect(countTiles(e.project)).toBe(8);
    e.stroke(() => e.moveCells([0], r(1, 0, 2, 1), -4, -3, false));
    expect(id(e, 0, -3, -3)).toBe('0');
    expect(id(e, 0, -2, -2)).toBe('3');
  });

  it('moveCells replaces tiles at the target on that layer', () => {
    const e = emptyEditor();
    e.stroke(() => {
      e.paint(0, 0, 0, brush({ id: '1' }));
      e.paint(0, 3, 0, brush({ id: '2' }));
    });
    e.stroke(() => e.moveCells([0], r(0, 0, 0, 0), 3, 0, false));
    expect(id(e, 0, 3, 0)).toBe('1');
    expect(countTiles(e.project)).toBe(1);
  });

  it('pasteBlock routes tiles to their source layers and skips unknown layers', () => {
    const e = emptyEditor();
    const [a, b] = e.project.layers.map((l) => l.id);
    const blk = {
      width: 2,
      height: 1,
      cells: [
        { dx: 0, dy: 0, layerId: a, tile: tile('1') },
        { dx: 1, dy: 0, layerId: b, tile: tile('2') },
        { dx: 1, dy: 0, layerId: 'gone', tile: tile('3') },
      ],
    };
    e.stroke(() => e.pasteBlock(blk, 4, 4));
    expect(id(e, 0, 4, 4)).toBe('1');
    expect(id(e, 1, 5, 4)).toBe('2');
    expect(countTiles(e.project)).toBe(2);
  });

  it('a multi-layer move, paste and fill each undo and redo as one step', () => {
    const e = emptyEditor();
    e.stroke(() => {
      e.paint(0, 0, 0, brush());
      e.paint(1, 1, 0, brush());
    });
    const base = countTiles(e.project);
    const keys = () => e.project.layers.map((l) => [...l.cells.keys()].sort().join(';'));
    const gesture = (fn: () => void) => {
      e.stroke(fn);
      const after = keys();
      expect(e.undo()).toBe(true);
      expect(countTiles(e.project)).toBe(base);
      expect(e.redo()).toBe(true);
      expect(keys()).toEqual(after);
      e.undo();
    };
    gesture(() => e.moveCells([0, 1], r(0, 0, 1, 0), 0, 3, false));
    gesture(() => e.pasteBlock(e.captureBlock([0, 1], r(0, 0, 1, 0)), 5, 5));
    gesture(() => e.fillRect(0, [0, 5], [3, 7], block2x2()));
  });
});

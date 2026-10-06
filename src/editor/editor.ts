import { pngSizeFromDataUrl } from '../model/png';
import { cellKey, type Attribute, type Layer, type PlacedTile, type Project, type SpriteSheet } from '../model/types';
import { applyOrientOp, type OrientOp, type Orientation } from './orientation';

/** What the paint tool places: a sheet tile plus its orientation. */
export interface Brush extends Orientation {
  sheetId: string;
  id: string;
}

interface CellChange {
  layerId: string;
  key: string;
  before: PlacedTile | null;
  after: PlacedTile | null;
}

type Stroke = CellChange[];

const same = (a: PlacedTile | null, b: PlacedTile | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.id === b.id &&
    a.sheetId === b.sheetId &&
    a.flipX === b.flipX &&
    a.flipY === b.flipY &&
    a.rotation === b.rotation);

/**
 * All map edits go through here so they can be undone. Each stroke (a drag, or a single
 * click) is one undo step holding only the cells it changed.
 */
export class Editor {
  dirty = false;
  onChange: () => void = () => {};
  private undoStack: Stroke[] = [];
  private redoStack: Stroke[] = [];
  private current: Map<string, CellChange> | null = null;

  constructor(public project: Project) {}

  beginStroke(): void {
    this.current = new Map();
  }

  endStroke(): void {
    const changes = [...(this.current?.values() ?? [])].filter((c) => !same(c.before, c.after));
    this.current = null;
    if (changes.length === 0) return;
    this.undoStack.push(changes);
    this.redoStack = [];
    this.dirty = true;
    this.onChange();
  }

  /** Runs `fn` as a single undoable stroke. */
  stroke(fn: () => void): void {
    this.beginStroke();
    fn();
    this.endStroke();
  }

  private layerById(layerId: string) {
    const layer = this.project.layers.find((l) => l.id === layerId);
    if (!layer) throw new Error(`Unknown layer ${layerId}`);
    return layer;
  }

  private setCell(layerIndex: number, cx: number, cy: number, tile: PlacedTile | null): boolean {
    const layer = this.project.layers[layerIndex];
    const key = cellKey(cx, cy);
    const before = layer.cells.get(key) ?? null;
    if (same(before, tile)) return false;
    if (tile) layer.cells.set(key, tile);
    else layer.cells.delete(key);
    if (this.current) {
      const id = `${layer.id}|${key}`;
      const existing = this.current.get(id);
      // Keep the cell's state from before the stroke started.
      this.current.set(id, { layerId: layer.id, key, before: existing ? existing.before : before, after: tile });
    }
    return true;
  }

  /** Places the brush tile, replacing whatever the cell had on that layer. */
  paint(layerIndex: number, cx: number, cy: number, brush: Brush): boolean {
    const existing = this.project.layers[layerIndex].cells.get(cellKey(cx, cy));
    return this.setCell(layerIndex, cx, cy, {
      id: brush.id,
      sheetId: brush.sheetId,
      flipX: brush.flipX,
      flipY: brush.flipY,
      rotation: brush.rotation,
      extra: existing?.extra ?? {},
    });
  }

  /** Removes the tile on the given layer only. */
  erase(layerIndex: number, cx: number, cy: number): boolean {
    return this.setCell(layerIndex, cx, cy, null);
  }

  /** Flips or rotates an already placed tile in place. */
  transform(layerIndex: number, cx: number, cy: number, op: OrientOp): boolean {
    const tile = this.project.layers[layerIndex].cells.get(cellKey(cx, cy));
    if (!tile) return false;
    return this.setCell(layerIndex, cx, cy, { ...tile, ...applyOrientOp(tile, op) });
  }

  private structureChanged(): void {
    this.dirty = true;
    this.onChange();
  }

  /** Inserts a new empty layer at `index` in file order (0 = top of the stack). */
  addLayer(index: number, name: string): Layer {
    const layer: Layer = {
      id: crypto.randomUUID(),
      name,
      description: '',
      collider: false,
      visible: true,
      isAutoTile: false,
      rules: [],
      defaultTileVariants: [],
      cells: new Map(),
      extra: {},
    };
    this.project.layers.splice(index, 0, layer);
    this.structureChanged();
    return layer;
  }

  renameLayer(index: number, name: string): void {
    this.project.layers[index].name = name;
    this.structureChanged();
  }

  setCollider(index: number, collider: boolean): void {
    this.project.layers[index].collider = collider;
    this.structureChanged();
  }

  setVisible(index: number, visible: boolean): void {
    this.project.layers[index].visible = visible;
    this.structureChanged();
  }

  /** Moves a layer from one file-order position to another. */
  moveLayer(from: number, to: number): void {
    const layers = this.project.layers;
    if (from === to || from < 0 || to < 0 || from >= layers.length || to >= layers.length) return;
    layers.splice(to, 0, ...layers.splice(from, 1));
    this.structureChanged();
  }

  /** Removes a layer with its tiles. Undo history is cleared because it may refer to the layer. */
  deleteLayer(index: number): void {
    this.project.layers.splice(index, 1);
    this.undoStack = [];
    this.redoStack = [];
    this.structureChanged();
  }

  /** Adds a PNG (data URL) as a new sheet. `partial` is true when edge pixels don't fill a whole tile. */
  addSheet(dataUrl: string, name?: string): { sheet: SpriteSheet; partial: boolean } {
    const { width, height } = pngSizeFromDataUrl(dataUrl);
    const ts = this.project.tileSize;
    if (width < ts || height < ts) throw new Error(`Image is smaller than one ${ts}x${ts} tile`);
    const sheet: SpriteSheet = { id: crypto.randomUUID(), dataUrl, width, height, attributes: {}, extra: {} };
    if (name) sheet.name = name;
    this.project.sheets.push(sheet);
    this.structureChanged();
    return { sheet, partial: width % ts !== 0 || height % ts !== 0 };
  }

  /** Renames a sheet. An empty (or blank) name is rejected and returns false. */
  renameSheet(sheetId: string, name: string): boolean {
    const trimmed = name.trim();
    const sheet = this.project.sheets.find((s) => s.id === sheetId);
    if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
    if (!trimmed) return false;
    sheet.name = trimmed;
    this.structureChanged();
    return true;
  }

  /** Moves a sheet by `delta` positions in the list. Returns its new index (unchanged at the edges). */
  moveSheet(sheetId: string, delta: number): number {
    const sheets = this.project.sheets;
    const from = sheets.findIndex((s) => s.id === sheetId);
    if (from < 0) throw new Error(`Unknown sheet ${sheetId}`);
    const to = from + delta;
    if (delta === 0 || to < 0 || to >= sheets.length) return from;
    sheets.splice(to, 0, ...sheets.splice(from, 1));
    this.structureChanged();
    return to;
  }

  /** Number of placed tiles that use the sheet. */
  sheetUsage(sheetId: string): number {
    let n = 0;
    for (const l of this.project.layers) for (const t of l.cells.values()) if (t.sheetId === sheetId) n++;
    return n;
  }

  /** Removes an unused sheet. Returns the usage count instead when tiles still use it. */
  deleteSheet(sheetId: string): { deleted: true } | { deleted: false; usage: number } {
    const usage = this.sheetUsage(sheetId);
    if (usage > 0) return { deleted: false, usage };
    const i = this.project.sheets.findIndex((s) => s.id === sheetId);
    if (i < 0) throw new Error(`Unknown sheet ${sheetId}`);
    this.project.sheets.splice(i, 1);
    this.structureChanged();
    return { deleted: true };
  }

  private attrs(sheetId: string, tileId: string): Attribute[] {
    const sheet = this.project.sheets.find((s) => s.id === sheetId);
    if (!sheet) throw new Error(`Unknown sheet ${sheetId}`);
    return (sheet.attributes[tileId] ??= []);
  }

  /** Adds a key/value attribute to a sheet tile; applies to every placement of that tile. */
  addAttribute(sheetId: string, tileId: string, key: string, value: unknown): Attribute {
    const attr: Attribute = { id: crypto.randomUUID(), key, value };
    this.attrs(sheetId, tileId).push(attr);
    this.structureChanged();
    return attr;
  }

  updateAttribute(sheetId: string, tileId: string, attrId: string, key: string, value: unknown): void {
    const attr = this.attrs(sheetId, tileId).find((a) => a.id === attrId);
    if (!attr) throw new Error(`Unknown attribute ${attrId}`);
    attr.key = key;
    attr.value = value;
    this.structureChanged();
  }

  removeAttribute(sheetId: string, tileId: string, attrId: string): void {
    const list = this.attrs(sheetId, tileId);
    const i = list.findIndex((a) => a.id === attrId);
    if (i < 0) throw new Error(`Unknown attribute ${attrId}`);
    list.splice(i, 1);
    if (list.length === 0) {
      const sheet = this.project.sheets.find((s) => s.id === sheetId)!;
      delete sheet.attributes[tileId];
    }
    this.structureChanged();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    const stroke = this.undoStack.pop();
    if (!stroke) return false;
    this.apply(stroke, 'before');
    this.redoStack.push(stroke);
    return true;
  }

  redo(): boolean {
    const stroke = this.redoStack.pop();
    if (!stroke) return false;
    this.apply(stroke, 'after');
    this.undoStack.push(stroke);
    return true;
  }

  private apply(stroke: Stroke, side: 'before' | 'after'): void {
    for (const c of stroke) {
      const cells = this.layerById(c.layerId).cells;
      const tile = c[side];
      if (tile) cells.set(c.key, tile);
      else cells.delete(c.key);
    }
    this.dirty = true;
    this.onChange();
  }
}

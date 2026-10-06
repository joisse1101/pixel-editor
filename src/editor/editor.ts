import { getMapBounds } from '../model/office';
import { cellKey, parseCellKey, type Layer, type PlacedTile, type Project } from '../model/types';
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

  /** Number of tiles that would be dropped by resizing the map to width x height from its origin. */
  tilesOutside(width: number, height: number): number {
    const b = getMapBounds(this.project);
    let n = 0;
    for (const l of this.project.layers) {
      for (const key of l.cells.keys()) {
        const [x, y] = parseCellKey(key);
        if (x < b.x || y < b.y || x >= b.x + width || y >= b.y + height) n++;
      }
    }
    return n;
  }

  /**
   * Sets the map size, keeping the top-left origin, and removes tiles outside the new rectangle.
   * Returns the number of tiles removed. Undo history is cleared only when tiles were removed.
   */
  resizeMap(width: number, height: number): number {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error('Map size must be whole numbers of at least 1');
    }
    const b = getMapBounds(this.project);
    let removed = 0;
    for (const l of this.project.layers) {
      for (const key of [...l.cells.keys()]) {
        const [x, y] = parseCellKey(key);
        if (x < b.x || y < b.y || x >= b.x + width || y >= b.y + height) {
          l.cells.delete(key);
          removed++;
        }
      }
    }
    this.project.mapOrigin = { x: b.x, y: b.y };
    this.project.mapSize = { width, height };
    if (removed > 0) {
      this.undoStack = [];
      this.redoStack = [];
    }
    this.structureChanged();
    return removed;
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

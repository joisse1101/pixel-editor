import { cellKey, type PlacedTile, type Project } from '../model/types';
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

import type { Pixels } from '../model/pngCodec';
import { History, type ImageHolder, type Layer, type LayerState } from './history';
import {
  clonePixels,
  createPixels,
  extract,
  flip as flipPixels,
  floodFill,
  inBounds,
  rotatePixels,
  rotatedRect,
  resize as resizePixels,
  validateSize,
  wholeRect,
  type Anchor,
  type Point,
  type Rect,
  type Rgba,
  type Rotation,
} from './ops';

export const TRANSPARENT: Rgba = [0, 0, 0, 0];
export const DEFAULT_SIZE = 32;

/** Pixels lifted out of the image (or pasted) and being placed. */
interface Floating {
  pixels: Pixels;
  rect: Rect;
  /** A paste stays floating until something else is done; a move commits when released. */
  pending: boolean;
  /** Where a moved selection came from, for cancelling. */
  origin: Rect | null;
}

const intersect = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bt > y ? { x, y, w: r - x, h: bt - y } : null;
};

/**
 * The pixel image with its history, selection and clipboard. Every public edit method is exactly
 * one undo step (or none when it changes nothing). No DOM.
 */
export class PixelDocument implements ImageHolder {
  /** Bottom layer first. Never empty; every layer has the canvas size. */
  layers: Layer[];
  activeIndex = 0;
  private nextLayerId = 1;
  readonly history: History;
  selection: Rect | null = null;
  floating: Floating | null = null;
  clipboard: Pixels | null = null;
  /** Called after anything that changes what is shown. */
  onChange: () => void = () => {};

  constructor(width = DEFAULT_SIZE, height = DEFAULT_SIZE) {
    this.layers = [this.makeLayer('Layer 1', createPixels(width, height))];
    this.history = new History(this);
  }

  /** The active layer's pixels: what tools, selection and the eyedropper act on. */
  get px(): Pixels {
    return this.layers[this.activeIndex].px;
  }
  get activeLayer(): Layer {
    return this.layers[this.activeIndex];
  }
  get width(): number {
    return this.px.width;
  }
  get height(): number {
    return this.px.height;
  }
  get isDirty(): boolean {
    return this.history.isDirty;
  }
  get hasSelection(): boolean {
    return this.selection !== null;
  }

  // ---- Replacing the whole document ----

  /** Starts a new transparent image. Throws with the reason when the size is invalid. */
  newImage(width: number, height: number): void {
    const err = validateSize(width, height);
    if (err) throw new Error(err);
    this.replace(createPixels(width, height));
  }

  /** Makes `px` the image, with no history; it counts as saved. */
  load(px: Pixels, name?: string): void {
    this.replace(px, name);
  }

  markSaved(): void {
    this.history.markSaved();
    this.onChange();
  }

  private makeLayer(name: string, px: Pixels, visible = true): Layer {
    return { id: this.nextLayerId++, name, visible, px };
  }

  private replace(px: Pixels, name = 'Layer 1'): void {
    this.floating = null;
    this.selection = null;
    this.layers = [this.makeLayer(name, px)];
    this.activeIndex = 0;
    this.history.clear();
    this.onChange();
  }

  // ---- Layers ----

  /**
   * Makes layer `index` the one edits act on. Floating pixels are written to the layer they came from
   * first; the selection rectangle and the clipboard stay. Not an undo step.
   */
  setActive(index: number): void {
    if (index === this.activeIndex || index < 0 || index >= this.layers.length) return;
    this.commitFloating();
    this.activeIndex = index;
    this.onChange();
  }

  /** Shows or hides a layer. Not an undo step and does not make the document dirty. */
  setVisible(index: number, visible: boolean): void {
    const layer = this.layers[index];
    if (!layer || layer.visible === visible) return;
    layer.visible = visible;
    this.onChange();
  }

  /** A single fully transparent layer: nothing worth keeping, so an import replaces it. */
  get isBlank(): boolean {
    return this.layers.length === 1 && this.isLayerEmpty(0);
  }

  /** Whether the layer has no visible pixel at all. */
  isLayerEmpty(index: number): boolean {
    const d = this.layers[index].px.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  }

  /** Adds a transparent layer directly above the active one and activates it. */
  addLayer(): void {
    const layer = this.makeLayer(`Layer ${this.nextLayerId}`, createPixels(this.width, this.height));
    const at = this.activeIndex + 1;
    this.structure([...this.layers.slice(0, at), layer, ...this.layers.slice(at)], at);
  }

  /** Copies the active layer directly above it; the copy is active. */
  duplicateLayer(): void {
    const src = this.activeLayer;
    const copy = this.makeLayer(`${src.name} copy`, clonePixels(src.px), src.visible);
    const at = this.activeIndex + 1;
    this.structure([...this.layers.slice(0, at), copy, ...this.layers.slice(at)], at);
  }

  /** Removes a layer (the last one is kept). Deleting the active layer activates the nearest remaining one. */
  deleteLayer(index = this.activeIndex): boolean {
    if (this.layers.length <= 1 || index < 0 || index >= this.layers.length) return false;
    const active = this.activeLayer;
    const layers = this.layers.filter((_, i) => i !== index);
    this.structure(layers, index === this.activeIndex ? Math.max(0, index - 1) : layers.indexOf(active));
    return true;
  }

  /** Renames a layer; an empty or unchanged name does nothing. */
  renameLayer(index: number, name: string): boolean {
    const layer = this.layers[index];
    const next = name.trim();
    if (!layer || !next || next === layer.name) return false;
    this.structure(
      this.layers.map((l, i) => (i === index ? { ...l, name: next } : l)),
      this.activeIndex,
    );
    return true;
  }

  /** Moves a layer one place up (+1) or down (-1) the stack; the active layer stays active. */
  moveLayer(index: number, dir: 1 | -1): boolean {
    const to = index + dir;
    if (index < 0 || index >= this.layers.length || to < 0 || to >= this.layers.length) return false;
    const active = this.activeLayer;
    const layers = this.layers.slice();
    [layers[index], layers[to]] = [layers[to], layers[index]];
    this.structure(layers, layers.indexOf(active));
    return true;
  }

  /** Records a change to the layer list as one step. */
  private structure(layers: Layer[], activeIndex: number): void {
    this.settle();
    this.history.snapshot({ layers, activeIndex });
    this.onChange();
  }

  /** Applies `fn` to every layer's pixels as one step; layers keep their ids and names. */
  private mapLayers(fn: (px: Pixels) => Pixels): void {
    const state: LayerState = {
      layers: this.layers.map((l) => ({ ...l, px: fn(l.px) })),
      activeIndex: this.activeIndex,
    };
    this.history.snapshot(state);
  }

  /**
   * Adds each image as a layer above the others, in order. The canvas grows to the largest width and
   * height (top-left anchored, padding with transparency) so nothing is clipped. A single transparent
   * layer is replaced and the canvas takes the first image size. One undo step. Returns whether the
   * canvas size changed. Throws, changing nothing, when the result would exceed the size limit.
   */
  addLayers(images: { name: string; px: Pixels }[]): boolean {
    if (!images.length) return false;
    const adopt = this.isBlank;
    let w = adopt ? images[0].px.width : this.width;
    let h = adopt ? images[0].px.height : this.height;
    for (const img of images) {
      w = Math.max(w, img.px.width);
      h = Math.max(h, img.px.height);
    }
    const err = validateSize(w, h);
    if (err) throw new Error(err);
    this.settle();
    const wasClean = !this.isDirty;
    const grown = w !== this.width || h !== this.height;
    const top: Anchor = { ax: 0, ay: 0 };
    const kept = adopt ? [] : this.layers.map((l) => (grown ? { ...l, px: resizePixels(l.px, w, h, top) } : l));
    const added = images.map((img) => this.makeLayer(img.name, resizePixels(img.px, w, h, top)));
    const layers = [...kept, ...added];
    this.history.snapshot({ layers, activeIndex: layers.length - 1 });
    if (adopt && wasClean) this.history.markSaved();
    if (this.selection) this.selection = intersect(this.selection, wholeRect(this.px));
    this.onChange();
    return grown;
  }

  // ---- Strokes: pencil, eraser, shapes ----

  beginStroke(): void {
    this.settle();
    this.history.beginStroke();
  }

  /** Sets the given pixels (off-canvas ones are skipped) inside the open stroke. */
  paint(points: Iterable<Point>, color: Rgba): void {
    for (const p of points) if (inBounds(this.px, p.x, p.y)) this.history.write(p.y * this.px.width + p.x, color);
    this.onChange();
  }

  endStroke(): void {
    this.history.endStroke();
    this.onChange();
  }

  /** One-step edit of the given pixels, e.g. a committed line or rectangle. */
  commitShape(points: Iterable<Point>, color: Rgba): void {
    this.beginStroke();
    this.paint(points, color);
    this.endStroke();
  }

  /** Flood fill from (x, y). Returns false, and adds no step, when nothing changes. */
  fill(x: number, y: number, color: Rgba): boolean {
    this.settle();
    const region = floodFill(this.px, x, y, color);
    if (!region.length) return false;
    this.history.beginStroke();
    for (const i of region) this.history.write(i, color);
    this.endStroke();
    return true;
  }

  // ---- Selection ----

  /** Selects a rectangle (clipped to the canvas), or clears the selection with null. No history step. */
  select(rect: Rect | null): void {
    this.settle();
    this.selection = rect ? intersect(rect, wholeRect(this.px)) : null;
    this.onChange();
  }

  /**
   * Esc: cancels a floating move or paste (image unchanged), otherwise clears the selection.
   */
  cancel(): void {
    if (this.floating) this.cancelFloating();
    else this.selection = null;
    this.onChange();
  }

  /** Lifts the selection so it can be dragged; `copy` leaves the original in place. */
  beginMove(copy: boolean): boolean {
    if (this.floating) return this.floating.pending;
    const rect = this.selection;
    if (!rect) return false;
    const pixels = extract(this.px, rect);
    this.history.beginStroke();
    if (!copy) this.clearRecorded(rect);
    this.floating = { pixels, rect: { ...rect }, pending: false, origin: rect };
    this.onChange();
    return true;
  }

  /** Puts the floating pixels' top-left at (x, y). */
  moveTo(x: number, y: number): void {
    if (!this.floating) return;
    this.floating.rect = { ...this.floating.rect, x, y };
    this.selection = this.floating.rect;
    this.onChange();
  }

  /** Drop after a drag: writes the pixels as one step. A pasted selection keeps floating. */
  endMove(): void {
    if (this.floating && !this.floating.pending) this.commitFloating();
  }

  /** Writes any floating pixels into the image as one step. */
  commitFloating(): void {
    const f = this.floating;
    if (!f) return;
    if (!this.history.strokeOpen) this.history.beginStroke();
    this.blitRecorded(f.pixels, f.rect.x, f.rect.y);
    this.history.endStroke();
    this.floating = null;
    this.selection = intersect(f.rect, wholeRect(this.px));
    this.onChange();
  }

  private cancelFloating(): void {
    const f = this.floating!;
    if (this.history.strokeOpen) this.history.abortStroke();
    this.floating = null;
    this.selection = f.origin;
  }

  /** Commits a pasted selection that is still floating. */
  private settle(): void {
    if (this.floating?.pending) this.commitFloating();
  }

  copySelection(): boolean {
    const src = this.floating?.pixels ?? (this.selection ? extract(this.px, this.selection) : null);
    if (!src) return false;
    this.clipboard = clonePixels(src);
    return true;
  }

  /** Pastes the clipboard as a floating selection with its top-left at `at`. Nothing happens without a copy. */
  paste(at: Point): boolean {
    if (!this.clipboard) return false;
    this.settle();
    const pixels = clonePixels(this.clipboard);
    const rect = { x: at.x, y: at.y, w: pixels.width, h: pixels.height };
    this.floating = { pixels, rect, pending: true, origin: null };
    this.selection = rect;
    this.onChange();
    return true;
  }

  /** Clears the selected pixels to transparent; the selection stays. */
  deleteSelection(): void {
    this.settle();
    if (!this.selection) return;
    this.history.beginStroke();
    this.clearRecorded(this.selection);
    this.endStroke();
  }

  // ---- Transforms ----

  /** Mirrors the selection in place, or the whole canvas when nothing is selected. */
  flip(axis: 'h' | 'v'): void {
    this.settle();
    if (this.floating) return;
    if (!this.selection) {
      this.mapLayers((px) => {
        const out = clonePixels(px);
        flipPixels(out, axis);
        return out;
      });
      this.onChange();
      return;
    }
    const rect = this.selection;
    const region = extract(this.px, rect);
    flipPixels(region, axis);
    this.history.beginStroke();
    this.writeRegion(region, rect.x, rect.y);
    this.endStroke();
  }

  /** Rotates the selection about its centre, or the whole canvas (swapping width and height). */
  rotate(dir: Rotation): void {
    this.settle();
    if (this.floating) return;
    const rect = this.selection;
    if (!rect) {
      this.mapLayers((px) => rotatePixels(px, dir));
      this.onChange();
      return;
    }
    const rotated = rotatePixels(extract(this.px, rect), dir);
    const target = rotatedRect(rect);
    this.history.beginStroke();
    this.clearRecorded(rect);
    this.blitRecorded(rotated, target.x, target.y);
    this.history.endStroke();
    this.selection = intersect(target, wholeRect(this.px));
    this.onChange();
  }

  /** Changes the canvas size around `anchor`; clears the selection. Throws with the reason when invalid. */
  resize(width: number, height: number, anchor: Anchor): void {
    const err = validateSize(width, height);
    if (err) throw new Error(err);
    this.settle();
    this.selection = null;
    this.mapLayers((px) => resizePixels(px, width, height, anchor));
    this.onChange();
  }

  // ---- Undo / redo ----

  undo(): boolean {
    return this.step(() => this.history.undo());
  }

  redo(): boolean {
    return this.step(() => this.history.redo());
  }

  private step(run: () => boolean): boolean {
    this.settle();
    if (this.floating) return false;
    const done = run();
    if (done && this.selection) this.selection = intersect(this.selection, wholeRect(this.px));
    this.onChange();
    return done;
  }

  // ---- Recorded writes (inside an open stroke) ----

  private clearRecorded(rect: Rect): void {
    const r = intersect(rect, wholeRect(this.px));
    if (!r) return;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) this.history.write(y * this.px.width + x, TRANSPARENT);
    }
  }

  /** Writes `src` at (ox, oy), clipped; fully transparent source pixels do not overwrite. */
  private blitRecorded(src: Pixels, ox: number, oy: number): void {
    this.writeRegion(src, ox, oy, true);
  }

  private writeRegion(src: Pixels, ox: number, oy: number, skipTransparent = false): void {
    for (let y = Math.max(0, -oy); y < Math.min(src.height, this.px.height - oy); y++) {
      for (let x = Math.max(0, -ox); x < Math.min(src.width, this.px.width - ox); x++) {
        const s = (y * src.width + x) * 4;
        if (skipTransparent && src.data[s + 3] === 0) continue;
        this.history.write((y + oy) * this.px.width + x + ox, [
          src.data[s],
          src.data[s + 1],
          src.data[s + 2],
          src.data[s + 3],
        ]);
      }
    }
  }
}

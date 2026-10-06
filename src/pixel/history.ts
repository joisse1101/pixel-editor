import type { Pixels } from '../model/pngCodec';
import type { Rgba } from './ops';

export interface Layer {
  id: number;
  name: string;
  visible: boolean;
  px: Pixels;
}

/** Everything a structural step changes: the layer list (index 0 = bottom) and which layer is active. */
export interface LayerState {
  layers: Layer[];
  activeIndex: number;
}

/** The layers the history edits; `px` is the active layer's pixels. Structural steps swap the list. */
export interface ImageHolder extends LayerState {
  readonly px: Pixels;
}

interface DiffStep {
  kind: 'diff';
  /** The layer the stroke was recorded against. */
  layerId: number;
  /** pixel index -> [before, after] packed as 0xRRGGBBAA */
  patches: Map<number, [number, number]>;
}
interface SnapshotStep {
  kind: 'snapshot';
  before: LayerState;
  after: LayerState;
}
type Step = DiffStep | SnapshotStep;

const pack = (r: number, g: number, b: number, a: number): number => ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

function put(px: Pixels, index: number, packed: number): void {
  const i = index * 4;
  px.data[i] = packed >>> 24;
  px.data[i + 1] = (packed >>> 16) & 255;
  px.data[i + 2] = (packed >>> 8) & 255;
  px.data[i + 3] = packed & 255;
}

/**
 * Undo/redo for a stack of layers. Ordinary edits are sparse pixel diffs of one layer, recorded between
 * `beginStroke` and `endStroke`; edits that change the size or the layer structure are snapshots of the
 * whole layer state. A stroke that ends up changing nothing adds no step.
 */
export class History {
  private steps: Step[] = [];
  /** Number of steps currently applied. */
  private pos = 0;
  /** `pos` at the last save, or -1 when that state is no longer reachable. */
  private savedPos = 0;
  private stroke: Map<number, [number, number]> | null = null;
  private strokeLayer: Layer | null = null;

  constructor(private readonly holder: ImageHolder) {}

  get canUndo(): boolean {
    return this.pos > 0;
  }
  get canRedo(): boolean {
    return this.pos < this.steps.length;
  }
  get isDirty(): boolean {
    return this.pos !== this.savedPos;
  }
  get strokeOpen(): boolean {
    return this.stroke !== null;
  }

  markSaved(): void {
    this.savedPos = this.pos;
  }

  /** Forgets all steps; the current image becomes the saved state. */
  clear(): void {
    this.steps = [];
    this.pos = 0;
    this.savedPos = 0;
    this.stroke = null;
    this.strokeLayer = null;
  }

  /** Opens a stroke against the layer that is active now. */
  beginStroke(): void {
    if (this.stroke) throw new Error('A stroke is already open');
    this.stroke = new Map();
    this.strokeLayer = this.holder.layers[this.holder.activeIndex];
  }

  /** Sets one pixel (by pixel index) inside the open stroke. */
  write(index: number, c: Rgba): void {
    if (!this.stroke) throw new Error('No open stroke');
    const px = this.strokeLayer!.px;
    const i = index * 4;
    let patch = this.stroke.get(index);
    if (!patch) {
      const cur = pack(px.data[i], px.data[i + 1], px.data[i + 2], px.data[i + 3]);
      patch = [cur, cur];
      this.stroke.set(index, patch);
    }
    patch[1] = pack(c[0], c[1], c[2], c[3]);
    put(px, index, patch[1]);
  }

  /** Closes the stroke; returns whether it changed anything (and so became a step). */
  endStroke(): boolean {
    const stroke = this.stroke;
    const layer = this.strokeLayer;
    this.stroke = null;
    this.strokeLayer = null;
    if (!stroke || !layer) return false;
    for (const [index, [before, after]] of stroke) if (before === after) stroke.delete(index);
    if (!stroke.size) return false;
    this.push({ kind: 'diff', layerId: layer.id, patches: stroke });
    return true;
  }

  /** Closes the stroke and restores every pixel it touched. */
  abortStroke(): void {
    const stroke = this.stroke;
    const layer = this.strokeLayer;
    this.stroke = null;
    this.strokeLayer = null;
    if (stroke && layer) for (const [index, [before]] of stroke) put(layer.px, index, before);
  }

  /**
   * Replaces the layer state with `after` as one step. Given plain pixels, only the active layer's
   * pixels are replaced (a single layer changing size).
   */
  snapshot(after: Pixels | LayerState): void {
    if (this.stroke) throw new Error('A stroke is open');
    const next: LayerState =
      'layers' in after
        ? after
        : {
            layers: this.holder.layers.map((l, i) => (i === this.holder.activeIndex ? { ...l, px: after } : l)),
            activeIndex: this.holder.activeIndex,
          };
    this.push({ kind: 'snapshot', before: this.capture(), after: next });
    this.restore(next);
  }

  undo(): boolean {
    if (this.stroke || !this.canUndo) return false;
    const step = this.steps[--this.pos];
    if (step.kind === 'snapshot') this.restore(step.before);
    else this.applyDiff(step, 0);
    return true;
  }

  redo(): boolean {
    if (this.stroke || !this.canRedo) return false;
    const step = this.steps[this.pos++];
    if (step.kind === 'snapshot') this.restore(step.after);
    else this.applyDiff(step, 1);
    return true;
  }

  private capture(): LayerState {
    return { layers: this.holder.layers.slice(), activeIndex: this.holder.activeIndex };
  }

  /**
   * Makes `state` current. Visibility is not part of history, so layers that still exist keep the
   * visibility they have now rather than the one stored in the snapshot.
   */
  private restore(state: LayerState): void {
    const current = new Map(this.holder.layers.map((l) => [l.id, l.visible]));
    for (const l of state.layers) {
      const visible = current.get(l.id);
      if (visible !== undefined) l.visible = visible;
    }
    this.holder.layers = state.layers.slice();
    this.holder.activeIndex = state.activeIndex;
  }

  /** Writes the before (0) or after (1) side of a diff into its layer and makes that layer active. */
  private applyDiff(step: DiffStep, side: 0 | 1): void {
    const i = this.holder.layers.findIndex((l) => l.id === step.layerId);
    if (i < 0) return;
    this.holder.activeIndex = i;
    const px = this.holder.layers[i].px;
    for (const [index, patch] of step.patches) put(px, index, patch[side]);
  }

  private push(step: Step): void {
    this.steps.length = this.pos;
    if (this.savedPos > this.pos) this.savedPos = -1;
    this.steps.push(step);
    this.pos++;
  }
}

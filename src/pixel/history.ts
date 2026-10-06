import type { Pixels } from '../model/pngCodec';
import type { Rgba } from './ops';

/** The image the history edits. Size-changing steps swap `px` for another buffer. */
export interface ImageHolder {
  px: Pixels;
}

interface DiffStep {
  kind: 'diff';
  /** pixel index -> [before, after] packed as 0xRRGGBBAA */
  patches: Map<number, [number, number]>;
}
interface SnapshotStep {
  kind: 'snapshot';
  before: Pixels;
  after: Pixels;
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
 * Undo/redo for one image. Ordinary edits are sparse pixel diffs recorded between `beginStroke` and
 * `endStroke`; edits that change the size are whole-image snapshots. A stroke that ends up changing
 * nothing adds no step.
 */
export class History {
  private steps: Step[] = [];
  /** Number of steps currently applied. */
  private pos = 0;
  /** `pos` at the last save, or -1 when that state is no longer reachable. */
  private savedPos = 0;
  private stroke: Map<number, [number, number]> | null = null;

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
  }

  beginStroke(): void {
    if (this.stroke) throw new Error('A stroke is already open');
    this.stroke = new Map();
  }

  /** Sets one pixel (by pixel index) inside the open stroke. */
  write(index: number, c: Rgba): void {
    if (!this.stroke) throw new Error('No open stroke');
    const px = this.holder.px;
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
    this.stroke = null;
    if (!stroke) return false;
    for (const [index, [before, after]] of stroke) if (before === after) stroke.delete(index);
    if (!stroke.size) return false;
    this.push({ kind: 'diff', patches: stroke });
    return true;
  }

  /** Closes the stroke and restores every pixel it touched. */
  abortStroke(): void {
    const stroke = this.stroke;
    this.stroke = null;
    if (stroke) for (const [index, [before]] of stroke) put(this.holder.px, index, before);
  }

  /** Replaces the image with `after` as one step (used when the size changes). */
  snapshot(after: Pixels): void {
    if (this.stroke) throw new Error('A stroke is open');
    this.push({ kind: 'snapshot', before: this.holder.px, after });
    this.holder.px = after;
  }

  undo(): boolean {
    if (this.stroke || !this.canUndo) return false;
    const step = this.steps[--this.pos];
    if (step.kind === 'snapshot') this.holder.px = step.before;
    else for (const [index, [before]] of step.patches) put(this.holder.px, index, before);
    return true;
  }

  redo(): boolean {
    if (this.stroke || !this.canRedo) return false;
    const step = this.steps[this.pos++];
    if (step.kind === 'snapshot') this.holder.px = step.after;
    else for (const [index, [, after]] of step.patches) put(this.holder.px, index, after);
    return true;
  }

  private push(step: Step): void {
    this.steps.length = this.pos;
    if (this.savedPos > this.pos) this.savedPos = -1;
    this.steps.push(step);
    this.pos++;
  }
}

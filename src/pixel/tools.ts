import type { ColorState } from './colors';
import { TRANSPARENT, type PixelDocument } from './document';
import { constrainLine, constrainSquare, getPixel, inBounds, line, rectFill, rectOutline, type Point, type Rgba } from './ops';
import type { PixelPointerHandlers, PixelPreview } from './view';

export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill' | 'line' | 'rect' | 'select';

/** The part of the view the tools need. */
export interface ToolView {
  preview: PixelPreview | null;
  redraw(): void;
}

/** What a tool reads from a pointer event. */
export interface ToolEvent {
  button: number;
  shiftKey: boolean;
  altKey: boolean;
}

/** Colour shown for an erase preview, since transparent cannot be seen. */
const ERASE_PREVIEW: Rgba = [255, 90, 90, 80];

type Drag =
  | { kind: 'stroke'; color: Rgba; last: Point }
  | { kind: 'shape'; shape: 'line' | 'rect'; color: Rgba; erase: boolean; start: Point; end: Point };

/** Turns pointer input into document edits for the drawing tools. */
export class ToolController implements PixelPointerHandlers {
  tool: Tool = 'pencil';
  /** Rectangle tool: filled rather than outline. */
  filled = false;
  private drag: Drag | null = null;

  constructor(
    private doc: PixelDocument,
    private view: ToolView,
    private colors: ColorState,
    /** Called after the current colour or the recent list changed. */
    private onColor: () => void = () => {},
  ) {}

  get active(): boolean {
    return this.drag !== null;
  }

  down(p: Point, e: ToolEvent): void {
    if (this.drag || this.tool === 'select') return;
    const right = e.button === 2;
    if (e.button !== 0 && !right) return;

    const picks = this.tool === 'eyedropper' || (e.altKey && !right && this.tool !== 'eraser');
    if (picks) {
      if (!right) this.pick(p);
      return;
    }

    const erase = right || this.tool === 'eraser';
    const color = erase ? TRANSPARENT : this.colors.color;
    switch (this.tool) {
      case 'pencil':
      case 'eraser':
        this.doc.beginStroke();
        this.doc.paint([p], color);
        this.drag = { kind: 'stroke', color, last: p };
        this.used(erase);
        break;
      case 'fill':
        this.doc.fill(p.x, p.y, color);
        this.used(erase);
        break;
      case 'line':
      case 'rect':
        this.drag = { kind: 'shape', shape: this.tool, color, erase, start: p, end: p };
        this.showPreview();
        this.used(erase);
        break;
    }
    this.view.redraw();
  }

  move(p: Point, e: ToolEvent): void {
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'stroke') {
      // Fill in every pixel between samples so fast drags leave no gaps.
      this.doc.paint(line(d.last.x, d.last.y, p.x, p.y), d.color);
      d.last = p;
      return;
    }
    d.end = this.constrained(d, p, e.shiftKey);
    this.showPreview();
  }

  up(): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'stroke') {
      this.doc.endStroke();
      return;
    }
    const points = this.shapePoints(d);
    this.view.preview = null;
    this.doc.commitShape(points, d.color);
    this.view.redraw();
  }

  /** Esc: abandons a shape being dragged. Returns true when there was one. */
  cancelDrag(): boolean {
    const d = this.drag;
    if (d?.kind !== 'shape') return false;
    this.drag = null;
    this.view.preview = null;
    this.view.redraw();
    return true;
  }

  private pick(p: Point): void {
    if (!inBounds(this.doc.px, p.x, p.y)) return;
    this.colors.setColor(getPixel(this.doc.px, p.x, p.y));
    this.onColor();
  }

  private used(erase: boolean): void {
    if (erase) return;
    this.colors.markUsed();
    this.onColor();
  }

  private constrained(d: Extract<Drag, { kind: 'shape' }>, p: Point, shift: boolean): Point {
    if (!shift) return p;
    return d.shape === 'line' ? constrainLine(d.start.x, d.start.y, p.x, p.y) : constrainSquare(d.start.x, d.start.y, p.x, p.y);
  }

  private shapePoints(d: Extract<Drag, { kind: 'shape' }>): Point[] {
    const { start, end } = d;
    if (d.shape === 'line') return line(start.x, start.y, end.x, end.y);
    const make = this.filled ? rectFill : rectOutline;
    return make(start.x, start.y, end.x, end.y, this.doc.px);
  }

  private showPreview(): void {
    const d = this.drag;
    if (d?.kind !== 'shape') return;
    this.view.preview = { points: this.shapePoints(d), color: d.erase ? ERASE_PREVIEW : d.color };
    this.view.redraw();
  }
}

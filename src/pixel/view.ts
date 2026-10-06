import type { PixelDocument } from './document';
import type { Point, Rgba } from './ops';
import { Viewport } from './viewport';

export interface PixelPointerHandlers {
  /** A press that is not a pan. Read `e.button`, `e.shiftKey` and `e.altKey`. `p` may be outside the image. */
  down(p: Point, e: PointerEvent): void;
  move(p: Point, e: PointerEvent): void;
  up(e: PointerEvent): void;
}

/** Shape pixels drawn translucent over the image before they are committed. */
export interface PixelPreview {
  points: Iterable<Point>;
  color: Rgba;
}

const CHECK = 8;
const isTyping = (t: EventTarget | null): boolean => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

/** Canvas view of a PixelDocument: crisp pixels over a checkerboard, zoom, pan, grid and overlays. */
export class PixelView {
  readonly viewport = new Viewport();
  showGrid = true;
  handlers: PixelPointerHandlers | null = null;
  preview: PixelPreview | null = null;
  /** Image pixel under the pointer, or null when it is not over the image. */
  hover: Point | null = null;
  /** Called when `hover` changes. */
  onHover: (p: Point | null) => void = () => {};

  private ctx: CanvasRenderingContext2D;
  private layer = document.createElement('canvas');
  private floatLayer = document.createElement('canvas');
  private imageDirty = true;
  private floatSource: unknown = null;
  private queued = false;
  private fitPending = true;
  private spaceHeld = false;
  private panning = false;
  private tooling = false;
  private lastX = 0;
  private lastY = 0;
  private cssW = 0;
  private cssH = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private doc: PixelDocument,
  ) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointerleave', () => this.setHover(null));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** The image content changed (call after any edit, load or undo). */
  invalidate(): void {
    this.imageDirty = true;
    this.redraw();
  }

  /** Scales and centres the whole image in the view. */
  fit(): void {
    if (!this.cssW || !this.cssH) {
      this.fitPending = true; // laid out later
      return;
    }
    this.viewport.fit(this.doc.width, this.doc.height, this.cssW, this.cssH);
    this.fitPending = false;
    this.redraw();
  }

  get isPanning(): boolean {
    return this.panning;
  }

  /** Pixel at a pointer event, in image coordinates (may be outside the image). */
  pointAt(e: { clientX: number; clientY: number }): Point {
    const r = this.canvas.getBoundingClientRect();
    return this.viewport.toImage(e.clientX - r.left, e.clientY - r.top);
  }

  redraw(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.draw();
    });
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (this.fitPending && rect.width && rect.height) this.fit();
    else this.redraw();
  }

  // ---- Input ----

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.code !== 'Space' || isTyping(e.target)) return;
    this.spaceHeld = down;
    this.canvas.style.cursor = down ? 'grab' : '';
    if (down && (e.target === document.body || e.target === this.canvas)) e.preventDefault();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    this.viewport.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    this.updateHover(e);
    this.redraw();
  }

  private onPointerDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
      e.preventDefault();
      this.panning = true;
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    this.tooling = true;
    this.handlers?.down(this.pointAt(e), e);
  }

  private onPointerMove(e: PointerEvent): void {
    this.updateHover(e);
    if (this.panning) {
      this.viewport.panBy(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.redraw();
      return;
    }
    if (this.tooling) this.handlers?.move(this.pointAt(e), e);
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.panning) {
      this.panning = false;
      this.canvas.style.cursor = this.spaceHeld ? 'grab' : '';
    } else if (this.tooling) {
      this.tooling = false;
      this.handlers?.up(e);
    }
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
  }

  private updateHover(e: PointerEvent | WheelEvent): void {
    const p = this.pointAt(e);
    const inside = p.x >= 0 && p.y >= 0 && p.x < this.doc.width && p.y < this.doc.height;
    this.setHover(inside ? p : null);
  }

  private setHover(p: Point | null): void {
    if (p?.x === this.hover?.x && p?.y === this.hover?.y) return;
    this.hover = p;
    this.onHover(p);
    this.redraw();
  }

  // ---- Drawing ----

  private uploadLayers(): void {
    const { px, floating } = this.doc;
    if (this.imageDirty || this.layer.width !== px.width || this.layer.height !== px.height) {
      this.layer.width = px.width;
      this.layer.height = px.height;
      this.layer.getContext('2d')!.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), 0, 0);
      this.imageDirty = false;
    }
    if (floating && this.floatSource !== floating.pixels) {
      const f = floating.pixels;
      this.floatLayer.width = f.width;
      this.floatLayer.height = f.height;
      this.floatLayer.getContext('2d')!.putImageData(new ImageData(f.data as Uint8ClampedArray<ArrayBuffer>, f.width, f.height), 0, 0);
    }
    this.floatSource = floating ? floating.pixels : null;
  }

  private draw(): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const { scale, ox, oy } = this.viewport;
    const w = this.doc.width;
    const h = this.doc.height;
    this.uploadLayers();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#16161c';
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    // Only the visible part of the image needs a checkerboard.
    const x0 = Math.max(0, ox);
    const y0 = Math.max(0, oy);
    const x1 = Math.min(this.cssW, ox + w * scale);
    const y1 = Math.min(this.cssH, oy + h * scale);
    if (x1 > x0 && y1 > y0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = '#c9c9d1';
      for (let y = Math.floor((y0 - oy) / CHECK); oy + y * CHECK < y1; y++) {
        for (let x = Math.floor((x0 - ox) / CHECK); ox + x * CHECK < x1; x++) {
          if ((x + y) & 1) continue;
          const cx = Math.max(x0, ox + x * CHECK);
          const cy = Math.max(y0, oy + y * CHECK);
          ctx.fillRect(cx, cy, Math.min(x1, ox + (x + 1) * CHECK) - cx, Math.min(y1, oy + (y + 1) * CHECK) - cy);
        }
      }
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.layer, ox, oy, w * scale, h * scale);

    const floating = this.doc.floating;
    if (floating) {
      const r = floating.rect;
      ctx.drawImage(this.floatLayer, ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale);
    }

    if (this.preview) {
      const [r, g, b, a] = this.preview.color;
      ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
      const s = Math.max(scale, 1);
      for (const p of this.preview.points) {
        if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) ctx.fillRect(ox + p.x * scale, oy + p.y * scale, s, s);
      }
    }

    if (this.showGrid && this.viewport.gridVisible) {
      ctx.strokeStyle = 'rgba(128,128,140,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < w; x++) {
        const sx = Math.round(ox + x * scale) + 0.5;
        if (sx < 0 || sx > this.cssW) continue;
        ctx.moveTo(sx, y0);
        ctx.lineTo(sx, y1);
      }
      for (let y = 1; y < h; y++) {
        const sy = Math.round(oy + y * scale) + 0.5;
        if (sy < 0 || sy > this.cssH) continue;
        ctx.moveTo(x0, sy);
        ctx.lineTo(x1, sy);
      }
      ctx.stroke();
    }

    // The boundary is always outlined.
    ctx.strokeStyle = '#8a8af0';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(ox) - 0.5, Math.round(oy) - 0.5, Math.round(w * scale) + 1, Math.round(h * scale) + 1);

    const sel = this.doc.selection;
    if (sel) {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      const rx = Math.round(ox + sel.x * scale) + 0.5;
      const ry = Math.round(oy + sel.y * scale) + 0.5;
      const rw = Math.round(sel.w * scale);
      const rh = Math.round(sel.h * scale);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.lineDashOffset = 4;
      ctx.strokeStyle = '#ffd84a';
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    if (this.hover && !this.panning && scale >= 3) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(ox + this.hover.x * scale) + 0.5, Math.round(oy + this.hover.y * scale) + 0.5, Math.round(scale) - 1, Math.round(scale) - 1);
    }
  }
}

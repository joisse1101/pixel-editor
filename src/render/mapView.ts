import { getMapBounds } from '../model/office';
import { parseCellKey, type PlacedTile, type Project } from '../model/types';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;

/** Draws one placed tile with its cell's top-left at (0,0). Flip is applied before rotation. */
export function drawTile(ctx: CanvasRenderingContext2D, project: Project, tile: PlacedTile): void {
  const sheet = project.sheets.find((s) => s.id === tile.sheetId);
  if (!sheet?.bitmap) return;
  const ts = project.tileSize;
  const cols = Math.floor(sheet.width / ts);
  const index = Number(tile.id);
  const sx = (index % cols) * ts;
  const sy = Math.floor(index / cols) * ts;
  ctx.save();
  ctx.translate(ts / 2, ts / 2);
  ctx.rotate((tile.rotation * Math.PI) / 180);
  ctx.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1);
  ctx.drawImage(sheet.bitmap, sx, sy, ts, ts, -ts / 2, -ts / 2, ts, ts);
  ctx.restore();
}

/** Canvas view of the map with zoom, pan and optional grid lines. */
export class MapView {
  project: Project | null = null;
  showGrid = true;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  setProject(project: Project | null): void {
    this.project = project;
    this.fit();
  }

  /** Zooms so the whole map fits, centred. */
  fit(): void {
    if (!this.project) return this.draw();
    const b = getMapBounds(this.project);
    const ts = this.project.tileSize;
    const w = Math.max(1, b.width * ts);
    const h = Math.max(1, b.height * ts);
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(cw / w, ch / h) * 0.95));
    this.panX = (cw - w * this.zoom) / 2;
    this.panY = (ch - h * this.zoom) / 2;
    this.draw();
  }

  zoomLabel(): string {
    return `${Math.round(this.zoom * 100)}%`;
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    this.draw();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * Math.exp(-e.deltaY * 0.0015)));
    // Keep the point under the cursor fixed.
    this.panX = px - ((px - this.panX) / this.zoom) * next;
    this.panY = py - ((py - this.panY) / this.zoom) * next;
    this.zoom = next;
    this.draw();
    this.canvas.dispatchEvent(new CustomEvent('viewchange'));
  }

  private onPointerDown(e: PointerEvent): void {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.panX += e.clientX - this.lastX;
    this.panY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.draw();
  }

  private onPointerUp(e: PointerEvent): void {
    this.dragging = false;
    this.canvas.releasePointerCapture(e.pointerId);
  }

  draw(): void {
    const ctx = this.canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const project = this.project;
    if (!project) return;

    const ts = project.tileSize;
    const b = getMapBounds(project);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);

    // Map background and clip: only the map rectangle is part of the exported map.
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, 0, b.width * ts, b.height * ts);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, b.width * ts, b.height * ts);
    ctx.clip();

    // Last layer in the file is the bottom, so draw from the end.
    for (let i = project.layers.length - 1; i >= 0; i--) {
      for (const [key, tile] of project.layers[i].cells) {
        const [cx, cy] = parseCellKey(key);
        ctx.save();
        ctx.translate((cx - b.x) * ts, (cy - b.y) * ts);
        drawTile(ctx, project, tile);
        ctx.restore();
      }
    }
    ctx.restore();

    if (this.showGrid) {
      ctx.lineWidth = 1 / (dpr * this.zoom);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      for (let x = 0; x <= b.width; x++) {
        ctx.moveTo(x * ts, 0);
        ctx.lineTo(x * ts, b.height * ts);
      }
      for (let y = 0; y <= b.height; y++) {
        ctx.moveTo(0, y * ts);
        ctx.lineTo(b.width * ts, y * ts);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2 / (dpr * this.zoom);
    ctx.strokeRect(0, 0, b.width * ts, b.height * ts);
  }
}

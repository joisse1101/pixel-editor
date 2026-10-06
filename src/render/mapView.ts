import { SHEET_COLUMNS, type Bake } from '../model/bake';
import { getMapBounds, type MapBounds } from '../model/office';
import { parseCellKey, type PlacedTile, type Project } from '../model/types';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;
/** Keeps pan far from float precision trouble while still allowing very distant cells. */
const MAX_PAN = 1e7;
const clampPan = (v: number): number => Math.min(MAX_PAN, Math.max(-MAX_PAN, v));

/** The baked export drawn in preview mode. */
interface Preview {
  bake: Bake;
  bounds: MapBounds;
  sheet: HTMLCanvasElement;
}

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

export interface PointerHandlers {
  /** Cell is in absolute coordinates; the grid is infinite so it is only null when no project is loaded. */
  down(cell: [number, number] | null, e: PointerEvent): void;
  move(cell: [number, number] | null, e: PointerEvent): void;
  up(e: PointerEvent): void;
}

/** Canvas view of the map with zoom, pan and optional grid lines. */
export class MapView {
  project: Project | null = null;
  showGrid = true;
  /** Cell under the pointer, shown with a ghost of the brush tile when set. */
  hoverCell: [number, number] | null = null;
  ghost: PlacedTile | null = null;
  selectedCell: [number, number] | null = null;
  handlers: PointerHandlers | null = null;
  spaceHeld = false;
  private preview: Preview | null = null;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private panning = false;
  private tooling = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointerleave', () => {
      if (this.hoverCell) {
        this.hoverCell = null;
        this.draw();
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  setProject(project: Project | null): void {
    this.project = project;
    this.preview = null;
    this.hoverCell = null;
    this.selectedCell = null;
    this.fit();
  }

  get previewing(): boolean {
    return this.preview !== null;
  }

  /** Shows the baked export (no grid, white outline of the exported extent), or returns to editing with null. */
  setPreview(bake: Bake | null): void {
    const bounds = bake && this.project ? getMapBounds(this.project) : null;
    if (!bake || !bounds) {
      this.preview = null;
    } else {
      const sheet = document.createElement('canvas');
      sheet.width = bake.sheet.width;
      sheet.height = bake.sheet.height;
      sheet.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(bake.sheet.data), bake.sheet.width, bake.sheet.height), 0, 0);
      this.preview = { bake, bounds, sheet };
      this.hoverCell = null;
    }
    this.draw();
  }

  /** Zooms to the content box, centred; with no tiles resets to a default view with cell (0,0) at the centre. */
  fit(): void {
    if (!this.project) return this.draw();
    const b = getMapBounds(this.project);
    const ts = this.project.tileSize;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!b) {
      this.zoom = 1;
      this.panX = cw / 2;
      this.panY = ch / 2;
    } else {
      const w = b.width * ts;
      const h = b.height * ts;
      this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(cw / w, ch / h) * 0.95));
      this.panX = clampPan((cw - w * this.zoom) / 2 - b.x * ts * this.zoom);
      this.panY = clampPan((ch - h * this.zoom) / 2 - b.y * ts * this.zoom);
    }
    this.draw();
  }

  zoomLabel(): string {
    return `${Math.round(this.zoom * 100)}%`;
  }

  /** Absolute cell under a client position; any cell of the infinite grid, including negative ones. */
  cellAt(clientX: number, clientY: number): [number, number] | null {
    if (!this.project) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ts = this.project.tileSize;
    return [
      Math.floor((clientX - rect.left - this.panX) / this.zoom / ts),
      Math.floor((clientY - rect.top - this.panY) / this.zoom / ts),
    ];
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
    this.panX = clampPan(px - ((px - this.panX) / this.zoom) * next);
    this.panY = clampPan(py - ((py - this.panY) / this.zoom) * next);
    this.zoom = next;
    this.draw();
    this.canvas.dispatchEvent(new CustomEvent('viewchange'));
  }

  private onPointerDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    // Middle/right button, or Space + left button, pans; plain left button goes to the tool.
    if (e.button === 1 || e.button === 2 || this.spaceHeld) {
      this.panning = true;
      return;
    }
    if (e.button === 0 && this.handlers && !this.preview) {
      this.tooling = true;
      this.handlers.down(this.cellAt(e.clientX, e.clientY), e);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.panning) {
      this.panX = clampPan(this.panX + e.clientX - this.lastX);
      this.panY = clampPan(this.panY + e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.draw();
      return;
    }
    const cell = this.preview ? null : this.cellAt(e.clientX, e.clientY);
    this.hoverCell = cell;
    if (!this.preview) this.handlers?.move(cell, e);
    this.draw();
    this.canvas.dispatchEvent(new CustomEvent('hovercell', { detail: cell }));
  }

  private onPointerUp(e: PointerEvent): void {
    this.panning = false;
    if (this.tooling) {
      this.tooling = false;
      this.handlers?.up(e);
    }
    this.canvas.releasePointerCapture(e.pointerId);
  }

  draw(): void {
    const ctx = this.canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const project = this.project;
    if (!project) return;

    const ts = project.tileSize;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);
    if (this.preview) return this.drawPreview(ctx, this.preview, ts, dpr);

    // Visible cell range, padded by one so partly visible cells are drawn.
    const x0 = Math.floor(-this.panX / this.zoom / ts) - 1;
    const y0 = Math.floor(-this.panY / this.zoom / ts) - 1;
    const x1 = Math.ceil((this.canvas.clientWidth - this.panX) / this.zoom / ts) + 1;
    const y1 = Math.ceil((this.canvas.clientHeight - this.panY) / this.zoom / ts) + 1;

    // Last layer in the file is the bottom, so draw from the end.
    for (let i = project.layers.length - 1; i >= 0; i--) {
      if (!project.layers[i].visible) continue;
      for (const [key, tile] of project.layers[i].cells) {
        const [cx, cy] = parseCellKey(key);
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
        ctx.save();
        ctx.translate(cx * ts, cy * ts);
        drawTile(ctx, project, tile);
        ctx.restore();
      }
    }
    if (this.hoverCell && this.ghost) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.translate(this.hoverCell[0] * ts, this.hoverCell[1] * ts);
      drawTile(ctx, project, this.ghost);
      ctx.restore();
    }

    if (this.showGrid) {
      ctx.lineWidth = 1 / (dpr * this.zoom);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) {
        ctx.moveTo(x * ts, y0 * ts);
        ctx.lineTo(x * ts, y1 * ts);
      }
      for (let y = y0; y <= y1; y++) {
        ctx.moveTo(x0 * ts, y * ts);
        ctx.lineTo(x1 * ts, y * ts);
      }
      ctx.stroke();
    }

    const outline = (cell: [number, number], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / (dpr * this.zoom);
      ctx.strokeRect(cell[0] * ts, cell[1] * ts, ts, ts);
    };
    if (this.hoverCell) outline(this.hoverCell, 'rgba(255,255,255,0.9)');
    if (this.selectedCell) outline(this.selectedCell, '#ffd54a');
  }

  /** Draws the baked layers bottom to top from the packed spritesheet, with a white box around the exported extent. */
  private drawPreview(ctx: CanvasRenderingContext2D, p: Preview, ts: number, dpr: number): void {
    for (const layer of p.bake.map.layers) {
      layer.data.forEach((gid, i) => {
        if (!gid) return;
        const index = gid - 1;
        ctx.drawImage(
          p.sheet,
          (index % SHEET_COLUMNS) * ts,
          Math.floor(index / SHEET_COLUMNS) * ts,
          ts,
          ts,
          (p.bounds.x + (i % layer.width)) * ts,
          (p.bounds.y + Math.floor(i / layer.width)) * ts,
          ts,
          ts,
        );
      });
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / (dpr * this.zoom);
    ctx.strokeRect(p.bounds.x * ts, p.bounds.y * ts, p.bounds.width * ts, p.bounds.height * ts);
  }
}

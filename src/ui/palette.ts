import { sheetLabel } from '../model/office';
import type { Project } from '../model/types';

/** A block of tiles picked from one sheet; `id` is the top-left tile's id. */
export interface PaletteSelection {
  sheetId: string;
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
}

const VIEW = 320;
/** Zoom steps; below 1x the sheet is drawn smaller than its pixels, still without smoothing. */
const ZOOMS = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
const MIN_ZOOM = ZOOMS[0];
const MAX_ZOOM = ZOOMS[ZOOMS.length - 1];
const DRAG_SLOP = 3;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Shows the selected sprite sheet in a fixed-size, pannable and zoomable viewport and reports
 * the picked block of tiles. Left drag selects a block (a click is one tile); middle drag,
 * Space + left drag and the wheel pan. The right button does nothing.
 */
export class Palette {
  private project: Project | null = null;
  private sheetIndex = 0;
  private selected: PaletteSelection | null = null;
  private zooms = new Map<string, number>();
  private panX = 0;
  private panY = 0;
  private panSheetId: string | null = null;
  private spaceHeld = false;
  private drag: { x: number; y: number; moved: boolean; panning: boolean; start: [number, number] | null; end: [number, number] | null } | null = null;
  private select = document.createElement('select');
  private gear = document.createElement('button');
  private zoomOut = document.createElement('button');
  private zoomIn = document.createElement('button');
  private zoomLabel = document.createElement('span');
  private canvas = document.createElement('canvas');

  /** Called when the gear button is pressed; only possible while exactly one tile is selected. */
  onConfigure: (s: PaletteSelection) => void = () => {};

  constructor(
    container: HTMLElement,
    private onSelect: (s: PaletteSelection) => void,
  ) {
    const top = document.createElement('div');
    top.className = 'palette-top';
    this.gear.type = 'button';
    this.gear.className = 'icon gear';
    this.gear.textContent = '⚙';
    this.gear.title = 'Edit tile attributes (select a single tile first)';
    top.append(this.select, this.gear);

    const bar = document.createElement('div');
    bar.className = 'palette-zoom';
    for (const [b, text, title] of [
      [this.zoomOut, '−', 'Zoom out (Ctrl + wheel)'],
      [this.zoomIn, '+', 'Zoom in (Ctrl + wheel)'],
    ] as const) {
      b.type = 'button';
      b.className = 'icon';
      b.textContent = text;
      b.title = title;
    }
    bar.append(this.zoomOut, this.zoomLabel, this.zoomIn);

    const viewport = document.createElement('div');
    viewport.className = 'palette-viewport';
    this.canvas.width = VIEW;
    this.canvas.height = VIEW;
    viewport.append(this.canvas);
    container.append(top, bar, viewport);

    this.select.addEventListener('change', () => {
      this.sheetIndex = Number(this.select.value);
      this.select.blur();
      this.render();
    });
    this.gear.addEventListener('click', () => {
      if (this.selected) this.onConfigure(this.selected);
    });
    this.zoomOut.addEventListener('click', () => this.zoomBy(-1, VIEW / 2, VIEW / 2));
    this.zoomIn.addEventListener('click', () => this.zoomBy(1, VIEW / 2, VIEW / 2));

    this.canvas.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') this.spaceHeld = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceHeld = false;
    });
    this.render();
  }

  setProject(project: Project): void {
    this.project = project;
    this.sheetIndex = 0;
    this.selected = null;
    this.zooms.clear();
    this.rebuild();
  }

  /** Re-reads the sheet list after sheets were added, removed, moved or renamed, showing the sheet at `index`. */
  reload(index: number): void {
    if (!this.project) return;
    this.sheetIndex = Math.max(0, Math.min(index, this.project.sheets.length - 1));
    if (this.selected && !this.project.sheets.some((s) => s.id === this.selected!.sheetId)) this.selected = null;
    this.rebuild();
  }

  currentSheetId(): string | null {
    return this.project?.sheets[this.sheetIndex]?.id ?? null;
  }

  currentIndex(): number {
    return this.sheetIndex;
  }

  private rebuild(): void {
    const project = this.project!;
    this.select.replaceChildren(
      ...project.sheets.map((_, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = sheetLabel(project, i);
        return o;
      }),
    );
    this.select.value = String(this.sheetIndex);
    this.render();
  }

  /** Highlights a tile (switching sheet if needed) without firing onSelect. */
  setSelected(sel: PaletteSelection | null): void {
    this.selected = sel;
    if (sel && this.project) {
      const i = this.project.sheets.findIndex((s) => s.id === sel.sheetId);
      if (i >= 0) {
        this.sheetIndex = i;
        this.select.value = String(i);
      }
    }
    this.render();
  }

  private sheet() {
    return this.project?.sheets[this.sheetIndex];
  }

  /** The per-sheet zoom step, or the whole-number width fit (at least 1x) by default. */
  private scale(): number {
    const sheet = this.sheet();
    if (!sheet) return 1;
    return this.zooms.get(sheet.id) ?? clamp(Math.floor(VIEW / sheet.width), 1, MAX_ZOOM);
  }

  /** Keeps the sheet covering the viewport when larger than it, and pinned to the corner when smaller. */
  private clampPan(): void {
    const sheet = this.sheet();
    if (!sheet) return;
    const k = this.scale();
    this.panX = clamp(this.panX, Math.min(0, VIEW - sheet.width * k), 0);
    this.panY = clamp(this.panY, Math.min(0, VIEW - sheet.height * k), 0);
  }

  /** Canvas-space position of a mouse event, independent of CSS scaling. */
  private point(e: MouseEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * (VIEW / rect.width), (e.clientY - rect.top) * (VIEW / rect.height)];
  }

  private zoomBy(delta: number, cx: number, cy: number): void {
    const sheet = this.sheet();
    if (!sheet) return;
    const k = this.scale();
    const next = ZOOMS[clamp(ZOOMS.indexOf(k) + delta, 0, ZOOMS.length - 1)];
    if (next === k) return;
    // Keep the sheet point under (cx, cy) fixed.
    const sx = (cx - this.panX) / k;
    const sy = (cy - this.panY) / k;
    this.zooms.set(sheet.id, next);
    this.panX = cx - sx * next;
    this.panY = cy - sy * next;
    this.render();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.sheet()) return;
    if (e.ctrlKey) {
      const [cx, cy] = this.point(e);
      this.zoomBy(e.deltaY < 0 ? 1 : -1, cx, cy);
      return;
    }
    const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
    const dy = e.shiftKey ? 0 : e.deltaY;
    this.panX -= dx;
    this.panY -= dy;
    this.render();
  }

  private onDown(e: MouseEvent): void {
    const panning = e.button === 1 || (e.button === 0 && this.spaceHeld);
    if (!panning && e.button !== 0) return;
    if (panning) e.preventDefault();
    const start = panning ? null : this.tileAt(e, false);
    this.drag = { x: e.clientX, y: e.clientY, moved: false, panning, start, end: start };
  }

  private onMove(e: MouseEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) d.moved = true;
    if (!d.panning) {
      if (d.moved && d.start) {
        d.end = this.tileAt(e, true);
        this.render();
      }
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.panX += dx * (VIEW / rect.width);
    this.panY += dy * (VIEW / rect.height);
    d.x = e.clientX;
    d.y = e.clientY;
    this.render();
  }

  private onUp(e: MouseEvent): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.panning || e.button !== 0 || !d.start) {
      this.render();
      return;
    }
    // A press on a tile that ends over the canvas, or a drag that went anywhere, picks a block;
    // the sheet never moves. The drag end is clamped to the sheet, so leaving it ends on the last tile.
    if (d.moved || e.target === this.canvas) this.pick(d.start, d.moved ? this.tileAt(e, true) : d.start);
    else this.render();
  }

  /** Tile column and row under the pointer; null outside the sheet unless `clampToSheet`. */
  private tileAt(e: MouseEvent, clampToSheet: boolean): [number, number] | null {
    const project = this.project;
    const sheet = this.sheet();
    if (!project || !sheet) return null;
    const ts = project.tileSize * this.scale();
    const [px, py] = this.point(e);
    const col = Math.floor((px - this.panX) / ts);
    const row = Math.floor((py - this.panY) / ts);
    const cols = Math.floor(sheet.width / project.tileSize);
    const rows = Math.floor(sheet.height / project.tileSize);
    if (clampToSheet) return [clamp(col, 0, cols - 1), clamp(row, 0, rows - 1)];
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return [col, row];
  }

  private pick(a: [number, number] | null, b: [number, number] | null): void {
    const project = this.project;
    const sheet = this.sheet();
    if (!project || !sheet || !a || !b) return;
    const cols = Math.floor(sheet.width / project.tileSize);
    const col = Math.min(a[0], b[0]);
    const row = Math.min(a[1], b[1]);
    const sel: PaletteSelection = {
      sheetId: sheet.id,
      id: String(row * cols + col),
      col,
      row,
      w: Math.abs(a[0] - b[0]) + 1,
      h: Math.abs(a[1] - b[1]) + 1,
    };
    this.selected = sel;
    this.render();
    this.onSelect(sel);
  }

  render(): void {
    const project = this.project;
    const sheet = this.sheet();
    const ctx = this.canvas.getContext('2d')!;
    this.gear.disabled = !this.selected || this.selected.w !== 1 || this.selected.h !== 1;
    this.zoomOut.disabled = this.zoomIn.disabled = !sheet;
    ctx.clearRect(0, 0, VIEW, VIEW);
    if (!project || !sheet) {
      this.zoomLabel.textContent = '';
      return;
    }
    if (this.panSheetId !== sheet.id) {
      this.panSheetId = sheet.id;
      this.panX = 0;
      this.panY = 0;
    }
    this.clampPan();
    const k = this.scale();
    const ts = project.tileSize * k;
    const w = sheet.width * k;
    const h = sheet.height * k;
    this.zoomLabel.textContent = `${k}x`;
    this.zoomOut.disabled = k <= MIN_ZOOM;
    this.zoomIn.disabled = k >= MAX_ZOOM;
    if (!sheet.bitmap) return;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(this.panX, this.panY, w, h);
    ctx.drawImage(sheet.bitmap, this.panX, this.panY, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Grid lines would swallow the tiles when they are only a few pixels wide.
    const step = ts < 4 ? Infinity : ts;
    for (let x = 0; x <= w; x += step) {
      const cx = Math.floor(this.panX + x) + 0.5;
      if (cx < 0 || cx > VIEW) continue;
      ctx.moveTo(cx, Math.max(0, this.panY));
      ctx.lineTo(cx, Math.min(VIEW, this.panY + h));
    }
    for (let y = 0; y <= h; y += step) {
      const cy = Math.floor(this.panY + y) + 0.5;
      if (cy < 0 || cy > VIEW) continue;
      ctx.moveTo(Math.max(0, this.panX), cy);
      ctx.lineTo(Math.min(VIEW, this.panX + w), cy);
    }
    ctx.stroke();
    // The block being dragged, else the picked block.
    const d = this.drag;
    let hl: { col: number; row: number; w: number; h: number } | null = null;
    if (d && !d.panning && d.moved && d.start && d.end) {
      hl = {
        col: Math.min(d.start[0], d.end[0]),
        row: Math.min(d.start[1], d.end[1]),
        w: Math.abs(d.start[0] - d.end[0]) + 1,
        h: Math.abs(d.start[1] - d.end[1]) + 1,
      };
    } else if (this.selected && this.selected.sheetId === sheet.id) {
      hl = this.selected;
    }
    if (hl) {
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.panX + hl.col * ts + 1, this.panY + hl.row * ts + 1, hl.w * ts - 2, hl.h * ts - 2);
    }
  }
}

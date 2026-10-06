import type { Project } from '../model/types';

export interface PaletteSelection {
  sheetId: string;
  id: string;
}

/** Shows each sprite sheet as a grid of tiles and reports the clicked tile. */
export class Palette {
  private project: Project | null = null;
  private sheetIndex = 0;
  private selected: PaletteSelection | null = null;
  private select = document.createElement('select');
  private canvas = document.createElement('canvas');

  constructor(
    container: HTMLElement,
    private onSelect: (s: PaletteSelection) => void,
  ) {
    container.append(this.select, this.canvas);
    this.select.addEventListener('change', () => {
      this.sheetIndex = Number(this.select.value);
      this.select.blur();
      this.render();
    });
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  setProject(project: Project): void {
    this.project = project;
    this.sheetIndex = 0;
    this.selected = null;
    this.rebuild();
  }

  /** Re-reads the sheet list after sheets were added or removed, showing the sheet at `index`. */
  reload(index: number): void {
    if (!this.project) return;
    this.sheetIndex = Math.max(0, Math.min(index, this.project.sheets.length - 1));
    this.rebuild();
  }

  currentSheetId(): string | null {
    return this.project?.sheets[this.sheetIndex]?.id ?? null;
  }

  private rebuild(): void {
    const project = this.project!;
    this.select.replaceChildren(
      ...project.sheets.map((s, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = `Sheet ${i + 1} (${s.width / project.tileSize}x${s.height / project.tileSize})`;
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

  private scale(): number {
    const sheet = this.project?.sheets[this.sheetIndex];
    return sheet ? Math.max(1, Math.floor(320 / sheet.width)) : 1;
  }

  private onClick(e: MouseEvent): void {
    const project = this.project;
    const sheet = project?.sheets[this.sheetIndex];
    if (!project || !sheet) return;
    const rect = this.canvas.getBoundingClientRect();
    const ts = project.tileSize * this.scale();
    const col = Math.floor(((e.clientX - rect.left) * (this.canvas.width / rect.width)) / ts);
    const row = Math.floor(((e.clientY - rect.top) * (this.canvas.height / rect.height)) / ts);
    const cols = Math.floor(sheet.width / project.tileSize);
    const rows = Math.floor(sheet.height / project.tileSize);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    const sel = { sheetId: sheet.id, id: String(row * cols + col) };
    this.selected = sel;
    this.render();
    this.onSelect(sel);
  }

  render(): void {
    const project = this.project;
    const sheet = project?.sheets[this.sheetIndex];
    const ctx = this.canvas.getContext('2d')!;
    if (!project || !sheet?.bitmap) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const k = this.scale();
    const ts = project.tileSize * k;
    this.canvas.width = sheet.width * k;
    this.canvas.height = sheet.height * k;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(sheet.bitmap, 0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.canvas.width; x += ts) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= this.canvas.height; y += ts) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.canvas.width, y + 0.5);
    }
    ctx.stroke();
    if (this.selected && this.selected.sheetId === sheet.id) {
      const cols = Math.floor(sheet.width / project.tileSize);
      const i = Number(this.selected.id);
      ctx.strokeStyle = '#ffd54a';
      ctx.lineWidth = 2;
      ctx.strokeRect((i % cols) * ts + 1, Math.floor(i / cols) * ts + 1, ts - 2, ts - 2);
    }
  }
}

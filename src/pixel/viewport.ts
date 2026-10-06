import type { Point } from './ops';

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 128;
/** Screen pixels per image pixel below which grid lines would swamp the pixels. */
export const MIN_GRID_SCALE = 6;

/** Maps between screen (canvas CSS px) and image pixel coordinates. Pure, no DOM. */
export class Viewport {
  /** Screen pixels per image pixel. */
  scale = 1;
  /** Screen position of the image's top-left corner. */
  ox = 0;
  oy = 0;

  /** The image pixel under a screen point (may be outside the image). */
  toImage(sx: number, sy: number): Point {
    return { x: Math.floor((sx - this.ox) / this.scale), y: Math.floor((sy - this.oy) / this.scale) };
  }

  /** Screen position of an image pixel's top-left corner. */
  toScreen(x: number, y: number): Point {
    return { x: this.ox + x * this.scale, y: this.oy + y * this.scale };
  }

  panBy(dx: number, dy: number): void {
    this.ox += dx;
    this.oy += dy;
  }

  /** Multiplies the zoom by `factor` keeping the image point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    const k = next / this.scale;
    this.ox = sx - (sx - this.ox) * k;
    this.oy = sy - (sy - this.oy) * k;
    this.scale = next;
  }

  /** Scales (whole numbers when 1x or more, so pixels stay even) and centres the image in the view. */
  fit(imgW: number, imgH: number, viewW: number, viewH: number, margin = 24): void {
    const availW = Math.max(1, viewW - margin * 2);
    const availH = Math.max(1, viewH - margin * 2);
    let s = Math.min(availW / imgW, availH / imgH);
    s = s >= 1 ? Math.floor(s) : s;
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    this.ox = Math.round((viewW - imgW * this.scale) / 2);
    this.oy = Math.round((viewH - imgH * this.scale) / 2);
  }

  get gridVisible(): boolean {
    return this.scale >= MIN_GRID_SCALE;
  }
}

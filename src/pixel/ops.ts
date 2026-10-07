import type { Pixels } from '../model/pngCodec';

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Rgba = readonly [number, number, number, number];
export type Rotation = 'cw' | 'ccw';
/** Anchor on a 3x3 grid: 0 = left/top, 1 = centre, 2 = right/bottom. */
export interface Anchor {
  ax: 0 | 1 | 2;
  ay: 0 | 1 | 2;
}
type Bounds = Pick<Pixels, 'width' | 'height'>;

export const MAX_SIZE = 4096;

export const createPixels = (width: number, height: number): Pixels => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});

export const clonePixels = (px: Pixels): Pixels => ({ ...px, data: px.data.slice() });

export const inBounds = (px: Bounds, x: number, y: number): boolean => x >= 0 && y >= 0 && x < px.width && y < px.height;

export const getPixel = (px: Pixels, x: number, y: number): Rgba => {
  const i = (y * px.width + x) * 4;
  return [px.data[i], px.data[i + 1], px.data[i + 2], px.data[i + 3]];
};

export function setPixel(px: Pixels, x: number, y: number, c: Rgba): void {
  px.data.set(c, (y * px.width + x) * 4);
}

/** Checks a canvas size; returns the reason it is invalid, or null. */
export function validateSize(width: number, height: number): string | null {
  for (const [name, v] of [['Width', width], ['Height', height]] as const) {
    if (!Number.isInteger(v)) return `${name} must be a whole number`;
    if (v < 1 || v > MAX_SIZE) return `${name} must be between 1 and ${MAX_SIZE}`;
  }
  return null;
}

// ---- Rasterisers (return the pixels to set, in order) ----

/** Bresenham line, both ends included. */
export function line(x0: number, y0: number, x1: number, y1: number): Point[] {
  const out: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push({ x, y });
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Snaps the end point so the line is horizontal, vertical or exactly 45 degrees. */
export function constrainLine(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > 2 * ay) return { x: x1, y: y0 };
  if (ay > 2 * ax) return { x: x0, y: y1 };
  const n = Math.max(ax, ay);
  return { x: x0 + Math.sign(dx) * n, y: y0 + Math.sign(dy) * n };
}

/** Snaps the end corner so the rectangle is a square. */
export function constrainSquare(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: x0 + (dx < 0 ? -n : n), y: y0 + (dy < 0 ? -n : n) };
}

/** Border of the rectangle with the given opposite corners, clipped to `bounds` when given. */
export function rectOutline(x0: number, y0: number, x1: number, y1: number, bounds?: Bounds): Point[] {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  const out: Point[] = [];
  const add = (x: number, y: number) => {
    if (!bounds || inBounds(bounds, x, y)) out.push({ x, y });
  };
  for (let x = l; x <= r; x++) {
    add(x, t);
    if (b !== t) add(x, b);
  }
  for (let y = t + 1; y < b; y++) {
    add(l, y);
    if (r !== l) add(r, y);
  }
  return out;
}

/** Every pixel of the rectangle with the given opposite corners, clipped to `bounds` when given. */
export function rectFill(x0: number, y0: number, x1: number, y1: number, bounds?: Bounds): Point[] {
  let l = Math.min(x0, x1);
  let r = Math.max(x0, x1);
  let t = Math.min(y0, y1);
  let b = Math.max(y0, y1);
  if (bounds) {
    l = Math.max(l, 0);
    t = Math.max(t, 0);
    r = Math.min(r, bounds.width - 1);
    b = Math.min(b, bounds.height - 1);
  }
  const out: Point[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) out.push({ x, y });
  return out;
}

// ---- Fill ----

/**
 * 4-connected region of pixels whose RGBA exactly equals the one at (x, y), as pixel indices.
 * Returns an empty list when the start is off the canvas or already has `color`. Does not modify `px`.
 */
export function floodFill(px: Pixels, x: number, y: number, color: Rgba): number[] {
  if (!inBounds(px, x, y)) return [];
  const { width, height, data } = px;
  const start = y * width + x;
  const tr = data[start * 4];
  const tg = data[start * 4 + 1];
  const tb = data[start * 4 + 2];
  const ta = data[start * 4 + 3];
  if (tr === color[0] && tg === color[1] && tb === color[2] && ta === color[3]) return [];
  const matches = (i: number) =>
    data[i * 4] === tr && data[i * 4 + 1] === tg && data[i * 4 + 2] === tb && data[i * 4 + 3] === ta;
  const seen = new Uint8Array(width * height);
  const stack = [start];
  const out: number[] = [];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    out.push(i);
    const cx = i % width;
    const cy = (i - cx) / width;
    const next = [cx > 0 ? i - 1 : -1, cx < width - 1 ? i + 1 : -1, cy > 0 ? i - width : -1, cy < height - 1 ? i + width : -1];
    for (const n of next) {
      if (n >= 0 && !seen[n] && matches(n)) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return out;
}

// ---- Regions, flip, rotate ----

export const wholeRect = (px: Bounds): Rect => ({ x: 0, y: 0, w: px.width, h: px.height });

/** Copy of the pixels inside `rect` (which must lie inside the image). */
export function extract(px: Pixels, rect: Rect): Pixels {
  const out = createPixels(rect.w, rect.h);
  for (let y = 0; y < rect.h; y++) {
    const s = ((rect.y + y) * px.width + rect.x) * 4;
    out.data.set(px.data.subarray(s, s + rect.w * 4), y * rect.w * 4);
  }
  return out;
}

/** Sets every pixel inside `rect` (clipped to the image) to transparent. */
export function clearRect(px: Pixels, rect: Rect): void {
  const x0 = Math.max(rect.x, 0);
  const x1 = Math.min(rect.x + rect.w, px.width);
  if (x1 <= x0) return;
  for (let y = Math.max(rect.y, 0); y < Math.min(rect.y + rect.h, px.height); y++) {
    px.data.fill(0, (y * px.width + x0) * 4, (y * px.width + x1) * 4);
  }
}

/** Mirrors the pixels inside `rect` (default: the whole image) in place. */
export function flip(px: Pixels, axis: 'h' | 'v', rect: Rect = wholeRect(px)): void {
  const src = extract(px, rect);
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const sx = axis === 'h' ? rect.w - 1 - x : x;
      const sy = axis === 'v' ? rect.h - 1 - y : y;
      const s = (sy * rect.w + sx) * 4;
      px.data.set(src.data.subarray(s, s + 4), ((rect.y + y) * px.width + rect.x + x) * 4);
    }
  }
}

/** A rotated copy of the image; width and height swap. */
export function rotatePixels(src: Pixels, dir: Rotation): Pixels {
  const out = createPixels(src.height, src.width);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const dx = dir === 'cw' ? src.height - 1 - y : y;
      const dy = dir === 'cw' ? x : src.width - 1 - x;
      const s = (y * src.width + x) * 4;
      out.data.set(src.data.subarray(s, s + 4), (dy * out.width + dx) * 4);
    }
  }
  return out;
}

/** Where a rect lands after rotating about its centre: transposed size, floor of centre minus half the new size. */
export function rotatedRect(rect: Rect): Rect {
  return {
    x: Math.floor(rect.x + rect.w / 2 - rect.h / 2),
    y: Math.floor(rect.y + rect.h / 2 - rect.w / 2),
    w: rect.h,
    h: rect.w,
  };
}

/**
 * Rotates the pixels inside `rect` about its centre within the same image: the old area is cleared,
 * the rotated pixels are written (transparent ones do not overwrite) and anything outside is clipped.
 * Returns the new rect, which may extend past the image.
 */
export function rotateRegion(px: Pixels, rect: Rect, dir: Rotation): Rect {
  const rotated = rotatePixels(extract(px, rect), dir);
  const target = rotatedRect(rect);
  clearRect(px, rect);
  blit(px, rotated, target.x, target.y);
  return target;
}

// ---- Resize, blit ----

/** New image of the given size with the old pixels placed by `anchor`; nothing is scaled. */
export function resize(px: Pixels, width: number, height: number, anchor: Anchor): Pixels {
  const err = validateSize(width, height);
  if (err) throw new Error(err);
  const out = createPixels(width, height);
  const ox = Math.floor(((width - px.width) * anchor.ax) / 2);
  const oy = Math.floor(((height - px.height) * anchor.ay) / 2);
  copyInto(out, px, ox, oy, false);
  return out;
}

function copyInto(dst: Pixels, src: Pixels, ox: number, oy: number, skipTransparent: boolean): void {
  for (let y = Math.max(0, -oy); y < Math.min(src.height, dst.height - oy); y++) {
    for (let x = Math.max(0, -ox); x < Math.min(src.width, dst.width - ox); x++) {
      const s = (y * src.width + x) * 4;
      if (skipTransparent && src.data[s + 3] === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), ((y + oy) * dst.width + x + ox) * 4);
    }
  }
}

/** Writes `src` onto `dst` at (ox, oy), clipped; fully transparent source pixels do not overwrite. */
export const blit = (dst: Pixels, src: Pixels, ox: number, oy: number): void => copyInto(dst, src, ox, oy, true);

// ---- Flatten ----

export interface FlatLayer {
  visible: boolean;
  /** Omitted means fully opaque. */
  opacity?: number;
  px: Pixels;
}

/**
 * Fully visible layers (not hidden, not half transparent) composited bottom-first with source-over on straight RGBA; all layers share one size.
 * The lowest visible layer is copied verbatim, so a single layer keeps even the colour of fully
 * transparent pixels.
 */
export function flatten(layers: readonly FlatLayer[]): Pixels {
  const out = createPixels(layers[0].px.width, layers[0].px.height);
  const d = out.data;
  let base = true;
  for (const layer of layers) {
    if (!layer.visible || (layer.opacity ?? 1) < 1) continue;
    const s = layer.px.data;
    if (base) {
      d.set(s);
      base = false;
      continue;
    }
    for (let i = 0; i < s.length; i += 4) {
      const sa = s[i + 3];
      if (sa === 0) continue;
      const da = d[i + 3];
      if (sa === 255 || da === 0) {
        d[i] = s[i];
        d[i + 1] = s[i + 1];
        d[i + 2] = s[i + 2];
        d[i + 3] = sa;
        continue;
      }
      const a = sa / 255;
      const b = (da / 255) * (1 - a);
      const ao = a + b;
      d[i] = Math.round((s[i] * a + d[i] * b) / ao);
      d[i + 1] = Math.round((s[i + 1] * a + d[i + 1] * b) / ao);
      d[i + 2] = Math.round((s[i + 2] * a + d[i + 2] * b) / ao);
      d[i + 3] = Math.round(ao * 255);
    }
  }
  return out;
}

import type { Rgba } from './ops';

export const MAX_RECENT = 16;

const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

/** "#rrggbb" for the colour's RGB (alpha is separate). */
export const toHex = (c: Rgba): string => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;

/** Parses "#rrggbb" into RGB with the given alpha; null when it is not a valid colour. */
export function fromHex(hex: string, alpha = 255): Rgba | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

export const sameColor = (a: Rgba, b: Rgba): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** The drawing colour (default opaque black) and the recently used colours, most recent first. */
export class ColorState {
  color: Rgba = [0, 0, 0, 255];
  recent: Rgba[] = [];

  setColor(c: Rgba): void {
    this.color = [c[0], c[1], c[2], c[3]];
  }

  setRgb(hex: string): boolean {
    const c = fromHex(hex, this.color[3]);
    if (!c) return false;
    this.color = c;
    return true;
  }

  setAlpha(a: number): void {
    this.color = [this.color[0], this.color[1], this.color[2], Math.min(255, Math.max(0, Math.round(a)))];
  }

  /** Records the current colour as just used: moved to the front, no duplicates, at most MAX_RECENT. */
  markUsed(c: Rgba = this.color): void {
    if (this.recent.length && sameColor(this.recent[0], c)) return;
    this.recent = [[c[0], c[1], c[2], c[3]] as Rgba, ...this.recent.filter((r) => !sameColor(r, c))].slice(0, MAX_RECENT);
  }
}

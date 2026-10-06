import { MAX_SIZE, type Anchor, type Rect } from './ops';

/** Which canvas edges a drag moves. Two flags (one horizontal, one vertical) make a corner. */
export interface Edges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

/** Width of the grab zone, in screen pixels, just outside the image boundary. */
export const EDGE_ZONE = 6;

interface Placement {
  ox: number;
  oy: number;
  scale: number;
}

/**
 * The edges grabbed by a press at screen point (sx, sy), or null. Only the strip just outside the
 * image counts, so pixels on the image's own edge stay drawable.
 */
export function hitEdges(
  sx: number,
  sy: number,
  view: Placement,
  width: number,
  height: number,
  zone = EDGE_ZONE,
): Edges | null {
  const x0 = view.ox;
  const y0 = view.oy;
  const x1 = x0 + width * view.scale;
  const y1 = y0 + height * view.scale;
  const withinX = sx >= x0 - zone && sx < x1 + zone;
  const withinY = sy >= y0 - zone && sy < y1 + zone;
  const edges: Edges = {
    left: withinY && sx >= x0 - zone && sx < x0,
    right: withinY && sx >= x1 && sx < x1 + zone,
    top: withinX && sy >= y0 - zone && sy < y0,
    bottom: withinX && sy >= y1 && sy < y1 + zone,
  };
  return edges.left || edges.right || edges.top || edges.bottom ? edges : null;
}

/** CSS cursor for the grabbed edges. */
export function edgeCursor(e: Edges): string {
  const horizontal = e.left || e.right;
  const vertical = e.top || e.bottom;
  if (horizontal && vertical) return (e.left && e.top) || (e.right && e.bottom) ? 'nwse-resize' : 'nesw-resize';
  return horizontal ? 'ew-resize' : 'ns-resize';
}

const clamp = (v: number): number => Math.min(MAX_SIZE, Math.max(1, v));

/**
 * Canvas size after dragging `edges` by (dx, dy) image pixels (positive = right/down). Dragging a
 * left or top edge outward is negative; sizes are whole numbers held to 1..MAX_SIZE.
 */
export function dragSize(edges: Edges, start: { w: number; h: number }, dx: number, dy: number): { w: number; h: number } {
  const w = start.w + (edges.right ? dx : edges.left ? -dx : 0);
  const h = start.h + (edges.bottom ? dy : edges.top ? -dy : 0);
  return { w: clamp(w), h: clamp(h) };
}

/** The resize anchor: pixels stay put relative to the side that is not being dragged. */
export const dragAnchor = (e: Edges): Anchor => ({ ax: e.left ? 2 : 0, ay: e.top ? 2 : 0 });

/** The new canvas bounds in the old image's coordinates, for the live preview outline. */
export function previewRect(edges: Edges, start: { w: number; h: number }, size: { w: number; h: number }): Rect {
  return {
    x: edges.left ? start.w - size.w : 0,
    y: edges.top ? start.h - size.h : 0,
    w: size.w,
    h: size.h,
  };
}

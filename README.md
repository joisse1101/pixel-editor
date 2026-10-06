# Tilemap editor

A browser-only editor for Sprite Fusion `Office.json` projects. It edits the project and exports the
`map.json` + `spritesheet.png` pair that Phaser loads. No backend.

## Run

```
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (uses office/ as fixtures)
npm run build    # type check + production build
```

## Usage

1. **Import**: *Open* an `Office.json` (try `office/Office.json`).
2. **Edit**: pick a tile in the palette, then *Paint* (B) / *Erase* (E) on the canvas. One tile per cell
   per layer. Flip H (X) / Flip V (Y) / rotate (R, Shift+R) apply to the brush, or to a placed tile in
   *Select* (V) mode. Space or middle/right drag pans, wheel zooms. Ctrl+Z / Ctrl+Y undo and redo.
   - Layers: show/hide (eye), collider flag (C), add, rename, delete, reorder.
   - Tiles: *Import PNG* adds a sheet sliced by tile size; the attribute editor (e.g. `interaction=water`)
     edits the selected palette tile; unused sheets can be deleted.
   - *Map size* resizes the map (confirms before dropping tiles).
3. **Save**: *Save* writes `Office.json` (overwrites the opened file in Chrome/Edge, downloads elsewhere).
   The cached `exports` inside the file is regenerated on every save.
4. **Export**: *Export for Phaser* downloads `map.json` and `spritesheet.png`.

## Phaser bake

Tiles are deduplicated by pixel content (flipped/rotated variants become their own tiles when their
pixels differ), packed 8 tiles wide, and written as a Tiled JSON map: layers bottom to top, `0` for empty
cells, a `collider` bool property per layer, and tile attributes as tile properties. Hidden layers are
still exported.

## Office.json extension fields

All optional; files without them are unchanged from the Sprite Fusion shape. Reopening files that use
them in Sprite Fusion is not supported.

| Field | Where | Meaning |
| --- | --- | --- |
| `rotation` | tile | 0/90/180/270 clockwise, applied after the `scaleX`/`scaleY` flip. Omitted when 0. |
| `visible` | layer | `false` hides the layer in the editor only. Omitted when true. |
| `settings.mapSize` | project | `{ width, height }` in cells. Without it the size is derived from tile bounds. |
| `settings.mapOrigin` | project | `{ x, y }` of the map's top-left cell (tile positions are absolute). Without it, the minimum tile cell. |

Unknown fields are preserved on a round trip.

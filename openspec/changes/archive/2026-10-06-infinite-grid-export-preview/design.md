## Context

`getMapBounds()` returns `settings.mapOrigin`/`mapSize` when set, else the tile bounding box, and `MapView` draws and hit-tests only inside that rectangle. `Editor.resizeMap` writes those settings and drops tiles outside. The Phaser bake (tilemap-editor tasks 7.1-7.7) is not built yet. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One definition of "exported extent" (tight bounding box) used by the bake, the preview and the status line.
- Preview that cannot drift from the export.

**Non-Goals:**
`- Sparse or chunked output (Tiled JSON data is dense), cropping or padding options, margins around the box.`

## Decisions

**`getMapBounds` becomes a pure bounding box over all layers' cells, hidden or not.** `mapSize`/`mapOrigin` are removed from the model and from serialization; load ignores them. Alternative: keep them as an optional crop override, rejected because the requirement is that the export is always the smallest rectangle. Returns an empty result for a project with no cells; callers treat that as "nothing to export".

**Infinite canvas by dropping the rectangle checks.** `cellAt` returns the cell under the pointer without range checks, grid lines are drawn for the visible cell range only (computed from pan/zoom), and `fit()` zooms to the content box (or resets to a default view when empty). Model keys are already absolute `"x,y"` strings, so negative cells need no model change. Very far cells are limited only by number precision; clamping pan to a large range avoids float problems.

**Preview is a mode of `MapView`, rendered from the bake output.** Preview calls the bake (tilemap-editor 7.1-7.3) and draws the resulting dense `map.json` layers with the packed spritesheet, so dedupe, flips and rotations are exactly what Phaser will get; drawing from the editor model would hide differences and would respect the hide flag. The white rectangle is the exported extent. The bake result is cached and recomputed when entering preview. Alternative: modal with a rendered image, rejected in favour of reusing the main canvas pan/zoom.

**Disabling edits in preview.** Tool pointer handlers are skipped while the mode is `preview`; pan/zoom handlers stay. Keyboard shortcuts that edit (rotate, flip, undo/redo) are ignored.

**Bake depends on this definition.** tilemap-editor 7.3 and 7.6 read width/height from "map size"; with this change they read the bounding box.

## Risks / Trade-offs

- [Preview needs the bake, which is unbuilt] -> implement the bounds and infinite grid first, and the preview tasks after tilemap-editor 7.1-7.3.
- [Stray tile far away makes a huge export with mostly empty data] -> the preview shows the box so the user sees it; the status line shows the exported size.
- [Removing resize deletes shipped code and a confirm flow] -> it is only reachable from the removed button; remove tests with it.
- [Legacy `mapSize` dropped on save] -> intended; the sample has none, so existing sample round trips are unchanged.

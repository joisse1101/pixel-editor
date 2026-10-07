## Context

Both editors render their layer list by hand in vanilla TypeScript (no React, no UI framework). See proposal.md for motivation.

- Map editor: `renderLayers()` in `src/main.ts` rebuilds `<li>` rows in file order (index 0 first). `editor.moveLayer(from, to)` already takes arbitrary positions. Yellow layers are tracked by layer id, so they survive a reorder. The active layer is tracked by index (`activeLayer`) and must be re-pointed after a move.
- Pixel editor: `LayerPanel` in `src/pixel/layerPanel.ts` lists layers top of stack first (reversed from array order). `PixelDocument.moveLayer(index, dir)` only swaps neighbours. It records one history step through `structure()` and keeps the active layer by identity.
- The panel's `refresh()` skips re-rendering when its key (ids, names, visibility, active index) is unchanged.

## Goals / Non-Goals

**Goals:**
- Drag a layer row to any slot in either list with a visible drop indicator, as one drop operation.
- Remove the Up/Down buttons from both editors.
- Share the drag logic between the two lists without sharing their index conventions.

**Non-Goals:**
- Touch or keyboard reordering.
- Adding undo for map editor reordering.
- Dragging multiple layers at once (the yellow set).
- Any new dependency.

## Decisions

**Native HTML5 drag and drop, not react-dnd.** react-dnd requires React, which the app does not use. Adding React for two lists is out of proportion. Native `draggable` rows with `dragstart` / `dragover` / `drop` need no dependency, and desktop mouse is all that is required. Alternatives considered: SortableJS or `@dnd-kit` (adds a dependency, mainly to gain touch support that was ruled out).

**A shared helper that reports slots, not indices.** A small module (for example `src/ui/dragReorder.ts`) takes the list container and its row elements and reports `onReorder(fromRow, toSlot)`, where rows are numbered in visual order and `toSlot` is the gap between rows (0 = before the first row, n = after the last). It owns the drop indicator and the `dragover` midpoint logic (upper half of a row means the slot before it, lower half the slot after). Each panel converts visual positions into its own array indices:
- Map editor: visual position equals array index, so `to` is the slot adjusted for removal of the dragged row.
- Pixel editor: visual position is reversed, so the array index is `length - 1 - position`.

The conversion lives in each panel and is covered by unit tests, because the opposite orientations are the main source of off-by-one errors.

**Pixel `PixelDocument.moveLayer` takes a target index.** Change the signature to `moveLayer(from, to)`, still one `structure()` call (one undo step), still preserving the active layer by identity. A no-op move (same position) returns false and records nothing. The `dir` form is removed along with its only callers.

**Drag does not change selection.** `dragstart` does not activate the row, and the browser does not fire `click` after a drag, so the active and yellow state is unchanged. In the map editor, after `editor.moveLayer`, `activeLayer` is recomputed from the active layer's identity rather than set to the drop position.

**Rename input and buttons stay usable.** Rows are `draggable`, but the pixel rename input and the eye/collider buttons must not start a drag. Rows are set `draggable = false` while a rename input is open, and drags that start on an `<input>` are ignored.

**Re-render timing.** The list is re-rendered after a drop only, never during `dragover`, so the dragged element is not replaced mid-drag. The drop indicator is a single positioned element or a CSS class on the neighbouring row, not a change to layer data.

## Risks / Trade-offs

- Native drag and drop has no touch support. Accepted by the user; revisit with a library if tablets matter.
- Native drag and drop has no keyboard path, which removes the only keyboard-reachable way to reorder layers. Accepted by the user.
- Off-by-one errors from the reversed pixel list and the remove-then-insert shift. Mitigated by testing the slot-to-index conversion for both panels, including drops at either end and in place.
- `dragend` without a drop (Escape, or dropping outside) must clear the indicator and leave state untouched.
- Removing the buttons is breaking for anyone relying on them. The spec delta documents it.

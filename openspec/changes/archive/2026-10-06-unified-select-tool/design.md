## Context

See proposal.md for motivation. Current state:

- `main.ts` holds a `tool` ('paint' | 'erase' | 'select'), a single `activeLayer` index, a single-tile `Brush` and a single `view.selectedCell`.
- `MapView` pans on right and middle button and on Space+left; left goes to `handlers.down/move/up`. `contextmenu` is already suppressed.
- `Palette` selects one tile on mouse-up and pans on right and middle button.
- `Editor` records undo as `Stroke = CellChange[]`, each change keyed by `layerId|cellKey`, so one stroke can already span layers.

## Goals / Non-Goals

**Goals:**
- One mode-less interaction model: a brush (palette block) or no brush decides what left-drag does; the right button deletes.
- Reuse the stroke model so every gesture is one undo step.
- One `Block` shape shared by the brush, the selection and the clipboard, so flip/rotate is implemented once.

**Non-Goals:**
- Persisting the yellow set, selection or clipboard in Office.json.
- Cross-project or cross-session clipboard, or the system clipboard.
- Free-form (lasso) selections, or selections that survive edits to the map by other tools.
- Auto-tiling (the `isAutoTile` and `rules` layer fields stay carried through the file but unused) or other brush modes.

## Decisions

**Interaction state, not tool state.** Remove `Tool`. State is `brush: Block | null`, `selection: Rect | null`, `floating: Block | null` (pending paste) and `drag` (what the current gesture is). Gesture is chosen on pointer-down from (button, shift, alt, brush, inside-selection). Alternative: keep a hidden tool enum derived from these; rejected because it recreates the mode the user wanted gone.

**One `Block` type.** `{ width, height, cells: { dx, dy, layerId?, tile: PlacedTile }[] }`. A palette brush has no `layerId` (it goes to the blue layer); a selection capture and the clipboard carry `layerId` per cell. Flip and rotate are pure functions in `orientation.ts`: mirror or rotate each cell's (dx, dy) within the block bounds and apply the existing `applyOrientOp` to the tile. Rotate CW maps (dx, dy) to (height-1-dy, dx). Alternative: separate brush and clipboard types; rejected as duplicated orientation logic.

**Brush stores tile ids, not pixels.** The palette emits `{ sheetId, col, row, w, h }`; `main.ts` expands it to a `Block` using the sheet's column count. The attribute modal needs a 1x1 block and gets the single tile id; the configure button disables for larger blocks.

**Rectangle fill tiles from the press cell.** For each cell (x, y) in the dragged rectangle, the block cell at ((x - x0) mod w, (y - y0) mod h) is placed, where (x0, y0) is the press cell and the rectangle is normalised so the pattern anchors at the press cell even when dragged up or left (use signed offsets from the press cell). Clipped patterns follow from the modulo; no special case.

**Layer sets live in the UI layer.** `activeLayer: number` stays; add `yellow: Set<string>` of layer ids (ids survive reorder). `targetLayers()` returns the blue layer plus visible yellows. Left-click on a row sets blue and clears yellow; right-click toggles. Layer delete removes the id. Alternative: store flags on `Layer`; rejected because it would leak into the saved model.

**Editor gets batch operations, all inside one stroke.** `paintBlock(layerIndex, x, y, block)` (the grid is infinite, so nothing is clipped to bounds), `fillRect(layerIndex, rect, block)`, `deleteRect(layerIndexes, rect)`, `moveCells(entries, dx, dy, copy)` and `pasteBlock(block, x, y)`. Each is called inside `ed.stroke()`. Move reads all source cells first, deletes them, then writes targets, so overlapping source and target works. Alternative: compose from `paint` and `erase` in `main.ts`; rejected to keep invariants and tests in the editor.

**Button routing in `MapView`.** Pan only on middle button or Space+left. Left and right are both forwarded to handlers with the original event, so handlers read `button`, `shiftKey` and `altKey`. Pointer capture and the existing `tooling` flag are reused. In the palette the right button no longer pans; `contextmenu` stays suppressed. Left-drag is tracked as a block selection once it passes the existing `DRAG_SLOP`; a smaller movement stays a single-tile click.

**Freehand paint with a block.** Reuse `forLine` between last and current cell, stamping the block at each step, so fast drags leave no gaps. A block larger than 1x1 stamps overlapping copies along the path, which is expected.

**Selection rendering.** Marquee and selection outline are drawn in `MapView` in the existing overlay pass, like `selectedCell` today (which is replaced). The pending paste is drawn like the brush ghost, at 65% alpha. Layer row colors are CSS only: `.active` stays blue, a new `.multi` class is yellow.

**Help panel is static markup, shown with CSS.** A `?` button in the toolbar with a sibling panel; `:hover` and `:focus-within` on a wrapper show it, so no JS state is needed and keyboard focus works. The panel is absolutely positioned under the icon with a high z-index and `pointer-events: none` while hidden. Content is a hand-written list in `main.ts` next to the other toolbar markup; it is the single place that documents controls, and replaces the scattered hint text. Alternative: generate it from a keymap table; rejected as overkill for about 25 lines.

**Keys.** Esc: cancel paste, else clear selection, else clear brush. Delete and Backspace: delete the selection. Ctrl+C / Ctrl+V: copy and paste. X, Y, R flip and rotate the pending paste if any, else the selection if any, else the brush. Ctrl+C / Ctrl+V must not fire when focus is in a text input (the handler already returns early for text fields). Remove B, E, V.

**Move preview.** While dragging, the selected tiles are drawn at their offset and the originals stay until mouse-up, when `moveCells` commits. This avoids a half-applied edit if the drag is cancelled with Esc.

## Risks / Trade-offs

- [Right button no longer pans, which may surprise existing users] → Middle-drag, Space+drag and the wheel remain, and the hint text in the side panel and status row is updated.
- [Block flip/rotate is easy to get wrong for non-square blocks] → Pure functions with unit tests on 2x1, 1x2, 2x2 and 3x2 blocks, including four rotations returning to the identity.
- [A stray right-click can delete on yellow layers the user forgot about] → Yellow rows are clearly highlighted, left-clicking another layer clears them, and every delete is one undo step.
- [Left-drag without a brush selects instead of painting, so users who clear the brush then drag see a marquee] → The status row shows "Select" or the brush preview so the state is visible.
- [Selection state goes stale after undo or layer edits] → Clear the selection and pending paste on undo, redo, layer delete and project change.
- [Tile size change or new project with a live clipboard] → Clear the clipboard on project change; tile size only changes while the map is empty and cannot invalidate a block (blocks store ids and orientation only).

## Migration Plan

No data migration. Office.json is unchanged. Rollback is reverting the commit.

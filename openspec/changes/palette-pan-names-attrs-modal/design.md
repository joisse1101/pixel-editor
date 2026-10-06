## Context

`Palette` appends a select and a canvas straight into the right panel, so a tall canvas scrolls the panel. Sheets have no name (the label is generated), and attributes are edited inline by `renderAttrs()` in `src/main.ts` from the brush. `MapView` already implements pan with middle/right/Space+drag. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Same pan gestures as the map, without left-drag pan.
- Name stored on the sheet, size in the label computed from pixels.
- One attribute editor, shown in a modal.
- Renaming a sheet after import.
- Zooming the palette.
- Reordering sheets, with the order saved.

## Decisions

**Viewport element around the canvas with a pan offset.** The canvas is sized to the viewport and `render()` draws the sheet at `(panX, panY)`; hit testing subtracts the same offset. Alternative: native `overflow: auto` on a wrapper, rejected because it gives scrollbars rather than the map's drag-pan feel. Pan is clamped so the sheet cannot leave the viewport entirely and resets when the sheet changes.

**Reuse the map's gesture rules.** Button 1/2 or Space held pans; wheel pans (shift = horizontal). Left button only selects.

**Zoom: Ctrl + wheel and +/- buttons, integer steps.** The wheel stays a pan so a tall sheet scrolls naturally; Ctrl + wheel zooms around the cursor. Zoom is per sheet in memory, limited to 1x-8x in whole steps so pixels stay crisp, and defaults to today's `floor(320/width)` fit. Hit testing and the selection highlight use the zoomed tile size. Alternative: wheel zooms like the map, rejected because it removes wheel panning for trackpad users.

**Rename: a Rename button beside Import/Delete using `prompt`, like layer rename.** Empty input is ignored; the new name is saved the same way as the imported one, and the label updates immediately. Alternative: inline editing in the select, not possible with a native `<select>`.

**Reorder: up/down buttons that move the shown sheet within `project.sheets`.** Order is the order of the `spriteSheets` entries in Office.json, and the selector follows it. Tiles reference sheets by id, so placed tiles and the Phaser bake (deduped by pixels) are unaffected. The moved sheet stays selected. Alternative: drag to reorder, rejected as heavier than the layer panel's existing up/down pattern.

**`name?: string` on `SpriteSheet`, saved as `name` in the spriteSheets entry.** Label is `${name ?? 'Sheet N'} (${cols}x${rows})`, computed on every rebuild so it cannot go stale. Name = file name with the last extension removed. Because `s.extra` is spread into the saved entry, `name` must be taken out of `extra` on load so it is not written twice.

**Modal edits the palette's selected tile, not the brush.** The gear is enabled from the palette selection (cleared on project load and on deleting the selected sheet). The row editor from `renderAttrs()` moves into the modal; it saves on `change` and flushes on close, so Escape or backdrop clicks cannot drop a value. Alternative: a hand-built overlay; native `<dialog>` is preferred for focus trap and Escape handling with no dependency.

## Risks / Trade-offs

- [Selection and brush can diverge, since tools change the brush] -> the modal always uses the palette selection and shows the sheet name and tile id in its title.
- [Duplicate sheet names] -> allowed; ids stay the identity.
- [Reordering changes the saved file even though the map is identical] -> intended; it does not touch tiles or the bake output.
- [Zoom state lost on reload] -> acceptable; it is a view setting, not saved.
- [tilemap-editor task 6.3 describes an inline editor] -> this change supersedes its UI; data model and round trip are unchanged.

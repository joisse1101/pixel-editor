## 1. Block model and orientation

- [x] 1.1 Add a `Block` type (width, height, cells with dx, dy, optional layerId, tile) in `src/model/types.ts` and verify `tsc` passes
- [x] 1.2 Add block `flipH`, `flipV`, `rotateCW`, `rotateCCW` in `src/editor/orientation.ts`; unit tests cover 2x1, 1x2, 2x2 and 3x2 blocks and four rotations returning the original block
- [x] 1.3 Add a helper that expands a palette rectangle (sheet, col, row, w, h) into a `Block`; test it with a sheet whose column count is not the block width

## 2. Editor operations

- [x] 2.1 Add `paintBlock` to `Editor` (stamps a block at a cell on one layer, clipping nothing, replacing existing tiles); test a 2x2 stamp
- [x] 2.2 Add `fillRect` that tiles a block from the press cell, including drags up and left and clipped edges; tests for a 6x4 fill with a 2x2 block and a 3x3 clipped fill
- [x] 2.3 Add `deleteRect` over a set of layer indexes, skipping layers not in the set; test that an unlisted layer is untouched
- [x] 2.4 Add `moveCells` (move and copy, overlapping source and target, negative coordinates kept, replace on collision); tests for each case
- [x] 2.5 Add `pasteBlock` that routes each cell to its `layerId` and skips unknown layers; test with a deleted source layer
- [x] 2.6 Verify a multi-layer move, paste and rectangle fill each undo and redo as one step in `tests/editor.test.ts`

## 3. Palette block selection

- [x] 3.1 Change `Palette` to select a block by left-drag (with click as 1x1), clamp to the sheet grid, and draw the block highlight; verify manually that a drag past the edge ends at the last tile
- [x] 3.2 Stop the right button from panning in `Palette` while keeping `contextmenu` suppressed; verify a right-drag does not move the sheet
- [x] 3.3 Update the palette callback to emit a block, adapt the configure button to enable only for 1x1, and verify the attribute modal still works for a single tile

## 4. Map interaction

- [x] 4.1 In `MapView`, pan only on middle button and Space+left; forward left and right presses to the handlers with button, shift and alt; verify right-drag no longer pans
- [x] 4.2 In `main.ts`, remove `Tool`, the three tool buttons and `B`/`E`/`V`; add brush, selection, floating paste and drag state; verify the toolbar and the app compile and start
- [x] 4.3 Implement left-click stamp, freehand drag, and Shift+drag rectangle fill with a live rectangle preview; verify against the paint scenarios
- [x] 4.4 Implement right-click, right-drag and Shift+right-drag delete across the blue and yellow visible layers; verify with a three-layer project
- [x] 4.5 Implement marquee selection with no brush, selection outline, and clearing on Esc or brush pick
- [x] 4.6 Implement drag-to-move and Alt-drag-copy with a preview and a commit on release; verify a move across two layers undoes in one step
- [x] 4.7 Implement Ctrl+C, Ctrl+V with a floating preview placed on click, Esc to cancel, and Delete to clear the selection; verify paste returns tiles to their source layers
- [x] 4.8 Route X, Y and R flip and rotate to the pending paste, else the selection, else the brush; verify a 2x1 selection rotates into a 1x2 selection
- [x] 4.9 Clear selection and pending paste on undo, redo, layer delete and project change; verify no stale outline remains after each

## 5. Layers panel

- [x] 5.1 Add a `yellow` set of layer ids with a `.multi` row style in `style.css`; left-click sets blue and clears yellows, right-click toggles, right-click on blue is a no-op
- [x] 5.2 Compute target layers as blue plus visible yellows for delete, select, move, copy and paste, and verify hidden yellows are skipped
- [x] 5.3 Remove deleted layers from the set and keep yellow across reorder; verify with layer move and delete

## 6. Help icon

- [x] 6.1 Add the "?" toolbar button and hover/focus panel with grouped controls (palette, brush, selection, delete, layers, navigation, shortcuts) in `main.ts` and `style.css`; verify by hover and by Tab focus that it shows, and that Esc and moving away hide it
- [x] 6.2 Verify the panel does not cover or block the map when hidden and fits the window width at 1280px

## 7. Docs and wrap-up

- [x] 7.1 Update the hint text, the status row and `README.md` for the new gestures and the right button no longer panning
- [x] 7.2 Run `npm test` and the type check and verify they pass, then run `openspec validate unified-select-tool --strict`

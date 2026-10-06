## 1. Pixel helpers

- [x] 1.1 Add `flatten(layers)` to `src/pixel/ops.ts` (source-over RGBA, hidden layers skipped) and verify new `pixelOps.test.ts` cases: top opaque over bottom, transparent show-through, semi-transparent known values, hidden layer ignored
- [x] 1.2 Add a pure viewport helper that returns the new offset after growing the canvas at the left/top by N image pixels, and verify it in `pixelViewport.test.ts`

## 2. Layer model and history

- [x] 2.1 Rework `History` (`src/pixel/history.ts`) so diff steps record their layer and snapshots cover the whole `{ layers, activeIndex }` state; verify existing `pixelHistory.test.ts` still passes and new cases cover undo/redo of a diff on a non-active layer (re-activates it) and of a structure snapshot interleaved with diffs
- [x] 2.2 Introduce `Layer` and the layer list in `PixelDocument` with `px` as the active layer's pixels, `setActive` (commits floating, keeps selection and clipboard), and one transparent layer on creation; verify existing `pixelDocument.test.ts` passes unchanged and new tests cover `setActive` with a floating paste
- [x] 2.3 Implement add (above active), delete (nearest becomes active, never the last layer), rename, move up/down and duplicate (" copy", directly above, active, independent pixels) as single undoable steps; verify with document tests including undo/redo of each
- [x] 2.4 Add `setVisible` (not an undo step, does not mark dirty); verify with a test that `isDirty` and `canUndo` are unchanged by toggling
- [x] 2.5 Make `resize`, whole-canvas `flip` and whole-canvas `rotate` apply to every layer as one snapshot; verify tests for a three-layer resize, flip, rotate, and undo of each
- [x] 2.6 Make `newImage` and `load` reset to a single layer; verify with tests that history is cleared and one layer remains

## 3. Import and save

- [x] 3.1 Implement `addLayers(images, names)` with grow-to-fit (top-left anchor, pad existing layers and new ones, blank single-layer document adopts first PNG's size, one undo step); verify tests: same size, larger PNG grows all layers, smaller PNG padded, several files with mixed sizes, blank-document adoption, undo
- [x] 3.2 Wire multi-file open in `src/pixel/main.ts` and `src/io/files.ts` (`showOpenFilePicker({ multiple: true })` and `<input multiple>` fallback), name layers after files, skip undecodable files with an error naming each, drop the discard prompt for Open, fit the view when the size changed; verify in the browser by importing three PNGs, one of them invalid
- [x] 3.3 Save flattened visible layers via `flatten`, and drop the file handle (Save acts as Save As) when the document has more than one layer; verify in `pixelFiles.test.ts` / document tests for flatten output and handle behaviour, and manually that Save asks for a location after a second import

## 4. Canvas view

- [x] 4.1 Composite visible layers in `PixelView` using per-layer offscreen canvases with dirty flags, drawing the floating selection directly above the active layer; verify manually that stacked, hidden and pasted-into-lower-layer cases look right and that pencil drawing stays smooth on a 512x512 image with five layers
- [x] 4.2 Add edge/corner hit testing outside the image boundary, resize cursors, and the drag preview outline with `W x H` label in `PixelView`; verify manually that presses on edge pixels still draw and that hover shows the right cursors
- [x] 4.3 Apply the drag on release through `doc.resize` with the per-axis anchor, adjust the viewport offset for left/top growth, clamp to 1..4096, cancel on Esc (view handles Esc before `main.ts`), and do not refit; verify with tests for the size/anchor math and manually grow left, shrink from top, corner drag, and undo

## 5. Layer panel UI

- [x] 5.1 Add `src/pixel/layerPanel.ts` and its markup/styles: top-first list, eye toggle, active highlight, click to activate, double-click to rename, Add/Duplicate/Delete/Up/Down buttons, delete confirmation when the layer has pixels; verify manually and that the panel re-renders on `doc.onChange`
- [x] 5.2 Update the shortcut/help panel and status area for layers (for example active layer name), and verify that tool shortcuts still do not fire while renaming a layer

## 6. Verification

- [x] 6.1 Run `npm test` and the type check/build (`npm run build`) and verify both are clean
- [x] 6.2 Walk through the comparison flow in the running app (import several PNGs, toggle visibility, copy a selection from one layer to another, duplicate a layer, drag-resize the canvas, undo each, save and reopen the flattened PNG) and verify each matches the specs

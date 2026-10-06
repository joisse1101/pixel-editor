## Context

See proposal.md for motivation. Today `PixelDocument` (`src/pixel/document.ts`) owns a single `px: Pixels`. `History` (`src/pixel/history.ts`) writes pixel diffs straight into `holder.px` and swaps the whole buffer for size-changing steps (`snapshot`). Tools, selection, flip/rotate and the view all read `doc.px`. `main.ts` opens a PNG by replacing the document (with a discard prompt) and remembers the file handle so Save overwrites the source.

Observed constraints that shape the approach:
- Undo is one linear stack; diff steps mutate pixel buffers in place and rely on being undone in reverse order. Snapshots already depend on that (a snapshot keeps buffer references).
- `ops.resize(px, w, h, anchor)` takes a per-axis anchor (`ax`, `ay` in 0..2) and positions old pixels at `floor((new - old) * a / 2)`. A left-edge drag is `ax = 2`, a right-edge drag `ax = 0`, so edge dragging needs no new pixel math.
- `PixelView.onPointerDown` forwards every non-pan press to the tool handlers.

## Goals / Non-Goals

**Goals:**
- Keep tools, ops and selection code unchanged by continuing to expose "the pixels being edited" as `doc.px`.
- One undo stack across all layers, with layer-structure edits as steps.
- What the canvas shows equals what Save writes.

**Non-Goals:**
- Layer offsets, opacity, blend modes, solo view, layered file format (see proposal).
- Per-layer or per-tool flatten sampling (the eyedropper reads the active layer only).

## Decisions

### 1. Layer model: `Layer { id, name, visible, px }` in the document; `px` is the active layer's pixels
`PixelDocument` holds `layers: Layer[]` (index 0 = bottom) and `activeIndex`. `get px()` returns the active layer's `Pixels`, so `tools.ts`, `ops.ts` call sites and eyedropper/fill keep working. The panel shows the list reversed (top first).
- *Alternative:* a flattened document plus a separate layer manager. Rejected: tools would have to be told which buffer to touch and the selection/floating code would need parallel plumbing.

### 2. One shared History, steps reference layers
`History` keeps its single stack, with three step kinds:
- `diff { layer, patches }`: the stroke is recorded against the layer active at `beginStroke`; undo/redo apply to that layer's buffer and make it active.
- `snapshot { before, after }` over the **whole layer state** `{ layers, activeIndex }` (layer objects and their `px` references). This covers resize, canvas flip/rotate, import, add, delete, duplicate, rename and reorder. Snapshots store references, not pixel copies, except where the operation produces new buffers (resize, rotate, import padding).
- `ImageHolder` becomes `{ px (active), layers, activeIndex }` with a setter for the whole state.

Stack-order undo keeps the existing invariant: restoring a structure snapshot hands back buffers whose contents were already restored by the diffs undone before it.
- *Alternative:* a History instance per layer. Rejected: undo order would no longer be the user's order, and resize/import cross layers.

Visibility toggles and active-layer clicks are not steps. Undo changes the active layer to the one an edit touched, as the spec requires.

### 3. Switching the active layer commits floating pixels first
`setActive(i)` calls `commitFloating()` on the current layer before switching, then keeps `selection` and `clipboard`. This makes "copy across layers" fall out of existing behaviour: copy reads the active layer, paste creates a floating selection on the new active layer.

### 4. Whole-canvas operations loop over layers
Resize, flip with no selection and rotate with no selection build a new `Pixels` per layer and record one snapshot of the whole state, since layers must stay the same size. Selection operations still touch the active layer only. (Spec decision: canvas-wide flip also applies to every layer, so layers never disagree about orientation.)

### 5. Import: decode everything, compute the target size once, apply as one step
1. Decode all chosen files (`decodeImageFile`), collecting errors per file.
2. Target size = max(canvas, each PNG) per axis. If the document is a single fully transparent layer, the target is the first PNG's size and that layer is replaced instead of kept.
3. Pad existing layers with `ops.resize(layer, w, h, {ax:0, ay:0})`, pad each PNG into a new layer of the target size, record one snapshot, refit the view if the size changed.
Open no longer replaces the document, so the "discard changes?" prompt is dropped for Open; New image keeps it. Picker: `showOpenFilePicker({ multiple: true })` where available, `<input type="file" multiple>` otherwise.

### 6. Display compositing: per-layer offscreen canvases; saving uses a JS flatten
`PixelView` keeps one offscreen canvas per layer, re-uploading only layers marked dirty, and draws visible ones with `drawImage` in stack order. A floating selection is drawn immediately above the active layer (below layers above it) so a paste into a lower layer does not appear over upper layers. Saving uses `ops.flatten(layers)` (source-over on RGBA, hidden layers skipped) before `encodePng`.
- *Alternative:* use the JS flatten for both display and save. It guarantees identical output but re-flattening up to 4096x4096 per layer on every pencil move is too slow. Accepted risk: for semi-transparent overlaps canvas compositing and the JS flatten may differ by 1 in a channel after rounding; opaque and fully transparent pixels are exact.

### 7. Edge-drag resize lives in `PixelView`, applied through `doc.resize`
- Hit test before the tool handlers: a press within ~6 screen px **outside** the image boundary selects left/right/top/bottom and corners; nothing inside the image qualifies, so edge pixels stay drawable. Hover sets a resize cursor (Space-pan's grab cursor takes precedence).
- Drag state: grabbed edges, start pointer, start size. New size = start size + delta in image pixels (`round(screenDelta / scale)`, sign per edge), clamped to 1..4096. The view draws the outline and a `W x H` label and calls nothing on the document until release.
- On release: `doc.resize(w, h, {ax, ay})` with `ax = 2` if the left edge moved, else 0 (likewise `ay` for the top). This is the same code path as the Resize dialog, so one snapshot of all layers and the selection is cleared.
- Because a left/top drag moves the image origin, the viewport offset is adjusted by `-(growth * scale)` on that axis at commit so the existing pixels stay where they were on screen. The view does not refit.
- Esc is handled by the view first (cancel the drag) before `main.ts`'s cancel chain.
- The dialog path keeps calling `view.fit()`.

### 8. Save and file handle
Save flattens visible layers. When the document has more than one layer and the handle belongs to a file it was opened from, the handle is dropped (Save acts as Save As) so a source PNG is never overwritten by a composite. A single-layer document keeps today's behaviour.

### 9. UI placement
A layer panel in the existing side column with: list rows (eye, name, active highlight; double-click to rename), and buttons Add, Duplicate, Delete, Up, Down. It lives in a new `src/pixel/layerPanel.ts` to keep `main.ts` from growing, and subscribes to `doc.onChange`.

## Risks / Trade-offs

- [Bugs in the history rework could corrupt undo] → Extend `pixelHistory.test.ts` / `pixelDocument.test.ts` first: undo/redo across layer switches, structure steps interleaved with diffs, redo after layer deletion.
- [Memory: every resize/rotate/import snapshot holds full copies of every layer, up to 4096x4096x4 B each] → Same trade-off as the existing single-image snapshot, multiplied by layer count; acceptable for a pixel-art tool, revisit if large documents show pressure.
- [Canvas vs JS composite rounding differences on semi-transparent pixels] → Documented above; a test checks opaque and fully transparent cases, and semi-transparent flatten is tested against known values.
- [Left/top drag viewport compensation getting out of step with the resize] → Pure function for "new viewport offset from growth" with unit tests, in `viewport.ts`.
- [Edge hit zone is small at low zoom or when the image fills the view] → The zone sits in the margin outside the image; if the image touches the viewport edge it is unreachable, so the Resize dialog stays available and Fit leaves a margin.
- [Dropping the discard prompt on Open] → Nothing is lost on Open now (layers are added), and undo reverts it.

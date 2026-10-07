## 1. Shared drag helper

- [x] 1.1 Add `src/ui/dragReorder.ts`: makes list rows draggable, shows a drop indicator at the slot under the pointer (upper half of a row = before it, lower half = after it), and calls `onReorder(fromRow, toSlot)` on drop
- [x] 1.2 Clear the indicator on `dragend`, on `dragleave` of the list, and on drops outside the list; ignore drags that start on an `<input>`
- [x] 1.3 Add drop-indicator and dragging-row styles in `src/style.css`
- [x] 1.4 Unit test the slot calculation and the no-op cases (same position, adjacent slot)

## 2. Pixel editor

- [x] 2.1 Change `PixelDocument.moveLayer` in `src/pixel/document.ts` to `moveLayer(from, to)`: arbitrary target, one history step, active layer kept by identity, returns false with no history entry when nothing moves
- [x] 2.2 Wire the helper into `LayerPanel` (`src/pixel/layerPanel.ts`), converting visual position (top first) to array index
- [x] 2.3 Remove the `up` / `down` actions and their disabled-state logic from `LayerPanel`
- [x] 2.4 Disable dragging on a row while its rename input is open
- [x] 2.5 Update `tests/pixelLayers.test.ts`: move across several positions, to either end, in place (no undo step), active layer unchanged, one undo restores the order

## 3. Map editor

- [x] 3.1 Wire the helper into `renderLayers` in `src/main.ts`, converting the drop slot to the `to` index for `editor.moveLayer`
- [x] 3.2 After a move, recompute `activeLayer` from the active layer's identity; confirm yellow layers (tracked by id) stay highlighted
- [x] 3.3 Remove the `#layer-up` / `#layer-down` buttons, `moveActiveLayer`, and their listeners
- [x] 3.4 Update `tests/editor.test.ts` if it relied on the removed behaviour; add a test for moving a layer across several positions

## 4. Verify

- [x] 4.1 Run `npm test` and `npm run build`
- [ ] 4.2 Manually check both editors in the browser: drag to top, bottom and middle, drop in place, drop outside, rename while dragging, eye and collider buttons still clickable, active and yellow highlights unchanged

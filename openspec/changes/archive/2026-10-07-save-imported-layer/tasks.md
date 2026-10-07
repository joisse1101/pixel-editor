## 1. Layer model

- [x] 1.1 Add optional `source?: { handle: FileHandle; name: string }` to `Layer` in `src/pixel/history.ts` and verify `npm run build` type-checks
- [x] 1.2 Let `PixelDocument.addLayers` accept `source` per image and store it on the new layer; verify a test in `tests/pixelLayers.test.ts` shows the layer keeps its source after rename, move, canvas resize, and undo/redo of a delete
- [x] 1.3 Verify `duplicateLayer` leaves `source` unset with a test in `tests/pixelLayers.test.ts`

## 2. Import and save

- [x] 2.1 In `importImages` (`src/pixel/main.ts`) pass each picked file's non-null `handle` and name as `source`, including the blank-document case, and verify with a test that an import without handles yields unlinked layers
- [x] 2.2 Add a `saveLayer(index)` handler that commits floating pixels, encodes the layer's `px` with `encodeImageFile`, writes via `saveBytes` to the layer's handle without calling `markSaved` or changing `handle`/`handleIsSource`; verify a test that the written bytes decode to the layer's exact RGBA for a hidden layer and a 50% layer
- [x] 2.3 Show the error through `message(..., true)` when the write fails and verify a test with a handle whose `createWritable` rejects leaves the document unchanged

## 3. Document Save gating

- [x] 3.1 Add `saveAllowed()` in `src/pixel/main.ts` (two or more linked layers and no completed Save As means false), disable `#save` from it in `refreshStatus`, and guard the Ctrl+S shortcut; verify with a test that Save is disabled with two linked layers, Save As still works, and Save is enabled again after Save As
- [x] 3.2 Verify Save re-enables when a linked layer is deleted down to one, and stays enabled after Save As when more linked layers are imported

## 4. Layer panel

- [x] 4.1 Give `LayerPanel` an `onSaveLayer(index)` callback and render a save icon button beside the eye only for layers with a `source`, with a tooltip naming the file; include the link in the refresh key; verify the icon appears only on linked rows
- [x] 4.2 Make the icon click `stopPropagation` so it does not select the layer or start a drag; verify with a panel test that the active layer is unchanged after clicking it
- [x] 4.3 Style the icon in `src/style.css` to fit the row at the existing eye size, and verify visually in `npm run dev` with a hidden layer, a 50% layer and a long layer name

## 5. Wrap-up

- [x] 5.1 Run `npm test` and `npm run build` and verify both pass
- [x] 5.2 In `npm run dev`, import two PNGs, edit and save one with the other visible, and confirm only that file changed and the document still shows unsaved changes

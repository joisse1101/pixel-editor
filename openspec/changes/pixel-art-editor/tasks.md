## 1. Pages and navigation

- [x] 1.1 Add `vite.config.ts` with both HTML inputs and `pixel.html` loading `src/pixel/main.ts`; verify `npm run build` emits both pages and `npm run dev` serves `/pixel.html`
- [x] 1.2 Add `src/ui/nav.ts` (`mountNav(current)`, links "Map Editor" / "Pixel Art Editor", current marked) with nav styles; verify with a unit test of the generated markup (current link flagged, hrefs correct)
- [x] 1.3 Call `mountNav('map')` in `src/main.ts` after the DOM is built; verify the map page still builds, `npm test` passes and the toolbar/panels fill the space below the nav

## 2. Image operations (pure, no DOM)

- [x] 2.1 Add `src/pixel/ops.ts` with `line` (Bresenham), `rectOutline`, `rectFill` and Shift constraints (45° line, square); verify tests for horizontal, diagonal, reverse direction and clipped rectangles
- [x] 2.2 Add `floodFill` (4-connected, exact RGBA match, no-op when colour equal); verify tests for bounded region, diagonal non-connection and same-colour no-op
- [x] 2.3 Add `flip` and `rotate` for a rect or whole image, including canvas rotation swapping size and selection rotation about the centre with clipping; verify tests for 4x2 canvas rotate, square selection rotate, non-square selection rotate, clipped result and flip of selection vs canvas
- [x] 2.4 Add `resize` with 3x3 anchor (grow pads transparent, shrink crops, no scaling) and size validation 1..4096; verify tests for top-left, center and bottom-right anchors and invalid sizes
- [x] 2.5 Add `blit` (transparent source pixels do not overwrite, clipped to canvas); verify tests for overlap and off-canvas cases

## 3. History and document model

- [x] 3.1 Add `src/pixel/history.ts` with sparse-diff steps, whole-image snapshot steps, `beginStroke`/`endStroke`, undo/redo, redo discard on new edit and a saved-position marker; verify tests for undo/redo of strokes and resizes, branching, and "dirty" clearing when undoing back to the saved state
- [x] 3.2 Add `src/pixel/document.ts` tying `Pixels` + history + selection + clipboard together with edit methods per tool (pencil, erase, fill, shape commit, move/copy, paste, delete, flip, rotate, resize); verify document tests that each edit is exactly one undo step and a no-op fill adds none

## 4. File I/O

- [x] 4.1 Extend `src/io/files.ts` with `pickImage()` and `saveBytes()` (binary, PNG filter, handle reuse, Save As, download fallback); verify the existing text save/open still works and the download fallback is used when the picker API is missing
- [x] 4.2 Add `src/pixel/pngFile.ts` to decode a picked file to `Pixels` (codec first, canvas fallback) and encode for saving; verify a round-trip test keeps every RGBA value including alpha 0 and alpha 128 and that an invalid file raises an error

## 5. Canvas view

- [x] 5.1 Add `src/pixel/view.ts` drawing the image crisply over a checkerboard with fit, wheel zoom about the pointer, middle/Space pan, boundary outline and grid shown only above a minimum pixel size; verify manually in the browser at high and low zoom and with a transparent image
- [x] 5.2 Add pointer-to-pixel hit-testing and the hover readout (coordinate and RGBA); verify a unit test of the coordinate mapping at several zooms and offsets and manual hover check

## 6. Page UI and tools

- [x] 6.1 Build the `src/pixel/main.ts` page shell: nav, toolbar (New, Open, Save, Save As, Undo, Redo, Flip H/V, Rotate, Resize, Grid, Fit), tool buttons, colour picker with alpha and recent colours, status row; verify the page loads with a transparent 32x32 canvas
- [x] 6.2 Wire Pencil (gap-free strokes, exact replace, one step), Eraser and right-click erase, Eyedropper and Alt+click; verify manually and with the document tests from 3.2
- [x] 6.3 Wire Fill, Line and Rectangle (outline/filled toggle, preview while dragging, Shift constraints, Esc cancels, commit on release); verify the image is unchanged until release and each is one undo step
- [x] 6.4 Wire Select (marquee, move, Alt-drag copy, Ctrl+C/V, Del, Esc, deselect on outside click); verify moving off-canvas clips and a move is one undo step
- [x] 6.5 Wire Flip and Rotate buttons to the selection or whole canvas; verify canvas rotation swaps size and undo restores it
- [ ] 6.6 Add the New dialog and Resize dialog (width, height, 3x3 anchor picker, validation messages); verify invalid sizes are rejected with a message and a resize is one undo step that clears the selection
- [ ] 6.7 Add keyboard shortcuts (P, E, I, G, L, R, S, X, Y, [, ], Ctrl+Z/Y/Shift+Z, Ctrl+C/V, Ctrl+S, Ctrl+O, Ctrl+N) ignored while a text field or dialog has focus; verify typing in the resize width field does not switch tools
- [ ] 6.8 Add the `beforeunload` unsaved-changes guard and unsaved confirmation on New/Open; verify it appears only when the history is not at the saved position

## 7. Verification

- [ ] 7.1 Run `npm test` and `npm run build`; verify both pass with no TypeScript errors
- [ ] 7.2 Manual end-to-end pass in the browser: open a PNG, draw with every tool, move/flip/rotate a selection, rotate and resize the canvas, undo all the way back, save and reopen; verify the saved PNG matches what the editor showed and the map page still works via the nav bar

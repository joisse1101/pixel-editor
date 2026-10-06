## 1. Model

- [x] 1.1 Add `createBlankProject(tileSize, name)` and `isMapEmpty(project)` in `src/model/` and verify unit tests: blank project has one empty layer, no sheets, given tile size/name; `isMapEmpty` is true for blank, false once any layer has a cell
- [x] 1.2 Add `tileSizeImpact(project, n)` returning attribute count and sheets whose size is not a multiple of `n`, and verify unit tests cover no sheets, sheets with attributes, and partial edges

## 2. Editor

- [x] 2.1 Add `Editor.setTileSize(n)`: rejects non-positive/non-integer values, refuses when the map has tiles, otherwise clears all sheet attributes, updates `tileSize`, sets `dirty`, fires `onChange`; verify `tests/editor.test.ts` cases for each outcome (including that tiles-present leaves the project unchanged)

## 3. App wiring

- [x] 3.1 Extract `adoptProject(project, name, handle)` from `loadText()` in `src/main.ts`, make `loadText` use it, and verify opening `office/Office.json` still loads 10 layers / 1850 tiles and existing tests pass
- [x] 3.2 Start with a blank project (tile size 16, "Untitled", no handle, clean) and show the "import a sprite sheet" status hint when there are no sheets; verify in the browser that painting tools, Save and sheet import are enabled on load and closing the tab does not prompt
- [x] 3.3 Add the New button, Ctrl+N and the New dialog (tile size + name, inline validation, Enter/Escape), with the unsaved-changes confirm; verify creating a 32px "Dungeon" canvas, an invalid size keeping the dialog open, and cancelling keeping the current project
- [x] 3.4 Add the Tile size control: disabled with a tooltip while any tile is placed, re-enabled on erase/undo, disabled in preview; applies via `Editor.setTileSize` with the confirm from `tileSizeImpact` when sheets have attributes or partial edges; verify by importing a sheet, changing size, and checking the palette re-slices and attributes are cleared after confirming

## 4. Verification

- [x] 4.1 Run `npm test` and the type check and verify both pass
- [ ] 4.2 Manually verify end to end: new canvas, import a sheet, paint, save, reopen the saved file (tile size and tiles round-trip), and confirm saving a never-saved canvas prompts for a location

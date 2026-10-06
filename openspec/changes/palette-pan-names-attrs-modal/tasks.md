## 1. Sheet names

- [ ] 1.1 Add optional `name` to `SpriteSheet`, read it from and write it to the Office.json sheet entry (not duplicated via `extra`); verify with a round-trip unit test and that a sheet without a name saves without the field
- [ ] 1.2 Name imported sheets after the file name without extension and build selector labels as `<name> (<cols>x<rows>)` with `Sheet N` fallback; verify importing `SpriteSheet.png` shows `SpriteSheet (40x26)` for a 40x26-tile image (unit test for the label helper)

## 2. Pannable sheet viewport

- [ ] 2.1 Wrap the palette canvas in a fixed-size viewport and draw the sheet at a pan offset, with hit testing and selection highlight following the offset; verify a tall sheet no longer makes the right panel scroll
- [ ] 2.2 Pan with middle/right drag, Space + left drag and the wheel, clamped to the sheet and reset on sheet change; verify left drag never moves the sheet and a left click still selects the clicked tile (manual check)

- [ ] 2.3 Add palette zoom (Ctrl + wheel and +/- buttons, whole steps 1x-8x, per sheet, default fit) with hit testing and highlight using the zoomed tile size; verify clicking a tile at 1x, 4x and 8x selects the tile under the pointer and plain wheel still pans (manual check)

## 3. Rename and reorder

- [ ] 3.1 Add a Rename button using a prompt that updates the label immediately and ignores empty input; verify the saved Office.json carries the new name and an empty name changes nothing
- [ ] 3.2 Add up/down buttons that move the shown sheet in `project.sheets`, keep it selected and save the order in Office.json; verify save and reopen keep the order and a map with placed tiles renders identically after a move (unit test for the move on first/last edges)

## 4. Attributes modal

- [ ] 4.1 Add the gear button right of the sheet selector, enabled only while a palette tile is selected and disabled after project load or deleting the selected sheet; verify each state manually
- [ ] 4.2 Build the "Edit tile attributes" modal with add/edit/remove rows, saving on edit and flushing on close (Escape, backdrop, Done); verify typing a value then pressing Escape keeps it and it appears in the saved Office.json
- [ ] 4.3 Remove the inline "Tile attributes" section and `renderAttrs()`; verify the build passes and the existing attribute round-trip test still passes

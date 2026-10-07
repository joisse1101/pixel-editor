## Why

Layer order in both the map editor and the pixel art editor is changed with Up/Down buttons that move only the active layer one step at a time. Moving a layer across several positions takes many clicks, and the buttons act on the active layer rather than the layer the user is pointing at. Dragging a layer row to its new position is the direct, familiar way to reorder a list.

## What Changes

- Layer rows in the map editor list and the pixel editor panel become draggable. Dropping a row between two others (or at either end) moves the layer there, with a drop indicator showing the target slot.
- Remove the Up/Down buttons from both editors (`#layer-up` / `#layer-down` in the map editor, the `up` / `down` actions in the pixel layer panel).
- Dragging works with a mouse on desktop only. No touch support and no keyboard reordering are in scope.
- Dragging a row does not change which layer is active, and the active (blue) and yellow layers stay highlighted on the same layers after the move.
- Pixel editor: a drop is one undoable step. The active layer stays active.
- Map editor: reordering keeps its current behaviour (not part of undo history).
- **BREAKING**: the Up/Down buttons are removed, so reordering is possible only by drag and drop.
- Implemented with native HTML5 drag-and-drop in a small shared helper. `react-dnd` is not used because the app has no React.

## Capabilities

### New Capabilities

### Modified Capabilities
- `layer-management`: the "Reorder layers" requirement now specifies drag and drop on the layer list instead of unspecified move controls.
- `pixel-layers`: the "Add, rename, delete and reorder layers" requirement changes from moving a layer up or down with buttons to dragging it to a new position.

## Impact

- `src/main.ts`: map editor `renderLayers`, `moveActiveLayer`, and the `#layer-up` / `#layer-down` markup and listeners.
- `src/pixel/layerPanel.ts`: row rendering, removal of `up` / `down` actions and their disabled-state logic.
- `src/pixel/document.ts`: `moveLayer` currently swaps neighbours only. It needs to accept an arbitrary target index.
- `src/editor/editor.ts`: `moveLayer(from, to)` already supports arbitrary moves.
- New small shared drag-and-drop helper, plus drop-indicator styles in `src/style.css`.
- Tests: `tests/pixelLayers.test.ts` and `tests/editor.test.ts` cover moving a layer.
- No new dependencies. File formats are unchanged.

## Why

The map has three separate tools (Paint, Erase, Select) and Select can only pick one placed tile. Building maps needs block stamps, rectangle fill and delete, and moving or copying regions, ideally across several layers at once. Merging the tools around the mouse buttons makes these direct gestures and removes mode switching.

## What Changes

- **BREAKING** Remove the Paint, Erase and Select tool buttons and the `B`, `E`, `V` shortcuts. There is one mode-less tool driven by whether a brush is active.
- **BREAKING** The right mouse button no longer pans (map and palette); it deletes on the map. Panning stays on middle-drag, Space+left-drag and the wheel.
- Palette: left-drag selects a rectangular block of tiles that becomes the brush; a click still picks one tile.
- Map with a brush: left-click stamps, left-drag paints freehand, Shift+left-drag fills a rectangle by tiling the brush pattern from the start corner.
- Map without a brush: left-drag draws a marquee selection; dragging inside the selection moves it (Alt-drag copies); Ctrl+C / Ctrl+V copy and paste; Del deletes the selection.
- Right-click and right-drag delete tiles; Shift+right-drag deletes a rectangle.
- Layer panel: left-click sets the blue (primary) layer and clears all yellow layers; right-click on another row toggles it yellow. Painting, stamping and fill affect the blue layer only. Marquee select, move, copy, paste and all deletes act on visible blue and yellow layers. Hidden layers are skipped. Paste returns each tile to its source layer.
- Esc clears the brush, or the selection when there is no brush.
- Flip and rotate apply to the whole block (brush or selection), re-laying out its cells.
- Add a "?" help icon in the top bar; hovering it shows all mouse and keyboard controls, since the new gestures have no buttons.

## Capabilities

### New Capabilities

- `controls-help`: top bar "?" icon whose hover panel lists every mouse and keyboard control.

### Modified Capabilities

- `tile-editing`: replaces "Paint tiles" and "Erase tiles" with unified brush, stamp, rectangle fill and delete behavior; adds selection, move, copy and paste; extends flip and rotate to blocks; extends undo to these gestures.
- `palette-panel`: adds block selection by left-drag; removes right-button panning from the "Pannable sheet viewport" requirement.
- `layer-management`: adds the yellow multi-layer set to "Layer list and selection".

## Impact

- `src/main.ts`: toolbar, tool state, shortcuts, pointer handlers, layer list rendering and clipboard.
- `src/render/mapView.ts`: button handling (right button stops panning, Shift/Alt modifiers), brush block ghost, selection and marquee drawing.
- `src/editor/editor.ts`: block paint, rectangle fill and delete, multi-layer delete, move and paste as single strokes.
- `src/editor/orientation.ts`: block flip and rotate.
- `src/ui/palette.ts`: drag-selects a block; right button no longer pans.
- `src/style.css`: yellow layer row style.
- Tests in `tests/` for editor operations and block orientation. No file format change: the yellow set and the clipboard are in memory only.

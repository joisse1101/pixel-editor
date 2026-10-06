## Why

The sprite sheet palette makes the whole right panel scroll when a sheet is tall, sheets are labelled `Sheet N` instead of by the file they came from, and tile attributes take permanent space in the panel. The palette should behave like the map (pannable), be identifiable, and keep attribute editing out of the way.

## What Changes

- The sheet viewer becomes a fixed-size viewport with its own pan (middle/right drag, Space + left drag, wheel). Left drag never pans; left click still picks a tile. The panel itself no longer scrolls because of the sheet.
- Imported sheets are named after the PNG file name without extension. The sheet selector shows `<name> (<cols>x<rows>)`, e.g. `SpriteSheet (40x26)`. Sheets without a name keep the `Sheet N (<cols>x<rows>)` label.
- The sheet name is saved in Office.json as an optional extension field, and a sheet can be renamed after import.
- The sheet viewport can be zoomed (Ctrl + wheel and buttons, 1x-8x).
- Sheets can be moved up and down in the list; the order is saved.
- A configure (gear) button to the right of the sheet selector is enabled only while a tile is selected and opens an "Edit tile attributes" modal. The inline "Tile attributes" section is removed.

## Capabilities

### New Capabilities
- `palette-panel`: How the sprite sheet palette is viewed (pan), labelled (sheet names) and how tile attributes are edited (modal).

### Modified Capabilities
<!-- None: openspec/specs is empty while tilemap-editor is unarchived. This refines its tileset-management requirements "Tile palette", "Import sprite sheet" and "Per-tile attributes". -->

## Impact

- `src/ui/palette.ts` (viewport, pan, gear button, labels), `src/main.ts` (import naming, attribute modal replaces `renderAttrs`), `src/style.css`.
- `src/model/types.ts`, `src/model/office.ts`: optional `name` on `SpriteSheet`, round-tripped.
- Office.json gains an optional per-sheet `name` field (Sprite Fusion compatibility is already a non-goal).

## Why

The map is currently a fixed rectangle that has to be resized by hand, and tiles cannot be placed outside it. The map should be an infinite grid you can paint anywhere on, with the export derived from what is painted, and a way to see exactly what will be exported.

## What Changes

- The editing canvas becomes an infinite grid: any cell, including negative coordinates, can be painted; pan and zoom are unbounded.
- **BREAKING**: map resize is removed (Resize button, drop-tiles confirmation, `settings.mapSize`, `settings.mapOrigin`). Existing files that contain those settings load normally; the settings are ignored and not written back.
- Export (Phaser bake) uses the smallest axis-aligned rectangle that contains every filled cell on any layer. Empty cells inside it are 0; nothing outside it is exported. The top-left of that rectangle is exported cell (0,0).
- A Preview button switches the main canvas to a preview mode: no grid, only the baked result with a white bounding box around the exported rectangle. Hidden layers are shown, because the bake ignores visibility. Tools are disabled while previewing; pan and zoom still work. Leaving preview returns to editing.
- Export and Preview are disabled when there are no filled cells.

## Capabilities

### New Capabilities
- `infinite-canvas`: Unbounded editing grid and the rule that the exported extent is the tight bounding box of filled cells.
- `export-preview`: Preview mode that shows exactly what the Phaser export contains.

### Modified Capabilities
<!-- None: openspec/specs is empty while tilemap-editor is unarchived. This supersedes tilemap-editor's "Resizable map" (tile-editing), "Map dimensions" (phaser-export) and the mapSize/mapOrigin parts of "Extension fields" (project-io). -->

## Impact

- `src/model/office.ts`: `getMapBounds` becomes a pure bounding box; `mapSize`/`mapOrigin` removed from `Project`, parsing and serialization.
- `src/editor/editor.ts`: `resizeMap` removed. `src/main.ts`: Resize UI removed, Preview toggle added.
- `src/render/mapView.ts`: unbounded `cellAt`, viewport-wide grid, preview rendering mode, fit-to-content.
- Phaser bake (tilemap-editor tasks 7.x, not yet built): dimensions come from the bounding box.
- tilemap-editor task 4.5 (resize) is superseded and its code is deleted.

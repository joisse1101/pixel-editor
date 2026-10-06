## Why

The office map lives in a Sprite Fusion project (`office/Office.json`) and is baked into `map.json` + `spritesheet.png` for Phaser. Editing it depends on Sprite Fusion, and the bake can't be extended with our own needs (e.g. 90° rotation, new tilesets, resizable map). We want a self-hosted, browser-only editor that loads the raw project, edits it, and saves it back together with fresh Phaser exports.

## What Changes

- New frontend-only browser app (Vite + TypeScript + Canvas); no backend.
- Import `Office.json` (Sprite Fusion native format) and save it back in the same format, preserving all data it already contains.
- Tile editing on a grid canvas: paint, erase, flip (H/V), rotate (0/90/180/270), one tile per cell per layer.
- Layer management: select, show/hide, add, delete, reorder, toggle collider flag.
- Tileset management: use the embedded sprite sheets, import new PNG sheets, edit per-tile attributes (e.g. `interaction=water`).
- Resizable map (starts at 40x26).
- "Bake" export that regenerates `map.json` (Tiled JSON) and `spritesheet.png` from the project, functionally equivalent for Phaser (not byte-identical to Sprite Fusion).
- Office.json is extended with optional fields: tile `rotation`, `settings.mapSize`. Compatibility with reopening the file in Sprite Fusion is explicitly **not** required.

## Capabilities

### New Capabilities
- `project-io`: Import and save Office.json, including optional extension fields and cached `exports` regeneration.
- `tile-editing`: Canvas editing of tiles (paint, erase, flip, rotate, one tile per cell per layer) and map resizing.
- `layer-management`: Layer selection, visibility, add/delete/reorder and collider flag.
- `tileset-management`: Sprite sheet palette, importing new PNG sheets, and per-tile attributes.
- `phaser-export`: Baking map.json and spritesheet.png from the project for Phaser.

### Modified Capabilities
<!-- None: greenfield repo, no existing specs. -->

## Impact

- New code: whole app (greenfield; repo only contains `office/` sample data).
- Dependencies: Vite, TypeScript (dev). No runtime framework planned.
- Data: Office.json gains optional `rotation` on tiles and `settings.mapSize`; map.json/spritesheet.png become generated artifacts.
- Reference data: `office/` (Office.json, map.json, spritesheet.png) serves as the fixture for round-trip and bake verification.

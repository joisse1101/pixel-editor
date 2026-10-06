## 1. Project setup

- [x] 1.1 Scaffold Vite + TypeScript app (no framework) and verify `npm run dev` serves a blank page and `npm run build` succeeds
- [x] 1.2 Add Vitest and a fixture loader for `office/Office.json`, `map.json`, `spritesheet.png`; verify a trivial test reading the fixtures passes

## 2. Project model and IO (project-io)

- [x] 2.1 Define the in-memory model (layers with cell map, sheets with decoded bitmaps and attributes, settings, passthrough bag) and verify it loads the sample with 10 layers, 1850 tiles, 16 sheets (unit test)
- [x] 2.2 Implement Office.json parse with validation errors for missing `layers`/`spriteSheets`/`tileSize` and verify invalid input leaves the loaded project untouched (unit test)
- [x] 2.3 Implement Office.json serialize incl. optional `rotation`, `settings.mapSize` and `settings.mapOrigin`, and verify import -> save -> import yields an equal project and an unedited save preserves all original fields (round-trip test on the sample)
- [x] 2.4 Derive map origin and size from tile bounds when `mapOrigin`/`mapSize` are absent and verify the sample gives origin (21,4) and 40x26 (unit test)
- [x] 2.5 Open/save via File System Access API with download/upload fallback, plus unsaved-changes `beforeunload` warning; verify manually in Chrome and in a browser without the API

## 3. Rendering (tile-editing)

- [x] 3.1 Render visible layers on a canvas in correct stacking (last layer in file at bottom) with flip and rotation, and verify visually against `spritesheet.png` + `map.json` for the sample
- [x] 3.2 Add zoom, pan and optional grid lines; verify wheel zoom and drag pan behaviour manually
- [x] 3.3 Implement the transform helper (flip then rotate on 16x16 pixel data) and verify all 8 orientations against known pixel patterns (unit test)

## 4. Editing tools (tile-editing)

- [x] 4.1 Implement paint (click and drag) enforcing one tile per cell per layer and verify replace behaviour (unit test + manual)
- [x] 4.2 Implement eraser on the active layer only and verify tiles on other layers remain (unit test)
- [x] 4.3 Implement flip H/V and rotate controls for the brush and for placed tiles, with keyboard shortcuts; verify stored `scaleX/scaleY/rotation` values (unit test)
- [x] 4.4 Implement undo/redo with per-stroke diffs and verify a multi-cell stroke reverts in one step (unit test)
- [x] 4.5 Implement map resize (grow/shrink) with confirmation when tiles would be dropped; verify tiles outside the bounds are removed only after confirmation and `mapSize` is saved

## 5. Layers (layer-management)

- [x] 5.1 Build the layer list panel with selection and per-layer visibility toggle saved as `visible: false` in Office.json; verify hidden layers keep their tiles and are still baked for Phaser (unit test)
- [x] 5.2 Add, rename and delete layers (confirm when non-empty); verify via saved Office.json
- [x] 5.3 Reorder layers (drag or up/down buttons) and verify draw order and saved order change accordingly
- [x] 5.4 Collider flag toggle; verify it is written to Office.json and reflected in the bake (covered again in 7.4)

## 6. Tilesets (tileset-management)

- [x] 6.1 Palette panel listing sheets as selectable 16px tile grids; verify selecting a tile sets the brush
- [ ] 6.2 Import PNG as a new sheet (slice by tile size, warn on partial tiles); verify import of a 64x32 PNG yields 8 tiles and is embedded on save (unit test)
- [ ] 6.3 Per-tile attribute editor (add/edit/remove key/value with generated uuid); verify it round-trips in Office.json
- [ ] 6.4 Block deleting a sheet that has placed tiles and show the usage count; verify the message and that unused sheets can be removed

## 7. Phaser bake (phaser-export)

- [ ] 7.1 Implement tile variant rendering and pixel-hash dedupe with first-seen GID assignment; verify the sample bakes to <= 104 unique tiles (unit test)
- [ ] 7.2 Pack the spritesheet 8 columns wide with growing height and verify width 128 and the expected row count for the sample (unit test)
- [ ] 7.3 Build the Tiled JSON (dense data, layers bottom to top, width/height from map size, 0 for empty cells); verify dimensions and data lengths (unit test)
- [ ] 7.4 Emit layer `collider` bool properties and tile `interaction` string properties on all exported variants; verify against the sample's map.json properties (unit test)
- [ ] 7.5 Pixel-equivalence test: render the baked map.json with the baked spritesheet and compare to the editor's rendering of the sample; verify zero differing pixels
- [ ] 7.6 Regenerate `exports.spritesheet` and `exports.tiles` in Office.json on save and verify they match the bake output (unit test)
- [ ] 7.7 "Export for Phaser" button that downloads `map.json` and `spritesheet.png`; verify a Phaser scene can load the downloaded pair (manual smoke test)

## 8. Wrap-up

- [ ] 8.1 Add a README with usage (import, edit, save, export) and the Office.json extension fields; verify the steps work from a clean checkout

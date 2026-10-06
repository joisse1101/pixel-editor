## 1. Bounds without map size

- [ ] 1.1 Make `getMapBounds` a pure bounding box of all filled cells on all layers (hidden included) with an explicit empty result; verify with unit tests for the sample (origin (21,4), 40x26), two distant tiles (16x6) and an empty project
- [ ] 1.2 Remove `mapSize`/`mapOrigin` from `Project`, parsing and serialization, ignoring them on load; verify a file containing them opens, keeps all tiles and saves without either field (unit test)
- [ ] 1.3 Remove `Editor.resizeMap`, the Resize button and its confirmation; verify the build passes and no references remain (grep)

## 2. Infinite grid

- [ ] 2.1 Make `MapView.cellAt` range-free and draw grid lines for the visible cell range only; verify painting at negative cells and far from the content places the tile under the pointer (manual check)
- [ ] 2.2 Make pan and zoom independent of content, and change `fit()` to zoom to the content box (default view when empty); verify with the sample and with an empty project
- [ ] 2.3 Update the status line to show the exported size (bounding box) instead of the map size; verify with the sample ("40x26")

## 3. Preview

- [ ] 3.1 Wire the bake's dimensions to the bounding box (tilemap-editor 7.3 and 7.6) and verify the exported width/height and data lengths for the sample and for two distant tiles (unit test); requires tilemap-editor 7.1-7.3
- [ ] 3.2 Add a Preview mode to `MapView` that draws the baked layers and spritesheet with no grid and a white outline of the exported extent; verify the outline wraps exactly the filled cells and a hidden layer still shows (manual check)
- [ ] 3.3 Add the Preview toggle button: disable tools and editing shortcuts in preview, keep pan and zoom, restore the editing view on exit, and disable the button (and Export) when no cell is filled; verify each state manually, including leaving preview when the last tile is erased via undo

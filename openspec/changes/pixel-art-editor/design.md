## Context

The app is vanilla TypeScript on Vite with a single page: `index.html` loads `src/main.ts`, which builds the whole map-editor DOM and holds module-level state. There is no router. `src/model/pngCodec.ts` already decodes and encodes RGBA PNGs (`Pixels`), `src/io/files.ts` has text open/save with the File System Access API plus a download fallback, and `MapView` shows the pattern for a canvas with pan, zoom and cell hit-testing. `Editor` (undo/redo, layers, sheets) is tile-shaped and is not reusable for raw pixels. See proposal.md for motivation.

The in-flight `unified-select-tool` change rewrites most of `main.ts`, `mapView.ts`, `editor.ts` and `palette.ts`, so this change keeps all pixel code in new files and touches the map page by a few lines.

## Goals / Non-Goals

**Goals:**
- A self-contained pixel page that reuses the PNG codec and file helpers.
- Pure, unit-testable image operations (rasterising, fill, transforms, resize) with no DOM.
- Exact RGBA fidelity from open to save.

**Non-Goals:**
- No sharing of `Editor`, `MapView` or `Palette` classes with the map page; no refactor of `main.ts`.
- No layers, animation, palettes/indexed colour, zoom-to-scale resampling, or brush sizes.
- No link to `Office.json` or the map project's sprite sheets.

## Decisions

**Two Vite entry pages, not a router.** Add `pixel.html` and a `vite.config.ts` with `build.rollupOptions.input` listing both pages. The dev server serves `/pixel.html` without config. A navigation is a normal page load, so the map page needs no mountable-module refactor. Alternative: hash-routed SPA; rejected because it would force restructuring `main.ts`, which `unified-select-tool` is rewriting.

**Shared nav in `src/ui/nav.ts`.** `mountNav(current)` prepends a fixed-height `<nav>` as the first child of `#app`, which is already a full-height flex column, so the existing toolbar and panels flex into the remaining space unchanged. It must be called after `main.ts` sets `#app.innerHTML`. `index.html` keeps its markup; `main.ts` gets one import and one call. The `beforeunload` guard lives in the pixel page only, because the map page has no unsaved-state contract here. Alternative: hand-written nav in each HTML file; rejected as duplicated, though the links themselves are plain `<a href>` so they work without JS.

**Image model: a mutable `Pixels` in a `PixelImage` wrapper.** The editor holds `{ width, height, data: Uint8ClampedArray }` (the codec's `Pixels`) as its single source of truth, so open and save need no conversion. Pure functions in `src/pixel/ops.ts` return new data or mutate a given buffer: `line`, `rectOutline`, `rectFill` (rasterisers returning pixel lists), `floodFill`, `flip`, `rotate`, `resize`, `blit`. Bresenham for lines, so the same function serves the pencil's gap-filling, the Line tool and Shift-45° constraint.

**History by diffs, with whole-image snapshots for size-changing ops.** Most edits touch a few pixels, so a step stores a sparse list of `(index, before, after)` patches built while a stroke is open (`beginStroke` / `endStroke`, mirroring the existing `Editor` API). Resize and canvas rotation change dimensions, so they store `{ before: Pixels, after: Pixels }` snapshots. Large images (4096x4096 = 64 MB) make full snapshots on every step too costly, hence the diff default. A saved-position marker on the history makes "unsaved changes" a comparison of indices, so undoing back to the saved state clears the flag. Alternative: snapshot everything; simpler but slow and memory-hungry for big canvases.

**Preview layer for shapes and floating selections.** Line, Rectangle and moving selections render onto a separate overlay on the view and commit to the image only on release, so a cancelled drag (Esc) costs nothing and a commit is one history step. A floating selection holds `{ x, y, w, h, pixels }`; lifting clears the source (or keeps it for Alt-copy), and dropping blits with "transparent source pixels do not overwrite". Selection state is not in history; commit steps are.

**Transforms operate on a buffer.** `flip(buf, rect)` and `rotate(buf, rect, dir)` take a rect; with no selection the rect is the whole image, and canvas rotation additionally swaps dimensions (a snapshot step). Selection rotation extracts the region, rotates it into a transposed buffer, clears the old region, and blits the result centred on the old centre, clipped. Centre for even/odd size differences uses floor of the old centre minus half the new size, so repeated clockwise then counter-clockwise rotations return to the original rect for square selections and, for non-square ones, may shift by one pixel in one axis; this is accepted and tested.

**Rendering.** A single `<canvas>` draws the image through an offscreen canvas built from `ImageData` with `imageSmoothingEnabled = false`, a checkerboard drawn first, then the grid when the pixel size is at least 6 screen pixels, then overlays. Redraw is on demand (`requestAnimationFrame` coalesced). Pan/zoom logic is a small copy of the `MapView` approach specialised to a bounded image rather than an infinite grid; `MapView` is not imported because its class is tied to `Project`.

**Colour input.** A native `<input type="color">` for RGB and a range input for alpha, plus a recent-colours strip. Alpha is kept separately because `type="color"` has none. Drawing uses the exact `[r,g,b,a]` with no premultiplication, which also means semi-transparent pixels round-trip losslessly through `encodePng`.

**PNG file I/O.** Extend `src/io/files.ts` with `pickImage()` (binary open, `image/png` filter) and `saveBytes()` (binary write, `.png`, same handle/Save As logic as `saveText`), keeping the download fallback via `downloadBytes`. Opening decodes with `decodePng`; on failure (16-bit or interlaced PNG, which the codec rejects) it falls back to drawing through `createImageBitmap` onto an `OffscreenCanvas`, as `render/sheets.ts` already does. The File System Access type shapes in `files.ts` are widened to cover `write(Blob | Uint8Array)`.

**Input mapping.** Left button draws, right button erases (context menu suppressed on the canvas), middle drag and Space+left-drag pan, wheel zooms, Alt+click picks colour, Shift constrains shapes. This matches the map editor's new scheme.

## Risks / Trade-offs

- [Merge conflict with `unified-select-tool` in `main.ts`/`index.html`/`style.css`] -> the map-side edit is one import, one call and a few nav CSS rules in a new `nav.css`/section; land either change first and rebase.
- [Large images make fills and snapshots slow] -> cap canvas at 4096x4096; flood fill uses an explicit stack with a typed-array visited mask; most history steps are sparse diffs.
- [`unified-select-tool` removes right-button panning; pixel page assumes the same] -> pixel page implements its own pointer scheme and does not depend on the map code.
- [Non-square selection rotate may shift by one pixel] -> documented and covered by a test; users can undo.
- [PNG metadata (gamma, text chunks, palette) is dropped on save since the codec writes plain 8-bit RGBA] -> acceptable for pixel art; stated in the UI help text.
- [Browsers without the File System Access API] -> save downloads a new file each time; "Save" then behaves like "Save As".

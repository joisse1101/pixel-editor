## Why

The project only edits tile maps. Sprite sheets and tiles are authored elsewhere and imported as PNGs, so touching up a single pixel means leaving the app. A small standalone pixel art editor next to the map editor closes that gap and reuses the PNG codec and canvas interaction patterns already here.

## What Changes

- Add a second page, `pixel.html`, with its own entry script. The two pages are separate Vite entries; there is no client-side router and no shared state between them.
- Add a top navigation bar on both pages with two links, "Map Editor" and "Pixel Art Editor", the current page highlighted. The map page gets only the nav mount; its toolbar and behavior are unchanged.
- Pixel editor opens a PNG into an editable RGBA canvas, starts blank via a New dialog, and saves the result as a PNG (File System Access API when available, download otherwise).
- Drawing tools: Pencil, Eraser, Eyedropper, Fill, Line, Rectangle (outline or filled) and rectangular Select. Right-click erases. Line and Rectangle preview while dragging and commit on release.
- Colour picker with alpha and a list of recent colours. Pencil writes the exact colour with no blending.
- Select tool: marquee, drag to move, Alt-drag to copy, Ctrl+C / Ctrl+V, Del to clear, Esc to deselect.
- Flip horizontal/vertical and rotate 90° clockwise/counter-clockwise. These act on the selection when there is one, otherwise on the whole canvas. Rotating the whole canvas swaps width and height; rotating a non-square selection turns it around its centre and clips to the canvas.
- Resize canvas to a new width and height with a 3x3 anchor; shrinking crops, growing pads with transparent pixels. This changes the canvas size only and never scales the image.
- Pan, zoom and pixel grid, plus undo/redo where each stroke, shape, move, transform or resize is one step.
- No file format change and no link to `Office.json`; the editor reads and writes plain PNG files only.

## Capabilities

### New Capabilities

- `app-navigation`: top navigation bar shared by the map and pixel pages.
- `pixel-image-io`: new blank image, open PNG, save PNG, and resize canvas with anchor.
- `pixel-drawing`: pencil, eraser, eyedropper, fill, line, rectangle, colour picker with recent colours, and undo/redo.
- `pixel-selection`: rectangular selection, move, copy/paste, delete, and flip/rotate of the selection or whole canvas.
- `pixel-canvas-view`: pan, zoom and pixel grid on the pixel canvas.

### Modified Capabilities

None. The map editor's requirements do not change; it only gains the nav bar, which is covered by `app-navigation`.

## Impact

- New: `pixel.html`, `src/pixel/` (page entry, image model, tools, history, view), `src/ui/nav.ts`, `vite.config.ts` (multi-page `build.rollupOptions.input`), tests under `tests/` for the image model, shape rasterising, fill, transforms, resize and history.
- Reused as-is: `src/model/pngCodec.ts` (`decodePng`, `encodePng`), `downloadBytes` in `src/io/files.ts`. File picking for PNG needs a small addition to `src/io/files.ts` (image type filters and binary write).
- Touched minimally: `index.html` / `src/main.ts` (nav mount) and `src/style.css` (nav styling). These overlap with the in-flight `unified-select-tool` change, which rewrites most of `main.ts`; the edit here is a few lines so conflicts should be trivial.
- No new runtime dependencies.

## Why

The pixel editor holds exactly one image, so comparing several PNGs (versions of a sprite, animation frames) means opening them one at a time and losing the previous one. Layers let several PNGs sit in one document, be toggled on and off to flip between them, and have pixels copied from one to another.

## What Changes

- The pixel document holds an ordered list of layers. All layers always have the same size as the canvas. Layers have no x/y offset.
- A layer panel lists layers (top of the stack first) with a name, an eye toggle (visible/hidden) and a highlight on the active layer. Drawing, fill, eraser, shapes, selection edits, flip and rotate act on the active layer.
- Add, delete, rename, reorder and **duplicate** layer. A document always keeps at least one layer.
- "Add PNG as layers" accepts several files at once; each becomes a layer named after its file. If a PNG is larger than the canvas, the canvas grows to fit (anchored top-left) and every other layer is padded with transparency. An untouched blank document adopts the first PNG's size. Nothing is ever clipped on import.
- Copy across layers uses the existing selection and in-memory clipboard: selection and clipboard survive switching the active layer, and paste lands on the active layer.
- The canvas can be resized by dragging its edges and corners. A live outline and `W x H` readout follow the pointer; releasing applies one undoable resize to all layers. The edge opposite the dragged one stays fixed.
- Save PNG writes the visible layers flattened into one PNG.
- Undo/redo records which layer each edit touched; layer add, delete, duplicate, rename and reorder are undoable, and resize snapshots cover all layers. The eye toggle is not an undo step.
- Out of scope: layer offsets or free-floating layers, opacity, blend modes, solo view, a layered file format.

## Capabilities

### New Capabilities
- `pixel-layers`: the layer stack in the pixel editor: layer panel, active layer, visibility, add/delete/rename/reorder/duplicate, per-layer history, and the rule that all layers share the canvas size.

### Modified Capabilities
- `pixel-image-io`: opening PNGs becomes importing several PNGs as layers with grow-to-fit; Save PNG flattens visible layers; New image and Open (replace) reset to a single layer; canvas resize applies to all layers.
- `pixel-canvas-view`: visible layers are composited in stack order over the checkerboard; the canvas edges and corners are draggable to resize.
- `pixel-selection`: selection and clipboard persist across active-layer changes; all selection edits act on the active layer only.

## Impact

- `src/pixel/document.ts`, `history.ts`: pixel storage moves from one `px` to a layer list; history steps carry a layer reference and resize snapshots hold all layers. `doc.px` stays as the active layer's pixels so tools and ops keep working.
- `src/pixel/view.ts`: composite visible layers; edge/corner hit zones, resize cursor and resize preview.
- `src/pixel/main.ts`, `pixel.html`, `src/style.css`: layer panel, multi-file import, duplicate/add/delete controls, flatten on save.
- `src/pixel/ops.ts`: reuses `resize` with a per-axis anchor; may gain a flatten helper.
- Tests under `tests/` for document, history, import grow-to-fit and flatten.
- No change to the tile-map editor (`src/editor`) or its `layer-management` spec. No new dependencies.

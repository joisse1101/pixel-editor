## Why

Importing a PNG adds it as a layer, but the link to the file it came from is lost. To write an edited layer back, the user has to hide every other layer and use Save As, which flattens the visible stack and asks for a location. A one-click "save this layer back to its file" makes layers usable for editing individual source images.

## What Changes

- Importing a PNG through the browser's file picker records that file's handle and name on the new layer.
- A save icon appears on the row of each layer that has a handle, beside the eye toggle. Clicking it writes that layer alone to its original file.
- The saved PNG is the whole canvas-sized layer at full opacity, whatever the layer's visibility or 50% transparency. If the canvas grew after the import, the file is overwritten with the larger size.
- A layer with no handle shows no icon: browsers without the File System Access API, layers that were not imported, and duplicates.
- Duplicating a layer does not copy the link, so a copy cannot overwrite the original file.
- While two or more layers are linked and the user has not yet done Save As, the document's Save (button and shortcut) is disabled. Save As stays enabled, and its chosen file becomes the target for later Save.
- Saving a layer does not touch the document's saved/unsaved state, the main file handle, or the history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pixel-image-io`: Open PNG links each imported layer to its source file when a handle is available; new requirement for saving a single layer back to that file; Save PNG is disabled until Save As when two or more layers are linked.
- `pixel-layers`: the layer panel shows the save icon on linked layers; Duplicate does not copy the link.

## Impact

- `src/pixel/history.ts`: `Layer` gains an optional source link (file handle and name).
- `src/pixel/document.ts`: `addLayers` accepts and stores the link; `duplicateLayer` leaves it off.
- `src/pixel/main.ts`: `importImages` passes the picked handles through; Save is enabled or disabled from the linked-layer count (button and Ctrl+S); a layer-save handler encodes the layer's pixels and writes them to its handle.
- `src/pixel/layerPanel.ts` and `src/style.css`: the per-row save icon and its click handling.
- No new dependencies. Not part of the project file; the link lives in memory only.

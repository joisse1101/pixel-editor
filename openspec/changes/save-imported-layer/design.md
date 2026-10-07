## Context

See proposal.md for motivation. Today `importImages` (`src/pixel/main.ts`) decodes each picked PNG and calls `doc.addLayers`; the picked `FileHandle` is only kept as the document-level `handle` when a single file is opened into a blank document. A `Layer` (`src/pixel/history.ts`) is `{id, name, visible, opacity?, px}`. Every layer is canvas-sized, and `flatten`/`encodePng` ignore opacity, so encoding one layer's `px` already yields a full-opacity file regardless of visibility.

Structural edits (rename, move, resize, add-import) rebuild layers with `{ ...l, ... }`, and history snapshots hold layer objects, so a property on the layer survives them and comes back on undo of a delete.

## Goals / Non-Goals

**Goals:**
- Per-layer link to the source file, with a one-click save that overwrites it.
- Reuse the existing `saveBytes` / `encodeImageFile` path.

**Non-Goals:**
- Persisting the link across reloads or in the project file (handles are not serialisable here).
- A fallback download or a save picker for unlinked layers.
- Cropping to the original image's size.

## Decisions

**Store the link on the layer.** Add optional `source?: { handle: FileHandle; name: string }` to `Layer`. Alternative: a side map in `main.ts` keyed by layer id. Rejected because the panel and delete/undo behaviour are simpler when the link travels with the layer object. Like `visible` and `opacity`, it is not an undo step.

**`addLayers` takes the link.** Its input becomes `{ name, px, source? }`. `importImages` passes `handle` when non-null, so browsers without the File System Access API (where `handle` is `null`) naturally produce unlinked layers. Duplicate goes through `makeLayer` and does not copy `source`.

**Blank-document import also links the layer.** The existing document-level `handle`/`handleIsSource` logic stays as is; the layer additionally gets its own link. The two are independent, so Save still behaves as before.

**Saving writes the layer's `px` directly.** `saveLayer(layer)` encodes `layer.px` with `encodeImageFile` and calls `saveBytes(bytes, layer.source.handle, layer.source.name, false)`. Because a handle is present, `save` writes in place without a picker. Floating pasted pixels are committed first with `doc.commitFloating()` when the layer is the active one, as `saveImage` does, so the file reflects what is shown. It does not call `doc.markSaved()` and leaves `handle`/`handleIsSource` alone.

**Panel gets a callback.** `LayerPanel` receives an `onSaveLayer(index)` callback rather than the file API, keeping it a view. The icon is a button in the row beside the eye, with `stopPropagation` on click and `draggable` unaffected as for the eye. The refresh key adds whether a layer has a link so the icon appears and disappears correctly.

**Document Save gating.** `saveAllowed()` is false when the number of layers with a `source` is at least 2 and no Save As has completed (`handle === null || handleIsSource`). `refreshStatus` sets `#save.disabled` from it, and the Ctrl+S branch calls `saveImage(false)` only when it is true (Ctrl+Shift+S is unaffected). `refreshStatus` already runs on every change, including undo/redo and layer deletion, so the button follows the count. Alternative: keep the existing "ask for a location" fallback. Rejected because the user wants Save to be unavailable rather than prompting. A completed Save As sets `handleIsSource = false` and a non-null handle, which is the condition that re-enables Save; later imports do not reset it. Without file access there are no linked layers, so Save is never disabled there.

**Write failure.** Errors from `saveBytes` are reported through the existing `message(..., true)` path. A cancelled picker cannot occur because a handle exists. If permission has been revoked, the browser throws and the message is shown.

## Risks / Trade-offs

- [The canvas grew after import, so the file is overwritten with a larger size] → Accepted by the user. The tooltip names the file; the spec states the behaviour.
- [A stale handle (file moved or deleted, permission lost) fails on write] → Error message is shown; the layer and document are unchanged.
- [The link is lost on reload] → Documented non-goal. No icon is shown, so the user is never misled.
- [Clicking the icon next to the draggable row] → Mirror the eye button's `stopPropagation`, and test that the active layer does not change.

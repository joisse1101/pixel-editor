## Context

See proposal.md. `main.ts` holds `project`/`editor` as nullable and only `loadText()` builds them; every control is disabled while they are null. `Project` is a plain object (`model/types.ts`) and `tileSize` is read by sheet slicing (palette, attribute modal), the bake and the view. Sheet attributes are keyed by tile id, which depends on slicing.

## Goals / Non-Goals

**Goals:**
- A blank project is a first-class project: save, export, paint and sheet import all work.
- One code path for installing a project, whether opened or created.
- The "map must be empty" rule is enforced in the model, not only in the UI.

**Non-Goals:**
- Persisting or restoring the previous session on startup.
- Changing tile size when tiles are placed (no rescaling or re-slicing of placed tiles).
- Undo/redo of tile-size changes.
- Changing the file format.

## Decisions

- **Blank project factory** in `model/`: `createBlankProject(tileSize, name)` returns `sheets: []`, one empty layer, empty `settings`, `exports` and `extra`, fresh ids. Alternative of a bundled blank `Office.json` through the parser was rejected: it adds a fake file and a parse step for no benefit.
- **`isMapEmpty(project)`** (every `layer.cells.size === 0`) lives in `model/` next to the bounds helpers so UI and editor share it. It checks cell counts, not `getMapBounds`, because bounds may also reflect `settings.mapSize`.
- **`Editor.setTileSize(n)`** validates (positive integer), refuses if `!isMapEmpty`, clears every sheet's `attributes`, sets `project.tileSize`, sets `dirty`, calls `onChange`, and returns a result object (`{changed, reason?}`), mirroring `deleteSheet`. The warning decision stays in `main.ts` via a pure `tileSizeImpact(project, n)` helper returning `{attributeCount, partialSheets}` so it is unit-testable; the editor does not prompt. The change is not pushed on the undo stack: it would have to snapshot attributes, and the confirm dialog covers the risk. The UI warning says so.
- **`adoptProject(project, name, handle)`** extracted from `loadText()`: creates `Editor`, wires `onChange`, resets `activeLayer`, `brush`, `fileName`, `fileHandle`, palette, view and tool. `loadText` keeps parsing/decoding and the dirty confirm; New does its own dirty confirm then calls `adoptProject` with `handle = null`. Startup calls it with a blank project, never prompting.
- **Dirty state**: a blank project starts clean, so `beforeunload` does not nag on an untouched startup canvas. With no handle, saving behaves like Save As; the suggested file name stays `Office.json`.
- **New dialog** reuses the `<dialog>` pattern of the attribute modal: number input and text input, inline error, Enter confirms, Escape cancels.
- **Tile size control** sits in the toolbar next to the grid toggle; refreshed in `refresh()` so it re-enables when the last tile is erased (including via undo/redo). It is also disabled in preview mode.
- **Map rectangle settings** (`mapOrigin`, `mapSize`, in cells) are left untouched on a tile-size change since they are cell-based.
- **Empty-sheet hint**: when the project has no sheets, the status line says to import a sprite sheet. No automatic file picker.

## Risks / Trade-offs

- [Clearing attributes is destructive and not undoable] → Only happens after an explicit confirm that names the count; skipped when there are none.
- [Blank startup loses the "empty disabled" cue] → Status hint replaces it.
- [Tile size change not undoable] → Only possible on an empty map, so redoing costs a single edit.
- [Default of 16 may be wrong for a user] → They can change it while empty, or choose it in New.

## Migration Plan

None: no data or format change. Rollback is reverting the change.

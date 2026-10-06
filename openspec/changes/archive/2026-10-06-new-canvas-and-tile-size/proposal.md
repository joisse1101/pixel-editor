## Why

The editor starts empty and disabled: the only way to begin is to open an existing `Office.json`. There is no way to start a map from scratch, and a project's tile size is fixed by whatever file was opened.

## What Changes

- The editor starts with a blank, ready-to-edit canvas instead of the disabled empty state.
- New "New" action (button and Ctrl+N) opens a dialog asking for tile size and project name, then replaces the current project with a blank one (with the existing unsaved-changes confirmation).
- New "Tile size" control that changes the project's tile size, enabled only while the map has no placed tiles. When sheets are loaded, changing it warns about sheet attributes and partial edge tiles and requires confirmation; confirming clears sheet attributes, which would otherwise point at the wrong tiles.
- Opening and creating a project share one load path, so state reset (layer, brush, tool, file handle, palette, view) is identical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-io`: adds requirements for starting a blank canvas on startup, creating a new canvas on demand, and changing tile size while the map is empty.

## Impact

- `src/main.ts`: startup, shared project-adoption path, New dialog and button, Tile size control, Ctrl+N, hint when no sheets are loaded.
- `src/model/`: blank-project factory and an "is the map empty" check.
- `src/editor/editor.ts`: guarded tile-size change.
- `src/style.css`: dialog and control styling (the UI is built in `main.ts`).
- `tests/`: new unit tests. No file-format change: a blank project saves as a normal `Office.json`.

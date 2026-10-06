## Purpose

Lets the user load a Sprite Fusion `Office.json` project into the editor and save it back, so progress is never trapped in the browser.

## Requirements

### Requirement: Import Office.json
The system SHALL let the user open an `Office.json` file from disk and load its tile size, sprite sheets, layers, tiles, tile attributes and settings into the editor.

#### Scenario: Valid file
- **WHEN** the user selects the sample `office/Office.json`
- **THEN** the editor shows all 10 layers with 1850 tiles in total and lists all 16 sprite sheets

#### Scenario: Invalid file
- **WHEN** the user selects a file that is not valid JSON or lacks `layers`, `spriteSheets` or `tileSize`
- **THEN** the system shows an error message and keeps the previously loaded project unchanged

### Requirement: Save Office.json
The system SHALL export the current project as an `Office.json` file that, when re-imported, yields an identical project state.

#### Scenario: Unedited round trip
- **WHEN** the user imports `Office.json` and immediately saves it
- **THEN** the saved file has the same layers (order, names, collider flags), tiles (id, x, y, spriteSheetId, flips), sprite sheets, tile attributes and settings as the original

#### Scenario: Edited round trip
- **WHEN** the user edits tiles, saves, and re-imports the saved file
- **THEN** the editor shows the same edits

### Requirement: Extension fields
The system SHALL persist tile rotation as an optional `rotation` field (0, 90, 180 or 270), and the map rectangle as optional `settings.mapSize` (`width`, `height` in tiles) and `settings.mapOrigin` (`x`, `y` in absolute cells). A missing rotation SHALL mean 0, a missing origin SHALL mean the minimum tile cell, and a missing size SHALL mean the extent from the origin to the maximum tile cell. The system SHALL NOT add these fields when saving a project that did not set them.

#### Scenario: Legacy file without extensions
- **WHEN** the user imports the sample `Office.json`
- **THEN** all tiles have rotation 0, the map origin is cell (21,4) and the map size is 40x26

#### Scenario: Unedited save
- **WHEN** the user saves the sample without changing the map size or origin
- **THEN** the saved settings contain neither `mapSize` nor `mapOrigin`

#### Scenario: Negative cells
- **WHEN** a file has tiles at negative pixel positions
- **THEN** they are imported and saved at the same positions

### Requirement: Regenerated cached exports
The system SHALL regenerate the `exports` section of `Office.json` (baked spritesheet and tile list) on every save so it is consistent with the saved layers.

#### Scenario: Save after edit
- **WHEN** the user adds a tile not previously used and saves
- **THEN** the saved `exports.tiles` includes an entry for that tile and `exports.spritesheet` contains its pixels

### Requirement: Unsaved changes warning
The system SHALL warn the user before the page is closed or a new project is loaded while there are unsaved changes.

#### Scenario: Close with edits
- **WHEN** the user edits the map and then tries to close or reload the tab
- **THEN** the browser shows a confirmation prompt

### Requirement: Blank canvas on startup
The system SHALL start with a blank, editable project (one empty layer, no sprite sheets, a default tile size of 16) so the user can begin without opening a file. The project SHALL be named "Untitled" and have no associated file until first saved.

#### Scenario: First load
- **WHEN** the editor is opened
- **THEN** a blank project is shown, painting tools, Save, and the sprite sheet import are enabled, and the status area tells the user to import a sprite sheet to start painting

#### Scenario: Saving a never-saved canvas
- **WHEN** the user saves a blank or edited project that was never saved or opened from a file
- **THEN** the system asks where to save it, as with Save As

### Requirement: Create a new canvas
The system SHALL let the user create a new canvas at any time via a New action (button or Ctrl+N). A dialog SHALL ask for the tile size (positive integer, prefilled with the default) and a project name. Confirming SHALL replace the current project with a blank one using those values. Cancelling SHALL leave the current project unchanged.

#### Scenario: Create with custom tile size
- **WHEN** the user chooses New, enters tile size 32 and name "Dungeon", and confirms
- **THEN** a blank project named "Dungeon" with tile size 32 replaces the current one, with a single empty layer, no sheets, undo history cleared, and no associated file

#### Scenario: Invalid tile size
- **WHEN** the user enters a tile size that is empty, zero, negative or not a whole number
- **THEN** the dialog shows an error, stays open, and nothing is replaced

#### Scenario: Unsaved changes
- **WHEN** the user chooses New while the current project has unsaved changes
- **THEN** the system asks for confirmation before replacing it, and cancelling keeps the current project

### Requirement: Change tile size while the map is empty
The system SHALL let the user change the project's tile size only while no layer contains a placed tile. While any tile is placed the control SHALL be disabled with an explanation, and the system SHALL refuse the change regardless of how it is requested. The new value SHALL be a positive integer.

#### Scenario: Empty map
- **WHEN** no layer has any tile and the user sets the tile size to 32
- **THEN** the project's tile size becomes 32, imported sheets are re-sliced at 32, and the project is marked as having unsaved changes

#### Scenario: Map has tiles
- **WHEN** at least one layer has a placed tile
- **THEN** the tile size control is disabled and tells the user to erase all tiles first

#### Scenario: Tiles erased
- **WHEN** the user erases the last placed tile
- **THEN** the tile size control becomes enabled again

#### Scenario: Sheets with attributes or partial edges
- **WHEN** the map is empty, sheets are loaded, and either any sheet has tile attributes or a sheet's size is not a multiple of the new tile size
- **THEN** the system warns that attributes will be cleared and/or partial edge tiles ignored, and applies the change only if the user confirms

#### Scenario: Confirmed change clears attributes
- **WHEN** the user confirms a tile size change on a project whose sheets have attributes
- **THEN** all sheet tile attributes are removed, since they were keyed to the old slicing

#### Scenario: Sheets without attributes
- **WHEN** the map is empty, every sheet is an exact multiple of the new tile size, and no sheet has attributes
- **THEN** the change applies without a warning

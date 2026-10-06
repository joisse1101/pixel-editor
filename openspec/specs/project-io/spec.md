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

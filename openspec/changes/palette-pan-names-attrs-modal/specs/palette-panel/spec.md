## Purpose

Defines how the sprite sheet palette is panned and labelled and how tile attributes are edited, so large sheets are usable without scrolling the whole panel.

## ADDED Requirements

### Requirement: Pannable sheet viewport
The system SHALL show the selected sprite sheet inside a fixed-size viewport that pans independently of the side panel. Middle or right button drag, Space plus left button drag, and the mouse wheel SHALL pan the sheet. Left button drag SHALL NOT pan.

#### Scenario: Large sheet
- **WHEN** the selected sheet is taller than the viewport
- **THEN** the side panel does not scroll because of the sheet and the user can pan to every tile inside the viewport

#### Scenario: Left click picks a tile
- **WHEN** the user presses and releases the left button on a tile
- **THEN** that tile is selected and the sheet does not move

### Requirement: Sheet names from file names
The system SHALL name an imported sprite sheet after the imported file name without its extension, and SHALL list each sheet as `<name> (<columns>x<rows>)` with the size in tiles. Sheets without a name SHALL be listed as `Sheet <n> (<columns>x<rows>)`. The name SHALL be saved in and restored from Office.json.

#### Scenario: Import named file
- **WHEN** the user imports `SpriteSheet.png` that is 40x26 tiles
- **THEN** the sheet selector lists it as `SpriteSheet (40x26)`

#### Scenario: Name survives save
- **WHEN** the project is saved and reopened
- **THEN** the imported sheet is still listed under its file name

#### Scenario: Unnamed sheet
- **WHEN** a loaded sheet has no name
- **THEN** it is listed as `Sheet <n> (<columns>x<rows>)`

### Requirement: Rename sheet
The system SHALL let the user rename any sprite sheet after import. The new name SHALL replace the name in the selector immediately and be saved in Office.json. An empty name SHALL be rejected and leave the name unchanged.

#### Scenario: Rename
- **WHEN** the user renames `SpriteSheet` to `Office tiles`
- **THEN** the selector lists it as `Office tiles (40x26)` and the saved file uses the new name

#### Scenario: Empty name
- **WHEN** the user submits an empty name
- **THEN** the sheet keeps its previous name

### Requirement: Zoom palette
The system SHALL let the user zoom the sheet viewport in steps from 0.125x to 8x (0.125, 0.25, 0.5, 1 and whole numbers up to 8) with Ctrl plus the mouse wheel and with zoom buttons. Tile picking and the selection highlight SHALL stay aligned with the tiles at every zoom level.

#### Scenario: Zoom and pick
- **WHEN** the user zooms to 4x and clicks a tile
- **THEN** the tile under the pointer is selected and highlighted

#### Scenario: Wheel without Ctrl
- **WHEN** the user scrolls the wheel without Ctrl
- **THEN** the sheet pans and the zoom level is unchanged

### Requirement: Reorder sheets
The system SHALL let the user move a sheet up or down in the sheet list. The order SHALL be reflected in the selector and saved in Office.json, and SHALL NOT change any placed tile.

#### Scenario: Move up
- **WHEN** the user moves the third sheet up
- **THEN** it becomes the second entry in the selector, stays selected, and a saved and reopened project lists it second

#### Scenario: Placed tiles unaffected
- **WHEN** a sheet used by placed tiles is moved
- **THEN** the map looks the same as before

### Requirement: Tile attributes modal
The system SHALL provide a configure button next to the sheet selector that is enabled only while a tile is selected. Activating it SHALL open an "Edit tile attributes" modal that shows a preview of the selected tile and in which attributes of the selected tile can be added, edited and removed. Edits SHALL NOT be lost when the modal is closed by any means.

#### Scenario: Nothing selected
- **WHEN** no tile is selected (for example right after opening a project)
- **THEN** the configure button is disabled

#### Scenario: Edit attributes
- **WHEN** a tile is selected and the user opens the modal and sets `interaction = door`
- **THEN** the attribute is stored on that tile and appears in the saved Office.json

#### Scenario: Close with pending edit
- **WHEN** the user types a value and closes the modal with Escape or a click outside it
- **THEN** the typed value is kept

#### Scenario: Selected sheet deleted
- **WHEN** the sheet that holds the selected tile is deleted
- **THEN** the configure button becomes disabled

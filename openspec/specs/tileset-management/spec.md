## Purpose

Provides the tile palette from sprite sheets, lets users import new sheets, and edit attributes attached to individual tiles.

## Requirements

### Requirement: Tile palette
The system SHALL display the tiles of each sprite sheet as a selectable grid sliced at the project tile size.

#### Scenario: Choose tile
- **WHEN** the user opens a sprite sheet and clicks one of its tiles
- **THEN** that tile becomes the tile used by the paint tool

### Requirement: Import sprite sheet
The system SHALL let the user import a PNG image as a new sprite sheet, slice it by the project tile size, and make it available in the palette and in saved projects.

#### Scenario: Import valid sheet
- **WHEN** the user imports a 64x32 PNG in a project with tile size 16
- **THEN** a new sheet with 8 tiles appears in the palette and is embedded in the saved Office.json

#### Scenario: Dimensions not a multiple of tile size
- **WHEN** the user imports a PNG whose width or height is not a multiple of the tile size
- **THEN** the system warns the user and ignores the partial tiles at the right and bottom edges

### Requirement: Per-tile attributes
The system SHALL let the user view, add, edit and remove key/value attributes (for example `interaction = water`) on a sprite sheet tile, and these attributes SHALL apply to every placement of that tile.

#### Scenario: Add attribute
- **WHEN** the user sets `interaction = door` on a tile
- **THEN** the saved Office.json lists the attribute under that sheet and tile id, and the baked map.json carries the same property

### Requirement: Remove unused sheets
The system SHALL prevent deleting a sprite sheet that is used by placed tiles.

#### Scenario: Delete in-use sheet
- **WHEN** the user tries to delete a sheet that has tiles placed on the map
- **THEN** the system refuses and tells the user how many tiles use it

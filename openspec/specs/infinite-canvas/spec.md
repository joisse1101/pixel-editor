## Purpose

Defines the unbounded editing grid and how the exported map extent is derived from the filled cells, so no manual map sizing is needed.

## Requirements

### Requirement: Infinite editing grid
The system SHALL let the user paint, erase and select on any cell of the grid, including cells with negative coordinates, with no map size limit. The grid SHALL be shown across the whole visible canvas and pan and zoom SHALL NOT be bounded by the content.

#### Scenario: Paint far from existing tiles
- **WHEN** the user pans away from all existing tiles and paints a tile
- **THEN** the tile is placed on the cell under the pointer

#### Scenario: Paint at negative coordinates
- **WHEN** the user paints on a cell left of or above the first tile of the loaded sample
- **THEN** the tile is placed there and saved at that absolute cell

### Requirement: No map resize
The system SHALL NOT offer resizing the map and SHALL NOT drop tiles because of a map size. Files that contain `settings.mapSize` or `settings.mapOrigin` SHALL load without error, with those settings ignored and not written back.

#### Scenario: Legacy settings
- **WHEN** a file containing `settings.mapSize` and `settings.mapOrigin` is opened and saved
- **THEN** every tile is kept and the saved settings contain neither field

### Requirement: Exported extent is the tight bounding box
The system SHALL export the smallest axis-aligned rectangle of cells that contains every filled cell on any layer. Cells inside the rectangle without a tile SHALL be exported as empty, no cell outside it SHALL be exported, and the rectangle's top-left cell SHALL be exported cell (0,0). Layer visibility SHALL NOT affect the rectangle.

#### Scenario: Sample project
- **WHEN** the user exports the sample whose tiles span cells x 21-60, y 4-29
- **THEN** the exported map is 40x26 with data arrays of 1040 entries

#### Scenario: Two distant tiles
- **WHEN** only a tile at (-5,3) and a tile at (10,-2) are filled
- **THEN** the exported map is 16x6 and the tiles are at exported cells (0,5) and (15,0)

#### Scenario: Hidden layer
- **WHEN** a hidden layer holds the only tile outside the other layers' extent
- **THEN** that tile is still inside the exported rectangle

#### Scenario: Empty project
- **WHEN** no cell is filled
- **THEN** the export action is disabled

## MODIFIED Requirements

### Requirement: Pannable sheet viewport
The system SHALL show the selected sprite sheet inside a fixed-size viewport that pans independently of the side panel. Middle button drag, Space plus left button drag, and the mouse wheel SHALL pan the sheet. Left button drag SHALL NOT pan, and the right button SHALL NOT pan.

#### Scenario: Large sheet
- **WHEN** the selected sheet is taller than the viewport
- **THEN** the side panel does not scroll because of the sheet and the user can pan to every tile inside the viewport

#### Scenario: Left click picks a tile
- **WHEN** the user presses and releases the left button on a tile
- **THEN** that tile is selected and the sheet does not move

#### Scenario: Right drag does not pan
- **WHEN** the user drags with the right button over the sheet
- **THEN** the sheet does not move

## ADDED Requirements

### Requirement: Block selection
The system SHALL let the user drag with the left button over the sheet to select a rectangular block of tiles, highlighted while selected. The block SHALL become the map brush, keeping the tiles' relative layout. A click without dragging SHALL select a single tile as a 1x1 block. The block SHALL stay within one sheet and SHALL be clamped to the sheet's tile grid.

#### Scenario: Select 3x2 block
- **WHEN** the user drags from one tile to a tile two columns right and one row down
- **THEN** a 3x2 block is highlighted and becomes the brush

#### Scenario: Drag outside the sheet
- **WHEN** the user drags past the sheet edge
- **THEN** the block ends at the last tile inside the sheet

#### Scenario: Single click
- **WHEN** the user clicks one tile
- **THEN** a 1x1 block is selected

#### Scenario: Attributes of a block
- **WHEN** a block larger than 1x1 is selected
- **THEN** the configure button is disabled

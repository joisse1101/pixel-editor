## Purpose

Defines how users place, remove and transform tiles on a grid canvas and how the map dimensions are changed.

## ADDED Requirements

### Requirement: Grid canvas display
The system SHALL render the map on a canvas at tile-size grid resolution, showing visible layers in order, with optional grid lines, and SHALL support zoom and pan.

#### Scenario: Layer stacking
- **WHEN** a project with several visible layers is loaded
- **THEN** layers are drawn so that the last layer in the Office.json is at the bottom and the first at the top, matching the original rendering

### Requirement: Paint tiles
The system SHALL place the selected palette tile on the active layer at the cell under the pointer, and SHALL support dragging to paint multiple cells.

#### Scenario: Paint on empty cell
- **WHEN** the user selects a tile and clicks an empty cell of the active layer
- **THEN** that cell on the active layer contains the tile

#### Scenario: One tile per cell
- **WHEN** the user paints on a cell that already has a tile on the active layer
- **THEN** the existing tile is replaced; the layer never holds two tiles in one cell

### Requirement: Erase tiles
The system SHALL remove the tile at the pointer cell on the active layer only.

#### Scenario: Erase
- **WHEN** the user uses the eraser on a cell that has tiles on two layers
- **THEN** only the tile on the active layer is removed

### Requirement: Flip and rotate
The system SHALL let the user flip tiles horizontally and vertically and rotate them in 90 degree steps, both for the tile to be placed and for tiles already placed.

#### Scenario: Flip before placing
- **WHEN** the user toggles horizontal flip and paints a tile
- **THEN** the placed tile is stored with horizontal flip and drawn mirrored

#### Scenario: Rotate placed tile
- **WHEN** the user rotates a placed tile by 90 degrees
- **THEN** the tile is drawn rotated clockwise 90 degrees in its cell and its stored rotation is 90

### Requirement: Undo and redo
The system SHALL support undo and redo of edit operations.

#### Scenario: Undo paint stroke
- **WHEN** the user paints a stroke across several cells and then undoes
- **THEN** the entire stroke is reverted in one step

### Requirement: Resizable map
The system SHALL let the user change the map width and height in tiles, and SHALL warn before discarding tiles that fall outside the new bounds.

#### Scenario: Grow map
- **WHEN** the user increases the width from 40 to 50
- **THEN** the canvas shows 50 columns and existing tiles are unchanged

#### Scenario: Shrink map
- **WHEN** the user reduces the height and tiles exist outside the new bounds
- **THEN** the system asks for confirmation and, if confirmed, removes those tiles

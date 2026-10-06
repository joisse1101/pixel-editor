## Purpose

Produces the `map.json` (Tiled JSON) and `spritesheet.png` files that Phaser loads, directly from the editor project.

## ADDED Requirements

### Requirement: Export Phaser files
The system SHALL export `map.json` and `spritesheet.png` for the current project from a single user action.

#### Scenario: Export sample
- **WHEN** the user imports `office/Office.json` and exports for Phaser
- **THEN** the downloaded map.json is a 40x26 orthogonal Tiled map with tile size 16 and 10 tile layers, and spritesheet.png is 128 pixels wide

### Requirement: Functional equivalence with source rendering
The exported map SHALL render the same picture as the editor: for every cell and layer, the exported tile's pixels (after flip and rotation) equal the source tile's pixels.

#### Scenario: Pixel comparison
- **WHEN** the exported map.json is rendered layer by layer using the exported spritesheet.png
- **THEN** the result is pixel-identical to the editor's rendering of the same layers

### Requirement: Sheet layout
The system SHALL deduplicate tiles by pixel content, including flipped and rotated variants as distinct tiles when their pixels differ, and pack them left to right, top to bottom in a sheet 8 tiles wide whose height grows as needed.

#### Scenario: Same tile used twice
- **WHEN** the same sheet tile is placed with identical transforms in 50 cells
- **THEN** the exported spritesheet contains it once and all 50 cells use the same tile id

#### Scenario: Flipped variant
- **WHEN** a tile is placed once normally and once horizontally flipped, and the flipped pixels differ
- **THEN** the exported spritesheet contains two tiles and the cells reference different ids

### Requirement: Layer properties
The exported map.json SHALL list layers bottom to top, with each layer's collider flag as a boolean property named `collider`, and SHALL use 0 for empty cells.

#### Scenario: Collider property
- **WHEN** a layer has collider enabled
- **THEN** its layer in map.json has property `collider` of type `bool` and value `true`

### Requirement: Tile attribute properties
The exported tileset SHALL carry each tile attribute as a tile property, using `string` type for text values, on every exported tile derived from a tile that has the attribute.

#### Scenario: Water attribute
- **WHEN** a sheet tile has `interaction = water` and is exported both normally and flipped
- **THEN** both exported tile ids have an `interaction` property with value `water`

### Requirement: Map dimensions
The exported map width and height SHALL equal the editor's map size.

#### Scenario: Resized map
- **WHEN** the user resizes the map to 50x30 and exports
- **THEN** map.json has `width: 50`, `height: 30` and layer data arrays of 1500 entries

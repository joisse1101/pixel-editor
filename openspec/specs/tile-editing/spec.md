## Purpose

Defines how users place, remove and transform tiles on a grid canvas and how the map dimensions are changed.

## Requirements

### Requirement: Grid canvas display
The system SHALL render the map on a canvas at tile-size grid resolution, showing visible layers in order, with optional grid lines, and SHALL support zoom and pan.

#### Scenario: Layer stacking
- **WHEN** a project with several visible layers is loaded
- **THEN** layers are drawn so that the last layer in the Office.json is at the bottom and the first at the top, matching the original rendering

### Requirement: Paint tiles
The system SHALL, while a brush (a block of palette tiles) is active, place the brush on the active (blue) layer with its top-left tile at the cell under the pointer on a left click, and SHALL paint freehand along the pointer path while the left button is dragged. Shift plus left drag SHALL fill the rectangle between the press cell and the current cell by repeating the brush pattern, anchored at the press cell, with tiles clipped at the rectangle edge. Painting SHALL affect the active layer only, regardless of yellow layers. There SHALL be no separate Paint, Erase or Select tool buttons.

#### Scenario: Paint on empty cell
- **WHEN** the user selects a tile and clicks an empty cell of the active layer
- **THEN** that cell on the active layer contains the tile

#### Scenario: One tile per cell
- **WHEN** the user paints on a cell that already has a tile on the active layer
- **THEN** the existing tile is replaced; the layer never holds two tiles in one cell

#### Scenario: Stamp a block
- **WHEN** a 2x2 block brush is active and the user clicks cell (5,5)
- **THEN** cells (5,5), (6,5), (5,6) and (6,6) hold the four tiles in their original layout

#### Scenario: Freehand paint
- **WHEN** a brush is active and the user drags the left button across several cells
- **THEN** the brush is stamped along the path with no gaps

#### Scenario: Tile a rectangle
- **WHEN** a 2x2 block brush is active and the user shift-drags a 6x4 rectangle
- **THEN** the rectangle is filled with the block repeated 3 by 2 times, starting at the press cell

#### Scenario: Clipped pattern
- **WHEN** a 2x2 block brush is active and the user shift-drags a 3x3 rectangle
- **THEN** the pattern repeats and the tiles that fall outside the rectangle are not placed

#### Scenario: Paint only on blue
- **WHEN** layers "Walls" (blue) and "Floor" (yellow) exist and the user paints
- **THEN** tiles are placed on "Walls" only

#### Scenario: Esc clears brush
- **WHEN** a brush is active and the user presses Esc
- **THEN** no brush is active and the map shows no brush ghost

### Requirement: Erase tiles
The system SHALL delete tiles with the right mouse button: a right click or right drag SHALL remove the tiles under the pointer, and Shift plus right drag SHALL remove every tile in the rectangle between the press cell and the current cell. Deletion SHALL apply to the visible blue and yellow layers together and SHALL leave all other layers unchanged. Deletion SHALL work whether or not a brush is active.

#### Scenario: Erase
- **WHEN** the active layer "Walls" and the yellow layer "Floor" both have a tile at a cell and a third layer "Props" also has one, and the user right-clicks that cell
- **THEN** the tiles on "Walls" and "Floor" are removed and the tile on "Props" stays

#### Scenario: Right drag delete
- **WHEN** the user drags with the right button across several cells
- **THEN** the tiles under the path are removed from the blue and yellow layers

#### Scenario: Rectangle delete
- **WHEN** the user shift-right-drags a rectangle
- **THEN** all tiles inside it on the blue and yellow layers are removed

#### Scenario: Hidden yellow layer is skipped
- **WHEN** a yellow layer is hidden and the user right-clicks a cell
- **THEN** that layer's tile is not removed

### Requirement: Flip and rotate
The system SHALL let the user flip tiles horizontally and vertically and rotate them in 90 degree steps, for the brush, for tiles already placed, and for a selection. Applied to a block (a brush or selection larger than 1x1), the operation SHALL transform the block as a whole: the layout of its cells is mirrored or rotated and each tile's own orientation is updated to match.

#### Scenario: Flip before placing
- **WHEN** the user toggles horizontal flip and paints a tile
- **THEN** the placed tile is stored with horizontal flip and drawn mirrored

#### Scenario: Rotate placed tile
- **WHEN** the user rotates a placed tile by 90 degrees
- **THEN** the tile is drawn rotated clockwise 90 degrees in its cell and its stored rotation is 90

#### Scenario: Flip a block brush
- **WHEN** a 2x1 brush with tile A left of tile B is flipped horizontally
- **THEN** stamping it places B on the left and A on the right, each mirrored

#### Scenario: Rotate a selection
- **WHEN** a 2x1 selection is rotated clockwise
- **THEN** it becomes a 1x2 selection with the left tile on top, each tile rotated 90 degrees clockwise

### Requirement: Undo and redo
The system SHALL support undo and redo of edit operations. Each gesture (a click, a drag, a rectangle fill or delete, a move, a paste, a delete of a selection) SHALL be one undo step, even when it changes several layers.

#### Scenario: Undo paint stroke
- **WHEN** the user paints a stroke across several cells and then undoes
- **THEN** the entire stroke is reverted in one step

#### Scenario: Undo move
- **WHEN** the user moves a selection spanning two layers and then undoes
- **THEN** the tiles are back at their original cells on both layers in one step

#### Scenario: Undo rectangle fill
- **WHEN** the user fills a rectangle and then undoes
- **THEN** the whole rectangle is reverted in one step

### Requirement: Resizable map
The system SHALL let the user change the map width and height in tiles, and SHALL warn before discarding tiles that fall outside the new bounds.

#### Scenario: Grow map
- **WHEN** the user increases the width from 40 to 50
- **THEN** the canvas shows 50 columns and existing tiles are unchanged

#### Scenario: Shrink map
- **WHEN** the user reduces the height and tiles exist outside the new bounds
- **THEN** the system asks for confirmation and, if confirmed, removes those tiles

### Requirement: Marquee selection
The system SHALL, while no brush is active, let the user drag the left button on the map to draw a rectangular selection. The selection SHALL cover the cells in the rectangle on the visible blue and yellow layers. A click on a cell without dragging SHALL select that one cell. The selection SHALL be shown as an outline over the map. Esc, or activating a brush, SHALL clear the selection.

#### Scenario: Draw marquee
- **WHEN** no brush is active and the user drags from cell (2,2) to (5,4)
- **THEN** a 4x3 rectangle is selected and outlined

#### Scenario: Brush cancels selection
- **WHEN** a selection exists and the user picks a tile in the palette
- **THEN** the selection is cleared and the picked tile is the brush

#### Scenario: Marquee over empty cells
- **WHEN** the user drags a marquee over cells that hold no tiles
- **THEN** the selection includes those cells, empty or not

### Requirement: Move selection
The system SHALL let the user drag inside an existing selection to move its tiles by whole cells, on the layers they are on, and SHALL leave the selection on the moved tiles. Holding Alt while dragging SHALL copy instead of move. Tiles moved onto occupied cells SHALL replace the existing tiles on that layer.

#### Scenario: Move
- **WHEN** the user drags a selection 3 cells right
- **THEN** its tiles are removed from the original cells and appear 3 cells right on the same layers

#### Scenario: Alt-drag copies
- **WHEN** the user alt-drags a selection 3 cells right
- **THEN** the original tiles remain and copies appear 3 cells right

#### Scenario: Move to negative coordinates
- **WHEN** the user drags a selection so that its tiles land at negative cell coordinates
- **THEN** the tiles are placed there and none are discarded

#### Scenario: Move onto occupied cells
- **WHEN** a moved tile lands on a cell that already has a tile on that layer
- **THEN** the moved tile replaces it

### Requirement: Copy, paste and delete selection
The system SHALL copy the selected tiles with Ctrl+C, grouped by source layer, and paste them with Ctrl+V. After Ctrl+V the pasted tiles SHALL follow the pointer as a preview and be placed on a left click, each onto the layer it was copied from; tiles whose source layer no longer exists SHALL be skipped. Esc SHALL cancel a pending paste. The Delete key SHALL remove the selected tiles. Copy and delete SHALL skip hidden layers. Pasted tiles SHALL replace tiles at their target cells. The grid is unbounded, so moving or pasting SHALL never drop a tile because of its position, including onto negative coordinates.

#### Scenario: Copy and paste across layers
- **WHEN** a selection covers tiles on "Walls" and "Floor", the user presses Ctrl+C, then Ctrl+V and clicks another position
- **THEN** the "Walls" tiles are placed on "Walls" and the "Floor" tiles on "Floor", keeping their relative positions

#### Scenario: Source layer deleted
- **WHEN** the layer a copied tile came from has been deleted before pasting
- **THEN** that tile is not pasted and the rest are

#### Scenario: Cancel paste
- **WHEN** a paste preview is following the pointer and the user presses Esc
- **THEN** nothing is placed

#### Scenario: Delete selection
- **WHEN** a selection exists and the user presses Delete
- **THEN** its tiles on the visible blue and yellow layers are removed as one undo step

#### Scenario: Hidden layer skipped
- **WHEN** a yellow layer is hidden and the user copies or deletes a selection
- **THEN** that layer's tiles are neither copied nor removed

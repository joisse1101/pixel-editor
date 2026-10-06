## Purpose

Defines the pixel-level drawing tools of the pixel art editor, the current colour, and undo and redo, so single pixels can be set, erased and filled exactly.

## Requirements

### Requirement: Current colour
The system SHALL keep one current colour with red, green, blue and alpha components, chosen with a colour picker and an alpha control. Colours the user draws with SHALL be added to a list of recent colours (most recent first, no duplicates, at most 16) that can be clicked to make a colour current. The default colour SHALL be opaque black.

#### Scenario: Pick a colour
- **WHEN** the user chooses (255, 0, 0) with alpha 128
- **THEN** the current colour is (255, 0, 0, 128)

#### Scenario: Recent colours
- **WHEN** the user draws with red, then blue, then red again
- **THEN** the recent list shows red then blue, each once

### Requirement: Pencil
The system SHALL set pixels to the current colour exactly, replacing the previous value with no blending, while the left button is held over them. Fast drags SHALL leave no gaps between sampled pointer positions. A press-drag-release SHALL be one undoable step. The pencil SHALL be the default tool.

#### Scenario: Single click
- **WHEN** the user clicks pixel (2, 2) with current colour (255, 0, 0, 255)
- **THEN** pixel (2, 2) is (255, 0, 0, 255)

#### Scenario: Replace not blend
- **WHEN** the user draws with alpha 128 over an opaque pixel
- **THEN** the pixel's value becomes the current colour including alpha 128

#### Scenario: Fast drag
- **WHEN** the pointer moves from pixel (0, 0) to pixel (10, 3) between two events
- **THEN** every pixel on the straight line between them is set

### Requirement: Eraser
The system SHALL set pixels to fully transparent (0, 0, 0, 0) while the left button is held with the Eraser tool, or while the right button is held with any drawing tool except the Select tool. A press-drag-release SHALL be one undoable step.

#### Scenario: Eraser tool
- **WHEN** the user drags the Eraser over opaque pixels
- **THEN** those pixels become (0, 0, 0, 0)

#### Scenario: Right-click with Pencil
- **WHEN** the Pencil is active and the user right-drags over pixels
- **THEN** those pixels become (0, 0, 0, 0) and the current colour is unchanged

### Requirement: Eyedropper
The system SHALL set the current colour to the exact RGBA of the pixel clicked with the Eyedropper tool. Alt + left-click with the Pencil, Fill, Line or Rectangle tool SHALL do the same. Picking a transparent pixel SHALL set the current colour to (0, 0, 0, 0). The image SHALL NOT change.

#### Scenario: Pick
- **WHEN** the user clicks a pixel (10, 20, 30, 128) with the Eyedropper
- **THEN** the current colour becomes (10, 20, 30, 128) and the history does not grow

### Requirement: Fill
The system SHALL, on click with the Fill tool, replace the 4-connected region of pixels that have exactly the same RGBA as the clicked pixel with the current colour. Filling a region whose colour already equals the current colour SHALL change nothing and add no history step. A fill SHALL be one undoable step and SHALL stay within the canvas.

#### Scenario: Fill transparent area
- **WHEN** the user fills a transparent region bounded by opaque pixels
- **THEN** only the connected transparent pixels change

#### Scenario: Diagonal is not connected
- **WHEN** a same-coloured pixel touches the region only diagonally
- **THEN** it is not filled

#### Scenario: Same colour
- **WHEN** the user fills a region that already has the current colour
- **THEN** no pixel changes and nothing is added to the history

### Requirement: Line
The system SHALL draw a one-pixel-wide straight line in the current colour from the press position to the release position with the Line tool, with no anti-aliasing. While dragging, a preview SHALL be shown and the image SHALL NOT change until release. Holding Shift SHALL constrain the line to horizontal, vertical or 45-degree directions. A line SHALL be one undoable step. Right-drag SHALL erase along the line instead.

#### Scenario: Horizontal line
- **WHEN** the user drags from (1, 4) to (6, 4)
- **THEN** pixels (1,4) through (6,4) are set on release and not before

#### Scenario: Diagonal line
- **WHEN** the user drags from (0, 0) to (3, 3)
- **THEN** pixels (0,0), (1,1), (2,2) and (3,3) are set

#### Scenario: Cancel
- **WHEN** the user presses Esc while dragging
- **THEN** the preview disappears and the image is unchanged

### Requirement: Rectangle
The system SHALL draw an axis-aligned rectangle with opposite corners at the press and release positions with the Rectangle tool, as a one-pixel outline or filled according to a toggle, using the current colour. While dragging, a preview SHALL be shown and the image SHALL NOT change until release. Holding Shift SHALL constrain the shape to a square. Parts outside the canvas SHALL be clipped. A rectangle SHALL be one undoable step. Right-drag SHALL erase the same shape instead.

#### Scenario: Outline
- **WHEN** the user drags from (2, 2) to (6, 5) with outline mode
- **THEN** only the border pixels of that rectangle are set and the interior is unchanged

#### Scenario: Filled
- **WHEN** the user drags from (2, 2) to (6, 5) with filled mode
- **THEN** every pixel from (2,2) to (6,5) is set

#### Scenario: Any drag direction
- **WHEN** the user drags from (6, 5) to (2, 2)
- **THEN** the same rectangle is drawn as dragging from (2, 2) to (6, 5)

#### Scenario: Clipped
- **WHEN** the rectangle extends past the canvas edge
- **THEN** pixels inside the canvas are set and nothing outside is stored

### Requirement: Undo and redo
The system SHALL undo and redo edits one step at a time with Ctrl+Z and Ctrl+Y (also Ctrl+Shift+Z) and with toolbar buttons that are disabled when nothing can be undone or redone. Each stroke, shape, fill, move, paste, delete, flip, rotate and resize SHALL be one step. A new edit after an undo SHALL discard the redo steps. Pure view or colour changes SHALL NOT create steps. The image SHALL count as having unsaved changes whenever it differs from the last saved or opened state by history position.

#### Scenario: Undo a stroke
- **WHEN** the user draws a stroke across 20 pixels and presses Ctrl+Z
- **THEN** all 20 pixels return to their previous values

#### Scenario: Redo
- **WHEN** the user undoes a step and presses Ctrl+Y
- **THEN** the step is applied again

#### Scenario: Branching
- **WHEN** the user undoes a step and then draws something new
- **THEN** redo is no longer available

#### Scenario: Back to saved state
- **WHEN** the user saves, draws, and undoes back to the saved state
- **THEN** the image counts as having no unsaved changes

## MODIFIED Requirements

### Requirement: Copy and paste
The system SHALL copy the selection's pixels from the active layer with Ctrl+C, and paste them with Ctrl+V into the active layer as a new selection at the top-left of the visible canvas area (or at the original position when it is visible) that can be moved before it is committed. The clipboard and the selection rectangle SHALL remain when the active layer changes, so pixels can be pasted into a different layer. Alt + drag inside the selection SHALL move a copy within the active layer, leaving the original in place. Paste and copy-move SHALL each be one undoable step. The clipboard SHALL be in memory only.

#### Scenario: Alt-drag copy
- **WHEN** the user Alt-drags a selection 5 pixels down
- **THEN** the original pixels remain and a copy appears 5 pixels lower

#### Scenario: Copy and paste
- **WHEN** the user copies a selection and presses Ctrl+V
- **THEN** a pasted selection with the same pixels appears and can be dragged

#### Scenario: Paste without a copy
- **WHEN** nothing has been copied and the user presses Ctrl+V
- **THEN** nothing happens

#### Scenario: Paste into another layer
- **WHEN** the user copies a selection on one layer, activates another layer and presses Ctrl+V
- **THEN** the pasted selection appears on the newly active layer and the first layer is unchanged

### Requirement: Flip
The system SHALL mirror pixels horizontally or vertically on request. With a selection, only the selection's pixels on the active layer SHALL be mirrored inside its bounds. Without a selection, the whole canvas SHALL be mirrored, on every layer. A flip SHALL be one undoable step.

#### Scenario: Flip canvas
- **WHEN** no selection exists and the user flips horizontally
- **THEN** on every layer pixel (x, y) takes the value formerly at (width-1-x, y)

#### Scenario: Flip selection
- **WHEN** a 3x2 selection is flipped vertically
- **THEN** its two rows swap on the active layer and nothing outside the selection or on other layers changes

### Requirement: Rotate
The system SHALL rotate pixels 90 degrees clockwise or counter-clockwise on request. Without a selection, the whole canvas SHALL be rotated on every layer, and its width and height SHALL swap. With a selection, the selection's pixels on the active layer SHALL be rotated around the selection's centre within the same canvas, replacing the selection's old area with transparent pixels, writing the rotated pixels (a non-square selection becomes its transposed size), and clipping any part outside the canvas. The selection SHALL follow the rotated pixels. A rotate SHALL be one undoable step.

#### Scenario: Rotate canvas
- **WHEN** a 4x2 canvas with two layers is rotated clockwise with no selection
- **THEN** the canvas becomes 2x4, both layers are rotated, and the top-left pixel of each moves to the top-right

#### Scenario: Rotate square selection
- **WHEN** a 3x3 selection is rotated counter-clockwise
- **THEN** its pixels on the active layer are rotated in place and nothing outside the selection or on other layers changes

#### Scenario: Rotate non-square selection
- **WHEN** a 4x2 selection in the middle of the canvas is rotated clockwise
- **THEN** it becomes 2x4 around the same centre and its former area outside the new shape is transparent

#### Scenario: Rotate clipped
- **WHEN** a rotated selection would extend past the canvas edge
- **THEN** the part outside is discarded and the rest is written

#### Scenario: Undo rotate canvas
- **WHEN** the user undoes a canvas rotation
- **THEN** the previous size and pixels of every layer are restored

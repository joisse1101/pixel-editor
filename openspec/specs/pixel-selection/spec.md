## Purpose

Defines rectangular selection of pixels in the pixel art editor, moving and copying them, and flipping or rotating either the selection or the whole image.

## Requirements

### Requirement: Rectangular selection
The system SHALL let the user drag a rectangle with the Select tool to select the pixels inside it, clipped to the canvas. The selection SHALL be outlined on the canvas. Clicking outside the selection without dragging, or pressing Esc, SHALL clear it. Selecting SHALL NOT create an undo step.

#### Scenario: Marquee
- **WHEN** the user drags from (2, 2) to (5, 4) with the Select tool
- **THEN** the 4x3 pixel region is selected and outlined

#### Scenario: Deselect
- **WHEN** a selection exists and the user presses Esc
- **THEN** the selection is cleared and the image is unchanged

### Requirement: Move selection
The system SHALL, when the user drags inside the selection, lift its pixels and move them with the pointer by whole pixels, leaving fully transparent pixels where they were. Dropping SHALL write the pixels at the new position over what is there, except that fully transparent source pixels SHALL NOT overwrite anything. Parts moved outside the canvas SHALL be clipped. The move SHALL be one undoable step and the selection SHALL follow the pixels.

#### Scenario: Move
- **WHEN** the user drags a selection 3 pixels right
- **THEN** its pixels appear 3 pixels to the right and the old area is transparent

#### Scenario: Overlap with transparent source
- **WHEN** a selection containing transparent pixels is dropped over opaque pixels
- **THEN** the opaque pixels under the transparent source pixels are kept

#### Scenario: Move off the canvas
- **WHEN** a selection is dropped partly outside the canvas
- **THEN** the outside part is discarded and the inside part is written

### Requirement: Copy and paste
The system SHALL copy the selection's pixels with Ctrl+C, and paste them with Ctrl+V as a new selection at the top-left of the visible canvas area (or at the original position when it is visible) that can be moved before it is committed. Alt + drag inside the selection SHALL move a copy, leaving the original in place. Paste and copy-move SHALL each be one undoable step. The clipboard SHALL be in memory only.

#### Scenario: Alt-drag copy
- **WHEN** the user Alt-drags a selection 5 pixels down
- **THEN** the original pixels remain and a copy appears 5 pixels lower

#### Scenario: Copy and paste
- **WHEN** the user copies a selection and presses Ctrl+V
- **THEN** a pasted selection with the same pixels appears and can be dragged

#### Scenario: Paste without a copy
- **WHEN** nothing has been copied and the user presses Ctrl+V
- **THEN** nothing happens

### Requirement: Delete selection
The system SHALL set every pixel in the selection to fully transparent when the user presses Del or Backspace. The delete SHALL be one undoable step and the selection SHALL remain.

#### Scenario: Delete
- **WHEN** a selection exists and the user presses Del
- **THEN** all pixels in it become (0, 0, 0, 0)

### Requirement: Flip
The system SHALL mirror pixels horizontally or vertically on request. With a selection, only the selection's pixels SHALL be mirrored inside its bounds. Without a selection, the whole canvas SHALL be mirrored. A flip SHALL be one undoable step.

#### Scenario: Flip canvas
- **WHEN** no selection exists and the user flips horizontally
- **THEN** pixel (x, y) takes the value formerly at (width-1-x, y)

#### Scenario: Flip selection
- **WHEN** a 3x2 selection is flipped vertically
- **THEN** its two rows swap and nothing outside the selection changes

### Requirement: Rotate
The system SHALL rotate pixels 90 degrees clockwise or counter-clockwise on request. Without a selection, the whole canvas SHALL be rotated and its width and height SHALL swap. With a selection, the selection's pixels SHALL be rotated around the selection's centre within the same canvas, replacing the selection's old area with transparent pixels, writing the rotated pixels (a non-square selection becomes its transposed size), and clipping any part outside the canvas. The selection SHALL follow the rotated pixels. A rotate SHALL be one undoable step.

#### Scenario: Rotate canvas
- **WHEN** a 4x2 canvas is rotated clockwise with no selection
- **THEN** the canvas becomes 2x4 and the top-left pixel moves to the top-right

#### Scenario: Rotate square selection
- **WHEN** a 3x3 selection is rotated counter-clockwise
- **THEN** its pixels are rotated in place and nothing outside the selection changes

#### Scenario: Rotate non-square selection
- **WHEN** a 4x2 selection in the middle of the canvas is rotated clockwise
- **THEN** it becomes 2x4 around the same centre and its former area outside the new shape is transparent

#### Scenario: Rotate clipped
- **WHEN** a rotated selection would extend past the canvas edge
- **THEN** the part outside is discarded and the rest is written

#### Scenario: Undo rotate canvas
- **WHEN** the user undoes a canvas rotation
- **THEN** the previous size and pixels are restored

### Requirement: Keyboard shortcuts
The system SHALL provide shortcuts for the tools and transforms: P pencil, E eraser, I eyedropper, G fill, L line, R rectangle, S select, X flip horizontal, Y flip vertical, [ rotate counter-clockwise and ] rotate clockwise. Shortcuts SHALL NOT fire while a text field or dialog has focus.

#### Scenario: Switch tool
- **WHEN** the user presses L
- **THEN** the Line tool becomes active

#### Scenario: Typing in a field
- **WHEN** the user types "e" in the width field of the resize dialog
- **THEN** the tool does not change

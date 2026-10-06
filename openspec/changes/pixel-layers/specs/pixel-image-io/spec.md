## MODIFIED Requirements

### Requirement: New image
The system SHALL let the user start a new transparent image of a chosen width and height, each a whole number from 1 to 4096. The new document SHALL have a single transparent layer. If the current document has unsaved changes, the system SHALL ask for confirmation first.

#### Scenario: Valid size
- **WHEN** the user creates a new image of 16 by 24
- **THEN** a transparent 16x24 canvas with one layer replaces the current document and the history is cleared

#### Scenario: Invalid size
- **WHEN** the user enters a width of 0, 5000 or a non-integer
- **THEN** the image is not created and the reason is shown

#### Scenario: Unsaved changes
- **WHEN** the user starts a new image while the current one has unsaved edits
- **THEN** the system asks for confirmation and keeps the current document if the user cancels

### Requirement: Open PNG
The system SHALL let the user choose one or more PNG files and add each as a new layer named after its file, above the current layers, in the order the files were chosen. Every pixel's exact RGBA value SHALL be preserved, including fully transparent pixels. Layers SHALL keep the canvas size: if a PNG is wider or taller than the canvas, the canvas SHALL grow to the larger width and the larger height, anchored top-left, and every existing layer SHALL be padded with transparent pixels; a smaller PNG SHALL be placed at the top-left of a transparent layer. A PNG SHALL never be clipped. When the document is a single untouched, fully transparent layer, the first PNG SHALL replace it and the canvas SHALL take that PNG's size. A file that cannot be decoded SHALL be skipped with an error naming it, and SHALL NOT affect the other files or existing layers. The import SHALL be one undoable step, and the canvas SHALL be fitted in view when its size changed.

#### Scenario: Open a sprite
- **WHEN** the user opens a 64x48 PNG into the untouched startup document
- **THEN** the canvas is 64x48 with one layer, and each pixel has the colour and alpha stored in the file

#### Scenario: Import several PNGs
- **WHEN** the user chooses three PNGs of 32x32 for a 32x32 document that has drawing on it
- **THEN** three layers named after the files are added above the existing layer and the canvas stays 32x32

#### Scenario: Larger PNG grows the canvas
- **WHEN** a 48x40 PNG is added to a 32x32 document with two layers
- **THEN** the canvas becomes 48x40, both existing layers keep their pixels at the same coordinates with transparent padding to the right and below, and the new layer holds the PNG

#### Scenario: Smaller PNG is padded
- **WHEN** a 16x16 PNG is added to a 32x32 document
- **THEN** the new layer is 32x32 with the PNG at (0, 0) and transparent elsewhere

#### Scenario: Semi-transparent pixel
- **WHEN** a PNG pixel has RGBA (10, 20, 30, 128)
- **THEN** that pixel reads (10, 20, 30, 128) in the layer

#### Scenario: Not an image
- **WHEN** the user chooses two files, one of which is not a valid image
- **THEN** an error naming the bad file is shown and the valid file is still added

#### Scenario: Undo import
- **WHEN** the user undoes an import that grew the canvas
- **THEN** the added layers are removed and the canvas and layers return to their previous size

### Requirement: Save PNG
The system SHALL save the visible layers composited in stack order as a single PNG whose size equals the canvas size and whose pixels equal the flattened RGBA values. Hidden layers SHALL NOT be included. Where the browser allows choosing a save location, saving again SHALL write to the same file, and "Save As" SHALL ask for a new location. A document that has more than one layer SHALL NOT be written over a file it was opened from until the user has chosen the save location, so a source PNG is never silently replaced by a flattened composite. Otherwise saving SHALL download the file. After a successful save the document SHALL count as having no unsaved changes.

#### Scenario: Round trip
- **WHEN** the user opens one PNG into the startup document, makes no edits and saves
- **THEN** the saved PNG has the same size and the same RGBA values for every pixel

#### Scenario: Edits are saved
- **WHEN** the user draws one pixel in red and saves
- **THEN** the saved PNG contains that red pixel and is otherwise unchanged

#### Scenario: Flatten visible layers
- **WHEN** the document has an opaque red pixel on a top layer over an opaque blue pixel on a lower layer at the same position, and the user saves
- **THEN** the saved PNG has the red pixel there

#### Scenario: Multi-layer save asks where
- **WHEN** the user imports a second PNG into a document opened from "a.png" and presses Save
- **THEN** the system asks for a save location instead of overwriting "a.png"

#### Scenario: Hidden layer excluded
- **WHEN** the top layer is hidden and the user saves
- **THEN** the saved PNG contains only the pixels of the visible layers

### Requirement: Resize canvas
The system SHALL let the user set a new canvas width and height (whole numbers from 1 to 4096) and choose one of nine anchor positions (top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right). The resize SHALL apply to every layer: existing pixels SHALL keep their colour and be positioned relative to the anchor, new pixels SHALL be fully transparent, and pixels outside the new bounds SHALL be removed. The image SHALL NOT be scaled. A resize SHALL be one undoable step and SHALL clear any selection. The same resize SHALL be reachable by dragging the canvas edges, as described in the canvas view capability.

#### Scenario: Grow with top-left anchor
- **WHEN** a 4x4 canvas is resized to 6x6 with the top-left anchor
- **THEN** the old pixels stay at their coordinates and the added row and column are transparent

#### Scenario: Grow with center anchor
- **WHEN** a 4x4 canvas is resized to 8x8 with the center anchor
- **THEN** the old pixels occupy x 2-5 and y 2-5 and the border is transparent

#### Scenario: Shrink with bottom-right anchor
- **WHEN** a 6x6 canvas is resized to 4x4 with the bottom-right anchor
- **THEN** the bottom-right 4x4 region of the old image remains and the rest is removed

#### Scenario: All layers resize together
- **WHEN** a document with three layers is resized
- **THEN** all three layers have the new size and their pixels moved the same way

#### Scenario: Undo
- **WHEN** the user undoes a resize
- **THEN** the previous size and pixels of every layer, including any removed ones, are restored

#### Scenario: Invalid size
- **WHEN** the user enters a width or height of 0 or above 4096
- **THEN** the canvas is not changed and the reason is shown

## MODIFIED Requirements

### Requirement: Pixel-exact display
The system SHALL draw each image pixel as a crisp, unsmoothed square at the current zoom, compositing the visible layers in stack order. Fully transparent pixels, where no visible layer has colour, SHALL be shown over a checkerboard so they can be told apart from opaque black or white.

#### Scenario: High zoom
- **WHEN** the user zooms in on a 16x16 image
- **THEN** each pixel is a sharp square with no interpolation between neighbours

#### Scenario: Transparent pixel
- **WHEN** a pixel has alpha 0 in every visible layer
- **THEN** the checkerboard is visible at that pixel

#### Scenario: Layers composited
- **WHEN** two visible layers overlap at an opaque pixel of the upper layer
- **THEN** the upper layer's colour is shown there

## ADDED Requirements

### Requirement: Drag canvas edges to resize
The system SHALL let the user resize the canvas by dragging its edges and corners. A hit zone of a few screen pixels just outside the image boundary SHALL select an edge (left, right, top or bottom) or a corner, and the pointer SHALL show a resize cursor over it; presses on or inside the image SHALL NOT start a resize, so edge pixels can still be drawn on. Dragging an edge SHALL change that dimension and a corner SHALL change both, with the opposite edge or corner fixed, so existing pixels keep their position relative to the fixed side. The new size SHALL snap to whole pixels and be limited to 1 to 4096. While dragging, the system SHALL outline the new canvas bounds and show its width and height, without changing any layer. Releasing the pointer SHALL apply the resize to all layers as one undoable step and clear any selection; releasing with the size unchanged SHALL do nothing. Pressing Esc during the drag SHALL cancel it. The view SHALL NOT change zoom or pan during the drag.

#### Scenario: Grow to the right
- **WHEN** the user drags the right edge of a 32x32 canvas 8 image pixels outward and releases
- **THEN** the canvas is 40x32, existing pixels keep their coordinates and the new columns are transparent on every layer

#### Scenario: Grow to the left
- **WHEN** the user drags the left edge 4 image pixels outward and releases
- **THEN** the canvas is 4 pixels wider and the existing pixels now sit 4 pixels further right in image coordinates, staying at the same place relative to the right edge

#### Scenario: Shrink from the top
- **WHEN** the user drags the top edge 3 image pixels inward and releases
- **THEN** the top 3 rows of every layer are removed and undo restores them

#### Scenario: Corner drag
- **WHEN** the user drags the bottom-right corner outward by 5 pixels in x and 2 in y
- **THEN** the canvas grows by 5 columns and 2 rows at the right and bottom

#### Scenario: Live preview
- **WHEN** the user is dragging an edge
- **THEN** an outline of the new bounds and its "W x H" size are shown and no layer has changed yet

#### Scenario: Cancel
- **WHEN** the user presses Esc during an edge drag
- **THEN** the canvas keeps its size and no undo step is added

#### Scenario: Limits
- **WHEN** the user drags an edge inward past the opposite edge, or outward beyond 4096
- **THEN** the size is held at 1 or 4096 respectively

#### Scenario: Drawing on the edge row
- **WHEN** the pencil is active and the user presses on a pixel in the outermost row
- **THEN** the pixel is drawn and no resize starts

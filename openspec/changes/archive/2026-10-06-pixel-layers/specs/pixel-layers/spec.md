## Purpose

Lets the pixel art editor hold several images as a stack of layers that share one canvas, so PNGs can be shown, hidden and copied between to compare them.

## ADDED Requirements

### Requirement: Layer stack
The system SHALL keep the pixel document as an ordered stack of one or more layers. Every layer SHALL have exactly the canvas width and height, and layers SHALL have no position offset. Layers SHALL be composited in stack order, the top of the list drawn last, over the transparent checkerboard. A new document SHALL have one transparent layer. The document SHALL never have zero layers.

#### Scenario: Stacking order
- **WHEN** the top layer has an opaque red pixel at (1, 1) and the layer below has an opaque blue pixel there
- **THEN** (1, 1) is shown red

#### Scenario: Transparent pixels show through
- **WHEN** the top layer is transparent at (2, 2) and the layer below is opaque green there
- **THEN** (2, 2) is shown green

#### Scenario: Last layer cannot be deleted
- **WHEN** the document has one layer and the user tries to delete it
- **THEN** the layer remains

### Requirement: Layer panel and active layer
The system SHALL show a panel listing the layers, top of the stack first, each with its name, a visibility toggle and a highlight on the active layer. Clicking a layer SHALL make it active. Drawing, erasing, fill, shapes, eyedropper reads, and selection edits (move, delete, flip, rotate, paste) SHALL act on the active layer only. Switching the active layer SHALL commit any floating pasted or moved pixels to the layer they came from first, and SHALL keep the current selection rectangle and the clipboard.

#### Scenario: Draw on active layer
- **WHEN** "Sprite v2" is active and the user draws a pixel
- **THEN** only "Sprite v2" gains that pixel

#### Scenario: Switch layer keeps selection
- **WHEN** a region is selected on "Sprite v1" and the user clicks "Sprite v2"
- **THEN** "Sprite v2" is active and the same rectangle is still selected

#### Scenario: Switch layer with floating paste
- **WHEN** a pasted selection is still floating on "Sprite v1" and the user clicks "Sprite v2"
- **THEN** the pasted pixels are written to "Sprite v1" as one undoable step before "Sprite v2" becomes active

### Requirement: Layer visibility
The system SHALL let the user show or hide each layer with an eye toggle. A hidden layer SHALL NOT be drawn on the canvas or included when saving, and SHALL remain editable when active. Visibility changes SHALL NOT be undo steps and SHALL NOT mark the document as having unsaved changes.

#### Scenario: Compare two layers
- **WHEN** two layers are loaded and the user hides the top one
- **THEN** only the lower layer's pixels are shown, and showing it again restores the stacked view

#### Scenario: Draw on hidden layer
- **WHEN** the active layer is hidden and the user draws
- **THEN** the pixels are written to that layer and are not shown until it is made visible

### Requirement: Add, rename, delete and reorder layers
The system SHALL let the user add a new transparent layer above the active layer and make it active, rename a layer, delete a layer, and move a layer up or down in the stack. Deleting the active layer SHALL make the nearest remaining layer active; if the layer contains non-transparent pixels the system SHALL ask for confirmation first. Each of these actions SHALL be one undoable step.

#### Scenario: Add layer
- **WHEN** the user adds a layer while "Sprite v1" is active
- **THEN** a transparent layer appears directly above it and becomes active

#### Scenario: Delete layer with pixels
- **WHEN** the user deletes a layer containing pixels and confirms
- **THEN** the layer is removed, and undo restores it with its pixels

#### Scenario: Cancel delete
- **WHEN** the user cancels the confirmation
- **THEN** the layer is kept

#### Scenario: Reorder
- **WHEN** the user moves "Sprite v1" above "Sprite v2"
- **THEN** its pixels are drawn over those of "Sprite v2"

### Requirement: Duplicate layer
The system SHALL let the user duplicate the active layer. The copy SHALL have identical pixels and visibility, be placed directly above the original, be named after it followed by " copy", and become active. Duplicating SHALL be one undoable step.

#### Scenario: Duplicate
- **WHEN** the user duplicates "Sprite v1"
- **THEN** a layer "Sprite v1 copy" with the same pixels appears above it and is active

#### Scenario: Independent edit
- **WHEN** the user draws on "Sprite v1 copy"
- **THEN** "Sprite v1" is unchanged

### Requirement: Copy across layers
The system SHALL keep the in-memory clipboard when the active layer changes, and Ctrl+V SHALL paste into the active layer. Copying SHALL read from the active layer's pixels.

#### Scenario: Copy to another layer
- **WHEN** the user selects a region on "Sprite v1", presses Ctrl+C, clicks "Sprite v2" and presses Ctrl+V
- **THEN** the region's pixels appear as a floating selection on "Sprite v2" and "Sprite v1" is unchanged

### Requirement: Layer-aware undo and redo
The system SHALL record the layer that each pixel edit changed, so that undo and redo restore that layer's pixels whichever layer is active, and SHALL make the layer the edit touched active again. A canvas resize SHALL be one undoable step restoring every layer's size and pixels.

#### Scenario: Undo on another layer
- **WHEN** the user draws on "Sprite v1", switches to "Sprite v2" and presses Ctrl+Z
- **THEN** the pixel on "Sprite v1" is removed and "Sprite v1" becomes active

#### Scenario: Undo resize
- **WHEN** the user undoes a canvas resize of a three-layer document
- **THEN** all three layers return to their previous size and pixels

## Purpose

Defines how the pixel art editor creates, loads, saves and resizes an image. It works on plain PNG files only and is not linked to the map project file.

## ADDED Requirements

### Requirement: Blank canvas on startup
The system SHALL open the pixel editor with a blank, fully transparent image of 32x32 pixels.

#### Scenario: First load
- **WHEN** the pixel editor page opens
- **THEN** a transparent 32x32 canvas is shown and ready to draw on

### Requirement: New image
The system SHALL let the user start a new transparent image of a chosen width and height, each a whole number from 1 to 4096. If the current image has unsaved changes, the system SHALL ask for confirmation first.

#### Scenario: Valid size
- **WHEN** the user creates a new image of 16 by 24
- **THEN** a transparent 16x24 canvas replaces the current image and the history is cleared

#### Scenario: Invalid size
- **WHEN** the user enters a width of 0, 5000 or a non-integer
- **THEN** the image is not created and the reason is shown

#### Scenario: Unsaved changes
- **WHEN** the user starts a new image while the current one has unsaved edits
- **THEN** the system asks for confirmation and keeps the current image if the user cancels

### Requirement: Open PNG
The system SHALL load a PNG file chosen by the user as the editable image, with every pixel's exact RGBA value preserved, including fully transparent pixels. The history is cleared and the image is shown fitted in view. A file that cannot be decoded as an image SHALL leave the current image untouched and show an error. If the current image has unsaved changes, the system SHALL ask for confirmation first.

#### Scenario: Open a sprite
- **WHEN** the user opens a 64x48 PNG
- **THEN** the canvas is 64x48 and each pixel has the colour and alpha stored in the file

#### Scenario: Semi-transparent pixel
- **WHEN** a PNG pixel has RGBA (10, 20, 30, 128)
- **THEN** that pixel reads (10, 20, 30, 128) in the editor

#### Scenario: Not an image
- **WHEN** the user opens a file that is not a valid image
- **THEN** an error is shown and the current image is unchanged

### Requirement: Save PNG
The system SHALL save the image as a PNG whose size equals the canvas size and whose pixels equal the editor's RGBA values. Where the browser allows choosing a save location, saving again SHALL write to the same file, and "Save As" SHALL ask for a new location. Otherwise saving SHALL download the file. After a successful save the image SHALL count as having no unsaved changes.

#### Scenario: Round trip
- **WHEN** the user opens a PNG, makes no edits and saves
- **THEN** the saved PNG has the same size and the same RGBA values for every pixel

#### Scenario: Edits are saved
- **WHEN** the user draws one pixel in red and saves
- **THEN** the saved PNG contains that red pixel and is otherwise unchanged

### Requirement: Resize canvas
The system SHALL let the user set a new canvas width and height (whole numbers from 1 to 4096) and choose one of nine anchor positions (top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right). Existing pixels SHALL keep their colour and be positioned relative to the anchor. Where the canvas grows, new pixels SHALL be fully transparent; where it shrinks, pixels outside the new bounds SHALL be removed. The image SHALL NOT be scaled. A resize SHALL be one undoable step and SHALL clear any selection.

#### Scenario: Grow with top-left anchor
- **WHEN** a 4x4 canvas is resized to 6x6 with the top-left anchor
- **THEN** the old pixels stay at their coordinates and the added row and column are transparent

#### Scenario: Grow with center anchor
- **WHEN** a 4x4 canvas is resized to 8x8 with the center anchor
- **THEN** the old pixels occupy x 2-5 and y 2-5 and the border is transparent

#### Scenario: Shrink with bottom-right anchor
- **WHEN** a 6x6 canvas is resized to 4x4 with the bottom-right anchor
- **THEN** the bottom-right 4x4 region of the old image remains and the rest is removed

#### Scenario: Undo
- **WHEN** the user undoes a resize
- **THEN** the previous size and pixels, including any removed ones, are restored

#### Scenario: Invalid size
- **WHEN** the user enters a width or height of 0 or above 4096
- **THEN** the canvas is not changed and the reason is shown

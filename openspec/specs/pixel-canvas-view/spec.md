## Purpose

Defines how the pixel image is displayed and navigated: zoom, pan, the pixel grid and transparent areas, so individual pixels can be seen and targeted accurately.

## Requirements

### Requirement: Pixel-exact display
The system SHALL draw each image pixel as a crisp, unsmoothed square at the current zoom. Fully transparent pixels SHALL be shown over a checkerboard so they can be told apart from opaque black or white.

#### Scenario: High zoom
- **WHEN** the user zooms in on a 16x16 image
- **THEN** each pixel is a sharp square with no interpolation between neighbours

#### Scenario: Transparent pixel
- **WHEN** a pixel has alpha 0
- **THEN** the checkerboard is visible at that pixel

### Requirement: Zoom and pan
The system SHALL zoom with the mouse wheel around the pointer and pan with middle-button drag or Space + left-drag. A Fit control SHALL scale and centre the whole image in the view. The image SHALL be fitted when an image is opened or created.

#### Scenario: Wheel zoom
- **WHEN** the user scrolls the wheel over a pixel
- **THEN** the zoom changes and that pixel stays under the pointer

#### Scenario: Pan
- **WHEN** the user drags with the middle button
- **THEN** the view moves with the pointer and the image is not edited

### Requirement: Pixel grid
The system SHALL offer a toggleable grid between pixels, on by default, shown only when pixels are large enough for it to be legible. The image boundary SHALL always be outlined.

#### Scenario: Toggle
- **WHEN** the user turns the grid off
- **THEN** no lines are drawn between pixels

#### Scenario: Low zoom
- **WHEN** the zoom is small enough that grid lines would cover the pixels
- **THEN** the grid is not drawn

### Requirement: Pointer position readout
The system SHALL show the image pixel coordinate under the pointer, and the RGBA of that pixel, while the pointer is over the image.

#### Scenario: Hover
- **WHEN** the pointer is over pixel (3, 5)
- **THEN** "3, 5" and that pixel's colour are shown

## Purpose

Lets the user see exactly what the Phaser export will contain before exporting it, without the editing grid getting in the way.

## ADDED Requirements

### Requirement: Preview mode
The system SHALL provide a Preview button that switches the main canvas to a preview of the export and back. In preview the infinite grid SHALL NOT be shown, and the canvas SHALL show only the exported result with a white rectangle outlining exactly the exported extent.

#### Scenario: Enter preview
- **WHEN** the user presses Preview on a project with filled cells
- **THEN** the grid disappears and a white rectangle wraps the smallest rectangle containing all filled cells, with the exported tiles shown inside it

#### Scenario: Leave preview
- **WHEN** the user presses Preview again
- **THEN** the editing grid and tools return with the same pan and zoom as before

### Requirement: Preview matches export
The preview SHALL be produced from the same bake that Export uses, so every layer is drawn as it will be exported, including layers hidden in the editor.

#### Scenario: Hidden layer
- **WHEN** a layer is hidden in the editor and the user opens the preview
- **THEN** that layer's tiles are shown, because the export includes them

#### Scenario: Flipped and rotated tiles
- **WHEN** the map contains flipped and rotated tiles
- **THEN** the preview shows them as the exported spritesheet will render them

### Requirement: Read-only preview
While previewing, the paint, erase and select tools SHALL be disabled; pan and zoom SHALL remain available.

#### Scenario: Click in preview
- **WHEN** the user clicks the canvas in preview mode
- **THEN** no tile changes

### Requirement: Preview availability
The Preview button SHALL be disabled when no cell is filled. If the last filled cell disappears while previewing, the system SHALL return to editing.

#### Scenario: Empty project
- **WHEN** a project has no tiles
- **THEN** the Preview button is disabled

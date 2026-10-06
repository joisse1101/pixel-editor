## Purpose

Lets users organise a map into layers and mark which layers are collidable.

## ADDED Requirements

### Requirement: Layer list and selection
The system SHALL show all layers in a list, in render order, and let the user choose the active layer that edit tools affect.

#### Scenario: Select layer
- **WHEN** the user clicks a layer in the list
- **THEN** it becomes the active layer and subsequent painting affects only it

### Requirement: Layer visibility
The system SHALL let the user show or hide each layer in the editor. Visibility is saved in Office.json as an optional layer field `visible: false` (written only when hidden) and SHALL NOT affect the Phaser export.

#### Scenario: Hide layer
- **WHEN** the user hides the "Wall" layer
- **THEN** its tiles are not drawn, saving writes its tiles with `visible: false`, and the Phaser `map.json` and `spritesheet.png` still include the layer's tiles

### Requirement: Add, rename and delete layers
The system SHALL let the user add a new empty layer, rename a layer and delete a layer.

#### Scenario: Delete layer with tiles
- **WHEN** the user deletes a layer that contains tiles
- **THEN** the system asks for confirmation and, if confirmed, removes the layer and its tiles

### Requirement: Reorder layers
The system SHALL let the user change the stacking order of layers.

#### Scenario: Move layer up
- **WHEN** the user moves "Furniture 1" above "Furniture 2"
- **THEN** its tiles are drawn over those of "Furniture 2" and the order is preserved on save and in the baked map.json

### Requirement: Collider flag
The system SHALL let the user toggle a layer's collider flag.

#### Scenario: Toggle collider
- **WHEN** the user enables the collider flag on "Floor Details"
- **THEN** the saved Office.json has `collider: true` for that layer and the baked map.json has the property `collider = true` on it

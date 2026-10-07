## ADDED Requirements

### Requirement: Save icon on linked layers
The layer panel SHALL show a save icon on the row of every layer that is linked to a source file, beside the visibility toggle, and SHALL NOT show it on other layers. Clicking the icon SHALL save that layer to its file as described in the image I/O capability, and SHALL NOT make the layer active, start a drag, or change the selection. The icon SHALL be shown for hidden and half-transparent layers too, and SHALL have a tooltip naming the file it writes.

#### Scenario: Icon only on linked layers
- **WHEN** the document has an imported linked layer "a" and a layer "Layer 2" created with Add
- **THEN** the row for "a" shows the save icon and the row for "Layer 2" does not

#### Scenario: Save without selecting
- **WHEN** "Layer 2" is active and the user clicks the save icon on "a"
- **THEN** "a" is saved to its file and "Layer 2" is still the active layer

#### Scenario: Hidden layer keeps its icon
- **WHEN** the linked layer "a" is hidden
- **THEN** its row still shows the save icon

## MODIFIED Requirements

### Requirement: Duplicate layer
The system SHALL let the user duplicate the active layer. The copy SHALL have identical pixels and visibility, be placed directly above the original, be named after it followed by " copy", and become active. The copy SHALL NOT be linked to the original's source file. Duplicating SHALL be one undoable step.

#### Scenario: Duplicate
- **WHEN** the user duplicates "Sprite v1"
- **THEN** a layer "Sprite v1 copy" with the same pixels appears above it and is active

#### Scenario: Independent edit
- **WHEN** the user draws on "Sprite v1 copy"
- **THEN** "Sprite v1" is unchanged

#### Scenario: Copy is not linked
- **WHEN** the user duplicates a layer that is linked to "sprite.png"
- **THEN** the copy has no save icon and the original keeps its own

## MODIFIED Requirements

### Requirement: Add, rename, delete and reorder layers
The system SHALL let the user add a new transparent layer above the active layer and make it active, rename a layer, delete a layer, and reorder layers by dragging a layer row in the layer panel and dropping it between two other rows or at either end of the list. While dragging, the system SHALL show where the layer will land. The panel SHALL NOT offer separate move up or move down buttons. Reordering by drag and drop is a mouse interaction; touch and keyboard reordering are not required. Deleting the active layer SHALL make the nearest remaining layer active; if the layer contains non-transparent pixels the system SHALL ask for confirmation first. Each of these actions SHALL be one undoable step. Dragging a layer SHALL NOT change which layer is active.

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
- **WHEN** the user drags "Sprite v1" and drops it above "Sprite v2"
- **THEN** its pixels are drawn over those of "Sprite v2"

#### Scenario: Move across several positions in one drag
- **WHEN** the user drags the bottom layer of a four-layer stack to the top
- **THEN** it becomes the top layer in a single drop, the other layers keep their relative order, and one undo restores the previous order

#### Scenario: Drop indicator
- **WHEN** the user drags a layer over the panel
- **THEN** a visible indicator marks the slot where the layer would be placed

#### Scenario: Drop in place
- **WHEN** the user drops a layer back at its original position, or outside the panel
- **THEN** the order does not change and no undo step is recorded

#### Scenario: Active layer stays active
- **WHEN** "Sprite v2" is active and the user drags "Sprite v1" to a new position
- **THEN** "Sprite v2" is still the active layer, at its possibly shifted position

#### Scenario: No move buttons
- **WHEN** the user looks at the layer panel controls
- **THEN** there are no move up or move down buttons

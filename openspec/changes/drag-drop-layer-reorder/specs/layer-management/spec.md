## MODIFIED Requirements

### Requirement: Reorder layers
The system SHALL let the user change the stacking order of layers by dragging a layer row in the layer list and dropping it between two other rows or at either end of the list. While dragging, the system SHALL show where the layer will land. The layer list SHALL NOT offer separate move up or move down buttons. Reordering by drag and drop is a mouse interaction; touch and keyboard reordering are not required. Dragging a layer SHALL NOT change which layer is active or which layers are yellow.

#### Scenario: Move layer up
- **WHEN** the user drags "Furniture 1" and drops it above "Furniture 2"
- **THEN** its tiles are drawn over those of "Furniture 2" and the order is preserved on save and in the baked map.json

#### Scenario: Move across several positions in one drag
- **WHEN** the user drags the bottom layer of a five-layer list to the top
- **THEN** it becomes the top layer in a single drop and the other four keep their relative order

#### Scenario: Drop indicator
- **WHEN** the user drags a layer over the list
- **THEN** a visible indicator marks the slot where the layer would be placed

#### Scenario: Drop in place
- **WHEN** the user drops a layer back at its original position, or outside the list
- **THEN** the order does not change

#### Scenario: Dragging keeps selection
- **WHEN** "Walls" is blue, "Floor" is yellow, and the user drags "Props" to a new position
- **THEN** "Walls" is still blue, "Floor" is still yellow, and "Props" is not highlighted

#### Scenario: No move buttons
- **WHEN** the user looks at the layer list controls
- **THEN** there are no move up or move down buttons

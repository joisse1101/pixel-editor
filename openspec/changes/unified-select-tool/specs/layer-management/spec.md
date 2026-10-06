## MODIFIED Requirements

### Requirement: Layer list and selection
The system SHALL show all layers in a list, in render order. A left click on a layer SHALL make it the active (blue) layer, which paint, stamp and rectangle fill affect, and SHALL clear every yellow layer. A right click on a layer other than the active one SHALL toggle it as a yellow layer; a right click on the active layer SHALL do nothing. A layer SHALL never be both blue and yellow. Selection, move, copy, paste and delete operations on the map SHALL act on the visible blue and yellow layers together. The yellow set SHALL NOT be saved in Office.json.

#### Scenario: Select layer
- **WHEN** the user left-clicks a layer in the list
- **THEN** it becomes the active layer, is shown highlighted blue, and subsequent painting affects only it

#### Scenario: Add yellow layer
- **WHEN** the user right-clicks the "Floor" layer while "Walls" is active
- **THEN** "Floor" is highlighted yellow, "Walls" stays blue, and painting still affects only "Walls"

#### Scenario: Toggle yellow off
- **WHEN** the user right-clicks a yellow layer
- **THEN** it returns to the plain, unhighlighted state

#### Scenario: Left click clears yellows
- **WHEN** "Walls" is blue, "Floor" and "Props" are yellow, and the user left-clicks "Shadows"
- **THEN** "Shadows" is blue and "Floor" and "Props" are no longer yellow

#### Scenario: Right click on active layer
- **WHEN** the user right-clicks the blue layer
- **THEN** nothing changes

#### Scenario: Deleted layer leaves the set
- **WHEN** a yellow layer is deleted
- **THEN** it is removed from the yellow set and the remaining highlights are unchanged

#### Scenario: Yellow follows reorder
- **WHEN** a yellow layer is moved up in the stack
- **THEN** it stays yellow at its new position

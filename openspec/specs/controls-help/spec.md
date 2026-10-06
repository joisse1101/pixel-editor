# controls-help Specification

## Purpose
Shows every mouse and keyboard control in the editor on demand, so users can discover gestures that have no toolbar button.

## Requirements

### Requirement: Controls help
The system SHALL show a "?" help icon in the top bar. While the pointer hovers over the icon, or the icon has keyboard focus, the system SHALL show a panel listing all available controls, grouped as: palette, map with a brush, map without a brush, deleting, layers, view and navigation, and keyboard shortcuts. The panel SHALL hide when the pointer leaves the icon and the panel, or when Esc is pressed. The listed controls SHALL match the behavior of the editor, including that the right mouse button deletes and does not pan.

#### Scenario: Hover shows controls
- **WHEN** the user hovers the "?" icon
- **THEN** a panel appears listing the controls, including drag to select tiles in the palette, Shift+drag to fill a rectangle, right-click to delete, Shift+right-drag to delete a rectangle, and middle-drag or Space+drag to pan

#### Scenario: Leaving hides the panel
- **WHEN** the pointer moves off the icon and the panel
- **THEN** the panel is hidden

#### Scenario: Keyboard access
- **WHEN** the icon receives keyboard focus
- **THEN** the panel is shown, and Esc hides it

#### Scenario: Panel does not block editing
- **WHEN** the panel is hidden
- **THEN** it does not intercept pointer events over the map

## Purpose

Lets the user move between the map editor and the pixel art editor, which are separate pages, from a navigation bar that is the same on both.

## Requirements

### Requirement: Navigation bar on both pages
The system SHALL show a navigation bar at the top of the map editor page and of the pixel art editor page, with one link to each page labelled "Map Editor" and "Pixel Art Editor". The link of the page being shown SHALL be visually marked as current.

#### Scenario: Map page
- **WHEN** the map editor page is open
- **THEN** both links are shown and "Map Editor" is marked as current

#### Scenario: Pixel page
- **WHEN** the pixel art editor page is open
- **THEN** both links are shown and "Pixel Art Editor" is marked as current

### Requirement: Switching pages
The system SHALL open the other editor when its link is activated. Each page SHALL keep its own state independent of the other.

#### Scenario: Go to the pixel editor
- **WHEN** the user activates "Pixel Art Editor" on the map page
- **THEN** the pixel art editor page opens

#### Scenario: Map editor is unchanged
- **WHEN** the map page is shown with the navigation bar
- **THEN** all of its existing toolbar controls and behavior remain available

### Requirement: Unsaved work warning
The system SHALL warn the user before leaving the pixel editor page, by link or by closing the tab, when the image has unsaved changes.

#### Scenario: Leave with edits
- **WHEN** the pixel image has unsaved edits and the user activates "Map Editor"
- **THEN** the browser asks for confirmation before leaving

#### Scenario: Leave when saved
- **WHEN** the pixel image has no unsaved edits and the user activates "Map Editor"
- **THEN** the map page opens without a prompt

## ADDED Requirements

### Requirement: Imported layer keeps its source file
When a PNG is added through a file chooser that gives write access to the chosen file, the system SHALL remember that file for the new layer, and the layer SHALL stay linked to it for the rest of the session, through renaming, reordering, canvas resizes, undo and redo. A layer SHALL have no linked file when the browser gives no write access to chosen files, when the layer was not imported, and when it was created by duplicating a layer. The link SHALL NOT be stored in any saved file.

#### Scenario: Import with write access
- **WHEN** the user imports "a.png" and "b.png" through a chooser that gives write access
- **THEN** the layers "a" and "b" are each linked to their own file

#### Scenario: Import without write access
- **WHEN** the user imports "a.png" in a browser that cannot write back to chosen files
- **THEN** the layer "a" is added and has no linked file

#### Scenario: Link survives editing the stack
- **WHEN** a linked layer is renamed, moved, or the canvas is resized, and then the user undoes and redoes the change
- **THEN** the layer is still linked to the same file

#### Scenario: Link returns with an undone delete
- **WHEN** the user deletes a linked layer and then undoes the delete
- **THEN** the restored layer is linked to its file again

### Requirement: Save a layer to its source file
The system SHALL let the user save a single linked layer back to the file it was imported from. The file written SHALL be a PNG with the canvas width and height whose pixels equal that layer's pixels exactly, including fully transparent pixels, at full opacity. The layer's visibility, its 50% transparency state, and the other layers SHALL NOT affect the result. Saving SHALL write to the linked file without asking for a location. Saving a layer SHALL NOT change the document's unsaved-changes state, the file the document's own Save writes to, the undo history, or the layer's pixels. If the write fails, the system SHALL show the error and leave the layer unchanged.

#### Scenario: Hidden layer
- **WHEN** a linked layer is hidden and the user saves it
- **THEN** the file holds the layer's pixels at full opacity

#### Scenario: Half-transparent layer
- **WHEN** a linked layer is shown at 50% transparency and the user saves it
- **THEN** every pixel in the file has the same RGBA values as in the layer

#### Scenario: Other layers are left out
- **WHEN** another layer is visible above the linked layer and the user saves the linked layer
- **THEN** the file contains none of the other layer's pixels

#### Scenario: Edited layer
- **WHEN** the user draws a pixel on a linked layer and saves it
- **THEN** the file contains that pixel and is otherwise the layer's content

#### Scenario: Canvas grew after import
- **WHEN** a 16x16 PNG was imported, a larger image then grew the canvas to 48x40, and the user saves the 16x16 layer
- **THEN** the file is overwritten with a 48x40 PNG holding the layer at its original position and transparent pixels elsewhere

#### Scenario: Document state unchanged
- **WHEN** the document has unsaved changes and the user saves a linked layer
- **THEN** the document still counts as having unsaved changes, and the document's Save still writes to the same file as before

#### Scenario: Write fails
- **WHEN** the linked file can no longer be written
- **THEN** an error is shown and the layer and document are unchanged

## MODIFIED Requirements

### Requirement: Save PNG
The system SHALL save the visible layers composited in stack order as a single PNG whose size equals the canvas size and whose pixels equal the flattened RGBA values. Hidden layers SHALL NOT be included. Where the browser allows choosing a save location, saving again SHALL write to the same file, and "Save As" SHALL ask for a new location. A document that has more than one layer SHALL NOT be written over a file it was opened from until the user has chosen the save location, so a source PNG is never silently replaced by a flattened composite. While two or more layers are linked to source files and the user has not yet completed "Save As" for this document, Save SHALL be unavailable, both as a button and as a keyboard shortcut, and "Save As" SHALL stay available. After a successful "Save As", Save SHALL be available again and SHALL write to the file chosen there, even if more linked layers are added later. Otherwise saving SHALL download the file. After a successful save the document SHALL count as having no unsaved changes.

#### Scenario: Round trip
- **WHEN** the user opens one PNG into the startup document, makes no edits and saves
- **THEN** the saved PNG has the same size and the same RGBA values for every pixel

#### Scenario: Edits are saved
- **WHEN** the user draws one pixel in red and saves
- **THEN** the saved PNG contains that red pixel and is otherwise unchanged

#### Scenario: Flatten visible layers
- **WHEN** the document has an opaque red pixel on a top layer over an opaque blue pixel on a lower layer at the same position, and the user saves
- **THEN** the saved PNG has the red pixel there

#### Scenario: Multi-layer save asks where
- **WHEN** the user imports a second PNG into a document opened from "a.png" and presses Save
- **THEN** the system asks for a save location instead of overwriting "a.png"

#### Scenario: Hidden layer excluded
- **WHEN** the top layer is hidden and the user saves
- **THEN** the saved PNG contains only the pixels of the visible layers

#### Scenario: Several linked layers disable Save
- **WHEN** the user imports "a.png" and "b.png" through a chooser with write access, so two layers are linked
- **THEN** the Save button is disabled, the save shortcut does nothing, and Save As is available

#### Scenario: Save As re-enables Save
- **WHEN** the user completes Save As for a document with two linked layers
- **THEN** Save is available and writes to the file chosen in Save As, and saving a single layer still writes to that layer's own file

#### Scenario: Back to one linked layer
- **WHEN** a document without a completed Save As has two linked layers and the user deletes one
- **THEN** Save follows the rules for a document with at most one linked layer

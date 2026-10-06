## Context

Greenfield repo. `office/Office.json` is a Sprite Fusion project; `map.json` + `spritesheet.png` are its Phaser bake (see proposal.md - Why).

Observed format facts that drive the design:
- Office.json layers are listed top to bottom (`Floor` is last = drawn first). map.json lists them bottom to top.
- Tiles are sparse: `{id, x, y, spriteSheetId, scaleX, scaleY}` with pixel `x/y`. `id` is a string index into the named sprite sheet (row-major, sheet width / tileSize columns).
- 16 sprite sheets are embedded as base64 PNG data URLs; attributes are keyed by tile id per sheet (`[{id, key, value}]`).
- The bake has no Tiled flip bits: flipped tiles become separate pixel-transformed tiles in the spritesheet (98 used of 104 slots, 8 columns).
- `exports.tiles[].hash` is a per-tile hash used by Sprite Fusion; we do not need to match it.

## Goals / Non-Goals

**Goals:**
- Lossless Office.json round trip, including fields we don't understand.
- Bake output that renders identically in Phaser.
- Keep everything client side with no framework dependency.

**Non-Goals:**
- Byte-identical bake versus Sprite Fusion.
- Sprite Fusion compatibility of files that use our extensions.
- Autotile rules, GB Studio mode and CRT mode (preserved on round trip, no UI).
- Collaboration, cloud storage, accounts.

## Decisions

**Stack: Vite + TypeScript + Canvas 2D, no UI framework.** One main canvas plus a few panels; a framework adds little. Alternatives: React (nicer panels, more weight), no-build JS (no types for a nontrivial data model).

**Model: keep the Office.json shape in memory.** Layers hold a `Map` keyed by cell (`"x,y"`) for O(1) paint/erase and the one-tile-per-cell rule; serialize back to the sparse array. Unknown top-level and per-object fields are kept in a passthrough bag and written back unchanged. Alternative: normalize to a dense grid, which would lose unknown fields and cost a conversion on save.

**Rotation as `rotation` on the tile (0/90/180/270), flips remain `scaleX/scaleY`.** Effective transform order is flip first, then rotate. Rotation is omitted when 0, so untouched files stay identical to the Sprite Fusion shape. Alternative: encode with the Tiled 3-bit flip scheme (H, V, D). Rejected for the file; baking handles transforms at pixel level anyway.

**Map size in `settings.mapSize`; if absent, derive from tile bounds (rounded up to cover x/y max).** For the sample this gives 40x26, matching map.json. Alternative: auto-fit on every export, rejected because it removes intentional empty margins.

**Bake pipeline (pure functions, no DOM beyond canvas):**

```
 project --> for each tile: key = (sheetId, tileId, flipX, flipY, rot)
         --> render transformed 16x16 pixels (OffscreenCanvas/ImageData)
         --> dedupe by pixel content hash (key of the bytes)
         --> assign gid = index+1 in first-seen order (layers bottom-to-top, row-major)
         --> pack 8 cols x N rows -> spritesheet.png
         --> build Tiled JSON: dense data[w*h], collider props, tile properties
```

Deduping by pixels (not by key) means two different transforms of a symmetric tile share one slot. Alternative: dedupe by key, which wastes slots and is simpler but gives a bigger sheet. Pixels it is, since "functionally equivalent" only needs identical rendering.

**Tile attributes live on the sheet tile.** `perTileInstanceAttributes` is false in the sample, so there are no per-placement attributes and the editor does not support them. On bake, every exported variant of the tile copies its attributes to Tiled `properties`. Attribute ids (uuid) are generated on add.

**Saved `exports` is regenerated on each save** using the same bake, so the file's cache matches its layers. The downloaded `map.json`/`spritesheet.png` come from the same run. Tile hashes in `exports.tiles` use our own hash and are not compared with Sprite Fusion's.

**File access: File System Access API when available, with download/upload fallback.** Chrome/Edge can overwrite the opened file ("save progress"); other browsers download a new file. Alternative: only download, which is simplest but clutters the folder on every save. Export for Phaser always downloads two files.

**Undo/redo: command stack of per-stroke diffs** (list of cell changes), not full snapshots, since the file holds half a megabyte of images.

## Risks / Trade-offs

- [Large base64 sheets make JSON big/slow] -> Decode each sheet once into an `ImageBitmap`, keep the data URL string untouched for saving unless the sheet changes.
- [Rotated tiles in Office.json are meaningless to Sprite Fusion] -> Accepted by the user; documented in the proposal. Opening in Sprite Fusion would show them unrotated.
- [Unknown Sprite Fusion fields get lost] -> Passthrough bag plus a round-trip test on the sample file.
- [Tile id to sheet position assumption (row-major)] -> Verify against the sample: the bake of the sample must reproduce the pixels of map.json/spritesheet.png rendering.
- [Pixel dedupe is O(tiles) hashing per bake] -> 1850 tiles of 16x16 is trivial; no concern at this size.
- [Shrinking map silently deletes work] -> Confirmation prompt plus undo.

## Open Questions

- Whether to offer GID-stable ordering across bakes (so unrelated edits do not renumber tiles in map.json). Can be added later without changing the specs.

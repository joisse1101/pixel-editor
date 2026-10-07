import { blockFromSheetRect, tiledBlock } from './editor/block';
import { Editor, rectOf, type Rect } from './editor/editor';
import { transformBlock, type OrientOp } from './editor/orientation';
import { bakeExports, bakeFiles, bakeProject } from './model/bake';
import { downloadBytes, downloadText, hasFileAccess, pickFile, saveText, type FileHandle } from './io/files';
import { countTiles, createBlankProject, getMapBounds, isMapEmpty, serializeOfficeJson, sheetLabel, sheetNameFromFile, tileSizeImpact, tryLoadProject } from './model/office';
import type { Block, Project } from './model/types';
import { drawTile, MapView } from './render/mapView';
import { decodeSheets } from './render/sheets';
import { Palette, type PaletteSelection } from './ui/palette';
import { mountNav } from './ui/nav';
import { enableDragReorder, slotToPosition } from './ui/dragReorder';
import './style.css';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="toolbar">
    <button id="new-btn" type="button" title="New canvas (Ctrl+N)">New</button>
    <button id="open-btn" type="button" title="Open Office.json (Ctrl+O)">Open</button>
    <input id="open" type="file" accept=".json,application/json" hidden />
    <span class="group">
      <button id="save" type="button" title="Save Office.json (Ctrl+S)">Save</button>
      <button id="save-as" type="button" title="Save as... (Ctrl+Shift+S)">Save As</button>
      <button id="export" type="button" title="Download map.json and spritesheet.png for Phaser">Export for Phaser</button>
    </span>
    <span class="group">
      <button id="flip-h" type="button" title="Flip horizontally (X)">Flip H</button>
      <button id="flip-v" type="button" title="Flip vertically (Y)">Flip V</button>
      <button id="rot-ccw" type="button" title="Rotate counter-clockwise (Shift+R)">&#8634;</button>
      <button id="rot-cw" type="button" title="Rotate clockwise (R)">&#8635;</button>
    </span>
    <span class="group">
      <button id="undo" type="button" title="Undo (Ctrl+Z)">Undo</button>
      <button id="redo" type="button" title="Redo (Ctrl+Y)">Redo</button>
    </span>
    <button id="tile-size" type="button"></button>
    <label><input id="grid" type="checkbox" checked /> Grid</label>
    <button id="fit" type="button">Fit</button>
    <button id="preview" type="button" title="Preview exactly what Export for Phaser will contain">Preview</button>
    <span id="size"></span>
    <span id="zoom"></span>
    <span id="cell"></span>
    <span id="help" class="help" tabindex="0" role="button" aria-label="Controls help">
      ?
      <div class="help-panel">
        <h4>Palette</h4>
        <dl>
          <dt><kbd>Drag</kbd></dt><dd>Select a block of tiles as the brush</dd>
          <dt><kbd>Click</kbd></dt><dd>Select one tile</dd>
        </dl>
        <h4>Map, with a brush</h4>
        <dl>
          <dt><kbd>Click</kbd></dt><dd>Stamp the brush</dd>
          <dt><kbd>Drag</kbd></dt><dd>Paint freehand</dd>
          <dt><kbd>Shift + Drag</kbd></dt><dd>Fill a rectangle with the pattern</dd>
          <dt><kbd>Esc</kbd></dt><dd>Drop the brush</dd>
        </dl>
        <h4>Map, no brush</h4>
        <dl>
          <dt><kbd>Drag</kbd></dt><dd>Select an area</dd>
          <dt><kbd>Drag inside selection</kbd></dt><dd>Move it</dd>
          <dt><kbd>Alt + Drag</kbd></dt><dd>Copy it</dd>
          <dt><kbd>Ctrl + C</kbd></dt><dd>Copy selection</dd>
          <dt><kbd>Ctrl + V</kbd></dt><dd>Paste, then click to place</dd>
          <dt><kbd>Del</kbd></dt><dd>Delete selection</dd>
          <dt><kbd>Esc</kbd></dt><dd>Clear selection or cancel paste</dd>
        </dl>
        <h4>Delete</h4>
        <dl>
          <dt><kbd>Right-click / drag</kbd></dt><dd>Delete tiles</dd>
          <dt><kbd>Shift + Right-drag</kbd></dt><dd>Delete a rectangle</dd>
        </dl>
        <h4>Layers</h4>
        <dl>
          <dt><kbd>Click layer</kbd></dt><dd>Make it blue (paint here)</dd>
          <dt><kbd>Right-click layer</kbd></dt><dd>Toggle yellow (also edited)</dd>
        </dl>
        <h4>View</h4>
        <dl>
          <dt><kbd>Wheel</kbd></dt><dd>Zoom</dd>
          <dt><kbd>Middle-drag / Space + Drag</kbd></dt><dd>Pan</dd>
        </dl>
        <h4>Keys</h4>
        <dl>
          <dt><kbd>X / Y</kbd></dt><dd>Flip horizontally / vertically</dd>
          <dt><kbd>R / Shift + R</kbd></dt><dd>Rotate clockwise / counter-clockwise</dd>
          <dt><kbd>Ctrl + Z / Ctrl + Y</kbd></dt><dd>Undo / redo</dd>
          <dt><kbd>Ctrl + S</kbd></dt><dd>Save</dd>
        </dl>
      </div>
    </span>
  </header>
  <div class="status-row"><span id="status"></span></div>
  <div class="main">
    <aside class="panel left">
      <h3>Layers</h3>
      <div class="group layer-actions">
        <button id="layer-add" type="button" title="Add layer above the selected one">+</button>
        <button id="layer-rename" type="button" title="Rename">Rename</button>
        <button id="layer-delete" type="button" title="Delete layer">Delete</button>
      </div>
      <ul id="layers"></ul>
      <p class="hint">Click = blue (paint here). Right-click = toggle yellow (also selected, moved, deleted). Eye = show/hide (saved in Office.json, not exported to Phaser). C = collider.</p>
    </aside>
    <canvas id="map"></canvas>
    <aside class="panel right">
      <h3>Brush</h3>
      <div class="brush"><canvas id="brush" width="48" height="48"></canvas><span id="brush-info"></span></div>
      <h3>Tiles</h3>
      <div id="palette"></div>
      <div class="group sheet-actions">
        <button id="sheet-import" type="button" title="Add a PNG as a new sprite sheet">Import PNG</button>
        <button id="sheet-delete" type="button" title="Delete the shown sheet (only if unused)">Delete sheet</button>
        <button id="sheet-rename" type="button" title="Rename the shown sheet">Rename</button>
        <button id="sheet-up" type="button" title="Move the shown sheet up in the list">&#9650;</button>
        <button id="sheet-down" type="button" title="Move the shown sheet down in the list">&#9660;</button>
        <input id="sheet-file" type="file" accept="image/png" hidden />
      </div>
    </aside>
  </div>
  <dialog id="attr-dialog"></dialog>
  <dialog id="new-dialog"></dialog>
`;
mountNav('map');

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('map');
const status = $('status');
const view = new MapView(canvas);
const palette = new Palette($('palette'), (sel) => {
  if (!project) return;
  brush = blockFromSheetRect(project, sel);
  dropTransient();
  refresh();
});

let project: Project | null = null;
let editor: Editor | null = null;
let activeLayer = 0;
let fileName = '';
let fileHandle: FileHandle | null = null;

type Cell = [number, number];

/** What the current pointer gesture is doing. Chosen on press from button, modifiers and state. */
type Drag = { cancelled: boolean } & (
  | { kind: 'paint'; last: Cell; block: Block }
  | { kind: 'erase'; last: Cell; targets: number[] }
  | { kind: 'fill'; press: Cell; cur: Cell; block: Block }
  | { kind: 'eraseRect'; press: Cell; cur: Cell; targets: number[] }
  | { kind: 'marquee'; press: Cell }
  | { kind: 'move'; press: Cell; cur: Cell; copy: boolean; block: Block; targets: number[] }
);

/** The brush is the mode: a block picked in the palette paints; with none, the left button selects. */
let brush: Block | null = null;
let selection: Rect | null = null;
/** A pasted block following the pointer until it is placed or cancelled. */
let floating: Block | null = null;
let clipboard: Block | null = null;
let drag: Drag | null = null;
let dragButton = 0;
/** Ids of the extra (yellow) layers; the active layer is the blue one. Not saved in the file. */
const yellow = new Set<string>();

/** Layers that select, move, copy, paste and delete act on: the blue layer plus visible yellow ones. */
function targetLayers(): number[] {
  if (!project) return [];
  return project.layers.flatMap((l, i) => (l.visible && (i === activeLayer || yellow.has(l.id)) ? [i] : []));
}

/** Applies fn to every cell on the straight line between two cells, so fast drags leave no gaps. */
function forLine(a: Cell, b: Cell, fn: (x: number, y: number) => void): void {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let i = 0; i <= steps; i++) {
    fn(Math.round(a[0] + ((b[0] - a[0]) * i) / steps), Math.round(a[1] + ((b[1] - a[1]) * i) / steps));
  }
}

const inRect = (c: Cell, r: Rect): boolean => c[0] >= r.x0 && c[0] <= r.x1 && c[1] >= r.y0 && c[1] <= r.y1;
const shifted = (r: Rect, dx: number, dy: number): Rect => ({ x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy });

/** Pushes the selection, ghost and live rectangle for the current state to the map view. */
function updateOverlay(): void {
  view.selection = selection;
  view.outline = null;
  view.ghost = null;
  if (!project) return;
  const d = drag && !drag.cancelled ? drag : null;
  if (d?.kind === 'fill') {
    const t = tiledBlock(d.block, d.press, d.cur);
    view.ghost = { block: t.block, at: [t.x, t.y] };
    view.outline = { rect: rectOf(d.press[0], d.press[1], d.cur[0], d.cur[1]), color: '#7ee787' };
  } else if (d?.kind === 'eraseRect') {
    view.outline = { rect: rectOf(d.press[0], d.press[1], d.cur[0], d.cur[1]), color: '#ff6b6b' };
  } else if (d?.kind === 'move' && selection) {
    const dx = d.cur[0] - d.press[0];
    const dy = d.cur[1] - d.press[1];
    view.ghost = { block: d.block, at: [selection.x0 + dx, selection.y0 + dy] };
    view.outline = { rect: shifted(selection, dx, dy), color: '#ffd54a' };
  } else if (!drag || drag.kind === 'paint') {
    const b = floating ?? brush;
    if (b) view.ghost = { block: b, at: null };
  }
}

view.handlers = {
  down(cell, e) {
    if (!editor || !cell || drag) return;
    const ed = editor;
    dragButton = e.button;
    if (e.button === 2) {
      const targets = targetLayers();
      if (e.shiftKey) {
        drag = { kind: 'eraseRect', press: cell, cur: cell, targets, cancelled: false };
      } else {
        ed.beginStroke();
        for (const li of targets) ed.erase(li, cell[0], cell[1]);
        drag = { kind: 'erase', last: cell, targets, cancelled: false };
      }
    } else if (floating) {
      const f = floating;
      floating = null;
      ed.stroke(() => ed.pasteBlock(f, cell[0], cell[1]));
      refresh();
      return;
    } else if (brush) {
      if (e.shiftKey) {
        drag = { kind: 'fill', press: cell, cur: cell, block: brush, cancelled: false };
      } else {
        ed.beginStroke();
        ed.paintBlock(activeLayer, cell[0], cell[1], brush);
        drag = { kind: 'paint', last: cell, block: brush, cancelled: false };
      }
    } else if (selection && inRect(cell, selection)) {
      const targets = targetLayers();
      drag = { kind: 'move', press: cell, cur: cell, copy: e.altKey, block: ed.captureBlock(targets, selection), targets, cancelled: false };
    } else {
      selection = rectOf(cell[0], cell[1], cell[0], cell[1]);
      drag = { kind: 'marquee', press: cell, cancelled: false };
    }
    updateOverlay();
    view.draw();
  },
  move(cell) {
    const d = drag;
    if (d && cell && editor) {
      const ed = editor;
      if (d.kind === 'paint') {
        forLine(d.last, cell, (x, y) => ed.paintBlock(activeLayer, x, y, d.block));
        d.last = cell;
      } else if (d.kind === 'erase') {
        forLine(d.last, cell, (x, y) => {
          for (const li of d.targets) ed.erase(li, x, y);
        });
        d.last = cell;
      } else if (d.kind === 'marquee') {
        if (!d.cancelled) selection = rectOf(d.press[0], d.press[1], cell[0], cell[1]);
      } else {
        d.cur = cell;
      }
    }
    updateOverlay();
  },
  up(e) {
    const d = drag;
    if (!d || !editor || e.button !== dragButton) return;
    const ed = editor;
    drag = null;
    if (d.kind === 'paint' || d.kind === 'erase') {
      ed.endStroke();
    } else if (!d.cancelled) {
      if (d.kind === 'fill') {
        ed.stroke(() => ed.fillRect(activeLayer, d.press, d.cur, d.block));
      } else if (d.kind === 'eraseRect') {
        ed.stroke(() => ed.deleteRect(d.targets, rectOf(d.press[0], d.press[1], d.cur[0], d.cur[1])));
      } else if (d.kind === 'move' && selection) {
        const sel = selection;
        const dx = d.cur[0] - d.press[0];
        const dy = d.cur[1] - d.press[1];
        if (dx !== 0 || dy !== 0) {
          ed.stroke(() => ed.moveCells(d.targets, sel, dx, dy, d.copy));
          selection = shifted(sel, dx, dy);
        }
      }
    }
    refresh();
  },
};

/** Flip/rotate acts on the pending paste, else the selection (re-laid out in place), else the brush. */
function orient(op: OrientOp): void {
  if (!editor) return;
  if (floating) {
    floating = transformBlock(floating, op);
  } else if (selection) {
    const ed = editor;
    const sel = selection;
    const targets = targetLayers();
    ed.stroke(() => {
      const b = ed.captureBlock(targets, sel);
      ed.deleteRect(targets, sel);
      const t = transformBlock(b, op);
      ed.pasteBlock(t, sel.x0, sel.y0);
      selection = { x0: sel.x0, y0: sel.y0, x1: sel.x0 + t.width - 1, y1: sel.y0 + t.height - 1 };
    });
  } else if (brush) {
    brush = transformBlock(brush, op);
  }
  refresh();
}

function copySelection(): void {
  if (!editor || !selection) return;
  const b = editor.captureBlock(targetLayers(), selection);
  if (b.cells.length === 0) {
    status.classList.remove('error');
    status.textContent = 'Nothing to copy: the selection has no tiles on the blue or yellow layers';
    return;
  }
  clipboard = b;
  status.classList.remove('error');
  status.textContent = `Copied ${b.cells.length} tile(s). Ctrl+V to paste, then click to place.`;
}

function startPaste(): void {
  if (!editor || !clipboard || drag) return;
  floating = clipboard;
  refresh();
}

function deleteSelection(): void {
  if (!editor || !selection || drag) return;
  const ed = editor;
  const sel = selection;
  ed.stroke(() => ed.deleteRect(targetLayers(), sel));
  refresh();
}

/** Esc: cancel a rectangle or move in progress, else the paste, else the selection, else the brush. */
function escape(): void {
  if (drag) {
    if (drag.kind === 'paint' || drag.kind === 'erase') return;
    drag.cancelled = true;
    if (drag.kind === 'marquee') selection = null;
  } else if (floating) {
    floating = null;
  } else if (selection) {
    selection = null;
  } else if (brush) {
    brush = null;
    palette.setSelected(null);
  }
  refresh();
}

/** Drops the selection and pending paste, whose cells may no longer exist. */
function dropTransient(): void {
  selection = null;
  floating = null;
}

function drawBrushPreview(): void {
  const c = $<HTMLCanvasElement>('brush');
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  if (!project) return;
  ctx.imageSmoothingEnabled = false;
  if (!brush) return;
  const ts = project.tileSize;
  const k = Math.min(c.width / (brush.width * ts), c.height / (brush.height * ts));
  ctx.save();
  ctx.translate((c.width - brush.width * ts * k) / 2, (c.height - brush.height * ts * k) / 2);
  ctx.scale(k, k);
  for (const cell of brush.cells) {
    ctx.save();
    ctx.translate(cell.dx * ts, cell.dy * ts);
    drawTile(ctx, project, cell.tile);
    ctx.restore();
  }
  ctx.restore();
}

function updateTitle(): void {
  document.title = `${editor?.dirty ? '* ' : ''}${fileName || 'Tilemap editor'}`;
  $<HTMLButtonElement>('save').disabled = !editor;
  $<HTMLButtonElement>('save-as').disabled = !editor;
  const b = project ? getMapBounds(project) : null;
  $<HTMLButtonElement>('export').disabled = !editor || !b;
  $<HTMLButtonElement>('preview').disabled = !editor || !b;
  $<HTMLButtonElement>('preview').classList.toggle('active', view.previewing);
  $('size').textContent = b ? `Export ${b.width}x${b.height}` : project ? 'Export: empty' : '';
}

/** Switches the canvas to the baked export preview, or back to editing. Leaves preview when nothing is filled. */
function setPreview(on: boolean): void {
  if (!project) return;
  if (on && getMapBounds(project)) {
    try {
      view.setPreview(bakeProject(project));
    } catch (err) {
      view.setPreview(null);
      reportError('Preview failed', err);
    }
  } else {
    view.setPreview(null);
  }
  refresh();
}

function refresh(): void {
  if (view.previewing && project && !getMapBounds(project)) view.setPreview(null);
  updateTitle();
  const editing = !view.previewing;
  for (const id of ['flip-h', 'flip-v', 'rot-cw', 'rot-ccw']) $<HTMLButtonElement>(id).disabled = !editing;
  $<HTMLButtonElement>('undo').disabled = !editing || !editor?.canUndo();
  $<HTMLButtonElement>('redo').disabled = !editing || !editor?.canRedo();
  const tileBtn = $<HTMLButtonElement>('tile-size');
  tileBtn.textContent = `Tile ${project?.tileSize ?? '-'}px`;
  const canResize = !!project && !view.previewing && isMapEmpty(project);
  tileBtn.disabled = !canResize;
  tileBtn.title = !project
    ? 'Tile size'
    : view.previewing
      ? 'Leave preview to change the tile size'
      : canResize
        ? 'Change the tile size (only possible while the map is empty)'
        : 'Erase all tiles to change the tile size';
  updateOverlay();
  $('brush-info').textContent = !brush
    ? 'No brush: drag on the map to select'
    : brush.cells.length === 1
      ? `${brush.cells[0].tile.flipX ? 'flipX ' : ''}${brush.cells[0].tile.flipY ? 'flipY ' : ''}rot ${brush.cells[0].tile.rotation}`
      : `${brush.width}x${brush.height} block`;
  drawBrushPreview();
  renderLayers();
  view.draw();
}

const parseValue = (text: string): unknown => (text === 'true' ? true : text === 'false' ? false : text);

const attrDialog = $<HTMLDialogElement>('attr-dialog');
/** Saves every row of the open attribute modal; run on close so Escape or a backdrop click keeps typed values. */
let flushAttrs: () => void = () => {};

/** Fills the modal with an editor for the attributes of one sheet tile; they apply wherever the tile is placed. */
function renderAttrDialog(sel: PaletteSelection): void {
  const sheet = project?.sheets.find((s) => s.id === sel.sheetId);
  const ed = editor;
  if (!ed || !project || !sheet) {
    attrDialog.close();
    return;
  }
  const savers: (() => void)[] = [];
  flushAttrs = () => savers.forEach((f) => f());

  const title = document.createElement('h3');
  title.textContent = 'Edit tile attributes';
  const sub = document.createElement('p');
  sub.className = 'hint';
  sub.textContent = `${sheetLabel(project, project.sheets.indexOf(sheet))} · tile ${sel.id}`;
  const preview = document.createElement('canvas');
  preview.className = 'tile-preview';
  preview.width = preview.height = 64;
  const cols = Math.floor(sheet.width / project.tileSize);
  const ts = project.tileSize;
  const pctx = preview.getContext('2d')!;
  pctx.imageSmoothingEnabled = false;
  if (sheet.bitmap) {
    pctx.drawImage(sheet.bitmap, (Number(sel.id) % cols) * ts, Math.floor(Number(sel.id) / cols) * ts, ts, ts, 0, 0, 64, 64);
  }
  const rows = document.createElement('div');
  for (const attr of sheet.attributes[sel.id] ?? []) {
    const row = document.createElement('div');
    row.className = 'attr-row';
    const k = document.createElement('input');
    k.value = attr.key;
    k.placeholder = 'key';
    const v = document.createElement('input');
    v.value = String(attr.value);
    v.placeholder = 'value';
    const save = () => {
      const key = k.value.trim();
      const value = parseValue(v.value);
      if (!key || (key === attr.key && value === attr.value)) return;
      ed.updateAttribute(sheet.id, sel.id, attr.id, key, value);
    };
    savers.push(save);
    k.addEventListener('change', save);
    v.addEventListener('change', save);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon';
    del.title = 'Remove attribute';
    del.textContent = '×';
    del.addEventListener('click', () => {
      ed.removeAttribute(sheet.id, sel.id, attr.id);
      renderAttrDialog(sel);
    });
    row.append(k, v, del);
    rows.append(row);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Add attribute';
  add.addEventListener('click', () => {
    flushAttrs();
    ed.addAttribute(sheet.id, sel.id, 'interaction', '');
    renderAttrDialog(sel);
    attrDialog.querySelector<HTMLInputElement>('.attr-row:last-of-type input')?.focus();
  });
  const done = document.createElement('button');
  done.type = 'button';
  done.textContent = 'Done';
  done.addEventListener('click', () => attrDialog.close());
  const actions = document.createElement('div');
  actions.className = 'group dialog-actions';
  actions.append(add, done);
  attrDialog.replaceChildren(title, sub, preview, rows, actions);
}

function openAttrDialog(sel: PaletteSelection): void {
  if (!editor) return;
  renderAttrDialog(sel);
  if (!attrDialog.open) attrDialog.showModal();
}

attrDialog.addEventListener('close', () => {
  flushAttrs();
  flushAttrs = () => {};
  attrDialog.replaceChildren();
});
attrDialog.addEventListener('click', (e) => {
  if (e.target === attrDialog) attrDialog.close();
});
palette.onConfigure = openAttrDialog;

function renderLayers(): void {
  const ul = $('layers');
  ul.replaceChildren();
  if (!project) return;
  project.layers.forEach((layer, i) => {
    const li = document.createElement('li');
    li.className = i === activeLayer ? 'active' : yellow.has(layer.id) ? 'multi' : '';
    const hidden = !layer.visible;

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'icon';
    eye.title = hidden ? 'Show layer' : 'Hide layer';
    eye.textContent = hidden ? '—' : '◉';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      editor?.setVisible(i, hidden);
      refresh();
    });

    const name = document.createElement('span');
    name.className = 'name' + (hidden ? ' dim' : '');
    name.textContent = `${layer.name} (${layer.cells.size})`;

    const col = document.createElement('button');
    col.type = 'button';
    col.className = 'icon' + (layer.collider ? ' on' : '');
    col.title = 'Collider';
    col.textContent = 'C';
    col.addEventListener('click', (e) => {
      e.stopPropagation();
      editor?.setCollider(i, !layer.collider);
      refresh();
    });

    li.draggable = true;
    li.append(eye, name, col);
    li.addEventListener('click', () => {
      activeLayer = i;
      yellow.clear();
      refresh();
    });
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (i === activeLayer) return;
      if (!yellow.delete(layer.id)) yellow.add(layer.id);
      refresh();
    });
    ul.append(li);
  });
}

/** Drops layer row `from` on `slot` (a gap between rows); the active layer stays the same layer. */
function reorderLayers(from: number, slot: number): void {
  const to = slotToPosition(from, slot);
  if (!editor || to === null) return;
  const active = editor.project.layers[activeLayer];
  editor.moveLayer(from, to);
  activeLayer = editor.project.layers.indexOf(active);
  refresh();
}

function undo(): void {
  if (drag || view.previewing || !editor?.undo()) return;
  dropTransient();
  refresh();
}
function redo(): void {
  if (drag || view.previewing || !editor?.redo()) return;
  dropTransient();
  refresh();
}

async function loadText(text: string, name: string, handle: FileHandle | null): Promise<void> {
  if (editor?.dirty && !confirm('You have unsaved changes. Open another file anyway?')) return;
  const result = tryLoadProject(text, project);
  if (result.error || !result.project) {
    status.textContent = `Could not open ${name}: ${result.error}`;
    status.classList.add('error');
    return;
  }
  status.classList.remove('error');
  await decodeSheets(result.project);
  adoptProject(result.project, name, handle);
}

/** Installs a project as the current one and resets all per-project editor state. */
function adoptProject(next: Project, name: string, handle: FileHandle | null): void {
  project = next;
  editor = new Editor(next);
  editor.onChange = () => {
    if (view.previewing) setPreview(true);
    view.draw();
    updateTitle();
  };
  fileName = name;
  fileHandle = handle;
  activeLayer = 0;
  yellow.clear();
  brush = null;
  clipboard = null;
  drag = null;
  dropTransient();
  status.classList.remove('error');
  status.textContent = next.sheets.length
    ? `${name} - ${next.layers.length} layers, ${countTiles(next)} tiles, ${next.sheets.length} sheets`
    : `${name || next.name} - empty canvas. Import a PNG sprite sheet (right panel) to start painting.`;
  palette.setProject(next);
  view.setPreview(null);
  view.setProject(next);
  refresh();
  $('zoom').textContent = `Zoom ${view.zoomLabel()}`;
}

async function openFile(): Promise<void> {
  if (!hasFileAccess()) {
    $('open').click();
    return;
  }
  try {
    const picked = await pickFile();
    if (picked) await loadText(picked.text, picked.handle.name, picked.handle);
  } catch (err) {
    // The picker can be blocked (embedded browser, policy); the plain file chooser still works.
    console.warn('File picker failed, using file input', err);
    $('open').click();
  }
}

async function saveFile(saveAs: boolean): Promise<void> {
  if (!editor || !project) return;
  try {
    // Keep the cached bake in the file in step with the layers.
    project.exports = await bakeExports(bakeProject(project));
    const text = JSON.stringify(serializeOfficeJson(project));
    const saved = await saveText(text, fileHandle, fileName || 'Office.json', saveAs);
    if (!saved) return;
    fileHandle = saved.handle;
    fileName = saved.name;
    editor.dirty = false;
    status.classList.remove('error');
    status.textContent = `Saved ${saved.name}`;
    updateTitle();
  } catch (err) {
    reportError('Save failed', err);
  }
}

async function exportForPhaser(): Promise<void> {
  if (!project || !getMapBounds(project)) return;
  try {
    const files = await bakeFiles(bakeProject(project));
    downloadText(files.mapJson, 'map.json');
    downloadBytes(files.spritesheetPng, 'spritesheet.png', 'image/png');
    status.classList.remove('error');
    status.textContent = 'Exported map.json and spritesheet.png';
  } catch (err) {
    reportError('Export failed', err);
  }
}

function reportError(prefix: string, err: unknown): void {
  status.textContent = `${prefix}: ${err instanceof Error ? err.message : String(err)}`;
  status.classList.add('error');
}

const DEFAULT_TILE_SIZE = 16;
const newDialog = $<HTMLDialogElement>('new-dialog');

function openNewDialog(): void {
  if (newDialog.open) return;
  const title = document.createElement('h3');
  title.textContent = 'New canvas';
  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Tile size (px) ';
  const size = document.createElement('input');
  size.type = 'number';
  size.min = '1';
  size.step = '1';
  size.value = String(DEFAULT_TILE_SIZE);
  sizeLabel.append(size);
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name ';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = 'Untitled';
  nameLabel.append(nameInput);
  const error = document.createElement('p');
  error.className = 'hint error';
  const create = document.createElement('button');
  create.type = 'button';
  create.textContent = 'Create';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  const actions = document.createElement('div');
  actions.className = 'group dialog-actions';
  actions.append(create, cancel);

  const submit = () => {
    const n = Number(size.value);
    if (size.value.trim() === '' || !Number.isInteger(n) || n <= 0) {
      error.textContent = 'Tile size must be a whole number greater than 0.';
      size.focus();
      return;
    }
    if (editor?.dirty && !confirm('You have unsaved changes. Replace the current project with a new canvas?')) return;
    newDialog.close();
    adoptProject(createBlankProject(n, nameInput.value.trim() || 'Untitled'), '', null);
  };
  create.addEventListener('click', submit);
  cancel.addEventListener('click', () => newDialog.close());
  for (const input of [size, nameInput]) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }
  const form = document.createElement('div');
  form.className = 'new-form';
  form.append(sizeLabel, nameLabel);
  newDialog.replaceChildren(title, form, error, actions);
  newDialog.showModal();
  size.select();
}
newDialog.addEventListener('close', () => newDialog.replaceChildren());

function changeTileSize(): void {
  if (!editor || !project || !isMapEmpty(project) || view.previewing) return;
  const input = prompt('Tile size (px)', String(project.tileSize));
  if (input === null) return;
  const n = Number(input);
  if (input.trim() === '' || !Number.isInteger(n) || n <= 0) {
    reportError('Cannot change tile size', new Error('Tile size must be a whole number greater than 0.'));
    return;
  }
  if (n === project.tileSize) return;
  const { attributeCount, partialSheets } = tileSizeImpact(project, n);
  const warnings: string[] = [];
  if (attributeCount > 0) warnings.push(`${attributeCount} tile attribute(s) will be removed`);
  if (partialSheets > 0) warnings.push(`${partialSheets} sheet(s) are not a multiple of ${n}px; partial edge tiles will be ignored`);
  if (warnings.length && !confirm(`Change tile size to ${n}px?\n\n- ${warnings.join('\n- ')}\n\nThis cannot be undone.`)) return;
  const result = editor.setTileSize(n);
  if (!result.changed) {
    reportError('Cannot change tile size', new Error(result.reason === 'not-empty' ? 'Erase all tiles first.' : 'Invalid tile size.'));
    return;
  }
  brush = null;
  palette.setProject(project);
  status.classList.remove('error');
  status.textContent = `Tile size is now ${n}px`;
  refresh();
}

$('new-btn').addEventListener('click', openNewDialog);
$('tile-size').addEventListener('click', changeTileSize);
$('open-btn').addEventListener('click', () => void openFile());
$('save').addEventListener('click', () => void saveFile(false));
$('save-as').addEventListener('click', () => void saveFile(true));
$('export').addEventListener('click', () => void exportForPhaser());
$('preview').addEventListener('click', () => setPreview(!view.previewing));
$('open').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await loadText(await file.text(), file.name, null);
});

window.addEventListener('beforeunload', (e) => {
  if (editor?.dirty) e.preventDefault();
});

$('grid').addEventListener('change', (e) => {
  view.showGrid = (e.target as HTMLInputElement).checked;
  view.draw();
});
$('fit').addEventListener('click', () => {
  view.fit();
  $('zoom').textContent = `Zoom ${view.zoomLabel()}`;
});
canvas.addEventListener('viewchange', () => ($('zoom').textContent = `Zoom ${view.zoomLabel()}`));
canvas.addEventListener('hovercell', (e) => {
  const c = (e as CustomEvent<[number, number] | null>).detail;
  $('cell').textContent = c ? `Cell ${c[0]},${c[1]}` : '';
});

$('flip-h').addEventListener('click', () => orient('flipH'));
$('flip-v').addEventListener('click', () => orient('flipV'));
$('rot-cw').addEventListener('click', () => orient('rotateCW'));
$('rot-ccw').addEventListener('click', () => orient('rotateCCW'));
$('layer-add').addEventListener('click', () => {
  if (!editor) return;
  editor.addLayer(activeLayer, editor.nextLayerName());
  refresh();
});
$('layer-rename').addEventListener('click', () => {
  if (!editor || !project) return;
  const name = prompt('Layer name', project.layers[activeLayer].name);
  if (!name?.trim()) return;
  if (editor.layerNameTaken(name, activeLayer)) {
    alert(`A layer named "${name.trim()}" already exists. Layer names must be unique.`);
    return;
  }
  editor.renameLayer(activeLayer, name.trim());
  refresh();
});
$('layer-delete').addEventListener('click', () => {
  if (!editor || !project || project.layers.length <= 1) return;
  const layer = project.layers[activeLayer];
  if (layer.cells.size > 0 && !confirm(`Delete layer "${layer.name}" and its ${layer.cells.size} tiles? This cannot be undone.`)) return;
  yellow.delete(layer.id);
  dropTransient();
  editor.deleteLayer(activeLayer);
  activeLayer = Math.min(activeLayer, project.layers.length - 1);
  refresh();
});
$('sheet-import').addEventListener('click', () => $('sheet-file').click());
$('sheet-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !editor || !project) return;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const { sheet, partial } = editor.addSheet(dataUrl, sheetNameFromFile(file.name));
    await decodeSheets(project);
    palette.reload(project.sheets.length - 1);
    status.classList.remove('error');
    status.textContent = `Imported ${file.name} as sheet ${project.sheets.length} (${Math.floor(sheet.width / project.tileSize)}x${Math.floor(sheet.height / project.tileSize)} tiles)`;
    if (partial) {
      alert(`${file.name} is ${sheet.width}x${sheet.height}, not a multiple of ${project.tileSize}. Partial tiles at the right and bottom edges are ignored.`);
    }
    refresh();
  } catch (err) {
    reportError('Import failed', err);
  }
});
$('sheet-delete').addEventListener('click', () => {
  if (!editor || !project) return;
  const id = palette.currentSheetId();
  if (!id) return;
  const index = project.sheets.findIndex((s) => s.id === id);
  const result = editor.deleteSheet(id);
  if (!result.deleted) {
    reportError('Cannot delete sheet', new Error(`${result.usage} placed tiles use sheet ${index + 1}. Erase them first.`));
    return;
  }
  status.classList.remove('error');
  status.textContent = `Deleted sheet ${index + 1}`;
  if (brush?.cells.some((c) => c.tile.sheetId === id)) brush = null;
  // reload clears the palette selection when it was on the deleted sheet, which disables the gear.
  palette.reload(Math.min(index, project.sheets.length - 1));
  refresh();
});
$('sheet-rename').addEventListener('click', () => {
  if (!editor || !project) return;
  const index = palette.currentIndex();
  const sheet = project.sheets[index];
  if (!sheet) return;
  const name = prompt('Sheet name', sheet.name ?? `Sheet ${index + 1}`);
  if (name === null || !editor.renameSheet(sheet.id, name)) return;
  palette.reload(index);
  refresh();
});
function moveSheet(delta: number): void {
  if (!editor) return;
  const id = palette.currentSheetId();
  if (!id) return;
  palette.reload(editor.moveSheet(id, delta));
  refresh();
}
$('sheet-up').addEventListener('click', () => moveSheet(-1));
$('sheet-down').addEventListener('click', () => moveSheet(1));
enableDragReorder($('layers'), reorderLayers);
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);

window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type !== 'checkbox')) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.code === 'Space') {
    view.spaceHeld = true;
    e.preventDefault();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (hideHelp()) return;
    if (!view.previewing) escape();
  } else if (mod && k === 'c') {
    e.preventDefault();
    if (!view.previewing) copySelection();
  } else if (mod && k === 'v') {
    e.preventDefault();
    if (!view.previewing) startPaste();
  } else if (mod && k === 'n') {
    e.preventDefault();
    openNewDialog();
  } else if (mod && k === 's') {
    e.preventDefault();
    void saveFile(e.shiftKey);
  } else if (mod && k === 'o') {
    e.preventDefault();
    void openFile();
  } else if (mod && k === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && k === 'y') {
    e.preventDefault();
    redo();
  } else if (!mod && !e.altKey && !view.previewing) {
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
    else if (k === 'x') orient('flipH');
    else if (k === 'y') orient('flipV');
    else if (k === 'r') orient(e.shiftKey ? 'rotateCCW' : 'rotateCW');
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') view.spaceHeld = false;
});

adoptProject(createBlankProject(DEFAULT_TILE_SIZE, 'Untitled'), '', null);

/** Esc closes the help panel first. The panel itself is CSS-only (:hover and :focus-within). */
const help = $('help');
function hideHelp(): boolean {
  if (help.classList.contains('dismissed') || !help.matches(':hover, :focus-within')) return false;
  help.classList.add('dismissed');
  help.blur();
  return true;
}
help.addEventListener('mouseleave', () => help.classList.remove('dismissed'));
help.addEventListener('focusout', () => help.classList.remove('dismissed'));

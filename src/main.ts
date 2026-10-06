import { Editor, type Brush } from './editor/editor';
import { applyOrientOp, type OrientOp } from './editor/orientation';
import { bakeExports, bakeFiles, bakeProject } from './model/bake';
import { downloadBytes, downloadText, hasFileAccess, pickFile, saveText, type FileHandle } from './io/files';
import { countTiles, getMapBounds, serializeOfficeJson, sheetLabel, sheetNameFromFile, tryLoadProject } from './model/office';
import type { Project } from './model/types';
import { drawTile, MapView } from './render/mapView';
import { decodeSheets } from './render/sheets';
import { Palette, type PaletteSelection } from './ui/palette';
import './style.css';

type Tool = 'paint' | 'erase' | 'select';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="toolbar">
    <button id="open-btn" type="button" title="Open Office.json (Ctrl+O)">Open</button>
    <input id="open" type="file" accept=".json,application/json" hidden />
    <span class="group">
      <button id="save" type="button" title="Save Office.json (Ctrl+S)">Save</button>
      <button id="save-as" type="button" title="Save as... (Ctrl+Shift+S)">Save As</button>
      <button id="export" type="button" title="Download map.json and spritesheet.png for Phaser">Export for Phaser</button>
    </span>
    <span class="group">
      <button id="tool-paint" type="button" title="Paint (B)">Paint</button>
      <button id="tool-erase" type="button" title="Erase (E)">Erase</button>
      <button id="tool-select" type="button" title="Select a placed tile to flip/rotate it (V)">Select</button>
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
    <label><input id="grid" type="checkbox" checked /> Grid</label>
    <button id="fit" type="button">Fit</button>
    <button id="preview" type="button" title="Preview exactly what Export for Phaser will contain">Preview</button>
    <span id="size"></span>
    <span id="zoom"></span>
    <span id="cell"></span>
  </header>
  <div class="status-row"><span id="status">No project loaded</span></div>
  <div class="main">
    <aside class="panel left">
      <h3>Layers</h3>
      <div class="group layer-actions">
        <button id="layer-add" type="button" title="Add layer above the selected one">+</button>
        <button id="layer-up" type="button" title="Move up">&#9650;</button>
        <button id="layer-down" type="button" title="Move down">&#9660;</button>
        <button id="layer-rename" type="button" title="Rename">Rename</button>
        <button id="layer-delete" type="button" title="Delete layer">Delete</button>
      </div>
      <ul id="layers"></ul>
      <p class="hint">Eye = show/hide (saved in Office.json, not exported to Phaser). C = collider.</p>
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
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('map');
const status = $('status');
const view = new MapView(canvas);
const palette = new Palette($('palette'), (sel) => {
  brush = { ...brush, ...sel };
  if (tool === 'erase' || tool === 'select') setTool('paint');
  refresh();
});

let project: Project | null = null;
let editor: Editor | null = null;
let activeLayer = 0;
let tool: Tool = 'paint';
let brush: Brush = { sheetId: '', id: '0', flipX: false, flipY: false, rotation: 0 };
let fileName = '';
let fileHandle: FileHandle | null = null;
let pressed = false;
let lastCell: [number, number] | null = null;

function setTool(t: Tool): void {
  tool = t;
  if (t !== 'select') view.selectedCell = null;
  refresh();
}

/** Applies fn to every cell on the straight line between two cells, so fast drags leave no gaps. */
function forLine(a: [number, number], b: [number, number], fn: (x: number, y: number) => void): void {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let i = 0; i <= steps; i++) {
    fn(Math.round(a[0] + ((b[0] - a[0]) * i) / steps), Math.round(a[1] + ((b[1] - a[1]) * i) / steps));
  }
}

function applyTool(from: [number, number], to: [number, number]): void {
  if (!editor) return;
  const ed = editor;
  forLine(from, to, (x, y) => {
    if (tool === 'paint') ed.paint(activeLayer, x, y, brush);
    else if (tool === 'erase') ed.erase(activeLayer, x, y);
  });
  view.draw();
}

view.handlers = {
  down(cell) {
    if (!editor) return;
    if (tool === 'select') {
      view.selectedCell = cell;
      refresh();
      return;
    }
    if (!cell) return;
    pressed = true;
    lastCell = cell;
    editor.beginStroke();
    applyTool(cell, cell);
  },
  move(cell) {
    if (pressed && cell && lastCell) {
      applyTool(lastCell, cell);
      lastCell = cell;
    }
  },
  up() {
    if (!pressed) return;
    pressed = false;
    lastCell = null;
    editor?.endStroke();
    refresh();
  },
};

/** Flip/rotate acts on the selected placed tile in Select mode, otherwise on the brush. */
function orient(op: OrientOp): void {
  if (!editor) return;
  if (tool === 'select') {
    const cell = view.selectedCell;
    if (!cell) return;
    const ed = editor;
    ed.stroke(() => ed.transform(activeLayer, cell[0], cell[1], op));
    view.draw();
  } else {
    brush = { ...brush, ...applyOrientOp(brush, op) };
  }
  refresh();
}

function drawBrushPreview(): void {
  const c = $<HTMLCanvasElement>('brush');
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  if (!project) return;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(c.width / project.tileSize, c.height / project.tileSize);
  drawTile(ctx, project, { ...brush, extra: {} });
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
  for (const id of ['tool-paint', 'tool-erase', 'tool-select', 'flip-h', 'flip-v', 'rot-cw', 'rot-ccw']) {
    $<HTMLButtonElement>(id).disabled = !editing;
  }
  for (const t of ['paint', 'erase', 'select'] as Tool[]) $(`tool-${t}`).classList.toggle('active', tool === t);
  $<HTMLButtonElement>('undo').disabled = !editing || !editor?.canUndo();
  $<HTMLButtonElement>('redo').disabled = !editing || !editor?.canRedo();
  view.ghost = project && tool === 'paint' ? { ...brush, extra: {} } : null;
  $('brush-info').textContent = `${brush.flipX ? 'flipX ' : ''}${brush.flipY ? 'flipY ' : ''}rot ${brush.rotation}`;
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
    li.className = i === activeLayer ? 'active' : '';
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

    li.append(eye, name, col);
    li.addEventListener('click', () => {
      activeLayer = i;
      refresh();
    });
    ul.append(li);
  });
}

function moveActiveLayer(delta: number): void {
  if (!editor) return;
  const to = activeLayer + delta;
  if (to < 0 || to >= editor.project.layers.length) return;
  editor.moveLayer(activeLayer, to);
  activeLayer = to;
  refresh();
}

function undo(): void {
  if (!view.previewing && editor?.undo()) refresh();
}
function redo(): void {
  if (!view.previewing && editor?.redo()) refresh();
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
  project = result.project;
  editor = new Editor(project);
  editor.onChange = () => {
    if (view.previewing) setPreview(true);
    view.draw();
    updateTitle();
  };
  fileName = name;
  fileHandle = handle;
  activeLayer = 0;
  const first = project.sheets[0];
  brush = { sheetId: first?.id ?? '', id: '0', flipX: false, flipY: false, rotation: 0 };
  status.textContent = `${name} - ${project.layers.length} layers, ${countTiles(project)} tiles, ${project.sheets.length} sheets`;
  palette.setProject(project);
  view.setProject(project);
  setTool('paint');
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

$('tool-paint').addEventListener('click', () => setTool('paint'));
$('tool-erase').addEventListener('click', () => setTool('erase'));
$('tool-select').addEventListener('click', () => setTool('select'));
$('flip-h').addEventListener('click', () => orient('flipH'));
$('flip-v').addEventListener('click', () => orient('flipV'));
$('rot-cw').addEventListener('click', () => orient('rotateCW'));
$('rot-ccw').addEventListener('click', () => orient('rotateCCW'));
$('layer-add').addEventListener('click', () => {
  if (!editor) return;
  const name = prompt('New layer name', 'New layer');
  if (!name) return;
  editor.addLayer(activeLayer, name);
  refresh();
});
$('layer-rename').addEventListener('click', () => {
  if (!editor || !project) return;
  const name = prompt('Layer name', project.layers[activeLayer].name);
  if (!name) return;
  editor.renameLayer(activeLayer, name);
  refresh();
});
$('layer-delete').addEventListener('click', () => {
  if (!editor || !project || project.layers.length <= 1) return;
  const layer = project.layers[activeLayer];
  if (layer.cells.size > 0 && !confirm(`Delete layer "${layer.name}" and its ${layer.cells.size} tiles? This cannot be undone.`)) return;
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
  if (brush.sheetId === id) {
    brush = { ...brush, sheetId: project.sheets[0]?.id ?? '', id: '0' };
  }
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
$('layer-up').addEventListener('click', () => moveActiveLayer(-1));
$('layer-down').addEventListener('click', () => moveActiveLayer(1));
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);

window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === 'text')) return;
  if (e.code === 'Space') {
    view.spaceHeld = true;
    e.preventDefault();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 's') {
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
    if (k === 'b') setTool('paint');
    else if (k === 'e') setTool('erase');
    else if (k === 'v') setTool('select');
    else if (k === 'x') orient('flipH');
    else if (k === 'y') orient('flipV');
    else if (k === 'r') orient(e.shiftKey ? 'rotateCCW' : 'rotateCW');
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') view.spaceHeld = false;
});

refresh();

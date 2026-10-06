import { Editor, type Brush } from './editor/editor';
import { applyOrientOp, type OrientOp } from './editor/orientation';
import { countTiles, getMapBounds, tryLoadProject } from './model/office';
import type { Project } from './model/types';
import { drawTile, MapView } from './render/mapView';
import { decodeSheets } from './render/sheets';
import { Palette } from './ui/palette';
import './style.css';

type Tool = 'paint' | 'erase' | 'select';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="toolbar">
    <label class="btn">Open Office.json<input id="open" type="file" accept=".json,application/json" hidden /></label>
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
      <p class="hint">Eye = show/hide (editor only). C = collider.</p>
    </aside>
    <canvas id="map"></canvas>
    <aside class="panel right">
      <h3>Brush</h3>
      <div class="brush"><canvas id="brush" width="48" height="48"></canvas><span id="brush-info"></span></div>
      <h3>Tiles</h3>
      <div id="palette"></div>
    </aside>
  </div>
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

function refresh(): void {
  for (const t of ['paint', 'erase', 'select'] as Tool[]) $(`tool-${t}`).classList.toggle('active', tool === t);
  $<HTMLButtonElement>('undo').disabled = !editor?.canUndo();
  $<HTMLButtonElement>('redo').disabled = !editor?.canRedo();
  view.ghost = project && tool === 'paint' ? { ...brush, extra: {} } : null;
  $('brush-info').textContent = `${brush.flipX ? 'flipX ' : ''}${brush.flipY ? 'flipY ' : ''}rot ${brush.rotation}`;
  drawBrushPreview();
  renderLayers();
  view.draw();
}

function renderLayers(): void {
  const ul = $('layers');
  ul.replaceChildren();
  if (!project) return;
  project.layers.forEach((layer, i) => {
    const li = document.createElement('li');
    li.className = i === activeLayer ? 'active' : '';
    const hidden = view.hiddenLayers.has(layer.id);

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'icon';
    eye.title = hidden ? 'Show layer' : 'Hide layer';
    eye.textContent = hidden ? '—' : '◉';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hidden) view.hiddenLayers.delete(layer.id);
      else view.hiddenLayers.add(layer.id);
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
  if (editor?.undo()) refresh();
}
function redo(): void {
  if (editor?.redo()) refresh();
}

$('open').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const result = tryLoadProject(await file.text(), project);
  if (result.error || !result.project) {
    status.textContent = `Could not open ${file.name}: ${result.error}`;
    status.classList.add('error');
    return;
  }
  status.classList.remove('error');
  await decodeSheets(result.project);
  project = result.project;
  editor = new Editor(project);
  editor.onChange = () => view.draw();
  activeLayer = 0;
  const first = project.sheets[0];
  brush = { sheetId: first?.id ?? '', id: '0', flipX: false, flipY: false, rotation: 0 };
  const b = getMapBounds(project);
  status.textContent = `${file.name} - ${project.layers.length} layers, ${countTiles(project)} tiles, ${project.sheets.length} sheets, map ${b.width}x${b.height}`;
  palette.setProject(project);
  palette.setSelected({ sheetId: brush.sheetId, id: brush.id });
  view.setProject(project);
  setTool('paint');
  $('zoom').textContent = `Zoom ${view.zoomLabel()}`;
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
  const b = project ? getMapBounds(project) : null;
  $('cell').textContent = c && b ? `Cell ${c[0] - b.x},${c[1] - b.y}` : '';
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
  view.hiddenLayers.delete(layer.id);
  editor.deleteLayer(activeLayer);
  activeLayer = Math.min(activeLayer, project.layers.length - 1);
  refresh();
});
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
  if (mod && k === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && k === 'y') {
    e.preventDefault();
    redo();
  } else if (!mod && !e.altKey) {
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

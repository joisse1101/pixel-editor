import { hasFileAccess, pickImage, saveBytes, type FileHandle } from '../io/files';
import { mountNav } from '../ui/nav';
import { ColorState, toHex } from './colors';
import { PixelDocument } from './document';
import { decodeImageFile, encodeImageFile } from './pngFile';
import { askSize } from './sizeDialog';
import { ToolController, type Tool } from './tools';
import { PixelView } from './view';
import '../style.css';

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'pencil', label: 'Pencil', key: 'P' },
  { id: 'eraser', label: 'Eraser', key: 'E' },
  { id: 'eyedropper', label: 'Eyedropper', key: 'I' },
  { id: 'fill', label: 'Fill', key: 'G' },
  { id: 'line', label: 'Line', key: 'L' },
  { id: 'rect', label: 'Rectangle', key: 'R' },
  { id: 'select', label: 'Select', key: 'S' },
];

const app = document.getElementById('app')!;
mountNav('pixel');
app.insertAdjacentHTML(
  'beforeend',
  `
  <header class="toolbar">
    <button id="new-btn" type="button" title="New image (Ctrl+N)">New</button>
    <button id="open-btn" type="button" title="Open PNG (Ctrl+O)">Open</button>
    <input id="open-file" type="file" accept="image/png,image/*" hidden />
    <span class="group">
      <button id="save" type="button" title="Save PNG (Ctrl+S)">Save</button>
      <button id="save-as" type="button" title="Save as... (Ctrl+Shift+S)">Save As</button>
    </span>
    <span class="group">
      <button id="undo" type="button" title="Undo (Ctrl+Z)">Undo</button>
      <button id="redo" type="button" title="Redo (Ctrl+Y)">Redo</button>
    </span>
    <span class="group">
      <button id="flip-h" type="button" title="Flip horizontally (X)">Flip H</button>
      <button id="flip-v" type="button" title="Flip vertically (Y)">Flip V</button>
      <button id="rot-ccw" type="button" title="Rotate counter-clockwise">&#8634;</button>
      <button id="rot-cw" type="button" title="Rotate clockwise">&#8635;</button>
    </span>
    <button id="resize" type="button" title="Resize canvas">Resize</button>
    <label><input id="grid" type="checkbox" checked /> Grid</label>
    <button id="fit" type="button" title="Fit image in view">Fit</button>
  </header>
  <div class="main">
    <aside class="px-tools panel">
      <div id="tools" class="px-tool-list"></div>
      <label class="px-opt"><input id="filled" type="checkbox" /> Filled rectangle</label>
      <h3>Colour</h3>
      <div class="px-color">
        <input id="color" type="color" value="#000000" title="Colour" />
        <label class="px-alpha">Alpha <input id="alpha" type="range" min="0" max="255" value="255" /> <output id="alpha-out">255</output></label>
        <div id="swatch" class="px-swatch" title="Current colour"></div>
      </div>
      <h3>Recent</h3>
      <div id="recent" class="px-recent"></div>
    </aside>
    <canvas id="px-canvas"></canvas>
  </div>
  <div class="status-row">
    <span id="px-name">untitled.png</span><span id="px-dirty"></span>
    <span id="px-size"></span>
    <span id="px-zoom"></span>
    <span id="px-hover"></span>
    <span id="px-msg" class="px-msg"></span>
  </div>`,
);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const doc = new PixelDocument();
const colors = new ColorState();
const view = new PixelView($<HTMLCanvasElement>('px-canvas'), doc);
const tools = new ToolController(doc, view, colors, () => refreshColor());
view.handlers = tools;
let handle: FileHandle | null = null;
let fileName = 'untitled.png';

// ---- Status ----

function message(text: string, error = false): void {
  const el = $('px-msg');
  el.textContent = text;
  el.classList.toggle('error', error);
}

function refreshStatus(): void {
  $('px-name').textContent = fileName;
  $('px-dirty').textContent = doc.isDirty ? ' *' : '';
  $('px-size').textContent = `${doc.width} × ${doc.height}`;
  $('px-zoom').textContent = `${Math.round(view.viewport.scale * 100)}%`;
  $<HTMLButtonElement>('undo').disabled = !doc.history.canUndo;
  $<HTMLButtonElement>('redo').disabled = !doc.history.canRedo;
}

function refreshHover(): void {
  const p = view.hover;
  if (!p) {
    $('px-hover').textContent = '';
    return;
  }
  const i = (p.y * doc.width + p.x) * 4;
  const d = doc.px.data;
  $('px-hover').textContent = `${p.x}, ${p.y}  rgba(${d[i]}, ${d[i + 1]}, ${d[i + 2]}, ${d[i + 3]})`;
}

view.onHover = refreshHover;
doc.onChange = () => {
  view.invalidate();
  refreshStatus();
  refreshHover();
};

// ---- Tools ----

const toolList = $('tools');
for (const t of TOOLS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.tool = t.id;
  b.title = `${t.label} (${t.key})`;
  b.textContent = t.label;
  b.addEventListener('click', () => setTool(t.id));
  toolList.append(b);
}

function setTool(t: Tool): void {
  tools.tool = t;
  for (const b of toolList.querySelectorAll('button')) b.classList.toggle('active', b.dataset.tool === t);
}
setTool(tools.tool);

// ---- Colour ----

function refreshColor(): void {
  const [r, g, b, a] = colors.color;
  $<HTMLInputElement>('color').value = toHex(colors.color);
  $<HTMLInputElement>('alpha').value = String(a);
  $('alpha-out').textContent = String(a);
  $('swatch').style.background = `linear-gradient(rgba(${r},${g},${b},${a / 255}),rgba(${r},${g},${b},${a / 255})), var(--px-check)`;
  const recent = $('recent');
  recent.replaceChildren(
    ...colors.recent.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'px-recent-swatch';
      b.title = `rgba(${c.join(', ')})`;
      b.style.background = `linear-gradient(rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255}),rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})), var(--px-check)`;
      b.addEventListener('click', () => {
        colors.setColor(c);
        refreshColor();
      });
      return b;
    }),
  );
}
$('color').addEventListener('input', (e) => {
  colors.setRgb((e.target as HTMLInputElement).value);
  refreshColor();
});
$('alpha').addEventListener('input', (e) => {
  colors.setAlpha(Number((e.target as HTMLInputElement).value));
  refreshColor();
});
refreshColor();

// ---- File ----

/** True when it is fine to replace the image: it is saved, or the user agrees to lose the changes. */
function confirmDiscard(): boolean {
  return !doc.isDirty || window.confirm('The image has unsaved changes. Discard them?');
}

async function loadBytes(bytes: Uint8Array, name: string, newHandle: FileHandle | null): Promise<void> {
  try {
    doc.load(await decodeImageFile(bytes));
  } catch (e) {
    message(`Could not open ${name}: ${(e as Error).message}`, true);
    return;
  }
  handle = newHandle;
  fileName = name;
  view.fit();
  refreshStatus();
  message('');
}

async function openImage(): Promise<void> {
  if (!confirmDiscard()) return;
  if (hasFileAccess()) {
    try {
      const picked = await pickImage();
      if (picked) await loadBytes(picked.bytes, picked.name, picked.handle);
    } catch (e) {
      message(`Could not open the file: ${(e as Error).message}`, true);
    }
  } else {
    $<HTMLInputElement>('open-file').click();
  }
}

$('open-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await loadBytes(new Uint8Array(await file.arrayBuffer()), file.name, null);
});

async function saveImage(saveAs: boolean): Promise<void> {
  try {
    doc.commitFloating();
    const bytes = await encodeImageFile(doc.px);
    const name = /\.png$/i.test(fileName) ? fileName : `${fileName}.png`;
    const saved = await saveBytes(bytes, handle, name, saveAs);
    if (!saved) return;
    handle = saved.handle;
    fileName = saved.name;
    doc.markSaved();
    message(`Saved ${saved.name}`);
  } catch (e) {
    message(`Could not save: ${(e as Error).message}`, true);
  }
}

$('open-btn').addEventListener('click', () => void openImage());
$('save').addEventListener('click', () => void saveImage(false));
$('save-as').addEventListener('click', () => void saveImage(true));
$('undo').addEventListener('click', () => doc.undo());
$('redo').addEventListener('click', () => doc.redo());
async function newImage(): Promise<void> {
  if (!confirmDiscard()) return;
  const r = await askSize({ title: 'New image', width: doc.width, height: doc.height, anchor: false, confirm: 'Create' });
  if (!r) return;
  doc.newImage(r.width, r.height);
  handle = null;
  fileName = 'untitled.png';
  view.fit();
  refreshStatus();
  message('');
}

async function resizeCanvas(): Promise<void> {
  const r = await askSize({ title: 'Resize canvas', width: doc.width, height: doc.height, anchor: true, confirm: 'Resize' });
  if (!r) return;
  doc.resize(r.width, r.height, r.anchor);
  view.fit();
  refreshStatus();
}

$('new-btn').addEventListener('click', () => void newImage());
$('resize').addEventListener('click', () => void resizeCanvas());
$('flip-h').addEventListener('click', () => doc.flip('h'));
$('flip-v').addEventListener('click', () => doc.flip('v'));
for (const [id, dir] of [['rot-ccw', 'ccw'], ['rot-cw', 'cw']] as const) {
  $(id).addEventListener('click', () => {
    const [w, h] = [doc.width, doc.height];
    doc.rotate(dir);
    if (doc.width !== w || doc.height !== h) view.fit();
  });
}
$('fit').addEventListener('click', () => {
  view.fit();
  refreshStatus();
});
$<HTMLInputElement>('grid').addEventListener('change', (e) => {
  view.showGrid = (e.target as HTMLInputElement).checked;
  view.redraw();
});
$<HTMLInputElement>('filled').addEventListener('change', (e) => {
  tools.filled = (e.target as HTMLInputElement).checked;
});
const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest('dialog') !== null);

/** Image-space rectangle currently on screen. */
function visibleRect() {
  const canvas = $('px-canvas');
  const a = view.viewport.toImage(0, 0);
  const b = view.viewport.toImage(canvas.clientWidth, canvas.clientHeight);
  return { x: Math.floor(a.x), y: Math.floor(a.y), w: Math.ceil(b.x) - Math.floor(a.x), h: Math.ceil(b.y) - Math.floor(a.y) };
}

window.addEventListener('keydown', (e) => {
  if (typing(e.target)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (!tools.cancelDrag()) doc.cancel();
  } else if (mod && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    if (tools.copy()) message('Copied');
  } else if (mod && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    if (tools.paste(visibleRect())) setTool('select');
  } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault();
    doc.deleteSelection();
  }
});
$('px-canvas').addEventListener('wheel', () => requestAnimationFrame(refreshStatus), { passive: true });

view.fit();
refreshStatus();

// Exposed to the tool and shortcut code added alongside this shell.
export { doc, view, colors, message, refreshColor, refreshStatus, setTool, openImage, saveImage, confirmDiscard };
export const currentTool = (): Tool => tools.tool;

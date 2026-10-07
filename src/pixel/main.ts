import { hasFileAccess, pickImages, saveBytes, type FileHandle } from '../io/files';
import { mountNav } from '../ui/nav';
import { ColorState, toHex } from './colors';
import { PixelDocument } from './document';
import { parseGridLevels } from './gridLevels';
import { LayerPanel } from './layerPanel';
import { saveAllowed, saveLayerFile } from './layerFile';
import type { Layer } from './history';
import type { Pixels } from '../model/pngCodec';
import { flatten } from './ops';
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

/** Tool names with their shortcut key marked. */
const LABELS: Record<string, string> = {
  Pencil: '(P)encil',
  Eraser: '(E)raser',
  Eyedropper: 'Eyedropper (I)',
  Fill: 'Fill (G)',
  Line: '(L)ine',
  Rectangle: '(R)ectangle',
  Select: '(S)elect',
};

const app = document.getElementById('app')!;
mountNav('pixel');
app.insertAdjacentHTML(
  'beforeend',
  `
  <header class="toolbar">
    <button id="new-btn" type="button" title="New image (Ctrl+N)">New</button>
    <button id="open-btn" type="button" title="Open PNG (Ctrl+O)">Open</button>
    <input id="open-file" type="file" accept="image/png,image/*" multiple hidden />
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
    <label title="Overlay grid cell sizes in pixels, comma separated">Overlay <input id="grid-levels" type="text" value="16, 32" size="9" placeholder="16, 32" /></label>
    <button id="fit" type="button" title="Fit image in view">Fit</button>
    <span id="help" class="help" tabindex="0" role="button" aria-label="Controls help">
      ?
      <div class="help-panel">
        <h4>Drawing</h4>
        <dl>
          <dt><kbd>Click / Drag</kbd></dt><dd>Draw with the current tool</dd>
          <dt><kbd>Right-click / drag</kbd></dt><dd>Erase</dd>
          <dt><kbd>Alt + Click</kbd></dt><dd>Pick the colour under the cursor</dd>
        </dl>
        <h4>Line / Rectangle tool</h4>
        <dl>
          <dt><kbd>Drag</kbd></dt><dd>Draw the shape</dd>
          <dt><kbd>Shift + Drag</kbd></dt><dd>Snap line angle / make a square</dd>
          <dt><kbd>Esc</kbd></dt><dd>Cancel the shape</dd>
        </dl>
        <h4>Select tool</h4>
        <dl>
          <dt><kbd>Drag</kbd></dt><dd>Select an area</dd>
          <dt><kbd>Drag inside selection</kbd></dt><dd>Move it</dd>
          <dt><kbd>Alt + Drag</kbd></dt><dd>Copy it</dd>
          <dt><kbd>Ctrl + C / Ctrl + V</kbd></dt><dd>Copy / paste</dd>
          <dt><kbd>Del</kbd></dt><dd>Delete selection</dd>
          <dt><kbd>Esc</kbd></dt><dd>Clear selection</dd>
        </dl>
        <h4>Layers</h4>
        <dl>
          <dt><kbd>Open</kbd></dt><dd>Pick several PNGs to add each as a layer</dd>
          <dt><kbd>Eye</kbd></dt><dd>Cycle a layer: visible / 50% (not exported) / hidden</dd>
          <dt><kbd>Double-click name</kbd></dt><dd>Rename a layer</dd>
          <dt><kbd>Ctrl + C, pick a layer, Ctrl + V</kbd></dt><dd>Copy pixels to another layer</dd>
        </dl>
        <h4>Canvas size</h4>
        <dl>
          <dt><kbd>Drag a canvas edge or corner</kbd></dt><dd>Resize the canvas (Esc cancels)</dd>
        </dl>
        <h4>View</h4>
        <dl>
          <dt><kbd>Wheel</kbd></dt><dd>Zoom</dd>
          <dt><kbd>Middle-drag / Space + Drag</kbd></dt><dd>Pan</dd>
        </dl>
        <h4>Keys</h4>
        <dl>
          <dt><kbd>X / Y</kbd></dt><dd>Flip horizontally / vertically</dd>
          <dt><kbd>[ / ]</kbd></dt><dd>Rotate counter-clockwise / clockwise</dd>
          <dt><kbd>Ctrl + Z / Ctrl + Y</kbd></dt><dd>Undo / redo</dd>
          <dt><kbd>Ctrl + N / O / S</kbd></dt><dd>New / Open / Save</dd>
        </dl>
      </div>
    </span>
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
    <aside id="px-layers" class="px-layers panel"></aside>
  </div>
  <div class="status-row">
    <span id="px-name">untitled.png</span><span id="px-dirty"></span>
    <span id="px-layer"></span>
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
/** The handle is the file the document was opened from (not a place the user saved to). */
let handleIsSource = false;
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
  $('px-layer').textContent = `Layer: ${doc.activeLayer.name}`;
  $('px-size').textContent = `${doc.width} × ${doc.height}`;
  $('px-zoom').textContent = `${Math.round(view.viewport.scale * 100)}%`;
  $<HTMLButtonElement>('undo').disabled = !doc.history.canUndo;
  $<HTMLButtonElement>('redo').disabled = !doc.history.canRedo;
  $<HTMLButtonElement>('save').disabled = !saveAllowed(doc.layers, handle, handleIsSource);
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

const layerPanel = new LayerPanel($('px-layers'), doc, (i) => void saveLayer(i));
view.onHover = refreshHover;
doc.onChange = () => {
  view.invalidate();
  refreshStatus();
  refreshHover();
  layerPanel.refresh();
};

// ---- Tools ----

const toolList = $('tools');
for (const t of TOOLS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.tool = t.id;
  b.title = `${t.label} (${t.key})`;
  b.textContent = LABELS[t.label] ?? t.label;
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

const layerName = (file: string): string => file.replace(/\.[^.]+$/, '') || file;

interface PickedImage {
  bytes: Uint8Array;
  name: string;
  handle: FileHandle | null;
}

/**
 * Adds each image as a layer (the canvas grows to fit). Files that cannot be read are skipped and
 * named in the message. Opening into a blank document makes the file the document, so Save can
 * overwrite it when it is the only one.
 */
async function importImages(files: PickedImage[]): Promise<void> {
  const images: { name: string; px: Pixels; source?: Layer['source'] }[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      images.push({
        name: layerName(f.name),
        px: await decodeImageFile(f.bytes),
        source: f.handle ? { handle: f.handle, name: f.name } : undefined,
      });
    } catch (e) {
      errors.push(`Could not open ${f.name}: ${(e as Error).message}`);
    }
  }
  if (images.length) {
    const blank = doc.isBlank;
    try {
      const grown = doc.addLayers(images);
      if (blank) {
        const single = files.length === 1 && images.length === 1;
        handle = single ? files[0].handle : null;
        handleIsSource = single && handle !== null;
        fileName = single ? files[0].name : 'untitled.png';
      }
      if (grown) view.fit();
    } catch (e) {
      errors.push(`Could not add the images: ${(e as Error).message}`);
    }
  }
  refreshStatus();
  message(errors.join('; '), errors.length > 0);
}

async function openImage(): Promise<void> {
  if (hasFileAccess()) {
    try {
      const picked = await pickImages();
      if (picked) await importImages(picked);
    } catch (e) {
      message(`Could not open the file: ${(e as Error).message}`, true);
    }
  } else {
    $<HTMLInputElement>('open-file').click();
  }
}

$('open-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const chosen = [...(input.files ?? [])];
  input.value = '';
  if (!chosen.length) return;
  const files = await Promise.all(
    chosen.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), name: f.name, handle: null })),
  );
  await importImages(files);
});

async function saveImage(saveAs: boolean): Promise<void> {
  try {
    doc.commitFloating();
    const bytes = await encodeImageFile(flatten(doc.layers));
    const name = /\.png$/i.test(fileName) ? fileName : `${fileName}.png`;
    // A composite of several layers must not silently replace the PNG it was opened from.
    const target = doc.layers.length > 1 && handleIsSource ? null : handle;
    const saved = await saveBytes(bytes, target, name, saveAs);
    if (!saved) return;
    handle = saved.handle;
    handleIsSource = false;
    fileName = saved.name;
    doc.markSaved();
    refreshStatus();
    message(`Saved ${saved.name}`);
  } catch (e) {
    message(`Could not save: ${(e as Error).message}`, true);
  }
}

/** Saves one linked layer, alone and at full opacity, to the file it was imported from. */
async function saveLayer(index: number): Promise<void> {
  const layer = doc.layers[index];
  if (!layer?.source) return;
  try {
    if (index === doc.activeIndex) doc.commitFloating();
    message(`Saved ${await saveLayerFile(layer)}`);
  } catch (e) {
    message(`Could not save ${layer.source.name}: ${(e as Error).message}`, true);
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
  handleIsSource = false;
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
function rotate(dir: 'cw' | 'ccw'): void {
  const [w, h] = [doc.width, doc.height];
  doc.rotate(dir);
  if (doc.width !== w || doc.height !== h) view.fit();
}
$('rot-ccw').addEventListener('click', () => rotate('ccw'));
$('rot-cw').addEventListener('click', () => rotate('cw'));
$('fit').addEventListener('click', () => {
  view.fit();
  refreshStatus();
});
$<HTMLInputElement>('grid').addEventListener('change', (e) => {
  view.showGrid = (e.target as HTMLInputElement).checked;
  view.redraw();
});
const levelsInput = $<HTMLInputElement>('grid-levels');
function applyGridLevels(): void {
  view.gridLevels = parseGridLevels(levelsInput.value);
  view.redraw();
}
levelsInput.addEventListener('input', applyGridLevels);
applyGridLevels();
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
  const key = e.key.toLowerCase();
  if (!mod && !e.altKey) {
    const tool = TOOLS.find((t) => t.key.toLowerCase() === key);
    if (tool) {
      if (!tools.active) setTool(tool.id);
      return;
    }
    const action: Record<string, () => void> = {
      x: () => doc.flip('h'),
      y: () => doc.flip('v'),
      '[': () => rotate('ccw'),
      ']': () => rotate('cw'),
    };
    if (action[key] && !tools.active) {
      action[key]();
      return;
    }
  }
  if (mod && !tools.active && ['z', 'y', 's', 'o', 'n'].includes(key)) {
    e.preventDefault();
    if (key === 'z') (e.shiftKey ? doc.redo() : doc.undo());
    else if (key === 'y') doc.redo();
    else if (key === 's') {
      if (e.shiftKey || saveAllowed(doc.layers, handle, handleIsSource)) void saveImage(e.shiftKey);
    }
    else if (key === 'o') void openImage();
    else void newImage();
    return;
  }
  if (e.key === 'Escape') {
    if (hideHelp()) return;
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

// Warn before the tab closes or reloads with unsaved edits.
window.addEventListener('beforeunload', (e) => {
  if (!doc.isDirty) return;
  e.preventDefault();
  e.returnValue = '';
});
$('px-canvas').addEventListener('wheel', () => requestAnimationFrame(refreshStatus), { passive: true });

view.fit();
refreshStatus();

// Exposed to the tool and shortcut code added alongside this shell.
export { doc, view, colors, message, refreshColor, refreshStatus, setTool, openImage, saveImage, confirmDiscard };
export const currentTool = (): Tool => tools.tool;

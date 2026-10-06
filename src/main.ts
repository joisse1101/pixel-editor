import { countTiles, getMapBounds, tryLoadProject } from './model/office';
import type { Project } from './model/types';
import { MapView } from './render/mapView';
import { decodeSheets } from './render/sheets';
import './style.css';

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="toolbar">
    <label class="btn">Open Office.json<input id="open" type="file" accept=".json,application/json" hidden /></label>
    <label><input id="grid" type="checkbox" checked /> Grid</label>
    <button id="fit" type="button">Fit</button>
    <span id="zoom"></span>
    <span id="status">No project loaded</span>
  </header>
  <canvas id="map"></canvas>
`;

const canvas = document.getElementById('map') as HTMLCanvasElement;
const status = document.getElementById('status')!;
const zoomLabel = document.getElementById('zoom')!;
const view = new MapView(canvas);
let project: Project | null = null;

const updateZoom = () => (zoomLabel.textContent = view.project ? `Zoom ${view.zoomLabel()}` : '');
canvas.addEventListener('viewchange', updateZoom);

document.getElementById('open')!.addEventListener('change', async (e) => {
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
  const b = getMapBounds(project);
  status.textContent = `${file.name} - ${project.layers.length} layers, ${countTiles(project)} tiles, ${project.sheets.length} sheets, map ${b.width}x${b.height}`;
  view.setProject(project);
  updateZoom();
});

document.getElementById('grid')!.addEventListener('change', (e) => {
  view.showGrid = (e.target as HTMLInputElement).checked;
  view.draw();
});
document.getElementById('fit')!.addEventListener('click', () => {
  view.fit();
  updateZoom();
});

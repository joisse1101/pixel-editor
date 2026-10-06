import type { PixelDocument } from './document';

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>';
const EYE_SHUT =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s4 6 10 6 10-6 10-6M4 19l16-14" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

const ACTIONS = [
  { id: 'add', label: 'Add', title: 'Add a transparent layer above the active one' },
  { id: 'dup', label: 'Duplicate', title: 'Duplicate the active layer' },
  { id: 'del', label: 'Delete', title: 'Delete the active layer' },
  { id: 'up', label: 'Up', title: 'Move the active layer up' },
  { id: 'down', label: 'Down', title: 'Move the active layer down' },
] as const;

/**
 * The layer list (top of the stack first) with an eye toggle per layer, and the buttons that edit the
 * stack. It reads from the document and calls its methods; `refresh` is cheap when nothing changed.
 */
export class LayerPanel {
  private list: HTMLElement;
  private shown = '';

  constructor(
    root: HTMLElement,
    private doc: PixelDocument,
  ) {
    root.innerHTML = `<h3>Layers</h3><div class="px-layer-list" role="listbox" aria-label="Layers"></div><div class="px-layer-actions"></div>`;
    this.list = root.querySelector('.px-layer-list')!;
    const actions = root.querySelector('.px-layer-actions')!;
    for (const a of ACTIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label;
      b.title = a.title;
      b.dataset.action = a.id;
      b.addEventListener('click', () => this.run(a.id));
      actions.append(b);
    }
    this.refresh();
  }

  private run(action: (typeof ACTIONS)[number]['id']): void {
    const d = this.doc;
    if (action === 'add') d.addLayer();
    else if (action === 'dup') d.duplicateLayer();
    else if (action === 'up') d.moveLayer(d.activeIndex, 1);
    else if (action === 'down') d.moveLayer(d.activeIndex, -1);
    else if (!d.isLayerEmpty(d.activeIndex) && !window.confirm(`Delete "${d.activeLayer.name}"? Undo can restore it.`)) return;
    else d.deleteLayer();
  }

  /** Re-renders when the layer list, a name, a visibility or the active layer changed. */
  refresh(): void {
    const { layers, activeIndex } = this.doc;
    const key = layers.map((l) => `${l.id}|${l.name}|${l.visible ? 1 : 0}`).join('\n') + `#${activeIndex}`;
    const actions = this.list.parentElement!.querySelectorAll<HTMLButtonElement>('.px-layer-actions button');
    for (const b of actions) {
      const id = b.dataset.action;
      b.disabled =
        (id === 'del' && layers.length <= 1) || (id === 'up' && activeIndex >= layers.length - 1) || (id === 'down' && activeIndex <= 0);
    }
    if (key === this.shown) return;
    this.shown = key;
    this.list.replaceChildren(...[...layers.keys()].reverse().map((i) => this.row(i)));
  }

  private row(i: number): HTMLElement {
    const layer = this.doc.layers[i];
    const row = document.createElement('div');
    row.className = 'px-layer';
    row.role = 'option';
    row.classList.toggle('active', i === this.doc.activeIndex);
    row.classList.toggle('hidden', !layer.visible);
    row.ariaSelected = String(i === this.doc.activeIndex);

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'px-eye';
    eye.innerHTML = layer.visible ? EYE_OPEN : EYE_SHUT;
    eye.title = layer.visible ? 'Hide layer' : 'Show layer';
    eye.ariaPressed = String(layer.visible);
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      this.doc.setVisible(i, !layer.visible);
    });

    const name = document.createElement('span');
    name.className = 'px-layer-name';
    name.textContent = layer.name;
    name.title = 'Double-click to rename';
    name.addEventListener('dblclick', () => this.rename(i, name));

    row.append(eye, name);
    row.addEventListener('click', () => this.doc.setActive(i));
    return row;
  }

  private rename(i: number, label: HTMLElement): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'px-layer-rename';
    input.value = this.doc.layers[i].name;
    let done = false;
    const finish = (apply: boolean) => {
      if (done) return;
      done = true;
      if (apply) this.doc.renameLayer(i, input.value);
      this.shown = ''; // always rebuild the row, whatever the outcome
      this.refresh();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
      e.stopPropagation();
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
    label.replaceWith(input);
    input.focus();
    input.select();
  }
}

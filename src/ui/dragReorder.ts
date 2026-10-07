/**
 * Drag-to-reorder for a list of rows (mouse, native HTML5 drag and drop). Rows are numbered in visual
 * order and drops are reported as a slot: the gap between rows (0 = before the first row, n = after the
 * last). Callers convert that to their own array index. The rows must be `draggable`; the list is only
 * re-rendered by the caller after a drop, never during the drag.
 */

/** The slot under pointer height `y`, given each row's vertical midpoint in visual order. */
export function dropSlot(y: number, mids: number[]): number {
  let slot = 0;
  while (slot < mids.length && y >= mids[slot]) slot++;
  return slot;
}

/**
 * Where a row ends up, as a visual position, when row `from` is dropped on `slot`.
 * Returns null when the drop would not change the order.
 */
export function slotToPosition(from: number, slot: number): number | null {
  if (slot === from || slot === from + 1) return null;
  return slot > from ? slot - 1 : slot;
}

const BEFORE = 'drop-before';
const AFTER = 'drop-after';

export function enableDragReorder(list: HTMLElement, onReorder: (from: number, slot: number) => void): void {
  let from = -1;

  const rows = () => [...list.children] as HTMLElement[];
  const clear = () => {
    for (const r of rows()) r.classList.remove(BEFORE, AFTER, 'dragging');
  };
  const slotAt = (e: DragEvent) =>
    dropSlot(
      e.clientY,
      rows().map((r) => {
        const b = r.getBoundingClientRect();
        return b.top + b.height / 2;
      }),
    );

  list.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    const row = rows().find((r) => r === target);
    if (!row || target.closest('input')) {
      e.preventDefault();
      return;
    }
    from = rows().indexOf(row);
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', String(from));
    row.classList.add('dragging');
  });

  list.addEventListener('dragover', (e) => {
    if (from < 0) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    const slot = slotAt(e);
    const all = rows();
    for (const r of all) r.classList.remove(BEFORE, AFTER);
    if (slotToPosition(from, slot) === null) return;
    if (slot < all.length) all[slot].classList.add(BEFORE);
    else all[all.length - 1].classList.add(AFTER);
  });

  list.addEventListener('dragleave', (e) => {
    if (!list.contains(e.relatedTarget as Node | null)) clear();
  });

  list.addEventListener('drop', (e) => {
    if (from < 0) return;
    e.preventDefault();
    const slot = slotAt(e);
    const row = from;
    from = -1;
    clear();
    if (slotToPosition(row, slot) !== null) onReorder(row, slot);
  });

  list.addEventListener('dragend', () => {
    from = -1;
    clear();
  });
}

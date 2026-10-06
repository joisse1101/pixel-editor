import { validateSize, type Anchor } from './ops';

export interface SizeRequest {
  title: string;
  width: number;
  height: number;
  /** Show the 3x3 anchor picker (resize only). */
  anchor: boolean;
  confirm: string;
}

export interface SizeResult {
  width: number;
  height: number;
  anchor: Anchor;
}

/** Asks for a width and height (and optionally an anchor). Resolves null when cancelled. */
export function askSize(req: SizeRequest): Promise<SizeResult | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.id = 'px-size-dialog';
    dlg.innerHTML = `
      <form method="dialog" class="new-form" novalidate>
        <h3></h3>
        <label>Width <input name="w" type="number" min="1" max="4096" step="1" /></label>
        <label>Height <input name="h" type="number" min="1" max="4096" step="1" /></label>
        <div class="px-anchor" role="radiogroup" aria-label="Anchor"></div>
        <p class="hint error" role="alert"></p>
        <div class="group dialog-actions">
          <button type="submit" value="ok"></button>
          <button type="button" value="cancel">Cancel</button>
        </div>
      </form>`;
    const form = dlg.querySelector('form')!;
    const w = form.elements.namedItem('w') as HTMLInputElement;
    const h = form.elements.namedItem('h') as HTMLInputElement;
    const err = dlg.querySelector('.error')!;
    const grid = dlg.querySelector<HTMLElement>('.px-anchor')!;
    dlg.querySelector('h3')!.textContent = req.title;
    dlg.querySelector('button[type=submit]')!.textContent = req.confirm;
    w.value = String(req.width);
    h.value = String(req.height);

    let anchor: Anchor = { ax: 1, ay: 1 };
    if (req.anchor) {
      for (let ay = 0 as 0 | 1 | 2; ay <= 2; ay++) {
        for (let ax = 0 as 0 | 1 | 2; ax <= 2; ax++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'px-anchor-cell';
          b.setAttribute('role', 'radio');
          b.title = `Anchor ${['top', 'middle', 'bottom'][ay]} ${['left', 'centre', 'right'][ax]}`;
          const pick = (): void => {
            anchor = { ax, ay };
            for (const c of grid.children) c.setAttribute('aria-checked', String(c === b));
          };
          b.setAttribute('aria-checked', String(ax === 1 && ay === 1));
          b.addEventListener('click', pick);
          grid.append(b);
        }
      }
    } else {
      grid.remove();
    }

    let result: SizeResult | null = null;
    form.addEventListener('submit', (e) => {
      const width = Number(w.value);
      const height = Number(h.value);
      const problem = w.value === '' || h.value === '' ? 'Enter a width and a height.' : validateSize(width, height);
      if (problem) {
        e.preventDefault(); // keep the dialog open with the reason shown
        err.textContent = problem;
        return;
      }
      result = { width, height, anchor };
    });
    dlg.querySelector('button[type=button][value=cancel]')!.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });

    document.body.append(dlg);
    dlg.showModal();
    w.select();
  });
}

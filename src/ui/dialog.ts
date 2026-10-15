export interface DialogAction<T> {
  readonly label: string;
  readonly value: T;
  readonly variant?: 'primary' | 'secondary';
}

export interface DialogOptions<T> {
  readonly title: string;
  readonly body?: string | Node;
  readonly actions: readonly DialogAction<T>[];
  /** Value returned when the dialog is dismissed with Escape. */
  readonly dismissValue: T;
}

const VARIANTS = {
  primary: 'bg-amber-400 text-stone-900 hover:bg-amber-300',
  secondary: 'bg-white/10 text-white hover:bg-white/20',
} as const;

/** Show a modal dialog and resolve with the chosen action's value. */
export function showDialog<T>(options: DialogOptions<T>): Promise<T> {
  const dialog = document.createElement('dialog');
  dialog.className =
    'm-auto w-[min(92vw,26rem)] rounded-2xl outline-none bg-felt-dark p-0 text-white shadow-2xl backdrop:bg-black/60';

  const panel = document.createElement('div');
  panel.className = 'space-y-4 p-5';

  const title = document.createElement('h2');
  title.className = 'text-lg font-semibold';
  title.textContent = options.title;
  panel.append(title);

  if (options.body !== undefined) {
    const body = document.createElement('div');
    body.className = 'text-sm text-white/80';
    body.append(options.body);
    panel.append(body);
  }

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap justify-end gap-2 pt-1';
  panel.append(actions);
  dialog.append(panel);

  return new Promise<T>((resolve) => {
    let result = options.dismissValue;

    options.actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition ${VARIANTS[action.variant ?? 'secondary']}`;
      button.textContent = action.label;
      button.addEventListener('click', () => {
        result = action.value;
        dialog.close();
      });
      actions.append(button);
    });

    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });

    document.body.append(dialog);
    dialog.showModal();
    // showModal focuses the first field; move focus to the dialog itself so opening it never
    // pops up the on-screen keyboard. Tab still reaches every control.
    dialog.tabIndex = -1;
    dialog.focus();
  });
}

/** Build a small definition list (label → value rows) for dialog bodies. */
export function statList(rows: readonly (readonly [string, string])[]): HTMLElement {
  const list = document.createElement('dl');
  list.className = 'grid grid-cols-[1fr_auto] gap-x-6 gap-y-1';
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.className = 'text-white/70';
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.className = 'text-right font-semibold tabular-nums text-white';
    dd.textContent = value;
    list.append(dt, dd);
  }
  return list;
}

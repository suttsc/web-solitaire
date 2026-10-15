import { THEME_IDS, THEMES, type ThemeId } from './cards/themes';

export interface ThemeBarOptions {
  /** Show a theme on the table without saving it. */
  readonly preview: (id: ThemeId) => void;
  readonly save: (id: ThemeId) => void;
}

/**
 * A small bar that replaces the bottom controls while choosing a card style. Picking a theme
 * previews it on the table; Save keeps it, Cancel puts the saved one back.
 */
export function createThemeBar(
  form: HTMLFormElement,
  nav: HTMLElement,
  { preview, save }: ThemeBarOptions,
) {
  const select = form.querySelector('select');
  const cancel = form.querySelector<HTMLButtonElement>('[data-theme-cancel]');
  if (!select || !cancel) throw new Error('Theme bar markup is incomplete');

  select.replaceChildren(
    ...THEME_IDS.map((id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = THEMES[id].name;
      return option;
    }),
  );

  let saved: ThemeId = 'classic';
  const chosen = (): ThemeId => select.value as ThemeId;

  const close = () => {
    form.hidden = true;
    nav.hidden = false;
  };

  select.addEventListener('change', () => {
    preview(chosen());
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save(chosen());
    close();
  });
  cancel.addEventListener('click', () => {
    preview(saved);
    close();
  });

  return {
    open(current: ThemeId): void {
      saved = current;
      select.value = current;
      nav.hidden = true;
      form.hidden = false;
      select.focus();
    },
  };
}

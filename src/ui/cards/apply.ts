import type { Theme } from './themes';

/** Apply a theme's table colours and start loading its card font so faces don't flash. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement.style;
  root.setProperty('--color-felt', theme.felt.base);
  root.setProperty('--color-felt-dark', theme.felt.dark);
  root.setProperty('--color-felt-light', theme.felt.light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.felt.dark);
  void document.fonts.load(`${String(theme.fontWeight)} 48px ${theme.fontFamily}`).catch(() => []);
}

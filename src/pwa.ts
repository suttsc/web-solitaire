import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
});

export const canInstall = (): boolean => installPrompt !== null;

export async function install(): Promise<boolean> {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  return (await prompt.userChoice).outcome === 'accepted';
}

/**
 * Register the service worker. When an update is ready, `onUpdate` is handed a function that
 * reloads into the new version; the app decides when (only between games).
 */
export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() {
      onUpdate(() => void update(true));
    },
  });
}

/** Ask the browser not to evict our stats under storage pressure. */
export function requestPersistentStorage(): void {
  void navigator.storage.persist().catch(() => false);
}

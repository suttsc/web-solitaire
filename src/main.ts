import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/libre-bodoni/latin-700.css';
import '@fontsource/oswald/latin-600.css';
import './style.css';
import { applyTheme } from './ui/cards/apply';
import { getTheme, THEMES, type ThemeId } from './ui/cards/themes';
import { createThemeBar } from './ui/theme-bar';
import { createController, initialState, type AppState } from './app/controller';
import { currentScore, elapsed, hasStarted, type Session } from './app/session';
import { createStore } from './app/store';
import type { RecordsResponse } from '../shared/schema';
import { computeStats } from '../shared/stats';
import { compareWin } from './app/records';
import { createApi } from './data/api';
import { SolitaireDb } from './data/db';
import { createPersistence, toGameRecord } from './data/persistence';
import { createSync } from './data/sync';
import { canAutoComplete, hasUsefulMoves, type DrawMode } from './engine';
import { canInstall, install, registerServiceWorker, requestPersistentStorage } from './pwa';
import { createBoard, preloadCards } from './ui/board';
import { showDialog } from './ui/dialog';
import { formatDuration, formatNumber } from './ui/format';
import { sounds } from './ui/sound';
import {
  accountSection,
  actionButton,
  el,
  showLeaderboard,
  showStats,
  toggleRow,
  winSummary,
} from './ui/screens';
import { findWinnableDeal } from './winnable';

const SYNC_EVERY_MS = 3 * 60_000;

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

/** `?seed=123&draw=1` deals a specific game, e.g. to replay one or for end-to-end tests. */
function dealFromUrl(): { drawMode: DrawMode; seed: number } | null {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed'));
  if (!params.has('seed') || !Number.isInteger(seed) || seed < 0) return null;
  return { drawMode: params.get('draw') === '1' ? 1 : 3, seed: seed >>> 0 };
}

async function main(): Promise<void> {
  const db = new SolitaireDb();
  const persistence = createPersistence(db);
  const api = createApi();

  const [settings, saved] = await Promise.all([
    persistence.loadSettings(),
    persistence.loadSession(),
  ]);
  const store = createStore<AppState>(initialState(settings, saved ?? undefined));

  const player = () => {
    const { playerId, playerName, authToken } = store.get().settings;
    return playerId && playerName ? { id: playerId, name: playerName, token: authToken } : null;
  };
  const sync = createSync(api, persistence, player);

  let pendingUpdate: (() => void) | null = null;

  const controller = createController(store, {
    finished(session, result, now) {
      void persistence
        .recordGame(toGameRecord(session, result, now, __APP_VERSION__))
        .then(() => sync.flush());
    },
  });

  const boardEl = required('#board');
  const pauseOverlay = required('#pause-overlay') as HTMLButtonElement;
  const undoButton = required('[data-action="undo"]') as HTMLButtonElement;
  const hud = {
    score: required('[data-hud="score"]'),
    time: required('[data-hud="time"]'),
    moves: required('[data-hud="moves"]'),
  };

  preloadCards();
  const autoCompleteButton = required('#autocomplete') as HTMLButtonElement;
  const soundOn = () => store.get().settings.sound;
  const board = createBoard(
    boardEl,
    {
      tapStock: () => controller.tapStock(),
      tapCard: (pile, index) => controller.tapCard(pile, index),
      tapSlot: (pile) => controller.tapSlot(pile),
      doubleTapCard: (pile, index) => controller.doubleTapCard(pile, index),
      drop(source, target) {
        if (!controller.drop(source, target) && target && soundOn()) sounds.invalid();
      },
    },
    getTheme(settings.theme),
  );
  applyTheme(getTheme(settings.theme));

  const showTheme = (id: ThemeId) => {
    const theme = getTheme(id);
    applyTheme(theme);
    board.setTheme(theme);
  };
  const themeBar = createThemeBar(required('#theme-bar') as HTMLFormElement, required('nav'), {
    preview: showTheme,
    save: (theme) => {
      controller.updateSettings({ theme });
    },
  });

  /** Play the remaining cards to the foundations one by one so the player sees them go. */
  function runAutoComplete(): void {
    autoCompleteButton.hidden = true;
    const step = () => {
      if (controller.autoCompleteStep()) setTimeout(step, 110);
    };
    step();
  }
  autoCompleteButton.addEventListener('click', runAutoComplete);

  function renderHud(session: Session): void {
    const now = Date.now();
    hud.score.textContent = formatNumber(currentScore(session, now));
    hud.time.textContent = formatDuration(elapsed(session, now));
    hud.moves.textContent = formatNumber(session.game.state.moves);
  }

  function render(state: AppState, previous?: AppState): void {
    const { session } = state;
    const newDeal = previous !== undefined && previous.session.id !== session.id;
    board.render(
      {
        state: session.game.state,
        selection: state.selection,
        interactive: session.status === 'ready' || session.status === 'playing',
      },
      !newDeal,
    );
    renderHud(session);
    pauseOverlay.hidden = session.status !== 'paused';
    undoButton.disabled = session.status !== 'playing' || session.game.history.length === 0;
    autoCompleteButton.hidden =
      session.status !== 'playing' || !canAutoComplete(session.game.state);
  }

  async function offerUpdate(): Promise<void> {
    if (!pendingUpdate) return;
    const apply = pendingUpdate;
    pendingUpdate = null;
    const reload = await showDialog({
      title: 'Update ready',
      body: 'A new version of Solitaire is ready.',
      actions: [
        { label: 'Later', value: false },
        { label: 'Reload', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });
    if (reload) apply();
  }

  const dealingOverlay = required('#dealing');

  async function newGame(drawMode: DrawMode, seed?: number): Promise<void> {
    const { settings: current } = store.get();
    let chosen = seed;
    if (chosen === undefined && current.winnableOnly) {
      dealingOverlay.hidden = false;
      chosen = (await findWinnableDeal(drawMode, current.scoringMode)) ?? undefined;
      dealingOverlay.hidden = true;
      if (chosen === undefined) {
        await showDialog({
          title: 'Random deal',
          body: "Couldn't prove a deal winnable in time, so this one is random.",
          actions: [{ label: 'OK', value: null }],
          dismissValue: null,
        });
      }
    }
    controller.newGame(drawMode, chosen);
    await offerUpdate();
  }

  async function chooseNewGame(): Promise<void> {
    const { session, settings: current } = store.get();
    const midGame = session.status === 'playing' || session.status === 'paused';
    const warn = midGame && hasUsefulMoves(session.game.state);
    const choice = await showDialog<DrawMode | null>({
      title: warn ? 'Moves are still available' : 'New game',
      body: warn
        ? 'Redeal anyway? This game will be recorded as abandoned.'
        : 'Choose how many cards to draw from the stock.',
      actions: [
        { label: warn ? 'Keep playing' : 'Cancel', value: null },
        { label: 'Draw 1', value: 1, variant: current.drawMode === 1 ? 'primary' : 'secondary' },
        { label: 'Draw 3', value: 3, variant: current.drawMode === 3 ? 'primary' : 'secondary' },
      ],
      dismissValue: null,
    });
    if (choice !== null) await newGame(choice);
  }

  /** Win dialog: this game against your previous best and the best on record. */
  async function celebrate(session: Session): Promise<void> {
    const game = toGameRecord(session, 'won', Date.now(), __APP_VERSION__);
    const { drawMode } = session.game.state;
    const summary = el('div');
    const previous = computeStats(
      (await persistence.allGames()).filter((g) => g.id !== game.id),
      drawMode,
      game.scoringMode,
    );
    const show = (records: RecordsResponse | null, state: 'loading' | 'ready' | 'offline') => {
      summary.replaceChildren(winSummary(compareWin(game, previous, records), state));
    };
    show(null, 'loading');
    api.records(drawMode, game.id).then(
      (records) => {
        show(records, 'ready');
      },
      () => {
        show(null, 'offline');
      },
    );

    const again = await showDialog({
      title: 'You won!',
      body: summary,
      actions: [
        { label: 'Close', value: false },
        { label: 'New game', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });
    if (again) await newGame(drawMode);
    else await offerUpdate();
  }

  async function openSettings(): Promise<void> {
    const body = el('div', 'space-y-5');
    body.append(
      accountSection(
        {
          name: store.get().settings.playerName,
          protected: store.get().settings.authToken !== null,
        },
        {
          async link(name) {
            const { player: linked, created } = await sync.link(name);
            controller.updateSettings({
              playerId: linked.id,
              playerName: linked.name,
              authToken: null,
            });
            await sync.flush();
            return created
              ? `Welcome, ${linked.name}! Your games will sync to this name.`
              : `Linked to ${linked.name}. Their history is now on this device.`;
          },
          async login(name, password) {
            const { player: linked, token } = await sync.login(name, password);
            controller.updateSettings({
              playerId: linked.id,
              playerName: linked.name,
              authToken: token,
            });
            await sync.flush();
            return `Signed in as ${linked.name}. Your history is now on this device.`;
          },
          async protect(password) {
            const { playerId } = store.get().settings;
            if (!playerId) throw new Error('No player linked');
            const { token } = await api.claim(playerId, password);
            controller.updateSettings({ authToken: token });
            return 'Your name is protected. Use this password to sign in on other devices.';
          },
          async logout() {
            const { authToken } = store.get().settings;
            if (authToken) await api.logout(authToken).catch(() => undefined);
            controller.updateSettings({ playerId: null, playerName: null, authToken: null });
            return 'Signed out. Games on this device stay here.';
          },
        },
      ),
    );
    const { settings: current } = store.get();
    const themeButton = actionButton(`Card style: ${THEMES[current.theme].name}`, () => {
      themeButton.closest('dialog')?.close();
      themeBar.open(store.get().settings.theme);
    });
    body.append(themeButton);
    body.append(
      toggleRow('Sound', 'Card and win sounds', current.sound, (sound) => {
        controller.updateSettings({ sound });
      }),
      toggleRow(
        'Winnable deals only',
        'The solver checks each deal can be won before dealing it.',
        current.winnableOnly,
        (winnableOnly) => {
          controller.updateSettings({ winnableOnly });
        },
      ),
      toggleRow(
        'Vegas scoring',
        'Pay 52 to play, earn 5 per card home, limited passes. Applies from the next game.',
        current.scoringMode === 'vegas',
        (vegas) => {
          controller.updateSettings({ scoringMode: vegas ? 'vegas' : 'standard' });
        },
      ),
    );
    if (canInstall()) {
      const button = actionButton('Install app', () => {
        void install().then(() => {
          button.remove();
        });
      });
      body.append(button);
    }
    await showDialog({
      title: 'Settings',
      body,
      actions: [{ label: 'Done', value: null }],
      dismissValue: null,
    });
  }

  store.subscribe((state, previous) => {
    render(state, previous);
    const { session } = state;

    if (state.settings !== previous.settings) void persistence.saveSettings(state.settings);
    if (state.settings.theme !== previous.settings.theme) showTheme(state.settings.theme);
    if (session !== previous.session) {
      void (session.status === 'won'
        ? db.current.clear()
        : persistence.saveSession(session, Date.now()));
    }

    if (state.settings.sound && session.id === previous.session.id) {
      if (session.status === 'won' && previous.session.status !== 'won') sounds.win();
      else if (session.game.state.moves > previous.session.game.state.moves) sounds.place();
    }

    if (session.status === 'won' && previous.session.status !== 'won') void celebrate(session);
  });

  // The clock pauses whenever the app loses focus, behind an overlay so the board can't be studied for free.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controller.pause();
  });
  window.addEventListener('blur', () => {
    controller.pause();
  });
  pauseOverlay.addEventListener('click', () => {
    controller.resume();
  });

  const actions: Record<string, () => unknown> = {
    new: chooseNewGame,
    undo: () => controller.undo(),
    stats: async () =>
      showStats(
        await persistence.allGames(),
        api,
        store.get().session.game.state.drawMode,
        (game) => void newGame(game.drawMode, game.seed),
      ),
    leaderboard: () =>
      showLeaderboard(
        api,
        store.get().session.game.state.drawMode,
        store.get().settings.playerName,
      ),
    settings: openSettings,
  };

  document.querySelector('nav')?.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action) void Promise.resolve(actions[action]?.());
  });

  setInterval(() => {
    const { session } = store.get();
    if (session.status === 'playing') renderHud(session);
  }, 250);

  // Finished games upload now, whenever we come back online, and every few minutes while open.
  window.addEventListener('online', () => void sync.flush());
  setInterval(() => void sync.flush(), SYNC_EVERY_MS);
  void sync.flush();

  registerServiceWorker((apply) => {
    pendingUpdate = apply;
    const { session } = store.get();
    if (!hasStarted(session) || session.status === 'won') void offerUpdate();
  });
  requestPersistentStorage();

  render(store.get());

  const requested = dealFromUrl();
  if (requested) {
    history.replaceState(null, '', location.pathname);
    controller.newGame(requested.drawMode, requested.seed);
  }
}

void main();

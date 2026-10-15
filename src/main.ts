import './style.css';
import { createController, initialState, type AppState } from './app/controller';
import { currentScore, elapsed, hasStarted, type Session } from './app/session';
import { createStore } from './app/store';
import { createApi } from './data/api';
import { SolitaireDb } from './data/db';
import { createPersistence, toGameRecord } from './data/persistence';
import { createSync } from './data/sync';
import { hasUsefulMoves, isStuck, type DrawMode } from './engine';
import { canInstall, install, registerServiceWorker, requestPersistentStorage } from './pwa';
import { createBoard, preloadCards } from './ui/board';
import { showDialog, statList } from './ui/dialog';
import { formatDuration, formatNumber } from './ui/format';
import { actionButton, el, nameField, showLeaderboard, showStats } from './ui/screens';

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
    const { playerId, playerName } = store.get().settings;
    return playerId && playerName ? { id: playerId, name: playerName } : null;
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
  const board = createBoard(boardEl, controller);

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

  async function newGame(drawMode: DrawMode, seed?: number): Promise<void> {
    controller.newGame(drawMode, seed);
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

  async function offerWayOut(): Promise<void> {
    const choice = await showDialog<'undo' | 'new' | null>({
      title: 'No moves left',
      body: 'Nothing useful can be played on the board or from the stock.',
      actions: [
        { label: 'Close', value: null },
        { label: 'Undo', value: 'undo' },
        { label: 'New game', value: 'new', variant: 'primary' },
      ],
      dismissValue: null,
    });
    if (choice === 'undo') controller.undo();
    if (choice === 'new') await newGame(store.get().settings.drawMode);
  }

  async function celebrate(session: Session): Promise<void> {
    const now = Date.now();
    const again = await showDialog({
      title: 'You won!',
      body: statList([
        ['Time', formatDuration(elapsed(session, now))],
        ['Moves', formatNumber(session.game.state.moves)],
        ['Score', formatNumber(currentScore(session, now))],
      ]),
      actions: [
        { label: 'Close', value: false },
        { label: 'New game', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });
    if (again) await newGame(session.game.state.drawMode);
    else await offerUpdate();
  }

  async function openSettings(): Promise<void> {
    const body = el('div', 'space-y-5');
    body.append(
      nameField({
        current: store.get().settings.playerName,
        async link(name) {
          const { player: linked, created } = await sync.link(name);
          controller.updateSettings({ playerId: linked.id, playerName: linked.name });
          await sync.flush();
          return created
            ? `Welcome, ${linked.name}! Your games will sync to this name.`
            : `Linked to ${linked.name}. Their history is now on this device.`;
        },
      }),
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
    if (session !== previous.session) {
      void (session.status === 'won'
        ? db.current.clear()
        : persistence.saveSession(session, Date.now()));
    }

    if (session.status === 'won' && previous.session.status !== 'won') {
      void celebrate(session);
    } else if (
      session.status === 'playing' &&
      session.game.state !== previous.session.game.state &&
      isStuck(session.game.state)
    ) {
      void offerWayOut();
    }
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
      showStats(await persistence.allGames(), api, store.get().session.game.state.drawMode),
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

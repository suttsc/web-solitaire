import './style.css';
import { createController, initialState, type AppState } from './app/controller';
import { currentScore, elapsed, type Session } from './app/session';
import { createStore } from './app/store';
import type { DrawMode } from './engine';
import { createBoard, preloadCards } from './ui/board';
import { showDialog, statList } from './ui/dialog';
import { formatDuration, formatNumber } from './ui/format';

function required(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

/** `?seed=123&draw=1` deals a specific game, e.g. to replay one or for end-to-end tests. */
function dealFromUrl(): [DrawMode, number | undefined] {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed'));
  const drawMode: DrawMode = params.get('draw') === '1' ? 1 : 3;
  return [
    drawMode,
    params.has('seed') && Number.isInteger(seed) && seed >= 0 ? seed >>> 0 : undefined,
  ];
}

const store = createStore<AppState>(initialState(...dealFromUrl()));
const controller = createController(store);

const boardEl = required('#board');
const pauseOverlay = required('#pause-overlay') as HTMLButtonElement;
const hud = {
  score: required('[data-hud="score"]'),
  time: required('[data-hud="time"]'),
  moves: required('[data-hud="moves"]'),
};
const undoButton = required('[data-action="undo"]') as HTMLButtonElement;

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

async function chooseNewGame(): Promise<void> {
  const choice = await showDialog<DrawMode | null>({
    title: 'New game',
    body: 'Choose how many cards to draw from the stock.',
    actions: [
      { label: 'Cancel', value: null },
      { label: 'Draw 1', value: 1, variant: store.get().drawMode === 1 ? 'primary' : 'secondary' },
      { label: 'Draw 3', value: 3, variant: store.get().drawMode === 3 ? 'primary' : 'secondary' },
    ],
    dismissValue: null,
  });
  if (choice !== null) controller.newGame(choice);
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
  if (again) controller.newGame(session.game.state.drawMode);
}

store.subscribe((state, previous) => {
  render(state, previous);
  if (state.session.status === 'won' && previous.session.status !== 'won') {
    void celebrate(state.session);
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

const actions: Record<string, () => void> = {
  new: () => void chooseNewGame(),
  undo: () => controller.undo(),
  stats: () =>
    void showDialog({
      title: 'Stats',
      body: 'Stats arrive with persistence and sync.',
      actions: [{ label: 'Close', value: null }],
      dismissValue: null,
    }),
  leaderboard: () =>
    void showDialog({
      title: 'Leaderboard',
      body: 'The leaderboard arrives with sync.',
      actions: [{ label: 'Close', value: null }],
      dismissValue: null,
    }),
  settings: () =>
    void showDialog({
      title: 'Settings',
      body: 'Settings arrive with persistence.',
      actions: [{ label: 'Close', value: null }],
      dismissValue: null,
    }),
};

document.querySelector('nav')?.addEventListener('click', (event) => {
  const action = (event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action) actions[action]?.();
});

setInterval(() => {
  const { session } = store.get();
  if (session.status === 'playing') renderHud(session);
}, 250);

render(store.get());

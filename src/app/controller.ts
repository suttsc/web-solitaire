import {
  foundationMoveFor,
  isStuck,
  legalMoveBetween,
  randomSeed,
  samePile,
  sourceAt,
  type DrawMode,
  type Move,
  type PileRef,
  type Source,
} from '../engine';
import type { GameResult } from '../../shared/schema';
import { DEFAULT_SETTINGS, type Settings } from '../data/db';
import {
  hasStarted,
  pause,
  playMove,
  resume,
  startSession,
  undoMove,
  type Session,
} from './session';
import type { Store } from './store';

export interface AppState {
  readonly session: Session;
  readonly selection: Source | null;
  readonly settings: Settings;
}

export type Clock = () => number;

export interface ControllerHooks {
  /** Called once per game when it's won, or when it's left unfinished for a new deal. */
  readonly finished?: (session: Session, result: GameResult, now: number) => void;
}

export function initialState(
  settings: Settings = DEFAULT_SETTINGS,
  session: Session = startSession(
    crypto.randomUUID(),
    randomSeed(),
    settings.drawMode,
    settings.scoringMode,
  ),
): AppState {
  return { session, selection: null, settings };
}

/** Turns player intents (taps, drops, buttons) into session updates. */
export function createController(
  store: Store<AppState>,
  hooks: ControllerHooks = {},
  now: Clock = Date.now,
) {
  const update = (session: Session | null): boolean => {
    if (!session) return false;
    store.set({ session, selection: null });
    if (session.status === 'won') hooks.finished?.(session, 'won', now());
    return true;
  };

  const playOne = (move: Move | null): boolean =>
    move !== null && update(playMove(store.get().session, move, now()));

  const clearSelection = () => {
    if (store.get().selection) store.set({ selection: null });
  };

  return {
    tapStock(): boolean {
      const { stock, waste } = store.get().session.game.state;
      if (stock.length > 0) return playOne({ type: 'draw' });
      if (waste.length > 0) return playOne({ type: 'recycle' });
      clearSelection();
      return false;
    },

    /** Tap on a card: complete a pending tap-to-move, or select what was tapped. */
    tapCard(pile: PileRef, cardIndex: number): boolean {
      if (pile.kind === 'stock') return this.tapStock();
      const { session, selection } = store.get();
      const state = session.game.state;

      if (selection) {
        if (samePile(selection.pile, pile) && selection.cardIndex === cardIndex) {
          clearSelection();
          return false;
        }
        if (playOne(legalMoveBetween(state, selection, pile))) return true;
      }

      store.set({ selection: sourceAt(state, pile, cardIndex) });
      return false;
    },

    /** Tap on an empty pile (or the space below a column). */
    tapSlot(pile: PileRef): boolean {
      if (pile.kind === 'stock') return this.tapStock();
      const { session, selection } = store.get();
      if (selection && playOne(legalMoveBetween(session.game.state, selection, pile))) return true;
      clearSelection();
      return false;
    },

    /** Double-tap sends a card to its foundation if it can go. */
    doubleTapCard(pile: PileRef, cardIndex: number): boolean {
      const state = store.get().session.game.state;
      const source = sourceAt(state, pile, cardIndex);
      const moved = source !== null && playOne(foundationMoveFor(state, source));
      if (!moved) clearSelection();
      return moved;
    },

    drop(source: Source, target: PileRef | null): boolean {
      const moved =
        target !== null &&
        playOne(legalMoveBetween(store.get().session.game.state, source, target));
      if (!moved) clearSelection();
      return moved;
    },

    undo(): boolean {
      return update(undoMove(store.get().session, now()));
    },

    /** Deal a new game, recording the current one as stuck or abandoned if it was started and not won. */
    newGame(drawMode: DrawMode, seed: number = randomSeed()): void {
      const { session, settings } = store.get();
      if (hasStarted(session) && session.status !== 'won') {
        hooks.finished?.(session, isStuck(session.game.state) ? 'stuck' : 'abandoned', now());
      }
      store.set({
        session: startSession(crypto.randomUUID(), seed, drawMode, settings.scoringMode),
        selection: null,
        settings: { ...settings, drawMode },
      });
    },

    updateSettings(changes: Partial<Settings>): void {
      store.set(({ settings }) => ({ settings: { ...settings, ...changes } }));
    },

    pause(): void {
      const { session } = store.get();
      const paused = pause(session, now());
      if (paused !== session) store.set({ session: paused, selection: null });
    },

    resume(): void {
      const { session } = store.get();
      const resumed = resume(session, now());
      if (resumed !== session) store.set({ session: resumed });
    },
  };
}

export type Controller = ReturnType<typeof createController>;

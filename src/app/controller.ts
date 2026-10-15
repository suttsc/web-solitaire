import {
  foundationMoveFor,
  legalMoveBetween,
  randomSeed,
  samePile,
  sourceAt,
  type DrawMode,
  type Move,
  type PileRef,
  type Source,
} from '../engine';
import { pause, playMove, resume, startSession, undoMove, type Session } from './session';
import type { Store } from './store';

export interface AppState {
  readonly session: Session;
  readonly selection: Source | null;
  readonly drawMode: DrawMode;
}

export type Clock = () => number;

export function initialState(drawMode: DrawMode = 3, seed: number = randomSeed()): AppState {
  return {
    session: startSession(crypto.randomUUID(), seed, drawMode),
    selection: null,
    drawMode,
  };
}

/** Turns player intents (taps, drops, buttons) into session updates. */
export function createController(store: Store<AppState>, now: Clock = Date.now) {
  const update = (session: Session | null): boolean => {
    if (!session) return false;
    store.set({ session, selection: null });
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

    newGame(drawMode: DrawMode): void {
      store.set({
        session: startSession(crypto.randomUUID(), randomSeed(), drawMode),
        selection: null,
        drawMode,
      });
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

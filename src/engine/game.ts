import { tryMove } from './apply';
import { deal } from './deck';
import { isWon } from './rules';
import type { DrawMode, GameState, Move } from './types';

/** A game in progress: the current state plus everything needed to undo. */
export interface Game {
  readonly state: GameState;
  /** Previous states, oldest first. */
  readonly history: readonly GameState[];
  readonly undos: number;
}

export function newGame(seed: number, drawMode: DrawMode): Game {
  return { state: deal(seed, drawMode), history: [], undos: 0 };
}

/** Play a move. Returns null if it's illegal. */
export function play(game: Game, move: Move): Game | null {
  const next = tryMove(game.state, move);
  if (!next) return null;
  return { ...game, state: next, history: [...game.history, game.state] };
}

/**
 * Undo the last move. The board and score go back to how they were, but the
 * undo itself still counts as a move. Returns null when there's nothing to undo.
 */
export function undo(game: Game): Game | null {
  const previous = game.history.at(-1);
  if (!previous) return null;
  return {
    state: { ...previous, moves: game.state.moves + 1 },
    history: game.history.slice(0, -1),
    undos: game.undos + 1,
  };
}

export const isGameWon = (game: Game): boolean => isWon(game.state.foundations);

import { tryMove } from './apply';
import { deal } from './deck';
import { isWon } from './rules';
import type { DrawMode, GameState, Move, ScoringMode } from './types';

/** Everything the player did, in order. Replaying it from the seed rebuilds the game exactly. */
export type GameAction = Move | { readonly type: 'undo' };

/** A game in progress: the current state plus everything needed to undo. */
export interface Game {
  readonly state: GameState;
  /** Previous states, oldest first. */
  readonly history: readonly GameState[];
  readonly undos: number;
  readonly log: readonly GameAction[];
}

export function newGame(seed: number, drawMode: DrawMode, scoring: ScoringMode = 'standard'): Game {
  return { state: deal(seed, drawMode, scoring), history: [], undos: 0, log: [] };
}

/** Play a move. Returns null if it's illegal. */
export function play(game: Game, move: Move): Game | null {
  const next = tryMove(game.state, move);
  if (!next) return null;
  return {
    ...game,
    state: next,
    history: [...game.history, game.state],
    log: [...game.log, move],
  };
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
    log: [...game.log, { type: 'undo' }],
  };
}

/** Rebuild a game from its seed and action log. Throws if the log doesn't fit the deal. */
export function replay(
  seed: number,
  drawMode: DrawMode,
  log: readonly GameAction[],
  scoring: ScoringMode = 'standard',
): Game {
  return log.reduce<Game>(
    (game, action) => {
      const next = action.type === 'undo' ? undo(game) : play(game, action);
      if (!next) throw new Error(`Cannot replay ${JSON.stringify(action)}`);
      return next;
    },
    newGame(seed, drawMode, scoring),
  );
}

export const isGameWon = (game: Game): boolean => isWon(game.state.foundations);

import { canPlaceOnFoundation, canStackOnTableau, isMovableRun, topCard } from './rules';
import { canRecycle, flipPoints, movePoints } from './scoring';
import type { Card, GameState, Move, Pile } from './types';

export class IllegalMoveError extends Error {
  constructor(readonly move: Move) {
    super(`Illegal move: ${JSON.stringify(move)}`);
    this.name = 'IllegalMoveError';
  }
}

const faceUp = (card: Card): Card => (card.faceUp ? card : { ...card, faceUp: true });
const faceDown = (card: Card): Card => (card.faceUp ? { ...card, faceUp: false } : card);

const replaceAt = <T>(items: readonly T[], index: number, value: T): T[] =>
  items.map((item, i) => (i === index ? value : item));

/** Turn the newly exposed top card of a column face up. Returns the pile and whether a card flipped. */
function exposeTop(pile: Pile): [Pile, boolean] {
  const top = topCard(pile);
  if (!top || top.faceUp) return [pile, false];
  return [[...pile.slice(0, -1), faceUp(top)], true];
}

function commit(
  state: GameState,
  move: Move,
  changes: Partial<GameState>,
  flipped = false,
): GameState {
  const points =
    movePoints(move.type, state.drawMode, state.scoring) +
    (flipped ? flipPoints(state.scoring) : 0);
  const score = state.score + points;
  return {
    ...state,
    ...changes,
    score: state.scoring === 'vegas' ? score : Math.max(0, score),
    moves: state.moves + 1,
  };
}

/** Apply `move` to `state`. Returns the new state, or null if the move is illegal. Never mutates. */
export function tryMove(state: GameState, move: Move): GameState | null {
  const { stock, waste, foundations, tableau } = state;

  switch (move.type) {
    case 'draw': {
      if (stock.length === 0) return null;
      const count = Math.min(state.drawMode, stock.length);
      const drawn = stock.slice(-count).reverse().map(faceUp);
      return commit(state, move, { stock: stock.slice(0, -count), waste: [...waste, ...drawn] });
    }

    case 'recycle': {
      if (stock.length > 0 || waste.length === 0 || !canRecycle(state)) return null;
      return commit(state, move, {
        stock: [...waste].reverse().map(faceDown),
        waste: [],
        passes: state.passes + 1,
      });
    }

    case 'waste-to-foundation': {
      const card = topCard(waste);
      const target = foundations[move.foundation];
      if (!card || !target || !canPlaceOnFoundation(card, target)) return null;
      return commit(state, move, {
        waste: waste.slice(0, -1),
        foundations: replaceAt(foundations, move.foundation, [...target, card]),
      });
    }

    case 'waste-to-tableau': {
      const card = topCard(waste);
      const target = tableau[move.column];
      if (!card || !target || !canStackOnTableau(card, target)) return null;
      return commit(state, move, {
        waste: waste.slice(0, -1),
        tableau: replaceAt(tableau, move.column, [...target, card]),
      });
    }

    case 'tableau-to-foundation': {
      const source = tableau[move.column];
      const target = foundations[move.foundation];
      const card = source && topCard(source);
      if (!source || !target || !card?.faceUp || !canPlaceOnFoundation(card, target)) return null;
      const [rest, flipped] = exposeTop(source.slice(0, -1));
      return commit(
        state,
        move,
        {
          tableau: replaceAt(tableau, move.column, rest),
          foundations: replaceAt(foundations, move.foundation, [...target, card]),
        },
        flipped,
      );
    }

    case 'tableau-to-tableau': {
      if (move.from === move.to) return null;
      const source = tableau[move.from];
      const target = tableau[move.to];
      if (!source || !target || !isMovableRun(source, move.index)) return null;
      const run = source.slice(move.index);
      const [first] = run;
      if (!first || !canStackOnTableau(first, target)) return null;
      const [rest, flipped] = exposeTop(source.slice(0, move.index));
      const next = replaceAt(tableau, move.from, rest);
      return commit(
        state,
        move,
        { tableau: replaceAt(next, move.to, [...target, ...run]) },
        flipped,
      );
    }

    case 'foundation-to-tableau': {
      const source = foundations[move.foundation];
      const target = tableau[move.column];
      const card = source && topCard(source);
      if (!source || !target || !card || !canStackOnTableau(card, target)) return null;
      return commit(state, move, {
        foundations: replaceAt(foundations, move.foundation, source.slice(0, -1)),
        tableau: replaceAt(tableau, move.column, [...target, card]),
      });
    }
  }
}

/** Apply `move`, throwing IllegalMoveError if it isn't legal. */
export function applyMove(state: GameState, move: Move): GameState {
  const next = tryMove(state, move);
  if (!next) throw new IllegalMoveError(move);
  return next;
}

export const isLegal = (state: GameState, move: Move): boolean => tryMove(state, move) !== null;

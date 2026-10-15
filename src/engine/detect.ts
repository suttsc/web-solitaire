import { tryMove } from './apply';
import { legalMoves } from './moves';
import { canPlaceOnFoundation, canStackOnTableau, isMovableRun, isWon, topCard } from './rules';
import type { Card, GameState, Move, Pile } from './types';

/** Would moving the run starting at `index` turn a card over or empty the column? */
const runOpensSomething = (pile: Pile, index: number): boolean =>
  index === 0 || pile[index - 1]?.faceUp === false;

const fitsAnyFoundation = (card: Card, state: GameState): boolean =>
  state.foundations.some((pile) => canPlaceOnFoundation(card, pile));

function isUseful(state: GameState, move: Move): boolean {
  switch (move.type) {
    case 'draw':
    case 'recycle':
      return false;

    case 'waste-to-foundation':
    case 'waste-to-tableau':
    case 'tableau-to-foundation':
      return true;

    case 'tableau-to-tableau': {
      const source = state.tableau[move.from] ?? [];
      const target = state.tableau[move.to] ?? [];
      if (move.index === 0) return target.length > 0; // a king hopping between empty columns changes nothing
      const below = source[move.index - 1];
      if (!below) return false;
      return !below.faceUp || fitsAnyFoundation(below, state);
    }

    case 'foundation-to-tableau': {
      const next = tryMove(state, move);
      const column = next?.tableau[move.column];
      if (!next || !column) return false;
      const wasteTop = topCard(next.waste);
      if (wasteTop && canStackOnTableau(wasteTop, column)) return true;
      return next.tableau.some(
        (pile, index) =>
          index !== move.column &&
          pile.some(
            (card, i) =>
              isMovableRun(pile, i) &&
              runOpensSomething(pile, i) &&
              canStackOnTableau(card, column),
          ),
      );
    }
  }
}

/** Legal moves that make real progress, excluding draws and pointless shuffles. */
export function usefulBoardMoves(state: GameState): Move[] {
  return legalMoves(state).filter((move) => isUseful(state, move));
}

/**
 * Cards that will be on top of the waste at some point this pass or the next,
 * assuming nothing else is played. In draw 3 that's only every third card.
 */
export function reachableStockCards(state: GameState): Card[] {
  const total = state.stock.length + state.waste.length;
  if (total === 0) return [];

  const reachable = new Map<string, Card>();
  const remember = (card: Card | undefined) => {
    if (card) reachable.set(`${card.suit}${String(card.rank)}`, card);
  };

  remember(topCard(state.waste));
  let current = state;
  const steps = 2 * (Math.ceil(total / state.drawMode) + 1);
  for (let step = 0; step < steps; step++) {
    const next =
      tryMove(current, { type: 'draw' }) ?? tryMove(current, { type: 'recycle' }) ?? current;
    if (next === current) break;
    current = next;
    remember(topCard(current.waste));
  }

  return [...reachable.values()];
}

/** Reachable stock or waste cards that could be played somewhere right now. */
export function playableStockCards(state: GameState): Card[] {
  return reachableStockCards(state).filter(
    (card) =>
      fitsAnyFoundation(card, state) || state.tableau.some((pile) => canStackOnTableau(card, pile)),
  );
}

export const hasUsefulMoves = (state: GameState): boolean =>
  usefulBoardMoves(state).length > 0 || playableStockCards(state).length > 0;

/** No useful board move and nothing playable from the stock on any pass. Not the same as unwinnable. */
export const isStuck = (state: GameState): boolean =>
  !isWon(state.foundations) && !hasUsefulMoves(state);

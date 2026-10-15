import { tryMove } from './apply';
import { isMovableRun } from './rules';
import type { Card, GameState, Move } from './types';

/** A pile on the table, as the UI addresses it. */
export type PileRef =
  | { readonly kind: 'stock' }
  | { readonly kind: 'waste' }
  | { readonly kind: 'foundation'; readonly index: number }
  | { readonly kind: 'tableau'; readonly index: number };

/** Cards the player can pick up: a pile plus the index of the first card picked. */
export interface Source {
  readonly pile: PileRef;
  readonly cardIndex: number;
}

export const samePile = (a: PileRef, b: PileRef): boolean =>
  a.kind === b.kind && ('index' in a ? a.index : -1) === ('index' in b ? b.index : -1);

export function pileCards(state: GameState, pile: PileRef): readonly Card[] {
  switch (pile.kind) {
    case 'stock':
      return state.stock;
    case 'waste':
      return state.waste;
    case 'foundation':
      return state.foundations[pile.index] ?? [];
    case 'tableau':
      return state.tableau[pile.index] ?? [];
  }
}

/** The source starting at `cardIndex` in `pile`, if those cards can be picked up. */
export function sourceAt(state: GameState, pile: PileRef, cardIndex: number): Source | null {
  const cards = pileCards(state, pile);
  switch (pile.kind) {
    case 'stock':
      return null;
    case 'waste':
    case 'foundation':
      return cardIndex === cards.length - 1 && cardIndex >= 0 ? { pile, cardIndex } : null;
    case 'tableau':
      return isMovableRun(cards, cardIndex) ? { pile, cardIndex } : null;
  }
}

export const sourceCards = (state: GameState, source: Source): readonly Card[] =>
  pileCards(state, source.pile).slice(source.cardIndex);

/** The move that takes `source` onto `target`, or null if no such move type exists. Legality isn't checked. */
export function moveBetween(state: GameState, source: Source, target: PileRef): Move | null {
  const isTop = source.cardIndex === pileCards(state, source.pile).length - 1;
  const { pile } = source;

  if (target.kind === 'foundation') {
    if (!isTop) return null;
    if (pile.kind === 'waste') return { type: 'waste-to-foundation', foundation: target.index };
    if (pile.kind === 'tableau') {
      return { type: 'tableau-to-foundation', column: pile.index, foundation: target.index };
    }
    return null;
  }

  if (target.kind === 'tableau') {
    if (pile.kind === 'waste') return { type: 'waste-to-tableau', column: target.index };
    if (pile.kind === 'foundation') {
      return { type: 'foundation-to-tableau', foundation: pile.index, column: target.index };
    }
    if (pile.kind === 'tableau' && pile.index !== target.index) {
      return {
        type: 'tableau-to-tableau',
        from: pile.index,
        index: source.cardIndex,
        to: target.index,
      };
    }
  }

  return null;
}

/** The legal move taking `source` onto `target`, or null. */
export function legalMoveBetween(state: GameState, source: Source, target: PileRef): Move | null {
  const move = moveBetween(state, source, target);
  return move && tryMove(state, move) ? move : null;
}

/** The first legal move sending `source` to a foundation, or null. */
export function foundationMoveFor(state: GameState, source: Source): Move | null {
  for (let index = 0; index < state.foundations.length; index++) {
    const move = legalMoveBetween(state, source, { kind: 'foundation', index });
    if (move) return move;
  }
  return null;
}

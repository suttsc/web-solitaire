import { isLegal } from './apply';
import type { GameState, Move } from './types';

/** Every legal move in `state`, including draw and recycle. */
export function legalMoves(state: GameState): Move[] {
  const candidates: Move[] = [{ type: 'draw' }, { type: 'recycle' }];

  state.foundations.forEach((_, foundation) => {
    candidates.push({ type: 'waste-to-foundation', foundation });
    state.tableau.forEach((_, column) => {
      candidates.push({ type: 'tableau-to-foundation', column, foundation });
      candidates.push({ type: 'foundation-to-tableau', foundation, column });
    });
  });

  state.tableau.forEach((source, from) => {
    candidates.push({ type: 'waste-to-tableau', column: from });
    source.forEach((card, index) => {
      if (!card.faceUp) return;
      state.tableau.forEach((_, to) => {
        candidates.push({ type: 'tableau-to-tableau', from, index, to });
      });
    });
  });

  return candidates.filter((move) => isLegal(state, move));
}

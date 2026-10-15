import { tryMove } from './apply';
import { canPlaceOnFoundation, isWon, topCard } from './rules';
import type { GameState, Move } from './types';

/** Stock and waste are empty and every tableau card is face up: the game can finish itself. */
export const canAutoComplete = (state: GameState): boolean =>
  !isWon(state.foundations) &&
  state.stock.length === 0 &&
  state.waste.length === 0 &&
  state.tableau.every((pile) => pile.every((card) => card.faceUp));

/** The moves that finish the game, lowest card first. Empty if it can't auto-complete. */
export function autoCompleteMoves(state: GameState): Move[] {
  if (!canAutoComplete(state)) return [];
  const moves: Move[] = [];
  let current = state;

  while (!isWon(current.foundations)) {
    let best: Move | null = null;
    let bestRank = Infinity;
    for (const [column, pile] of current.tableau.entries()) {
      const card = topCard(pile);
      if (!card || card.rank >= bestRank) continue;
      const foundation = current.foundations.findIndex((f) => canPlaceOnFoundation(card, f));
      if (foundation >= 0) {
        best = { type: 'tableau-to-foundation', column, foundation };
        bestRank = card.rank;
      }
    }
    const next = best && tryMove(current, best);
    if (!best || !next) break;
    moves.push(best);
    current = next;
  }

  return moves;
}

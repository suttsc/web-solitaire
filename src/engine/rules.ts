import type { Card, Pile } from './types';

export const isRed = (card: Card): boolean => card.suit === 'H' || card.suit === 'D';

export const topCard = (pile: Pile): Card | undefined => pile[pile.length - 1];

/** Can `card` be placed on the tableau column `pile`? */
export function canStackOnTableau(card: Card, pile: Pile): boolean {
  const top = topCard(pile);
  if (!top) return card.rank === 13;
  return top.faceUp && isRed(top) !== isRed(card) && top.rank === card.rank + 1;
}

/** Can `card` be placed on the foundation `pile`? */
export function canPlaceOnFoundation(card: Card, pile: Pile): boolean {
  const top = topCard(pile);
  if (!top) return card.rank === 1;
  return top.suit === card.suit && top.rank + 1 === card.rank;
}

/** Is the run from `index` to the top of `pile` face up, alternating in colour and descending? */
export function isMovableRun(pile: Pile, index: number): boolean {
  if (index < 0 || index >= pile.length) return false;
  for (let i = index; i < pile.length; i++) {
    const card = pile[i];
    if (!card?.faceUp) return false;
    const next = pile[i + 1];
    if (next && (isRed(next) === isRed(card) || next.rank !== card.rank - 1)) return false;
  }
  return true;
}

export const isWon = (foundations: readonly Pile[]): boolean =>
  foundations.every((pile) => pile.length === 13);

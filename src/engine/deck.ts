import { createRng } from './rng';
import {
  FOUNDATION_COUNT,
  RANKS,
  SUITS,
  TABLEAU_COUNT,
  type Card,
  type DrawMode,
  type GameState,
} from './types';

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank, faceUp: false })));
}

/** Fisher–Yates shuffle driven by the seeded RNG; the same seed always gives the same order. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Deal a new Klondike game: column n gets n + 1 cards with only the top one face up. */
export function deal(seed: number, drawMode: DrawMode): GameState {
  const deck = shuffle(createDeck(), seed);
  const tableau: Card[][] = [];
  let next = 0;

  for (let column = 0; column < TABLEAU_COUNT; column++) {
    const pile: Card[] = [];
    for (let row = 0; row <= column; row++) {
      const card = deck[next++];
      if (!card) throw new Error('Deck ran out while dealing');
      pile.push({ ...card, faceUp: row === column });
    }
    tableau.push(pile);
  }

  return {
    seed,
    drawMode,
    stock: deck.slice(next),
    waste: [],
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    tableau,
    score: 0,
    moves: 0,
    passes: 0,
  };
}

import type { Card, GameState, Rank, Suit } from './types';

const RANK_CODES: Record<string, Rank> = {
  A: 1,
  J: 11,
  Q: 12,
  K: 13,
};

/** Parse a card code such as "7H", "10S", "KD". Face up by default; prefix with "~" for face down. */
export function card(code: string): Card {
  const faceUp = !code.startsWith('~');
  const body = faceUp ? code : code.slice(1);
  const suit = body.slice(-1) as Suit;
  const rankCode = body.slice(0, -1);
  const rank = RANK_CODES[rankCode] ?? (Number(rankCode) as Rank);
  return { suit, rank, faceUp };
}

export const cards = (codes: string): Card[] =>
  codes
    .split(/\s+/)
    .filter(Boolean)
    .map((code) => card(code));

/** Build a full foundation pile from ace up to `top` for one suit. */
export function foundationUpTo(suit: Suit, top: number): Card[] {
  return Array.from({ length: top }, (_, i) => ({ suit, rank: (i + 1) as Rank, faceUp: true }));
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    drawMode: 3,
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    score: 0,
    moves: 0,
    passes: 0,
    ...overrides,
  };
}

export const allCards = (state: GameState): Card[] => [
  ...state.stock,
  ...state.waste,
  ...state.foundations.flat(),
  ...state.tableau.flat(),
];

/** Narrow away null/undefined in tests, failing loudly instead of asserting with `!`. */
export function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value');
  return value;
}

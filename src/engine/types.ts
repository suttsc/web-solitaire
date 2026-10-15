export const SUITS = ['C', 'D', 'H', 'S'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  readonly faceUp: boolean;
}

/** A stack of cards. The last element is the top card. */
export type Pile = readonly Card[];

export type DrawMode = 1 | 3;

/** Standard (Windows-style points) or Vegas (pay per card, limited passes). */
export type ScoringMode = 'standard' | 'vegas';

export const FOUNDATION_COUNT = 4;
export const TABLEAU_COUNT = 7;

export interface GameState {
  readonly seed: number;
  readonly drawMode: DrawMode;
  readonly scoring: ScoringMode;
  readonly stock: Pile;
  readonly waste: Pile;
  readonly foundations: readonly Pile[];
  readonly tableau: readonly Pile[];
  /**
   * Points from moves. Standard: never below zero, with time penalty and win bonus applied on top.
   * Vegas: starts at the ante and can go negative.
   */
  readonly score: number;
  readonly moves: number;
  /** Number of times the waste has been recycled into the stock. */
  readonly passes: number;
}

export type Move =
  | { readonly type: 'draw' }
  | { readonly type: 'recycle' }
  | { readonly type: 'waste-to-foundation'; readonly foundation: number }
  | { readonly type: 'waste-to-tableau'; readonly column: number }
  | { readonly type: 'tableau-to-foundation'; readonly column: number; readonly foundation: number }
  | {
      readonly type: 'tableau-to-tableau';
      readonly from: number;
      /** Index in the source column of the first card of the run being moved. */
      readonly index: number;
      readonly to: number;
    }
  | {
      readonly type: 'foundation-to-tableau';
      readonly foundation: number;
      readonly column: number;
    };

export type MoveType = Move['type'];

import { describe, expect, it } from 'vitest';
import {
  hasUsefulMoves,
  isStuck,
  playableStockCards,
  reachableStockCards,
  usefulBoardMoves,
} from './detect';
import { cards, foundationUpTo, makeState } from './test-helpers';

const keys = (list: { suit: string; rank: number }[]) =>
  list.map((c) => `${String(c.rank)}${c.suit}`).sort();

const empty = () => [[], [], [], [], [], [], []] as ReturnType<typeof cards>[];

describe('usefulBoardMoves', () => {
  it('counts moves that turn a card over', () => {
    const state = makeState({ tableau: [cards('~2C 8D'), cards('9S'), ...empty().slice(2)] });
    expect(usefulBoardMoves(state)).toEqual([
      { type: 'tableau-to-tableau', from: 0, index: 1, to: 1 },
    ]);
  });

  it('ignores a king moving between empty columns', () => {
    const state = makeState({ tableau: [cards('KS QH'), ...empty().slice(1)] });
    expect(usefulBoardMoves(state)).toEqual([]);
  });

  it('counts moving a whole column onto another to empty it', () => {
    const state = makeState({ tableau: [cards('8D'), cards('9S'), ...empty().slice(2)] });
    expect(usefulBoardMoves(state)).toHaveLength(1);
  });

  it('ignores shuffling a run between two identical targets', () => {
    // 7H sits on 8S; moving it to 8C reveals nothing.
    const state = makeState({ tableau: [cards('KD 8S 7H'), cards('8C'), ...empty().slice(2)] });
    expect(usefulBoardMoves(state)).toEqual([]);
  });

  it('counts a shuffle that frees a card for the foundation', () => {
    const state = makeState({
      foundations: [foundationUpTo('S', 7), [], [], []],
      tableau: [cards('KD 8S 7H'), cards('8C'), ...empty().slice(2)],
    });
    expect(usefulBoardMoves(state)).toContainEqual({
      type: 'tableau-to-tableau',
      from: 0,
      index: 2,
      to: 1,
    });
  });

  it('always counts waste plays and foundation plays', () => {
    const state = makeState({
      waste: cards('AH'),
      tableau: [cards('~3C AS'), ...empty().slice(1)],
    });
    const types = usefulBoardMoves(state).map((m) => m.type);
    expect(types).toContain('waste-to-foundation');
    expect(types).toContain('tableau-to-foundation');
  });

  it('counts foundation to tableau only when it unlocks a play', () => {
    // 5H back onto 6S lets the waste 4C follow.
    const unlocks = makeState({
      waste: cards('4C'),
      foundations: [foundationUpTo('H', 5), [], [], []],
      tableau: [cards('6S'), ...empty().slice(1)],
    });
    expect(usefulBoardMoves(unlocks)).toContainEqual({
      type: 'foundation-to-tableau',
      foundation: 0,
      column: 0,
    });

    // 5H back onto 6S lets 4C (covering a face-down card) move.
    const reveals = makeState({
      foundations: [foundationUpTo('H', 5), [], [], []],
      tableau: [cards('6S'), cards('~9D 4C'), ...empty().slice(2)],
    });
    expect(usefulBoardMoves(reveals)).toContainEqual({
      type: 'foundation-to-tableau',
      foundation: 0,
      column: 0,
    });

    const pointless = makeState({
      foundations: [foundationUpTo('H', 5), [], [], []],
      tableau: [cards('6S'), ...empty().slice(1)],
    });
    expect(usefulBoardMoves(pointless)).toEqual([]);
  });
});

describe('stock awareness', () => {
  it('reaches every card in draw 1', () => {
    const state = makeState({ drawMode: 1, stock: cards('~AH ~2H ~3H'), waste: cards('4H') });
    expect(keys(reachableStockCards(state))).toEqual(['1H', '2H', '3H', '4H']);
  });

  it('only reaches every third card in draw 3', () => {
    // Stock top is the last card: draws reveal 4H, then 1H.
    const state = makeState({ stock: cards('~AH ~2H ~3H ~4H ~5H ~6H') });
    expect(keys(reachableStockCards(state))).toEqual(['1H', '4H']);
  });

  it('includes the next pass after a recycle', () => {
    // Waste [AH 2H 3H 4H] (4H on top), empty stock. Recycle then draw 3: 3H... order from stock top AH.
    const state = makeState({ waste: cards('AH 2H 3H 4H') });
    expect(keys(reachableStockCards(state))).toEqual(['3H', '4H']);
  });

  it('returns nothing when stock and waste are empty', () => {
    expect(reachableStockCards(makeState())).toEqual([]);
  });

  it('finds playable cards in the stock', () => {
    const state = makeState({
      stock: cards('~AH ~2H ~3H ~4H ~5H ~6H'),
      tableau: [cards('5S'), ...empty().slice(1)],
    });
    expect(keys(playableStockCards(state))).toEqual(['1H', '4H']);
    expect(hasUsefulMoves(state)).toBe(true);
    expect(isStuck(state)).toBe(false);
  });
});

describe('isStuck', () => {
  it('is stuck when nothing useful exists on the board or in the stock', () => {
    const state = makeState({
      stock: cards('~2H ~3H ~5H'),
      tableau: [cards('~9C 7S'), ...empty().slice(1)],
    });
    expect(isStuck(state)).toBe(true);
  });

  it('is not stuck once won', () => {
    const won = makeState({
      foundations: [
        foundationUpTo('C', 13),
        foundationUpTo('D', 13),
        foundationUpTo('H', 13),
        foundationUpTo('S', 13),
      ],
    });
    expect(isStuck(won)).toBe(false);
  });
});

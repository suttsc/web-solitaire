import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canPlaceOnFoundation,
  canStackOnTableau,
  createDeck,
  createRng,
  deal,
  displayScore,
  IllegalMoveError,
  isGameWon,
  isMovableRun,
  legalMoves,
  newGame,
  play,
  randomSeed,
  shuffle,
  timePenalty,
  tryMove,
  undo,
  winBonus,
  type Game,
  type Move,
} from '.';
import { allCards, card, cards, foundationUpTo, makeState } from './test-helpers';

const cardKey = (c: { suit: string; rank: number }) => `${String(c.rank)}${c.suit}`;

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it('creates random 32-bit seeds', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it('gives different streams for neighbouring seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('returns values in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('deck and deal', () => {
  it('creates 52 unique face-down cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardKey)).size).toBe(52);
    expect(deck.every((c) => !c.faceUp)).toBe(true);
  });

  it('shuffles reproducibly by seed', () => {
    expect(shuffle(createDeck(), 99)).toEqual(shuffle(createDeck(), 99));
    expect(shuffle(createDeck(), 99)).not.toEqual(shuffle(createDeck(), 100));
  });

  it('deals the Klondike layout', () => {
    const state = deal(123, 3);
    expect(state.tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const pile of state.tableau) {
      expect(pile.at(-1)?.faceUp).toBe(true);
      expect(pile.slice(0, -1).every((c) => !c.faceUp)).toBe(true);
    }
    expect(state.stock).toHaveLength(24);
    expect(state.stock.every((c) => !c.faceUp)).toBe(true);
    expect(state.waste).toHaveLength(0);
    expect(state.foundations.every((pile) => pile.length === 0)).toBe(true);
    expect(new Set(allCards(state).map(cardKey)).size).toBe(52);
  });

  it('records seed and draw mode', () => {
    expect(deal(5, 1)).toMatchObject({ seed: 5, drawMode: 1, score: 0, moves: 0, passes: 0 });
  });
});

describe('rules', () => {
  it('stacks alternating colours in descending rank', () => {
    expect(canStackOnTableau(card('6H'), cards('7S'))).toBe(true);
    expect(canStackOnTableau(card('6D'), cards('7C'))).toBe(true);
    expect(canStackOnTableau(card('6S'), cards('7C'))).toBe(false);
    expect(canStackOnTableau(card('5H'), cards('7S'))).toBe(false);
    expect(canStackOnTableau(card('8H'), cards('7S'))).toBe(false);
  });

  it('only allows kings on empty columns', () => {
    expect(canStackOnTableau(card('KH'), [])).toBe(true);
    expect(canStackOnTableau(card('QH'), [])).toBe(false);
  });

  it('never stacks on a face-down card', () => {
    expect(canStackOnTableau(card('6H'), cards('~7S'))).toBe(false);
  });

  it('builds foundations up by suit from the ace', () => {
    expect(canPlaceOnFoundation(card('AH'), [])).toBe(true);
    expect(canPlaceOnFoundation(card('2H'), [])).toBe(false);
    expect(canPlaceOnFoundation(card('2H'), cards('AH'))).toBe(true);
    expect(canPlaceOnFoundation(card('2D'), cards('AH'))).toBe(false);
    expect(canPlaceOnFoundation(card('3H'), cards('AH'))).toBe(false);
  });

  it('recognises movable runs', () => {
    const pile = cards('~9C 8D 7S 6H');
    expect(isMovableRun(pile, 1)).toBe(true);
    expect(isMovableRun(pile, 3)).toBe(true);
    expect(isMovableRun(pile, 0)).toBe(false);
    expect(isMovableRun(pile, 4)).toBe(false);
    expect(isMovableRun(cards('8D 7D'), 0)).toBe(false);
    expect(isMovableRun(cards('8D 6S'), 0)).toBe(false);
  });
});

describe('applyMove', () => {
  describe('draw', () => {
    it('draws three cards in draw 3, last drawn on top', () => {
      const state = makeState({ stock: cards('~AH ~2H ~3H ~4H ~5H') });
      const next = applyMove(state, { type: 'draw' });
      expect(next.stock.map(cardKey)).toEqual(['1H', '2H']);
      expect(next.waste.map(cardKey)).toEqual(['5H', '4H', '3H']);
      expect(next.waste.every((c) => c.faceUp)).toBe(true);
      expect(next.moves).toBe(1);
      expect(next.score).toBe(0);
    });

    it('draws what is left when fewer than three remain', () => {
      const next = applyMove(makeState({ stock: cards('~AH ~2H') }), { type: 'draw' });
      expect(next.stock).toHaveLength(0);
      expect(next.waste.map(cardKey)).toEqual(['2H', '1H']);
    });

    it('draws one card in draw 1', () => {
      const next = applyMove(makeState({ drawMode: 1, stock: cards('~AH ~2H') }), {
        type: 'draw',
      });
      expect(next.waste.map(cardKey)).toEqual(['2H']);
    });

    it('is illegal with an empty stock', () => {
      expect(tryMove(makeState(), { type: 'draw' })).toBeNull();
    });
  });

  describe('recycle', () => {
    it('turns the waste back into the stock in original order', () => {
      const start = makeState({ stock: cards('~AH ~2H ~3H ~4H') });
      let state = applyMove(start, { type: 'draw' });
      state = applyMove(state, { type: 'draw' });
      state = applyMove(state, { type: 'recycle' });
      expect(state.stock.map(cardKey)).toEqual(start.stock.map(cardKey));
      expect(state.stock.every((c) => !c.faceUp)).toBe(true);
      expect(state.waste).toHaveLength(0);
      expect(state.passes).toBe(1);
    });

    it('costs 20 points in draw 3 and 100 in draw 1', () => {
      expect(
        applyMove(makeState({ score: 50, waste: cards('AH') }), { type: 'recycle' }).score,
      ).toBe(30);
      expect(
        applyMove(makeState({ drawMode: 1, score: 150, waste: cards('AH') }), { type: 'recycle' })
          .score,
      ).toBe(50);
    });

    it('never takes the score below zero', () => {
      expect(
        applyMove(makeState({ score: 5, waste: cards('AH') }), { type: 'recycle' }).score,
      ).toBe(0);
    });

    it('is illegal while the stock has cards or the waste is empty', () => {
      expect(
        tryMove(makeState({ stock: cards('~AH'), waste: cards('2H') }), { type: 'recycle' }),
      ).toBeNull();
      expect(tryMove(makeState(), { type: 'recycle' })).toBeNull();
    });
  });

  it('moves waste to foundation for 10 points', () => {
    const next = applyMove(makeState({ waste: cards('2S AH') }), {
      type: 'waste-to-foundation',
      foundation: 2,
    });
    expect(next.waste.map(cardKey)).toEqual(['2S']);
    expect(next.foundations[2]?.map(cardKey)).toEqual(['1H']);
    expect(next.score).toBe(10);
  });

  it('moves waste to tableau for 5 points', () => {
    const next = applyMove(
      makeState({ waste: cards('6H'), tableau: [cards('7S'), [], [], [], [], [], []] }),
      { type: 'waste-to-tableau', column: 0 },
    );
    expect(next.tableau[0]?.map(cardKey)).toEqual(['7S', '6H']);
    expect(next.score).toBe(5);
  });

  it('moves tableau to foundation for 10, plus 5 for the card it turns over', () => {
    const next = applyMove(makeState({ tableau: [cards('~9C AS'), [], [], [], [], [], []] }), {
      type: 'tableau-to-foundation',
      column: 0,
      foundation: 0,
    });
    expect(next.tableau[0]).toEqual([card('9C')]);
    expect(next.score).toBe(15);
  });

  it('moves a run between columns and turns over the exposed card', () => {
    const next = applyMove(
      makeState({ tableau: [cards('~KC 8D 7S'), cards('9S'), [], [], [], [], []] }),
      { type: 'tableau-to-tableau', from: 0, index: 1, to: 1 },
    );
    expect(next.tableau[0]).toEqual([card('KC')]);
    expect(next.tableau[1]?.map(cardKey)).toEqual(['9S', '8D', '7S']);
    expect(next.score).toBe(5);
  });

  it('scores nothing for a tableau move that turns nothing over', () => {
    const next = applyMove(
      makeState({ tableau: [cards('10H 9S'), cards('10D'), [], [], [], [], []] }),
      { type: 'tableau-to-tableau', from: 0, index: 1, to: 1 },
    );
    expect(next.score).toBe(0);
  });

  it('rejects a run that is not in sequence', () => {
    const state = makeState({ tableau: [cards('8D 7D'), cards('9S'), [], [], [], [], []] });
    expect(tryMove(state, { type: 'tableau-to-tableau', from: 0, index: 0, to: 1 })).toBeNull();
  });

  it('rejects moving a column onto itself', () => {
    const state = makeState({ tableau: [cards('KD'), [], [], [], [], [], []] });
    expect(tryMove(state, { type: 'tableau-to-tableau', from: 0, index: 0, to: 0 })).toBeNull();
  });

  it('moves foundation back to tableau for −15', () => {
    const next = applyMove(
      makeState({
        score: 40,
        foundations: [foundationUpTo('H', 6), [], [], []],
        tableau: [cards('7S'), [], [], [], [], [], []],
      }),
      { type: 'foundation-to-tableau', foundation: 0, column: 0 },
    );
    expect(next.foundations[0]).toHaveLength(5);
    expect(next.tableau[0]?.map(cardKey)).toEqual(['7S', '6H']);
    expect(next.score).toBe(25);
  });

  it('rejects out-of-range piles', () => {
    const state = makeState({ waste: cards('AH') });
    expect(tryMove(state, { type: 'waste-to-foundation', foundation: 9 })).toBeNull();
    expect(tryMove(state, { type: 'waste-to-tableau', column: -1 })).toBeNull();
  });

  it('throws IllegalMoveError for illegal moves', () => {
    expect(() => applyMove(makeState(), { type: 'draw' })).toThrow(IllegalMoveError);
  });

  it('never mutates the input state', () => {
    const state = deal(3, 3);
    const snapshot = structuredClone(state);
    applyMove(state, { type: 'draw' });
    expect(state).toEqual(snapshot);
  });
});

describe('scoring', () => {
  it('applies −2 per full 10 seconds', () => {
    expect(timePenalty(9_999)).toBe(0);
    expect(timePenalty(10_000)).toBe(2);
    expect(timePenalty(65_000)).toBe(12);
  });

  it('gives a win bonus only after 30 seconds', () => {
    expect(winBonus(30_000)).toBe(0);
    expect(winBonus(31_000)).toBe(Math.floor(700_000 / 31));
    expect(winBonus(200_000)).toBe(3500);
  });

  it('floors the displayed score at zero before adding the bonus', () => {
    expect(displayScore(10, 100_000, false)).toBe(0);
    expect(displayScore(100, 100_000, false)).toBe(80);
    expect(displayScore(100, 100_000, true)).toBe(80 + 7000);
  });
});

describe('game session and undo', () => {
  it('undo restores the board and score but counts as a move', () => {
    const start: Game = {
      state: makeState({ waste: cards('AH') }),
      history: [],
      undos: 0,
    };
    const played = play(start, { type: 'waste-to-foundation', foundation: 0 });
    expect(played?.state.score).toBe(10);

    const undone = played && undo(played);
    expect(undone?.state.waste).toEqual(start.state.waste);
    expect(undone?.state.foundations).toEqual(start.state.foundations);
    expect(undone?.state.score).toBe(0);
    expect(undone?.state.moves).toBe(2);
    expect(undone?.undos).toBe(1);
  });

  it('undoes stock draws', () => {
    const game = newGame(11, 3);
    const drawn = play(game, { type: 'draw' });
    const undone = drawn && undo(drawn);
    expect(undone?.state.stock).toEqual(game.state.stock);
    expect(undone?.state.waste).toEqual([]);
  });

  it('returns null with nothing to undo and for illegal plays', () => {
    const game = newGame(1, 3);
    expect(undo(game)).toBeNull();
    expect(play(game, { type: 'recycle' })).toBeNull();
  });

  it('detects a win', () => {
    const won = makeState({
      foundations: [
        foundationUpTo('C', 13),
        foundationUpTo('D', 13),
        foundationUpTo('H', 13),
        foundationUpTo('S', 13),
      ],
    });
    expect(isGameWon({ state: won, history: [], undos: 0 })).toBe(true);
    expect(isGameWon(newGame(1, 3))).toBe(false);
  });
});

describe('legalMoves', () => {
  it('lists the obvious moves', () => {
    const state = makeState({
      stock: cards('~2C'),
      waste: cards('AH'),
      tableau: [cards('7S'), cards('6H'), [], [], [], [], []],
    });
    const moves = legalMoves(state);
    expect(moves).toContainEqual({ type: 'draw' });
    expect(moves).toContainEqual({ type: 'waste-to-foundation', foundation: 0 });
    expect(moves).toContainEqual({ type: 'tableau-to-tableau', from: 1, index: 0, to: 0 });
    expect(moves).not.toContainEqual({ type: 'recycle' });
  });
});

describe('properties', () => {
  const playRandom = (seed: number, drawMode: 1 | 3, picks: number[]) => {
    let game = newGame(seed, drawMode);
    const games: Game[] = [game];
    for (const pick of picks) {
      const moves = legalMoves(game.state);
      const move: Move | undefined = moves[pick % Math.max(1, moves.length)];
      if (!move) break;
      game = play(game, move) ?? game;
      games.push(game);
    }
    return games;
  };

  it('always has 52 unique cards and never a face-down card on a foundation or waste', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.constantFrom<1 | 3>(1, 3),
        fc.array(fc.nat(), { maxLength: 120 }),
        (seed, drawMode, picks) => {
          for (const { state } of playRandom(seed, drawMode, picks)) {
            const all = allCards(state);
            expect(all).toHaveLength(52);
            expect(new Set(all.map(cardKey)).size).toBe(52);
            expect(state.waste.every((c) => c.faceUp)).toBe(true);
            expect(state.foundations.flat().every((c) => c.faceUp)).toBe(true);
            expect(state.score).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('undo restores the exact previous board after any move', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.nat(), { minLength: 1, maxLength: 60 }),
        (seed, picks) => {
          const games = playRandom(seed, 3, picks);
          const last = games.at(-1);
          const previous = last?.history.at(-1);
          if (!last || !previous) return;
          const undone = undo(last);
          expect({ ...undone?.state, moves: 0 }).toEqual({ ...previous, moves: 0 });
        },
      ),
      { numRuns: 200 },
    );
  });
});

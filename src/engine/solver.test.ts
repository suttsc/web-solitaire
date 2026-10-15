import { describe, expect, it } from 'vitest';
import { applyMove, deal, findWinnableSeed, isWon, solve } from '.';
import { cards, foundationUpTo, makeState } from './test-helpers';

describe('solver', () => {
  it('finishes a nearly won game', () => {
    const state = makeState({
      stock: cards('~QC'),
      foundations: [
        foundationUpTo('C', 11),
        foundationUpTo('D', 13),
        foundationUpTo('H', 13),
        foundationUpTo('S', 12),
      ],
      tableau: [cards('KC'), cards('KS'), [], [], [], [], []],
    });
    const result = solve(state);
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    expect(isWon(result.moves.reduce(applyMove, state).foundations)).toBe(true);
  });

  it('gives up within its budget', () => {
    const result = solve(deal(1, 3), { maxNodes: 5 });
    expect(result.nodes).toBeLessThanOrEqual(5);
  });

  it('solves real deals in both draw modes, and the moves really win', () => {
    for (const drawMode of [1, 3] as const) {
      let solved = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const start = deal(seed, drawMode);
        const result = solve(start, { maxNodes: 15_000 });
        if (result.status !== 'solved') continue;
        solved++;
        expect(isWon(result.moves.reduce(applyMove, start).foundations)).toBe(true);
      }
      expect(solved).toBeGreaterThan(3);
    }
  }, 30_000);

  it('finds a winnable seed', () => {
    let next = 100;
    const seed = findWinnableSeed(3, 'standard', () => next++);
    expect(seed).not.toBeNull();
    expect(solve(deal(seed ?? 0, 3), { maxNodes: 40_000 }).status).toBe('solved');
  }, 30_000);

  it('returns null when the budget runs out', () => {
    expect(findWinnableSeed(3, 'standard', () => 1, { perDeal: 1, budget: 3 })).toBeNull();
  });
});

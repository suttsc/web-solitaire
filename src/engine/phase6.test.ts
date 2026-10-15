import { describe, expect, it } from 'vitest';
import {
  applyMove,
  autoCompleteMoves,
  canAutoComplete,
  deal,
  displayScore,
  isWon,
  replay,
  tryMove,
  type GameState,
} from '.';
import { cards, foundationUpTo, makeState } from './test-helpers';

describe('vegas scoring', () => {
  const vegas = (overrides: Partial<GameState> = {}) =>
    makeState({ scoring: 'vegas', score: -52, ...overrides });

  it('antes 52 at the deal', () => {
    expect(deal(1, 3, 'vegas').score).toBe(-52);
    expect(deal(1, 3).score).toBe(0);
  });

  it('pays 5 per card to a foundation, takes 5 back, nothing for other moves', () => {
    let state = vegas({
      waste: cards('AH'),
      tableau: [cards('~9C 2H'), cards('3S'), [], [], [], [], []],
    });
    state = applyMove(state, { type: 'waste-to-foundation', foundation: 0 });
    expect(state.score).toBe(-47);
    state = applyMove(state, { type: 'tableau-to-foundation', column: 0, foundation: 0 });
    expect(state.score).toBe(-42); // no flip bonus in Vegas
    state = applyMove(state, { type: 'foundation-to-tableau', foundation: 0, column: 1 });
    expect(state.score).toBe(-47);
  });

  it('allows three passes in draw 3 and one in draw 1', () => {
    const three = vegas({ waste: cards('AH') });
    expect(tryMove({ ...three, passes: 1 }, { type: 'recycle' })).not.toBeNull();
    expect(tryMove({ ...three, passes: 2 }, { type: 'recycle' })).toBeNull();
    expect(tryMove(vegas({ drawMode: 1, waste: cards('AH') }), { type: 'recycle' })).toBeNull();
    expect(applyMove(three, { type: 'recycle' }).score).toBe(-52);
  });

  it('shows the raw running total, ignoring time', () => {
    expect(displayScore(-30, 600_000, true, 'vegas')).toBe(-30);
  });

  it('replays with the same scoring mode', () => {
    expect(replay(9, 3, [{ type: 'draw' }], 'vegas').state.scoring).toBe('vegas');
  });
});

describe('auto-complete', () => {
  const ready = () =>
    makeState({
      foundations: [
        foundationUpTo('C', 11),
        foundationUpTo('D', 11),
        foundationUpTo('H', 12),
        foundationUpTo('S', 10),
      ],
      tableau: [cards('KH QC JS'), cards('KD QS'), cards('KC QD'), cards('KS'), [], [], []],
    });

  it('needs an empty stock and waste and every card face up', () => {
    expect(canAutoComplete(ready())).toBe(true);
    expect(canAutoComplete({ ...ready(), waste: cards('AH') })).toBe(false);
    expect(canAutoComplete(makeState({ tableau: [cards('~KH QC'), [], [], [], [], [], []] }))).toBe(
      false,
    );
    expect(
      autoCompleteMoves(makeState({ tableau: [cards('~KH'), [], [], [], [], [], []] })),
    ).toEqual([]);
  });

  it('plays every remaining card to the foundations, lowest first', () => {
    const moves = autoCompleteMoves(ready());
    expect(moves).toHaveLength(8);
    expect(moves[0]).toEqual({ type: 'tableau-to-foundation', column: 0, foundation: 3 });
    const end = moves.reduce(applyMove, ready());
    expect(isWon(end.foundations)).toBe(true);
    expect(canAutoComplete(end)).toBe(false);
  });
});

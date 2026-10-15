import { describe, expect, it } from 'vitest';
import {
  foundationMoveFor,
  legalMoveBetween,
  moveBetween,
  pileCards,
  samePile,
  sourceAt,
  sourceCards,
} from './targets';
import { cards, foundationUpTo, makeState } from './test-helpers';

const state = makeState({
  stock: cards('~2C'),
  waste: cards('3D AH'),
  foundations: [foundationUpTo('S', 2), [], [], []],
  tableau: [cards('~9C 8D 7S'), cards('8H'), [], [], [], [], []],
});

describe('targets', () => {
  it('compares piles', () => {
    expect(samePile({ kind: 'tableau', index: 1 }, { kind: 'tableau', index: 1 })).toBe(true);
    expect(samePile({ kind: 'tableau', index: 1 }, { kind: 'foundation', index: 1 })).toBe(false);
    expect(samePile({ kind: 'waste' }, { kind: 'waste' })).toBe(true);
  });

  it('reads pile cards', () => {
    expect(pileCards(state, { kind: 'stock' })).toHaveLength(1);
    expect(pileCards(state, { kind: 'tableau', index: 99 })).toEqual([]);
    expect(pileCards(state, { kind: 'foundation', index: 99 })).toEqual([]);
  });

  it('only lets movable cards be picked up', () => {
    expect(sourceAt(state, { kind: 'stock' }, 0)).toBeNull();
    expect(sourceAt(state, { kind: 'waste' }, 0)).toBeNull();
    expect(sourceAt(state, { kind: 'waste' }, 1)).not.toBeNull();
    expect(sourceAt(state, { kind: 'foundation', index: 0 }, 1)).not.toBeNull();
    expect(sourceAt(state, { kind: 'foundation', index: 1 }, -1)).toBeNull();
    expect(sourceAt(state, { kind: 'tableau', index: 0 }, 0)).toBeNull();
    expect(sourceAt(state, { kind: 'tableau', index: 0 }, 1)).not.toBeNull();
  });

  it('returns the cards in a source', () => {
    expect(sourceCards(state, { pile: { kind: 'tableau', index: 0 }, cardIndex: 1 })).toEqual(
      cards('8D 7S'),
    );
  });

  it('maps sources and targets to moves', () => {
    const waste = { pile: { kind: 'waste' }, cardIndex: 1 } as const;
    const run = { pile: { kind: 'tableau', index: 0 }, cardIndex: 1 } as const;
    const top = { pile: { kind: 'tableau', index: 0 }, cardIndex: 2 } as const;
    const foundation = { pile: { kind: 'foundation', index: 0 }, cardIndex: 1 } as const;

    expect(moveBetween(state, waste, { kind: 'foundation', index: 2 })).toEqual({
      type: 'waste-to-foundation',
      foundation: 2,
    });
    expect(moveBetween(state, waste, { kind: 'tableau', index: 3 })).toEqual({
      type: 'waste-to-tableau',
      column: 3,
    });
    expect(moveBetween(state, run, { kind: 'foundation', index: 0 })).toBeNull();
    expect(moveBetween(state, top, { kind: 'foundation', index: 0 })).toEqual({
      type: 'tableau-to-foundation',
      column: 0,
      foundation: 0,
    });
    expect(moveBetween(state, run, { kind: 'tableau', index: 1 })).toEqual({
      type: 'tableau-to-tableau',
      from: 0,
      index: 1,
      to: 1,
    });
    expect(moveBetween(state, run, { kind: 'tableau', index: 0 })).toBeNull();
    expect(moveBetween(state, foundation, { kind: 'tableau', index: 1 })).toEqual({
      type: 'foundation-to-tableau',
      foundation: 0,
      column: 1,
    });
    expect(moveBetween(state, foundation, { kind: 'foundation', index: 1 })).toBeNull();
    expect(moveBetween(state, waste, { kind: 'stock' })).toBeNull();
  });

  it('only returns legal moves from legalMoveBetween', () => {
    const run = { pile: { kind: 'tableau', index: 0 }, cardIndex: 1 } as const;
    expect(legalMoveBetween(state, run, { kind: 'tableau', index: 1 })).toBeNull();
    expect(legalMoveBetween(state, run, { kind: 'tableau', index: 2 })).toBeNull();
  });

  it('finds a foundation for a card', () => {
    expect(foundationMoveFor(state, { pile: { kind: 'waste' }, cardIndex: 1 })).toEqual({
      type: 'waste-to-foundation',
      foundation: 1,
    });
    expect(
      foundationMoveFor(state, { pile: { kind: 'tableau', index: 1 }, cardIndex: 0 }),
    ).toBeNull();
  });
});

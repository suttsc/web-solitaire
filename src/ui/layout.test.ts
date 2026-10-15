import { describe, expect, it } from 'vitest';
import { deal } from '../engine';
import { cards, makeState } from '../engine/test-helpers';
import { cardKey, computeLayout, dropTarget, pileAtPoint } from './layout';

describe('computeLayout', () => {
  it('places all 52 cards and every slot', () => {
    const layout = computeLayout(deal(1, 3), 360, 640);
    expect(layout.cards.size).toBe(52);
    expect(layout.slots).toHaveLength(4 + 1 + 1 + 7);
  });

  it('fits seven columns in a 360px portrait phone', () => {
    const layout = computeLayout(deal(1, 3), 360, 640);
    const rightEdge = Math.max(...layout.slots.map((s) => s.rect.x + s.rect.w));
    expect(rightEdge).toBeLessThanOrEqual(360);
    expect(layout.cardW).toBeGreaterThan(40);
  });

  it('caps card size by height on wide screens', () => {
    const layout = computeLayout(deal(1, 3), 2000, 800);
    expect(layout.cardH * 4.2).toBeLessThanOrEqual(800.0001);
  });

  it('fans the top three waste cards in draw 3', () => {
    const state = makeState({ waste: cards('AH 2H 3H 4H 5H') });
    const layout = computeLayout(state, 360, 640);
    const xs = ['H1', 'H2', 'H3', 'H4', 'H5'].map((k) => layout.cards.get(k)?.x ?? NaN);
    expect(xs[0]).toBe(xs[1]);
    expect(xs[1]).toBe(xs[2]);
    expect(xs[3]).toBeGreaterThan(xs[2] ?? 0);
    expect(xs[4]).toBeGreaterThan(xs[3] ?? 0);
  });

  it('does not fan the waste in draw 1', () => {
    const state = makeState({ drawMode: 1, waste: cards('AH 2H') });
    const layout = computeLayout(state, 360, 640);
    expect(layout.cards.get('H1')?.x).toBe(layout.cards.get('H2')?.x);
  });

  it('keeps long columns inside the board', () => {
    const column = cards('~KS ~QS ~JS ~10S ~9S ~8S KH QC JD 10C 9D 8C 7D 6C 5D 4C 3D 2C');
    const state = makeState({ tableau: [column, [], [], [], [], [], []] });
    const layout = computeLayout(state, 360, 560);
    const bottom = layout.cards.get('C2');
    expect(bottom && bottom.y + layout.cardH).toBeLessThanOrEqual(560);
  });

  it('builds card keys', () => {
    expect(cardKey({ suit: 'H', rank: 12 })).toBe('H12');
  });
});

describe('hit testing', () => {
  const layout = computeLayout(deal(1, 3), 360, 640);
  const slot = (kind: string, index?: number) =>
    layout.slots.find(
      (s) =>
        s.pile.kind === kind &&
        (index === undefined || ('index' in s.pile && s.pile.index === index)),
    )?.rect;

  it('finds the pile under a point', () => {
    const stock = slot('stock');
    expect(stock && pileAtPoint(layout, stock.x + 2, stock.y + 2)).toEqual({ kind: 'stock' });
    expect(pileAtPoint(layout, -10, -10)).toBeNull();
  });

  it('finds the drop target a dragged card overlaps most', () => {
    const column = slot('tableau', 4);
    expect(column && dropTarget(layout, column.x + 5, column.y + 40)).toEqual({
      kind: 'tableau',
      index: 4,
    });
    const foundation = slot('foundation', 1);
    expect(foundation && dropTarget(layout, foundation.x - 5, foundation.y)).toEqual({
      kind: 'foundation',
      index: 1,
    });
    expect(dropTarget(layout, -500, -500)).toBeNull();
  });
});

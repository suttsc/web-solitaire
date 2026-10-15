import { TABLEAU_COUNT, type Card, type GameState, type PileRef } from '../engine';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CardPlacement {
  readonly card: Card;
  readonly pile: PileRef;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Slot {
  readonly pile: PileRef;
  readonly rect: Rect;
}

export interface Layout {
  readonly cardW: number;
  readonly cardH: number;
  readonly slots: readonly Slot[];
  readonly cards: ReadonlyMap<string, CardPlacement>;
}

/** Card art is 240 × 336 (5:7). */
export const CARD_RATIO = 336 / 240;

/** How many waste cards are fanned out in draw 3. */
const WASTE_FAN = 3;

export const cardKey = (card: Pick<Card, 'suit' | 'rank'>): string =>
  `${card.suit}${String(card.rank)}`;

/**
 * Work out where every card and empty-pile slot goes for a board of `width` × `height` pixels.
 * Top row: foundations on the left, waste (fanned for draw 3) then stock on the right.
 * Columns fan downwards and squeeze their face-up spacing to fit the height.
 */
export function computeLayout(state: GameState, width: number, height: number): Layout {
  const gap = Math.max(4, Math.round(width * 0.012));
  const cardW = Math.max(
    20,
    Math.min((width - gap * (TABLEAU_COUNT + 1)) / TABLEAU_COUNT, height / (CARD_RATIO * 4.2)),
  );
  const cardH = cardW * CARD_RATIO;
  const left = (width - (cardW * TABLEAU_COUNT + gap * (TABLEAU_COUNT - 1))) / 2;
  const columnX = (column: number): number => left + column * (cardW + gap);
  const topY = gap;
  const tableauY = topY + cardH + gap * 2;

  const rect = (x: number, y: number): Rect => ({ x, y, w: cardW, h: cardH });
  const slots: Slot[] = [];
  const cards = new Map<string, CardPlacement>();
  const place = (card: Card, pile: PileRef, index: number, x: number, y: number, z: number) => {
    cards.set(cardKey(card), { card, pile, index, x, y, z });
  };

  state.foundations.forEach((pile, index) => {
    const ref = { kind: 'foundation', index } as const;
    const { x, y } = rect(columnX(index), topY);
    slots.push({ pile: ref, rect: rect(x, y) });
    pile.forEach((card, i) => {
      place(card, ref, i, x, y, 200 + i);
    });
  });

  const stockX = columnX(TABLEAU_COUNT - 1);
  slots.push({ pile: { kind: 'stock' }, rect: rect(stockX, topY) });
  state.stock.forEach((card, i) => {
    place(card, { kind: 'stock' }, i, stockX, topY, i);
  });

  const wasteX = columnX(TABLEAU_COUNT - 3);
  const fanStep = cardW * 0.3;
  slots.push({ pile: { kind: 'waste' }, rect: rect(wasteX, topY) });
  const fanned = state.drawMode === 3 ? WASTE_FAN : 1;
  const fanStart = Math.max(0, state.waste.length - fanned);
  state.waste.forEach((card, i) => {
    const offset = Math.max(0, i - fanStart);
    place(card, { kind: 'waste' }, i, wasteX + offset * fanStep, topY, 100 + i);
  });

  const available = height - tableauY - cardH - gap;
  state.tableau.forEach((pile, index) => {
    const ref = { kind: 'tableau', index } as const;
    const x = columnX(index);
    slots.push({ pile: ref, rect: { x, y: tableauY, w: cardW, h: height - tableauY } });

    const faceDown = pile.filter((card) => !card.faceUp).length;
    const faceUpGaps = Math.max(0, pile.length - faceDown - 1);
    const downStep = cardH * 0.1;
    const idealUpStep = cardH * 0.27;
    const upStep =
      faceUpGaps === 0
        ? idealUpStep
        : Math.max(
            cardH * 0.12,
            Math.min(idealUpStep, (available - faceDown * downStep) / faceUpGaps),
          );

    let y = tableauY;
    pile.forEach((card, i) => {
      place(card, ref, i, x, y, 300 + i);
      y += card.faceUp ? upStep : downStep;
    });
  });

  return { cardW, cardH, slots, cards };
}

const contains = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** The pile whose slot contains the point, or null. */
export function pileAtPoint(layout: Layout, x: number, y: number): PileRef | null {
  return layout.slots.find((slot) => contains(slot.rect, x, y))?.pile ?? null;
}

/**
 * The drop target for a card being dragged with its top-left at (x, y):
 * the slot it overlaps most, if it overlaps any by at least a quarter of a card.
 */
export function dropTarget(layout: Layout, x: number, y: number): PileRef | null {
  let best: PileRef | null = null;
  let bestArea = (layout.cardW * layout.cardH) / 4;

  for (const slot of layout.slots) {
    if (slot.pile.kind === 'stock' || slot.pile.kind === 'waste') continue;
    const overlapW =
      Math.min(x + layout.cardW, slot.rect.x + slot.rect.w) - Math.max(x, slot.rect.x);
    const overlapH =
      Math.min(y + layout.cardH, slot.rect.y + slot.rect.h) - Math.max(y, slot.rect.y);
    const area = Math.max(0, overlapW) * Math.max(0, overlapH);
    if (area > bestArea) {
      bestArea = area;
      best = slot.pile;
    }
  }

  return best;
}

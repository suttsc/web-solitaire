import {
  createDeck,
  samePile,
  sourceAt,
  type Card,
  type GameState,
  type PileRef,
  type Source,
} from '../engine';
import { cardKey, computeLayout, dropTarget, type Layout } from './layout';

export interface BoardHandlers {
  tapStock(): void;
  tapCard(pile: PileRef, cardIndex: number): void;
  tapSlot(pile: PileRef): void;
  doubleTapCard(pile: PileRef, cardIndex: number): void;
  drop(source: Source, target: PileRef | null): void;
}

export interface BoardView {
  readonly state: GameState;
  readonly selection: Source | null;
  readonly interactive: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Gesture {
  readonly pointerId: number;
  readonly start: Point;
  readonly pile: PileRef | null;
  readonly cardIndex: number | null;
  readonly key: string | null;
  readonly source: Source | null;
  dragging: boolean;
}

const DRAG_THRESHOLD = 6;
const DOUBLE_TAP_MS = 350;
const MOVE_MS = 180;

const RANK_NAMES = [
  '',
  'ace',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'jack',
  'queen',
  'king',
];
const SUIT_NAMES = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' } as const;

export const cardLabel = (card: Card): string =>
  card.faceUp ? `${RANK_NAMES[card.rank] ?? ''} of ${SUIT_NAMES[card.suit]}` : 'face-down card';

const cardImage = (card: Card): string => `url(/cards/${card.faceUp ? cardKey(card) : 'back'}.svg)`;

const translate = ({ x, y }: Point): string => `translate(${x}px, ${y}px)`;

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Preload card art so faces never flash blank on first flip. */
export function preloadCards(): void {
  for (const card of createDeck()) new Image().src = `/cards/${cardKey(card)}.svg`;
  new Image().src = '/cards/back.svg';
}

/**
 * Renders the table into `root` with one persistent element per card, so moves can be
 * animated (FLIP via the Web Animations API) and dragged with Pointer Events.
 */
export function createBoard(root: HTMLElement, handlers: BoardHandlers) {
  const cardEls = new Map<string, HTMLElement>();
  const slotEls: HTMLElement[] = [];
  const visual = new Map<string, Point>();
  const faces = new Map<string, boolean>();
  let layout: Layout | null = null;
  let view: BoardView | null = null;
  let gesture: Gesture | null = null;
  let lastTap: { key: string; time: number } | null = null;

  for (const card of createDeck()) {
    const el = document.createElement('div');
    el.dataset.key = cardKey(card);
    el.setAttribute('role', 'button');
    el.className =
      'absolute left-0 top-0 rounded-[7%] bg-white bg-[length:100%_100%] shadow-[0_1px_2px_rgb(0_0_0/0.45)] will-change-transform data-[selected]:outline-3 data-[selected]:outline-amber-300 data-[dragging]:shadow-[0_8px_18px_rgb(0_0_0/0.45)] focus-visible:outline-3 focus-visible:outline-sky-300';
    cardEls.set(cardKey(card), el);
    root.append(el);
  }

  const boardPoint = (event: PointerEvent): Point => {
    const box = root.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const elementsFor = (source: Source): { key: string; el: HTMLElement }[] => {
    if (!layout) return [];
    const result: { key: string; el: HTMLElement }[] = [];
    for (const [key, placement] of layout.cards) {
      if (samePile(placement.pile, source.pile) && placement.index >= source.cardIndex) {
        const el = cardEls.get(key);
        if (el) result.push({ key, el });
      }
    }
    return result.sort(
      (a, b) => (layout?.cards.get(a.key)?.index ?? 0) - (layout?.cards.get(b.key)?.index ?? 0),
    );
  };

  function renderSlots(current: Layout): void {
    current.slots.forEach((slot, i) => {
      let el = slotEls[i];
      if (!el) {
        el = document.createElement('div');
        el.className =
          'absolute left-0 top-0 grid place-items-center rounded-[7%] border-2 border-white/20 text-2xl font-semibold text-white/25';
        slotEls[i] = el;
        root.prepend(el);
      }
      el.dataset.slot = JSON.stringify(slot.pile);
      el.style.width = `${current.cardW}px`;
      el.style.height = `${current.cardH}px`;
      el.style.transform = translate(slot.rect);
      el.textContent =
        slot.pile.kind === 'foundation' ? 'A' : slot.pile.kind === 'stock' ? '↻' : '';
      el.setAttribute(
        'aria-label',
        slot.pile.kind === 'stock'
          ? 'Stock (empty): tap to turn the waste over'
          : `${slot.pile.kind} slot`,
      );
    });
  }

  function animateCard(el: HTMLElement, from: Point, to: Point, flipped: boolean, z: number): void {
    const moved = from.x !== to.x || from.y !== to.y;
    if ((!moved && !flipped) || prefersReducedMotion()) return;

    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const frames: Keyframe[] = flipped
      ? [
          { transform: `${translate(from)} scaleX(1)` },
          { transform: `${translate(mid)} scaleX(0)`, offset: 0.5 },
          { transform: `${translate(to)} scaleX(1)` },
        ]
      : [{ transform: translate(from) }, { transform: translate(to) }];

    el.style.zIndex = String(1000 + z);
    const animation = el.animate(frames, {
      duration: flipped ? MOVE_MS * 1.4 : MOVE_MS,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
    animation.onfinish = () => {
      el.style.zIndex = String(z);
    };
  }

  function render(next: BoardView, animate = true): void {
    view = next;
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (width === 0 || height === 0) return;

    const current = computeLayout(next.state, width, height);
    layout = current;
    renderSlots(current);

    const selected = next.selection;
    for (const [key, placement] of current.cards) {
      const el = cardEls.get(key);
      if (!el) continue;
      const { card } = placement;
      const to = { x: placement.x, y: placement.y };
      const from = visual.get(key);
      const flipped = faces.has(key) && faces.get(key) !== card.faceUp;

      el.style.width = `${current.cardW}px`;
      el.style.height = `${current.cardH}px`;
      el.style.backgroundImage = cardImage(card);
      el.style.transform = translate(to);
      el.style.zIndex = String(placement.z);
      el.setAttribute('aria-label', cardLabel(card));
      el.tabIndex = card.faceUp || placement.pile.kind === 'stock' ? 0 : -1;
      delete el.dataset.dragging;
      el.toggleAttribute(
        'data-selected',
        selected !== null &&
          samePile(selected.pile, placement.pile) &&
          placement.index >= selected.cardIndex,
      );

      if (animate && from) animateCard(el, from, to, flipped, placement.z);
      visual.set(key, to);
      faces.set(key, card.faceUp);
    }
  }

  const rerender = () => {
    if (view) render(view, true);
  };

  function locate(target: EventTarget | null): Pick<Gesture, 'pile' | 'cardIndex' | 'key'> {
    const element = target instanceof Element ? target : null;
    const key = element?.closest<HTMLElement>('[data-key]')?.dataset.key ?? null;
    const placement = key ? layout?.cards.get(key) : undefined;
    if (key && placement) return { pile: placement.pile, cardIndex: placement.index, key };
    const slot = element?.closest<HTMLElement>('[data-slot]')?.dataset.slot;
    return { pile: slot ? (JSON.parse(slot) as PileRef) : null, cardIndex: null, key: null };
  }

  function tap(hit: Pick<Gesture, 'pile' | 'cardIndex' | 'key'>): void {
    if (!hit.pile) return;
    if (hit.pile.kind === 'stock') {
      handlers.tapStock();
      return;
    }
    if (hit.key === null || hit.cardIndex === null) {
      handlers.tapSlot(hit.pile);
      return;
    }

    const time = performance.now();
    if (lastTap?.key === hit.key && time - lastTap.time < DOUBLE_TAP_MS) {
      lastTap = null;
      handlers.doubleTapCard(hit.pile, hit.cardIndex);
      return;
    }
    lastTap = { key: hit.key, time };
    handlers.tapCard(hit.pile, hit.cardIndex);
  }

  root.addEventListener('pointerdown', (event) => {
    if (!view?.interactive || gesture || !event.isPrimary) return;
    const hit = locate(event.target);
    const source =
      hit.pile && hit.cardIndex !== null ? sourceAt(view.state, hit.pile, hit.cardIndex) : null;
    gesture = {
      pointerId: event.pointerId,
      start: boardPoint(event),
      ...hit,
      source,
      dragging: false,
    };
    root.setPointerCapture(event.pointerId);
  });

  root.addEventListener('pointermove', (event) => {
    if (gesture?.pointerId !== event.pointerId || !gesture.source) return;
    const point = boardPoint(event);
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    if (!gesture.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    gesture.dragging = true;

    elementsFor(gesture.source).forEach(({ key, el }, i) => {
      const placement = layout?.cards.get(key);
      if (!placement) return;
      const position = { x: placement.x + dx, y: placement.y + dy };
      el.dataset.dragging = '';
      el.style.zIndex = String(2000 + i);
      el.style.transform = translate(position);
      visual.set(key, position);
    });
  });

  const finish = (event: PointerEvent, cancelled: boolean) => {
    const current = gesture;
    if (current?.pointerId !== event.pointerId) return;
    gesture = null;
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);

    if (current.dragging && current.source) {
      const lead = current.key ? visual.get(current.key) : undefined;
      const target = !cancelled && lead && layout ? dropTarget(layout, lead.x, lead.y) : null;
      handlers.drop(current.source, target);
      rerender();
      return;
    }
    if (!cancelled) tap(current);
  };

  root.addEventListener('pointerup', (event) => {
    finish(event, false);
  });
  root.addEventListener('pointercancel', (event) => {
    finish(event, true);
  });

  root.addEventListener('keydown', (event) => {
    if (!view?.interactive || (event.key !== 'Enter' && event.key !== ' ')) return;
    const hit = locate(event.target);
    if (!hit.pile) return;
    event.preventDefault();
    tap(hit);
  });

  new ResizeObserver(() => {
    if (view) render(view, false);
  }).observe(root);

  return { render };
}

export type Board = ReturnType<typeof createBoard>;

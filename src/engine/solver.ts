import { tryMove } from './apply';
import { deal } from './deck';
import {
  canPlaceOnFoundation,
  canStackOnTableau,
  isMovableRun,
  isRed,
  isWon,
  topCard,
} from './rules';
import type { Card, DrawMode, GameState, Move, ScoringMode } from './types';

export type SolveResult =
  | { readonly status: 'solved'; readonly moves: readonly Move[]; readonly nodes: number }
  | { readonly status: 'unknown'; readonly nodes: number };

export interface SolveOptions {
  /** Give up after visiting this many positions. */
  readonly maxNodes?: number;
}

const key = (card: Card): string => `${card.suit}${String(card.rank)}${card.faceUp ? '' : '~'}`;

/** Position fingerprint for the visited set. Column order doesn't matter, and nor do score or moves. */
function hash(state: GameState): string {
  const columns = state.tableau.map((pile) => pile.map(key).join(',')).sort();
  const foundations = state.foundations.map((pile) => {
    const top = topCard(pile);
    return top ? key(top) : '-';
  });
  // Passes only matter when they're limited (Vegas); otherwise cycling the stock returns to a seen position.
  const passes = state.scoring === 'vegas' ? String(state.passes) : '';
  return `${state.stock.map(key).join(',')}|${state.waste.map(key).join(',')}|${foundations.sort().join(',')}|${columns.join('/')}|${passes}`;
}

function foundationTops(state: GameState): Map<string, number> {
  const tops = new Map<string, number>();
  for (const pile of state.foundations) {
    const top = topCard(pile);
    if (top) tops.set(top.suit, top.rank);
  }
  return tops;
}

/** A card is safe to send home when no card that could still need it as a tableau target remains. */
function isSafeHome(card: Card, tops: Map<string, number>): boolean {
  if (card.rank <= 2) return true;
  const opposite = isRed(card) ? ['C', 'S'] : ['D', 'H'];
  return opposite.every((suit) => (tops.get(suit) ?? 0) >= card.rank - 1);
}

function foundationMoveFor(state: GameState, card: Card): number {
  return state.foundations.findIndex((pile) => canPlaceOnFoundation(card, pile));
}

/** Candidate moves, best first. Pointless shuffles are left out, so "no solution" can't be claimed. */
function candidates(state: GameState): Move[] {
  const tops = foundationTops(state);
  const home: Move[] = [];
  const reveal: Move[] = [];
  const other: Move[] = [];

  const wasteTop = topCard(state.waste);
  if (wasteTop) {
    const foundation = foundationMoveFor(state, wasteTop);
    if (foundation >= 0) {
      const move: Move = { type: 'waste-to-foundation', foundation };
      if (isSafeHome(wasteTop, tops)) return [move];
      home.push(move);
    }
  }

  state.tableau.forEach((pile, column) => {
    const top = topCard(pile);
    if (!top?.faceUp) return;
    const foundation = foundationMoveFor(state, top);
    if (foundation < 0) return;
    const move: Move = { type: 'tableau-to-foundation', column, foundation };
    if (isSafeHome(top, tops)) home.unshift(move);
    else home.push(move);
  });
  if (home[0]?.type === 'tableau-to-foundation') {
    const first = home[0];
    const card = topCard(state.tableau[first.column] ?? []);
    if (card && isSafeHome(card, tops)) return [first];
  }

  state.tableau.forEach((pile, from) => {
    pile.forEach((card, index) => {
      if (!isMovableRun(pile, index)) return;
      const below = pile[index - 1];
      const opens = index === 0 || below?.faceUp === false;
      const freesHome = below?.faceUp === true && foundationMoveFor(state, below) >= 0;
      if (!opens && !freesHome) return;
      let triedEmpty = false;
      state.tableau.forEach((target, to) => {
        if (to === from || !canStackOnTableau(card, target)) return;
        if (target.length === 0) {
          if (index === 0 || triedEmpty) return; // a king already at the bottom gains nothing
          triedEmpty = true;
        }
        const move: Move = { type: 'tableau-to-tableau', from, index, to };
        if (below?.faceUp === false) reveal.push(move);
        else other.push(move);
      });
    });
  });

  if (wasteTop) {
    let triedEmpty = false;
    state.tableau.forEach((target, column) => {
      if (!canStackOnTableau(wasteTop, target)) return;
      if (target.length === 0) {
        if (triedEmpty) return;
        triedEmpty = true;
      }
      other.push({ type: 'waste-to-tableau', column });
    });
  }

  const stock: Move[] = state.stock.length > 0 ? [{ type: 'draw' }] : [{ type: 'recycle' }];
  return [...home, ...reveal, ...other, ...stock];
}

/**
 * Depth-first search for a winning line. Returns the moves when it finds one, or "unknown"
 * when it runs out of budget (which doesn't prove the deal unwinnable).
 */
export function solve(start: GameState, { maxNodes = 100_000 }: SolveOptions = {}): SolveResult {
  const visited = new Set<string>([hash(start)]);
  // Iterative DFS: each frame holds a position and the moves still to try from it.
  const stack: { state: GameState; moves: Move[]; via: Move | null }[] = [
    { state: start, moves: candidates(start), via: null },
  ];
  let nodes = 1;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (!frame) break;
    if (isWon(frame.state.foundations)) {
      const moves = stack.flatMap((f) => (f.via ? [f.via] : []));
      return { status: 'solved', moves, nodes };
    }

    const move = frame.moves.shift();
    if (!move) {
      stack.pop();
      continue;
    }
    const next = tryMove(frame.state, move);
    if (!next) continue;
    const id = hash(next);
    if (visited.has(id)) continue;
    if (nodes >= maxNodes) return { status: 'unknown', nodes };
    visited.add(id);
    nodes++;
    stack.push({ state: next, moves: candidates(next), via: move });
  }

  return { status: 'unknown', nodes };
}

/** Try seeds from `nextSeed` until one is proven winnable, within an overall node budget. */
export function findWinnableSeed(
  drawMode: DrawMode,
  scoring: ScoringMode,
  nextSeed: () => number,
  { perDeal = 40_000, budget = 400_000 } = {},
): number | null {
  let spent = 0;
  while (spent < budget) {
    const seed = nextSeed();
    const result = solve(deal(seed, drawMode, scoring), { maxNodes: perDeal });
    spent += result.nodes;
    if (result.status === 'solved') return seed;
  }
  return null;
}

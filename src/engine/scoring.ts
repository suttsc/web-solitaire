import type { DrawMode, MoveType } from './types';

/** Windows-style standard scoring. Every value lives here so it can be tuned in one place. */
export const SCORING = {
  wasteToTableau: 5,
  wasteToFoundation: 10,
  tableauToFoundation: 10,
  turnOverTableauCard: 5,
  foundationToTableau: -15,
  recycle: { 1: -100, 3: -20 } satisfies Record<DrawMode, number>,
  timePenaltyPoints: 2,
  timePenaltyEverySeconds: 10,
  winBonusNumerator: 700_000,
  winBonusMinSeconds: 30,
} as const;

export function movePoints(type: MoveType, drawMode: DrawMode): number {
  switch (type) {
    case 'waste-to-tableau':
      return SCORING.wasteToTableau;
    case 'waste-to-foundation':
      return SCORING.wasteToFoundation;
    case 'tableau-to-foundation':
      return SCORING.tableauToFoundation;
    case 'foundation-to-tableau':
      return SCORING.foundationToTableau;
    case 'recycle':
      return SCORING.recycle[drawMode];
    case 'draw':
    case 'tableau-to-tableau':
      return 0;
  }
}

export function timePenalty(elapsedMs: number): number {
  const seconds = Math.floor(elapsedMs / 1000);
  return Math.floor(seconds / SCORING.timePenaltyEverySeconds) * SCORING.timePenaltyPoints;
}

export function winBonus(elapsedMs: number): number {
  const seconds = Math.floor(elapsedMs / 1000);
  return seconds > SCORING.winBonusMinSeconds ? Math.floor(SCORING.winBonusNumerator / seconds) : 0;
}

/** Score shown to the player: move points minus the time penalty, floored at zero, plus any win bonus. */
export function displayScore(movePointsTotal: number, elapsedMs: number, won: boolean): number {
  const base = Math.max(0, movePointsTotal - timePenalty(elapsedMs));
  return won ? base + winBonus(elapsedMs) : base;
}

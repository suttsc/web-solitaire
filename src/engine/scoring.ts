import type { DrawMode, GameState, MoveType, ScoringMode } from './types';

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

/** Vegas: pay 52 to play, earn 5 per card on a foundation, limited passes through the stock. */
export const VEGAS = {
  ante: -52,
  toFoundation: 5,
  fromFoundation: -5,
  /** Total passes through the stock allowed, including the first. */
  passes: { 1: 1, 3: 3 } satisfies Record<DrawMode, number>,
} as const;

function standardPoints(type: MoveType, drawMode: DrawMode): number {
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

function vegasPoints(type: MoveType): number {
  switch (type) {
    case 'waste-to-foundation':
    case 'tableau-to-foundation':
      return VEGAS.toFoundation;
    case 'foundation-to-tableau':
      return VEGAS.fromFoundation;
    case 'waste-to-tableau':
    case 'recycle':
    case 'draw':
    case 'tableau-to-tableau':
      return 0;
  }
}

export function movePoints(
  type: MoveType,
  drawMode: DrawMode,
  scoring: ScoringMode = 'standard',
): number {
  return scoring === 'vegas' ? vegasPoints(type) : standardPoints(type, drawMode);
}

/** Points for turning over a face-down tableau card. */
export const flipPoints = (scoring: ScoringMode): number =>
  scoring === 'vegas' ? 0 : SCORING.turnOverTableauCard;

/** Can the waste be turned over again under this scoring mode? */
export const canRecycle = (state: GameState): boolean =>
  state.scoring !== 'vegas' || state.passes + 1 < VEGAS.passes[state.drawMode];

export function timePenalty(elapsedMs: number): number {
  const seconds = Math.floor(elapsedMs / 1000);
  return Math.floor(seconds / SCORING.timePenaltyEverySeconds) * SCORING.timePenaltyPoints;
}

export function winBonus(elapsedMs: number): number {
  const seconds = Math.floor(elapsedMs / 1000);
  return seconds > SCORING.winBonusMinSeconds ? Math.floor(SCORING.winBonusNumerator / seconds) : 0;
}

/**
 * Score shown to the player. Standard: move points minus the time penalty, floored at zero,
 * plus any win bonus. Vegas: just the running total; time doesn't count.
 */
export function displayScore(
  movePointsTotal: number,
  elapsedMs: number,
  won: boolean,
  scoring: ScoringMode = 'standard',
): number {
  if (scoring === 'vegas') return movePointsTotal;
  const base = Math.max(0, movePointsTotal - timePenalty(elapsedMs));
  return won ? base + winBonus(elapsedMs) : base;
}

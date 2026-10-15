import type { DrawModeValue, GameRecord } from './schema';

export interface PlayerStats {
  readonly played: number;
  readonly won: number;
  readonly winRate: number;
  readonly bestTimeMs: number | null;
  readonly fewestMoves: number | null;
  readonly bestScore: number | null;
  readonly currentStreak: number;
  readonly longestStreak: number;
}

const minOf = (values: number[]): number | null => (values.length ? Math.min(...values) : null);
const maxOf = (values: number[]): number | null => (values.length ? Math.max(...values) : null);

/**
 * Stats for one draw mode, derived from game records rather than stored, so they can't drift.
 * Bests come from won games only; best score only compares games using the same scoring mode.
 */
export function computeStats(
  games: readonly GameRecord[],
  drawMode: DrawModeValue,
  scoringMode: GameRecord['scoringMode'] = 'standard',
): PlayerStats {
  const mine = games
    .filter((game) => game.drawMode === drawMode)
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  const wins = mine.filter((game) => game.result === 'won');

  let currentStreak = 0;
  let longestStreak = 0;
  for (const game of mine) {
    currentStreak = game.result === 'won' ? currentStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return {
    played: mine.length,
    won: wins.length,
    winRate: mine.length ? wins.length / mine.length : 0,
    bestTimeMs: minOf(wins.map((game) => game.durationMs)),
    fewestMoves: minOf(wins.map((game) => game.moves)),
    bestScore: maxOf(
      wins.filter((game) => game.scoringMode === scoringMode).map((game) => game.score),
    ),
    currentStreak,
    longestStreak,
  };
}

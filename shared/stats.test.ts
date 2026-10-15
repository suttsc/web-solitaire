import { describe, expect, it } from 'vitest';
import type { GameRecord } from './schema';
import { computeStats } from './stats';

let n = 0;
const game = (overrides: Partial<GameRecord>): GameRecord => {
  n += 1;
  return {
    id: crypto.randomUUID(),
    seed: n,
    drawMode: 3,
    scoringMode: 'standard',
    startedAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 0, 1, 0, n, 30)).toISOString(),
    durationMs: 100_000,
    moves: 120,
    undos: 0,
    score: 4000,
    result: 'won',
    appVersion: 'test',
    ...overrides,
  };
};

describe('computeStats', () => {
  it('returns empty stats with no games', () => {
    expect(computeStats([], 3)).toEqual({
      played: 0,
      won: 0,
      winRate: 0,
      bestTimeMs: null,
      fewestMoves: null,
      bestScore: null,
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('derives bests from won games only', () => {
    const games = [
      game({ durationMs: 90_000, moves: 140, score: 5000 }),
      game({ durationMs: 120_000, moves: 100, score: 4500 }),
      game({ result: 'abandoned', durationMs: 5_000, moves: 3, score: 9000 }),
    ];
    expect(computeStats(games, 3)).toMatchObject({
      played: 3,
      won: 2,
      bestTimeMs: 90_000,
      fewestMoves: 100,
      bestScore: 5000,
    });
    expect(computeStats(games, 3).winRate).toBeCloseTo(2 / 3);
  });

  it('keeps draw modes separate', () => {
    const games = [game({ drawMode: 1, durationMs: 1_000 }), game({ drawMode: 3 })];
    expect(computeStats(games, 3).bestTimeMs).toBe(100_000);
    expect(computeStats(games, 1).played).toBe(1);
  });

  it('only compares scores within a scoring mode', () => {
    const games = [game({ scoringMode: 'vegas', score: 99_999 }), game({ score: 10 })];
    expect(computeStats(games, 3).bestScore).toBe(10);
    expect(computeStats(games, 3, 'vegas').bestScore).toBe(99_999);
  });

  it('tracks current and longest win streaks in time order', () => {
    const games = [
      game({}),
      game({}),
      game({}),
      game({ result: 'stuck' }),
      game({}),
      game({ result: 'abandoned' }),
      game({}),
      game({}),
    ].reverse();
    expect(computeStats(games, 3)).toMatchObject({ currentStreak: 2, longestStreak: 3 });
  });
});

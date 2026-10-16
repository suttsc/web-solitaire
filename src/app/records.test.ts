import { describe, expect, it } from 'vitest';
import type { PlayerStats } from '../../shared/stats';
import { compareWin } from './records';

const stats = (overrides: Partial<PlayerStats> = {}): PlayerStats => ({
  played: 5,
  won: 3,
  winRate: 0.6,
  bestTimeMs: 150_000,
  fewestMoves: 120,
  bestScore: 4000,
  currentStreak: 1,
  longestStreak: 2,
  ...overrides,
});

const records = {
  drawMode: 3 as const,
  time: { name: 'Alice', value: 90_000 },
  moves: { name: 'Bob', value: 100 },
  score: { name: 'Bob', value: 6000 },
};

const game = { durationMs: 120_000, moves: 130, score: 4500, scoringMode: 'standard' as const };

describe('compareWin', () => {
  it('flags personal bests in the right direction for each metric', () => {
    const [time, moves, score] = compareWin(game, stats(), records);
    expect(time).toMatchObject({ personal: 150_000, newPersonalBest: true, newRecord: false });
    expect(moves).toMatchObject({ personal: 120, newPersonalBest: false });
    expect(score).toMatchObject({ personal: 4000, newPersonalBest: true, newRecord: false });
  });

  it('flags a new global record', () => {
    const [time] = compareWin({ ...game, durationMs: 80_000 }, stats(), records);
    expect(time).toMatchObject({ newRecord: true, global: { name: 'Alice', value: 90_000 } });
  });

  it('treats a first win as a personal best and an empty board as a record', () => {
    const empty = { drawMode: 3 as const, time: null, moves: null, score: null };
    const rows = compareWin(
      game,
      stats({ bestTimeMs: null, fewestMoves: null, bestScore: null }),
      empty,
    );
    expect(rows.every((row) => row.newPersonalBest && row.newRecord)).toBe(true);
  });

  it('claims no record while records are unknown (loading or offline)', () => {
    expect(compareWin(game, stats(), null).some((row) => row.newRecord)).toBe(false);
  });

  it('does not compare Vegas scores with the standard-only global record', () => {
    const score = compareWin({ ...game, scoringMode: 'vegas', score: 99_999 }, stats(), records)[2];
    expect(score).toMatchObject({ global: null, newRecord: false });
  });
});

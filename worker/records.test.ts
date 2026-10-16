import { beforeEach, describe, expect, it } from 'vitest';
import type { GameRecord } from '../shared/schema';
import app from './index';
import { createTestD1 } from './test/d1';

let env: { DB: D1Database };

const post = (path: string, body: unknown) =>
  app.request(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );

let n = 0;
const game = (overrides: Partial<GameRecord> = {}): GameRecord => {
  n += 1;
  return {
    id: crypto.randomUUID(),
    seed: n,
    drawMode: 3,
    scoringMode: 'standard',
    startedAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 0, 1, 0, n, 50)).toISOString(),
    durationMs: 120_000,
    moves: 130,
    undos: 0,
    score: 5000,
    result: 'won',
    appVersion: 'test',
    ...overrides,
  };
};

async function seed(name: string, games: GameRecord[]) {
  const res = await post('/api/players', { name });
  const { player } = await res.json<{ player: { id: string } }>();
  await post('/api/games', { playerId: player.id, games });
}

const records = async (query: string) =>
  (await app.request(`/api/records?${query}`, {}, env)).json<Record<string, unknown>>();

describe('GET /api/records', () => {
  const fastest = game({ durationMs: 60_000, moves: 140, score: 4000 });

  beforeEach(async () => {
    env = { DB: createTestD1() };
    await seed('Alice', [fastest, game({ durationMs: 200_000, moves: 90, score: 3000 })]);
    await seed('Bob', [
      game({ durationMs: 90_000, moves: 110, score: 7000 }),
      game({ scoringMode: 'vegas', score: 99_000 }),
      game({ result: 'stuck', durationMs: 1_000, moves: 2 }),
    ]);
  });

  it('returns the best win for each metric, standard scoring only', async () => {
    expect(await records('draw=3')).toEqual({
      drawMode: 3,
      time: { name: 'Alice', value: 60_000 },
      moves: { name: 'Alice', value: 90 },
      score: { name: 'Bob', value: 7000 },
    });
  });

  it('can leave out the game just finished', async () => {
    expect((await records(`draw=3&exclude=${fastest.id}`)).time).toEqual({
      name: 'Bob',
      value: 90_000,
    });
  });

  it('returns nulls when nobody has won yet', async () => {
    expect(await records('draw=1')).toEqual({ drawMode: 1, time: null, moves: null, score: null });
  });

  it('rejects a bad exclude id', async () => {
    expect((await app.request('/api/records?exclude=nope', {}, env)).status).toBe(400);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRecord } from '../shared/schema';
import app from './index';
import { createTestD1 } from './test/d1';

let env: { DB: D1Database };

beforeEach(() => {
  env = { DB: createTestD1() };
});

const request = (path: string, init?: RequestInit) => app.request(path, init, env);

const post = (path: string, body: unknown) =>
  request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const json = async <T>(response: Response): Promise<T> => await response.json();

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
    undos: 1,
    score: 5000,
    result: 'won',
    appVersion: 'test',
    ...overrides,
  };
};

async function createPlayer(name: string): Promise<string> {
  const body = await json<{ player: { id: string } }>(await post('/api/players', { name }));
  return body.player.id;
}

describe('health', () => {
  it('reports healthy', async () => {
    const res = await request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('POST /api/players', () => {
  it('creates a player, then links to it case-insensitively', async () => {
    const created = await post('/api/players', { name: 'Chris' });
    expect(created.status).toBe(201);
    const first = await json<{ player: { id: string; name: string }; created: boolean }>(created);
    expect(first).toMatchObject({ created: true, player: { name: 'Chris' } });

    const linked = await post('/api/players', { name: '  chris ' });
    expect(linked.status).toBe(200);
    expect(await json(linked)).toEqual({ created: false, player: first.player });
  });

  it('rejects invalid names', async () => {
    expect((await post('/api/players', { name: 'x' })).status).toBe(400);
    expect((await post('/api/players', { name: '<script>' })).status).toBe(400);
    expect((await post('/api/players', {})).status).toBe(400);
  });
});

describe('POST /api/games', () => {
  it('stores games and is idempotent on retry', async () => {
    const playerId = await createPlayer('Chris');
    const games = [game(), game({ result: 'abandoned' })];

    const first = await post('/api/games', { playerId, games });
    expect(first.status).toBe(200);
    expect((await json<{ stored: string[] }>(first)).stored.sort()).toEqual(
      games.map((g) => g.id).sort(),
    );

    const retry = await post('/api/games', { playerId, games });
    expect((await json<{ stored: string[] }>(retry)).stored).toHaveLength(2);

    const history = await json<{ games: GameRecord[] }>(await request('/api/players/chris/games'));
    expect(history.games).toHaveLength(2);
    expect(history.games[0]).toEqual(games[0]);
  });

  it("doesn't let one player claim another player's game id", async () => {
    const alice = await createPlayer('Alice');
    const bob = await createPlayer('Bob');
    const shared = game();
    await post('/api/games', { playerId: alice, games: [shared] });
    const res = await post('/api/games', { playerId: bob, games: [shared] });
    expect((await json<{ stored: string[] }>(res)).stored).toEqual([]);
  });

  it('rejects unknown players and invalid games', async () => {
    expect(
      (await post('/api/games', { playerId: crypto.randomUUID(), games: [game()] })).status,
    ).toBe(404);
    const playerId = await createPlayer('Chris');
    expect(
      (await post('/api/games', { playerId, games: [{ ...game(), drawMode: 2 }] })).status,
    ).toBe(400);
    expect((await post('/api/games', { playerId, games: [] })).status).toBe(400);
  });
});

describe('stats and leaderboards', () => {
  beforeEach(async () => {
    const alice = await createPlayer('Alice');
    const bob = await createPlayer('Bob');
    await post('/api/games', {
      playerId: alice,
      games: [
        game({ durationMs: 90_000, moves: 150, score: 6000 }),
        game({ durationMs: 200_000, moves: 95, score: 3000 }),
        game({ result: 'stuck', durationMs: 1_000, moves: 5 }),
        game({ drawMode: 1, durationMs: 10_000 }),
      ],
    });
    await post('/api/games', {
      playerId: bob,
      games: [
        game({ durationMs: 100_000, moves: 120, score: 7000 }),
        game({ scoringMode: 'vegas', score: 99_000 }),
      ],
    });
  });

  it('ranks best time, each player once, wins only', async () => {
    const body = await json<{ entries: { name: string; value: number }[] }>(
      await request('/api/leaderboard?draw=3&by=time'),
    );
    expect(body.entries.map((e) => [e.name, e.value])).toEqual([
      ['Alice', 90_000],
      ['Bob', 100_000],
    ]);
  });

  it('ranks fewest moves and best standard score', async () => {
    const moves = await json<{ entries: { name: string; value: number }[] }>(
      await request('/api/leaderboard?draw=3&by=moves'),
    );
    expect(moves.entries.map((e) => [e.name, e.value])).toEqual([
      ['Alice', 95],
      ['Bob', 120],
    ]);

    const score = await json<{ entries: { name: string; value: number }[] }>(
      await request('/api/leaderboard?by=score'),
    );
    expect(score.entries.map((e) => [e.name, e.value])).toEqual([
      ['Bob', 7000],
      ['Alice', 6000],
    ]);
  });

  it('keeps draw modes separate', async () => {
    const body = await json<{ entries: { name: string }[] }>(
      await request('/api/leaderboard?draw=1'),
    );
    expect(body.entries.map((e) => e.name)).toEqual(['Alice']);
  });

  it('rejects a bad draw mode or metric', async () => {
    expect((await request('/api/leaderboard?draw=2')).status).toBe(400);
    expect((await request('/api/leaderboard?by=luck')).status).toBe(400);
  });

  it('summarises global stats per draw mode', async () => {
    expect(await json(await request('/api/stats/global?draw=3'))).toEqual({
      drawMode: 3,
      players: 2,
      played: 5,
      won: 4,
      bestTimeMs: 90_000,
      averageWinMs: Math.trunc((90_000 + 200_000 + 100_000 + 120_000) / 4),
    });
  });

  it('returns a player’s stats by name', async () => {
    const body = await json<{ stats: { played: number; won: number; fewestMoves: number } }>(
      await request('/api/players/ALICE/stats?draw=3'),
    );
    expect(body.stats).toMatchObject({ played: 3, won: 2, fewestMoves: 95 });
    expect((await request('/api/players/nobody/stats')).status).toBe(404);
    expect((await request('/api/players/nobody/games')).status).toBe(404);
  });
});

describe('errors', () => {
  it('logs the underlying database message and hides it from the client', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = {
      DB: {
        prepare: () => {
          throw new Error('D1_ERROR: no such table: players: SQLITE_ERROR');
        },
      } as unknown as D1Database,
    };
    const res = await app.request(
      '/api/players',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Chris"}' },
      broken,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal error' });
    expect(spy).toHaveBeenCalledWith(
      'POST /api/players failed: D1_ERROR: no such table: players: SQLITE_ERROR',
      '',
    );
    spy.mockRestore();
  });
});

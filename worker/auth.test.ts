import { beforeEach, describe, expect, it } from 'vitest';
import type { GameRecord } from '../shared/schema';
import { bearerToken, hashPassword, verifyPassword } from './auth';
import app from './index';
import { createTestD1 } from './test/d1';

let env: { DB: D1Database };

beforeEach(() => {
  env = { DB: createTestD1() };
});

const post = (path: string, body: unknown, token?: string) =>
  app.request(
    path,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
    env,
  );

const json = async <T>(response: Response): Promise<T> => await response.json();

const game = (): GameRecord => ({
  id: crypto.randomUUID(),
  seed: 1,
  drawMode: 3,
  scoringMode: 'standard',
  startedAt: '2026-01-01T00:00:00.000Z',
  endedAt: '2026-01-01T00:02:00.000Z',
  durationMs: 120_000,
  moves: 100,
  undos: 0,
  score: 5000,
  result: 'won',
  appVersion: 'test',
});

async function linkedPlayer(name = 'Chris'): Promise<string> {
  return (await json<{ player: { id: string } }>(await post('/api/players', { name }))).player.id;
}

describe('password hashing', () => {
  it('verifies the right password only', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('wrong horse', stored)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('parses bearer tokens', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});

describe('claiming and logging in', () => {
  it('protects an existing player and keeps their games', async () => {
    const playerId = await linkedPlayer();
    await post('/api/games', { playerId, games: [game()] });

    const claim = await post('/api/auth/claim', { playerId, password: 'hunter22!' });
    expect(claim.status).toBe(201);
    const { token, player } = await json<{ token: string; player: { id: string } }>(claim);
    expect(player.id).toBe(playerId);

    // The name can no longer be linked without the password…
    expect((await post('/api/players', { name: 'chris' })).status).toBe(409);
    // …uploads need the token…
    expect((await post('/api/games', { playerId, games: [game()] })).status).toBe(401);
    expect((await post('/api/games', { playerId, games: [game()] }, token)).status).toBe(200);
    // …and the earlier games are still there.
    const history = await app.request('/api/players/Chris/games', {}, env);
    expect((await json<{ games: unknown[] }>(history)).games).toHaveLength(2);
  });

  it('refuses a second claim and weak passwords', async () => {
    const playerId = await linkedPlayer();
    expect((await post('/api/auth/claim', { playerId, password: 'short' })).status).toBe(400);
    await post('/api/auth/claim', { playerId, password: 'first-password' });
    expect((await post('/api/auth/claim', { playerId, password: 'second-password' })).status).toBe(
      409,
    );
    expect(
      (await post('/api/auth/claim', { playerId: crypto.randomUUID(), password: 'whatever1' }))
        .status,
    ).toBe(404);
  });

  it('logs in on another browser with the right password only', async () => {
    const playerId = await linkedPlayer();
    await post('/api/auth/claim', { playerId, password: 'hunter22!' });

    expect((await post('/api/auth/login', { name: 'CHRIS', password: 'nope' })).status).toBe(401);
    expect((await post('/api/auth/login', { name: 'Nobody', password: 'nope' })).status).toBe(401);

    const login = await post('/api/auth/login', { name: 'CHRIS', password: 'hunter22!' });
    expect(login.status).toBe(200);
    const { token, player } = await json<{ token: string; player: { id: string } }>(login);
    expect(player.id).toBe(playerId);
    expect((await post('/api/games', { playerId, games: [game()] }, token)).status).toBe(200);
  });

  it("can't log in to an unprotected name", async () => {
    await linkedPlayer();
    expect((await post('/api/auth/login', { name: 'Chris', password: 'anything' })).status).toBe(
      401,
    );
  });

  it("rejects another player's token and logged-out tokens", async () => {
    const alice = await linkedPlayer('Alice');
    const bob = await linkedPlayer('Bob');
    await post('/api/auth/claim', { playerId: alice, password: 'alice-pass' });
    const { token: bobToken } = await json<{ token: string }>(
      await post('/api/auth/claim', { playerId: bob, password: 'bob-password' }),
    );
    expect((await post('/api/games', { playerId: alice, games: [game()] }, bobToken)).status).toBe(
      401,
    );

    expect((await post('/api/auth/logout', {}, bobToken)).status).toBe(204);
    expect((await post('/api/games', { playerId: bob, games: [game()] }, bobToken)).status).toBe(
      401,
    );
  });

  it('no longer exposes player ids publicly', async () => {
    await linkedPlayer();
    const history = await json<{ player: object }>(
      await app.request('/api/players/Chris/games', {}, env),
    );
    expect(history.player).toEqual({ name: 'Chris' });
  });
});

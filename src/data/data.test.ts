import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRecord } from '../../shared/schema';
import { playMove, startSession, type Session } from '../app/session';
import { defined } from '../engine/test-helpers';
import { ApiError, createApi, type Fetch } from './api';
import { SolitaireDb } from './db';
import { createPersistence, fromSaved, toGameRecord, toSaved } from './persistence';
import { createSync } from './sync';

const T0 = Date.UTC(2026, 9, 15, 9, 0, 0);

let db: SolitaireDb;
let persistence: ReturnType<typeof createPersistence>;

beforeEach(async () => {
  db = new SolitaireDb(`test-${crypto.randomUUID()}`);
  await db.open();
  persistence = createPersistence(db);
});

const played = (): Session => {
  let session = startSession(crypto.randomUUID(), 2, 3);
  session = defined(playMove(session, { type: 'draw' }, T0));
  return defined(playMove(session, { type: 'draw' }, T0 + 5_000));
};

const record = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  ...toGameRecord(played(), 'abandoned', T0 + 30_000, 'test'),
  id: crypto.randomUUID(),
  ...overrides,
});

describe('game records', () => {
  it('captures the result, duration and counters', () => {
    const session = played();
    expect(toGameRecord(session, 'abandoned', T0 + 30_000, '1.0.0')).toEqual({
      id: session.id,
      seed: 2,
      drawMode: 3,
      scoringMode: 'standard',
      startedAt: new Date(T0).toISOString(),
      endedAt: new Date(T0 + 30_000).toISOString(),
      durationMs: 30_000,
      moves: 2,
      undos: 0,
      score: 0,
      result: 'abandoned',
      appVersion: '1.0.0',
    });
  });
});

describe('saved sessions', () => {
  it('round-trips through the action log and comes back paused', () => {
    const session = played();
    const restored = defined(fromSaved(toSaved(session, T0 + 9_000)));
    expect(restored.game).toEqual(session.game);
    expect(restored.status).toBe('paused');
    expect(restored.elapsedMs).toBe(9_000);
    expect(restored.runningSince).toBeNull();
  });

  it('does not resume won or corrupt games', () => {
    const saved = toSaved(played(), T0);
    expect(fromSaved({ ...saved, status: 'won' })).toBeNull();
    expect(fromSaved({ ...saved, log: [{ type: 'recycle' }] })).toBeNull();
  });

  it('persists the current game', async () => {
    expect(await persistence.loadSession()).toBeNull();
    const session = played();
    await persistence.saveSession(session, T0 + 1_000);
    expect((await persistence.loadSession())?.game.state).toEqual(session.game.state);
  });
});

describe('settings', () => {
  it('defaults, then saves', async () => {
    expect((await persistence.loadSettings()).drawMode).toBe(3);
    await persistence.saveSettings({ ...(await persistence.loadSettings()), drawMode: 1 });
    expect((await persistence.loadSettings()).drawMode).toBe(1);
  });
});

describe('local games', () => {
  it('queues new games as unsynced and marks them synced', async () => {
    const a = record();
    const b = record();
    await persistence.recordGame(a);
    await persistence.recordGame(b);
    expect((await persistence.unsyncedGames()).map((g) => g.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );

    await persistence.markSynced([a.id], 'now');
    expect((await persistence.unsyncedGames()).map((g) => g.id)).toEqual([b.id]);
  });

  it('imports server history without overwriting local games', async () => {
    const local = record();
    await persistence.recordGame(local);
    await persistence.importGames([{ ...local, score: 999 }, record({ seed: 99 })], 'pulled');
    const all = await persistence.allGames();
    expect(all).toHaveLength(2);
    expect(all.find((g) => g.id === local.id)?.syncedAt).toBeNull();
    expect(all.find((g) => g.seed === 99)?.syncedAt).toBe('pulled');
  });
});

describe('api client', () => {
  it('throws ApiError with the server message', async () => {
    const fetchImpl: Fetch = () =>
      Promise.resolve(Response.json({ error: 'Player not found' }, { status: 404 }));
    await expect(createApi(fetchImpl).playerGames('x y')).rejects.toEqual(
      new ApiError(404, 'Player not found'),
    );
  });

  it('validates responses', async () => {
    const fetchImpl: Fetch = () => Promise.resolve(Response.json({ nope: true }));
    await expect(createApi(fetchImpl).globalStats(3)).rejects.toThrow();
  });
});

describe('sync', () => {
  const player = { id: crypto.randomUUID(), name: 'Chris', token: null };

  const fakeApi = () => {
    const uploaded: GameRecord[][] = [];
    const api = {
      ...createApi(() => Promise.reject(new Error('unused'))),
      uploadGames: vi.fn((_: string, games: readonly GameRecord[]) => {
        uploaded.push([...games]);
        return Promise.resolve({ stored: games.map((g) => g.id) });
      }),
    };
    return { api, uploaded };
  };

  it('waits for a player before uploading', async () => {
    const { api } = fakeApi();
    await persistence.recordGame(record());
    expect(await createSync(api, persistence, () => null).flush()).toBe(0);
    expect(api.uploadGames).not.toHaveBeenCalled();
  });

  it('uploads pending games once, without local-only fields', async () => {
    const { api, uploaded } = fakeApi();
    await persistence.recordGame(record());
    await persistence.recordGame(record());
    const sync = createSync(api, persistence, () => player);

    const [first, second] = await Promise.all([sync.flush(), sync.flush()]);
    expect(first).toBe(2);
    expect(second).toBe(2);
    expect(api.uploadGames).toHaveBeenCalledTimes(1);
    expect(uploaded[0]?.[0]).not.toHaveProperty('syncedAt');
    expect(await persistence.unsyncedGames()).toEqual([]);
    expect(await sync.flush()).toBe(0);
  });

  it('keeps games queued when the network fails', async () => {
    const api = {
      ...createApi(() => Promise.reject(new Error('offline'))),
    };
    await persistence.recordGame(record());
    expect(await createSync(api, persistence, () => player).flush()).toBe(0);
    expect(await persistence.unsyncedGames()).toHaveLength(1);
  });

  it('links an existing name and pulls its history', async () => {
    const remote = record({ seed: 42 });
    const api = {
      ...createApi(() => Promise.reject(new Error('unused'))),
      linkPlayer: vi.fn(() => Promise.resolve({ player, created: false })),
      playerGames: vi.fn(() => Promise.resolve({ player: { name: 'Chris' }, games: [remote] })),
    };
    const result = await createSync(api, persistence, () => null).link('chris');
    expect(result.player).toEqual(player);
    expect((await persistence.allGames()).map((g) => g.seed)).toEqual([42]);
  });

  it('does not pull history for a brand-new name', async () => {
    const api = {
      ...createApi(() => Promise.reject(new Error('unused'))),
      linkPlayer: vi.fn(() => Promise.resolve({ player, created: true })),
      playerGames: vi.fn(),
    };
    await createSync(api, persistence, () => null).link('Chris');
    expect(api.playerGames).not.toHaveBeenCalled();
  });
});

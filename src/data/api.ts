import type { z } from 'zod';
import {
  CreatePlayerResponseSchema,
  GlobalStatsResponseSchema,
  LeaderboardResponseSchema,
  PlayerGamesResponseSchema,
  UploadGamesResponseSchema,
  type DrawModeValue,
  type GameRecord,
  type LeaderboardMetric,
} from '../../shared/schema';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Fetch = typeof fetch;

/** Typed client for the Worker API; every response is validated with the shared schemas. */
export function createApi(fetchImpl: Fetch = (...args) => fetch(...args), base = '/api') {
  async function call<S extends z.ZodType>(schema: S, path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');
    const response = await fetchImpl(`${base}${path}`, { ...init, headers });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(response.status, body?.error ?? response.statusText);
    }
    return schema.parse(await response.json());
  }

  return {
    linkPlayer: (name: string) =>
      call(CreatePlayerResponseSchema, '/players', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    playerGames: (name: string) =>
      call(PlayerGamesResponseSchema, `/players/${encodeURIComponent(name)}/games`),

    uploadGames: (playerId: string, games: readonly GameRecord[]) =>
      call(UploadGamesResponseSchema, '/games', {
        method: 'POST',
        body: JSON.stringify({ playerId, games }),
      }),

    leaderboard: (drawMode: DrawModeValue, by: LeaderboardMetric) =>
      call(LeaderboardResponseSchema, `/leaderboard?draw=${drawMode}&by=${by}`),

    globalStats: (drawMode: DrawModeValue) =>
      call(GlobalStatsResponseSchema, `/stats/global?draw=${drawMode}`),
  };
}

export type Api = ReturnType<typeof createApi>;

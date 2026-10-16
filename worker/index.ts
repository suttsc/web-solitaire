import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  ClaimRequestSchema,
  CreatePlayerRequestSchema,
  DrawModeSchema,
  LeaderboardMetricSchema,
  LoginRequestSchema,
  PlayerNameSchema,
  UploadGamesRequestSchema,
} from '../shared/schema';
import { computeStats } from '../shared/stats';
import { bearerToken, hashPassword, newSessionToken, sha256, verifyPassword } from './auth';
import { createRepository, type Repository } from './repository';

interface AppEnv {
  Bindings: Env;
}

const DrawQuerySchema = z.object({
  draw: z.coerce.number().pipe(DrawModeSchema).default(3),
});

const NameParamSchema = z.object({ name: PlayerNameSchema });

const app = new Hono<AppEnv>().basePath('/api');

/** The player id behind this request's bearer token, if it carries a live one. */
async function authenticatedPlayerId(c: Context<AppEnv>, repo: Repository): Promise<string | null> {
  const token = bearerToken(c.req.header('authorization'));
  return token ? repo.sessionPlayerId(await sha256(token)) : null;
}

async function startSession(repo: Repository, player: { id: string; name: string }) {
  const { token, expiresAt } = newSessionToken();
  await repo.createSession(player.id, await sha256(token), expiresAt);
  return { player: { id: player.id, name: player.name }, token };
}

app.get('/health', (c) => c.json({ status: 'ok' }));

/**
 * Link this browser to a player by name: returns the existing player or creates one.
 * A name protected by a password can only be reached by logging in.
 */
app.post('/players', zValidator('json', CreatePlayerRequestSchema), async (c) => {
  const { name } = c.req.valid('json');
  const repo = createRepository(c.env.DB);
  const existing = await repo.findPlayerAuth('name', name);
  if (existing?.password_hash) {
    return c.json({ error: 'This name is protected. Log in with its password.' }, 409);
  }
  const result = await repo.findOrCreatePlayer(name);
  return c.json(result, result.created ? 201 : 200);
});

app.get('/players/:name/games', zValidator('param', NameParamSchema), async (c) => {
  const repo = createRepository(c.env.DB);
  const player = await repo.findPlayerByName(c.req.valid('param').name);
  if (!player) return c.json({ error: 'Player not found' }, 404);
  return c.json({ player: { name: player.name }, games: await repo.gamesForPlayer(player.id) });
});

app.get(
  '/players/:name/stats',
  zValidator('param', NameParamSchema),
  zValidator('query', DrawQuerySchema),
  async (c) => {
    const repo = createRepository(c.env.DB);
    const player = await repo.findPlayerByName(c.req.valid('param').name);
    if (!player) return c.json({ error: 'Player not found' }, 404);
    const { draw } = c.req.valid('query');
    return c.json({
      player: { name: player.name },
      drawMode: draw,
      stats: computeStats(await repo.gamesForPlayer(player.id), draw),
    });
  },
);

/** Protect a linked, unprotected player with a password. Logs this browser in. */
app.post('/auth/claim', zValidator('json', ClaimRequestSchema), async (c) => {
  const { playerId, password } = c.req.valid('json');
  const repo = createRepository(c.env.DB);
  const player = await repo.findPlayerAuth('id', playerId);
  if (!player) return c.json({ error: 'Player not found' }, 404);
  if (!(await repo.setPasswordIfUnset(player.id, await hashPassword(password)))) {
    return c.json({ error: 'This name already has a password. Log in instead.' }, 409);
  }
  return c.json(await startSession(repo, player), 201);
});

app.post('/auth/login', zValidator('json', LoginRequestSchema), async (c) => {
  const { name, password } = c.req.valid('json');
  const repo = createRepository(c.env.DB);
  const player = await repo.findPlayerAuth('name', name);
  const ok =
    player?.password_hash != null && (await verifyPassword(password, player.password_hash));
  if (!player || !ok) return c.json({ error: 'Wrong name or password' }, 401);
  return c.json(await startSession(repo, player));
});

app.post('/auth/logout', async (c) => {
  const token = bearerToken(c.req.header('authorization'));
  if (token) await createRepository(c.env.DB).deleteSession(await sha256(token));
  return c.body(null, 204);
});

app.post('/games', zValidator('json', UploadGamesRequestSchema), async (c) => {
  const { playerId, games } = c.req.valid('json');
  const repo = createRepository(c.env.DB);
  const player = await repo.findPlayerAuth('id', playerId);
  if (!player) return c.json({ error: 'Player not found' }, 404);
  if (player.password_hash && (await authenticatedPlayerId(c, repo)) !== player.id) {
    return c.json({ error: 'Log in to sync games for this name' }, 401);
  }
  return c.json({ stored: await repo.storeGames(playerId, games) });
});

app.get(
  '/leaderboard',
  zValidator('query', DrawQuerySchema.extend({ by: LeaderboardMetricSchema.default('time') })),
  async (c) => {
    const { draw, by } = c.req.valid('query');
    const entries = await createRepository(c.env.DB).leaderboard(draw, by);
    return c.json({ drawMode: draw, by, entries });
  },
);

app.get(
  '/records',
  zValidator('query', DrawQuerySchema.extend({ exclude: z.uuid().optional() })),
  async (c) => {
    const { draw, exclude } = c.req.valid('query');
    return c.json(await createRepository(c.env.DB).records(draw, exclude ?? null));
  },
);

app.get('/stats/global', zValidator('query', DrawQuerySchema), async (c) => {
  return c.json(await createRepository(c.env.DB).globalStats(c.req.valid('query').draw));
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  // Log the message explicitly: D1 errors otherwise reach Workers Logs as a bare stack trace.
  console.error(`${c.req.method} ${c.req.path} failed: ${error.message}`, error.cause ?? '');
  return c.json({ error: 'Internal error' }, 500);
});

export default app;

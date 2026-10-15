import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  CreatePlayerRequestSchema,
  DrawModeSchema,
  LeaderboardMetricSchema,
  PlayerNameSchema,
  UploadGamesRequestSchema,
} from '../shared/schema';
import { computeStats } from '../shared/stats';
import { createRepository } from './repository';

const DrawQuerySchema = z.object({
  draw: z.coerce.number().pipe(DrawModeSchema).default(3),
});

const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));

/** Link this browser to a player by name: returns the existing player or creates one. */
app.post('/players', zValidator('json', CreatePlayerRequestSchema), async (c) => {
  const { name } = c.req.valid('json');
  const result = await createRepository(c.env.DB).findOrCreatePlayer(name);
  return c.json(result, result.created ? 201 : 200);
});

app.get(
  '/players/:name/games',
  zValidator('param', z.object({ name: PlayerNameSchema })),
  async (c) => {
    const repo = createRepository(c.env.DB);
    const player = await repo.findPlayerByName(c.req.valid('param').name);
    if (!player) return c.json({ error: 'Player not found' }, 404);
    return c.json({ player, games: await repo.gamesForPlayer(player.id) });
  },
);

app.get(
  '/players/:name/stats',
  zValidator('param', z.object({ name: PlayerNameSchema })),
  zValidator('query', DrawQuerySchema),
  async (c) => {
    const repo = createRepository(c.env.DB);
    const player = await repo.findPlayerByName(c.req.valid('param').name);
    if (!player) return c.json({ error: 'Player not found' }, 404);
    const { draw } = c.req.valid('query');
    return c.json({
      player,
      drawMode: draw,
      stats: computeStats(await repo.gamesForPlayer(player.id), draw),
    });
  },
);

app.post('/games', zValidator('json', UploadGamesRequestSchema), async (c) => {
  const { playerId, games } = c.req.valid('json');
  const repo = createRepository(c.env.DB);
  if (!(await repo.findPlayerById(playerId))) return c.json({ error: 'Player not found' }, 404);
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

app.get('/stats/global', zValidator('query', DrawQuerySchema), async (c) => {
  return c.json(await createRepository(c.env.DB).globalStats(c.req.valid('query').draw));
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: 'Internal error' }, 500);
});

export default app;

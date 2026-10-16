import { z } from 'zod';

/** Shared between the app and the API so both validate exactly the same shapes. */

export const DrawModeSchema = z.union([z.literal(1), z.literal(3)]);
export const ScoringModeSchema = z.enum(['standard', 'vegas']);
export const GameResultSchema = z.enum(['won', 'stuck', 'abandoned']);

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(24, 'Use at most 24 characters')
  .regex(/^[\p{L}\p{N} _.'-]+$/u, "Letters, numbers, spaces and _ . ' - only");

export const GameRecordSchema = z.object({
  id: z.uuid(),
  seed: z.number().int().min(0).max(0xffffffff),
  drawMode: DrawModeSchema,
  scoringMode: ScoringModeSchema,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  durationMs: z.number().int().min(0),
  moves: z.number().int().min(0),
  undos: z.number().int().min(0),
  score: z.number().int(),
  result: GameResultSchema,
  appVersion: z.string().max(32),
});

export const PlayerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

/** What anyone can see about a player. The id is only given to browsers that link or log in. */
export const PublicPlayerSchema = z.object({ name: z.string() });

export const PasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');

export const CreatePlayerRequestSchema = z.object({ name: PlayerNameSchema });
export const CreatePlayerResponseSchema = z.object({
  player: PlayerSchema,
  created: z.boolean(),
});

export const ClaimRequestSchema = z.object({ playerId: z.uuid(), password: PasswordSchema });
export const LoginRequestSchema = z.object({
  name: PlayerNameSchema,
  password: z.string().min(1).max(128),
});
export const AuthResponseSchema = z.object({ player: PlayerSchema, token: z.string() });

export const UploadGamesRequestSchema = z.object({
  playerId: z.uuid(),
  games: z.array(GameRecordSchema).min(1).max(100),
});
export const UploadGamesResponseSchema = z.object({ stored: z.array(z.uuid()) });

export const PlayerGamesResponseSchema = z.object({
  player: PublicPlayerSchema,
  games: z.array(GameRecordSchema),
});

export const LeaderboardMetricSchema = z.enum(['time', 'score', 'moves']);
export const LeaderboardEntrySchema = z.object({
  name: z.string(),
  value: z.number(),
  endedAt: z.string(),
});
export const LeaderboardResponseSchema = z.object({
  drawMode: DrawModeSchema,
  by: LeaderboardMetricSchema,
  entries: z.array(LeaderboardEntrySchema),
});

const RecordSchema = z.object({ name: z.string(), value: z.number() }).nullable();

/** The best win on record for each metric (wins only; score compares standard scoring only). */
export const RecordsResponseSchema = z.object({
  drawMode: DrawModeSchema,
  time: RecordSchema,
  moves: RecordSchema,
  score: RecordSchema,
});

export const GlobalStatsResponseSchema = z.object({
  drawMode: DrawModeSchema,
  players: z.number().int(),
  played: z.number().int(),
  won: z.number().int(),
  bestTimeMs: z.number().int().nullable(),
  averageWinMs: z.number().int().nullable(),
});

export type DrawModeValue = z.infer<typeof DrawModeSchema>;
export type ScoringMode = z.infer<typeof ScoringModeSchema>;
export type GameResult = z.infer<typeof GameResultSchema>;
export type GameRecord = z.infer<typeof GameRecordSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type LeaderboardMetric = z.infer<typeof LeaderboardMetricSchema>;
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
export type GlobalStatsResponse = z.infer<typeof GlobalStatsResponseSchema>;
export type RecordsResponse = z.infer<typeof RecordsResponseSchema>;

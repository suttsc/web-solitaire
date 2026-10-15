import type {
  DrawModeValue,
  GameRecord,
  GlobalStatsResponse,
  LeaderboardMetric,
  Player,
} from '../shared/schema';

interface GameRow {
  id: string;
  seed: number;
  draw_mode: number;
  scoring_mode: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  moves: number;
  undos: number;
  score: number;
  result: string;
  app_version: string;
}

const toRecord = (row: GameRow): GameRecord => ({
  id: row.id,
  seed: row.seed,
  drawMode: row.draw_mode as DrawModeValue,
  scoringMode: row.scoring_mode as GameRecord['scoringMode'],
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationMs: row.duration_ms,
  moves: row.moves,
  undos: row.undos,
  score: row.score,
  result: row.result as GameRecord['result'],
  appVersion: row.app_version,
});

/** Leaderboard queries: wins only, each player's best once (SQLite returns the bare columns of the MIN/MAX row). */
const LEADERBOARD_SQL: Record<LeaderboardMetric, string> = {
  time: `SELECT p.name AS name, MIN(g.duration_ms) AS value, g.ended_at AS endedAt
         FROM games g JOIN players p ON p.id = g.player_id
         WHERE g.draw_mode = ? AND g.result = 'won'
         GROUP BY g.player_id ORDER BY value ASC, endedAt ASC LIMIT ?`,
  moves: `SELECT p.name AS name, MIN(g.moves) AS value, g.ended_at AS endedAt
          FROM games g JOIN players p ON p.id = g.player_id
          WHERE g.draw_mode = ? AND g.result = 'won'
          GROUP BY g.player_id ORDER BY value ASC, endedAt ASC LIMIT ?`,
  score: `SELECT p.name AS name, MAX(g.score) AS value, g.ended_at AS endedAt
          FROM games g JOIN players p ON p.id = g.player_id
          WHERE g.draw_mode = ? AND g.result = 'won' AND g.scoring_mode = 'standard'
          GROUP BY g.player_id ORDER BY value DESC, endedAt ASC LIMIT ?`,
};

export function createRepository(db: D1Database) {
  return {
    async findPlayerByName(name: string): Promise<Player | null> {
      return db
        .prepare('SELECT id, name FROM players WHERE name = ? COLLATE NOCASE')
        .bind(name)
        .first<Player>();
    },

    async findPlayerById(id: string): Promise<Player | null> {
      return db.prepare('SELECT id, name FROM players WHERE id = ?').bind(id).first<Player>();
    },

    /** Find the player with this name (case-insensitive) or create them. */
    async findOrCreatePlayer(name: string): Promise<{ player: Player; created: boolean }> {
      const existing = await this.findPlayerByName(name);
      if (existing) return { player: existing, created: false };

      const player = { id: crypto.randomUUID(), name };
      const result = await db
        .prepare(
          'INSERT INTO players (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        )
        .bind(player.id, player.name, new Date().toISOString())
        .run();
      if (result.meta.changes > 0) return { player, created: true };

      // Lost a race with another request creating the same name.
      const winner = await this.findPlayerByName(name);
      if (!winner) throw new Error('Player vanished after insert conflict');
      return { player: winner, created: false };
    },

    /** Insert games, ignoring ids that already exist. Returns the ids now stored for this player. */
    async storeGames(playerId: string, games: readonly GameRecord[]): Promise<string[]> {
      const receivedAt = new Date().toISOString();
      const insert = db.prepare(
        `INSERT INTO games (id, player_id, seed, draw_mode, scoring_mode, started_at, ended_at,
           duration_ms, moves, undos, score, result, app_version, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
      );
      await db.batch(
        games.map((g) =>
          insert.bind(
            g.id,
            playerId,
            g.seed,
            g.drawMode,
            g.scoringMode,
            g.startedAt,
            g.endedAt,
            g.durationMs,
            g.moves,
            g.undos,
            g.score,
            g.result,
            g.appVersion,
            receivedAt,
          ),
        ),
      );

      const placeholders = games.map(() => '?').join(', ');
      const { results } = await db
        .prepare(`SELECT id FROM games WHERE player_id = ? AND id IN (${placeholders})`)
        .bind(playerId, ...games.map((g) => g.id))
        .all<{ id: string }>();
      return results.map((row) => row.id);
    },

    async gamesForPlayer(playerId: string): Promise<GameRecord[]> {
      const { results } = await db
        .prepare('SELECT * FROM games WHERE player_id = ? ORDER BY ended_at')
        .bind(playerId)
        .all<GameRow>();
      return results.map(toRecord);
    },

    async leaderboard(drawMode: DrawModeValue, by: LeaderboardMetric, limit = 20) {
      const { results } = await db
        .prepare(LEADERBOARD_SQL[by])
        .bind(drawMode, limit)
        .all<{ name: string; value: number; endedAt: string }>();
      return results;
    },

    async globalStats(drawMode: DrawModeValue): Promise<GlobalStatsResponse> {
      const row = await db
        .prepare(
          `SELECT COUNT(DISTINCT player_id) AS players,
                  COUNT(*) AS played,
                  COALESCE(SUM(result = 'won'), 0) AS won,
                  MIN(CASE WHEN result = 'won' THEN duration_ms END) AS bestTimeMs,
                  CAST(AVG(CASE WHEN result = 'won' THEN duration_ms END) AS INTEGER) AS averageWinMs
           FROM games WHERE draw_mode = ?`,
        )
        .bind(drawMode)
        .first<Omit<GlobalStatsResponse, 'drawMode'>>();
      return {
        drawMode,
        players: row?.players ?? 0,
        played: row?.played ?? 0,
        won: row?.won ?? 0,
        bestTimeMs: row?.bestTimeMs ?? null,
        averageWinMs: row?.averageWinMs ?? null,
      };
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;

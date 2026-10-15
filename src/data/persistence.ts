import type { GameRecord, GameResult } from '../../shared/schema';
import { replay } from '../engine';
import { currentScore, elapsed, type Session } from '../app/session';
import {
  DEFAULT_SETTINGS,
  type LocalGame,
  type SavedSession,
  type Settings,
  type SolitaireDb,
} from './db';

export function toGameRecord(
  session: Session,
  result: GameResult,
  now: number,
  appVersion: string,
): GameRecord {
  const { state, undos } = session.game;
  return {
    id: session.id,
    seed: state.seed,
    drawMode: state.drawMode,
    scoringMode: session.game.state.scoring,
    startedAt: session.startedAt ?? new Date(now).toISOString(),
    endedAt: new Date(now).toISOString(),
    durationMs: Math.round(elapsed(session, now)),
    moves: state.moves,
    undos,
    score: currentScore(session, now),
    result,
    appVersion,
  };
}

export function toSaved(session: Session, now: number): SavedSession {
  const { state, log } = session.game;
  return {
    key: 'current',
    id: session.id,
    seed: state.seed,
    drawMode: state.drawMode,
    scoringMode: session.game.state.scoring,
    // A game left running comes back paused, so the clock never counts time the app was closed.
    status: session.status === 'playing' ? 'paused' : session.status,
    elapsedMs: elapsed(session, now),
    startedAt: session.startedAt,
    log,
  };
}

/** Rebuild a session from storage, or null if there's nothing worth resuming. */
export function fromSaved(saved: SavedSession): Session | null {
  if (saved.status === 'won') return null;
  try {
    return {
      id: saved.id,
      game: replay(saved.seed, saved.drawMode, saved.log, saved.scoringMode),
      status: saved.status,
      elapsedMs: saved.elapsedMs,
      runningSince: null,
      startedAt: saved.startedAt,
    };
  } catch {
    return null;
  }
}

export function createPersistence(db: SolitaireDb) {
  return {
    async saveSession(session: Session, now: number): Promise<void> {
      await db.current.put(toSaved(session, now));
    },

    async loadSession(): Promise<Session | null> {
      const saved = await db.current.get('current');
      return saved ? fromSaved(saved) : null;
    },

    async recordGame(record: GameRecord): Promise<void> {
      await db.games.put({ ...record, syncedAt: null });
    },

    /** Merge games pulled from the server without clobbering local copies. */
    async importGames(records: readonly GameRecord[], syncedAt: string): Promise<void> {
      await db.transaction('rw', db.games, async () => {
        const existing = new Set(await db.games.toCollection().primaryKeys());
        await db.games.bulkPut(
          records
            .filter((record) => !existing.has(record.id))
            .map((record) => ({ ...record, syncedAt })),
        );
      });
    },

    async unsyncedGames(): Promise<LocalGame[]> {
      return db.games.filter((game) => game.syncedAt === null).toArray();
    },

    async markSynced(ids: readonly string[], syncedAt: string): Promise<void> {
      await db.games
        .where('id')
        .anyOf([...ids])
        .modify({ syncedAt });
    },

    async allGames(): Promise<LocalGame[]> {
      return db.games.orderBy('endedAt').toArray();
    },

    async loadSettings(): Promise<Settings> {
      const row = await db.settings.get('settings');
      if (!row) return DEFAULT_SETTINGS;
      const { key: _key, ...settings } = row;
      return { ...DEFAULT_SETTINGS, ...settings };
    },

    async saveSettings(settings: Settings): Promise<void> {
      await db.settings.put({ key: 'settings', ...settings });
    },
  };
}

export type Persistence = ReturnType<typeof createPersistence>;

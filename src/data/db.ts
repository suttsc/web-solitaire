import { Dexie, type EntityTable } from 'dexie';
import type { GameRecord, ScoringMode } from '../../shared/schema';
import type { DrawMode, GameAction } from '../engine';
import type { SessionStatus } from '../app/session';

/** A finished game as stored on this device. `syncedAt` is null until the server has it. */
export interface LocalGame extends GameRecord {
  readonly syncedAt: string | null;
}

/** The game in progress, saved after every move. The board is rebuilt by replaying `log` from `seed`. */
export interface SavedSession {
  readonly key: 'current';
  readonly id: string;
  readonly seed: number;
  readonly drawMode: DrawMode;
  readonly scoringMode: ScoringMode;
  readonly status: SessionStatus;
  readonly elapsedMs: number;
  readonly startedAt: string | null;
  readonly log: readonly GameAction[];
}

export interface Settings {
  readonly drawMode: DrawMode;
  readonly scoringMode: ScoringMode;
  readonly sound: boolean;
  readonly winnableOnly: boolean;
  readonly playerId: string | null;
  readonly playerName: string | null;
  /** Session token after setting or entering a password; null for an unprotected name. */
  readonly authToken: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  drawMode: 3,
  scoringMode: 'standard',
  sound: true,
  winnableOnly: false,
  playerId: null,
  playerName: null,
  authToken: null,
};

interface SettingsRow extends Settings {
  readonly key: 'settings';
}

export class SolitaireDb extends Dexie {
  games!: EntityTable<LocalGame, 'id'>;
  current!: EntityTable<SavedSession, 'key'>;
  settings!: EntityTable<SettingsRow, 'key'>;

  constructor(name = 'solitaire') {
    super(name);
    this.version(1).stores({
      games: 'id, endedAt, drawMode, result',
      current: 'key',
      settings: 'key',
    });
  }
}

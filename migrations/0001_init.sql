-- Players are identified by name for now; a login can attach to this row later.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL
);

-- Finished games never change, so uploads are idempotent inserts keyed by the device's UUID.
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  seed INTEGER NOT NULL,
  draw_mode INTEGER NOT NULL CHECK (draw_mode IN (1, 3)),
  scoring_mode TEXT NOT NULL CHECK (scoring_mode IN ('standard', 'vegas')),
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  undos INTEGER NOT NULL,
  score INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('won', 'stuck', 'abandoned')),
  app_version TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX games_player ON games (player_id, ended_at);
CREATE INDEX games_board ON games (draw_mode, result, scoring_mode);

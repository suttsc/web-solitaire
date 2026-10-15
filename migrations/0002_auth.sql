-- Optional password per player. NULL means the name is unprotected (anyone can link to it).
ALTER TABLE players ADD COLUMN password_hash TEXT;

-- Login sessions. Only a SHA-256 hash of each bearer token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_player ON sessions (player_id);

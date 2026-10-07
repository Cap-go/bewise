-- BeWise schema for Cloudflare D1

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '{}', -- JSON: { "en": "...", "fr": "..." }
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD the quote is featured
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  img TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  total_votes INTEGER NOT NULL DEFAULT 0,
  source_date TEXT, -- set when the quote is a rerun of an archived day
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (category_id, lang, date)
);

CREATE INDEX IF NOT EXISTS idx_quotes_feed ON quotes (category_id, lang, date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_source ON quotes (category_id, source_date);
CREATE INDEX IF NOT EXISTS idx_quotes_day ON quotes (category_id, date);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  platform TEXT,
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS votes (
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (quote_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user ON votes (user_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}'
);

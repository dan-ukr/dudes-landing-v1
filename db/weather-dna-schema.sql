-- db/weather-dna-schema.sql
-- Run manually via `wrangler d1 execute`, same convention as the existing
-- `emails` table (this repo has no migrations tooling).
CREATE TABLE IF NOT EXISTS weather_dna_results (
  id TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  archetype_code TEXT NOT NULL,
  thermal_score INTEGER NOT NULL,
  adaptability_score INTEGER NOT NULL,
  rain_score INTEGER NOT NULL,
  wind_score INTEGER NOT NULL,
  home_city TEXT,
  top_cities_json TEXT NOT NULL,
  outfit_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

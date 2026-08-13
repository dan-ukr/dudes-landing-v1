-- Creates the weather_dna_results table, which stores one row per
-- completed Weather DNA quiz submission (scores, top cities, outfit) so
-- the shareable result page can be reloaded by id after the quiz session ends.
--
-- NOT YET APPLIED to the production D1 database (weatherdude_db).
-- Run manually when ready, e.g.:
--   wrangler d1 execute weatherdude_db --remote --file=./migrations/0002_weather_dna_results.sql
-- (drop --remote to test against the local dev DB first)

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

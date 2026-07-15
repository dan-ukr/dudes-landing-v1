-- Adds a `product` column so the same waitlist table can capture
-- "notify me" signups for MountainDude/HungryDude, not just WeatherDude.
-- Existing rows default to 'weatherdude' so nothing already collected changes meaning.
--
-- NOT YET APPLIED to the production D1 database (weatherdude_db).
-- Run manually when ready, e.g.:
--   wrangler d1 execute weatherdude_db --remote --file=./migrations/0001_add_product_to_emails.sql
-- (drop --remote to test against the local dev DB first)

ALTER TABLE emails ADD COLUMN product TEXT NOT NULL DEFAULT 'weatherdude';

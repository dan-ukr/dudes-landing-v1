# Weather DNA Quiz — Design Spec

Date: 2026-08-13
Status: Approved for implementation planning

## 1. Purpose

A hidden (not in nav, but indexable), shareable marketing quiz on the `dudes-landing-v1`
site that gives visitors a fun "weather personality" reading in exchange for ~1 minute of
swiping/sliding, then pushes them toward downloading WeatherDude. Goal: engagement and
organic sharing, not lead capture — no login, no email required to take it.

Name **"Weather DNA"** is deliberately reused from an existing in-app WeatherDude feature
(the Diary tab's "Weather DNA" comfort-mapping view) — the quiz becomes a taste of a real
feature, which is the hook into the app-download CTA at the end.

## 2. Routing & page structure

Two distinct pages, per explicit requirement — the quiz and the result are never the same
page/URL:

```
src/pages/[lang]/weather-dna/index.astro     — the quiz itself (prerendered, static)
src/pages/[lang]/weather-dna/r/[id].astro    — the result (SSR, reads one row from D1)
src/pages/api/weather-dna.ts                  — POST endpoint: score + fetch Open-Meteo + persist + return id
src/lib/weather-dna/scoring.ts                — ported trait-scoring formulas (imported by the route above)
src/lib/weather-dna/archetypes.ts             — the 16-entry archetype lookup table
src/lib/weather-dna/cities.ts                 — static ~50-city European shortlist (lat/lon only)
```

`getStaticPaths()` over the same 9 `languages` as the rest of the site generates one quiz
page per language, matching the `[lang]/index.astro` pattern already in the codebase.

Neither page is linked from `Header.astro` or any nav. Both are indexable (no `noindex`
meta) per your call — reachable only by direct link/share, but not excluded from search.

## 3. Quiz flow (hybrid interaction, ~12 data points, 4 screens)

Reuses the existing Photon geocoder (same one WeatherDude's backend uses, no API key) for
city autocomplete, and the same 1–5 slider scale the real onboarding quiz uses, so results
stay conceptually consistent with the app.

1. **Home city** — single autocomplete input.
2. **Past climates** — optional multi-select city picker ("Lived somewhere with very
   different weather?"), up to 3 cities. Feeds the Adaptability bonus. Skippable.
3. **Swipe deck** — 8 full-screen statement cards, Tinder-style drag-to-decide (built as
   vanilla JS/CSS pointer-event drag, matching the site's existing no-framework, inline
   `<script is:inline>` pattern — no new UI framework dependency). Swipe distance/hold
   before release maps to a 1–5 intensity value. Covers rain, snow, and wind discomfort
   (paired positive/negative statements per dimension → ~2-3 cards each).
4. **Sliders** — 4 precise sliders on one screen: summer-heat feel, winter-cold feel
   (the two inputs that most determine Thermal Lean, kept as sliders not swipes for
   precision), plus two style sliders (layering: minimal↔heavy, fit: relaxed↔structured)
   that only flavor the outfit-suggestion text later.

Sticky "See my Weather DNA →" submit button once all required steps are complete.

## 4. Trait scoring (client-computed for live bar preview, server-recomputed on submit)

Ported from `temperaturebiasmllm/app/services/bias_engine.py` and `weather_service.py`
formulas into TypeScript (`src/lib/weather-dna/scoring.ts`):

| Axis | Formula basis | Output |
|---|---|---|
| Thermal Lean | `feel_summer_1_5` vs `feel_winter_1_5`, same shape as `resist_heat`/`resist_cold` in `bias_engine.py` | 0–100, 50 = neutral, <50 cold-leaning, >50 heat-leaning |
| Adaptability | Spread between summer/winter slider values (narrow vs wide) + flat bonus per past-climate city selected in step 2 | 0–100 |
| Rain/Snow Resistance | Averaged rain + snow swipe-card scores | 0–100 |
| Wind Resistance | Wind swipe-card scores | 0–100 |

Each axis is thresholded at its own midpoint into a binary flag → a 4-bit code (e.g.
`C-W-H-H`) → **direct lookup** into the 16-entry archetype table below. No fuzzy/nearest-
neighbor matching — deterministic and easy to reason about.

Scoring runs twice: client-side immediately (for a live "your bars filling in" preview
during the quiz, nice-to-have polish) and authoritatively server-side inside
`POST /api/weather-dna` from the raw answers (never trusts a client-submitted archetype
code — prevents a shared link showing a tampered/impossible result).

## 5. Archetype table

16 entries, `src/lib/weather-dna/archetypes.ts`, keyed by the 4-bit code. Each entry:
`{ code, slug, nameKey, image: '/images/archetypes/<slug>.png' }` — names live in
`ui.ts` per-language (translated), image path is a fixed convention so you can drop in
art later without touching code (placeholder image shown until the file exists).

| Code | Slug | Draft name |
|---|---|---|
| C-N-L-L | hygge-nord | The Hygge Nord |
| C-N-L-H | steppe-wanderer | The Steppe Wanderer |
| C-N-H-L | snowfall-romantic | The Snowfall Romantic |
| C-N-H-H | storm-born-viking | The Storm-Born Viking |
| C-W-L-L | continental-wanderer | The Continental Wanderer |
| C-W-L-H | highland-drifter | The Highland Drifter |
| C-W-H-L | boreal-nomad | The Boreal Nomad |
| C-W-H-H | nordic-viking | The Nordic Viking |
| H-N-L-L | mediterranean-soul | The Mediterranean Soul |
| H-N-L-H | aegean-breeze | The Aegean Breeze |
| H-N-H-L | subtropical-soul | The Subtropical Soul |
| H-N-H-H | tempest-sunseeker | The Tempest Sunseeker |
| H-W-L-L | iberian-wanderer | The Iberian Wanderer |
| H-W-L-H | coastal-drifter | The Coastal Drifter |
| H-W-H-L | humid-nomad | The Humid Nomad |
| H-W-H-H | all-weather-sun-warrior | The All-Weather Sun Warrior |

(Names are the agreed starting point; you may rename freely when producing art — only the
`code`/`slug` are structural.)

## 6. Results page — four blocks (top to bottom)

1. **Hero card** — archetype name, image slot, 4 trait bars (Thermal Lean as a single
   center-anchored bidirectional bar; the other 3 as 0–100 bars), WeatherDude logo,
   background color switcher (lime/pink/yellow/violet swatches, live-updates the card).
   Export controls: **Download PNG**, **Share** (native `navigator.share` with `files`
   where supported — covers IG Story/Telegram/etc. via the OS share sheet; falls back to
   "image downloaded, attach it yourself" + a prefilled X/Telegram text+permalink intent
   on unsupported browsers, since neither platform accepts an image by URL). Rendered via
   a new small dependency, `html-to-image`, capturing the card DOM node to PNG.
2. **Top 3 cities right now** — a curated static shortlist of ~50 European cities
   (`src/lib/weather-dna/cities.ts`, lat/lon only) scored server-side at submit time
   against the user's derived comfort band (reusing the `t_min_base`/`t_max_base` shape
   from `bias_engine.py`), live temps from **Open-Meteo** (keyless, called from the
   `/api/weather-dna` Worker route — no new secret to provision). Scored once at submit
   and stored with the result, so a shared permalink shows a consistent snapshot rather
   than silently changing temps on every view. #1 city gets a one-line localized
   explanation built from small composable phrase fragments (climate zone + archetype),
   not a bespoke paragraph per archetype×zone combination — keeps the 9-language
   translation surface manageable.
3. **Outfit suggestion** — composed from small slots (top layer / bottom / footwear /
   accessory + one style adjective from the layering/fit sliders), templated per
   temperature band rather than a canned paragraph per archetype, same translation-volume
   reasoning as above.
4. **Download WeatherDude CTA** — logo, one line of persuasive copy tying the quiz result
   back to the real app ("This was a guess — WeatherDude tracks your actual feels-like
   every day"), and the existing Google Play store button
   (`WEATHERDUDE_GOOGLE_PLAY_URL`, same styling as the product-detail modal in
   `index.astro`). No email capture here — WeatherDude is a live product, so it gets a
   real store link, not a notify-me form (matching how `PRODUCTS.weatherdude.status ===
   'live'` is already handled elsewhere on the site).

## 7. Persistence

New D1 table (created manually via `wrangler d1 execute`, matching how the existing
`emails` table was set up — no migrations tooling currently in this repo, so none is
being introduced here):

```sql
CREATE TABLE weather_dna_results (
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
```

`POST /api/weather-dna` validates answers, computes scores + archetype + top cities
server-side, inserts a row with a short random id (nanoid-style, ~8 chars, same DB
already bound as `DB` in `locals.runtime.env`), returns `{ id }`. Client redirects to
`/[lang]/weather-dna/r/[id]`. The result page 404s (styled empty state, not a crash) if
the id isn't found.

## 8. i18n

All new strings added to the existing per-language dicts in `src/i18n/ui.ts`, same
convention as current keys (`weatherdna.*` namespace) — 9 languages (en, ua, pl, it, de,
es, pt, fr, be), matching the site's current scope exactly. Translation volume is kept
bounded by design: 16 archetype names + a handful of phrase-fragment slots for city
explanations and outfit slots, not full bespoke prose per archetype.

## 9. New dependencies

- `html-to-image` (or equivalent minimal canvas-export lib) — the only new npm package.
  Everything else (swipe deck, sliders, scoring) is vanilla TS/JS, matching the site's
  current zero-framework approach.

## 10. Error handling

- Geocoder unreachable during city autocomplete → inline retry, quiz still completable
  by skipping optional past-climates step.
- Open-Meteo unreachable at submit time → fall back to the static climate-zone averages
  already in `WeatherService.CLIMATE_TYPE_MATRIX` (ported to TS) instead of live temps,
  so a result is never blocked on a third-party API being down; city cards note
  "typical conditions" instead of a live reading in that fallback case.
- D1 write failure on submit → surface a retry, do not lose the user's answers (keep
  them in memory/session storage client-side until a submit succeeds).

## 11. Testing

- Unit tests for `scoring.ts` (axis math, midpoint thresholding, archetype code lookup)
  against known input/output pairs derived from the ported formulas.
- Manual pass through the swipe deck on a real mobile viewport (drag physics are the one
  genuinely new interaction pattern on this site).
- Verify a shared result permalink renders identically on repeat visits (confirms
  snapshot-at-submit behavior, not live re-fetching).

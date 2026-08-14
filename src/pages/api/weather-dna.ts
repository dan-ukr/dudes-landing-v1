import type { APIRoute } from 'astro';
import { computeTraitScores, traitScoresToCode, isAdaptive, type QuizAnswers } from '../../lib/weather-dna/scoring';
import { getArchetype } from '../../lib/weather-dna/archetypes';
import { CITIES, type City } from '../../lib/weather-dna/cities';
import { comfortBand } from '../../lib/weather-dna/comfort';
import { fetchLiveTemps, rankCities } from '../../lib/weather-dna/weather';
import { composeOutfit } from '../../lib/weather-dna/outfit';

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp1to5(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

// Internal-only cache key — never actually requested, just used as a stable
// lookup entry in the Cache API. All users share one live-temps snapshot,
// so this takes ~52 Open-Meteo calls per submission down to ~52 per 30 min.
const LIVE_TEMPS_CACHE_KEY = new Request('https://weather-dna-internal.invalid/live-temps');

/**
 * Fetches live temps for all cities, cached for 30 minutes via the Workers
 * Cache API, with a 3s timeout on the upstream call so a hanging Open-Meteo
 * request can't stall a user's submission. Falls back to an uncached fetch
 * if the Cache API isn't available (e.g. local `astro dev`).
 */
async function getLiveTempsCached(cities: City[]): Promise<Map<string, number>> {
  const fetchWithTimeout: typeof fetch = (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(3000) });

  let cache: Cache | undefined;
  try {
    // Cast through `any`: the DOM lib's `CacheStorage` type (pulled in by
    // Astro's tsconfig) and the Workers runtime one both declare a global
    // `caches`, but only the Workers one has `.default` — TS resolves to
    // the DOM version, which lacks it, even though it's a real object here.
    cache = (globalThis as any).caches?.default as Cache | undefined;
  } catch {
    cache = undefined;
  }

  if (cache) {
    try {
      const cached = await cache.match(LIVE_TEMPS_CACHE_KEY);
      if (cached) {
        const entries = (await cached.json()) as Array<[string, number]>;
        return new Map(entries);
      }
    } catch {
      // Corrupt/unreadable cache entry — fall through to a live fetch.
    }
  }

  const liveTemps = await fetchLiveTemps(cities, fetchWithTimeout);

  if (cache) {
    try {
      await cache.put(
        LIVE_TEMPS_CACHE_KEY,
        new Response(JSON.stringify(Array.from(liveTemps.entries())), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=1800' },
        })
      );
    } catch {
      // Caching failure must never break the feature.
    }
  }

  return liveTemps;
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const answers: QuizAnswers = {
    feelWinter1to5: clamp1to5(body.feelWinter1to5, 3),
    feelSummer1to5: clamp1to5(body.feelSummer1to5, 3),
    rainDiscomfort1to5: clamp1to5(body.rainDiscomfort1to5, 3),
    snowDiscomfort1to5: clamp1to5(body.snowDiscomfort1to5, 3),
    windDiscomfort1to5: clamp1to5(body.windDiscomfort1to5, 3),
    pastClimateCityCount: num(body.pastClimateCityCount, 0),
  };
  const layering1to5 = clamp1to5(body.layering1to5, 3);
  const fit1to5 = clamp1to5(body.fit1to5, 3);
  const lang = typeof body.lang === 'string' && body.lang ? body.lang : 'en';
  const homeCity = typeof body.homeCity === 'string' ? body.homeCity : null;

  try {
    const scores = computeTraitScores(answers);
    const code = traitScoresToCode(scores);
    const archetype = getArchetype(code);

    const month = new Date().getMonth() + 1;
    const band = comfortBand(answers.feelWinter1to5, answers.feelSummer1to5, isAdaptive(scores), month, scores.thermal);

    const liveTemps = await getLiveTempsCached(CITIES);
    const topCities = rankCities(CITIES, liveTemps, band.idealTemp, month, 3);

    const outfit = composeOutfit(topCities[0]?.tempC ?? band.idealTemp, layering1to5, fit1to5);

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);

    const { DB } = locals.runtime.env;
    await DB.prepare(
      `INSERT INTO weather_dna_results
        (id, lang, archetype_code, thermal_score, adaptability_score, rain_score, wind_score, home_city, top_cities_json, outfit_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        lang,
        code,
        Math.round(scores.thermal),
        Math.round(scores.adaptability),
        Math.round(scores.rain),
        Math.round(scores.wind),
        homeCity,
        JSON.stringify(
          topCities.map((c) => ({
            name: c.city.name,
            country: c.city.country,
            tempC: c.tempC,
            isLive: c.isLive,
          }))
        ),
        JSON.stringify(outfit)
      )
      .run();

    return new Response(JSON.stringify({ id, archetypeSlug: archetype.slug }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

import type { APIRoute } from 'astro';
import { computeTraitScores, traitScoresToCode, isAdaptive, type QuizAnswers } from '../../lib/weather-dna/scoring';
import { getArchetype } from '../../lib/weather-dna/archetypes';
import { CITIES } from '../../lib/weather-dna/cities';
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

  const scores = computeTraitScores(answers);
  const code = traitScoresToCode(scores);
  const archetype = getArchetype(code);

  const month = new Date().getMonth() + 1;
  const band = comfortBand(answers.feelWinter1to5, answers.feelSummer1to5, isAdaptive(scores), month);

  const liveTemps = await fetchLiveTemps(CITIES, fetch);
  const topCities = rankCities(CITIES, liveTemps, band.tMin, band.tMax, month, 3);

  const outfit = composeOutfit(topCities[0]?.tempC ?? (band.tMin + band.tMax) / 2, layering1to5, fit1to5);

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
};

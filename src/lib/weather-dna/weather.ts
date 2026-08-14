import type { City } from './cities';
import { comfortScore, estimateTypicalTempC } from './comfort';

export type RankedCity = {
  city: City;
  tempC: number;
  isLive: boolean;
  score: number;
};

/**
 * Fetches current temperature for every city in one batched Open-Meteo call.
 * Never throws — returns an empty map on any failure so callers can fall back
 * to estimateTypicalTempC without special-casing errors.
 */
export async function fetchLiveTemps(
  cities: City[],
  fetchImpl: typeof fetch
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (cities.length === 0) return result;

  const lats = cities.map((c) => c.lat).join(',');
  const lons = cities.map((c) => c.lon).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m&timezone=auto`;

  try {
    const res = await fetchImpl(url);
    if (!res.ok) return result;
    const data = (await res.json()) as Array<{ current?: { temperature_2m?: number } }>;
    cities.forEach((city, i) => {
      const temp = data[i]?.current?.temperature_2m;
      if (typeof temp === 'number') result.set(city.name, temp);
    });
  } catch {
    // Network failure, malformed response, etc. — empty map triggers the
    // typical-seasonal-temperature fallback in rankCities.
  }
  return result;
}

export function rankCities(
  cities: City[],
  liveTemps: Map<string, number>,
  idealTemp: number,
  month1to12: number,
  count: number
): RankedCity[] {
  const ranked: RankedCity[] = cities.map((city) => {
    const live = liveTemps.get(city.name);
    const isLive = typeof live === 'number';
    const tempC = isLive ? (live as number) : estimateTypicalTempC(city.typicalJulyC, city.typicalJanC, month1to12);
    return { city, tempC, isLive, score: comfortScore(tempC, idealTemp) };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, count);
}

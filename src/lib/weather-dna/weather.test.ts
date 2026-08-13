import { describe, it, expect, vi } from 'vitest';
import { fetchLiveTemps, rankCities } from './weather';
import type { City } from './cities';

const CITIES: City[] = [
  { name: 'A', country: 'X', lat: 10, lon: 10, typicalJulyC: 30, typicalJanC: 10 },
  { name: 'B', country: 'X', lat: 20, lon: 20, typicalJulyC: 10, typicalJanC: -10 },
  { name: 'C', country: 'X', lat: 30, lon: 30, typicalJulyC: 20, typicalJanC: 0 },
];

describe('fetchLiveTemps', () => {
  it('returns a map of city name -> temperature on success', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { current: { temperature_2m: 25 } },
        { current: { temperature_2m: 5 } },
        { current: { temperature_2m: 15 } },
      ],
    });
    const result = await fetchLiveTemps(CITIES, fakeFetch as unknown as typeof fetch);
    expect(result.get('A')).toBe(25);
    expect(result.get('B')).toBe(5);
    expect(result.get('C')).toBe(15);
  });

  it('returns an empty map instead of throwing on network failure', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await fetchLiveTemps(CITIES, fakeFetch as unknown as typeof fetch);
    expect(result.size).toBe(0);
  });

  it('returns an empty map instead of throwing on a non-ok response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const result = await fetchLiveTemps(CITIES, fakeFetch as unknown as typeof fetch);
    expect(result.size).toBe(0);
  });
});

describe('rankCities', () => {
  it('picks the cities closest to the comfort band center, using live temps when present', () => {
    const live = new Map([
      ['A', 25], // comfort center is (5+15)/2=10 -> far
      ['B', 5], // close-ish
      ['C', 10], // exact center
    ]);
    const ranked = rankCities(CITIES, live, 5, 15, 7, 3);
    expect(ranked[0].city.name).toBe('C');
    expect(ranked[0].isLive).toBe(true);
  });

  it('falls back to the typical seasonal estimate when a city has no live temp', () => {
    const live = new Map<string, number>(); // nothing live
    const ranked = rankCities(CITIES, live, 5, 15, 7, 3);
    for (const r of ranked) expect(r.isLive).toBe(false);
    expect(ranked).toHaveLength(3);
  });

  it('respects the requested count', () => {
    const ranked = rankCities(CITIES, new Map(), 5, 15, 7, 2);
    expect(ranked).toHaveLength(2);
  });
});

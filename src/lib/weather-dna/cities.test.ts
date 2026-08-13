import { describe, it, expect } from 'vitest';
import { CITIES } from './cities';

describe('CITIES', () => {
  it('has at least 50 entries', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(50);
  });

  it('has unique city names', () => {
    const names = new Set(CITIES.map((c) => c.name));
    expect(names.size).toBe(CITIES.length);
  });

  it('has plausible European lat/lon for every city', () => {
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThan(34);
      expect(c.lat).toBeLessThan(71);
      expect(c.lon).toBeGreaterThan(-25);
      expect(c.lon).toBeLessThan(45);
    }
  });

  it('has July warmer than January for every city', () => {
    for (const c of CITIES) {
      expect(c.typicalJulyC).toBeGreaterThan(c.typicalJanC);
    }
  });
});

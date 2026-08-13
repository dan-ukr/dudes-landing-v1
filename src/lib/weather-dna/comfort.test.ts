import { describe, it, expect } from 'vitest';
import { comfortBand, estimateTypicalTempC, comfortScore } from './comfort';

describe('comfortBand', () => {
  it('widens the band for an adaptive person', () => {
    const nonAdaptive = comfortBand(3, 3, false, 4);
    const adaptive = comfortBand(3, 3, true, 4);
    expect(adaptive.tMin).toBeLessThan(nonAdaptive.tMin);
    expect(adaptive.tMax).toBeGreaterThan(nonAdaptive.tMax);
  });

  it('matches the bias_engine formula at month=4 (no seasonal shift)', () => {
    // seasonal_shift = 1.5 * sin((4-4)*pi/6) = 0
    // feelSummer=3 is the fixed point of the summer inversion (6-3=3), so
    // this numerically matches both the old and new tMax formula.
    const band = comfortBand(3, 3, false, 4);
    expect(band.tMin).toBeCloseTo(12.0 - 3 * 5.0, 5); // -3
    expect(band.tMax).toBeCloseTo(15.0 + (6 - 3) * 3.5, 5); // 25.5
  });

  it('gives a heat-sensitive person a LOWER comfort ceiling than a heat-tolerant one', () => {
    // feelSummer=5 ("too hot") = bothered by heat = lower tMax.
    // feelSummer=1 ("cold even at +30") = unbothered by heat = higher tMax.
    const heatSensitive = comfortBand(3, 5, false, 4);
    const heatTolerant = comfortBand(3, 1, false, 4);
    expect(heatSensitive.tMax).toBeLessThan(heatTolerant.tMax);
  });

  it('shifts warmer in July and colder in January', () => {
    const july = comfortBand(3, 3, false, 7);
    const jan = comfortBand(3, 3, false, 1);
    expect(july.tMin).toBeGreaterThan(jan.tMin);
    expect(july.tMax).toBeGreaterThan(jan.tMax);
  });
});

describe('estimateTypicalTempC', () => {
  it('returns the July value in July', () => {
    expect(estimateTypicalTempC(25, 2, 7)).toBeCloseTo(25, 5);
  });

  it('returns the January value in January', () => {
    expect(estimateTypicalTempC(25, 2, 1)).toBeCloseTo(2, 5);
  });

  it('is roughly the midpoint in April', () => {
    const mid = estimateTypicalTempC(25, 2, 4);
    expect(mid).toBeCloseTo((25 + 2) / 2, 0);
  });
});

describe('comfortScore', () => {
  it('scores the band center as the maximum (0)', () => {
    expect(comfortScore(10, 5, 15)).toBe(0);
  });

  it('penalizes distance from the band center symmetrically', () => {
    expect(comfortScore(5, 5, 15)).toBe(comfortScore(15, 5, 15));
    expect(comfortScore(20, 5, 15)).toBeLessThan(comfortScore(15, 5, 15));
  });
});

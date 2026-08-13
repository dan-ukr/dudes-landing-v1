/**
 * Ported from temperaturebiasmllm/app/services/bias_engine.py predict_day().
 * Same thresholds, same seasonal sine shift, same adaptive-flag deltas.
 *
 * Summer slider direction: 1 = "cold even at +30" (unbothered by heat, high
 * comfort ceiling), 5 = "too hot" (bothered by heat, low ceiling) -- inverse
 * relationship, confirmed against the real app's field semantics. Winter's
 * relationship is direct (5 = "too hot" even in winter = unbothered by cold,
 * low comfort floor) and is unaffected.
 */
export function comfortBand(
  feelWinter1to5: number,
  feelSummer1to5: number,
  isAdaptive: boolean,
  month1to12: number
): { tMin: number; tMax: number } {
  let tMin = 12.0 - feelWinter1to5 * 5.0;
  let tMax = 15.0 + (6 - feelSummer1to5) * 3.5;

  if (isAdaptive) {
    tMin -= 5.0;
    tMax += 4.0;
  }

  const seasonalShift = 1.5 * Math.sin(((month1to12 - 4) * Math.PI) / 6);
  tMin += seasonalShift;
  tMax += seasonalShift;

  return { tMin, tMax };
}

/**
 * Cosine interpolation between a city's typical July high and January high,
 * used only as a fallback when the live Open-Meteo call fails.
 */
export function estimateTypicalTempC(
  typicalJulyC: number,
  typicalJanC: number,
  month1to12: number
): number {
  const mid = (typicalJulyC + typicalJanC) / 2;
  const amp = (typicalJulyC - typicalJanC) / 2;
  const phase = ((month1to12 - 7) / 12) * 2 * Math.PI;
  return Math.round((mid + amp * Math.cos(phase)) * 10) / 10;
}

/**
 * Higher is better. 0 at the comfort-band center, negative outside/away from it.
 * Used to rank candidate cities against a user's personal comfort band.
 */
export function comfortScore(tempC: number, tMin: number, tMax: number): number {
  const center = (tMin + tMax) / 2;
  const distance = Math.abs(tempC - center);
  return distance === 0 ? 0 : -distance;
}

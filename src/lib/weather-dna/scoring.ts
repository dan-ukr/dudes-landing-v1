export type QuizAnswers = {
  feelWinter1to5: number;
  feelSummer1to5: number;
  rainDiscomfort1to5: number;
  snowDiscomfort1to5: number;
  windDiscomfort1to5: number;
  pastClimateCityCount: number;
};

export type TraitScores = {
  thermal: number;
  adaptability: number;
  rain: number;
  wind: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** releaseRatio in [-1, 1]: -1 = full left swipe (disagree), 1 = full right swipe (agree). */
export function swipeToDiscomfort(releaseRatio: number): number {
  const r = clamp(releaseRatio, -1, 1);
  return Math.round(clamp(3 - r * 2, 1, 5));
}

// Same shape as bias_engine.py: resist_cold = feel_winter / 3, resist_heat = feel_summer / 3.
function resistCold(feelWinter1to5: number): number {
  return feelWinter1to5 / 3.0;
}
function resistHeat(feelSummer1to5: number): number {
  return feelSummer1to5 / 3.0;
}

const RESIST_MIN = 1 / 3;
const RESIST_MAX = 5 / 3;
const RESIST_RANGE = RESIST_MAX - RESIST_MIN;

function discomfortToResistance(discomfort1to5: number): number {
  return 100 - ((discomfort1to5 - 1) / 4) * 100;
}

export function computeTraitScores(answers: QuizAnswers): TraitScores {
  const rc = resistCold(answers.feelWinter1to5);
  const rh = resistHeat(answers.feelSummer1to5);

  // Thermal lean: 50 = neutral, higher resist_heat relative to resist_cold -> leans heat.
  const thermal = clamp(50 + (rh - rc) * 37.5, 0, 100);

  // Adaptability: average resistance normalized to 0-100, plus a flat bonus per
  // past-climate city (having lived through more climates widens tolerance).
  const avgResist = (rc + rh) / 2;
  const adaptBase = ((avgResist - RESIST_MIN) / RESIST_RANGE) * 100;
  const adaptability = clamp(adaptBase + answers.pastClimateCityCount * 10, 0, 100);

  const rain = clamp(
    (discomfortToResistance(answers.rainDiscomfort1to5) +
      discomfortToResistance(answers.snowDiscomfort1to5)) /
      2,
    0,
    100
  );
  const wind = clamp(discomfortToResistance(answers.windDiscomfort1to5), 0, 100);

  return { thermal, adaptability, rain, wind };
}

export function isAdaptive(scores: TraitScores): boolean {
  return scores.adaptability >= 50;
}

export function traitScoresToCode(scores: TraitScores): string {
  const thermalFlag = scores.thermal >= 50 ? 'H' : 'C';
  const adaptFlag = scores.adaptability >= 50 ? 'W' : 'N';
  const rainFlag = scores.rain >= 50 ? 'H' : 'L';
  const windFlag = scores.wind >= 50 ? 'H' : 'L';
  return `${thermalFlag}-${adaptFlag}-${rainFlag}-${windFlag}`;
}

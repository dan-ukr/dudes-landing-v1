import { describe, it, expect } from 'vitest';
import {
  swipeToDiscomfort,
  computeTraitScores,
  isAdaptive,
  traitScoresToCode,
  type QuizAnswers,
} from './scoring';

describe('swipeToDiscomfort', () => {
  it('maps full-right swipe (agree/comfortable) to 1', () => {
    expect(swipeToDiscomfort(1)).toBe(1);
  });
  it('maps full-left swipe (disagree/uncomfortable) to 5', () => {
    expect(swipeToDiscomfort(-1)).toBe(5);
  });
  it('maps a neutral release to 3', () => {
    expect(swipeToDiscomfort(0)).toBe(3);
  });
  it('clamps out-of-range input', () => {
    expect(swipeToDiscomfort(2)).toBe(1);
    expect(swipeToDiscomfort(-2)).toBe(5);
  });
});

describe('computeTraitScores', () => {
  const base: QuizAnswers = {
    feelWinter1to5: 3,
    feelSummer1to5: 3,
    rainDiscomfort1to5: 3,
    snowDiscomfort1to5: 3,
    windDiscomfort1to5: 3,
    pastClimateCityCount: 0,
  };

  it('centers thermal lean at 50 when winter/summer feel are equal', () => {
    const scores = computeTraitScores(base);
    expect(scores.thermal).toBeCloseTo(50, 0);
  });

  it('leans cold (below 50) when winter feel is high and summer feel is low (cold-resistant, heat-sensitive)', () => {
    const scores = computeTraitScores({ ...base, feelWinter1to5: 5, feelSummer1to5: 1 });
    expect(scores.thermal).toBeLessThan(50);
  });

  it('leans heat (above 50) when summer feel is low (heat-sensitive/cold-loving) is wrong; heat lean comes from high resist_heat', () => {
    // resist_heat = feelSummer/3, resist_cold = feelWinter/3
    // high feelSummer + low feelWinter -> heat-resistant & cold-sensitive -> leans heat (>50)
    const scores = computeTraitScores({ ...base, feelWinter1to5: 1, feelSummer1to5: 5 });
    expect(scores.thermal).toBeGreaterThan(50);
  });

  it('increases adaptability with more past-climate cities', () => {
    const none = computeTraitScores(base);
    const three = computeTraitScores({ ...base, pastClimateCityCount: 3 });
    expect(three.adaptability).toBeGreaterThan(none.adaptability);
  });

  it('inverts discomfort into resistance (low discomfort -> high resistance)', () => {
    const comfortable = computeTraitScores({ ...base, rainDiscomfort1to5: 1, snowDiscomfort1to5: 1 });
    const uncomfortable = computeTraitScores({ ...base, rainDiscomfort1to5: 5, snowDiscomfort1to5: 5 });
    expect(comfortable.rain).toBeGreaterThan(uncomfortable.rain);
  });

  it('keeps every axis within 0-100', () => {
    const extreme = computeTraitScores({
      feelWinter1to5: 5,
      feelSummer1to5: 5,
      rainDiscomfort1to5: 1,
      snowDiscomfort1to5: 1,
      windDiscomfort1to5: 1,
      pastClimateCityCount: 10,
    });
    for (const v of Object.values(extreme)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('isAdaptive', () => {
  it('is true at or above 50 adaptability', () => {
    expect(isAdaptive({ thermal: 50, adaptability: 50, rain: 50, wind: 50 })).toBe(true);
  });
  it('is false below 50', () => {
    expect(isAdaptive({ thermal: 50, adaptability: 49, rain: 50, wind: 50 })).toBe(false);
  });
});

describe('traitScoresToCode', () => {
  it('produces the Nordic Viking code for cold+wide+high+high', () => {
    expect(traitScoresToCode({ thermal: 20, adaptability: 80, rain: 80, wind: 80 })).toBe('C-W-H-H');
  });
  it('produces the Mediterranean Soul code for heat+narrow+low+low', () => {
    expect(traitScoresToCode({ thermal: 80, adaptability: 20, rain: 20, wind: 20 })).toBe('H-N-L-L');
  });
  it('treats exactly 50 as the high side of the threshold', () => {
    expect(traitScoresToCode({ thermal: 50, adaptability: 50, rain: 50, wind: 50 })).toBe('H-W-H-H');
  });
});

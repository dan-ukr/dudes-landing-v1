# Weather DNA Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hidden, shareable "Weather DNA" personality quiz on the dudes-landing-v1 site: a short hybrid swipe/slider quiz that classifies visitors into one of 16 climate archetypes, shows an exportable hero card, live top-3 European cities, a templated outfit suggestion, and a WeatherDude download CTA.

**Architecture:** Pure-logic scoring/data modules under `src/lib/weather-dna/` (unit tested, framework-free) are wired together by one Cloudflare Worker API route (`POST /api/weather-dna`) that scores the quiz, ranks cities via Open-Meteo, and persists the result to D1. Two new Astro pages consume this: a static prerendered quiz page and a server-rendered per-result permalink page. All interactivity is vanilla TS (matching the site's existing zero-framework convention), the only new runtime dependency is `html-to-image` for the card export.

**Tech Stack:** Astro 5 (existing), Cloudflare Workers + D1 (existing), vitest (new, dev-only, for the pure-logic modules), `html-to-image` (new, runtime, for PNG export), Open-Meteo (keyless HTTP API), Photon geocoder (keyless, same one WeatherDude's backend uses).

**Spec:** `docs/superpowers/specs/2026-08-13-weather-dna-quiz-design.md`

## Global Constraints

- Exactly the site's current 9 languages: `en, ua, pl, it, de, es, pt, fr, be`. No new languages.
- No new UI framework. All client interactivity is vanilla TypeScript, matching the existing `<script>`/`<script is:inline>` pattern already used in `Header.astro` and `index.astro`.
- Only one new runtime npm dependency: `html-to-image`. Everything else pure TS.
- No D1 migrations tooling introduced — the new table is created via a documented `wrangler d1 execute` command, matching how the existing `emails` table was set up (no migrations folder exists in this repo).
- Quiz page (`/[lang]/weather-dna/`) is prerendered (`export const prerender = true`), matching `[lang]/index.astro`. Result page (`/[lang]/weather-dna/r/[id]`) is left un-prerendered (site default is `output: "server"` per `astro.config.mjs`, so omitting the flag means SSR).
- Neither page is linked from `Header.astro` or any nav component. Both remain indexable (no `noindex` meta).
- The quiz page and the result page are two distinct routes — never combined.
- Reuse existing brand CSS vars (`--wd-pink`, `--wd-lime`, `--wd-yellow`, `--wd-white`, `--dd-navy`) and the neubrutalist visual style (thick black borders, hard drop shadows) already defined in `layout.astro` / `tailwind.config.mjs` / `[lang]/index.astro`'s `<style>` block — no new design system.

---

## File Structure

```
src/lib/weather-dna/
  comfort.ts        — comfort-band formula (ported from bias_engine.py) + seasonal temp interpolation
  scoring.ts         — quiz answers -> 4 trait scores -> archetype code
  archetypes.ts       — 16-entry archetype lookup table
  cities.ts            — static ~50-city European shortlist with typical Jul/Jan temps
  weather.ts            — Open-Meteo fetch + city ranking + fallback
  outfit.ts               — outfit-suggestion slot composition
  *.test.ts                — vitest unit tests co-located with each module above

src/pages/api/weather-dna.ts   — POST endpoint tying the lib modules together + D1 insert

src/pages/[lang]/weather-dna/index.astro     — the quiz (prerendered)
src/pages/[lang]/weather-dna/r/[id].astro    — the result (SSR)

src/scripts/weather-dna-quiz.ts    — client-side quiz interactivity (imported, not inline)
src/scripts/weather-dna-card.ts    — client-side hero-card export/share/color-switch logic

src/i18n/ui.ts   — modified: add `weatherdna.*` keys to all 9 language blocks
```

---

## Task 1: Test tooling + module scaffold

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/weather-dna/` (empty dir, populated by later tasks)

**Interfaces:**
- Produces: `npm run test` running vitest once, `npm run test:watch` for watch mode.

- [ ] **Step 1: Install vitest as a dev dependency**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add test scripts to package.json**

Add under `"scripts"` in `package.json` (keep all existing scripts untouched):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works with a throwaway smoke test**

Create `src/lib/weather-dna/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test`
Expected: PASS, 1 test.

Delete `src/lib/weather-dna/smoke.test.ts` once confirmed (its only job was proving the runner works).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for weather-dna unit tests"
```

---

## Task 2: Comfort-band module

**Files:**
- Create: `src/lib/weather-dna/comfort.ts`
- Test: `src/lib/weather-dna/comfort.test.ts`

**Interfaces:**
- Produces:
  - `comfortBand(feelWinter1to5: number, feelSummer1to5: number, isAdaptive: boolean, month1to12: number): { tMin: number; tMax: number }`
  - `estimateTypicalTempC(typicalJulyC: number, typicalJanC: number, month1to12: number): number`
  - `comfortScore(tempC: number, tMin: number, tMax: number): number`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/weather-dna/comfort.test.ts
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
    const band = comfortBand(3, 3, false, 4);
    expect(band.tMin).toBeCloseTo(12.0 - 3 * 5.0, 5); // -3
    expect(band.tMax).toBeCloseTo(15.0 + 3 * 3.5, 5); // 25.5
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- comfort`
Expected: FAIL — `comfort.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/weather-dna/comfort.ts

/**
 * Ported from temperaturebiasmllm/app/services/bias_engine.py predict_day().
 * Same thresholds, same seasonal sine shift, same adaptive-flag deltas.
 */
export function comfortBand(
  feelWinter1to5: number,
  feelSummer1to5: number,
  isAdaptive: boolean,
  month1to12: number
): { tMin: number; tMax: number } {
  let tMin = 12.0 - feelWinter1to5 * 5.0;
  let tMax = 15.0 + feelSummer1to5 * 3.5;

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
  return -Math.abs(tempC - center);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- comfort`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather-dna/comfort.ts src/lib/weather-dna/comfort.test.ts
git commit -m "feat: port comfort-band formula from bias_engine.py"
```

---

## Task 3: Trait scoring + archetype code

**Files:**
- Create: `src/lib/weather-dna/scoring.ts`
- Test: `src/lib/weather-dna/scoring.test.ts`

**Interfaces:**
- Consumes: none (pure math on primitive inputs).
- Produces:
  - `type QuizAnswers = { feelWinter1to5: number; feelSummer1to5: number; rainDiscomfort1to5: number; snowDiscomfort1to5: number; windDiscomfort1to5: number; pastClimateCityCount: number; }`
  - `type TraitScores = { thermal: number; adaptability: number; rain: number; wind: number; }` (each 0-100)
  - `swipeToDiscomfort(releaseRatio: number): number` — `releaseRatio` in `[-1, 1]`, returns 1-5.
  - `computeTraitScores(answers: QuizAnswers): TraitScores`
  - `isAdaptive(scores: TraitScores): boolean` — `scores.adaptability >= 50`
  - `traitScoresToCode(scores: TraitScores): string` — e.g. `"C-W-H-H"`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/weather-dna/scoring.test.ts
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

  it('leans cold (below 50) when winter feel is low (cold-sensitive)', () => {
    const scores = computeTraitScores({ ...base, feelWinter1to5: 1, feelSummer1to5: 5 });
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- scoring`
Expected: FAIL — `scoring.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/weather-dna/scoring.ts

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- scoring`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather-dna/scoring.ts src/lib/weather-dna/scoring.test.ts
git commit -m "feat: add weather-dna trait scoring and archetype code derivation"
```

---

## Task 4: Archetype lookup table

**Files:**
- Create: `src/lib/weather-dna/archetypes.ts`
- Test: `src/lib/weather-dna/archetypes.test.ts`

**Interfaces:**
- Consumes: `traitScoresToCode` output shape (`string` like `"C-W-H-H"`) from Task 3.
- Produces:
  - `type Archetype = { code: string; slug: string; nameKey: string; flavorKey: string; image: string }`
  - `ARCHETYPES: Archetype[]` (16 entries)
  - `getArchetype(code: string): Archetype` (throws if code unknown — all 16 codes must exist so this should never happen in practice)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/weather-dna/archetypes.test.ts
import { describe, it, expect } from 'vitest';
import { ARCHETYPES, getArchetype } from './archetypes';

describe('ARCHETYPES', () => {
  it('has exactly 16 entries', () => {
    expect(ARCHETYPES).toHaveLength(16);
  });

  it('covers every possible 4-bit code exactly once', () => {
    const thermal = ['C', 'H'];
    const adapt = ['N', 'W'];
    const rain = ['L', 'H'];
    const wind = ['L', 'H'];
    const expectedCodes = new Set<string>();
    for (const t of thermal) for (const a of adapt) for (const r of rain) for (const w of wind) {
      expectedCodes.add(`${t}-${a}-${r}-${w}`);
    }
    const actualCodes = new Set(ARCHETYPES.map((a) => a.code));
    expect(actualCodes).toEqual(expectedCodes);
  });

  it('has a unique slug per entry', () => {
    const slugs = new Set(ARCHETYPES.map((a) => a.slug));
    expect(slugs.size).toBe(16);
  });

  it('gives every entry an image path under /images/archetypes/', () => {
    for (const a of ARCHETYPES) {
      expect(a.image).toBe(`/images/archetypes/${a.slug}.png`);
    }
  });
});

describe('getArchetype', () => {
  it('resolves the Nordic Viking for C-W-H-H', () => {
    expect(getArchetype('C-W-H-H').slug).toBe('nordic-viking');
  });
  it('resolves the Mediterranean Soul for H-N-L-L', () => {
    expect(getArchetype('H-N-L-L').slug).toBe('mediterranean-soul');
  });
  it('throws on an unknown code', () => {
    expect(() => getArchetype('X-X-X-X')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- archetypes`
Expected: FAIL — `archetypes.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/weather-dna/archetypes.ts

export type Archetype = {
  code: string;
  slug: string;
  nameKey: string;
  flavorKey: string;
  image: string;
};

function entry(code: string, slug: string): Archetype {
  return {
    code,
    slug,
    nameKey: `weatherdna.archetype.${slug}.name`,
    flavorKey: `weatherdna.archetype.${slug}.flavor`,
    image: `/images/archetypes/${slug}.png`,
  };
}

export const ARCHETYPES: Archetype[] = [
  entry('C-N-L-L', 'hygge-nord'),
  entry('C-N-L-H', 'steppe-wanderer'),
  entry('C-N-H-L', 'snowfall-romantic'),
  entry('C-N-H-H', 'storm-born-viking'),
  entry('C-W-L-L', 'continental-wanderer'),
  entry('C-W-L-H', 'highland-drifter'),
  entry('C-W-H-L', 'boreal-nomad'),
  entry('C-W-H-H', 'nordic-viking'),
  entry('H-N-L-L', 'mediterranean-soul'),
  entry('H-N-L-H', 'aegean-breeze'),
  entry('H-N-H-L', 'subtropical-soul'),
  entry('H-N-H-H', 'tempest-sunseeker'),
  entry('H-W-L-L', 'iberian-wanderer'),
  entry('H-W-L-H', 'coastal-drifter'),
  entry('H-W-H-L', 'humid-nomad'),
  entry('H-W-H-H', 'all-weather-sun-warrior'),
];

const BY_CODE = new Map(ARCHETYPES.map((a) => [a.code, a]));

export function getArchetype(code: string): Archetype {
  const found = BY_CODE.get(code);
  if (!found) throw new Error(`Unknown weather-dna archetype code: ${code}`);
  return found;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- archetypes`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather-dna/archetypes.ts src/lib/weather-dna/archetypes.test.ts
git commit -m "feat: add the 16-entry weather-dna archetype lookup table"
```

---

## Task 5: City dataset

**Files:**
- Create: `src/lib/weather-dna/cities.ts`
- Test: `src/lib/weather-dna/cities.test.ts`

**Interfaces:**
- Produces: `type City = { name: string; country: string; lat: number; lon: number; typicalJulyC: number; typicalJanC: number }`, `CITIES: City[]` (50 entries).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/weather-dna/cities.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- cities`
Expected: FAIL — `cities.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/weather-dna/cities.ts

export type City = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Approximate typical daily-high temperature (C), used only as an Open-Meteo fallback. */
  typicalJulyC: number;
  typicalJanC: number;
};

export const CITIES: City[] = [
  { name: 'Reykjavik', country: 'IS', lat: 64.15, lon: -21.94, typicalJulyC: 13, typicalJanC: 2 },
  { name: 'Bergen', country: 'NO', lat: 60.39, lon: 5.32, typicalJulyC: 16, typicalJanC: 2 },
  { name: 'Oslo', country: 'NO', lat: 59.91, lon: 10.75, typicalJulyC: 21, typicalJanC: -4 },
  { name: 'Stockholm', country: 'SE', lat: 59.33, lon: 18.06, typicalJulyC: 22, typicalJanC: -1 },
  { name: 'Helsinki', country: 'FI', lat: 60.17, lon: 24.94, typicalJulyC: 21, typicalJanC: -3 },
  { name: 'Copenhagen', country: 'DK', lat: 55.68, lon: 12.57, typicalJulyC: 20, typicalJanC: 2 },
  { name: 'Edinburgh', country: 'GB', lat: 55.95, lon: -3.19, typicalJulyC: 18, typicalJanC: 6 },
  { name: 'Dublin', country: 'IE', lat: 53.35, lon: -6.26, typicalJulyC: 18, typicalJanC: 6 },
  { name: 'London', country: 'GB', lat: 51.51, lon: -0.13, typicalJulyC: 23, typicalJanC: 8 },
  { name: 'Amsterdam', country: 'NL', lat: 52.37, lon: 4.9, typicalJulyC: 21, typicalJanC: 5 },
  { name: 'Brussels', country: 'BE', lat: 50.85, lon: 4.35, typicalJulyC: 22, typicalJanC: 5 },
  { name: 'Paris', country: 'FR', lat: 48.86, lon: 2.35, typicalJulyC: 25, typicalJanC: 6 },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lon: 9.99, typicalJulyC: 22, typicalJanC: 3 },
  { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.4, typicalJulyC: 24, typicalJanC: 2 },
  { name: 'Cologne', country: 'DE', lat: 50.94, lon: 6.96, typicalJulyC: 23, typicalJanC: 4 },
  { name: 'Frankfurt', country: 'DE', lat: 50.11, lon: 8.68, typicalJulyC: 24, typicalJanC: 3 },
  { name: 'Munich', country: 'DE', lat: 48.14, lon: 11.58, typicalJulyC: 23, typicalJanC: 1 },
  { name: 'Vienna', country: 'AT', lat: 48.21, lon: 16.37, typicalJulyC: 25, typicalJanC: 1 },
  { name: 'Zurich', country: 'CH', lat: 47.38, lon: 8.54, typicalJulyC: 24, typicalJanC: 1 },
  { name: 'Geneva', country: 'CH', lat: 46.2, lon: 6.14, typicalJulyC: 25, typicalJanC: 3 },
  { name: 'Prague', country: 'CZ', lat: 50.08, lon: 14.44, typicalJulyC: 23, typicalJanC: 0 },
  { name: 'Warsaw', country: 'PL', lat: 52.23, lon: 21.01, typicalJulyC: 23, typicalJanC: -2 },
  { name: 'Krakow', country: 'PL', lat: 50.06, lon: 19.94, typicalJulyC: 23, typicalJanC: -2 },
  { name: 'Budapest', country: 'HU', lat: 47.5, lon: 19.04, typicalJulyC: 27, typicalJanC: 1 },
  { name: 'Bratislava', country: 'SK', lat: 48.15, lon: 17.11, typicalJulyC: 26, typicalJanC: 0 },
  { name: 'Ljubljana', country: 'SI', lat: 46.06, lon: 14.51, typicalJulyC: 26, typicalJanC: 2 },
  { name: 'Zagreb', country: 'HR', lat: 45.81, lon: 15.98, typicalJulyC: 27, typicalJanC: 2 },
  { name: 'Belgrade', country: 'RS', lat: 44.79, lon: 20.45, typicalJulyC: 28, typicalJanC: 3 },
  { name: 'Bucharest', country: 'RO', lat: 44.43, lon: 26.1, typicalJulyC: 29, typicalJanC: 0 },
  { name: 'Sofia', country: 'BG', lat: 42.7, lon: 23.32, typicalJulyC: 27, typicalJanC: 1 },
  { name: 'Vilnius', country: 'LT', lat: 54.69, lon: 25.28, typicalJulyC: 22, typicalJanC: -4 },
  { name: 'Riga', country: 'LV', lat: 56.95, lon: 24.11, typicalJulyC: 21, typicalJanC: -3 },
  { name: 'Tallinn', country: 'EE', lat: 59.44, lon: 24.75, typicalJulyC: 20, typicalJanC: -4 },
  { name: 'Kyiv', country: 'UA', lat: 50.45, lon: 30.52, typicalJulyC: 24, typicalJanC: -3 },
  { name: 'Minsk', country: 'BY', lat: 53.9, lon: 27.57, typicalJulyC: 22, typicalJanC: -5 },
  { name: 'Milan', country: 'IT', lat: 45.46, lon: 9.19, typicalJulyC: 29, typicalJanC: 4 },
  { name: 'Venice', country: 'IT', lat: 45.44, lon: 12.32, typicalJulyC: 27, typicalJanC: 5 },
  { name: 'Florence', country: 'IT', lat: 43.77, lon: 11.26, typicalJulyC: 30, typicalJanC: 7 },
  { name: 'Rome', country: 'IT', lat: 41.9, lon: 12.5, typicalJulyC: 30, typicalJanC: 8 },
  { name: 'Naples', country: 'IT', lat: 40.85, lon: 14.27, typicalJulyC: 29, typicalJanC: 9 },
  { name: 'Palermo', country: 'IT', lat: 38.12, lon: 13.36, typicalJulyC: 30, typicalJanC: 11 },
  { name: 'Madrid', country: 'ES', lat: 40.42, lon: -3.7, typicalJulyC: 33, typicalJanC: 6 },
  { name: 'Barcelona', country: 'ES', lat: 41.39, lon: 2.16, typicalJulyC: 28, typicalJanC: 8 },
  { name: 'Valencia', country: 'ES', lat: 39.47, lon: -0.38, typicalJulyC: 30, typicalJanC: 9 },
  { name: 'Seville', country: 'ES', lat: 37.39, lon: -5.99, typicalJulyC: 36, typicalJanC: 9 },
  { name: 'Lisbon', country: 'PT', lat: 38.72, lon: -9.14, typicalJulyC: 28, typicalJanC: 9 },
  { name: 'Porto', country: 'PT', lat: 41.15, lon: -8.61, typicalJulyC: 25, typicalJanC: 7 },
  { name: 'Athens', country: 'GR', lat: 37.98, lon: 23.73, typicalJulyC: 33, typicalJanC: 9 },
  { name: 'Thessaloniki', country: 'GR', lat: 40.64, lon: 22.94, typicalJulyC: 32, typicalJanC: 5 },
  { name: 'Istanbul', country: 'TR', lat: 41.01, lon: 28.98, typicalJulyC: 28, typicalJanC: 6 },
  { name: 'Nice', country: 'FR', lat: 43.7, lon: 7.27, typicalJulyC: 27, typicalJanC: 6 },
  { name: 'Marseille', country: 'FR', lat: 43.3, lon: 5.37, typicalJulyC: 29, typicalJanC: 5 },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- cities`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather-dna/cities.ts src/lib/weather-dna/cities.test.ts
git commit -m "feat: add the 50-city weather-dna shortlist"
```

---

## Task 6: Open-Meteo fetch + city ranking

**Files:**
- Create: `src/lib/weather-dna/weather.ts`
- Test: `src/lib/weather-dna/weather.test.ts`

**Interfaces:**
- Consumes: `City` from Task 5 (`cities.ts`), `comfortScore`/`estimateTypicalTempC` from Task 2 (`comfort.ts`).
- Produces:
  - `type RankedCity = { city: City; tempC: number; isLive: boolean; score: number }`
  - `fetchLiveTemps(cities: City[], fetchImpl: typeof fetch): Promise<Map<string, number>>` (keyed by city `name`; empty map on any failure, never throws)
  - `rankCities(cities: City[], liveTemps: Map<string, number>, tMin: number, tMax: number, month1to12: number, count: number): RankedCity[]`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/weather-dna/weather.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- weather`
Expected: FAIL — `weather.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/weather-dna/weather.ts
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
  tMin: number,
  tMax: number,
  month1to12: number,
  count: number
): RankedCity[] {
  const ranked: RankedCity[] = cities.map((city) => {
    const live = liveTemps.get(city.name);
    const isLive = typeof live === 'number';
    const tempC = isLive ? (live as number) : estimateTypicalTempC(city.typicalJulyC, city.typicalJanC, month1to12);
    return { city, tempC, isLive, score: comfortScore(tempC, tMin, tMax) };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- weather`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather-dna/weather.ts src/lib/weather-dna/weather.test.ts
git commit -m "feat: add Open-Meteo fetch and comfort-based city ranking"
```

---

## Task 7: Outfit suggestion composer

**Files:**
- Create: `src/lib/weather-dna/outfit.ts`
- Test: `src/lib/weather-dna/outfit.test.ts`

**Interfaces:**
- Produces:
  - `type OutfitSlots = { topLayerKey: string; bottomKey: string; footwearKey: string; accessoryKey: string }`
  - `composeOutfit(tempC: number, layering1to5: number, fit1to5: number): OutfitSlots` — returns i18n keys (resolved to text by the caller via the existing `ui.ts` `t` lookup), not raw strings, so the same logic works across all 9 languages.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/weather-dna/outfit.test.ts
import { describe, it, expect } from 'vitest';
import { composeOutfit } from './outfit';

describe('composeOutfit', () => {
  it('suggests hot-weather slots above 25C', () => {
    const outfit = composeOutfit(30, 3, 3);
    expect(outfit.topLayerKey).toBe('weatherdna.outfit.top.hot');
    expect(outfit.bottomKey).toBe('weatherdna.outfit.bottom.hot');
    expect(outfit.footwearKey).toBe('weatherdna.outfit.footwear.hot');
  });

  it('suggests cold-weather slots below 5C', () => {
    const outfit = composeOutfit(-2, 3, 3);
    expect(outfit.topLayerKey).toBe('weatherdna.outfit.top.cold');
    expect(outfit.bottomKey).toBe('weatherdna.outfit.bottom.cold');
    expect(outfit.footwearKey).toBe('weatherdna.outfit.footwear.cold');
  });

  it('suggests mild slots for a typical spring day', () => {
    const outfit = composeOutfit(18, 3, 3);
    expect(outfit.topLayerKey).toBe('weatherdna.outfit.top.mild');
  });

  it('picks a heavier-layering accessory when the layering slider is high', () => {
    const light = composeOutfit(18, 1, 3);
    const heavy = composeOutfit(18, 5, 3);
    expect(heavy.accessoryKey).not.toBe(light.accessoryKey);
  });

  it('picks a structured-fit accessory phrasing when the fit slider is high', () => {
    const relaxed = composeOutfit(18, 3, 1);
    const structured = composeOutfit(18, 3, 5);
    expect(structured.accessoryKey).not.toBe(relaxed.accessoryKey);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- outfit`
Expected: FAIL — `outfit.ts` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// src/lib/weather-dna/outfit.ts

export type OutfitSlots = {
  topLayerKey: string;
  bottomKey: string;
  footwearKey: string;
  accessoryKey: string;
};

type TempBand = 'cold' | 'cool' | 'mild' | 'hot';

function tempBand(tempC: number): TempBand {
  if (tempC < 5) return 'cold';
  if (tempC < 15) return 'cool';
  if (tempC < 25) return 'mild';
  return 'hot';
}

export function composeOutfit(tempC: number, layering1to5: number, fit1to5: number): OutfitSlots {
  const band = tempBand(tempC);

  const accessoryAxis = layering1to5 >= fit1to5 ? 'layering' : 'fit';
  const accessoryLevel =
    accessoryAxis === 'layering'
      ? layering1to5 >= 4
        ? 'heavy'
        : layering1to5 <= 2
        ? 'minimal'
        : 'balanced'
      : fit1to5 >= 4
      ? 'structured'
      : fit1to5 <= 2
      ? 'relaxed'
      : 'balanced';

  return {
    topLayerKey: `weatherdna.outfit.top.${band}`,
    bottomKey: `weatherdna.outfit.bottom.${band}`,
    footwearKey: `weatherdna.outfit.footwear.${band}`,
    accessoryKey: `weatherdna.outfit.accessory.${accessoryAxis}.${accessoryLevel}`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- outfit`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather-dna/outfit.ts src/lib/weather-dna/outfit.test.ts
git commit -m "feat: add temperature-banded outfit suggestion composer"
```

---

## Task 8: i18n — English content

**Files:**
- Modify: `src/i18n/ui.ts` (the `en` block only, ~line 33-126)

**Interfaces:**
- Produces: every `weatherdna.*` key the quiz/result pages will reference. This is the source-of-truth English copy that Task 9 translates.

- [ ] **Step 1: Add the following keys inside the existing `en: { ... }` object in `src/i18n/ui.ts`, after the last `form.exists` line and before the closing `},` of the `en` block**

```typescript
    'weatherdna.meta.title': 'What\'s Your Weather DNA?',
    'weatherdna.meta.description': 'A 1-minute quiz that figures out your real climate personality.',

    'weatherdna.intro.title': 'FIND YOUR WEATHER DNA',
    'weatherdna.intro.subtitle': 'One minute. Sixteen possible results. Zero average person involved.',
    'weatherdna.intro.start': 'Start the test',

    'weatherdna.step.city.title': 'Where do you live?',
    'weatherdna.step.city.placeholder': 'Start typing your city...',

    'weatherdna.step.pastClimates.title': 'Lived somewhere with very different weather?',
    'weatherdna.step.pastClimates.subtitle': 'Add up to 3 places. Totally optional.',
    'weatherdna.step.pastClimates.add': 'Add another city',
    'weatherdna.step.next': 'Continue',

    'weatherdna.step.swipe.intro': 'Swipe right if that\'s you, left if it\'s not. How hard you swipe matters.',
    'weatherdna.swipe.rain1': 'I don\'t mind getting caught in the rain without an umbrella.',
    'weatherdna.swipe.rain2': 'A grey, drizzly day ruins my mood.',
    'weatherdna.swipe.rain3': 'I actually like the sound of rain against a window.',
    'weatherdna.swipe.snow1': 'Walking through fresh snow sounds fun, not annoying.',
    'weatherdna.swipe.snow2': 'Slush and grey snow on the street make me miserable.',
    'weatherdna.swipe.snow3': 'I\'d rather have a snowy winter than a grey rainy one.',
    'weatherdna.swipe.wind1': 'A strong gust of wind doesn\'t bother me at all.',
    'weatherdna.swipe.wind2': 'Windy days make me want to stay inside.',

    'weatherdna.step.sliders.title': 'A couple more things',
    'weatherdna.step.sliders.summer.label': 'How does summer feel to you?',
    'weatherdna.step.sliders.summer.low': 'Too cold',
    'weatherdna.step.sliders.summer.high': 'Too hot',
    'weatherdna.step.sliders.winter.label': 'How does winter feel to you?',
    'weatherdna.step.sliders.winter.low': 'Too cold',
    'weatherdna.step.sliders.winter.high': 'Too hot',
    'weatherdna.step.sliders.layering.label': 'Your everyday layering style?',
    'weatherdna.step.sliders.layering.low': 'One piece and done',
    'weatherdna.step.sliders.layering.high': 'Stack every layer I own',
    'weatherdna.step.sliders.fit.label': 'Your everyday fit?',
    'weatherdna.step.sliders.fit.low': 'Loose and relaxed',
    'weatherdna.step.sliders.fit.high': 'Structured and put-together',
    'weatherdna.step.sliders.submit': 'See my Weather DNA',

    'weatherdna.archetype.hygge-nord.name': 'The Hygge Nord',
    'weatherdna.archetype.hygge-nord.flavor': 'a cozy soul who loves the cold as long as it stays calm and dry',
    'weatherdna.archetype.steppe-wanderer.name': 'The Steppe Wanderer',
    'weatherdna.archetype.steppe-wanderer.flavor': 'built for dry cold winds, unbothered by either',
    'weatherdna.archetype.snowfall-romantic.name': 'The Snowfall Romantic',
    'weatherdna.archetype.snowfall-romantic.flavor': 'happiest catching snowflakes on a still winter day',
    'weatherdna.archetype.storm-born-viking.name': 'The Storm-Born Viking',
    'weatherdna.archetype.storm-born-viking.flavor': 'thrives on cold, wind, and snow all at once',
    'weatherdna.archetype.continental-wanderer.name': 'The Continental Wanderer',
    'weatherdna.archetype.continental-wanderer.flavor': 'adaptable, practical, at home in a mild cold climate',
    'weatherdna.archetype.highland-drifter.name': 'The Highland Drifter',
    'weatherdna.archetype.highland-drifter.flavor': 'at ease on a windswept, chilly hillside',
    'weatherdna.archetype.boreal-nomad.name': 'The Boreal Nomad',
    'weatherdna.archetype.boreal-nomad.flavor': 'steady through cold, wet, snowy days',
    'weatherdna.archetype.nordic-viking.name': 'The Nordic Viking',
    'weatherdna.archetype.nordic-viking.flavor': 'true to your Nordic Viking spirit — cold, wet, and windy barely register',
    'weatherdna.archetype.mediterranean-soul.name': 'The Mediterranean Soul',
    'weatherdna.archetype.mediterranean-soul.flavor': 'a Mediterranean Soul — sun-loving, dry heat, calm air',
    'weatherdna.archetype.aegean-breeze.name': 'The Aegean Breeze',
    'weatherdna.archetype.aegean-breeze.flavor': 'loves the heat and the breeze off the sea',
    'weatherdna.archetype.subtropical-soul.name': 'The Subtropical Soul',
    'weatherdna.archetype.subtropical-soul.flavor': 'thrives in warm, humid air',
    'weatherdna.archetype.tempest-sunseeker.name': 'The Tempest Sunseeker',
    'weatherdna.archetype.tempest-sunseeker.flavor': 'chases the heat even through wind and rain',
    'weatherdna.archetype.iberian-wanderer.name': 'The Iberian Wanderer',
    'weatherdna.archetype.iberian-wanderer.flavor': 'adaptable and warm-leaning, at home under a dry sun',
    'weatherdna.archetype.coastal-drifter.name': 'The Coastal Drifter',
    'weatherdna.archetype.coastal-drifter.flavor': 'easygoing, breezy, warm-leaning',
    'weatherdna.archetype.humid-nomad.name': 'The Humid Nomad',
    'weatherdna.archetype.humid-nomad.flavor': 'resilient through warm, humid, changeable days',
    'weatherdna.archetype.all-weather-sun-warrior.name': 'The All-Weather Sun Warrior',
    'weatherdna.archetype.all-weather-sun-warrior.flavor': 'unbothered by rain or wind, as long as it\'s warm',

    'weatherdna.result.hero.trait.thermal': 'Cold ↔ Heat',
    'weatherdna.result.hero.trait.adaptability': 'Adaptability',
    'weatherdna.result.hero.trait.rain': 'Rain/Snow Resistance',
    'weatherdna.result.hero.trait.wind': 'Wind Resistance',
    'weatherdna.result.hero.download': 'Download image',
    'weatherdna.result.hero.share': 'Share',
    'weatherdna.result.hero.retake': 'Take the test again',

    'weatherdna.result.cities.title': 'Best cities for you right now',
    'weatherdna.result.cities.explanation': 'Right now, {city} is sitting at {temp}°C — {flavor}, this is about as close to your comfort zone as Europe gets today.',

    'weatherdna.result.outfit.title': 'What to wear in your perfect weather',
    'weatherdna.result.outfit.line': 'Head out in {top}, {bottom}, and {footwear}. Grab {accessory} too.',
    'weatherdna.outfit.top.cold': 'a heavy coat',
    'weatherdna.outfit.top.cool': 'a warm sweater',
    'weatherdna.outfit.top.mild': 'a light layer',
    'weatherdna.outfit.top.hot': 'a breathable t-shirt',
    'weatherdna.outfit.bottom.cold': 'thermal-lined pants',
    'weatherdna.outfit.bottom.cool': 'jeans',
    'weatherdna.outfit.bottom.mild': 'light trousers',
    'weatherdna.outfit.bottom.hot': 'shorts',
    'weatherdna.outfit.footwear.cold': 'insulated boots',
    'weatherdna.outfit.footwear.cool': 'sneakers',
    'weatherdna.outfit.footwear.mild': 'sneakers',
    'weatherdna.outfit.footwear.hot': 'sandals',
    'weatherdna.outfit.accessory.layering.minimal': 'nothing extra — you travel light',
    'weatherdna.outfit.accessory.layering.balanced': 'a light scarf, just in case',
    'weatherdna.outfit.accessory.layering.heavy': 'every layer you can stack on top',
    'weatherdna.outfit.accessory.fit.relaxed': 'something loose and easy',
    'weatherdna.outfit.accessory.fit.balanced': 'something simple and clean',
    'weatherdna.outfit.accessory.fit.structured': 'something a little more put-together',

    'weatherdna.result.cta.title': 'This was a guess.',
    'weatherdna.result.cta.body': 'WeatherDude tracks your real feels-like temperature every single day, and builds outfits from your actual wardrobe — not a one-minute quiz.',
    'weatherdna.result.cta.button': 'Get WeatherDude on Google Play',

    'weatherdna.result.notFound.title': 'This result doesn\'t exist (anymore).',
    'weatherdna.result.notFound.cta': 'Take the test',
```

- [ ] **Step 2: Verify the file still parses**

Run: `npx astro check`
Expected: no new TypeScript errors from `ui.ts` (pre-existing errors elsewhere, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/ui.ts
git commit -m "feat: add English weather-dna copy to ui.ts"
```

---

## Task 9: i18n — translate to the other 8 languages

**Files:**
- Modify: `src/i18n/ui.ts` (the `ua, pl, it, de, es, pt, fr, be` blocks)

**Interfaces:**
- Consumes: the exact English key list and copy from Task 8 — every key below must exist, verbatim key names, in all 8 remaining language blocks.

- [ ] **Step 1: For each of the 8 languages, insert the same key set as Task 8 (identical keys, translated values) at the same position (after `form.exists`, before the block's closing `},`)**

Translate every key added in Task 8 into `ua`, `pl`, `it`, `de`, `es`, `pt`, `fr`, `be`, matching the **informal, punchy, brand voice already used elsewhere in each language's block** in `ui.ts` (e.g. `ua` already uses informal "ти" per this project's established convention; `de` already uses informal "du"; other languages should match the existing register of their own block — compare against `motto.headline`, `products.weatherdude.pitch`, and `form.success` in each language for tone). Placeholders like `{city}`, `{temp}`, `{top}`, `{bottom}`, `{footwear}`, `{accessory}` must be copied through unchanged (they're interpolated at render time, not translated). Keep the key names in English (`weatherdna.step.city.title` etc.) — only the values are translated.

Do this language by language; after each language, run the build check below before moving to the next so mistakes don't compound.

- [ ] **Step 2: After each language block, verify the file still parses**

Run: `npx astro check`
Expected: no new TypeScript errors.

- [ ] **Step 3: Verify every language has the same key set as English (catches typos/missing keys)**

Add a temporary script, run it, then delete it:

```typescript
// scratch-check-keys.mjs (temporary, delete after running)
import { ui } from './src/i18n/ui.ts';

const enKeys = new Set(Object.keys(ui.en).filter((k) => k.startsWith('weatherdna.')));
for (const lang of Object.keys(ui)) {
  if (lang === 'en') continue;
  const langKeys = new Set(Object.keys(ui[lang]).filter((k) => k.startsWith('weatherdna.')));
  const missing = [...enKeys].filter((k) => !langKeys.has(k));
  const extra = [...langKeys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    console.log(lang, { missing, extra });
  } else {
    console.log(lang, 'OK');
  }
}
```

Run: `node --experimental-strip-types scratch-check-keys.mjs`
Expected: `OK` printed for all 8 languages, no `missing`/`extra` output.

Delete `scratch-check-keys.mjs` once confirmed.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/ui.ts
git commit -m "feat: translate weather-dna copy into ua, pl, it, de, es, pt, fr, be"
```

---

## Task 10: D1 table

**Files:**
- Create: `db/weather-dna-schema.sql` (documentation of the schema; not an auto-run migration, matching this repo's existing no-migrations convention)

**Interfaces:**
- Produces: the `weather_dna_results` table, queried by Task 11's API route and Task 15's result page.

- [ ] **Step 1: Write the schema file**

```sql
-- db/weather-dna-schema.sql
-- Run manually via `wrangler d1 execute`, same convention as the existing
-- `emails` table (this repo has no migrations tooling).
CREATE TABLE IF NOT EXISTS weather_dna_results (
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

- [ ] **Step 2: Apply it to the local D1 database (used by `astro dev`/`wrangler dev`)**

```bash
npx wrangler d1 execute weatherdude_db --local --file=db/weather-dna-schema.sql
```

Expected: command reports the table created (or already existing) with no errors.

- [ ] **Step 3: Confirm the table exists locally**

```bash
npx wrangler d1 execute weatherdude_db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='weather_dna_results';"
```

Expected: one row returned with `name = weather_dna_results`.

- [ ] **Step 4: Commit**

```bash
git add db/weather-dna-schema.sql
git commit -m "feat: add weather_dna_results D1 schema"
```

**Note for the human operator:** applying this to the **remote/production** D1 database is a separate, deliberate step — run `npx wrangler d1 execute weatherdude_db --remote --file=db/weather-dna-schema.sql` yourself when ready to deploy; it is intentionally not automated here since it mutates shared production state.

---

## Task 11: API route

**Files:**
- Create: `src/pages/api/weather-dna.ts`

**Interfaces:**
- Consumes: `computeTraitScores`, `traitScoresToCode`, `isAdaptive` (Task 3); `getArchetype` (Task 4); `CITIES` (Task 5); `comfortBand` (Task 2); `fetchLiveTemps`, `rankCities` (Task 6); `composeOutfit` (Task 7); D1 table from Task 10.
- Produces: `POST /api/weather-dna` — request body `{ homeCity: string, pastClimateCityCount: number, feelWinter1to5: number, feelSummer1to5: number, rainDiscomfort1to5: number, snowDiscomfort1to5: number, windDiscomfort1to5: number, layering1to5: number, fit1to5: number, lang: string }`, response `{ id: string }` on success.

- [ ] **Step 1: Implement the route**

```typescript
// src/pages/api/weather-dna.ts
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

export const POST: APIRoute = async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const answers: QuizAnswers = {
    feelWinter1to5: num(body.feelWinter1to5, 3),
    feelSummer1to5: num(body.feelSummer1to5, 3),
    rainDiscomfort1to5: num(body.rainDiscomfort1to5, 3),
    snowDiscomfort1to5: num(body.snowDiscomfort1to5, 3),
    windDiscomfort1to5: num(body.windDiscomfort1to5, 3),
    pastClimateCityCount: num(body.pastClimateCityCount, 0),
  };
  const layering1to5 = num(body.layering1to5, 3);
  const fit1to5 = num(body.fit1to5, 3);
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
```

- [ ] **Step 2: Verify with a local dev server + curl**

```bash
npm run docker:infra 2>/dev/null; npx wrangler dev &
sleep 2
curl -s -X POST http://localhost:8788/api/weather-dna \
  -H "Content-Type: application/json" \
  -d '{"homeCity":"Berlin","pastClimateCityCount":1,"feelWinter1to5":2,"feelSummer1to5":4,"rainDiscomfort1to5":2,"snowDiscomfort1to5":3,"windDiscomfort1to5":2,"layering1to5":3,"fit1to5":3,"lang":"en"}'
```

Expected: JSON response like `{"id":"a1b2c3d4e5","archetypeSlug":"..."}`. (Adjust the port/command to whatever `npm run preview` or `wrangler dev` reports in this environment — the important check is a 200 response with an `id`.)

- [ ] **Step 3: Confirm the row landed in local D1**

```bash
npx wrangler d1 execute weatherdude_db --local --command="SELECT id, archetype_code, home_city FROM weather_dna_results ORDER BY created_at DESC LIMIT 1;"
```

Expected: one row matching the curl request above.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/weather-dna.ts
git commit -m "feat: add POST /api/weather-dna scoring + persistence route"
```

---

## Task 12: Quiz page — shell, city step, past-climates step

**Files:**
- Create: `src/pages/[lang]/weather-dna/index.astro`
- Create: `src/scripts/weather-dna-quiz.ts`

**Interfaces:**
- Consumes: `languages`, `ui` from `src/i18n/ui.ts`.
- Produces: the quiz page shell with steps 1-2 working end to end (steps 3-4 are stubbed as empty containers, filled in by Task 13).

- [ ] **Step 1: Create the page shell with steps 1 and 2**

```astro
---
// src/pages/[lang]/weather-dna/index.astro
export const prerender = true;
import Layout from '../../../layouts/layout.astro';
import { ui, languages } from '../../../i18n/ui';

export function getStaticPaths() {
  return Object.keys(languages).map((lang) => ({ params: { lang } }));
}

const { lang } = Astro.params;
const t = ui[lang as keyof typeof ui];
---

<Layout lang={lang} title={t['weatherdna.meta.title']}>
  <!-- layout.astro only exposes the default slot, not a named "head" slot,
       so the meta description can't be injected from here without modifying
       layout.astro. Skipping it for v1, matching [lang]/index.astro which
       also relies on `title` alone with no per-page description override. -->

  <main class="wdna-quiz">
    <section class="wdna-step" data-step="intro" data-active="true">
      <h1>{t['weatherdna.intro.title']}</h1>
      <p>{t['weatherdna.intro.subtitle']}</p>
      <button type="button" data-action="start">{t['weatherdna.intro.start']}</button>
    </section>

    <section class="wdna-step" data-step="city">
      <h2>{t['weatherdna.step.city.title']}</h2>
      <input
        type="text"
        id="wdna-home-city-input"
        placeholder={t['weatherdna.step.city.placeholder']}
        autocomplete="off"
      />
      <ul id="wdna-home-city-results" class="wdna-city-suggestions"></ul>
      <button type="button" data-action="next-from-city" disabled>{t['weatherdna.step.next']}</button>
    </section>
    <!-- Note: the Next button also enables on manual typing (see weather-dna-quiz.ts),
         not only on an autocomplete pick — home city is display-only, never used in
         scoring, so a geocoder outage must never be able to block the quiz. -->

    <section class="wdna-step" data-step="pastClimates">
      <h2>{t['weatherdna.step.pastClimates.title']}</h2>
      <p>{t['weatherdna.step.pastClimates.subtitle']}</p>
      <input type="text" id="wdna-past-city-input" placeholder={t['weatherdna.step.city.placeholder']} autocomplete="off" />
      <ul id="wdna-past-city-results" class="wdna-city-suggestions"></ul>
      <ul id="wdna-past-city-picked"></ul>
      <button type="button" data-action="add-past-city">{t['weatherdna.step.pastClimates.add']}</button>
      <button type="button" data-action="next-from-pastClimates">{t['weatherdna.step.next']}</button>
    </section>

    <section class="wdna-step" data-step="swipe"></section>
    <section class="wdna-step" data-step="sliders"></section>
  </main>

  <style>
    .wdna-quiz { max-width: 600px; margin: 0 auto; padding: 120px 20px 60px; }
    .wdna-step { display: none; }
    .wdna-step[data-active='true'] { display: block; }
    .wdna-city-suggestions { list-style: none; padding: 0; margin: 8px 0; }
    .wdna-city-suggestions li { padding: 10px 14px; border: 3px solid black; border-radius: 14px; margin-bottom: 6px; cursor: pointer; }
  </style>

  <script src="../../../scripts/weather-dna-quiz.ts"></script>
</Layout>
```

- [ ] **Step 2: Implement the client script (city autocomplete + step navigation for steps 1-2 only)**

```typescript
// src/scripts/weather-dna-quiz.ts

type PhotonFeature = {
  properties: { name?: string; city?: string; country?: string };
  geometry: { coordinates: [number, number] }; // [lon, lat]
};

const state = {
  homeCity: null as { name: string; lat: number; lon: number } | null,
  pastCities: [] as { name: string; lat: number; lon: number }[],
};

function $(selector: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`weather-dna-quiz: missing element ${selector}`);
  return el as HTMLElement;
}

function showStep(step: string) {
  document.querySelectorAll<HTMLElement>('.wdna-step').forEach((el) => {
    el.dataset.active = el.dataset.step === step ? 'true' : 'false';
  });
}

async function searchCities(query: string): Promise<PhotonFeature[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&osm_tag=place`);
  if (!res.ok) return [];
  const data = (await res.json()) as { features: PhotonFeature[] };
  return data.features ?? [];
}

function wireCityAutocomplete(inputId: string, resultsId: string, onPick: (city: { name: string; lat: number; lon: number }) => void) {
  const input = $(inputId) as HTMLInputElement;
  const results = $(resultsId);
  let debounceTimer: ReturnType<typeof setTimeout>;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const features = await searchCities(input.value);
      results.innerHTML = '';
      for (const f of features) {
        const label = [f.properties.name, f.properties.country].filter(Boolean).join(', ');
        if (!label) continue;
        const li = document.createElement('li');
        li.textContent = label;
        li.addEventListener('click', () => {
          const [lon, lat] = f.geometry.coordinates;
          onPick({ name: label, lat, lon });
          results.innerHTML = '';
          input.value = label;
        });
        results.appendChild(li);
      }
    }, 300);
  });
}

function init() {
  document.querySelector('[data-action="start"]')?.addEventListener('click', () => showStep('city'));

  const nextFromCityBtn = document.querySelector('[data-action="next-from-city"]') as HTMLButtonElement;
  const homeCityInput = $('#wdna-home-city-input') as HTMLInputElement;
  wireCityAutocomplete('#wdna-home-city-input', '#wdna-home-city-results', (city) => {
    state.homeCity = city;
    nextFromCityBtn.disabled = false;
  });
  // Home city is display-only (never used in scoring), so don't hard-block
  // progress on a successful geocoder pick — free-typed text is fine too.
  // This also means the quiz survives the geocoder API being unreachable.
  homeCityInput.addEventListener('input', () => {
    if (!state.homeCity && homeCityInput.value.trim().length >= 2) {
      nextFromCityBtn.disabled = false;
    }
    if (homeCityInput.value.trim().length === 0) {
      nextFromCityBtn.disabled = true;
    }
  });
  nextFromCityBtn.addEventListener('click', () => {
    if (!state.homeCity && homeCityInput.value.trim()) {
      state.homeCity = { name: homeCityInput.value.trim(), lat: 0, lon: 0 };
    }
    showStep('pastClimates');
  });

  const pickedList = $('#wdna-past-city-picked');
  wireCityAutocomplete('#wdna-past-city-input', '#wdna-past-city-results', (city) => {
    if (state.pastCities.length >= 3) return;
    state.pastCities.push(city);
    const li = document.createElement('li');
    li.textContent = city.name;
    pickedList.appendChild(li);
    (document.getElementById('wdna-past-city-input') as HTMLInputElement).value = '';
  });

  document.querySelector('[data-action="next-from-pastClimates"]')?.addEventListener('click', () => showStep('swipe'));
}

init();

export { state };
```

- [ ] **Step 3: Manual check — run the dev server and click through steps 1-2**

Run: `npm run dev`, open `/en/weather-dna/` in a browser.
Expected: intro screen → Start → city step (typing "Berl" shows suggestions, picking one enables Next) → past-climates step (can add up to 3 cities or skip) → lands on the (currently empty) swipe step container.

- [ ] **Step 4: Commit**

```bash
git add src/pages/\[lang\]/weather-dna/index.astro src/scripts/weather-dna-quiz.ts
git commit -m "feat: add weather-dna quiz page shell with city + past-climates steps"
```

---

## Task 13: Quiz page — swipe deck, sliders, submit

**Files:**
- Modify: `src/pages/[lang]/weather-dna/index.astro` (fill in the `swipe` and `sliders` `<section>` stubs from Task 12)
- Modify: `src/scripts/weather-dna-quiz.ts`

**Interfaces:**
- Consumes: `swipeToDiscomfort` (Task 3, imported client-side — safe, it's a pure function with no server-only deps) for reference on the release-ratio-to-1-5 mapping (the client script inlines the same formula rather than importing the lib module directly, since `<script>` here is bundled by Vite and can import `../lib/weather-dna/scoring` directly — see Step 2).
- Produces: full quiz completion, `POST /api/weather-dna`, redirect to `/[lang]/weather-dna/r/[id]`.

- [ ] **Step 1: Replace the empty `swipe` and `sliders` sections in `index.astro`**

```astro
    <section class="wdna-step" data-step="swipe">
      <p>{t['weatherdna.step.swipe.intro']}</p>
      <div id="wdna-swipe-stack" class="wdna-swipe-stack">
        <div class="wdna-swipe-card" data-dimension="rain" data-order="0">{t['weatherdna.swipe.rain1']}</div>
        <div class="wdna-swipe-card" data-dimension="rain" data-order="1">{t['weatherdna.swipe.rain2']}</div>
        <div class="wdna-swipe-card" data-dimension="rain" data-order="2">{t['weatherdna.swipe.rain3']}</div>
        <div class="wdna-swipe-card" data-dimension="snow" data-order="3">{t['weatherdna.swipe.snow1']}</div>
        <div class="wdna-swipe-card" data-dimension="snow" data-order="4">{t['weatherdna.swipe.snow2']}</div>
        <div class="wdna-swipe-card" data-dimension="snow" data-order="5">{t['weatherdna.swipe.snow3']}</div>
        <div class="wdna-swipe-card" data-dimension="wind" data-order="6">{t['weatherdna.swipe.wind1']}</div>
        <div class="wdna-swipe-card" data-dimension="wind" data-order="7">{t['weatherdna.swipe.wind2']}</div>
      </div>
    </section>

    <section class="wdna-step" data-step="sliders">
      <h2>{t['weatherdna.step.sliders.title']}</h2>

      <label>{t['weatherdna.step.sliders.summer.label']}</label>
      <div class="wdna-slider-row">
        <span>{t['weatherdna.step.sliders.summer.low']}</span>
        <input type="range" id="wdna-slider-summer" min="1" max="5" value="3" />
        <span>{t['weatherdna.step.sliders.summer.high']}</span>
      </div>

      <label>{t['weatherdna.step.sliders.winter.label']}</label>
      <div class="wdna-slider-row">
        <span>{t['weatherdna.step.sliders.winter.low']}</span>
        <input type="range" id="wdna-slider-winter" min="1" max="5" value="3" />
        <span>{t['weatherdna.step.sliders.winter.high']}</span>
      </div>

      <label>{t['weatherdna.step.sliders.layering.label']}</label>
      <div class="wdna-slider-row">
        <span>{t['weatherdna.step.sliders.layering.low']}</span>
        <input type="range" id="wdna-slider-layering" min="1" max="5" value="3" />
        <span>{t['weatherdna.step.sliders.layering.high']}</span>
      </div>

      <label>{t['weatherdna.step.sliders.fit.label']}</label>
      <div class="wdna-slider-row">
        <span>{t['weatherdna.step.sliders.fit.low']}</span>
        <input type="range" id="wdna-slider-fit" min="1" max="5" value="3" />
        <span>{t['weatherdna.step.sliders.fit.high']}</span>
      </div>

      <button type="button" data-action="submit-quiz">{t['weatherdna.step.sliders.submit']}</button>
    </section>
```

Add to the `<style>` block in the same file:

```css
    .wdna-swipe-stack { position: relative; height: 320px; }
    .wdna-swipe-card {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 30px; border: 6px solid black; border-radius: 30px;
      background: var(--wd-white); font-weight: 900; font-size: 1.3rem; cursor: grab;
      box-shadow: 10px 10px 0px black; user-select: none; touch-action: none;
    }
    .wdna-swipe-card[data-done='true'] { display: none; }
    .wdna-slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .wdna-slider-row input[type='range'] { flex: 1; }
    .wdna-slider-row span { font-size: 0.75rem; font-weight: 900; text-transform: uppercase; opacity: 0.7; white-space: nowrap; }
```

- [ ] **Step 2: Extend the client script with swipe-deck drag handling, slider capture, and submit**

Add to `src/scripts/weather-dna-quiz.ts` (after the existing `state` object, before `function init()`):

```typescript
import { swipeToDiscomfort } from '../lib/weather-dna/scoring';

const discomfort: Record<'rain' | 'snow' | 'wind', number[]> = { rain: [], snow: [], wind: [] };

function wireSwipeDeck(onDeckComplete: () => void) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.wdna-swipe-card')).sort(
    (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
  );
  let index = 0;

  function activate() {
    cards.forEach((c, i) => {
      c.style.zIndex = String(cards.length - i);
      c.dataset.done = i < index ? 'true' : 'false';
    });
    if (index >= cards.length) {
      onDeckComplete();
      return;
    }
    wireCardDrag(cards[index]);
  }

  function wireCardDrag(card: HTMLElement) {
    let startX = 0;
    let currentX = 0;
    let dragging = false;
    const maxDrag = 120;

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      startX = e.clientX;
      card.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      currentX = e.clientX - startX;
      card.style.transform = `translateX(${currentX}px) rotate(${currentX / 20}deg)`;
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      const ratio = Math.max(-1, Math.min(1, currentX / maxDrag));
      const dimension = card.dataset.dimension as 'rain' | 'snow' | 'wind';
      discomfort[dimension].push(swipeToDiscomfort(ratio));
      card.style.transition = 'transform 0.2s ease';
      card.style.transform = `translateX(${ratio > 0 ? 400 : -400}px) rotate(${ratio * 20}deg)`;
      setTimeout(() => {
        card.style.transition = '';
        card.style.transform = '';
        index += 1;
        activate();
      }, 200);
      currentX = 0;
    }

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
  }

  activate();
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 3;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function submitQuiz(lang: string) {
  const sliderValue = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);

  const payload = {
    homeCity: state.homeCity?.name ?? null,
    pastClimateCityCount: state.pastCities.length,
    feelWinter1to5: sliderValue('wdna-slider-winter'),
    feelSummer1to5: sliderValue('wdna-slider-summer'),
    rainDiscomfort1to5: Math.round(avg(discomfort.rain)),
    snowDiscomfort1to5: Math.round(avg(discomfort.snow)),
    windDiscomfort1to5: Math.round(avg(discomfort.wind)),
    layering1to5: sliderValue('wdna-slider-layering'),
    fit1to5: sliderValue('wdna-slider-fit'),
    lang,
  };

  const res = await fetch('/api/weather-dna', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { id?: string };
  if (data.id) {
    window.location.href = `/${lang}/weather-dna/r/${data.id}`;
  }
}
```

Modify `init()` to wire the new pieces (replace the existing `next-from-pastClimates` line with the block below):

```typescript
  document.querySelector('[data-action="next-from-pastClimates"]')?.addEventListener('click', () => {
    showStep('swipe');
    wireSwipeDeck(() => showStep('sliders'));
  });

  const lang = document.documentElement.lang || 'en';
  document.querySelector('[data-action="submit-quiz"]')?.addEventListener('click', () => submitQuiz(lang));
```

- [ ] **Step 3: Manual check — full quiz walkthrough**

Run: `npm run dev`, open `/en/weather-dna/`, click through every step including swiping all 8 cards (mouse drag works via Pointer Events in desktop browsers too) and moving all 4 sliders, then submit.
Expected: browser redirects to `/en/weather-dna/r/<some-id>` (a 404/blank page is expected at this URL until Task 15 — confirming the redirect itself fires correctly is the goal of this check).

- [ ] **Step 4: Commit**

```bash
git add src/pages/\[lang\]/weather-dna/index.astro src/scripts/weather-dna-quiz.ts
git commit -m "feat: add weather-dna swipe deck, sliders, and quiz submission"
```

---

## Task 14: Result page — data + hero card

**Files:**
- Create: `src/pages/[lang]/weather-dna/r/[id].astro`
- Create: `public/images/archetypes/.gitkeep` (placeholder dir for art you'll add later)

**Interfaces:**
- Consumes: `getArchetype` (Task 4), `ui`/`languages` (`src/i18n/ui.ts`).
- Produces: the result page rendering the hero card with 4 trait bars and a graceful fallback when the archetype image file doesn't exist yet.

- [ ] **Step 1: Create the result page**

```astro
---
// src/pages/[lang]/weather-dna/r/[id].astro
// No `export const prerender = true` here — this must stay server-rendered
// (site default per astro.config.mjs output:"server") since it reads one
// row from D1 per request.
import Layout from '../../../../layouts/layout.astro';
import { ui, languages, PRODUCTS, WEATHERDUDE_GOOGLE_PLAY_URL } from '../../../../i18n/ui';
import { getArchetype } from '../../../../lib/weather-dna/archetypes';

const { lang, id } = Astro.params;
const t = ui[(lang as keyof typeof ui) in languages ? (lang as keyof typeof ui) : 'en'];

const { DB } = Astro.locals.runtime.env;
const row = await DB.prepare(
  `SELECT archetype_code, thermal_score, adaptability_score, rain_score, wind_score, top_cities_json, outfit_json
   FROM weather_dna_results WHERE id = ?`
)
  .bind(id)
  .first<{
    archetype_code: string;
    thermal_score: number;
    adaptability_score: number;
    rain_score: number;
    wind_score: number;
    top_cities_json: string;
    outfit_json: string;
  }>();

if (!row) {
  Astro.response.status = 404;
}

const archetype = row ? getArchetype(row.archetype_code) : null;
const topCities: Array<{ name: string; country: string; tempC: number; isLive: boolean }> = row
  ? JSON.parse(row.top_cities_json)
  : [];
const outfit: { topLayerKey: string; bottomKey: string; footwearKey: string; accessoryKey: string } | null = row
  ? JSON.parse(row.outfit_json)
  : null;
---

<Layout lang={lang} title={row && archetype ? t[archetype.nameKey as keyof typeof t] : t['weatherdna.result.notFound.title']}>
  <main class="wdna-result">
    {!row || !archetype ? (
      <section class="wdna-not-found">
        <h1>{t['weatherdna.result.notFound.title']}</h1>
        <a href={`/${lang}/weather-dna/`}>{t['weatherdna.result.notFound.cta']}</a>
      </section>
    ) : (
      <>
        <section class="wdna-hero-wrap">
          <div id="wdna-hero-card" class="wdna-hero-card" data-bg="lime">
            <img
              src={archetype.image}
              alt=""
              class="wdna-hero-image"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="wdna-hero-image-fallback" style="display:none;">{t[archetype.nameKey as keyof typeof t]}</div>
            <h1 class="wdna-hero-name">{t[archetype.nameKey as keyof typeof t]}</h1>

            <div class="wdna-bar">
              <span>{t['weatherdna.result.hero.trait.thermal']}</span>
              <div class="wdna-bar-track wdna-bar-center"><div class="wdna-bar-fill" style={`width:${row.thermal_score}%`}></div></div>
            </div>
            <div class="wdna-bar">
              <span>{t['weatherdna.result.hero.trait.adaptability']}</span>
              <div class="wdna-bar-track"><div class="wdna-bar-fill" style={`width:${row.adaptability_score}%`}></div></div>
            </div>
            <div class="wdna-bar">
              <span>{t['weatherdna.result.hero.trait.rain']}</span>
              <div class="wdna-bar-track"><div class="wdna-bar-fill" style={`width:${row.rain_score}%`}></div></div>
            </div>
            <div class="wdna-bar">
              <span>{t['weatherdna.result.hero.trait.wind']}</span>
              <div class="wdna-bar-track"><div class="wdna-bar-fill" style={`width:${row.wind_score}%`}></div></div>
            </div>

            <img src={PRODUCTS.weatherdude.logo} alt="WeatherDude" class="wdna-hero-logo" />
          </div>

          <div class="wdna-hero-controls">
            <div class="wdna-bg-swatches">
              <button type="button" data-bg="lime" style="background:var(--wd-lime)"></button>
              <button type="button" data-bg="pink" style="background:var(--wd-pink)"></button>
              <button type="button" data-bg="yellow" style="background:var(--wd-yellow)"></button>
              <button type="button" data-bg="violet" style="background:var(--md-purple)"></button>
            </div>
            <button type="button" id="wdna-download-btn">{t['weatherdna.result.hero.download']}</button>
            <button type="button" id="wdna-share-btn">{t['weatherdna.result.hero.share']}</button>
            <a href={`/${lang}/weather-dna/`}>{t['weatherdna.result.hero.retake']}</a>
          </div>
        </section>

        <section class="wdna-cities">
          <h2>{t['weatherdna.result.cities.title']}</h2>
          <ul>
            {topCities.map((c) => (
              <li>{c.name}, {c.country} — {Math.round(c.tempC)}°C</li>
            ))}
          </ul>
          {topCities[0] && (
            <p>
              {t['weatherdna.result.cities.explanation']
                .replace('{city}', topCities[0].name)
                .replace('{temp}', String(Math.round(topCities[0].tempC)))
                .replace('{flavor}', t[archetype.flavorKey as keyof typeof t])}
            </p>
          )}
        </section>

        {outfit && (
          <section class="wdna-outfit">
            <h2>{t['weatherdna.result.outfit.title']}</h2>
            <p>
              {t['weatherdna.result.outfit.line']
                .replace('{top}', t[outfit.topLayerKey as keyof typeof t])
                .replace('{bottom}', t[outfit.bottomKey as keyof typeof t])
                .replace('{footwear}', t[outfit.footwearKey as keyof typeof t])
                .replace('{accessory}', t[outfit.accessoryKey as keyof typeof t])}
            </p>
          </section>
        )}

        <section class="wdna-cta">
          <img src={PRODUCTS.weatherdude.logo} alt="WeatherDude" />
          <h2>{t['weatherdna.result.cta.title']}</h2>
          <p>{t['weatherdna.result.cta.body']}</p>
          <a href={WEATHERDUDE_GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer" class="wdna-cta-btn">
            {t['weatherdna.result.cta.button']}
          </a>
        </section>
      </>
    )}
  </main>

  <style>
    .wdna-result { max-width: 700px; margin: 0 auto; padding: 120px 20px 60px; }
    .wdna-hero-card {
      position: relative; border: 6px solid black; border-radius: 40px; padding: 30px;
      box-shadow: 14px 14px 0px black; text-align: center; background: var(--wd-lime);
    }
    .wdna-hero-card[data-bg='pink'] { background: var(--wd-pink); }
    .wdna-hero-card[data-bg='yellow'] { background: var(--wd-yellow); }
    .wdna-hero-card[data-bg='violet'] { background: var(--md-purple); }
    .wdna-hero-image { width: 100%; max-width: 300px; margin: 0 auto; display: block; }
    .wdna-hero-image-fallback {
      width: 100%; max-width: 300px; height: 300px; margin: 0 auto; align-items: center; justify-content: center;
      border: 4px dashed black; border-radius: 20px; font-weight: 900; font-size: 1.4rem;
    }
    .wdna-bar { text-align: left; margin: 12px 0; font-weight: 900; }
    .wdna-bar-track { height: 16px; background: white; border: 3px solid black; border-radius: 99px; overflow: hidden; }
    .wdna-bar-fill { height: 100%; background: black; }
    .wdna-hero-logo { height: 40px; margin-top: 16px; }
    .wdna-hero-controls { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 20px; }
    .wdna-bg-swatches button { width: 30px; height: 30px; border-radius: 50%; border: 3px solid black; margin-right: 6px; }
    .wdna-cta { text-align: center; margin-top: 60px; padding: 30px; border: 6px solid black; border-radius: 30px; }
    .wdna-cta-btn { display: inline-block; margin-top: 16px; padding: 14px 28px; border-radius: 99px; border: 4px solid black; background: var(--wd-lime); font-weight: 900; text-decoration: none; color: black; }
  </style>

  <script src="../../../../scripts/weather-dna-card.ts"></script>
</Layout>
```

- [ ] **Step 2: Add the placeholder art directory**

```bash
mkdir -p public/images/archetypes
```

Create `public/images/archetypes/.gitkeep` (empty file) so the directory is tracked before real art exists.

- [ ] **Step 3: Manual check**

Using the `id` returned by Task 11's curl test (or a fresh one from a live quiz run), open `/en/weather-dna/r/<id>` in a browser.
Expected: hero card renders with the archetype name, 4 filled bars, a dashed fallback box where the (not-yet-existing) character image would go, and the WeatherDude logo. Visiting a bogus id returns the "doesn't exist" state with HTTP 404.

- [ ] **Step 4: Commit**

```bash
git add src/pages/\[lang\]/weather-dna/r/\[id\].astro public/images/archetypes/.gitkeep
git commit -m "feat: add weather-dna result page with hero card, cities, outfit, and CTA"
```

---

## Task 15: Hero card export + share

**Files:**
- Create: `src/scripts/weather-dna-card.ts`
- Modify: `package.json` (new dependency)

**Interfaces:**
- Consumes: `#wdna-hero-card`, `#wdna-download-btn`, `#wdna-share-btn`, `.wdna-bg-swatches button` DOM nodes from Task 14's result page markup.

- [ ] **Step 1: Install the export library**

```bash
npm install html-to-image
```

- [ ] **Step 2: Implement the card script**

```typescript
// src/scripts/weather-dna-card.ts
import { toPng } from 'html-to-image';

function init() {
  const card = document.getElementById('wdna-hero-card');
  if (!card) return; // not-found state, nothing to wire up

  document.querySelectorAll<HTMLButtonElement>('.wdna-bg-swatches button').forEach((btn) => {
    btn.addEventListener('click', () => {
      card.dataset.bg = btn.dataset.bg ?? 'lime';
    });
  });

  async function renderPng(): Promise<string> {
    return toPng(card, { pixelRatio: 2 });
  }

  document.getElementById('wdna-download-btn')?.addEventListener('click', async () => {
    const dataUrl = await renderPng();
    const link = document.createElement('a');
    link.download = 'weather-dna.png';
    link.href = dataUrl;
    link.click();
  });

  document.getElementById('wdna-share-btn')?.addEventListener('click', async () => {
    const dataUrl = await renderPng();
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'weather-dna.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Weather DNA', url: window.location.href });
      return;
    }

    // Fallback: download the image and open a prefilled text+link share intent.
    const link = document.createElement('a');
    link.download = 'weather-dna.png';
    link.href = dataUrl;
    link.click();
    const shareText = encodeURIComponent(`My Weather DNA result: ${window.location.href}`);
    window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank', 'noopener');
  });
}

init();
```

- [ ] **Step 3: Manual check**

On the result page from Task 14, click each background swatch (card background changes live), click Download (a PNG file downloads matching the current background), and click Share on a desktop browser (falls back to download + opens a X share intent tab) and on a mobile device if available (opens the native share sheet).
Expected: all three interactions work with no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/weather-dna-card.ts package.json package-lock.json
git commit -m "feat: add weather-dna hero card export and share"
```

---

## Task 16: Final QA pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm run test`
Expected: all weather-dna tests pass (comfort, scoring, archetypes, cities, weather, outfit).

- [ ] **Step 2: Run the Astro build + type check**

Run: `npm run build`
Expected: builds cleanly, no TypeScript errors.

- [ ] **Step 3: Full end-to-end walkthrough on a real mobile viewport (or browser device emulation)**

Open `/en/weather-dna/`, complete the quiz including the swipe deck with touch/emulated-touch gestures, confirm redirect to the result page, confirm the hero card, city list, outfit line, and CTA block all render, confirm the download button produces a valid PNG.

- [ ] **Step 4: Verify permalink snapshot consistency**

Open the same result URL twice (e.g. in two different browser tabs, or reload).
Expected: identical archetype, bars, cities, and temperatures on both loads — confirms results are read from the stored D1 row, not recomputed live.

- [ ] **Step 5: Spot-check 2-3 non-English languages**

Open `/ua/weather-dna/`, `/de/weather-dna/`, `/fr/weather-dna/` and click through to a result.
Expected: all quiz copy and result copy is translated (no raw key names or English fallback text visible), placeholders (`{city}`, `{temp}`, etc.) are correctly interpolated.

- [ ] **Step 6: Confirm no nav link was added**

Grep `Header.astro` and `Footer.astro` for `weather-dna`.
Expected: no matches — the feature stays link-only, per spec.

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

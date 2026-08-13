import { describe, it, expect } from 'vitest';
import { composeOutfit } from './outfit';

describe('composeOutfit', () => {
  it('suggests hot-weather slots above 25C', () => {
    const outfit = composeOutfit(30, 3, 3);
    expect(outfit.topLayerKey).toBe('weatherdna.outfit.top.hot');
    expect(outfit.bottomKey).toBe('weatherdna.outfit.bottom.hot');
    expect(outfit.footwearKey).toBe('weatherdna.outfit.footwear.hot');
    expect(outfit.topLayerIcon).toBe('/images/outfit/t-shirt.png');
    expect(outfit.bottomIcon).toBe('/images/outfit/shorts.png');
    expect(outfit.footwearIcon).toBe('/images/outfit/sandals.png');
  });

  it('suggests cold-weather slots below 5C', () => {
    const outfit = composeOutfit(-2, 3, 3);
    expect(outfit.topLayerKey).toBe('weatherdna.outfit.top.cold');
    expect(outfit.bottomKey).toBe('weatherdna.outfit.bottom.cold');
    expect(outfit.footwearKey).toBe('weatherdna.outfit.footwear.cold');
    expect(outfit.topLayerIcon).toBe('/images/outfit/coat_long.png');
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

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

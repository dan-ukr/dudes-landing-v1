export type Archetype = {
  code: string;
  slug: string;
  nameKey: string;
  flavorKey: string;
  descriptionKey: string;
  image: string;
};

function entry(code: string, slug: string): Archetype {
  return {
    code,
    slug,
    nameKey: `weatherdna.archetype.${slug}.name`,
    flavorKey: `weatherdna.archetype.${slug}.flavor`,
    descriptionKey: `weatherdna.archetype.${slug}.description`,
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

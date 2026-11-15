export interface LunarSitePreset {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  category: 'Artemis Candidate Region' | 'Exploration Target' | 'Geographic Polar Feature';
  significance: string;
  approxElevationM?: number;
  isOfficialDesignation: boolean;
}

export const LUNAR_SOUTH_POLE_PRESETS: LunarSitePreset[] = [
  {
    id: 'shackleton-rim',
    name: 'Shackleton Crater Rim (Candidate Site)',
    description: 'High illumination ridge adjacent to Shackleton crater rim crest',
    latitude: -89.90,
    longitude: 0.00,
    category: 'Artemis Candidate Region',
    significance: 'Prominent candidate exploration region identified in NASA Artemis studies; features extended illumination adjacent to permanently shadowed ice-trapping crater.',
    approxElevationM: 650,
    isOfficialDesignation: false,
  },
  {
    id: 'connecting-ridge',
    name: 'Connecting Ridge',
    description: 'Narrow ridge connecting Shackleton rim to de Gerlache crater',
    latitude: -89.44,
    longitude: 137.31,
    category: 'Artemis Candidate Region',
    significance: 'Key candidate exploration zone identified in lunar polar illumination and traverse analyses for favorable direct Earth visibility.',
    approxElevationM: 1100,
    isOfficialDesignation: false,
  },
  {
    id: 'malapert-mountain',
    name: 'Malapert Mountain (Peak / Massif)',
    description: 'Elevated topographic massif offering superior Direct-to-Earth line-of-sight',
    latitude: -85.99,
    longitude: 2.93,
    category: 'Artemis Candidate Region',
    significance: 'Highest South Polar summit (+5128 m); optimal communications relay site with near-continuous direct line-of-sight view of Earth.',
    approxElevationM: 5128,
    isOfficialDesignation: false,
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Rim 1',
    description: 'Elevated crater rim with favorable solar illumination periods',
    latitude: -88.50,
    longitude: -88.30,
    category: 'Artemis Candidate Region',
    significance: 'Candidate region evaluated by NASA Artemis planning teams for favorable topographic clearance and extended contact windows.',
    approxElevationM: -320,
    isOfficialDesignation: false,
  },
  {
    id: 'haworth-edge',
    name: 'Haworth Crater Rim (Exploration Edge)',
    description: 'Rim of extensive permanently shadowed crater rich in volatiles',
    latitude: -87.87,
    longitude: -5.10,
    category: 'Exploration Target',
    significance: 'Permanently shadowed region (PSR) boundary studied for robotic prospecting rovers.',
    approxElevationM: -180,
    isOfficialDesignation: false,
  },
  {
    id: 'nobile-rim',
    name: 'Nobile Rim (Historical VIPER Study Site)',
    description: 'Crater rim area previously evaluated for lunar volatiles exploration',
    latitude: -85.25,
    longitude: 53.50,
    category: 'Exploration Target',
    significance: 'Historically selected exploration target for NASA volatiles mapping mission studies.',
    approxElevationM: 1420,
    isOfficialDesignation: false,
  },
  {
    id: 'amundsen-rim',
    name: 'Amundsen Crater Rim',
    description: 'Large impact basin rim in the South Polar region',
    latitude: -84.50,
    longitude: 82.80,
    category: 'Geographic Polar Feature',
    significance: 'Extensive 105 km diameter crater rim feature analyzed in South Pole geologic maps.',
    approxElevationM: -540,
    isOfficialDesignation: false,
  },
  {
    id: 'south-pole-center',
    name: 'True Lunar South Pole (90.0°S)',
    description: 'Exact selenodetic rotational south pole of the Moon',
    latitude: -90.00,
    longitude: 0.00,
    category: 'Geographic Polar Feature',
    significance: 'Rotational south pole located near the rim crest of Shackleton crater.',
    approxElevationM: 1140,
    isOfficialDesignation: true,
  },
];

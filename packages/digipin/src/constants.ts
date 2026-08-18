/**
 * India's DIGIPIN standard bounding box and character set definition.
 * Developed in accordance with India Post & IIT Hyderabad specifications.
 */

// 16-character alphanumeric symbol mapping (Row-major 4x4 grid)
export const DIGIPIN_ALPHABET = [
  '2', '3', '4', '5',
  '6', '7', '8', '9',
  'C', 'F', 'J', 'K',
  'M', 'P', 'R', 'W',
] as const;

export type DigipinSymbol = typeof DIGIPIN_ALPHABET[number];

// Geographic Bounding Box for India and surrounding maritime territories
export const DIGIPIN_BOUNDS = {
  minLat: 2.5,
  maxLat: 39.5,
  minLon: 64.5,
  maxLon: 99.5,
} as const;

// Precision Levels and approx resolution
export const DIGIPIN_LEVELS = {
  STATE_REGION: 2,     // ~250 km
  SUB_REGION: 4,       // ~15 km
  WARD_GRID: 6,        // ~950 m (Spatial Tile Layer)
  NEIGHBORHOOD: 8,     // ~60 m (Cluster Layer)
  EXACT_PINPOINT: 10,  // ~3.8 m x 3.8 m
} as const;

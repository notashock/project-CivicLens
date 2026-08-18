import { DIGIPIN_ALPHABET, DIGIPIN_BOUNDS } from './constants';
import { BoundingBox } from './encoder';

export interface DecodedDigipin {
  centroid: {
    lat: number;
    lon: number;
  };
  bounds: BoundingBox;
  precision: number;
}

export function decodeDigipin(digipin: string): DecodedDigipin {
  const normalized = digipin.replace(/[-\s]/g, '').toUpperCase();
  if (!normalized || normalized.length === 0) {
    throw new Error('Invalid DIGIPIN: Empty string');
  }

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;
    if (!DIGIPIN_ALPHABET.includes(char as any)) {
      throw new Error(`Invalid DIGIPIN character: '${char}' at position ${i}`);
    }
  }

  let minLat = DIGIPIN_BOUNDS.minLat;
  let maxLat = DIGIPIN_BOUNDS.maxLat;
  let minLon = DIGIPIN_BOUNDS.minLon;
  let maxLon = DIGIPIN_BOUNDS.maxLon;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;
    const index = DIGIPIN_ALPHABET.indexOf(char as any);

    const matrixRow = Math.floor(index / 4);
    const col = index % 4;
    const row = 3 - matrixRow;

    const latSpan = (maxLat - minLat) / 4;
    const lonSpan = (maxLon - minLon) / 4;

    minLat = minLat + row * latSpan;
    maxLat = minLat + latSpan;
    minLon = minLon + col * lonSpan;
    maxLon = minLon + lonSpan;
  }

  const centroid = {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };

  return {
    centroid,
    bounds: { minLat, maxLat, minLon, maxLon },
    precision: normalized.length,
  };
}

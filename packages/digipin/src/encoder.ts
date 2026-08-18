import { DIGIPIN_ALPHABET, DIGIPIN_BOUNDS, DigipinSymbol } from './constants';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Encodes latitude and longitude into a 10-character DIGIPIN string.
 */
export function encodeDigipin(lat: number, lon: number, precision: number = 10): string {
  if (lat < DIGIPIN_BOUNDS.minLat || lat > DIGIPIN_BOUNDS.maxLat) {
    throw new Error(`Latitude ${lat} is outside India DIGIPIN bounds [${DIGIPIN_BOUNDS.minLat}, ${DIGIPIN_BOUNDS.maxLat}]`);
  }
  if (lon < DIGIPIN_BOUNDS.minLon || lon > DIGIPIN_BOUNDS.maxLon) {
    throw new Error(`Longitude ${lon} is outside India DIGIPIN bounds [${DIGIPIN_BOUNDS.minLon}, ${DIGIPIN_BOUNDS.maxLon}]`);
  }

  let minLat = DIGIPIN_BOUNDS.minLat;
  let maxLat = DIGIPIN_BOUNDS.maxLat;
  let minLon = DIGIPIN_BOUNDS.minLon;
  let maxLon = DIGIPIN_BOUNDS.maxLon;

  const result: string[] = [];

  for (let level = 0; level < precision; level++) {
    const latSpan = (maxLat - minLat) / 4;
    const lonSpan = (maxLon - minLon) / 4;

    let row = Math.floor((lat - minLat) / latSpan);
    if (row >= 4) row = 3;
    if (row < 0) row = 0;

    let col = Math.floor((lon - minLon) / lonSpan);
    if (col >= 4) col = 3;
    if (col < 0) col = 0;

    const matrixRow = 3 - row;
    const charIndex = matrixRow * 4 + col;
    const symbol = DIGIPIN_ALPHABET[charIndex] as DigipinSymbol;
    result.push(symbol);

    minLat = minLat + row * latSpan;
    maxLat = minLat + latSpan;
    minLon = minLon + col * lonSpan;
    maxLon = minLon + lonSpan;
  }

  return result.join('');
}

export function formatDigipin(raw: string): string {
  if (!raw) return '';
  const clean = raw.replace(/[^2-9CFJKMPRW]/gi, '').toUpperCase();
  if (clean.length !== 10) return raw;
  return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 10)}`;
}

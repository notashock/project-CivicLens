import { decodeDigipin } from './decoder';

export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinProximityRadius(
  userLat: number,
  userLon: number,
  targetDigipin: string,
  maxRadiusMeters: number = 100
): { isLocal: boolean; distanceMeters: number } {
  const decoded = decodeDigipin(targetDigipin);
  const distance = calculateHaversineDistanceMeters(
    userLat,
    userLon,
    decoded.centroid.lat,
    decoded.centroid.lon
  );

  return {
    isLocal: distance <= maxRadiusMeters,
    distanceMeters: Math.round(distance * 10) / 10,
  };
}

export function getDigipinHierarchies(rawDigipin: string) {
  const clean = rawDigipin.replace(/[^2-9CFJKMPRW]/gi, '').toUpperCase();
  return {
    l10: clean,
    l8: clean.slice(0, 8),
    l6: clean.slice(0, 6),
    l4: clean.slice(0, 4),
    l2: clean.slice(0, 2),
  };
}

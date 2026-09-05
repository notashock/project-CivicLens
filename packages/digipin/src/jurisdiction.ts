import { encodeDigipin } from './encoder';

export interface RegionBoundary {
  stateCode: string;
  distCode: string;
  authority: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export const REGION_BOUNDARIES: RegionBoundary[] = [
  {
    stateCode: 'KA',
    distCode: 'BLR',
    authority: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    minLat: 12.75,
    maxLat: 13.20,
    minLon: 77.40,
    maxLon: 77.80,
  },
  {
    stateCode: 'DL',
    distCode: 'ND',
    authority: 'Municipal Corporation of Delhi (MCD)',
    minLat: 28.40,
    maxLat: 28.90,
    minLon: 76.85,
    maxLon: 77.40,
  },
  {
    stateCode: 'MH',
    distCode: 'MUM',
    authority: 'Brihanmumbai Municipal Corporation (BMC)',
    minLat: 18.85,
    maxLat: 19.35,
    minLon: 72.75,
    maxLon: 73.05,
  },
  {
    stateCode: 'TN',
    distCode: 'CHN',
    authority: 'Greater Chennai Corporation (GCC)',
    minLat: 12.90,
    maxLat: 13.25,
    minLon: 80.10,
    maxLon: 80.35,
  },
];

export function resolveRegion(lat: number, lon: number): { stateCode: string; distCode: string; authority: string } {
  for (const region of REGION_BOUNDARIES) {
    if (
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lon >= region.minLon &&
      lon <= region.maxLon
    ) {
      return {
        stateCode: region.stateCode,
        distCode: region.distCode,
        authority: region.authority,
      };
    }
  }

  return {
    stateCode: 'IN',
    distCode: 'GEN',
    authority: 'State Public Works Department (PWD)',
  };
}

/**
 * Derives a deterministic canonical IssueID from spatial coordinates and category.
 * Conforms to ADR-0008: CT-{CategoryPrefix}-{DIGIPIN}
 */
export function deriveIssueId(lat: number, lon: number, category: string): { issueId: string; digipin: string; authority: string } {
  const digipin = encodeDigipin(lat, lon, 10);
  const region = resolveRegion(lat, lon);
  const catPrefix = category.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
  const issueId = `CT-${catPrefix}-${digipin}`;

  return {
    issueId,
    digipin,
    authority: region.authority,
  };
}

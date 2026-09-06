export interface TimelineEvent {
  id: string;
  event_type: string;
  created_at: string | number;
  from_status?: string;
  to_status?: string;
  event_payload: Record<string, any>;
}

export interface EvidenceMedia {
  id: string;
  media_url: string;
  is_sanitized?: boolean;
  is_verified?: boolean;
  stance?: string;
  created_at?: string | number;
}

export interface StatusPresentation {
  label: string;
  badgeClass: string;
  dotColor: string;
  isActionable: boolean;
}

export interface ConsensusMetrics {
  totalVotes: number;
  confirmPct: number;
  disputePct: number;
}

export interface Issue {
  id: string;
  category: string;
  status: string;
  digipin_code: string;
  digipin_l8?: string;
  digipin_l6?: string;
  lat: number;
  lon: number;
  description_neutral: string;
  severity_score: number;
  jurisdiction_authority: string;
  assigned_department: string;
  verified_confirm_count: number;
  verified_dispute_count: number;
  consensus_score: number;
  first_reported_at: string | number;
  created_at?: string | number;
  last_activity_at?: string | number;
  escalation_deadline?: string | number;
  evidence_list?: EvidenceMedia[];
  timeline: TimelineEvent[];

  // Precomputed domain presentation metrics normalized at the client network seam
  statusPresentation: StatusPresentation;
  consensus: ConsensusMetrics;
  lifecycleStage: number;
}

export const ISSUE_CATEGORIES = [
  { id: 'ALL', label: 'All Hazards' },
  { id: 'ROAD_HAZARD', label: 'Roads & Potholes' },
  { id: 'DRAINAGE_WATER', label: 'Water & Drainage' },
  { id: 'SOLID_WASTE', label: 'Solid Waste' },
  { id: 'ELECTRICAL_HAZARD', label: 'Electrical Danger' },
  { id: 'PUBLIC_INFRASTRUCTURE', label: 'Public Amenities' },
] as const;

/**
 * Backward-compatible alias for any code or tests referring to FeedIssue.
 */
export type FeedIssue = Partial<Issue> & {
  id: string;
  digipin_code: string;
  category: string;
  status: string;
  description_neutral: string;
  verified_confirm_count: number;
  verified_dispute_count: number;
  lat: number;
  lon: number;
};

/**
 * Calculates the standard 5-stage lifecycle index for an issue:
 * 1: REPORTED / Logged
 * 2: COMMUNITY_CORROBORATED / Disputed
 * 3: ESCALATED / ACTION_IN_PROGRESS / Reopened
 * 4: RESOLUTION_CLAIMED (Quorum)
 * 5: COMMUNITY_VERIFIED / RESOLVED
 */
export function getLifecycleStage(status: string): number {
  const normalized = (status || '').trim().toUpperCase();
  switch (normalized) {
    case 'REPORTED':
    case 'OBSERVATION_LOGGED':
      return 1;
    case 'COMMUNITY_CORROBORATED':
    case 'DISPUTED':
      return 2;
    case 'ESCALATED':
    case 'ACTION_IN_PROGRESS':
    case 'AUTHORITY_RESPONSE':
    case 'REOPENED':
      return 3;
    case 'RESOLUTION_CLAIMED':
      return 4;
    case 'COMMUNITY_VERIFIED':
    case 'RESOLVED':
      return 5;
    default:
      return 1;
  }
}

/**
 * Normalizes, canonicalizes, and enriches raw issue payloads from the backend API
 * or SSE stream into a unified, type-safe Issue domain entity.
 */
export function normalizeIssue(raw: any): Issue {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Cannot normalize invalid issue data');
  }

  const verifiedConfirms = Math.max(0, Number(raw.verified_confirm_count ?? 0));
  const verifiedDisputes = Math.max(0, Number(raw.verified_dispute_count ?? 0));
  const status = String(raw.status ?? 'OBSERVATION_LOGGED');
  const firstReported = raw.first_reported_at || raw.created_at || new Date().toISOString();

  return {
    id: String(raw.id ?? ''),
    category: String(raw.category ?? 'ROAD_HAZARD'),
    status,
    digipin_code: String(raw.digipin_code ?? ''),
    digipin_l8: raw.digipin_l8,
    digipin_l6: raw.digipin_l6,
    lat: Number(raw.lat ?? 0),
    lon: Number(raw.lon ?? 0),
    description_neutral: String(raw.description_neutral ?? ''),
    severity_score: Number(raw.severity_score ?? 0),
    jurisdiction_authority: String(raw.jurisdiction_authority ?? 'Local Municipal Authority'),
    assigned_department: String(raw.assigned_department ?? 'Civic Infrastructure Works'),
    verified_confirm_count: verifiedConfirms,
    verified_dispute_count: verifiedDisputes,
    consensus_score: Number(raw.consensus_score ?? 100),
    first_reported_at: firstReported,
    created_at: raw.created_at || firstReported,
    last_activity_at: raw.last_activity_at,
    escalation_deadline: raw.escalation_deadline,
    evidence_list: Array.isArray(raw.evidence_list) ? raw.evidence_list : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    statusPresentation: getStatusPresentation(status),
    consensus: calculateConsensus(verifiedConfirms, verifiedDisputes),
    lifecycleStage: getLifecycleStage(status),
  };
}

export interface MapBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function isPointInBounds(lat: number, lon: number, bounds: MapBoundingBox): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return false;
  }
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

export function filterIssuesByBounds<T extends { lat: number; lon: number }>(
  issues: T[],
  bounds: MapBoundingBox | null | undefined
): T[] {
  if (!bounds) return issues;
  return issues.filter((issue) => isPointInBounds(issue.lat, issue.lon, bounds));
}

export interface FilterOptions {
  category: string;
  search: string;
  status?: string;
  bounds?: MapBoundingBox | null;
}

/**
 * Filters a collection of issues by category, status, search query, and spatial viewport bounds.
 */
export function filterIssues<T extends FeedIssue>(issues: T[], options: FilterOptions): T[] {
  const normalizedCategory = (options.category || 'ALL').trim().toUpperCase();
  const normalizedStatus = (options.status || 'ALL').trim().toUpperCase();
  const query = (options.search || '').trim().toLowerCase();

  return issues.filter((issue) => {
    // 1. Category check
    if (normalizedCategory !== 'ALL' && issue.category.toUpperCase() !== normalizedCategory) {
      return false;
    }

    // 2. Status check
    if (normalizedStatus !== 'ALL' && issue.status.toUpperCase() !== normalizedStatus) {
      return false;
    }

    // 3. Search query check
    if (query) {
      const matchDigipin = issue.digipin_code.toLowerCase().includes(query);
      const matchId = issue.id.toLowerCase().includes(query);
      const matchDesc = issue.description_neutral.toLowerCase().includes(query);
      if (!matchDigipin && !matchId && !matchDesc) {
        return false;
      }
    }

    // 4. Viewport bounding box check
    if (options.bounds && !isPointInBounds(issue.lat, issue.lon, options.bounds)) {
      return false;
    }

    return true;
  });
}

export interface StatusPresentation {
  label: string;
  badgeClass: string;
  dotColor: string;
  isActionable: boolean;
}

export function getStatusPresentation(status: string): StatusPresentation {
  const normalized = (status || '').trim().toUpperCase();

  switch (normalized) {
    case 'COMMUNITY_CORROBORATED':
      return {
        label: 'Corroborated',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dotColor: '#059669',
        isActionable: true,
      };
    case 'ESCALATED':
      return {
        label: 'SLA Escalated',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
        dotColor: '#E11D48',
        isActionable: true,
      };
    case 'RESOLUTION_CLAIMED':
      return {
        label: 'Resolution Quorum (72h)',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
        dotColor: '#0284C7',
        isActionable: true,
      };
    case 'COMMUNITY_VERIFIED':
    case 'RESOLVED':
      return {
        label: 'Verified & Solved',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dotColor: '#059669',
        isActionable: false,
      };
    default:
      return {
        label: 'Observation Logged',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        dotColor: '#D97706',
        isActionable: true,
      };
  }
}

export interface ConsensusMetrics {
  totalVotes: number;
  confirmPct: number;
  disputePct: number;
}

export function calculateConsensus(confirms: number = 0, disputes: number = 0): ConsensusMetrics {
  const safeConfirms = Math.max(0, confirms);
  const safeDisputes = Math.max(0, disputes);
  const totalVotes = safeConfirms + safeDisputes;

  if (totalVotes === 0) {
    return {
      totalVotes: 0,
      confirmPct: 100,
      disputePct: 0,
    };
  }

  const confirmPct = Math.round((safeConfirms / totalVotes) * 100);
  const disputePct = 100 - confirmPct;

  return {
    totalVotes,
    confirmPct,
    disputePct,
  };
}

export interface FeedSummary {
  totalRecorded: number;
  activeCount: number;
  resolvedCount: number;
  escalatedCount: number;
}

export function computeFeedSummary<T extends FeedIssue>(issues: T[]): FeedSummary {
  let activeCount = 0;
  let resolvedCount = 0;
  let escalatedCount = 0;

  for (const issue of issues) {
    const status = (issue.status || '').toUpperCase();
    if (status === 'RESOLVED' || status === 'COMMUNITY_VERIFIED') {
      resolvedCount += 1;
    } else {
      activeCount += 1;
    }

    if (status === 'ESCALATED') {
      escalatedCount += 1;
    }
  }

  return {
    totalRecorded: issues.length,
    activeCount,
    resolvedCount,
    escalatedCount,
  };
}



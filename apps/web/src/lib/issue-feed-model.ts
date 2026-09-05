/**
 * Pure presentation and filtering model for CivicTrace issue ledger and maps.
 * Built behind a clean seam to provide leverage to UI components and testability.
 */

export interface FeedIssue {
  id: string;
  digipin_code: string;
  category: string;
  status: string;
  description_neutral: string;
  jurisdiction_authority?: string;
  assigned_department?: string;
  verified_confirm_count: number;
  verified_dispute_count: number;
  lat: number;
  lon: number;
  first_reported_at?: string | number;
  created_at?: string | number;
  consensus_score?: number;
}

export interface FilterOptions {
  category: string;
  search: string;
  status?: string;
}

/**
 * Filters a collection of issues by category, status, and search query.
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



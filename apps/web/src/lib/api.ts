/**
 * Resolves the backend API base URL.
 * Automatically handles comma-separated candidates in NEXT_PUBLIC_API_URL
 * (e.g. "http://192.168.0.103:8000,http://localhost:8000") by matching the browser's
 * current hostname (desktop localhost vs LAN mobile).
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== 'undefined') {
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;

    if (envUrl) {
      const candidates = envUrl
        .split(',')
        .map((u) => u.trim().replace(/\/+$/, ''))
        .filter(Boolean);

      if (candidates.length === 1) {
        return candidates[0];
      }

      // Check if any candidate matches the current browser hostname
      const matching = candidates.find((cand) => {
        try {
          return new URL(cand).hostname === currentHostname;
        } catch {
          return false;
        }
      });
      if (matching) {
        return matching;
      }

      // If current browser host has different IP, use current host with candidate's port
      try {
        const port = new URL(candidates[0]).port || '8000';
        return `${currentProtocol}//${currentHostname}:${port}`;
      } catch {
        return candidates[0];
      }
    }

    // In production or single-port environments (e.g. Render, or standard port 80/443),
    // route API calls through Next.js rewrite proxy (/api/* -> FastAPI backend) on the same origin.
    const currentPort = window.location.port;
    if (!currentPort || currentPort === '80' || currentPort === '443') {
      return window.location.origin;
    }

    return `${currentProtocol}//${currentHostname}:8000`;
  }

  if (process.env.INTERNAL_API_URL) {
    return process.env.INTERNAL_API_URL.replace(/\/+$/, '');
  }

  if (envUrl) {
    const first = envUrl.split(',')[0]?.trim().replace(/\/+$/, '');
    if (first) return first;
  }

  return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = getApiBaseUrl();

import type {
  Issue,
  TimelineEvent,
  EvidenceMedia,
  StatusPresentation,
  ConsensusMetrics,
} from './issue-feed-model.ts';
import {
  normalizeIssue,
  getLifecycleStage,
} from './issue-feed-model.ts';

export type { Issue, TimelineEvent, EvidenceMedia, StatusPresentation, ConsensusMetrics };
export { normalizeIssue, getLifecycleStage };

export interface CommunityNote {
  id: string;
  issue_id: string;
  participant_badge: string;
  stance: 'CONFIRM' | 'DISPUTE' | 'NEUTRAL' | 'RESOLUTION_VERIFY' | 'RESOLUTION_DISPUTE' | string;
  is_consensus_verified: boolean;
  nullifier_hash?: string;
  lat?: number;
  lon?: number;
  text: string;
  media_urls: string[];
  created_at: string;
}

export async function fetchIssues(category?: string, status?: string): Promise<Issue[]> {
  const params = new URLSearchParams();
  if (category && category !== 'ALL') params.append('category', category);
  if (status && status !== 'ALL') params.append('status', status);

  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch issues');
  const data = await res.json();
  return Array.isArray(data) ? data.map(normalizeIssue) : [];
}

export async function fetchIssueById(id: string): Promise<Issue> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch issue ${id}`);
  const data = await res.json();
  return normalizeIssue(data);
}

export async function fetchStats(): Promise<any> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/stats`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function submitIssueReport(payload: any): Promise<Issue> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to submit report' }));
    throw new Error(errorData.detail || 'Failed to submit report');
  }
  const data = await res.json();
  return normalizeIssue(data);
}

export async function submitVerification(issueId: string, payload: any): Promise<Issue> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues/${issueId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to verify issue' }));
    throw new Error(errorData.detail || 'Failed to verify issue');
  }
  const data = await res.json();
  return normalizeIssue(data);
}

export async function submitResolutionClaim(issueId: string, payload: { claimant_id: string; notes: string; proof_photo_base64?: string }): Promise<Issue> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues/${issueId}/claim-resolution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to submit resolution claim' }));
    throw new Error(errorData.detail || 'Failed to submit resolution claim');
  }
  const data = await res.json();
  return normalizeIssue(data);
}

export async function fetchCommunityNotes(issueId: string): Promise<CommunityNote[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues/${issueId}/notes`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch community notes');
  return res.json();
}

export async function submitCommunityNote(
  issueId: string,
  payload: {
    text: string;
    stance?: string;
    nullifier_hash?: string;
    lat?: number;
    lon?: number;
    media_urls?: string[];
    participant_badge?: string;
  }
): Promise<CommunityNote> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/issues/${issueId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to submit community note' }));
    throw new Error(errorData.detail || 'Failed to submit community note');
  }
  return res.json();
}

/**
 * Subscribes to the live Real-time Server-Sent Events stream from the FastAPI backend.
 * Automatically reconnects on disconnections.
 */
export function subscribeToRealtimeEvents(onEvent: (eventType: string, data: any) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    const eventSource = new EventSource(`${getApiBaseUrl()}/api/v1/events/stream`);

    eventSource.addEventListener('ISSUE_CREATED', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('ISSUE_CREATED', data);
      } catch (err) {
        console.error('Error parsing ISSUE_CREATED event', err);
      }
    });

    eventSource.addEventListener('ISSUE_VERIFIED', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('ISSUE_VERIFIED', data);
      } catch (err) {
        console.error('Error parsing ISSUE_VERIFIED event', err);
      }
    });

    eventSource.addEventListener('NOTE_ADDED', (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent('NOTE_ADDED', data);
      } catch (err) {
        console.error('Error parsing NOTE_ADDED event', err);
      }
    });

    eventSource.onerror = () => {
      console.warn('Realtime event stream reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  } catch (err) {
    console.warn('SSE not supported or failed to connect:', err);
    return () => {};
  }
}

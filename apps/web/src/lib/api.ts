export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface TimelineEvent {
  id: string;
  event_type: string;
  created_at: string | number;
  from_status?: string;
  to_status?: string;
  event_payload: Record<string, any>;
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
  last_activity_at?: string | number;
  timeline: TimelineEvent[];
}

export async function fetchIssues(category?: string, status?: string): Promise<Issue[]> {
  const params = new URLSearchParams();
  if (category && category !== 'ALL') params.append('category', category);
  if (status && status !== 'ALL') params.append('status', status);

  const res = await fetch(`${API_BASE_URL}/api/v1/issues?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch issues');
  return res.json();
}

export async function fetchIssueById(id: string): Promise<Issue> {
  const res = await fetch(`${API_BASE_URL}/api/v1/issues/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch issue ${id}`);
  return res.json();
}

export async function fetchStats(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/stats`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function submitIssueReport(payload: any): Promise<Issue> {
  const res = await fetch(`${API_BASE_URL}/api/v1/issues/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to submit report' }));
    throw new Error(errorData.detail || 'Failed to submit report');
  }
  return res.json();
}

export async function submitVerification(issueId: string, payload: any): Promise<Issue> {
  const res = await fetch(`${API_BASE_URL}/api/v1/issues/${issueId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to verify issue' }));
    throw new Error(errorData.detail || 'Failed to verify issue');
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
    const eventSource = new EventSource(`${API_BASE_URL}/api/v1/events/stream`);

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

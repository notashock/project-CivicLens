import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterIssues,
  getStatusPresentation,
  calculateConsensus,
  computeFeedSummary,
  normalizeIssue,
  getLifecycleStage,
  type FeedIssue,
} from '../src/lib/issue-feed-model.ts';

test('Tracer Bullet: filterIssues correctly filters by category and search term', () => {
  const mockIssues: FeedIssue[] = [
    {
      id: 'CT-ROAD-39J49282KJ',
      digipin_code: '39J49282KJ',
      category: 'ROAD_HAZARD',
      status: 'COMMUNITY_CORROBORATED',
      description_neutral: 'Large hazardous pothole on outer ring road',
      jurisdiction_authority: 'BBMP',
      verified_confirm_count: 5,
      verified_dispute_count: 0,
      lat: 12.9716,
      lon: 77.5946,
      created_at: new Date().toISOString(),
    },
    {
      id: 'CT-DRAI-88K21938AA',
      digipin_code: '88K21938AA',
      category: 'DRAINAGE_WATER',
      status: 'ESCALATED',
      description_neutral: 'Broken sewage pipeline overflow',
      jurisdiction_authority: 'BWSSB',
      verified_confirm_count: 2,
      verified_dispute_count: 1,
      lat: 12.9720,
      lon: 77.5950,
      created_at: new Date().toISOString(),
    },
  ];

  // Category filter
  const roadOnly = filterIssues(mockIssues, { category: 'ROAD_HAZARD', search: '' });
  assert.equal(roadOnly.length, 1);
  assert.equal(roadOnly[0].id, 'CT-ROAD-39J49282KJ');

  // Search by DIGIPIN
  const digipinSearch = filterIssues(mockIssues, { category: 'ALL', search: '88K2' });
  assert.equal(digipinSearch.length, 1);
  assert.equal(digipinSearch[0].id, 'CT-DRAI-88K21938AA');

  // Search by description case-insensitive
  const descSearch = filterIssues(mockIssues, { category: 'ALL', search: 'POTHOLE' });
  assert.equal(descSearch.length, 1);
  assert.equal(descSearch[0].id, 'CT-ROAD-39J49282KJ');

  // No match
  const noMatch = filterIssues(mockIssues, { category: 'ALL', search: 'nonexistent-query' });
  assert.equal(noMatch.length, 0);
});

test('Behavior 2: getStatusPresentation maps statuses and calculateConsensus computes quorum metrics', () => {
  // Status mapping
  const corroborated = getStatusPresentation('COMMUNITY_CORROBORATED');
  assert.equal(corroborated.label, 'Corroborated');
  assert.equal(typeof corroborated.badgeClass, 'string');
  assert.equal(corroborated.isActionable, true);

  const escalated = getStatusPresentation('ESCALATED');
  assert.equal(escalated.label, 'SLA Escalated');

  const resolved = getStatusPresentation('RESOLVED');
  assert.equal(resolved.label, 'Verified & Solved');
  assert.equal(resolved.isActionable, false);

  // Consensus calculation
  const quorum = calculateConsensus(3, 1);
  assert.equal(quorum.totalVotes, 4);
  assert.equal(quorum.confirmPct, 75);
  assert.equal(quorum.disputePct, 25);

  const zeroVotes = calculateConsensus(0, 0);
  assert.equal(zeroVotes.totalVotes, 0);
  assert.equal(zeroVotes.confirmPct, 100);
});

test('Behavior 3: computeFeedSummary aggregates statistics cleanly without component overhead', () => {
  const issues: FeedIssue[] = [
    {
      id: '1',
      digipin_code: 'A',
      category: 'ROAD_HAZARD',
      status: 'ESCALATED',
      description_neutral: '',
      verified_confirm_count: 1,
      verified_dispute_count: 0,
      lat: 0,
      lon: 0,
      created_at: '',
    },
    {
      id: '2',
      digipin_code: 'B',
      category: 'ROAD_HAZARD',
      status: 'COMMUNITY_CORROBORATED',
      description_neutral: '',
      verified_confirm_count: 2,
      verified_dispute_count: 0,
      lat: 0,
      lon: 0,
      created_at: '',
    },
    {
      id: '3',
      digipin_code: 'C',
      category: 'DRAINAGE_WATER',
      status: 'RESOLVED',
      description_neutral: '',
      verified_confirm_count: 4,
      verified_dispute_count: 0,
      lat: 0,
      lon: 0,
      created_at: '',
    },
  ];

  const summary = computeFeedSummary(issues);
  assert.equal(summary.totalRecorded, 3);
  assert.equal(summary.activeCount, 2);
  assert.equal(summary.resolvedCount, 1);
  assert.equal(summary.escalatedCount, 1);
});

test('Behavior 4: normalizeIssue unifies domain model, canonicalizes timestamps, and precomputes presentation metrics at the network seam', () => {
  const rawApiPayload = {
    id: 'CT-ROAD-999',
    digipin_code: '39J49282KJ',
    category: 'ROAD_HAZARD',
    status: 'COMMUNITY_CORROBORATED',
    description_neutral: 'Large pothole on highway',
    verified_confirm_count: 8,
    verified_dispute_count: 2,
    consensus_score: 80,
    created_at: '2026-09-01T12:00:00Z',
  };

  const issue = normalizeIssue(rawApiPayload);

  // Identity & core domain fields
  assert.equal(issue.id, 'CT-ROAD-999');
  assert.equal(issue.category, 'ROAD_HAZARD');
  assert.equal(issue.status, 'COMMUNITY_CORROBORATED');
  assert.equal(issue.digipin_code, '39J49282KJ');

  // Timestamps canonicalized
  assert.equal(issue.first_reported_at, '2026-09-01T12:00:00Z');
  assert.equal(issue.created_at, '2026-09-01T12:00:00Z');

  // Precomputed Presentation & Metrics at Network Seam
  assert.ok(issue.statusPresentation);
  assert.equal(issue.statusPresentation.label, 'Corroborated');
  assert.equal(issue.statusPresentation.isActionable, true);

  assert.ok(issue.consensus);
  assert.equal(issue.consensus.totalVotes, 10);
  assert.equal(issue.consensus.confirmPct, 80);
  assert.equal(issue.consensus.disputePct, 20);

  // Lifecycle stage precomputed
  assert.equal(issue.lifecycleStage, 2);

  // Arrays guaranteed safe
  assert.ok(Array.isArray(issue.evidence_list));
  assert.ok(Array.isArray(issue.timeline));
});

test('Behavior 5: getLifecycleStage maps full issue lifecycle progressions', () => {
  assert.equal(getLifecycleStage('OBSERVATION_LOGGED'), 1);
  assert.equal(getLifecycleStage('REPORTED'), 1);
  assert.equal(getLifecycleStage('COMMUNITY_CORROBORATED'), 2);
  assert.equal(getLifecycleStage('DISPUTED'), 2);
  assert.equal(getLifecycleStage('ESCALATED'), 3);
  assert.equal(getLifecycleStage('ACTION_IN_PROGRESS'), 3);
  assert.equal(getLifecycleStage('AUTHORITY_RESPONSE'), 3);
  assert.equal(getLifecycleStage('RESOLUTION_CLAIMED'), 4);
  assert.equal(getLifecycleStage('COMMUNITY_VERIFIED'), 5);
  assert.equal(getLifecycleStage('RESOLVED'), 5);
});

test('Behavior 6: filterIssues and filterIssuesByBounds correctly filter by spatial map viewport bounds', () => {
  const issues: FeedIssue[] = [
    {
      id: 'ISSUE-IN-BOUNDS',
      digipin_code: '39J49282KJ',
      category: 'ROAD_HAZARD',
      status: 'REPORTED',
      description_neutral: 'Pothole inside downtown area',
      verified_confirm_count: 0,
      verified_dispute_count: 0,
      lat: 12.9716, // In bounds
      lon: 77.5946,
    },
    {
      id: 'ISSUE-OUT-BOUNDS',
      digipin_code: '99X11111XX',
      category: 'DRAINAGE_WATER',
      status: 'REPORTED',
      description_neutral: 'Waterlogging far away in another district',
      verified_confirm_count: 0,
      verified_dispute_count: 0,
      lat: 13.5000, // Out of bounds north
      lon: 77.5946,
    },
  ];

  const bounds = {
    north: 13.0000,
    south: 12.9000,
    east: 77.7000,
    west: 77.5000,
  };

  // 1. Direct bounds filter helper
  const boundedOnly = filterIssues(issues, {
    category: 'ALL',
    search: '',
    bounds,
  });

  assert.equal(boundedOnly.length, 1);
  assert.equal(boundedOnly[0].id, 'ISSUE-IN-BOUNDS');

  // 2. Clear bounds returns all
  const allIssues = filterIssues(issues, {
    category: 'ALL',
    search: '',
    bounds: null,
  });
  assert.equal(allIssues.length, 2);

  // 3. Invalid or out of range coords
  const invalidIssue = {
    id: 'INVALID',
    digipin_code: '',
    category: 'ROAD_HAZARD',
    status: 'REPORTED',
    description_neutral: '',
    verified_confirm_count: 0,
    verified_dispute_count: 0,
    lat: NaN,
    lon: 77.5946,
  };
  const filteredWithNan = filterIssues([invalidIssue], {
    category: 'ALL',
    search: '',
    bounds,
  });
  assert.equal(filteredWithNan.length, 0);
});




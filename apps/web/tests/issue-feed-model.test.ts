import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterIssues,
  getStatusPresentation,
  calculateConsensus,
  computeFeedSummary,
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



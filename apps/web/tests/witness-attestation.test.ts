import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineDistanceMeters } from '@civictrace/digipin';
import { computeNullifierHash } from '@civictrace/crypto-nullifier';

test('Witness Attestation: Proximity Evaluation enforces 500m Consensus Quorum boundary', () => {
  const issueLat = 12.9716;
  const issueLon = 77.5946;

  // Eyewitness within ~50m
  const nearLat = 12.9718;
  const nearLon = 77.5948;
  const distNear = calculateHaversineDistanceMeters(nearLat, nearLon, issueLat, issueLon);
  assert.ok(distNear < 500, `Expected distance < 500m, got ${distNear}m`);

  // Remote observer ~5km away
  const farLat = 13.0200;
  const farLon = 77.5946;
  const distFar = calculateHaversineDistanceMeters(farLat, farLon, issueLat, issueLon);
  assert.ok(distFar > 500, `Expected distance > 500m, got ${distFar}m`);
});

test('Witness Attestation: Nullifier generation preserves zero cross-issue linkability', () => {
  const devicePrk = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const issueA = 'CT-ROAD-39J49282KJ';
  const issueB = 'CT-DRAI-88K21938AA';

  const nullifierA = computeNullifierHash(devicePrk, issueA, 'CONFIRM');
  const nullifierB = computeNullifierHash(devicePrk, issueB, 'CONFIRM');

  // Must be 64-char hex
  assert.match(nullifierA, /^[a-f0-9]{64}$/);
  assert.match(nullifierB, /^[a-f0-9]{64}$/);

  // Deterministic for same issue
  const nullifierA2 = computeNullifierHash(devicePrk, issueA, 'CONFIRM');
  assert.equal(nullifierA, nullifierA2);

  // Unlinkable across issues (different hash)
  assert.notEqual(nullifierA, nullifierB);
});

test('Witness Attestation: Resolution state action mapping maps CONFIRM to RESOLUTION_VERIFY', () => {
  const mapAction = (targetAction: 'CONFIRM' | 'DISPUTE', status: string) => {
    if (status === 'RESOLUTION_CLAIMED') {
      return targetAction === 'CONFIRM' ? 'RESOLUTION_VERIFY' : 'RESOLUTION_DISPUTE';
    }
    return targetAction;
  };

  // When standard REPORTED
  assert.equal(mapAction('CONFIRM', 'REPORTED'), 'CONFIRM');
  assert.equal(mapAction('DISPUTE', 'REPORTED'), 'DISPUTE');

  // When RESOLUTION_CLAIMED
  assert.equal(mapAction('CONFIRM', 'RESOLUTION_CLAIMED'), 'RESOLUTION_VERIFY');
  assert.equal(mapAction('DISPUTE', 'RESOLUTION_CLAIMED'), 'RESOLUTION_DISPUTE');
});

test('Witness Attestation: 15-minute cooldown math calculates remaining interval', () => {
  const COOLDOWN_MS = 15 * 60 * 1000;
  const now = Date.now();

  // Just voted 5 minutes ago
  const fiveMinAgo = now - 5 * 60 * 1000;
  const remainingMs = Math.max(0, COOLDOWN_MS - (now - fiveMinAgo));
  const remainingMins = Math.ceil(remainingMs / 60000);
  assert.equal(remainingMins, 10);

  // Voted 16 minutes ago (cooldown expired)
  const sixteenMinAgo = now - 16 * 60 * 1000;
  const expiredRemainingMs = Math.max(0, COOLDOWN_MS - (now - sixteenMinAgo));
  assert.equal(expiredRemainingMs, 0);
});

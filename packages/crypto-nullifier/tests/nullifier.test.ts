import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNullifierHash,
  createNullifierPayload,
  validateNullifierFormat,
  MemoryNullifierRegistry,
  getOrCreateDevicePrk,
  resetDevicePrkForTesting,
} from '../src/index.js';

test('Deterministic Nullifier Generation for Issue', () => {
  const prk1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const issueId = 'CT-KA-BLR-000421';

  const nullifierConfirm = computeNullifierHash(prk1, issueId, 'CONFIRM');
  const nullifierDispute = computeNullifierHash(prk1, issueId, 'DISPUTE');

  // Both actions produce the same issue-bound nullifier to prevent double-voting
  assert.equal(nullifierConfirm, nullifierDispute);
  assert.equal(nullifierConfirm.length, 64);
  assert.match(nullifierConfirm, /^[a-f0-9]{64}$/);
});

test('Unlinkability across different issues', () => {
  const prk1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const nullifierIssue1 = computeNullifierHash(prk1, 'CT-KA-BLR-000001', 'CONFIRM');
  const nullifierIssue2 = computeNullifierHash(prk1, 'CT-KA-BLR-000002', 'CONFIRM');

  assert.notEqual(nullifierIssue1, nullifierIssue2);
});

test('Anti-Sybil Single-Action Enforcement in Registry (Mutual Exclusivity)', () => {
  const registry = new MemoryNullifierRegistry();
  const prk = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const issueId = 'CT-DL-ND-009182';

  // 1. Participant confirms issue
  const payloadConfirm = createNullifierPayload(prk, issueId, 'CONFIRM');
  const res1 = registry.registerNullifier(payloadConfirm);
  assert.equal(res1.isValid, true);

  // 2. Same participant attempts to dispute the same issue -> BLOCKED
  const payloadDispute = createNullifierPayload(prk, issueId, 'DISPUTE');
  const resDispute = registry.registerNullifier(payloadDispute);
  assert.equal(resDispute.isValid, false);
  assert.equal(resDispute.errorCode, 'DUPLICATE_ACTION');

  // 3. Same participant CAN interact with a DIFFERENT issue
  const payloadDifferentIssue = createNullifierPayload(prk, 'CT-DL-ND-009999', 'CONFIRM');
  const resDifferent = registry.registerNullifier(payloadDifferentIssue);
  assert.equal(resDifferent.isValid, true);
});

test('Persistent Device PRK reusability', () => {
  resetDevicePrkForTesting();
  const prkFirstCall = getOrCreateDevicePrk();
  const prkSecondCall = getOrCreateDevicePrk();

  assert.equal(prkFirstCall, prkSecondCall);
  assert.equal(prkFirstCall.length, 64);
});

test('Replay prevention with timestamp validation', () => {
  const prk = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const oldPayload = {
    issueId: 'CT-KA-BLR-000111',
    actionType: 'CONFIRM' as const,
    nullifierHash: computeNullifierHash(prk, 'CT-KA-BLR-000111', 'CONFIRM'),
    timestamp: Date.now() - 120000,
  };

  const check = validateNullifierFormat(oldPayload, 60000);
  assert.equal(check.isValid, false);
  assert.equal(check.errorCode, 'TIMESTAMP_EXPIRED');
});

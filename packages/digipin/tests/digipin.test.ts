import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeDigipin,
  decodeDigipin,
  formatDigipin,
  isWithinProximityRadius,
  getDigipinHierarchies,
  deriveIssueId,
} from '../dist/index.js';

test('DIGIPIN Encoding & Decoding Roundtrip - Bengaluru', () => {
  const lat = 12.9716;
  const lon = 77.5946;

  const digipin = encodeDigipin(lat, lon, 10);
  assert.equal(digipin.length, 10);
  assert.match(digipin, /^[2-9CFJKMPRW]{10}$/);

  const formatted = formatDigipin(digipin);
  assert.match(formatted, /^[2-9CFJKMPRW]{2}-[2-9CFJKMPRW]{2}-[2-9CFJKMPRW]{2}-[2-9CFJKMPRW]{4}$/);

  const decoded = decodeDigipin(digipin);
  assert.ok(Math.abs(decoded.centroid.lat - lat) < 0.0001);
  assert.ok(Math.abs(decoded.centroid.lon - lon) < 0.0001);
  assert.equal(decoded.precision, 10);
});

test('DIGIPIN Encoding & Decoding - New Delhi', () => {
  const lat = 28.6139;
  const lon = 77.209;

  const digipin = encodeDigipin(lat, lon);
  const decoded = decodeDigipin(digipin);
  assert.ok(Math.abs(decoded.centroid.lat - lat) < 0.0001);
  assert.ok(Math.abs(decoded.centroid.lon - lon) < 0.0001);
});

test('DIGIPIN Hierarchies extraction', () => {
  const raw = '38CFJKMPRW';
  const hierarchies = getDigipinHierarchies(raw);
  assert.equal(hierarchies.l10, '38CFJKMPRW');
  assert.equal(hierarchies.l8, '38CFJKMP');
  assert.equal(hierarchies.l6, '38CFJK');
  assert.equal(hierarchies.l4, '38CF');
  assert.equal(hierarchies.l2, '38');
});

test('Local Proximity Validation', () => {
  const issueLat = 12.9716;
  const issueLon = 77.5946;
  const digipin = encodeDigipin(issueLat, issueLon);

  // 10 meters away
  const closeLat = 12.97165;
  const closeLon = 77.59465;
  const closeCheck = isWithinProximityRadius(closeLat, closeLon, digipin, 50);
  assert.equal(closeCheck.isLocal, true);
  assert.ok(closeCheck.distanceMeters < 50);

  // 2 km away
  const farLat = 12.9900;
  const farLon = 77.5946;
  const farCheck = isWithinProximityRadius(farLat, farLon, digipin, 100);
  assert.equal(farCheck.isLocal, false);
  assert.ok(farCheck.distanceMeters > 1000);
});

test('Out of bounds error handling', () => {
  assert.throws(() => encodeDigipin(50.0, 77.0), /Latitude 50 is outside India/);
  assert.throws(() => encodeDigipin(12.0, 120.0), /Longitude 120 is outside India/);
  assert.throws(() => decodeDigipin('INVALID123'), /Invalid DIGIPIN character/);
});

test('Deterministic IssueID derivation at intake seam', () => {
  const result = deriveIssueId(12.9716, 77.5946, 'ROAD_HAZARD');
  assert.equal(result.issueId.startsWith('CT-ROAD-'), true);
  assert.equal(result.digipin.length, 10);
  assert.equal(result.authority, 'Bruhat Bengaluru Mahanagara Palike (BBMP)');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndFormatNarrative,
  pixelateRegions,
  StructuredObservation,
} from '../src/index.js';

test('Factual Narrative Formatter - Valid Objective Report', () => {
  const validObs: StructuredObservation = {
    category: 'ROAD_HAZARD',
    observedCondition: 'Deep asphalt depression 2m wide',
    landmark: 'Opposite Metro Pillar 142, Hosur Road',
    impactDurationDays: 21,
  };

  const res = validateAndFormatNarrative(validObs);
  assert.equal(res.isNeutral, true);
  assert.equal(res.violations.length, 0);
  assert.match(res.sanitizedNarrative!, /Physical condition observed: Deep asphalt depression 2m wide near Opposite Metro Pillar 142, Hosur Road\. Condition observed unresolved for ~21 days\./);
});

test('Rejects Defamatory / Political Allegations', () => {
  const politicalObs: StructuredObservation = {
    category: 'ROAD_HAZARD',
    observedCondition: 'Corrupt corporator stole money and left road broken',
    landmark: 'Ward 150',
  };

  const res = validateAndFormatNarrative(politicalObs);
  assert.equal(res.isNeutral, false);
  assert.ok(res.violations.length > 0);
  assert.match(res.violations[0]!, /CivicTrace records physical conditions only/);
});

test('Rejects Phone Numbers and PII', () => {
  const piiObs: StructuredObservation = {
    category: 'DRAINAGE_WATER',
    observedCondition: 'Sewage overflow call me at 9876543210',
    landmark: 'Corner house',
  };

  const res = validateAndFormatNarrative(piiObs);
  assert.equal(res.isNeutral, false);
  assert.match(res.violations[0]!, /personal identifiable information/);
});

test('Canvas Pixelation modifies specified bounding box buffer', () => {
  const width = 32;
  const height = 32;
  const buffer = new Uint8ClampedArray(width * height * 4);

  // Fill with distinct test color
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 200;     // R
    buffer[i + 1] = 100; // G
    buffer[i + 2] = 50;  // B
    buffer[i + 3] = 255; // A
  }

  // Set a bright spot inside the blur region
  buffer[0] = 255;
  buffer[1] = 255;
  buffer[2] = 255;

  pixelateRegions(
    buffer,
    width,
    height,
    [{ x: 0, y: 0, width: 0.5, height: 0.5 }],
    16
  );

  // Assert that pixels in the region were averaged/pixelated
  assert.ok(buffer[0]! < 255);
});

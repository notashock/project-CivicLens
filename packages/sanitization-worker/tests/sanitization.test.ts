import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndFormatNarrative,
  checkTextNeutrality,
  pixelateRegions,
  sanitizeMedia,
  sanitizeObservation,
  calculateFitDimensions,
  DEFAULT_PRIVACY_REGIONS,
  type StructuredObservation,
} from '../dist/index.js';

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

test('calculateFitDimensions scales proportionally within bounds', () => {
  // Wide image: 1600x1200 -> max 800 -> 800x600
  const fitWide = calculateFitDimensions(1600, 1200, 800, 800);
  assert.equal(fitWide.width, 800);
  assert.equal(fitWide.height, 600);

  // Tall image: 600x1800 -> max 800 -> 267x800
  const fitTall = calculateFitDimensions(600, 1800, 800, 800);
  assert.equal(fitTall.height, 800);
  assert.ok(fitTall.width < 300);

  // Small image does not upscale
  const fitSmall = calculateFitDimensions(400, 300, 800, 800);
  assert.equal(fitSmall.width, 400);
  assert.equal(fitSmall.height, 300);
});

test('sanitizeMedia applies peripheral privacy regions in headless buffer mode', async () => {
  const width = 64;
  const height = 64;
  const pixelData = new Uint8ClampedArray(width * height * 4);

  // Set distinct pixels in the upper peripheral region (e.g. index 0)
  pixelData[0] = 255;
  pixelData[1] = 255;
  pixelData[2] = 255;
  pixelData[3] = 255;

  const result = await sanitizeMedia(null, {
    rawBufferInput: { pixelData, width, height },
    preBlur: true,
  });

  assert.equal(result.isSanitized, true);
  assert.ok(result.dataUrl.startsWith('data:image/webp;base64,'));
  assert.equal(result.width, 64);
  assert.equal(result.height, 64);
  assert.ok(DEFAULT_PRIVACY_REGIONS.length === 2);
});

test('sanitizeObservation executes full unified sanitization pipeline', async () => {
  const width = 32;
  const height = 32;
  const pixelData = new Uint8ClampedArray(width * height * 4);

  const observation: StructuredObservation = {
    category: 'SOLID_WASTE',
    observedCondition: 'Overflowing municipal dumpster spilling onto pedestrian walkway',
    landmark: 'Beside Government High School, 5th Main',
    impactDurationDays: 4,
  };

  const result = await sanitizeObservation({
    observation,
    rawBufferInput: { pixelData, width, height },
    preBlurEnabled: true,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.violations.length, 0);
  assert.ok(result.sanitizedNarrative?.includes('Physical condition observed'));
  assert.ok(result.sanitizedNarrative?.includes('Government High School'));
  assert.ok(result.mediaDataBase64?.startsWith('data:image/webp;base64,'));
  assert.equal(result.mediaMetadata?.isSanitized, true);
});

test('sanitizeObservation rejects non-neutral text and returns violations', async () => {
  const observation: StructuredObservation = {
    category: 'SOLID_WASTE',
    observedCondition: 'MLA and corporator are useless thieves doing corruption',
    landmark: 'Near town hall',
  };

  const result = await sanitizeObservation({
    observation,
  });

  assert.equal(result.isValid, false);
  assert.ok(result.violations.length > 0);
  assert.equal(result.sanitizedNarrative, undefined);
  assert.equal(result.mediaDataBase64, undefined);
});

test('checkTextNeutrality validates political parties, offices, and defamatory accusations', () => {
  // Neutral
  const neutral = checkTextNeutrality('Deep pothole on main road causing skidding');
  assert.equal(neutral.isValid, true);

  // Political parties
  const party = checkTextNeutrality('BJP and Congress workers protested near pothole');
  assert.equal(party.isValid, false);
  assert.ok(party.warning?.includes('Neutrality Alert'));

  // Defamatory accusation
  const defamatory = checkTextNeutrality('Local contractor is a corrupt thief who stole money');
  assert.equal(defamatory.isValid, false);
  assert.ok(defamatory.warning?.includes('Neutrality Alert'));
});


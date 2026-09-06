import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTextNeutrality } from '@civictrace/sanitization-worker';

test('Neutrality Checker: permits neutral physical infrastructure descriptions', () => {
  const input1 = 'Deep pothole on 100ft road near water tank causing vehicular skidding.';
  const res1 = checkTextNeutrality(input1);
  assert.equal(res1.isValid, true);
  assert.equal(res1.warning, undefined);

  const input2 = 'Broken storm water drain overflow with stagnant water.';
  const res2 = checkTextNeutrality(input2);
  assert.equal(res2.isValid, true);
});

test('Neutrality Checker: rejects political party acronyms and names', () => {
  const inputs = [
    'The BJP office road is broken',
    'Congress party workers protested here',
    'AAP volunteer reported this pothole',
    'TMC banner fell on the street',
    'CPI-M rally caused drain blockage',
  ];

  for (const text of inputs) {
    const res = checkTextNeutrality(text);
    assert.equal(res.isValid, false, `Expected "${text}" to fail neutrality check`);
    assert.ok(res.warning?.includes('Neutrality Alert'));
  }
});

test('Neutrality Checker: rejects political office titles and prominent leaders', () => {
  const inputs = [
    'MLA visited this site yesterday',
    'Local MP promised to fix this',
    'Corporator Sharma ignored our complaints',
    'Councillor did not approve asphalt work',
    'Road built under Rahul Gandhi scheme is cracked',
    'Modi poster was torn down here',
  ];

  for (const text of inputs) {
    const res = checkTextNeutrality(text);
    assert.equal(res.isValid, false, `Expected "${text}" to fail neutrality check`);
  }
});

test('Neutrality Checker: rejects personal naming honorifics', () => {
  const inputs = [
    'Shri Ramesh Kumar laid the pipeline poorly',
    'Mr. Sharma refused to repair the curb',
    'Dr. Patil complained about the stench',
  ];

  for (const text of inputs) {
    const res = checkTextNeutrality(text);
    assert.equal(res.isValid, false, `Expected "${text}" to fail neutrality check`);
  }
});

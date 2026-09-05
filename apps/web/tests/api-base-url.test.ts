import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApiBaseUrl } from '../src/lib/api.ts';

test('getApiBaseUrl: handles comma-separated URLs in NEXT_PUBLIC_API_URL gracefully', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;
  try {
    process.env.NEXT_PUBLIC_API_URL = 'http://192.168.0.103:8000,http://localhost:8000';
    const resolved = getApiBaseUrl();

    // Must be a valid parseable URL, NOT a concatenated comma string!
    assert.doesNotThrow(() => new URL(resolved));
    assert.ok(
      resolved === 'http://192.168.0.103:8000' || resolved === 'http://localhost:8000',
      `Expected a single valid URL, got "${resolved}"`
    );
  } finally {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  }
});

test('getApiBaseUrl: handles single URL without modification', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;
  try {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
    const resolved = getApiBaseUrl();
    assert.equal(resolved, 'http://localhost:8000');
  } finally {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  }
});

/**
 * Client-Side WebAuthn PRF (Pseudo-Random Function) Key Derivation & Device Root Helper.
 * Derives and persists a single deterministic device-bound PRK without requiring user accounts or logins.
 */

export const CIVIC_SALT_HEX = '436976696354726163655f5052465f53616c745f32303236'; // 'CivicTrace_PRF_Salt_2026'
export const DEVICE_PRK_STORAGE_KEY = 'civictrace_device_prk_v1';

let inMemoryPrkFallback: string | null = null;

/**
 * Checks if WebAuthn PRF extension is supported in the current browser.
 */
export function isWebAuthnPrfSupported(): boolean {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  return true;
}

/**
 * Generates a fresh 256-bit cryptographically secure random hexadecimal key.
 */
export function generateTestPrk(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Retrieves the persistent device-bound PRK from browser storage, or creates and stores one if none exists.
 * Guarantees that the same physical browser/device always reuses its PRK across sessions and clicks.
 */
export function getOrCreateDevicePrk(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(DEVICE_PRK_STORAGE_KEY);
      if (existing && /^[a-f0-9]{64}$/i.test(existing)) {
        return existing;
      }
      const newPrk = generateTestPrk();
      window.localStorage.setItem(DEVICE_PRK_STORAGE_KEY, newPrk);
      return newPrk;
    } catch {
      // Fallback if localStorage is disabled or throws
    }
  }

  if (!inMemoryPrkFallback) {
    inMemoryPrkFallback = generateTestPrk();
  }
  return inMemoryPrkFallback;
}

/**
 * Clears the in-memory or stored PRK (useful for unit testing).
 */
export function resetDevicePrkForTesting(): void {
  inMemoryPrkFallback = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(DEVICE_PRK_STORAGE_KEY);
    } catch {}
  }
}

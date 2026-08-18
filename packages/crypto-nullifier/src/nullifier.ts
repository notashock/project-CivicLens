import { ActionType, NullifierPayload, VerificationResult } from './types';

// Pure TypeScript SHA-256 and HMAC-SHA-256 implementation with strict null-safety
function sha256(ascii: string): Uint8Array {
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < asciiBitLength; i += 8) {
    const idx = i >> 5;
    words[idx] = (words[idx] || 0) | ((ascii.charCodeAt(i / 8) & 0xff) << (24 - (i % 32)));
  }

  const padIdx = asciiBitLength >> 5;
  words[padIdx] = (words[padIdx] || 0) | (0x80 << (24 - (asciiBitLength % 32)));
  const lenIdx = (((asciiBitLength + 64) >> 9) << 4) + 15;
  words[lenIdx] = asciiBitLength;

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    while (w.length < 16) w.push(0);
    const oldHash = hash.slice(0);

    for (let j = 0; j < 64; j++) {
      if (j >= 16) {
        const w15 = w[j - 15] || 0;
        const w2 = w[j - 2] || 0;
        const s0 =
          ((w15 >>> 7) | (w15 << 25)) ^
          ((w15 >>> 18) | (w15 << 14)) ^
          (w15 >>> 3);
        const s1 =
          ((w2 >>> 17) | (w2 << 15)) ^
          ((w2 >>> 19) | (w2 << 13)) ^
          (w2 >>> 10);
        w[j] = ((w[j - 16] || 0) + s0 + (w[j - 7] || 0) + s1) | 0;
      }

      const h4 = hash[4] || 0;
      const h5 = hash[5] || 0;
      const h6 = hash[6] || 0;
      const h7 = hash[7] || 0;
      const h0 = hash[0] || 0;
      const h1 = hash[1] || 0;
      const h2 = hash[2] || 0;
      const h3 = hash[3] || 0;
      const kj = k[j] || 0;
      const wj = w[j] || 0;

      const S1 =
        ((h4 >>> 6) | (h4 << 26)) ^
        ((h4 >>> 11) | (h4 << 21)) ^
        ((h4 >>> 25) | (h4 << 7));
      const ch = (h4 & h5) ^ (~h4 & h6);
      const temp1 = (h7 + S1 + ch + kj + wj) | 0;
      const S0 =
        ((h0 >>> 2) | (h0 << 30)) ^
        ((h0 >>> 13) | (h0 << 19)) ^
        ((h0 >>> 22) | (h0 << 10));
      const maj = (h0 & h1) ^ (h0 & h2) ^ (h1 & h2);
      const temp2 = (S0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        h0,
        h1,
        h2,
        (h3 + temp1) | 0,
        h4,
        h5,
        h6,
      ];
    }

    for (let j = 0; j < 8; j++) {
      hash[j] = ((hash[j] || 0) + (oldHash[j] || 0)) | 0;
    }
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const val = hash[i] || 0;
    out[i * 4] = (val >>> 24) & 0xff;
    out[i * 4 + 1] = (val >>> 16) & 0xff;
    out[i * 4 + 2] = (val >>> 8) & 0xff;
    out[i * 4 + 3] = val & 0xff;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Computes deterministic HMAC-SHA256 Nullifier from PRK and IssueID.
 * The nullifier is strictly issue-bound to enforce mutual exclusivity across all action types
 * (a participant cannot both confirm and dispute the same issue).
 */
export function computeNullifierHash(
  prkHexOrBuffer: string | Uint8Array,
  issueId: string,
  _actionType?: ActionType
): string {
  const keyBytes = typeof prkHexOrBuffer === 'string'
    ? hexToBytes(prkHexOrBuffer)
    : prkHexOrBuffer;

  const blockSize = 64;
  let key = new Uint8Array(blockSize);
  if (keyBytes.length > blockSize) {
    const hashed = sha256(String.fromCharCode(...keyBytes));
    key.set(hashed);
  } else {
    key.set(keyBytes);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = (key[i] || 0) ^ 0x5c;
    iKeyPad[i] = (key[i] || 0) ^ 0x36;
  }

  // Issue-bound nullifier message
  const message = `issue:${issueId}`;
  const innerInput = String.fromCharCode(...iKeyPad) + message;
  const innerHash = sha256(innerInput);

  const outerInput = String.fromCharCode(...oKeyPad) + String.fromCharCode(...innerHash);
  const finalHash = sha256(outerInput);

  return bytesToHex(finalHash);
}

export function createNullifierPayload(
  prkHexOrBuffer: string | Uint8Array,
  issueId: string,
  actionType: ActionType
): NullifierPayload {
  const nullifierHash = computeNullifierHash(prkHexOrBuffer, issueId, actionType);
  return {
    issueId,
    actionType,
    nullifierHash,
    timestamp: Date.now(),
  };
}

export function validateNullifierFormat(payload: NullifierPayload, maxClockSkewMs: number = 60000): VerificationResult {
  if (!payload.issueId || typeof payload.issueId !== 'string') {
    return { isValid: false, errorCode: 'INVALID_HASH', message: 'Missing or invalid issueId' };
  }

  if (!/^[a-f0-9]{64}$/i.test(payload.nullifierHash)) {
    return { isValid: false, errorCode: 'INVALID_HASH', message: 'Nullifier hash must be a valid 64-character hex SHA-256' };
  }

  const now = Date.now();
  if (Math.abs(now - payload.timestamp) > maxClockSkewMs) {
    return { isValid: false, errorCode: 'TIMESTAMP_EXPIRED', message: 'Action timestamp outside acceptable window (potential replay attack)' };
  }

  return { isValid: true, message: 'Valid nullifier payload' };
}

import { NullifierPayload, VerificationResult } from './types';
import { validateNullifierFormat } from './nullifier';

export class MemoryNullifierRegistry {
  private registeredNullifiers = new Set<string>();

  public registerNullifier(payload: NullifierPayload): VerificationResult {
    const formatCheck = validateNullifierFormat(payload);
    if (!formatCheck.isValid) {
      return formatCheck;
    }

    const key = `${payload.issueId}:${payload.nullifierHash}`;
    if (this.registeredNullifiers.has(key)) {
      return {
        isValid: false,
        errorCode: 'DUPLICATE_ACTION',
        message: 'Action already recorded for this device on this issue',
      };
    }

    this.registeredNullifiers.add(key);
    return {
      isValid: true,
      message: 'Nullifier verified and registered',
    };
  }

  public hasNullifier(issueId: string, nullifierHash: string): boolean {
    return this.registeredNullifiers.has(`${issueId}:${nullifierHash}`);
  }

  public clear(): void {
    this.registeredNullifiers.clear();
  }
}

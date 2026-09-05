export type ActionType =
  | 'REPORT'
  | 'CONFIRM'
  | 'DISPUTE'
  | 'RESOLUTION_VERIFY'
  | 'RESOLUTION_DISPUTE'
  | 'PERSPECTIVE'
  | 'NEUTRAL';

export interface NullifierPayload {
  issueId: string;
  actionType: ActionType;
  nullifierHash: string; // 64-char hex SHA256
  timestamp: number;
}

export interface VerificationResult {
  isValid: boolean;
  errorCode?: 'INVALID_HASH' | 'TIMESTAMP_EXPIRED' | 'DUPLICATE_ACTION';
  message: string;
}

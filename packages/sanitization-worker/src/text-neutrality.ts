export interface StructuredObservation {
  category:
    | 'ROAD_HAZARD'
    | 'DRAINAGE_WATER'
    | 'SOLID_WASTE'
    | 'ELECTRICAL_HAZARD'
    | 'PUBLIC_INFRASTRUCTURE'
    | 'ENVIRONMENTAL_VIOLATION';
  observedCondition: string; // e.g. "Pothole approx 1.5m wide and 15cm deep"
  landmark: string;          // e.g. "Opposite 4th Cross Bus Shelter, Outer Ring Road"
  impactDurationDays?: number; // e.g. 14
}

export interface ModerationResult {
  isNeutral: boolean;
  sanitizedNarrative?: string;
  violations: string[];
}

// Prohibited political, defamatory, and personal accusation tokens
const DEFAMATORY_AND_POLITICAL_PATTERNS = [
  /\b(mla|mp|corporator|minister|councillor|chief minister|pm|bjp|congress|aap|tmc|dmk|aiadmk)\b/i,
  /\b(corrupt|bribe|thief|scam|stole|fraud|criminal|loot|embezzle|crook)\b/i,
  /\b(arrest|jail|police complaint against|sue)\b/i,
  /\b(idiot|fool|useless govt|dog|bastard|scoundrel)\b/i,
];

// PII patterns: Phone numbers, Emails, Aadhaar-like 12-digit numbers
const PII_PATTERNS = [
  /\b\d{10}\b/,                    // 10-digit phone
  /\b\d{4}\s\d{4}\s\d{4}\b/,       // 12-digit Aadhaar
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
];

/**
 * Validates and formats a structured civic observation into an objective, factual narrative.
 */
export function validateAndFormatNarrative(obs: StructuredObservation): ModerationResult {
  const violations: string[] = [];
  const rawText = `${obs.observedCondition} ${obs.landmark}`;

  // 1. Check PII
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(rawText)) {
      violations.push('Text contains personal identifiable information (phone number, email, or ID number)');
      break;
    }
  }

  // 2. Check Defamatory / Political terms
  for (const pattern of DEFAMATORY_AND_POLITICAL_PATTERNS) {
    if (pattern.test(rawText)) {
      violations.push('CivicTrace records physical conditions only. Please remove references to politicians, government officials, or allegations.');
      break;
    }
  }

  // 3. Minimum description check
  if (!obs.observedCondition || obs.observedCondition.trim().length < 5) {
    violations.push('Observed physical condition must be at least 5 characters');
  }
  if (!obs.landmark || obs.landmark.trim().length < 3) {
    violations.push('Physical landmark must be specified');
  }

  if (violations.length > 0) {
    return {
      isNeutral: false,
      violations,
    };
  }

  // Generate canonical factual narrative
  const daysStr = obs.impactDurationDays && obs.impactDurationDays > 0
    ? ` Condition observed unresolved for ~${obs.impactDurationDays} days.`
    : '';

  const sanitizedNarrative = `Physical condition observed: ${obs.observedCondition.trim()} near ${obs.landmark.trim()}.${daysStr}`.trim();

  return {
    isNeutral: true,
    sanitizedNarrative,
    violations: [],
  };
}

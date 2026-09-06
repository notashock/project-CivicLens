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

export interface NeutralityCheckResult {
  isValid: boolean;
  matchedTerm?: string;
  warning?: string;
}

// Political parties, alliances, and coalitions
export const POLITICAL_PATTERNS = [
  /\b(bjp|bharatiya\s+janata(\s+party)?)\b/i,
  /\b(inc|congress(\s+party)?|indian\s+national\s+congress)\b/i,
  /\b(aap|aam\s+aadmi(\s+party)?)\b/i,
  /\b(tmc|trinamool(\s+congress)?)\b/i,
  /\b(dmk|aiadmk|dravida\s+munnetra)\b/i,
  /\b(shiv\s+sena|uddhav\s+sena)\b/i,
  /\b(ncp|nationalist\s+congress)\b/i,
  /\b(bsp|bahujan\s+samaj)\b/i,
  /\b(sp|samajwadi(\s+party)?)\b/i,
  /\b(cpi|cpim|cpm|communist\s+party)\b/i,
  /\b(jdu|janata\s+dal|rjd|rashtriya\s+janata)\b/i,
  /\b(tdp|telugu\s+desam|ysrcp|ysr\s+congress)\b/i,
  /\b(trs|brs|bharat\s+rashtra)\b/i,
  /\b(nda|upa|i\.?n\.?d\.?i\.?a\s+alliance)\b/i,
  /\b(mla|mp|member\s+of\s+parliament|member\s+of\s+legislative)\b/i,
  /\b(corporator|councillor|councilor|ward\s+member|mayor)\b/i,
  /\b(minister|chief\s+minister|\bcm\b|\bpm\b|prime\s+minister)\b/i,
  /\b(neta|netaji|party\s+worker|karyakarta|pradhan|sarpanch)\b/i,
  /\b(modi|narendra\s+modi|rahul\s+gandhi|sonia\s+gandhi|arvind\s+kejriwal|kejriwal)\b/i,
  /\b(mamata|stalin|yogi|adityanath|siddaramaiah|shivakumar|fadnavis|thackeray|nitish|akhilesh|mayawati)\b/i,
  /\b(shri|smt|shrimati|mr\.?|mrs\.?|dr\.?|hon'?ble)\s+[a-z]{3,}\b/i,
];

// Defamatory, abusive, and personal accusation tokens
export const DEFAMATORY_PATTERNS = [
  /\b(corrupt|bribe|thief|scam|stole|fraud|criminal|loot|embezzle|crook)\b/i,
  /\b(arrest|jail|police complaint against|sue)\b/i,
  /\b(idiot|fool|useless govt|dog|bastard|scoundrel)\b/i,
];

// PII patterns: Phone numbers, Emails, Aadhaar-like 12-digit numbers
export const PII_PATTERNS = [
  /\b\d{10}\b/,                                      // 10-digit phone
  /\b\d{4}\s\d{4}\s\d{4}\b/,                         // 12-digit Aadhaar
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
];

/**
 * Client-Side Real-Time Neutrality & Defamation Checker.
 * Implements ADR 0006 and ADR 0012 to provide immediate, non-blocking feedback
 * as participants type in report narratives or community notes.
 */
export function checkTextNeutrality(text: string): NeutralityCheckResult {
  if (!text || !text.trim()) {
    return { isValid: true };
  }

  // Check political patterns
  for (const pattern of POLITICAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        isValid: false,
        matchedTerm: match[0].trim(),
        warning: `Neutrality Alert: Reference to political entity or figure "${match[0].trim()}" is prohibited. Submissions must describe physical infrastructure conditions only.`,
      };
    }
  }

  // Check defamatory patterns
  for (const pattern of DEFAMATORY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        isValid: false,
        matchedTerm: match[0].trim(),
        warning: `Neutrality Alert: Defamatory or accusatory term "${match[0].trim()}" is prohibited. Submissions must describe observable physical conditions only.`,
      };
    }
  }

  return { isValid: true };
}

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

  // 2. Check Political terms
  for (const pattern of POLITICAL_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      violations.push(`CivicTrace records physical conditions only. Prohibited reference to: "${match[0].trim()}".`);
      break;
    }
  }

  // 3. Check Defamatory terms
  for (const pattern of DEFAMATORY_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) {
      violations.push(`CivicTrace records physical conditions only. Defamatory language detected: "${match[0].trim()}".`);
      break;
    }
  }

  // 4. Minimum description check
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

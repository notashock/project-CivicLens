/**
 * Client-Side Real-Time Neutrality & Defamation Checker.
 * Implements ADR 0006 and ADR 0012 to provide immediate, non-blocking feedback
 * as participants type in report narratives or community notes.
 */

const POLITICAL_PATTERNS = [
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

export interface NeutralityCheckResult {
  isValid: boolean;
  matchedTerm?: string;
  warning?: string;
}

export function checkTextNeutrality(text: string): NeutralityCheckResult {
  if (!text || !text.trim()) {
    return { isValid: true };
  }

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

  return { isValid: true };
}

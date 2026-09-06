'use client';

import React, { useState } from 'react';
import { ShieldCheck, CheckCheck, Clock } from 'lucide-react';
import { Issue, EvidenceMedia } from '@/lib/api';

interface EvidenceGalleryProps {
  issue: Issue;
  isResolutionState: boolean;
  rectificationEvidence?: EvidenceMedia | null;
  initialIntakeEvidence?: EvidenceMedia | null;
  rectificationClaimEvent?: any;
}

export function EvidenceGallery({
  issue,
  isResolutionState,
  rectificationEvidence,
  initialIntakeEvidence,
  rectificationClaimEvent,
}: EvidenceGalleryProps) {
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState<number>(0);
  const [evidenceTab, setEvidenceTab] = useState<'AFTER' | 'BEFORE'>('AFTER');

  return (
    <div className="space-y-3">
      {/* RECTIFICATION SHOWCASE (When fix is claimed or verified) */}
      {isResolutionState && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9FA] border-2 border-[#CEEAD6] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#0F9D58] text-white flex items-center justify-center">
                <CheckCheck className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#0D652D]">
                {issue.status === 'RESOLUTION_CLAIMED' ? 'Fix Reported with Photo Proof' : 'Issue Verified as Solved'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#0D652D]">
              {rectificationClaimEvent?.event_payload?.claimant || 'Public Participant'}
            </span>
          </div>

          {/* Rectification Notes */}
          {rectificationClaimEvent?.event_payload?.notes && (
            <p className="text-xs text-[#1F1F1F] bg-white p-2.5 rounded-xl border border-[#CEEAD6] leading-relaxed">
              <strong>Repair Summary: </strong>
              {rectificationClaimEvent.event_payload.notes}
            </p>
          )}

          {/* Before vs After Photo Tabs / Switcher */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 border-b border-[#E0E2EC] pb-2">
              <button
                type="button"
                onClick={() => setEvidenceTab('AFTER')}
                className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                  evidenceTab === 'AFTER'
                    ? 'bg-[#0F9D58] text-white shadow-sm'
                    : 'bg-white text-[#5F6368] border border-[#E0E2EC] hover:bg-[#F1F3F4]'
                }`}
              >
                ✓ Rectification Proof (After)
              </button>
              {initialIntakeEvidence && (
                <button
                  type="button"
                  onClick={() => setEvidenceTab('BEFORE')}
                  className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                    evidenceTab === 'BEFORE'
                      ? 'bg-[#1F1F1F] text-white shadow-sm'
                      : 'bg-white text-[#5F6368] border border-[#E0E2EC] hover:bg-[#F1F3F4]'
                  }`}
                >
                  Original Problem (Before)
                </button>
              )}
            </div>

            {/* Display Chosen Photo */}
            <div className="relative overflow-hidden rounded-xl border border-[#E0E2EC] bg-[#1F1F1F] flex items-center justify-center min-h-[220px] max-h-[360px]">
              {evidenceTab === 'AFTER' && rectificationEvidence ? (
                <img
                  src={rectificationEvidence.media_url}
                  alt="Rectification evidence photo"
                  className="w-full h-full object-contain max-h-[360px]"
                />
              ) : initialIntakeEvidence ? (
                <img
                  src={initialIntakeEvidence.media_url}
                  alt="Original reported issue photo"
                  className="w-full h-full object-contain max-h-[360px]"
                />
              ) : (
                <div className="text-zinc-400 text-xs py-10">No photo available</div>
              )}

              {/* Badge Overlay */}
              <div className="absolute top-2 left-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${
                    evidenceTab === 'AFTER' ? 'bg-[#0F9D58] text-white' : 'bg-black/70 text-white'
                  }`}
                >
                  {evidenceTab === 'AFTER' ? 'Proof of Fix (On-Site Photo)' : 'Original Complaint'}
                </span>
              </div>
            </div>
          </div>

          {/* Community Inspection Callout */}
          {issue.status === 'RESOLUTION_CLAIMED' && (
            <div className="text-[11px] text-[#7C4300] bg-[#FEF7E0] p-2.5 rounded-xl border border-[#F29900]/30 flex items-start space-x-2">
              <Clock className="w-4 h-4 text-[#EA8600] shrink-0 mt-0.5" />
              <p>
                <strong>Are you within 500m of this spot?</strong> Tap <em>Verify Fix</em> if the problem is gone, or{' '}
                <em>Dispute Fix</em> if it is still broken.
              </p>
            </div>
          )}
        </div>
      )}

      {/* REGULAR ISSUE PHOTO VIEWER (When not in resolution mode) */}
      {!isResolutionState && issue.evidence_list && issue.evidence_list.length > 0 && (
        <div className="space-y-2">
          {(() => {
            const currentEvidence = issue.evidence_list[selectedEvidenceIndex] || issue.evidence_list[0];
            return (
              <div className="relative overflow-hidden rounded-2xl border border-[#E0E2EC] bg-[#1F1F1F] flex items-center justify-center min-h-[220px] sm:min-h-[300px] max-h-[400px]">
                <img
                  src={currentEvidence.media_url}
                  alt="Issue evidence photo"
                  className="w-full h-full object-contain max-h-[400px]"
                />
                <div className="absolute top-2.5 left-2.5 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-black/60 text-[#81C995] text-[10px] backdrop-blur-sm">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified Photo Proof</span>
                </div>
                {issue.evidence_list.length > 1 && (
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-mono">
                    {selectedEvidenceIndex + 1} / {issue.evidence_list.length}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Photo Thumbnails if multiple */}
          {issue.evidence_list.length > 1 && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
              {issue.evidence_list.map((ev, idx) => (
                <button
                  key={ev.id || idx}
                  type="button"
                  onClick={() => setSelectedEvidenceIndex(idx)}
                  className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === selectedEvidenceIndex ? 'border-[#1A73E8] shadow' : 'border-[#E0E2EC] opacity-75'
                  }`}
                >
                  <img src={ev.media_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

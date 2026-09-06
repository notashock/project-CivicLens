'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Navigation,
  MapPin,
  Check,
  Share2,
  AlertTriangle,
  Radio,
  User,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Wrench,
  Lock,
  RotateCw,
} from 'lucide-react';
import { useActiveIssueDispatch } from '@/context/ActiveIssueContext';
import {
  fetchIssueById,
  fetchCommunityNotes,
  subscribeToRealtimeEvents,
  Issue,
  CommunityNote,
  normalizeIssue,
} from '@/lib/api';
import { useWitnessAttestation } from '@/lib/witness-attestation';
import { IssueLifecycleTracker } from '@/components/issue/IssueLifecycleTracker';
import { EvidenceGallery } from '@/components/issue/EvidenceGallery';
import { ResolutionClaimModal } from '@/components/issue/ResolutionClaimModal';
import { CommunityNotesThread } from '@/components/issue/CommunityNotesThread';
import { LocationPermissionModal } from '@/components/LocationPermissionModal';

export default function IssueDetailPage() {
  const params = useParams();
  const issueId = params.id as string;
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Issue & Notes state
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<CommunityNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);

  // Modal & Share state
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Reply Composer local state
  const [replyText, setReplyText] = useState<string>('');
  const [replyPhotoBase64, setReplyPhotoBase64] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [neutralityWarning, setNeutralityWarning] = useState<string | null>(null);

  // Deep Witness Attestation Coordinator
  const attestation = useWitnessAttestation({
    issue,
    onIssueUpdate: (updated) => setIssue(updated),
    onNoteAdded: (note) => setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]),
  });

  // Sync active issue & header actions with dynamic top Navbar
  const { setActiveIssue, setHeaderActions } = useActiveIssueDispatch();

  // Stable share action handler
  const handleShare = useCallback(() => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  }, []);

  // Update active issue in navbar
  useEffect(() => {
    setActiveIssue(issue);
  }, [issue, setActiveIssue]);

  // Update dynamic header action controls in navbar
  useEffect(() => {
    setHeaderActions({
      isNearby: attestation.isNearby,
      userDistanceMeters: attestation.userDistanceMeters,
      locationLoading: attestation.locationLoading,
      isPermissionDenied: attestation.isPermissionDenied,
      openPermissionModal: () => attestation.setShowPermissionModal(true),
      refreshLocation: attestation.refreshLocation,
      handleShare,
      copiedLink,
    });
  }, [
    attestation.isNearby,
    attestation.userDistanceMeters,
    attestation.locationLoading,
    attestation.isPermissionDenied,
    attestation.setShowPermissionModal,
    attestation.refreshLocation,
    handleShare,
    copiedLink,
    setHeaderActions,
  ]);

  // Clean up navbar state only on component unmount
  useEffect(() => {
    return () => {
      setActiveIssue(null);
      setHeaderActions(null);
    };
  }, [setActiveIssue, setHeaderActions]);

  const loadIssue = async () => {
    try {
      setLoading(true);
      const data = await fetchIssueById(issueId);
      setIssue(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load issue');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      setLoadingNotes(true);
      const data = await fetchCommunityNotes(issueId);
      setNotes(data);
    } catch (err: any) {
      console.warn('Failed to load community notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadIssue();
    loadNotes();

    // Subscribe to real-time events
    const unsubscribe = subscribeToRealtimeEvents((eventType, data) => {
      if (eventType === 'NOTE_ADDED' && data && data.issue_id === issueId) {
        setNotes((prev) => {
          if (prev.some((n) => n.id === data.id)) return prev;
          return [data, ...prev];
        });
      } else if (eventType === 'ISSUE_VERIFIED' && data && data.id === issueId) {
        setIssue((prev) => (prev ? normalizeIssue({ ...prev, ...data }) : null));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [issueId]);

  const scrollToReplyBox = () => {
    replyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    replyInputRef.current?.focus();
  };

  // Reply Composer handlers
  const handleReplyPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setReplyError('Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReplyPhotoBase64(reader.result as string);
      setReplyError(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() && !replyPhotoBase64) return;

    try {
      setSubmittingReply(true);
      setReplyError(null);
      setReplySuccess(null);

      await attestation.submitReplyNote(replyText, 'NEUTRAL', replyPhotoBase64);

      setReplyText('');
      setReplyPhotoBase64(null);
      setReplySuccess('Reply posted to public thread.');
      setTimeout(() => setReplySuccess(null), 4000);
    } catch (err: any) {
      setReplyError(err.message || 'Failed to post reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden bg-[#F8F9FA] relative">
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 py-3 sm:py-5">
          <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
            {/* Status & Lifecycle Skeleton */}
            <div className="bg-white rounded-2xl border border-[#E0E2EC] p-4 sm:p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-6 w-32 bg-[#E0E2EC] rounded-full" />
                <div className="h-6 w-24 bg-[#E0E2EC] rounded-full" />
              </div>
              <div className="h-3 w-full bg-[#E0E2EC] rounded-full" />
            </div>

            {/* Narrative Card Skeleton */}
            <div className="bg-white rounded-2xl border border-[#E0E2EC] p-4 sm:p-6 space-y-3.5 shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-28 bg-[#E0E2EC] rounded-lg" />
                <div className="h-5 w-20 bg-[#E0E2EC] rounded-full" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-4 w-full bg-[#E0E2EC] rounded" />
                <div className="h-4 w-5/6 bg-[#E0E2EC] rounded" />
                <div className="h-4 w-2/3 bg-[#E0E2EC] rounded" />
              </div>
              <div className="pt-3 flex items-center justify-between border-t border-[#E0E2EC]">
                <div className="h-4 w-36 bg-[#E0E2EC] rounded" />
                <div className="h-4 w-28 bg-[#E0E2EC] rounded" />
              </div>
            </div>

            {/* Evidence Gallery Skeleton */}
            <div className="bg-white rounded-2xl border border-[#E0E2EC] p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="h-5 w-36 bg-[#E0E2EC] rounded" />
              <div className="h-44 sm:h-56 w-full bg-[#F1F3F4] rounded-xl" />
            </div>

            {/* Community Thread Skeleton */}
            <div className="bg-white rounded-2xl border border-[#E0E2EC] p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="h-5 w-40 bg-[#E0E2EC] rounded" />
              <div className="space-y-2 pt-1">
                <div className="h-12 w-full bg-[#F1F3F4] rounded-xl" />
                <div className="h-12 w-full bg-[#F1F3F4] rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-[#FCE8E6] text-[#D93025] flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#1F1F1F]">Report Not Found</h2>
        <p className="text-sm text-[#5F6368] mt-1 mb-6">{error || 'This issue does not exist in the public ledger.'}</p>
        <Link href="/" className="m3-btn-primary text-xs py-2 px-5">
          Return to Map
        </Link>
      </div>
    );
  }

  const statusPres = issue.statusPresentation;

  // Derived evidence & resolution helpers
  const isResolutionState =
    issue.status === 'RESOLUTION_CLAIMED' ||
    issue.status === 'COMMUNITY_VERIFIED' ||
    issue.status === 'RESOLVED';

  const rectificationClaimEvent = issue.timeline?.find(
    (e) => e.event_type === 'RESOLUTION_PROPOSED' || e.to_status === 'RESOLUTION_CLAIMED'
  );

  const rectificationEvidence =
    issue.evidence_list?.find((ev) => ev.id?.startsWith('EVD-RES-')) ||
    (isResolutionState && issue.evidence_list && issue.evidence_list.length > 1
      ? issue.evidence_list[issue.evidence_list.length - 1]
      : null);

  const initialIntakeEvidence =
    issue.evidence_list && issue.evidence_list.length > 0 ? issue.evidence_list[0] : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden relative">
      {/* Scrollable Main Issue Content Area (bounds strictly between top navbar and bottom action dock) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 py-3 sm:py-5">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4 pb-6">
          {/* Toast Feedback Notification */}
          {attestation.actionFeedback && (
            <div
              className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 p-3 rounded-2xl shadow-lg text-xs font-semibold flex items-center space-x-2 border transition-all ${
                attestation.actionFeedback.type === 'success'
                  ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#0D652D]'
                  : attestation.actionFeedback.type === 'warning'
                  ? 'bg-[#FEF7E0] border-[#F29900]/40 text-[#7C4300]'
                  : 'bg-[#FCE8E6] border-[#FAD2CF] text-[#B3261E]'
              }`}
            >
              {attestation.actionFeedback.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-[#0F9D58]" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1">{attestation.actionFeedback.message}</span>
            </div>
          )}

          {/* Location Permission Blocked Advisory Banner */}
          {attestation.isPermissionDenied && (
            <div className="bg-[#FCE8E6] border border-[#FAD2CF] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center space-x-2.5 text-[#B3261E] min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold truncate">
                  Location is blocked in browser settings. Eyewitness voting requires physical presence (&lt;500m).
                </span>
              </div>
              <button
                type="button"
                onClick={() => attestation.setShowPermissionModal(true)}
                className="shrink-0 bg-[#B3261E] hover:bg-[#8C1D18] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95"
              >
                Enable GPS
              </button>
            </div>
          )}

          {/* 1. Status Lifecycle Tracker Component */}
          <IssueLifecycleTracker issue={issue} />

          {/* 2. Main Issue Post Card */}
          <article className="bg-white rounded-2xl border border-[#E0E2EC] p-4 sm:p-5 shadow-sm space-y-3.5">
        {/* Author Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5 text-[#1A73E8]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm text-[#1F1F1F]">Civic Witness</span>
                <span className="text-xs text-[#5F6368]">·</span>
                <span className="text-xs text-[#5F6368]">
                  {new Date(issue.first_reported_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-[#5F6368]">
                <span>{issue.category.replace(/_/g, ' ')}</span>
                <span>·</span>
                <span>{issue.jurisdiction_authority}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <p className="text-sm sm:text-base text-[#1F1F1F] leading-relaxed font-normal whitespace-pre-wrap">
          {issue.description_neutral}
        </p>

        {/* Evidence Photo Gallery Component */}
        <EvidenceGallery
          issue={issue}
          isResolutionState={isResolutionState}
          rectificationEvidence={rectificationEvidence}
          initialIntakeEvidence={initialIntakeEvidence}
          rectificationClaimEvent={rectificationClaimEvent}
        />

        {/* Desktop Action Bar (Hidden on mobile/tablet < 1024px; they use dynamic bottom action dock) */}
        <div className="hidden lg:block pt-2.5 border-t border-[#E0E2EC]">
          <div className="flex items-center justify-between text-[#5F6368]">
            {issue.status === 'RESOLUTION_CLAIMED' ? (
              <>
                <button
                  type="button"
                  onClick={() => attestation.submitReaction('CONFIRM')}
                  disabled={attestation.isSubmittingReaction}
                  className={`flex items-center space-x-1.5 text-xs font-semibold py-2 px-3.5 rounded-xl border border-transparent transition-all ${
                    attestation.currentDeviceStance === 'RESOLUTION_VERIFY'
                      ? 'bg-[#E6F4EA] text-[#0D652D] border-[#CEEAD6]'
                      : 'hover:bg-[#E6F4EA] hover:text-[#0D652D]'
                  } ${!attestation.isNearby ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title={attestation.isNearby ? 'Verify that this issue is fixed' : 'Requires proximity within 500m'}
                >
                  <ThumbsUp
                    className={`w-4 h-4 ${
                      attestation.currentDeviceStance === 'RESOLUTION_VERIFY'
                        ? 'text-[#0F9D58] fill-current'
                        : ''
                    }`}
                  />
                  <span>Verify Fix</span>
                  <span className="font-mono text-[11px] font-bold ml-0.5">
                    {issue.verified_confirm_count}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => attestation.submitReaction('DISPUTE')}
                  disabled={attestation.isSubmittingReaction}
                  className={`flex items-center space-x-1.5 text-xs font-semibold py-2 px-3.5 rounded-xl border border-transparent transition-all ${
                    attestation.currentDeviceStance === 'RESOLUTION_DISPUTE'
                      ? 'bg-[#FCE8E6] text-[#B3261E] border-[#FAD2CF]'
                      : 'hover:bg-[#FCE8E6] hover:text-[#B3261E]'
                  } ${!attestation.isNearby ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title={
                    attestation.isNearby
                      ? 'Dispute: Fix is incomplete or still broken'
                      : 'Requires proximity within 500m'
                  }
                >
                  <ThumbsDown
                    className={`w-4 h-4 ${
                      attestation.currentDeviceStance === 'RESOLUTION_DISPUTE'
                        ? 'text-[#D93025] fill-current'
                        : ''
                    }`}
                  />
                  <span>Still Broken</span>
                  <span className="font-mono text-[11px] font-bold ml-0.5">
                    {issue.verified_dispute_count}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => attestation.submitReaction('CONFIRM')}
                  disabled={attestation.isSubmittingReaction}
                  className={`flex items-center space-x-1.5 text-xs font-semibold py-2 px-3.5 rounded-xl border border-transparent transition-all ${
                    attestation.currentDeviceStance === 'CONFIRM'
                      ? 'bg-[#E6F4EA] text-[#0D652D] border-[#CEEAD6]'
                      : 'hover:bg-[#E6F4EA] hover:text-[#0D652D]'
                  } ${!attestation.isNearby ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title={
                    attestation.isNearby
                      ? 'Confirm you see this problem'
                      : 'Requires physical proximity within 500m'
                  }
                >
                  <ThumbsUp
                    className={`w-4 h-4 ${
                      attestation.currentDeviceStance === 'CONFIRM' ? 'text-[#0F9D58] fill-current' : ''
                    }`}
                  />
                  <span>Confirm</span>
                  <span className="font-mono text-[11px] font-bold ml-0.5">
                    {issue.verified_confirm_count}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => attestation.submitReaction('DISPUTE')}
                  disabled={attestation.isSubmittingReaction}
                  className={`flex items-center space-x-1.5 text-xs font-semibold py-2 px-3.5 rounded-xl border border-transparent transition-all ${
                    attestation.currentDeviceStance === 'DISPUTE'
                      ? 'bg-[#FCE8E6] text-[#B3261E] border-[#FAD2CF]'
                      : 'hover:bg-[#FCE8E6] hover:text-[#B3261E]'
                  } ${!attestation.isNearby ? 'opacity-60 cursor-not-allowed' : ''}`}
                  title={
                    attestation.isNearby
                      ? 'Dispute: Problem is not present here'
                      : 'Requires physical proximity within 500m'
                  }
                >
                  <ThumbsDown
                    className={`w-4 h-4 ${
                      attestation.currentDeviceStance === 'DISPUTE' ? 'text-[#D93025] fill-current' : ''
                    }`}
                  />
                  <span>Dispute</span>
                  <span className="font-mono text-[11px] font-bold ml-0.5">
                    {issue.verified_dispute_count}
                  </span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={scrollToReplyBox}
              className="flex items-center space-x-1.5 text-xs font-semibold py-2 px-3.5 rounded-xl hover:bg-[#E8F0FE] hover:text-[#1A73E8] transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Reply</span>
              <span className="font-mono text-[11px] font-bold ml-0.5">{notes.length}</span>
            </button>

            {!isResolutionState && (
              <button
                type="button"
                onClick={() => setShowClaimModal(true)}
                className="flex items-center space-x-1.5 text-xs font-semibold py-2 px-3.5 rounded-xl bg-[#F1F3F4] text-[#1F1F1F] hover:bg-[#E8F0FE] hover:text-[#1A73E8] transition-all"
                title="Submit photographic proof that this issue was fixed"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Mark Fixed</span>
              </button>
            )}
          </div>

          {!attestation.isNearby && (
            <div className="mt-2 text-[11px] text-[#5F6368] flex items-center space-x-1">
              <Lock className="w-3 h-3 text-[#5F6368] shrink-0" />
              <span>
                {attestation.userDistanceMeters !== null
                  ? `Confirm & Dispute votes require proximity within 500m (~${Math.round(
                      attestation.userDistanceMeters
                    )}m away).`
                  : 'Enable GPS location to vote (requires presence within 500m).'}
              </span>
            </div>
          )}
        </div>
      </article>

          {/* 3. Community Notes Thread & Composer Component */}
          <CommunityNotesThread
            notes={notes}
            loadingNotes={loadingNotes}
            isNearby={attestation.isNearby}
            replyInputRef={replyInputRef}
            replyText={replyText}
            onReplyTextChange={setReplyText}
            replyPhotoBase64={replyPhotoBase64}
            onPhotoSelect={handleReplyPhotoSelect}
            onRemovePhoto={() => setReplyPhotoBase64(null)}
            onSubmitReply={handlePostReply}
            submittingReply={submittingReply}
            replySuccess={replySuccess}
            replyError={replyError}
            neutralityWarning={neutralityWarning}
          />
        </div>
      </div>

      {/* Dynamic Bottom Navbar: Witness Action Dock (Replaces BottomNav on Issue Display) */}
      <div className="lg:hidden shrink-0 bg-white border-t border-[#E0E2EC] px-4 pt-2.5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] shadow-[0px_-2px_12px_0px_rgba(0,0,0,0.06)] space-y-2 z-20">
        {!attestation.isNearby && (
          <div className="text-[10px] sm:text-[11px] text-[#5F6368] font-medium text-center flex items-center justify-center gap-1.5 flex-wrap">
            <Lock className="w-3 h-3 text-[#747775] shrink-0" />
            <span>
              {attestation.userDistanceMeters !== null
                ? `~${Math.round(attestation.userDistanceMeters)}m away · Must be within 500m to vote`
                : 'Enable GPS to vote (<500m)'}
            </span>
            <button
              type="button"
              onClick={attestation.refreshLocation}
              disabled={attestation.locationLoading}
              className="text-[#1A73E8] hover:underline font-semibold flex items-center gap-0.5 ml-1"
            >
              <RotateCw className={`w-2.5 h-2.5 ${attestation.locationLoading ? 'animate-spin' : ''}`} />
              <span>{attestation.locationLoading ? 'Refreshing...' : 'Refresh GPS'}</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto text-center mb-1">
          {issue.status === 'RESOLUTION_CLAIMED' ? (
            <>
              <button
                type="button"
                onClick={() => attestation.submitReaction('CONFIRM')}
                disabled={attestation.isSubmittingReaction}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
                  attestation.currentDeviceStance === 'RESOLUTION_VERIFY'
                    ? 'bg-[#E6F4EA] text-[#0D652D] ring-1 ring-[#0D652D]/20'
                    : 'bg-[#F8F9FA] text-[#1F1F1F] hover:bg-[#E6F4EA]'
                } ${!attestation.isNearby ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-bold">{issue.verified_confirm_count}</span>
                </div>
                <span className="text-[10px] mt-0.5">Verify Fix</span>
              </button>

              <button
                type="button"
                onClick={() => attestation.submitReaction('DISPUTE')}
                disabled={attestation.isSubmittingReaction}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
                  attestation.currentDeviceStance === 'RESOLUTION_DISPUTE'
                    ? 'bg-[#FCE8E6] text-[#B3261E] ring-1 ring-[#B3261E]/20'
                    : 'bg-[#F8F9FA] text-[#1F1F1F] hover:bg-[#FCE8E6]'
                } ${!attestation.isNearby ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <div className="flex items-center gap-1">
                  <ThumbsDown className="w-4 h-4" />
                  <span className="font-bold">{issue.verified_dispute_count}</span>
                </div>
                <span className="text-[10px] mt-0.5">Dispute</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => attestation.submitReaction('CONFIRM')}
                disabled={attestation.isSubmittingReaction}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
                  attestation.currentDeviceStance === 'CONFIRM'
                    ? 'bg-[#E6F4EA] text-[#0D652D] ring-1 ring-[#0D652D]/20'
                    : 'bg-[#F8F9FA] text-[#1F1F1F] hover:bg-[#E6F4EA]'
                } ${!attestation.isNearby ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-bold">{issue.verified_confirm_count}</span>
                </div>
                <span className="text-[10px] mt-0.5">Confirm</span>
              </button>

              <button
                type="button"
                onClick={() => attestation.submitReaction('DISPUTE')}
                disabled={attestation.isSubmittingReaction}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
                  attestation.currentDeviceStance === 'DISPUTE'
                    ? 'bg-[#FCE8E6] text-[#B3261E] ring-1 ring-[#B3261E]/20'
                    : 'bg-[#F8F9FA] text-[#1F1F1F] hover:bg-[#FCE8E6]'
                } ${!attestation.isNearby ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <div className="flex items-center gap-1">
                  <ThumbsDown className="w-4 h-4" />
                  <span className="font-bold">{issue.verified_dispute_count}</span>
                </div>
                <span className="text-[10px] mt-0.5">Dispute</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={scrollToReplyBox}
            className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold bg-[#F8F9FA] text-[#1F1F1F] hover:bg-[#E8F0FE] hover:text-[#1A73E8] transition-all min-h-[48px] active:scale-95"
          >
            <div className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              <span className="font-bold">{notes.length}</span>
            </div>
            <span className="text-[10px] mt-0.5">Reply</span>
          </button>

          {!isResolutionState ? (
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold bg-[#F1F3F4] text-[#1F1F1F] hover:bg-[#E8F0FE] hover:text-[#1A73E8] transition-all min-h-[48px] active:scale-95"
            >
              <Wrench className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Fixed?</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold bg-[#E6F4EA] text-[#0D652D] min-h-[48px]">
              <Check className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Resolving</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Rectification Claim Modal Dialog */}
      <ResolutionClaimModal
        issue={issue}
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        onSuccess={(updated) => setIssue(updated)}
        showToast={attestation.showToast}
      />

      {/* 5. Location Permission Guidance Dialog */}
      <LocationPermissionModal
        isOpen={attestation.showPermissionModal}
        onClose={() => attestation.setShowPermissionModal(false)}
        onPermissionGranted={() => attestation.refreshLocation(false)}
        title="Verify Physical Presence (<500m)"
        reason="CivicTrace checks your proximity to verify this issue on the public ledger. Your exact location is never stored or tracked."
      />
    </div>
  );
}

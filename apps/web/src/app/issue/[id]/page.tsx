'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Building,
  Radio,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Check,
  Camera,
  MessageSquare,
  Send,
  Image as ImageIcon,
  X,
  ShieldAlert,
  User
} from 'lucide-react';
import {
  fetchIssueById,
  submitResolutionClaim,
  fetchCommunityNotes,
  submitCommunityNote,
  subscribeToRealtimeEvents,
  Issue,
  CommunityNote
} from '@/lib/api';
import { computeNullifierHash, getOrCreateDevicePrk, ActionType } from '@civictrace/crypto-nullifier';
import { formatDigipin } from '@civictrace/digipin';
import { getStatusPresentation, calculateConsensus } from '@/lib/issue-feed-model';
import { checkTextNeutrality } from '@/lib/neutrality-checker';

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Attestation & Nullifier state
  const [hasVotedOnThisIssue, setHasVotedOnThisIssue] = useState<boolean>(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  // Selected stance in unified composer
  const [selectedStance, setSelectedStance] = useState<ActionType>('CONFIRM');
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState<number>(0);
  const [lastVotedTimestamp, setLastVotedTimestamp] = useState<number | null>(null);
  const [currentDeviceStance, setCurrentDeviceStance] = useState<string | null>(null);

  // Resolution Claim state
  const [showClaimForm, setShowClaimForm] = useState<boolean>(false);
  const [claimantId, setClaimantId] = useState<string>('');
  const [claimNotes, setClaimNotes] = useState<string>('');
  const [claiming, setClaiming] = useState<boolean>(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Community Notes & Neutrality Moderation state
  const [notes, setNotes] = useState<CommunityNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);
  const [noteText, setNoteText] = useState<string>('');
  const [noteMediaBase64, setNoteMediaBase64] = useState<string | null>(null);
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
  const [neutralityWarning, setNeutralityWarning] = useState<string | null>(null);

  useEffect(() => {
    loadIssue();
    loadNotes();

    // Subscribe to real-time events (including new Community Notes and consensus updates)
    const unsubscribe = subscribeToRealtimeEvents((eventType, data) => {
      if (eventType === 'NOTE_ADDED' && data && data.issue_id === issueId) {
        setNotes((prev) => {
          if (prev.some((n) => n.id === data.id)) return prev;
          return [data, ...prev];
        });
      } else if (eventType === 'ISSUE_VERIFIED' && data && data.id === issueId) {
        setIssue((prev) =>
          prev
            ? {
                ...prev,
                status: data.status || prev.status,
                consensus_score: data.consensus_score ?? prev.consensus_score,
                verified_confirm_count: data.verified_confirm_count ?? prev.verified_confirm_count,
                verified_dispute_count: data.verified_dispute_count ?? prev.verified_dispute_count,
                evidence_list: data.evidence_list || prev.evidence_list,
              }
            : prev
        );
      }
    });

    if (typeof window !== 'undefined') {
      const votedIssues = JSON.parse(localStorage.getItem('civictrace_voted_issues') || '{}');
      const userVote = votedIssues[issueId];
      if (userVote) {
        setHasVotedOnThisIssue(true);
        if (typeof userVote === 'object') {
          setCurrentDeviceStance(userVote.stance);
          setLastVotedTimestamp(userVote.timestamp);
        } else {
          setCurrentDeviceStance(userVote);
        }
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLat(pos.coords.latitude);
            setUserLon(pos.coords.longitude);
          },
          (err) => {
            console.info('Geolocation unavailable or denied; using issue location as reference.', err);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }

    return () => {
      unsubscribe();
    };
  }, [issueId]);

  // Adjust default stance if issue enters resolution window
  useEffect(() => {
    if (issue && issue.status === 'RESOLUTION_CLAIMED' && selectedStance === 'CONFIRM') {
      setSelectedStance('RESOLUTION_VERIFY');
    }
  }, [issue?.status]);

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

  const handleNoteTextChange = (text: string) => {
    setNoteText(text);
    setNoteError(null);
    const check = checkTextNeutrality(text);
    if (!check.isValid) {
      setNeutralityWarning(check.warning || 'Neutrality violation detected.');
    } else {
      setNeutralityWarning(null);
    }
  };

  const handleNoteImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setNoteError('Image size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNoteMediaBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeNoteImage = () => {
    setNoteMediaBase64(null);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() && selectedStance === 'NEUTRAL' && !noteMediaBase64) return;

    if (noteText.trim()) {
      const check = checkTextNeutrality(noteText);
      if (!check.isValid) {
        setNeutralityWarning(check.warning || 'Political entities or personal names are prohibited.');
        return;
      }
    }

    try {
      setSubmittingNote(true);
      setNoteError(null);
      setNoteSuccess(null);

      const lat = userLat !== null ? userLat : issue?.lat;
      const lon = userLon !== null ? userLon : issue?.lon;
      const clientPrk = getOrCreateDevicePrk();
      const nullifierHash = computeNullifierHash(clientPrk, issueId, selectedStance);

      const mediaUrls = noteMediaBase64 ? [noteMediaBase64] : [];
      const newNote = await submitCommunityNote(issueId, {
        text: noteText.trim(),
        stance: selectedStance,
        nullifier_hash: nullifierHash,
        lat,
        lon,
        media_urls: mediaUrls,
      });

      setNotes((prev) => {
        if (prev.some((n) => n.id === newNote.id)) return prev;
        return [newNote, ...prev];
      });

      // Refresh issue record to get promoted evidence and consensus quorum updates
      if (selectedStance !== 'NEUTRAL' || mediaUrls.length > 0) {
        const updated = await fetchIssueById(issueId);
        setIssue(updated);

        const votedIssues = JSON.parse(localStorage.getItem('civictrace_voted_issues') || '{}');
        votedIssues[issueId] = { stance: selectedStance, timestamp: Date.now() };
        localStorage.setItem('civictrace_voted_issues', JSON.stringify(votedIssues));
        setHasVotedOnThisIssue(true);
        setCurrentDeviceStance(selectedStance);
        setLastVotedTimestamp(Date.now());
      }

      setNoteText('');
      setNoteMediaBase64(null);
      setNeutralityWarning(null);
      setNoteSuccess(
        newNote.is_consensus_verified
          ? '✓ On-site attestation verified! Photo promoted to official evidence gallery.'
          : 'Community note successfully recorded to the ledger.'
      );
      setTimeout(() => setNoteSuccess(null), 5000);
    } catch (err: any) {
      setNoteError(err.message || 'Failed to submit attestation note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleClaimResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !claimantId.trim() || !claimNotes.trim()) return;

    try {
      setClaiming(true);
      setClaimError(null);
      setClaimSuccess(null);
      const updated = await submitResolutionClaim(issue.id, {
        claimant_id: claimantId.trim(),
        notes: claimNotes.trim(),
      });
      setIssue(updated);
      setShowClaimForm(false);
      setClaimSuccess('Resolution claim logged! 72-hour community verification window initiated.');
      setTimeout(() => setClaimSuccess(null), 6000);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to submit resolution claim');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-8 text-center text-zinc-600">
        <Radio className="w-8 h-8 animate-spin text-zinc-900 mb-2" />
        <p className="text-sm font-bold">Querying public civic ledger...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-700 mx-auto mb-3" />
        <h2 className="text-xl font-black text-zinc-900">Record Not Found</h2>
        <p className="text-sm text-zinc-600 mt-1 mb-4">{error || 'This issue does not exist in the public ledger.'}</p>
        <Link href="/" className="editorial-btn px-4 py-2 bg-white text-zinc-900 text-sm">
          Return to Spatial Map
        </Link>
      </div>
    );
  }  const consensus = calculateConsensus(issue.verified_confirm_count, issue.verified_dispute_count);
  const statusPres = getStatusPresentation(issue.status);
  const cooldownRemainingMs = lastVotedTimestamp ? Math.max(0, 15 * 60 * 1000 - (Date.now() - lastVotedTimestamp)) : 0;
  const isCooldownActive = selectedStance !== 'NEUTRAL' && !!currentDeviceStance && selectedStance !== currentDeviceStance && cooldownRemainingMs > 0;
  const cooldownMinutes = Math.ceil(cooldownRemainingMs / 60000);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full space-y-4 sm:space-y-6 pb-12">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors py-1"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Back to Feed &amp; Map</span>
          <span className="sm:hidden font-medium">Back to Map</span>
        </Link>
        <span className="text-[10px] sm:text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
          Permanent Ledger Record
        </span>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Main Issue Description Card */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 bg-white rounded-xl border border-zinc-200 shadow-sm">
          {/* Status & Metadata Badges */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 rounded border ${statusPres.badgeClass}`}>
                {statusPres.label}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-zinc-700 bg-amber-50 px-2 sm:px-2.5 py-0.5 rounded border border-amber-200">
                {issue.category.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-[11px] sm:text-xs font-semibold text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                DIGIPIN: {formatDigipin(issue.digipin_code)}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-zinc-500 bg-zinc-100 px-1.5 sm:px-2 py-0.5 rounded border border-zinc-200 ml-auto">
                {issue.id}
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-zinc-900 leading-snug tracking-tight pt-0.5">
              {issue.description_neutral}
            </h1>
          </div>

          {/* Responsible Authority & Timeline Metadata Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[#FAF8F5] border border-zinc-200 text-xs">
            <div className="flex items-start space-x-2.5">
              <Building className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-zinc-900 truncate">{issue.jurisdiction_authority}</div>
                <div className="font-medium text-zinc-600 text-[11px] mt-0.5">{issue.assigned_department}</div>
              </div>
            </div>
            <div className="flex items-start space-x-2.5 sm:border-l sm:border-zinc-200 sm:pl-4 pt-1 sm:pt-0 border-t border-zinc-200/60 sm:border-t-0">
              <Clock className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-zinc-900">Observation Timeline</div>
                <div className="font-medium text-zinc-600 text-[11px] mt-0.5">
                  Logged: {new Date(issue.first_reported_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Resolution Claim Active Banner if applicable */}
          {issue.status === 'RESOLUTION_CLAIMED' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs">
              <div className="font-bold flex items-center space-x-1.5 mb-1 text-amber-900">
                <Clock className="w-4 h-4" />
                <span>72-Hour Resolution Quorum Active</span>
              </div>
              <p className="text-amber-800 leading-relaxed text-[11px] sm:text-xs">
                Authority logged a rectification. Community witnesses within 500m can verify or dispute to conclude this issue.
              </p>
            </div>
          )}

          {/* Authority / Contractor Rectification Action */}
          <div className="pt-0.5">
            {!showClaimForm ? (
              <button
                type="button"
                onClick={() => setShowClaimForm(true)}
                className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 underline underline-offset-2 flex items-center space-x-1"
              >
                <span>Authority / Contractor: Log Rectification &rarr;</span>
              </button>
            ) : (
              <form onSubmit={handleClaimResolution} className="p-3.5 sm:p-4 rounded-xl bg-[#FAF8F5] border border-zinc-300 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Log Official Rectification Claim
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Claimant ID / Agency</label>
                  <input
                    type="text"
                    placeholder="e.g. BBMP Ward 104 Road Maintenance Cell"
                    value={claimantId}
                    onChange={(e) => setClaimantId(e.target.value)}
                    required
                    className="w-full text-xs p-2 rounded-lg border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Summary</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Asphalt laid, depression filled and rolled."
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    required
                    className="w-full text-xs p-2 rounded-lg border border-zinc-300 bg-white focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="submit"
                    disabled={claiming}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                  >
                    {claiming ? 'Logging...' : 'Submit Claim'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClaimForm(false)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Claim Notification messages */}
          {claimSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-semibold flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{claimSuccess}</span>
            </div>
          )}
          {claimError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-950 text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{claimError}</span>
            </div>
          )}

          {/* Stance-Tagged Official Evidence Gallery */}
          {issue.evidence_list && issue.evidence_list.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-bold uppercase tracking-wider text-zinc-800 flex items-center space-x-1.5">
                  <Camera className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Evidence Gallery ({issue.evidence_list.length})</span>
                </span>
                <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <span className="hidden sm:inline">Privacy Pre-Blurred &amp; EXIF Stripped</span>
                  <span className="sm:hidden">Privacy Stripped</span>
                </span>
              </div>

              {/* Main Evidence Viewer */}
              {(() => {
                const currentEvidence = issue.evidence_list[selectedEvidenceIndex] || issue.evidence_list[0];
                return (
                  <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 flex items-center justify-center min-h-[220px] sm:min-h-[280px] max-h-[380px] sm:max-h-[440px]">
                    <img
                      src={currentEvidence.media_url}
                      alt="Civic evidence"
                      className="w-full h-full object-contain max-h-[380px] sm:max-h-[440px]"
                    />

                    {/* Stance & Quorum Promoted Badge Overlay */}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[85%]">
                      {currentEvidence.stance === 'CONFIRM' || currentEvidence.stance === 'RESOLUTION_VERIFY' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-emerald-600 text-white shadow">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Corroborated</span>
                        </span>
                      ) : currentEvidence.stance === 'DISPUTE' || currentEvidence.stance === 'RESOLUTION_DISPUTE' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-rose-600 text-white shadow">
                          <X className="w-3 h-3 stroke-[2.5]" />
                          <span>Disputed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium bg-zinc-900/80 text-zinc-200 shadow border border-zinc-700">
                          <span>Initial Intake</span>
                        </span>
                      )}

                      {currentEvidence.is_verified && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/85 text-emerald-300 border border-emerald-700/80 backdrop-blur-sm shadow">
                          <ShieldCheck className="w-3 h-3" />
                          <span>&lt;500m Ground Quorum</span>
                        </span>
                      )}
                    </div>

                    {/* Timestamp / Index indicator */}
                    <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[10px] font-mono text-zinc-300 border border-zinc-700">
                      {selectedEvidenceIndex + 1} / {issue.evidence_list.length}
                    </div>
                  </div>
                );
              })()}

              {/* Evidence Thumbnail Selector (if multiple photos) */}
              {issue.evidence_list.length > 1 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {issue.evidence_list.map((ev, idx) => {
                    const isSelected = idx === selectedEvidenceIndex;
                    return (
                      <button
                        key={ev.id || idx}
                        type="button"
                        onClick={() => setSelectedEvidenceIndex(idx)}
                        className={`relative shrink-0 w-14 h-14 sm:w-18 sm:h-18 rounded-lg overflow-hidden border transition-all ${
                          isSelected
                            ? 'border-emerald-600 ring-2 ring-emerald-500 shadow-sm'
                            : 'border-zinc-200 hover:border-zinc-400 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={ev.media_url}
                          alt={`Evidence thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {ev.stance && (
                          <span
                            className={`absolute bottom-0 inset-x-0 text-[8px] font-bold text-center text-white py-0.5 ${
                              ev.stance.includes('CONFIRM') || ev.stance.includes('VERIFY')
                                ? 'bg-emerald-600/90'
                                : ev.stance.includes('DISPUTE')
                                ? 'bg-rose-600/90'
                                : 'bg-zinc-700/90'
                            }`}
                          >
                            {ev.stance.includes('CONFIRM') || ev.stance.includes('VERIFY') ? 'CORROB' : 'DISPUTE'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Community Notes & Ground Explanations */}
        <div className="p-4 sm:p-6 space-y-4 bg-white rounded-xl border border-zinc-200 shadow-sm">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-900" />
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
                  Community Explanations &amp; Notes
                </h2>
                <span className="text-xs font-mono font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">
                  {notes.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                Unified notes &amp; attestations. Photos &lt;500m promote to official evidence.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1 sm:pt-0">
              <span className="text-xs font-mono font-semibold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                Consensus: {issue.consensus_score} ({issue.verified_confirm_count} vs {issue.verified_dispute_count})
              </span>
              <div className="hidden sm:flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Neutral</span>
              </div>
            </div>
          </div>

          {/* Note Composer with Stance Selector */}
          <form onSubmit={handleAddNote} className="space-y-3 bg-[#FAF8F5] p-3 sm:p-4 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
              <span className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>Post Attestation &amp; Context</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-zinc-500 font-normal">
                Hardware nullifier
              </span>
            </div>

            {/* Attestation Stance Selector Pills */}
            <div className="space-y-1.5">
              <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                Your Ground Observation Stance
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {issue.status === 'RESOLUTION_CLAIMED' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedStance('RESOLUTION_VERIFY')}
                      className={`py-2 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 border transition-all ${
                        selectedStance === 'RESOLUTION_VERIFY'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 shrink-0" />
                      <span className="sm:hidden text-[11px]">Verify</span>
                      <span className="hidden sm:inline">Verify Fixed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStance('RESOLUTION_DISPUTE')}
                      className={`py-2 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 border transition-all ${
                        selectedStance === 'RESOLUTION_DISPUTE'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5 shrink-0" />
                      <span className="sm:hidden text-[11px]">Dispute</span>
                      <span className="hidden sm:inline">Dispute Fix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStance('NEUTRAL')}
                      className={`py-2 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 border transition-all ${
                        selectedStance === 'NEUTRAL'
                          ? 'bg-zinc-800 text-white border-zinc-900 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="sm:hidden text-[11px]">Neutral</span>
                      <span className="hidden sm:inline">Neutral Note</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedStance('CONFIRM')}
                      className={`py-2 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 border transition-all ${
                        selectedStance === 'CONFIRM'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 shrink-0" />
                      <span className="sm:hidden text-[11px]">Confirm</span>
                      <span className="hidden sm:inline">Confirm Hazard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStance('DISPUTE')}
                      className={`py-2 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 border transition-all ${
                        selectedStance === 'DISPUTE'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5 shrink-0" />
                      <span className="sm:hidden text-[11px]">Dispute</span>
                      <span className="hidden sm:inline">Dispute Hazard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStance('NEUTRAL')}
                      className={`py-2 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 sm:space-x-1.5 border transition-all ${
                        selectedStance === 'NEUTRAL'
                          ? 'bg-zinc-800 text-white border-zinc-900 shadow-sm'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="sm:hidden text-[11px]">Neutral</span>
                      <span className="hidden sm:inline">Neutral Note</span>
                    </button>
                  </>
                )}
              </div>

              {currentDeviceStance && (
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-500 pt-0.5">
                  <span className="truncate">
                    Device stance: <strong className="text-zinc-800 font-mono">{currentDeviceStance}</strong>
                  </span>
                  {selectedStance !== currentDeviceStance && selectedStance !== 'NEUTRAL' && (
                    <span className="text-amber-700 font-semibold shrink-0 ml-1">Update</span>
                  )}
                </div>
              )}
            </div>

            {/* 15-Minute Stance Cooldown Warning Banner */}
            {isCooldownActive && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-bold">Stance Rate Limit Active: </span>
                  <span>
                    Stance re-attestation is limited to once per 15 min ({cooldownMinutes}m remaining).
                    You can still post factual <strong>Neutral Notes</strong> or evidence photos.
                  </span>
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => handleNoteTextChange(e.target.value)}
                placeholder={
                  selectedStance === 'NEUTRAL'
                    ? "Add factual ground observation or progress update..."
                    : `Add optional note explaining your '${selectedStance.toLowerCase().replace(/_/g, ' ')}' attestation...`
                }
                className={`w-full text-xs sm:text-sm p-2.5 sm:p-3 rounded-lg border bg-white focus:outline-none transition-colors ${
                  neutralityWarning
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-1 focus:ring-rose-400'
                    : 'border-zinc-300 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900'
                }`}
              />
            </div>

            {/* Live Neutrality Alert Warning */}
            {neutralityWarning && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-bold">Content Rule: </span>
                  <span>{neutralityWarning}</span>
                </div>
              </div>
            )}

            {/* Attached Image Preview */}
            {noteMediaBase64 && (
              <div className="relative inline-block border border-zinc-300 rounded-lg p-1 bg-white">
                <img
                  src={noteMediaBase64}
                  alt="Supporting evidence preview"
                  className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={removeNoteImage}
                  className="absolute -top-2 -right-2 p-1 bg-zinc-900 text-white rounded-full hover:bg-rose-600 shadow transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Composer Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div>
                <label
                  htmlFor="note-image-upload"
                  className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-lg cursor-pointer transition-colors shadow-sm"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="sm:hidden">{noteMediaBase64 ? 'Replace' : 'Add Photo'}</span>
                  <span className="hidden sm:inline">{noteMediaBase64 ? 'Replace Photo' : 'Attach Ground Photo'}</span>
                </label>
                <input
                  id="note-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleNoteImageSelect}
                  className="hidden"
                />
              </div>

              <button
                type="submit"
                disabled={
                  submittingNote ||
                  isCooldownActive ||
                  !!neutralityWarning ||
                  (!noteText.trim() && !noteMediaBase64 && selectedStance === 'NEUTRAL')
                }
                className={`inline-flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${
                  submittingNote ||
                  isCooldownActive ||
                  !!neutralityWarning ||
                  (!noteText.trim() && !noteMediaBase64 && selectedStance === 'NEUTRAL')
                    ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm active:scale-95'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span className="sm:hidden">{submittingNote ? 'Saving...' : 'Submit'}</span>
                <span className="hidden sm:inline">{submittingNote ? 'Verifying & Recording...' : 'Submit Attestation Note'}</span>
              </button>
            </div>

            {/* Success / Error Messages */}
            {noteSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900 flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{noteSuccess}</span>
              </div>
            )}
            {noteError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-900 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{noteError}</span>
              </div>
            )}
          </form>

          {/* Community Notes Stream */}
          <div className="space-y-2.5 sm:space-y-3 pt-1">
            {loadingNotes ? (
              <div className="py-8 text-center text-xs text-zinc-500 flex items-center justify-center space-x-2">
                <Radio className="w-4 h-4 animate-spin text-zinc-700" />
                <span>Loading community explanations...</span>
              </div>
            ) : notes.length === 0 ? (
              <div className="py-8 text-center bg-[#FAF8F5] rounded-xl border border-dashed border-zinc-300 p-6">
                <MessageSquare className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">No Attestation Notes Yet</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Be the first to corroborate, dispute, or provide factual status updates and photos for this civic record.
                </p>
              </div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 transition-shadow shadow-sm space-y-2"
                >
                  {/* Note Card Header: Top row with contributor and timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-700">
                        {n.participant_badge ? n.participant_badge.slice(0, 2).toUpperCase() : 'AN'}
                      </span>
                      <span className="font-bold text-zinc-900 text-xs truncate">
                        {n.participant_badge || 'Anonymous Contributor'}
                      </span>
                    </div>

                    <span className="text-[10px] sm:text-[11px] font-mono text-zinc-500 shrink-0">
                      {new Date(n.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* Stance & Verification Pills */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    {/* Stance Badge */}
                    {n.stance === 'CONFIRM' || n.stance === 'RESOLUTION_VERIFY' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <ThumbsUp className="w-3 h-3 text-emerald-600" />
                        <span>{n.stance === 'CONFIRM' ? 'Corroboration' : 'Resolution Verified'}</span>
                      </span>
                    ) : n.stance === 'DISPUTE' || n.stance === 'RESOLUTION_DISPUTE' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        <ThumbsDown className="w-3 h-3 text-rose-600" />
                        <span>{n.stance === 'DISPUTE' ? 'Dispute' : 'Resolution Disputed'}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                        Neutral Update
                      </span>
                    )}

                    {/* Consensus Quorum Corroboration Badge */}
                    {n.is_consensus_verified && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        <span>&lt;500m Verified</span>
                      </span>
                    )}
                  </div>

                  {n.text && (
                    <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal whitespace-pre-wrap pt-0.5">
                      {n.text}
                    </p>
                  )}

                  {n.media_urls && n.media_urls.length > 0 && (
                    <div className="pt-1">
                      <div className="flex flex-wrap gap-2">
                        {n.media_urls.map((url, i) => (
                          <div
                            key={i}
                            className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 max-w-sm group"
                          >
                            <img
                              src={url}
                              alt="Community evidence attachment"
                              className="max-h-48 sm:max-h-56 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => window.open(url, '_blank')}
                              title="Click to view full image"
                            />
                            {n.is_consensus_verified && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-900/90 text-emerald-200 text-[9px] font-bold border border-emerald-700 shadow backdrop-blur-sm flex items-center space-x-1">
                                <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Promoted to Gallery</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


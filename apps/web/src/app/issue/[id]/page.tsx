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
  History,
  Check
} from 'lucide-react';
import { fetchIssueById, submitVerification, Issue } from '@/lib/api';
import { computeNullifierHash, getOrCreateDevicePrk } from '@civictrace/crypto-nullifier';
import { formatDigipin } from '@civictrace/digipin';

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Verification state
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [hasVotedOnThisIssue, setHasVotedOnThisIssue] = useState<boolean>(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  useEffect(() => {
    loadIssue();
    if (typeof window !== 'undefined') {
      const votedIssues = JSON.parse(localStorage.getItem('civictrace_voted_issues') || '{}');
      if (votedIssues[issueId]) {
        setHasVotedOnThisIssue(true);
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLat(pos.coords.latitude);
            setUserLon(pos.coords.longitude);
          },
          () => {
            setUserLat(12.9716);
            setUserLon(77.5946);
          }
        );
      }
    }
  }, [issueId]);

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

  const handleAction = async (actionType: 'CONFIRM' | 'DISPUTE' | 'RESOLUTION_VERIFY' | 'RESOLUTION_DISPUTE') => {
    if (!issue || hasVotedOnThisIssue) return;

    try {
      setVerifying(true);
      setVerifyError(null);
      setVerifySuccess(null);

      const lat = userLat || issue.lat;
      const lon = userLon || issue.lon;

      // 1. Get Persistent Device PRK
      const clientPrk = getOrCreateDevicePrk();

      // 2. Compute Issue-Bound Nullifier Hash
      const nullifierHash = computeNullifierHash(clientPrk, issue.id, actionType);

      const updated = await submitVerification(issue.id, {
        action_type: actionType,
        nullifier_hash: nullifierHash,
        timestamp: Date.now(),
        lat: lat,
        lon: lon,
      });

      // Save local device vote state
      const votedIssues = JSON.parse(localStorage.getItem('civictrace_voted_issues') || '{}');
      votedIssues[issue.id] = actionType;
      localStorage.setItem('civictrace_voted_issues', JSON.stringify(votedIssues));
      setHasVotedOnThisIssue(true);

      setIssue(updated);
      setVerifySuccess(`Local ${actionType.toLowerCase()} registered via hardware nullifier.`);
    } catch (err: any) {
      if (err.message && err.message.includes('already registered')) {
        setHasVotedOnThisIssue(true);
        setVerifyError('Your voice has already been registered for this issue on this device.');
      } else {
        setVerifyError(err.message || 'Verification failed');
      }
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-600">
        <Radio className="w-8 h-8 animate-spin text-zinc-800 mb-2" />
        <p className="text-sm font-bold">Loading public civic ledger...</p>
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
          Return to Map
        </Link>
      </div>
    );
  }

  const totalVotes = issue.verified_confirm_count + issue.verified_dispute_count;
  const confirmPct = totalVotes > 0 ? Math.round((issue.verified_confirm_count / totalVotes) * 100) : 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
      {/* Top Breadcrumb & Record Stamp */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Spatial Map</span>
        </Link>
        <div className="flex items-center space-x-1.5">
          <span className="stamp-badge bg-[#DCFCE7] text-emerald-950">
            Immutable Ledger Record
          </span>
        </div>
      </div>

      {/* Main Issue Header Card */}
      <div className="editorial-card p-6 sm:p-8 space-y-6 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-sm font-black text-zinc-900 bg-[#F5F1EA] px-2.5 py-1 rounded-lg border-2 border-zinc-900 shadow-[2px_2px_0px_0px_#18181b]">
                {issue.id}
              </span>
              <span className="stamp-badge bg-[#E0F2FE] text-sky-950">
                DIGIPIN: {formatDigipin(issue.digipin_code)}
              </span>
              <span className="stamp-badge bg-[#FEF3C7] text-amber-950">
                {issue.category.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-zinc-900 leading-snug">
              {issue.description_neutral}
            </h1>
          </div>

          <div className="shrink-0 flex flex-col items-start sm:items-end">
            <span className="text-[11px] uppercase tracking-wider text-zinc-600 font-bold mb-1">
              Current Status
            </span>
            <span className="stamp-badge bg-[#DCFCE7] text-emerald-950 text-xs py-1">
              {issue.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Responsible Authority Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8F6F0] border-2 border-zinc-900 text-xs">
          <div className="flex items-start space-x-3">
            <Building className="w-4 h-4 text-zinc-800 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-zinc-900">{issue.jurisdiction_authority}</div>
              <div className="font-medium text-zinc-600 mt-0.5">{issue.assigned_department}</div>
            </div>
          </div>
          <div className="flex items-start space-x-3 sm:border-l-2 sm:border-zinc-300 sm:pl-4">
            <Clock className="w-4 h-4 text-zinc-800 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-zinc-900">Observation Timeline</div>
              <div className="font-medium text-zinc-600 mt-0.5">
                Logged on: {new Date(issue.first_reported_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Community Consensus Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black uppercase tracking-wider text-zinc-800 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-800" />
              <span>Consensus Score: {issue.consensus_score}</span>
            </span>
            <span className="font-bold text-zinc-700">
              {issue.verified_confirm_count} Confirms vs {issue.verified_dispute_count} Disputes
            </span>
          </div>
          <div className="w-full h-3.5 bg-[#F5F1EA] rounded-md overflow-hidden flex border-2 border-zinc-900">
            <div
              style={{ width: `${confirmPct}%` }}
              className="bg-[#22C55E] transition-all duration-300"
            />
            <div
              style={{ width: `${100 - confirmPct}%` }}
              className="bg-[#F43F5E] transition-all duration-300"
            />
          </div>
        </div>

        {/* 1-Tap Anonymous Local Verification Buttons */}
        <div className="pt-4 border-t-2 border-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-zinc-800" />
              <span>1-Tap Local Ephemeral Verification</span>
            </h3>
            <span className="text-[11px] font-bold text-zinc-500">
              {hasVotedOnThisIssue ? '✓ Action Recorded' : 'Strictly 1 action per physical device'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleAction('CONFIRM')}
              disabled={verifying || hasVotedOnThisIssue}
              className={`editorial-btn p-3.5 text-xs flex items-center justify-center space-x-2 transition-all ${
                hasVotedOnThisIssue
                  ? 'bg-zinc-200 text-zinc-500 border-zinc-400 cursor-not-allowed shadow-none'
                  : 'bg-[#DCFCE7] hover:bg-[#BBF7D0] text-emerald-950'
              }`}
            >
              <ThumbsUp className="w-4 h-4 text-emerald-900" />
              <span>{hasVotedOnThisIssue ? 'Voice Recorded' : 'Confirm Condition Observed Here'}</span>
            </button>

            <button
              onClick={() => handleAction('DISPUTE')}
              disabled={verifying || hasVotedOnThisIssue}
              className={`editorial-btn p-3.5 text-xs flex items-center justify-center space-x-2 transition-all ${
                hasVotedOnThisIssue
                  ? 'bg-zinc-200 text-zinc-500 border-zinc-400 cursor-not-allowed shadow-none'
                  : 'bg-[#FFE4E6] hover:bg-[#FECDD3] text-rose-950'
              }`}
            >
              <ThumbsDown className="w-4 h-4 text-rose-900" />
              <span>{hasVotedOnThisIssue ? 'Voice Recorded' : 'Dispute / Inaccurate Location'}</span>
            </button>
          </div>

          {verifySuccess && (
            <div className="p-3 rounded-lg bg-[#DCFCE7] border-2 border-emerald-900 text-emerald-950 text-xs font-bold flex items-center space-x-2 shadow-[2px_2px_0px_0px_#18181b]">
              <Check className="w-4 h-4 shrink-0 text-emerald-900" />
              <span>{verifySuccess}</span>
            </div>
          )}

          {verifyError && (
            <div className="p-3 rounded-lg bg-[#FFE4E6] border-2 border-rose-900 text-rose-950 text-xs font-bold flex items-center space-x-2 shadow-[2px_2px_0px_0px_#18181b]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-900" />
              <span>{verifyError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Immutable Public Audit Timeline */}
      <div className="editorial-card p-6 sm:p-8 space-y-4 bg-white">
        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 flex items-center space-x-2">
          <History className="w-4 h-4 text-zinc-800" />
          <span>Immutable Public Audit Timeline</span>
        </h3>

        <div className="space-y-3.5 pt-2">
          {issue.timeline.map((event, idx) => (
            <div key={event.id || idx} className="flex items-start space-x-3 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 mt-1.5 shrink-0"></div>
              <div className="flex-1 p-3.5 rounded-xl bg-[#FDFCF9] border-2 border-zinc-900 shadow-[2px_2px_0px_0px_#18181b]">
                <div className="flex items-center justify-between font-mono text-[11px] text-zinc-600 mb-1">
                  <span className="font-extrabold text-zinc-900">{event.event_type}</span>
                  <span>{new Date(event.created_at).toLocaleString()}</span>
                </div>
                {event.to_status && (
                  <div className="text-zinc-800 mb-1 font-medium">
                    Transitioned status to: <span className="font-bold text-zinc-900 font-mono">{event.to_status}</span>
                  </div>
                )}
                <div className="text-zinc-600 font-mono text-[11px]">{JSON.stringify(event.event_payload)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

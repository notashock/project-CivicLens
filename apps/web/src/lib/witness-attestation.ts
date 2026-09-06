'use client';

import { useState, useEffect, useCallback } from 'react';
import { Issue, CommunityNote, submitCommunityNote, fetchIssueById } from './api';
import { computeNullifierHash, getOrCreateDevicePrk, ActionType } from '@civictrace/crypto-nullifier';
import { calculateHaversineDistanceMeters } from '@civictrace/digipin';
import { checkTextNeutrality } from '@civictrace/sanitization-worker';

import {
  acquireUserLocation,
  checkLocationPermissionState,
  subscribeToPermissionChanges,
  GeolocationError,
} from './location-service';
import { useToast } from '@/context/ToastContext';

export interface ToastFeedback {
  message: string;
  type: 'success' | 'warning' | 'error';
}

export interface UseWitnessAttestationOptions {
  issue: Issue | null;
  onIssueUpdate?: (updated: Issue) => void;
  onNoteAdded?: (note: CommunityNote) => void;
}

export interface UseWitnessAttestationReturn {
  // Proximity & Geolocation
  userLat: number | null;
  userLon: number | null;
  userDistanceMeters: number | null;
  isNearby: boolean;
  locationLoading: boolean;
  locationError: string | null;
  isPermissionDenied: boolean;
  showPermissionModal: boolean;
  setShowPermissionModal: (show: boolean) => void;
  requestLocation: () => void;
  refreshLocation: (openModalIfDenied?: boolean) => Promise<void>;

  // Stance & Voting State
  hasVotedOnThisIssue: boolean;
  currentDeviceStance: string | null;
  lastVotedTimestamp: number | null;
  isSubmittingReaction: boolean;
  actionFeedback: ToastFeedback | null;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;

  // Actions
  submitReaction: (targetAction: 'CONFIRM' | 'DISPUTE') => Promise<void>;
  submitReplyNote: (
    text: string,
    stance: ActionType,
    photoBase64: string | null
  ) => Promise<CommunityNote | null>;
}

const VOTED_STORAGE_KEY = 'civictrace_voted_issues';
const STANCE_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes (ADR 0014)
const PROXIMITY_RADIUS_METERS = 500; // Consensus Quorum threshold

/**
 * DEEP MODULE: Witness Attestation Coordinator
 * Encapsulates device-bound WebCrypto PRK derivation, deterministic nullifier hashing,
 * local storage cooldown persistence, ephemeral proximity math, and optimistic consensus transitions.
 */
export function useWitnessAttestation({
  issue,
  onIssueUpdate,
  onNoteAdded,
}: UseWitnessAttestationOptions): UseWitnessAttestationReturn {
  const issueId = issue?.id || '';

  // Geolocation state
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);

  // Stance & Voting state
  const [hasVotedOnThisIssue, setHasVotedOnThisIssue] = useState<boolean>(false);
  const [currentDeviceStance, setCurrentDeviceStance] = useState<string | null>(null);
  const [lastVotedTimestamp, setLastVotedTimestamp] = useState<number | null>(null);
  const [isSubmittingReaction, setIsSubmittingReaction] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<ToastFeedback | null>(null);

  const { showToast: contextShowToast } = useToast();

  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'error') => {
      setActionFeedback({ message, type });
      contextShowToast(message, type);
    },
    [contextShowToast]
  );

  const refreshLocation = useCallback(
    async (openModalIfDenied = true) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'error');
        return;
      }

      setLocationLoading(true);
      setLocationError(null);

      // 1. Check GPS permissions first
      const permissionState = await checkLocationPermissionState();
      if (permissionState === 'denied') {
        setLocationLoading(false);
        setIsPermissionDenied(true);
        setLocationError('GPS permission denied in browser settings.');
        if (openModalIfDenied) {
          setShowPermissionModal(true);
        }
        showToast('GPS access is blocked. Tap the GPS badge to view how to enable.', 'warning');
        return;
      }

      // 2. Resilient multi-stage acquisition (GPS -> WiFi/coarse fallback)
      try {
        const coords = await acquireUserLocation();
        setUserLat(coords.latitude);
        setUserLon(coords.longitude);
        setIsPermissionDenied(false);
        setLocationLoading(false);
        setLocationError(null);

        if (issue) {
          const dist = calculateHaversineDistanceMeters(coords.latitude, coords.longitude, issue.lat, issue.lon);
          if (dist <= PROXIMITY_RADIUS_METERS) {
            showToast(`GPS Refreshed: Within 500m (~${Math.round(dist)}m). Eyewitness voting unlocked!`, 'success');
          } else {
            showToast(`GPS Refreshed: ~${Math.round(dist)}m away. Eyewitness voting requires presence within 500m.`, 'warning');
          }
        } else {
          showToast('GPS coordinates successfully refreshed.', 'success');
        }
      } catch (err: any) {
        console.warn('GPS acquisition error:', err);
        setLocationLoading(false);
        if (err instanceof GeolocationError && err.isPermissionDenied) {
          setIsPermissionDenied(true);
          setLocationError('Location permission denied');
          if (openModalIfDenied) {
            setShowPermissionModal(true);
          }
          showToast('GPS permission was denied. Tap to see how to enable.', 'error');
        } else if (err instanceof GeolocationError && err.isTimeout) {
          setLocationError('GPS request timed out');
          showToast('GPS request timed out. Please try again.', 'error');
        } else {
          setLocationError('Unable to retrieve GPS fix');
          showToast('Unable to obtain GPS fix. Please ensure location services are enabled.', 'error');
        }
      }
    },
    [issue, showToast]
  );

  const requestLocation = useCallback(() => {
    refreshLocation(false);
  }, [refreshLocation]);

  // Sync location on mount and subscribe to browser permission changes
  useEffect(() => {
    checkLocationPermissionState().then((st) => {
      setIsPermissionDenied(st === 'denied');
      if (st === 'granted') {
        refreshLocation(false);
      }
    });

    const unsubscribe = subscribeToPermissionChanges((st) => {
      setIsPermissionDenied(st === 'denied');
      if (st === 'granted') {
        refreshLocation(false);
      }
    });

    return () => unsubscribe();
  }, [refreshLocation]);

  // Load device's previous vote from local storage for this issue
  useEffect(() => {
    if (!issueId || typeof window === 'undefined') return;

    try {
      const votedIssues = JSON.parse(localStorage.getItem(VOTED_STORAGE_KEY) || '{}');
      const issueVote = votedIssues[issueId];
      if (issueVote) {
        setHasVotedOnThisIssue(true);
        if (typeof issueVote === 'object') {
          setCurrentDeviceStance(issueVote.stance || null);
          setLastVotedTimestamp(issueVote.timestamp || null);
        } else {
          setCurrentDeviceStance(issueVote);
        }
      } else {
        setHasVotedOnThisIssue(false);
        setCurrentDeviceStance(null);
        setLastVotedTimestamp(null);
      }
    } catch (e) {
      console.warn('LocalStorage access error:', e);
    }
  }, [issueId]);

  // Compute physical distance to issue centroid
  const userDistanceMeters =
    userLat !== null && userLon !== null && issue
      ? calculateHaversineDistanceMeters(userLat, userLon, issue.lat, issue.lon)
      : null;

  const isNearby = userDistanceMeters !== null && userDistanceMeters <= PROXIMITY_RADIUS_METERS;

  // Handle 1-Tap Reactions (Confirm / Dispute)
  const submitReaction = async (targetAction: 'CONFIRM' | 'DISPUTE') => {
    if (!issue) return;

    // Strict 500m Proximity Guard
    if (!isNearby) {
      if (userDistanceMeters !== null) {
        showToast(
          `Only witnesses within 500m can cast consensus votes. You are ~${Math.round(userDistanceMeters)}m away.`,
          'warning'
        );
      } else {
        if (isPermissionDenied) {
          setShowPermissionModal(true);
          showToast('Location permission is required to verify physical proximity (<500m).', 'warning');
        } else {
          showToast('Checking GPS location for 500m eyewitness verification...', 'warning');
          refreshLocation(true);
        }
      }
      return;
    }

    // Map action according to whether issue is in resolution mode
    const actualStance: ActionType =
      issue.status === 'RESOLUTION_CLAIMED'
        ? targetAction === 'CONFIRM'
          ? 'RESOLUTION_VERIFY'
          : 'RESOLUTION_DISPUTE'
        : targetAction === 'CONFIRM'
        ? 'CONFIRM'
        : 'DISPUTE';

    // 15-minute cooldown check when flipping vote
    const cooldownRemainingMs = lastVotedTimestamp
      ? Math.max(0, STANCE_COOLDOWN_MS - (Date.now() - lastVotedTimestamp))
      : 0;

    if (currentDeviceStance && currentDeviceStance !== actualStance && cooldownRemainingMs > 0) {
      const mins = Math.ceil(cooldownRemainingMs / 60000);
      showToast(`Vote cooldown active: You can change your stance in ${mins} minute(s).`, 'warning');
      return;
    }

    try {
      setIsSubmittingReaction(true);
      const clientPrk = getOrCreateDevicePrk();
      const nullifierHash = computeNullifierHash(clientPrk, issue.id, actualStance);

      const newNote = await submitCommunityNote(issue.id, {
        text: '',
        stance: actualStance,
        nullifier_hash: nullifierHash,
        lat: userLat !== null ? userLat : issue.lat,
        lon: userLon !== null ? userLon : issue.lon,
        media_urls: [],
        participant_badge: 'Local Eyewitness (<500m)',
      });

      // Update local storage
      const votedIssues = JSON.parse(localStorage.getItem(VOTED_STORAGE_KEY) || '{}');
      votedIssues[issue.id] = { stance: actualStance, timestamp: Date.now() };
      localStorage.setItem(VOTED_STORAGE_KEY, JSON.stringify(votedIssues));

      setHasVotedOnThisIssue(true);
      setCurrentDeviceStance(actualStance);
      setLastVotedTimestamp(Date.now());

      if (onNoteAdded) {
        onNoteAdded(newNote);
      }

      // Refresh issue
      const updated = await fetchIssueById(issue.id);
      if (onIssueUpdate) {
        onIssueUpdate(updated);
      }

      const successLabel =
        actualStance === 'RESOLUTION_VERIFY'
          ? 'Fix verified! Thank you for confirming the repair.'
          : actualStance === 'RESOLUTION_DISPUTE'
          ? 'Fix disputed. Reported back to civic maintenance.'
          : targetAction === 'CONFIRM'
          ? 'Problem confirmed! Corroboration recorded on ledger.'
          : 'Dispute recorded. Thanks for keeping the ledger accurate.';

      showToast(`✓ ${successLabel}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to record reaction', 'error');
    } finally {
      setIsSubmittingReaction(false);
    }
  };

  // Submit Community Note / Reply
  const submitReplyNote = async (
    text: string,
    stance: ActionType,
    photoBase64: string | null
  ): Promise<CommunityNote | null> => {
    if (!issue) return null;
    if (!text.trim() && !photoBase64) return null;

    if (text.trim()) {
      const check = checkTextNeutrality(text);
      if (!check.isValid) {
        throw new Error(check.warning || 'Political entities or personal names are prohibited.');
      }
    }

    const clientPrk = getOrCreateDevicePrk();
    const nullifierHash = computeNullifierHash(clientPrk, issue.id, stance);
    const mediaUrls = photoBase64 ? [photoBase64] : [];

    const newNote = await submitCommunityNote(issue.id, {
      text: text.trim(),
      stance: isNearby ? stance : 'NEUTRAL',
      nullifier_hash: nullifierHash,
      lat: userLat !== null ? userLat : issue.lat,
      lon: userLon !== null ? userLon : issue.lon,
      media_urls: mediaUrls,
      participant_badge: isNearby ? 'Local Eyewitness (<500m)' : 'Community Contributor',
    });

    if (onNoteAdded) {
      onNoteAdded(newNote);
    }

    if (stance !== 'NEUTRAL') {
      const updated = await fetchIssueById(issue.id);
      if (onIssueUpdate) {
        onIssueUpdate(updated);
      }
    }

    return newNote;
  };

  return {
    userLat,
    userLon,
    userDistanceMeters,
    isNearby,
    locationLoading,
    locationError,
    isPermissionDenied,
    showPermissionModal,
    setShowPermissionModal,
    requestLocation,
    refreshLocation,
    hasVotedOnThisIssue,
    currentDeviceStance,
    lastVotedTimestamp,
    isSubmittingReaction,
    actionFeedback,
    showToast,
    submitReaction,
    submitReplyNote,
  };
}

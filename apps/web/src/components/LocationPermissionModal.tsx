'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  X,
  Lock,
  SlidersHorizontal,
  Smartphone,
  Laptop,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  checkLocationPermissionState,
  subscribeToPermissionChanges,
  detectBrowserEnvironment,
  LocationPermissionState,
} from '@/lib/location-service';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
  title?: string;
  reason?: string;
}

export function LocationPermissionModal({
  isOpen,
  onClose,
  onPermissionGranted,
  title = 'Enable Location for Eyewitness Verification',
  reason = 'CivicTrace uses your physical proximity (<500m) to verify reported hazards and prevent spam without collecting personal data.',
}: LocationPermissionModalProps) {
  const [permissionState, setPermissionState] = useState<LocationPermissionState>('prompt');
  const [isChecking, setIsChecking] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{
    isIOS: boolean;
    isAndroid: boolean;
    isChrome: boolean;
    isSafari: boolean;
    isEdge: boolean;
    isFirefox: boolean;
  }>({
    isIOS: false,
    isAndroid: false,
    isChrome: true,
    isSafari: false,
    isEdge: false,
    isFirefox: false,
  });

  useEffect(() => {
    if (!isOpen) return;

    setBrowserInfo(detectBrowserEnvironment());

    // Check current state immediately
    checkLocationPermissionState().then((st) => {
      setPermissionState(st);
      if (st === 'granted') {
        onPermissionGranted?.();
      }
    });

    // Automatically detect when user toggles permission in browser address bar
    const unsubscribe = subscribeToPermissionChanges((newState) => {
      setPermissionState(newState);
      if (newState === 'granted') {
        onPermissionGranted?.();
        setTimeout(() => onClose(), 800);
      }
    });

    return () => unsubscribe();
  }, [isOpen, onClose, onPermissionGranted]);

  if (!isOpen) return null;

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const state = await checkLocationPermissionState();
      setPermissionState(state);
      if (state === 'granted') {
        onPermissionGranted?.();
        setTimeout(() => onClose(), 600);
      } else {
        // Also trigger native prompt if state is still 'prompt'
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {
              setPermissionState('granted');
              onPermissionGranted?.();
              setTimeout(() => onClose(), 600);
            },
            (err) => {
              if (err.code === err.PERMISSION_DENIED) {
                setPermissionState('denied');
              }
            },
            { timeout: 5000, enableHighAccuracy: false }
          );
        }
      }
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E0E2EC] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-[#E8F0FE] p-5 pb-4 border-b border-[#D3E3FD] flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1A73E8] text-white flex items-center justify-center shadow-md">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 id="location-modal-title" className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                {title}
              </h2>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0D652D]" />
                <span className="text-[11px] font-semibold text-[#0D652D]">
                  500m Anonymous Quorum
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#747775] hover:text-[#1F1F1F] p-1.5 rounded-full hover:bg-white/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
            {reason}
          </p>

          {/* Current Permission Status Banner */}
          {permissionState === 'denied' ? (
            <div className="p-3.5 rounded-2xl bg-[#FCE8E6] border border-[#FAD2CF] flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-[#B3261E] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#B3261E]">
                  Location access is currently blocked in your browser
                </p>
                <p className="text-[11px] text-[#5F6368] mt-0.5">
                  Follow the steps below to re-enable location for this website.
                </p>
              </div>
            </div>
          ) : permissionState === 'granted' ? (
            <div className="p-3.5 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-[#0D652D] shrink-0" />
              <p className="text-xs font-bold text-[#0D652D]">
                Location access granted! Synchronizing coordinates...
              </p>
            </div>
          ) : null}

          {/* Step-by-Step Instructions based on detected device */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider">
                How to Enable Location
              </span>
              <span className="text-[11px] font-semibold text-[#1A73E8] bg-[#E8F0FE] px-2 py-0.5 rounded-full flex items-center space-x-1">
                {browserInfo.isIOS || browserInfo.isAndroid ? (
                  <>
                    <Smartphone className="w-3 h-3" />
                    <span>Mobile Browser</span>
                  </>
                ) : (
                  <>
                    <Laptop className="w-3 h-3" />
                    <span>Desktop Browser</span>
                  </>
                )}
              </span>
            </div>

            <div className="space-y-2 text-xs bg-[#F8F9FA] p-3.5 rounded-2xl border border-[#E0E2EC]">
              {browserInfo.isIOS ? (
                // iOS / Safari Steps
                <>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      1
                    </span>
                    <p className="text-[#303030]">
                      Tap the <strong className="text-[#1F1F1F]">aA</strong> or page settings icon in the Safari address bar.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      2
                    </span>
                    <p className="text-[#303030]">
                      Tap <strong className="text-[#1F1F1F]">Website Settings</strong> $\to$ Select <strong className="text-[#1F1F1F]">Location</strong> $\to$ choose <strong className="text-[#0D652D]">Allow</strong>.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      3
                    </span>
                    <p className="text-[#303030]">
                      Tap <strong className="text-[#1A73E8]">Check Permission Again</strong> below.
                    </p>
                  </div>
                </>
              ) : browserInfo.isAndroid ? (
                // Android Chrome Steps
                <>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      1
                    </span>
                    <p className="text-[#303030]">
                      Tap the <Lock className="w-3.5 h-3.5 inline text-[#5F6368]" /> or <SlidersHorizontal className="w-3.5 h-3.5 inline text-[#5F6368]" /> icon beside the website address.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      2
                    </span>
                    <p className="text-[#303030]">
                      Tap <strong className="text-[#1F1F1F]">Permissions</strong> $\to$ <strong className="text-[#1F1F1F]">Location</strong> $\to$ switch to <strong className="text-[#0D652D]">Allow while using the app</strong>.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      3
                    </span>
                    <p className="text-[#303030]">
                      Tap the <strong className="text-[#1A73E8]">Refresh Location</strong> button below.
                    </p>
                  </div>
                </>
              ) : (
                // Desktop Chrome / Edge / Brave / Firefox Steps
                <>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      1
                    </span>
                    <p className="text-[#303030]">
                      Look at the address bar at the top and click the <SlidersHorizontal className="w-3.5 h-3.5 inline text-[#1A73E8]" /> <strong>tune</strong> or <Lock className="w-3.5 h-3.5 inline text-[#1A73E8]" /> <strong>padlock</strong> icon on the left.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      2
                    </span>
                    <p className="text-[#303030]">
                      Find <strong className="text-[#1F1F1F]">Location</strong> and switch it from <strong className="text-[#B3261E]">Blocked</strong> to <strong className="text-[#0D652D]">Allow</strong>.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0">
                      3
                    </span>
                    <p className="text-[#303030]">
                      Click <strong className="text-[#1A73E8]">Check Permission & Refresh</strong> below.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Privacy & Anti-Sybil Details Collapsible */}
          <div className="border-t border-[#E0E2EC] pt-2">
            <button
              type="button"
              onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
              className="w-full flex items-center justify-between text-xs text-[#5F6368] hover:text-[#1F1F1F] py-1 transition-colors"
            >
              <span className="flex items-center space-x-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1A73E8]" />
                <span>Why CivicTrace protects your privacy</span>
              </span>
              {showPrivacyDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showPrivacyDetails && (
              <div className="mt-2 p-3 bg-[#F8F9FA] rounded-xl text-[11px] text-[#444746] space-y-1.5 leading-normal">
                <p>
                  • <strong>Zero Persistent Tracking:</strong> Your location is only read on-demand to calculate distance to the issue.
                </p>
                <p>
                  • <strong>Anti-Sybil Nullifiers:</strong> Only cryptographic hashes derived via WebAuthn PRF are stored on the ledger to prevent double-voting.
                </p>
                <p>
                  • <strong>500m Boundary:</strong> Only local citizens nearby can cast consensus votes, guaranteeing real community accountability.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-[#F8F9FA] p-4 border-t border-[#E0E2EC] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#444746] hover:text-[#1F1F1F] hover:bg-[#ECEEF4] rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className="px-5 py-2 text-xs font-bold bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-xl shadow-sm transition-all flex items-center space-x-2 active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check Permission & Refresh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

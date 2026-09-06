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
  const [selectedTab, setSelectedTab] = useState<'android' | 'ios' | 'desktop'>('android');
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

    const env = detectBrowserEnvironment();
    setBrowserInfo(env);
    if (env.isAndroid) setSelectedTab('android');
    else if (env.isIOS) setSelectedTab('ios');
    else setSelectedTab('desktop');

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

          {/* Step-by-Step Instructions with Platform Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider">
                How to Enable Location:
              </span>
              {/* Platform Selector Tabs */}
              <div className="inline-flex bg-[#F1F3F4] p-0.5 rounded-xl text-[11px] font-semibold text-[#5F6368]">
                <button
                  type="button"
                  onClick={() => setSelectedTab('android')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    selectedTab === 'android'
                      ? 'bg-white text-[#1A73E8] shadow-xs'
                      : 'hover:text-[#1F1F1F]'
                  }`}
                >
                  Android
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab('ios')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    selectedTab === 'ios'
                      ? 'bg-white text-[#1A73E8] shadow-xs'
                      : 'hover:text-[#1F1F1F]'
                  }`}
                >
                  iPhone
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab('desktop')}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    selectedTab === 'desktop'
                      ? 'bg-white text-[#1A73E8] shadow-xs'
                      : 'hover:text-[#1F1F1F]'
                  }`}
                >
                  Desktop
                </button>
              </div>
            </div>

            <div className="space-y-2.5 text-xs bg-[#F8F9FA] p-3.5 rounded-2xl border border-[#E0E2EC]">
              {selectedTab === 'android' ? (
                // Android Chrome / Brave / Edge Steps
                <>
                  {/* Crucial OS-level check highlight */}
                  <div className="bg-[#FEF7E0] border border-[#F29900]/30 rounded-xl p-2.5 text-[#B06000]">
                    <strong className="text-[#874A00] flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Phone App Permission (Crucial):
                    </strong>
                    <span className="leading-relaxed block">
                      If Chrome never pops up, your phone OS blocked the Chrome app itself: Long-press your <strong>Chrome app icon</strong> &rarr; tap <strong>App info (ⓘ)</strong> &rarr; <strong>Permissions</strong> &rarr; <strong>Location</strong> &rarr; choose <strong className="text-[#0D652D]">"Allow only while using the app"</strong>.
                    </span>
                  </div>

                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-start space-x-2.5">
                      <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                        1
                      </span>
                      <p className="text-[#303030]">
                        In Chrome, tap the <strong>tune or padlock icon</strong> (<SlidersHorizontal className="w-3.5 h-3.5 inline text-[#5F6368]" /> or <Lock className="w-3.5 h-3.5 inline text-[#5F6368]" />) to the left of the website URL.
                      </p>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                        2
                      </span>
                      <p className="text-[#303030]">
                        Tap <strong className="text-[#1F1F1F]">Permissions</strong> &rarr; <strong className="text-[#1F1F1F]">Location</strong> &rarr; switch to <strong className="text-[#0D652D]">Allow</strong> (or tap <strong>Reset permissions</strong>).
                      </p>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                        3
                      </span>
                      <p className="text-[#303030]">
                        Make sure your phone's main <strong>GPS / Location</strong> is turned on in the Android swipe-down menu, then tap below.
                      </p>
                    </div>
                  </div>
                </>
              ) : selectedTab === 'ios' ? (
                // iOS / Safari Steps
                <>
                  <div className="bg-[#FEF7E0] border border-[#F29900]/30 rounded-xl p-2.5 text-[#B06000]">
                    <strong className="text-[#874A00] flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      iPhone Settings Check:
                    </strong>
                    <span className="leading-relaxed block">
                      If Safari doesn't ask, check phone settings: Open iPhone <strong>Settings</strong> &rarr; <strong>Privacy & Security</strong> &rarr; <strong>Location Services</strong> &rarr; <strong>Safari Websites</strong> &rarr; select <strong className="text-[#0D652D]">"While Using the App"</strong>.
                    </span>
                  </div>

                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-start space-x-2.5">
                      <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                        1
                      </span>
                      <p className="text-[#303030]">
                        In Safari, tap the <strong className="text-[#1F1F1F]">aA</strong> or page settings button on the left of the address bar.
                      </p>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                        2
                      </span>
                      <p className="text-[#303030]">
                        Tap <strong className="text-[#1F1F1F]">Website Settings</strong> &rarr; <strong className="text-[#1F1F1F]">Location</strong> &rarr; select <strong className="text-[#0D652D]">Allow</strong>.
                      </p>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                        3
                      </span>
                      <p className="text-[#303030]">
                        Tap <strong className="text-[#1A73E8]">Check Permission & Refresh</strong> below.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                // Desktop Chrome / Edge / Brave / Firefox Steps
                <div className="space-y-2">
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                      1
                    </span>
                    <p className="text-[#303030]">
                      Look at the address bar at the top and click the <strong>tune</strong> (<SlidersHorizontal className="w-3.5 h-3.5 inline text-[#1A73E8]" />) or <strong>padlock</strong> (<Lock className="w-3.5 h-3.5 inline text-[#1A73E8]" />) icon to the left of the URL.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                      2
                    </span>
                    <p className="text-[#303030]">
                      Find <strong className="text-[#1F1F1F]">Location</strong> and switch it from <strong className="text-[#B3261E]">Blocked</strong> to <strong className="text-[#0D652D]">Allow</strong>.
                    </p>
                  </div>
                  <div className="flex items-start space-x-2.5">
                    <span className="font-bold text-[#1A73E8] bg-white w-5 h-5 rounded-full flex items-center justify-center border border-[#D3E3FD] shrink-0 text-[11px]">
                      3
                    </span>
                    <p className="text-[#303030]">
                      Click <strong className="text-[#1A73E8]">Check Permission & Refresh</strong> below.
                    </p>
                  </div>
                </div>
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

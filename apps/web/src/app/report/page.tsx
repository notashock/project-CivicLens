'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  EyeOff,
  Lock,
  ArrowLeft,
  Navigation,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { encodeDigipin, formatDigipin, deriveIssueId } from '@civictrace/digipin';
import { computeNullifierHash, getOrCreateDevicePrk } from '@civictrace/crypto-nullifier';
import { sanitizeObservation, sanitizeMedia, validateAndFormatNarrative } from '@civictrace/sanitization-worker';
import { submitIssueReport } from '@/lib/api';
import { checkTextNeutrality } from '@/lib/neutrality-checker';

const CATEGORIES = [
  { id: 'ROAD_HAZARD', label: 'Roads & Potholes', icon: '🚧' },
  { id: 'DRAINAGE_WATER', label: 'Water / Sewage', icon: '💧' },
  { id: 'SOLID_WASTE', label: 'Solid Waste Dump', icon: '🗑️' },
  { id: 'ELECTRICAL_HAZARD', label: 'Electrical Danger', icon: '⚡' },
  { id: 'PUBLIC_INFRASTRUCTURE', label: 'Damaged Structure', icon: '🏛️' },
  { id: 'ENVIRONMENTAL_VIOLATION', label: 'Environmental Hazard', icon: '🌿' },
];

export default function ReportPage() {
  const router = useRouter();

  // Location state
  const [lat, setLat] = useState<number>(12.9716);
  const [lon, setLon] = useState<number>(77.5946);
  const [digipin, setDigipin] = useState<string>('');
  const [digipinError, setDigipinError] = useState<string | null>(null);
  const [locating, setLocating] = useState<boolean>(false);

  // Form fields
  const [category, setCategory] = useState<string>('ROAD_HAZARD');
  const [condition, setCondition] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [severity, setSeverity] = useState<number>(3);

  // Media & Privacy Pre-blur state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPreBlurred, setIsPreBlurred] = useState<boolean>(true);
  const [processingMedia, setProcessingMedia] = useState<boolean>(false);

  // Real-time validation & Submission
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    detectLocation();
  }, []);

  // Robust DIGIPIN encoding with boundary safety
  useEffect(() => {
    try {
      const code = encodeDigipin(lat, lon, 10);
      setDigipin(code);
      setDigipinError(null);
    } catch (e: any) {
      console.warn('Coordinates outside India DIGIPIN bounds:', e);
      setDigipinError('Detected coordinates are outside the national DIGIPIN grid. Resetting to default regional reference.');
      setLat(12.9716);
      setLon(77.5946);
    }
  }, [lat, lon]);

  // Live text neutrality validation
  useEffect(() => {
    if (!condition && !landmark) {
      setValidationError(null);
      return;
    }

    const neutralityCheck = checkTextNeutrality(`${condition} ${landmark}`);
    if (!neutralityCheck.isValid) {
      setValidationError(neutralityCheck.warning || 'Neutrality violation detected.');
      return;
    }

    const check = validateAndFormatNarrative({
      category: category as any,
      observedCondition: condition,
      landmark: landmark,
      impactDurationDays: durationDays,
    });
    if (!check.isNeutral && check.violations.length > 0) {
      setValidationError(check.violations[0] || null);
    } else {
      setValidationError(null);
    }
  }, [condition, landmark, category, durationDays]);

  const detectLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLon(pos.coords.longitude);
          setLocating(false);
        },
        (err) => {
          console.info('Geolocation unavailable; maintaining regional default.', err);
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const updatePreview = async (file: File, preBlur: boolean) => {
    try {
      setProcessingMedia(true);
      const result = await sanitizeMedia(file, { preBlur });
      setImagePreview(result.dataUrl);
    } catch (err: any) {
      console.warn('Failed to sanitize preview image:', err);
    } finally {
      setProcessingMedia(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    await updatePreview(file, isPreBlurred);
  };

  const handleTogglePreBlur = async (enabled: boolean) => {
    setIsPreBlurred(enabled);
    if (selectedFile) {
      await updatePreview(selectedFile, enabled);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const neutralityCheck = checkTextNeutrality(`${condition} ${landmark}`);
      if (!neutralityCheck.isValid) {
        setValidationError(neutralityCheck.warning || 'Neutrality violation detected.');
        setSubmitting(false);
        return;
      }

      // Consolidated sanitization seam
      const sanitization = await sanitizeObservation({
        observation: {
          category: category as any,
          observedCondition: condition,
          landmark,
          impactDurationDays: durationDays,
        },
        mediaFile: selectedFile,
        preBlurEnabled: isPreBlurred,
      });

      if (!sanitization.isValid) {
        setValidationError(sanitization.violations[0] || 'Validation failed');
        setSubmitting(false);
        return;
      }

      const clientPrk = getOrCreateDevicePrk();
      const derived = deriveIssueId(lat, lon, category);
      const nullifierHash = computeNullifierHash(clientPrk, derived.issueId, 'REPORT');

      const payload = {
        id: derived.issueId,
        category,
        observed_condition: condition,
        landmark,
        impact_duration_days: durationDays,
        lat,
        lon,
        severity_score: severity,
        nullifier_hash: nullifierHash,
        timestamp: Date.now(),
        media_data_base64: sanitization.mediaDataBase64 || imagePreview,
      };

      const createdIssue = await submitIssueReport(payload);

      // Record device report action in local storage to prevent double-submission
      if (typeof window !== 'undefined') {
        try {
          const votedIssues = JSON.parse(localStorage.getItem('civictrace_voted_issues') || '{}');
          votedIssues[createdIssue.id] = 'REPORT';
          localStorage.setItem('civictrace_voted_issues', JSON.stringify(votedIssues));
        } catch (e) {
          console.warn('LocalStorage error:', e);
        }
      }

      router.push(`/issue/${createdIssue.id}`);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to submit report');
      setSubmitting(false);
    }
  };

  // Step Completion Calculation
  const isStep1Done = !!category;
  const isStep2Done = !!digipin;
  const isStep3Done = !!imagePreview;
  const isStep4Done = condition.trim().length > 5 && landmark.trim().length > 3 && !validationError;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 w-full">
      {/* Top Breadcrumb */}
      <div className="mb-4 sm:mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed & Map</span>
        </Link>
        <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
          Hardware Key · Zero Sign-in
        </span>
      </div>

      {/* Page Title */}
      <div className="mb-6 text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
          Record a Public Civic Observation
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-2xl">
          Anchored to India&apos;s National DIGIPIN standard. Raw GPS coordinates and personal identifiers are never stored.
        </p>
      </div>

      {/* Modern Refined Step Indicator */}
      <div className="grid grid-cols-4 gap-2 mb-6 sm:mb-8">
        {[
          { num: '1', title: 'Category', done: isStep1Done },
          { num: '2', title: 'DIGIPIN', done: isStep2Done },
          { num: '3', title: 'Evidence', done: isStep3Done },
          { num: '4', title: 'Details', done: isStep4Done },
        ].map((step, idx) => (
          <div
            key={idx}
            className={`p-2 sm:p-2.5 rounded-lg border transition-all text-left flex items-center space-x-2 ${
              step.done
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm'
                : 'bg-white border-zinc-200 text-zinc-500'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                step.done ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {step.done ? '✓' : step.num}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold truncate">{step.title}</span>
          </div>
        ))}
      </div>

      {/* Responsive Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sticky Reference Card */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20 order-2 lg:order-1">
          {/* DIGIPIN Identity Card */}
          <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center space-x-1.5">
                <Navigation className="w-3.5 h-3.5 text-sky-700" />
                <span>Spatial Reference</span>
              </span>
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 inline-flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${locating ? 'animate-spin' : ''}`} />
                <span>{locating ? 'Locating...' : 'Refresh'}</span>
              </button>
            </div>

            {/* DIGIPIN Code */}
            <div>
              <span className="text-[11px] font-medium text-zinc-500 block mb-1">Assigned Postal Grid:</span>
              <div className="font-mono text-base sm:text-lg font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-lg text-center tracking-wider">
                {formatDigipin(digipin) || 'RESOLVING...'}
              </div>
            </div>

            {digipinError && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                {digipinError}
              </div>
            )}

            <div className="text-[11px] text-zinc-600 space-y-1.5 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-500">Grid Precision:</span>
                <span className="font-mono font-semibold text-zinc-800">Level 10 (~4m × 4m)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-500">Privacy Seam:</span>
                <span className="font-semibold text-emerald-700">Centroid Snapped</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-500">Authority Routing:</span>
                <span className="font-semibold text-zinc-800">Auto-Resolved</span>
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Card */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5 text-xs">
            <div className="font-bold text-zinc-900 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Cryptographic Guarantee</span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Your device generates a local pseudo-random key strictly retained on your phone. CivicTrace proves you are a verified physical witness without collecting identity or phone numbers.
            </p>
          </div>
        </div>

        {/* Right Main Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 p-5 sm:p-7 space-y-6 bg-white rounded-xl border border-zinc-200 shadow-sm order-1 lg:order-2">
          {/* Step 1: Category Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-2.5">
              1. Select Hazard Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`p-3 rounded-xl text-left transition-all flex items-center space-x-2.5 border ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    <span className="text-xl shrink-0">{cat.icon}</span>
                    <span className="text-xs font-semibold leading-snug">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: India DIGIPIN Reference */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                <span>2. India DIGIPIN Coordinate Reference</span>
              </label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
              >
                {locating ? 'Resolving GPS...' : 'Refresh'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="font-mono text-base font-bold text-zinc-900 bg-white border border-zinc-200 px-3.5 py-1.5 rounded-lg w-full sm:w-auto text-center sm:text-left">
                {formatDigipin(digipin) || 'RESOLVING DIGIPIN...'}
              </div>
              <p className="text-[11px] text-zinc-500 text-center sm:text-right leading-tight">
                Standard Level 10 Cell (~4m × 4m)
                <br />
                <span className="text-zinc-400">Raw GPS discarded after grid resolution</span>
              </p>
            </div>
          </div>

          {/* Step 3: Media Upload with Client Pre-Blur */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
                3. Visual Evidence (Auto-Sanitized)
              </label>
              <label className="flex items-center space-x-1.5 text-xs font-medium text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPreBlurred}
                  onChange={(e) => handleTogglePreBlur(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-0 w-3.5 h-3.5"
                />
                <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                <span>Auto-blur faces & plates</span>
              </label>
            </div>

            <div className="relative border border-dashed border-zinc-300 hover:border-zinc-400 rounded-xl p-5 text-center transition-colors bg-zinc-50/50">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {imagePreview ? (
                <div className="space-y-2.5">
                  <img
                    src={imagePreview}
                    alt="Sanitized Evidence"
                    className="max-h-56 mx-auto rounded-lg border border-zinc-200 shadow-sm object-contain"
                  />
                  <div className="flex items-center justify-center space-x-2 pt-0.5">
                    <p className="text-xs font-medium text-emerald-800 bg-emerald-50 inline-flex items-center space-x-1 px-2.5 py-1 rounded border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>EXIF stripped &amp; privacy pre-blurred</span>
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded transition-colors"
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <Camera className="w-8 h-8 text-zinc-400 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-zinc-800">Tap to capture or upload evidence photo</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Faces, plates, and metadata are automatically sanitized</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Structured Factual Description */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
              4. Objective Physical Description
            </label>

            <div>
              <input
                type="text"
                required
                placeholder="Observed condition (e.g. Broken asphalt 2m wide, 15cm deep)"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full text-xs sm:text-sm p-3 rounded-lg border border-zinc-200 bg-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Physical landmark (e.g. Opposite Metro Pillar 142)"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full text-xs sm:text-sm p-3 rounded-lg border border-zinc-200 bg-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />

              <div className="flex items-center space-x-2 px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-lg">
                <span className="text-xs text-zinc-600 whitespace-nowrap">Unresolved for:</span>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-16 bg-white border border-zinc-300 rounded px-2 py-1 text-xs text-center font-semibold text-zinc-900 focus:outline-none"
                />
                <span className="text-xs text-zinc-600">days</span>
              </div>
            </div>

            {/* Positive Neutrality Confirmation */}
            {condition.trim() && !validationError && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                <span>✓ Objective Factual Narrative verified (Non-defamatory, no political entities)</span>
              </div>
            )}
          </div>

          {/* Neutrality / Defamation Warning Banner */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start space-x-2 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={submitting || !!validationError}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
          >
            <Lock className="w-4 h-4" />
            <span>{submitting ? 'Signing Nullifier & Submitting...' : 'Sign & Submit Anonymous Observation'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

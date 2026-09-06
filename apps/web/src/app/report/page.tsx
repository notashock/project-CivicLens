'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  EyeOff,
  ArrowLeft,
  Navigation,
  RefreshCw,
  Check,
  ChevronRight,
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { encodeDigipin, formatDigipin, deriveIssueId } from '@civictrace/digipin';
import { computeNullifierHash, getOrCreateDevicePrk } from '@civictrace/crypto-nullifier';
import { sanitizeObservation, sanitizeMedia, validateAndFormatNarrative, checkTextNeutrality } from '@civictrace/sanitization-worker';
import { submitIssueReport } from '@/lib/api';

const CATEGORIES = [
  { id: 'ROAD_HAZARD', label: 'Roads & Potholes', icon: '🚧' },
  { id: 'DRAINAGE_WATER', label: 'Water & Sewage', icon: '💧' },
  { id: 'SOLID_WASTE', label: 'Garbage & Waste', icon: '🗑️' },
  { id: 'ELECTRICAL_HAZARD', label: 'Electricity Hazard', icon: '⚡' },
  { id: 'PUBLIC_INFRASTRUCTURE', label: 'Damaged Amenities', icon: '🏛️' },
  { id: 'ENVIRONMENTAL_VIOLATION', label: 'Pollution / Trees', icon: '🌿' },
];

const DURATION_PRESETS = [
  { label: 'Today', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '1 Week', days: 7 },
  { label: '2+ Weeks', days: 14 },
  { label: '1+ Month', days: 30 },
];

export default function ReportPage() {
  const router = useRouter();

  // 3-Step Simple Stepper
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Location & DIGIPIN state
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

  // Validation & Submission
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    try {
      const code = encodeDigipin(lat, lon, 10);
      setDigipin(code);
      setDigipinError(null);
    } catch (e: any) {
      console.warn('Coordinates outside India DIGIPIN bounds:', e);
      setDigipinError('Could not resolve location code. Using default city reference.');
      setLat(12.9716);
      setLon(77.5946);
    }
  }, [lat, lon]);

  useEffect(() => {
    if (!condition && !landmark) {
      setValidationError(null);
      return;
    }

    const neutralityCheck = checkTextNeutrality(`${condition} ${landmark}`);
    if (!neutralityCheck.isValid) {
      setValidationError(neutralityCheck.warning || 'Please describe the problem factually without personal names or accusations.');
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
          console.info('Geolocation unavailable; using default reference.', err);
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
      console.warn('Failed to prepare preview image:', err);
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
        setValidationError(neutralityCheck.warning || 'Please describe the problem factually.');
        setSubmitting(false);
        return;
      }

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
        setValidationError(sanitization.violations[0] || 'Please check your inputs and try again.');
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
      setValidationError(err.message || 'Failed to submit report. Please try again.');
      setSubmitting(false);
    }
  };

  const progressPercent = activeStep === 1 ? 33 : activeStep === 2 ? 66 : 100;

  return (
    <div className="max-w-3xl mx-auto px-3.5 sm:px-6 py-3 sm:py-8 w-full pb-32 md:pb-12">
      {/* Top Header Row with Back Navigation & Privacy Stamp */}
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 py-1.5 px-3 rounded-full bg-white border border-[#E0E2EC] text-xs font-semibold text-[#5F6368] hover:text-[#1F1F1F] shadow-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Map</span>
        </Link>
        <span className="text-[10px] sm:text-[11px] font-semibold text-[#0F9D58] bg-[#E6F4EA] px-2.5 sm:px-3 py-1 rounded-full border border-[#CEEAD6] flex items-center gap-1 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Anonymous · Zero Sign-in</span>
        </span>
      </div>

      {/* Title */}
      <div className="mb-3 sm:mb-5">
        <h1 className="text-lg sm:text-2xl font-bold text-[#1F1F1F] tracking-tight">
          Report a Problem
        </h1>
        <p className="text-xs text-[#5F6368] mt-0.5 max-w-xl leading-relaxed">
          Log an infrastructure hazard. Your identity is never recorded.
        </p>
      </div>

      {/* Visual Stepper & Progress Bar */}
      <div className="mb-4 bg-white p-2 sm:p-3 rounded-2xl border border-[#E0E2EC] shadow-xs">
        {/* Step Progress Line */}
        <div className="w-full bg-[#F1F3F4] h-1.5 rounded-full overflow-hidden mb-2">
          <div
            className="bg-[#1A73E8] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Stepper Buttons (Responsive Labels) */}
        <div className="flex items-center justify-between gap-1">
          {[
            { step: 1, short: 'Category', full: '1. Problem & Location' },
            { step: 2, short: 'Photo', full: '2. Add Photo' },
            { step: 3, short: 'Details', full: '3. Description' },
          ].map((item) => {
            const isActive = activeStep === item.step;
            const isDone = activeStep > item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveStep(item.step as any)}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#E8F0FE] text-[#041E49] shadow-xs'
                    : isDone
                    ? 'text-[#0F9D58] hover:bg-[#F1F3F4]'
                    : 'text-[#747775] hover:bg-[#F8F9FA]'
                }`}
              >
                <span
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 ${
                    isActive
                      ? 'bg-[#1A73E8] text-white'
                      : isDone
                      ? 'bg-[#0F9D58] text-white'
                      : 'bg-[#F1F3F4] text-[#747775]'
                  }`}
                >
                  {isDone ? '✓' : item.step}
                </span>
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.full}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* STEP 1: Location & Type */}
        {activeStep === 1 && (
          <div className="bg-white rounded-3xl border border-[#E0E2EC] p-4 sm:p-7 shadow-sm space-y-5 sm:space-y-6 animate-in fade-in duration-200">
            {/* Category Grid */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2.5">
                What kind of problem is it?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`p-3 sm:p-4 rounded-2xl text-left transition-all flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 border ${
                        isSelected
                          ? 'bg-[#E8F0FE] text-[#041E49] border-[#1A73E8] shadow-sm ring-1 ring-[#1A73E8]'
                          : 'bg-white hover:bg-[#F8F9FA] text-[#1F1F1F] border-[#E0E2EC]'
                      }`}
                    >
                      <span className="text-2xl sm:text-2xl shrink-0">{cat.icon}</span>
                      <span className="text-xs sm:text-xs font-semibold leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile-Optimized Location Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F8F9FA] border border-[#E0E2EC] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5F6368] flex items-center space-x-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#1A73E8]" />
                  <span>Location (DIGIPIN Code)</span>
                </span>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locating}
                  className="m3-btn-tonal text-[11px] py-1 px-2.5 text-[#041E49] shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${locating ? 'animate-spin' : ''}`} />
                  <span>{locating ? 'Locating...' : 'Update GPS'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#E0E2EC]">
                <div className="font-mono text-base sm:text-lg font-bold text-[#1F1F1F] tracking-wide text-center sm:text-left flex items-center justify-center sm:justify-start space-x-2">
                  {locating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#1A73E8]" />
                      <span className="text-xs font-semibold text-[#5F6368] font-sans">Acquiring GPS fix...</span>
                    </>
                  ) : (
                    formatDigipin(digipin) || 'Finding location code...'
                  )}
                </div>
                <span className="text-[11px] text-[#0F9D58] font-medium flex items-center justify-center sm:justify-end gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>4m × 4m Postal Grid</span>
                </span>
              </div>

              {digipinError && (
                <div className="p-2.5 rounded-xl bg-[#FEF7E0] border border-[#F29900]/30 text-[#B06000] text-xs font-medium">
                  {digipinError}
                </div>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="w-full sm:w-auto m3-btn-primary text-xs sm:text-sm py-2.5 px-6 font-semibold flex items-center justify-center gap-1.5"
              >
                <span>Continue to Photo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Add Photo */}
        {activeStep === 2 && (
          <div className="bg-white rounded-3xl border border-[#E0E2EC] p-4 sm:p-7 shadow-sm space-y-5 sm:space-y-6 animate-in fade-in duration-200">
            {/* Header & Privacy Switch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                  Add a Photo (Optional)
                </label>
                <span className="text-[11px] text-[#5F6368]">Step 2 of 3</span>
              </div>
              <p className="text-xs text-[#5F6368]">
                A photo helps authorities verify and fix the issue much faster.
              </p>

              {/* Privacy Pre-blur Toggle Card */}
              <div
                onClick={() => handleTogglePreBlur(!isPreBlurred)}
                className="p-3 rounded-2xl bg-[#F8F9FA] border border-[#E0E2EC] flex items-center justify-between cursor-pointer hover:bg-[#F1F3F4] transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1F1F1F]">Auto-blur faces & plates</div>
                    <div className="text-[11px] text-[#5F6368]">Protects privacy before uploading</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPreBlurred}
                  onChange={(e) => handleTogglePreBlur(e.target.checked)}
                  className="rounded text-[#1A73E8] focus:ring-0 w-4 h-4 ml-2 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Photo Capture & Upload Box */}
            <div className="relative border-2 border-dashed border-[#C4C7C5] hover:border-[#1A73E8] rounded-2xl p-5 sm:p-8 text-center transition-colors bg-[#F8F9FA]/60">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {processingMedia ? (
                <div className="py-8 sm:py-10 flex flex-col items-center justify-center space-y-2 animate-in fade-in">
                  <RefreshCw className="w-8 h-8 text-[#1A73E8] animate-spin mb-1" />
                  <p className="text-xs sm:text-sm font-semibold text-[#1F1F1F]">
                    Sanitizing & Pre-blurring photo...
                  </p>
                  <p className="text-[11px] text-[#5F6368]">
                    Stripping metadata and applying on-device privacy safeguards
                  </p>
                </div>
              ) : imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview}
                    alt="Uploaded photo preview"
                    className="max-h-56 sm:max-h-64 mx-auto rounded-xl border border-[#E0E2EC] shadow-sm object-contain"
                  />
                  <div className="flex items-center justify-center space-x-2.5 pt-1">
                    <span className="text-[11px] sm:text-xs font-medium text-[#0F9D58] bg-[#E6F4EA] inline-flex items-center space-x-1 px-3 py-1 rounded-full border border-[#CEEAD6]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Privacy Protected</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setSelectedFile(null);
                      }}
                      className="text-[11px] sm:text-xs font-semibold text-[#D93025] hover:bg-[#FCE8E6] px-3 py-1 rounded-full border border-[#FCE8E6] transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 sm:py-8 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center mb-2.5">
                    <Camera className="w-6 h-6 text-[#1A73E8]" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[#1F1F1F]">
                    Tap to take or choose photo
                  </p>
                  <p className="text-[11px] text-[#5F6368] mt-1">
                    Camera or gallery photo from device
                  </p>
                </div>
              )}
            </div>

            {/* Step 2 Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="m3-btn-outlined text-xs sm:text-sm py-2.5 px-4 sm:px-5 font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="m3-btn-primary text-xs sm:text-sm py-2.5 px-5 sm:px-6 font-semibold flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
              >
                <span>Continue to Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Details & Submit */}
        {activeStep === 3 && (
          <div className="bg-white rounded-3xl border border-[#E0E2EC] p-4 sm:p-7 shadow-sm space-y-5 sm:space-y-6 animate-in fade-in duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                  Describe the Problem
                </label>
                <span className="text-[11px] text-[#5F6368]">Step 3 of 3</span>
              </div>

              {/* Observed Condition */}
              <div>
                <label className="text-xs font-semibold text-[#1F1F1F] block mb-1">
                  What is the issue? <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deep pothole across left lane, broken drain cover"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="m3-input text-xs sm:text-sm"
                />
              </div>

              {/* Landmark */}
              <div>
                <label className="text-xs font-semibold text-[#1F1F1F] block mb-1">
                  Nearby landmark or street name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Opposite City Hospital, near Bus Stop 14"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="m3-input text-xs sm:text-sm"
                />
              </div>

              {/* Duration Presets */}
              <div>
                <label className="text-xs font-semibold text-[#1F1F1F] block mb-1.5">
                  How long has this issue been here?
                </label>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {DURATION_PRESETS.map((preset) => {
                    const isSelected = durationDays === preset.days;
                    return (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() => setDurationDays(preset.days)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                          isSelected
                            ? 'bg-[#E8F0FE] text-[#041E49] border-[#1A73E8]'
                            : 'bg-white text-[#5F6368] border-[#E0E2EC] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Friendly feedback */}
              {condition.trim() && !validationError && (
                <div className="p-3 rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] text-[#0D652D] text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#0F9D58]" />
                  <span>Looks good! Clear and factual.</span>
                </div>
              )}

              {/* Helpful warning if needed */}
              {validationError && (
                <div className="p-3 rounded-2xl bg-[#FCE8E6] border border-[#FAD2CF] text-[#B3261E] text-xs font-medium flex items-start space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#D93025] mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Final Stepper Navigation & Submit */}
            <div className="pt-3 border-t border-[#E0E2EC] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="m3-btn-outlined text-xs sm:text-sm py-2.5 px-4 sm:px-5 font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={submitting || !!validationError || !condition.trim()}
                className="m3-btn-primary text-xs sm:text-sm py-2.5 px-6 font-semibold flex-1 sm:flex-initial flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {submitting && <RefreshCw className="w-4 h-4 animate-spin text-white" />}
                <span>{submitting ? 'Submitting Report...' : 'Submit Report'}</span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

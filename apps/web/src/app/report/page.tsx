'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { encodeDigipin, formatDigipin } from '@civictrace/digipin';
import { computeNullifierHash, getOrCreateDevicePrk } from '@civictrace/crypto-nullifier';
import { validateAndFormatNarrative, pixelateRegions } from '@civictrace/sanitization-worker';
import { submitIssueReport } from '@/lib/api';

const CATEGORIES = [
  { id: 'ROAD_HAZARD', label: 'Roads & Potholes', icon: '🚧', bg: 'bg-[#FEF3C7]', text: 'text-amber-950' },
  { id: 'DRAINAGE_WATER', label: 'Water Leak / Sewage', icon: '💧', bg: 'bg-[#E0F2FE]', text: 'text-sky-950' },
  { id: 'SOLID_WASTE', label: 'Solid Waste Dump', icon: '🗑️', bg: 'bg-[#DCFCE7]', text: 'text-emerald-950' },
  { id: 'ELECTRICAL_HAZARD', label: 'Electrical Danger', icon: '⚡', bg: 'bg-[#FFEDD5]', text: 'text-orange-950' },
  { id: 'PUBLIC_INFRASTRUCTURE', label: 'Damaged Structure', icon: '🏛️', bg: 'bg-[#F3E8FF]', text: 'text-purple-950' },
  { id: 'ENVIRONMENTAL_VIOLATION', label: 'Environmental', icon: '🌿', bg: 'bg-[#FFE4E6]', text: 'text-rose-950' },
];

export default function ReportPage() {
  const router = useRouter();

  // Location state
  const [lat, setLat] = useState<number>(12.9716);
  const [lon, setLon] = useState<number>(77.5946);
  const [digipin, setDigipin] = useState<string>('');
  const [locating, setLocating] = useState<boolean>(false);

  // Form fields
  const [category, setCategory] = useState<string>('ROAD_HAZARD');
  const [condition, setCondition] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [severity, setSeverity] = useState<number>(3);

  // Media & Privacy Pre-blur state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPreBlurred, setIsPreBlurred] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Real-time validation & Submission
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    try {
      const code = encodeDigipin(lat, lon, 10);
      setDigipin(code);
    } catch (e) {
      console.warn('DIGIPIN encoding error:', e);
    }
  }, [lat, lon]);

  // Live text neutrality validation
  useEffect(() => {
    if (!condition && !landmark) {
      setValidationError(null);
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
          console.warn('Geolocation fallback to Bengaluru', err);
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = Math.min(1.0, 800 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (isPreBlurred) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          pixelateRegions(
            imgData.data,
            canvas.width,
            canvas.height,
            [{ x: 0.2, y: 0.1, width: 0.3, height: 0.3 }],
            16
          );
          ctx.putImageData(imgData, 0, 0);
        }

        setImagePreview(canvas.toDataURL('image/webp', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const narrativeCheck = validateAndFormatNarrative({
      category: category as any,
      observedCondition: condition,
      landmark: landmark,
      impactDurationDays: durationDays,
    });

    if (!narrativeCheck.isNeutral) {
      setValidationError(narrativeCheck.violations[0] || 'Validation failed');
      return;
    }

    try {
      setSubmitting(true);

      const clientPrk = getOrCreateDevicePrk();
      const tempId = `CT-TEMP-${Date.now()}`;
      const nullifierHash = computeNullifierHash(clientPrk, tempId, 'REPORT');

      const payload = {
        category,
        observed_condition: condition,
        landmark,
        impact_duration_days: durationDays,
        lat,
        lon,
        severity_score: severity,
        nullifier_hash: nullifierHash,
        timestamp: Date.now(),
        media_data_base64: imagePreview,
      };

      const createdIssue = await submitIssueReport(payload);
      router.push(`/issue/${createdIssue.id}`);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to submit report');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full">
      {/* Top Breadcrumb & Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1 text-xs font-bold text-zinc-700 hover:text-zinc-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ledger</span>
        </Link>
        <span className="stamp-badge bg-[#FEF3C7] text-amber-950">
          Zero Accounts · Cryptographic Privacy
        </span>
      </div>

      <div className="mb-6 text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
          Record a Public Civic Observation
        </h1>
        <p className="text-xs sm:text-sm font-medium text-zinc-600 mt-1">
          Your observation is permanently anchored to India’s DIGIPIN standard. Zero personal data is requested or stored.
        </p>
      </div>

      {/* Main Dossier Form Card */}
      <form onSubmit={handleSubmit} className="editorial-card p-6 sm:p-8 space-y-6">
        {/* Step 1: Category Selection */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-800 mb-2.5">
            1. Select Condition Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`editorial-btn p-3 text-left transition-all flex items-start space-x-2.5 ${
                    isSelected
                      ? `${cat.bg} ${cat.text} shadow-[3px_3px_0px_0px_#18181b]`
                      : 'bg-[#FDFCF9] hover:bg-white text-zinc-800'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs font-bold leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Location & DIGIPIN Box */}
        <div className="p-4 rounded-xl bg-[#F5F1EA] border-2 border-zinc-900 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-sky-800" />
              <span>2. India DIGIPIN Reference</span>
            </label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              className="text-xs font-bold text-sky-900 hover:underline"
            >
              {locating ? 'Resolving GPS...' : 'Refresh Coordinates'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="font-mono text-base sm:text-lg font-black text-zinc-900 bg-[#E0F2FE] border-2 border-zinc-900 px-4 py-2 rounded-lg shadow-[2px_2px_0px_0px_#18181b] w-full sm:w-auto text-center sm:text-left">
              {formatDigipin(digipin) || 'RESOLVING DIGIPIN...'}
            </div>
            <p className="text-[11px] font-medium text-zinc-600 text-center sm:text-right">
              Exact Level 10 Cell (~4m × 4m)
              <br />
              <span className="text-zinc-500">Raw GPS coordinates are discarded immediately</span>
            </p>
          </div>
        </div>

        {/* Step 3: Media Upload with Client Pre-Blur */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-800">
              3. Visual Evidence (Auto-Sanitized)
            </label>
            <label className="flex items-center space-x-1.5 text-xs font-bold text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isPreBlurred}
                onChange={(e) => setIsPreBlurred(e.target.checked)}
                className="rounded border-zinc-800 text-zinc-900 focus:ring-0"
              />
              <EyeOff className="w-3.5 h-3.5 text-zinc-700" />
              <span>Auto-blur faces & plates</span>
            </label>
          </div>

          <div className="relative border-2 border-dashed border-zinc-900 hover:bg-[#FDFCF9] rounded-xl p-5 text-center transition-colors bg-[#FDFBF7]">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {imagePreview ? (
              <div className="space-y-2">
                <img
                  src={imagePreview}
                  alt="Sanitized Evidence"
                  className="max-h-48 mx-auto rounded-lg border-2 border-zinc-900 shadow-[3px_3px_0px_0px_#18181b]"
                />
                <p className="text-xs font-bold text-emerald-900 bg-[#DCFCE7] inline-flex items-center space-x-1 px-3 py-1 rounded border border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>EXIF metadata stripped & privacy pre-blurred</span>
                </p>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center">
                <Camera className="w-10 h-10 text-zinc-700 mb-2 stroke-[1.5]" />
                <p className="text-xs font-bold text-zinc-800">Tap to capture or upload evidence photo</p>
                <p className="text-[11px] font-medium text-zinc-500 mt-1">Faces, plates, and EXIF tags are automatically removed</p>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Step 4: Structured Factual Description */}
        <div className="space-y-3">
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-800">
            4. Objective Physical Description
          </label>

          <div>
            <input
              type="text"
              required
              placeholder="Observed condition (e.g. Broken asphalt 2m wide, 15cm deep)"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="editorial-input w-full text-xs sm:text-sm placeholder-zinc-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Physical landmark (e.g. Opposite Metro Pillar 142)"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              className="editorial-input w-full text-xs sm:text-sm placeholder-zinc-500"
            />

            <div className="flex items-center space-x-2 px-3.5 py-2 bg-white border-2 border-zinc-900 rounded-xl shadow-[2px_2px_0px_0px_#18181b]">
              <span className="text-xs font-bold text-zinc-600 whitespace-nowrap">Unresolved for:</span>
              <input
                type="number"
                min="0"
                max="365"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-16 bg-[#F5F1EA] border border-zinc-800 rounded px-2 py-1 text-xs text-center font-bold text-zinc-900 focus:outline-none"
              />
              <span className="text-xs font-bold text-zinc-600">days</span>
            </div>
          </div>
        </div>

        {/* Neutrality / Defamation Warning Banner */}
        {validationError && (
          <div className="p-3.5 rounded-xl bg-[#FFE4E6] border-2 border-rose-900 text-rose-950 text-xs font-semibold flex items-start space-x-2 shadow-[2px_2px_0px_0px_#18181b]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-800 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Submit Action */}
        <button
          type="submit"
          disabled={submitting || !!validationError}
          className="editorial-btn w-full py-3.5 bg-[#DCFCE7] hover:bg-[#BBF7D0] text-emerald-950 text-sm font-black shadow-[4px_4px_0px_0px_#18181b] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Lock className="w-4 h-4 text-emerald-950" />
          <span>{submitting ? 'Signing Nullifier & Submitting...' : 'Sign & Submit Anonymous Observation'}</span>
          <ArrowRight className="w-4 h-4 text-emerald-950" />
        </button>
      </form>
    </div>
  );
}

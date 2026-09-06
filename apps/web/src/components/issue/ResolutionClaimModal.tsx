'use client';

import React, { useState } from 'react';
import { Wrench, X, User, Building, Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import { Issue, submitResolutionClaim } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

interface ResolutionClaimModalProps {
  issue: Issue;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Issue) => void;
  showToast?: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export function ResolutionClaimModal({
  issue,
  isOpen,
  onClose,
  onSuccess,
  showToast: propShowToast,
}: ResolutionClaimModalProps) {
  const { showToast: contextShowToast } = useToast();
  const showToast = propShowToast || contextShowToast;
  const [claimantName, setClaimantName] = useState<string>('');
  const [claimantRole, setClaimantRole] = useState<'CITIZEN' | 'AUTHORITY'>('CITIZEN');
  const [claimNotes, setClaimNotes] = useState<string>('');
  const [claimPhotoBase64, setClaimPhotoBase64] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClaimPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setClaimError('Photo size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setClaimPhotoBase64(reader.result as string);
      setClaimError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRectification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!claimPhotoBase64) {
      setClaimError('Solid photographic proof is required to submit a rectification claim.');
      return;
    }

    if (!claimNotes.trim()) {
      setClaimError('Please describe the work that was done to fix the issue.');
      return;
    }

    const submitterLabel = claimantName.trim()
      ? `${claimantName.trim()} (${claimantRole === 'CITIZEN' ? 'Public Citizen' : 'Authority'})`
      : claimantRole === 'CITIZEN'
      ? 'Public Citizen / Local Resident'
      : 'Municipal Authority / Contractor';

    try {
      setClaiming(true);
      setClaimError(null);

      const updated = await submitResolutionClaim(issue.id, {
        claimant_id: submitterLabel,
        notes: claimNotes.trim(),
        proof_photo_base64: claimPhotoBase64,
      });

      onSuccess(updated);
      onClose();
      setClaimNotes('');
      setClaimPhotoBase64(null);
      showToast('✓ Rectification submitted with photo proof! Community verification window active.', 'success');
    } catch (err: any) {
      setClaimError(err.message || 'Failed to submit rectification claim.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-[#E0E2EC] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E0E2EC] pb-3">
          <div className="flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-[#1A73E8]" />
            <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F]">Mark Issue as Fixed with Photo Proof</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#5F6368] hover:bg-[#F1F3F4]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#5F6368] leading-relaxed">
          Anyone—local citizens, volunteers, or municipal staff—can report that a problem has been rectified. Solid photographic proof is required so nearby neighbors can inspect and verify.
        </p>

        <form onSubmit={handleSubmitRectification} className="space-y-3.5">
          {/* Role Picker: Citizen vs Authority */}
          <div>
            <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Your Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setClaimantRole('CITIZEN')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-1.5 transition-all ${
                  claimantRole === 'CITIZEN'
                    ? 'bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]'
                    : 'bg-[#F8F9FA] text-[#5F6368] border-[#E0E2EC]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Public Citizen / Volunteer</span>
              </button>
              <button
                type="button"
                onClick={() => setClaimantRole('AUTHORITY')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-1.5 transition-all ${
                  claimantRole === 'AUTHORITY'
                    ? 'bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]'
                    : 'bg-[#F8F9FA] text-[#5F6368] border-[#E0E2EC]'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Agency / Contractor</span>
              </button>
            </div>
          </div>

          {/* Submitter Name / Agency */}
          <div>
            <label className="block text-xs font-medium text-[#5F6368] mb-1">
              Name / Organization <span className="text-[10px] text-[#747775]">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder={claimantRole === 'CITIZEN' ? 'e.g. Local Resident / Neighborhood Group' : 'e.g. Road Works Maintenance Dept'}
              value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)}
              className="m3-input text-xs"
            />
          </div>

          {/* Work Done Description */}
          <div>
            <label className="block text-xs font-medium text-[#5F6368] mb-1">
              What was done to fix this? <span className="text-[#D93025]">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Cleared the garbage pile and swept the street / Filled the pothole with tar"
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              className="m3-input text-xs"
            />
          </div>

          {/* Solid Photographic Proof Upload */}
          <div>
            <label className="block text-xs font-medium text-[#5F6368] mb-1">
              Solid Photographic Proof of Fix <span className="text-[#D93025]">*</span>
            </label>
            <div className="flex items-center space-x-3">
              <label className="cursor-pointer border-2 border-dashed border-[#1A73E8] bg-[#E8F0FE]/40 hover:bg-[#E8F0FE]/80 p-3 rounded-2xl flex items-center space-x-2 text-xs font-semibold text-[#1A73E8] transition-colors">
                <Camera className="w-4 h-4" />
                <span>Upload Clear Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleClaimPhotoSelect}
                  className="hidden"
                />
              </label>
              {claimPhotoBase64 && (
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#E0E2EC]">
                  <img src={claimPhotoBase64} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setClaimPhotoBase64(null)}
                    className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {claimError && (
            <div className="p-2.5 rounded-xl bg-[#FCE8E6] text-[#B3261E] text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{claimError}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E0E2EC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#5F6368] hover:bg-[#F1F3F4] rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={claiming || !claimPhotoBase64 || !claimNotes.trim()}
              className="m3-btn-primary text-xs py-2 px-5 disabled:opacity-50 flex items-center space-x-1.5"
            >
              {claiming && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
              <span>{claiming ? 'Submitting Fix Proof...' : 'Publish Fix Proof'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import {
  MessageSquare,
  Radio,
  User,
  ShieldAlert,
  Image as ImageIcon,
  Send,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { CommunityNote } from '@/lib/api';

interface CommunityNotesThreadProps {
  notes: CommunityNote[];
  loadingNotes: boolean;
  isNearby: boolean;
  replyInputRef: React.RefObject<HTMLTextAreaElement | null>;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  replyPhotoBase64: string | null;
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: () => void;
  onSubmitReply: (e: React.FormEvent) => void;
  submittingReply: boolean;
  replySuccess: string | null;
  replyError: string | null;
  neutralityWarning: string | null;
}

export function CommunityNotesThread({
  notes,
  loadingNotes,
  isNearby,
  replyInputRef,
  replyText,
  onReplyTextChange,
  replyPhotoBase64,
  onPhotoSelect,
  onRemovePhoto,
  onSubmitReply,
  submittingReply,
  replySuccess,
  replyError,
  neutralityWarning,
}: CommunityNotesThreadProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* INLINE THREAD REPLY COMPOSER */}
      <div className="bg-white rounded-2xl border border-[#E0E2EC] p-3.5 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3">
        <form onSubmit={onSubmitReply} className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#F1F3F4] text-[#5F6368] flex items-center justify-center font-bold text-xs shrink-0 mt-1">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-2">
              <textarea
                ref={replyInputRef}
                rows={2}
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder={
                  isNearby
                    ? 'Post a reply or on-site observation to this thread...'
                    : 'Post a public community note or question...'
                }
                className="w-full border-b border-[#E0E2EC] focus:border-[#1A73E8] p-2 text-xs sm:text-sm resize-none outline-hidden bg-transparent placeholder-[#747775]"
              />

              {neutralityWarning && (
                <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#B3261E] text-xs flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#D93025]" />
                  <span>{neutralityWarning}</span>
                </div>
              )}

              {/* Attached Photo Preview */}
              {replyPhotoBase64 && (
                <div className="relative inline-block border border-[#E0E2EC] rounded-xl p-1 bg-[#F8F9FA]">
                  <img src={replyPhotoBase64} alt="Attached preview" className="w-20 h-20 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={onRemovePhoto}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-[#1F1F1F] text-white rounded-full hover:bg-[#D93025]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Reply Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="reply-photo"
                    className="p-1.5 rounded-full hover:bg-[#E8F0FE] text-[#1A73E8] cursor-pointer"
                    title="Attach photo"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <input
                      id="reply-photo"
                      type="file"
                      accept="image/*"
                      onChange={onPhotoSelect}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-[#747775]">
                    {isNearby ? 'Posting as Nearby Resident' : 'Posting as Observer'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submittingReply || (!replyText.trim() && !replyPhotoBase64) || !!neutralityWarning}
                  className="m3-btn-primary text-xs py-1.5 px-4 font-semibold disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submittingReply ? (
                    <Radio className="w-3 h-3 animate-spin text-white" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  <span>{submittingReply ? 'Posting...' : 'Reply'}</span>
                </button>
              </div>
            </div>
          </div>

          {replySuccess && (
            <div className="p-2 rounded-xl bg-[#E6F4EA] text-[#0D652D] text-xs font-semibold flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-[#0F9D58]" />
              <span>{replySuccess}</span>
            </div>
          )}
          {replyError && (
            <div className="p-2 rounded-xl bg-[#FCE8E6] text-[#B3261E] text-xs font-semibold">
              {replyError}
            </div>
          )}
        </form>
      </div>

      {/* COMMUNITY REPLIES THREAD STREAM */}
      <div className="bg-white rounded-2xl border border-[#E0E2EC] p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E0E2EC] pb-2">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#1A73E8]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F1F1F]">Community Thread</h3>
          </div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#041E49]">
            {notes.length} replies
          </span>
        </div>

        {loadingNotes ? (
          <div className="space-y-3.5 animate-pulse pt-2" aria-label="Loading thread replies...">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-[#F8F9FA] border border-[#E0E2EC]">
                <div className="w-7 h-7 rounded-full bg-[#E0E2EC] shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-28 bg-[#E0E2EC] rounded-full" />
                    <div className="h-3 w-16 bg-[#E0E2EC] rounded" />
                  </div>
                  <div className="h-3.5 w-full bg-[#E0E2EC] rounded" />
                  <div className="h-3.5 w-3/4 bg-[#E0E2EC] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="py-8 text-center bg-[#F8F9FA] rounded-2xl border border-dashed border-[#C4C7C5] p-6">
            <MessageSquare className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#5F6368]">No replies yet</p>
            <p className="text-[11px] text-[#747775] mt-1">Be the first to reply or confirm what you see on-site.</p>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:top-4 before:bottom-4 before:left-4 before:w-0.5 before:bg-[#E0E2EC]">
            {notes.map((n) => (
              <div key={n.id} className="relative pl-9 space-y-1.5">
                {/* Thread avatar */}
                <div className="absolute left-1.5 top-0 w-6 h-6 rounded-full bg-[#E8F0FE] text-[#1A73E8] font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-xs">
                  {n.participant_badge ? n.participant_badge.slice(0, 1).toUpperCase() : 'U'}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="font-bold text-xs text-[#1F1F1F] truncate">
                      {n.participant_badge || 'Local Resident'}
                    </span>
                    {n.is_consensus_verified && (
                      <span className="text-[10px] font-semibold text-[#0D652D] bg-[#E6F4EA] px-1.5 py-0.2 rounded-sm">
                        &lt;500m
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#747775]">
                    {new Date(n.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Stance tag if vote included */}
                {n.stance && n.stance !== 'NEUTRAL' && (
                  <div className="pt-0.5">
                    {n.stance === 'CONFIRM' || n.stance === 'RESOLUTION_VERIFY' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F4EA] text-[#0D652D]">
                        <ThumbsUp className="w-2.5 h-2.5 text-[#0F9D58]" />
                        <span>{n.stance === 'CONFIRM' ? 'Confirmed Issue' : 'Verified Fix'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FCE8E6] text-[#B3261E]">
                        <ThumbsDown className="w-2.5 h-2.5 text-[#D93025]" />
                        <span>{n.stance === 'DISPUTE' ? 'Disputed Issue' : 'Disputed Fix'}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Note message */}
                {n.text && (
                  <p className="text-xs sm:text-sm text-[#1F1F1F] leading-relaxed whitespace-pre-wrap">
                    {n.text}
                  </p>
                )}

                {/* Attached photos */}
                {n.media_urls && n.media_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {n.media_urls.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => window.open(url, '_blank')}
                        className="relative overflow-hidden rounded-xl border border-[#E0E2EC] bg-white cursor-pointer group max-w-[200px]"
                      >
                        <img src={url} alt="Evidence" className="max-h-36 w-auto object-cover hover:opacity-90 transition-opacity" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

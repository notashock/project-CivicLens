'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, MapPin, Building, Wrench, ShieldCheck, Check, Users as UsersIcon } from 'lucide-react';
import { Issue } from '@/lib/api';

interface IssueLifecycleTrackerProps {
  issue: Issue;
}

export function IssueLifecycleTracker({ issue }: IssueLifecycleTrackerProps) {
  const [showLifecycleDetails, setShowLifecycleDetails] = useState<boolean>(false);

  // Status Lifecycle Stage is precalculated at the client network domain seam
  const currentStage = issue.lifecycleStage ?? 1;

  const STAGES = [
    { step: 1, label: 'Reported', icon: MapPin },
    { step: 2, label: 'Confirmed', icon: UsersIcon },
    { step: 3, label: 'In Progress', icon: Building },
    { step: 4, label: 'Fix Reported', icon: Wrench },
    { step: 5, label: 'Verified', icon: ShieldCheck },
  ];

  const currentStageObj = STAGES.find((s) => s.step === currentStage) || STAGES[0];

  return (
    <div className="bg-white rounded-2xl border border-[#E0E2EC] p-3 sm:p-4 shadow-sm">
      {/* Compact Mobile Layout: 1-Line Progress Bar + Active Stage Pill */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6368]">
              Stage {currentStage}/5:
            </span>
            <span className="text-xs font-bold text-[#1A73E8]">
              {currentStageObj.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowLifecycleDetails(!showLifecycleDetails)}
            className="text-[11px] font-semibold text-[#1A73E8] flex items-center space-x-0.5"
            aria-label="Lifecycle info"
          >
            <span>{showLifecycleDetails ? 'Close' : 'Info'}</span>
            {showLifecycleDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 5-segment mini progress line */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          {STAGES.map((s) => {
            const isCompleted = currentStage > s.step || (currentStage === 5 && s.step === 5);
            const isCurrent = currentStage === s.step;
            return (
              <div
                key={s.step}
                className={`h-1.5 rounded-full transition-all ${
                  isCurrent
                    ? 'bg-[#1A73E8]'
                    : isCompleted
                    ? 'bg-[#0F9D58]'
                    : 'bg-[#E0E2EC]'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Desktop Layout (Full 5-stage Stepper) */}
      <div className="hidden sm:block space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#1A73E8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1F1F1F]">Issue Lifecycle</h2>
          </div>
          <button
            onClick={() => setShowLifecycleDetails(!showLifecycleDetails)}
            className="text-[11px] font-semibold text-[#1A73E8] hover:underline flex items-center space-x-0.5"
          >
            <span>{showLifecycleDetails ? 'Hide details' : 'How it works'}</span>
            {showLifecycleDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 5-Stage Stepper Bar */}
        <div className="grid grid-cols-5 gap-1 pt-1 text-center">
          {STAGES.map((item) => {
            const isCompleted = currentStage > item.step || (currentStage === 5 && item.step === 5);
            const isCurrent = currentStage === item.step;
            const IconComponent = item.icon;

            return (
              <div key={item.step} className="flex flex-col items-center space-y-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-[#1A73E8] text-white shadow-sm ring-2 ring-[#D3E3FD]'
                      : isCompleted
                      ? 'bg-[#E6F4EA] text-[#0D652D] border border-[#CEEAD6]'
                      : 'bg-[#F1F3F4] text-[#747775]'
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <IconComponent className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-[11px] leading-tight ${
                    isCurrent ? 'font-bold text-[#1F1F1F]' : isCompleted ? 'font-medium text-[#0D652D]' : 'text-[#747775]'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional details on expansion */}
      {showLifecycleDetails && (
        <div className="mt-2 pt-2 border-t border-[#E0E2EC] text-xs text-[#5F6368] space-y-1.5 leading-relaxed">
          <p>
            <strong>Consensus Quorum:</strong> Action votes and photo verifications require physical presence within 500m to eliminate fake reports and online brigading.
          </p>
          <p>
            <strong>Resolution:</strong> Once repair proof is submitted, nearby residents verify the physical fix within 72h to close the record.
          </p>
        </div>
      )}
    </div>
  );
}

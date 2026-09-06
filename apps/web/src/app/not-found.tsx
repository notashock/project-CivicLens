'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#F8F9FA]">
      <div className="bg-white rounded-3xl border border-[#E0E2EC] p-8 max-w-md w-full space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center mx-auto">
          <Compass className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-[#5F6368] bg-[#F1F3F4] px-2.5 py-0.5 rounded-full">
            404
          </span>
          <h1 className="text-xl font-bold text-[#1F1F1F] mt-1">
            Page Not Found
          </h1>
          <p className="text-xs text-[#5F6368]">
            The page or civic report you are looking for does not exist.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="m3-btn-primary inline-flex items-center space-x-2 text-xs py-2 px-5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Map</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

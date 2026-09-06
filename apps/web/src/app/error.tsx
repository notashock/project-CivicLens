'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('CivicTrace App Error:', error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#F8F9FA]">
      <div className="bg-white rounded-3xl border border-[#E0E2EC] p-8 max-w-md w-full space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[#FEF7E0] text-[#EA8600] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[#1F1F1F]">
            Something Went Wrong
          </h1>
          <p className="text-xs text-[#5F6368]">
            An unexpected error occurred while loading this page.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="m3-btn-primary inline-flex items-center space-x-1.5 text-xs py-2 px-5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="m3-btn-outlined text-xs py-2 px-5"
          >
            <span>Return to Map</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

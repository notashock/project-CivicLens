'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#FBF9F5]">
      <div className="editorial-card p-8 max-w-md w-full bg-white space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-700 mx-auto stroke-[1.5]" />
        <div className="space-y-1">
          <span className="stamp-badge bg-[#FEF3C7] text-amber-950 text-xs">
            System Protocol Notice
          </span>
          <h1 className="text-xl font-black text-zinc-900 mt-2">
            Ledger Synchronization Error
          </h1>
          <p className="text-xs text-zinc-600">
            An unexpected error occurred while communicating with the local ledger.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            onClick={() => reset()}
            className="editorial-btn inline-flex items-center space-x-1.5 px-4 py-2 bg-[#DCFCE7] text-emerald-950 text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="editorial-btn px-4 py-2 bg-white text-zinc-800 text-xs font-bold"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

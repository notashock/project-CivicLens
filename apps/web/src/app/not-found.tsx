import React from 'react';
import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#FBF9F5]">
      <div className="editorial-card p-8 max-w-md w-full bg-white space-y-4">
        <Compass className="w-12 h-12 text-zinc-800 mx-auto stroke-[1.5]" />
        <div className="space-y-1">
          <span className="stamp-badge bg-[#FFE4E6] text-rose-950 text-xs">
            404 · Uncharted Coordinates
          </span>
          <h1 className="text-xl font-black text-zinc-900 mt-2">
            Record Not Found
          </h1>
          <p className="text-xs text-zinc-600">
            The civic record or spatial coordinate you are trying to view does not exist in the public ledger.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="editorial-btn inline-flex items-center space-x-2 px-4 py-2 bg-[#DCFCE7] text-emerald-950 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Spatial Ledger</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

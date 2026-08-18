'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, MapPin, PlusCircle, Radio, Sparkles } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#FDFCF9] border-b-2 border-zinc-900 px-4 lg:px-8 py-3.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] border-2 border-zinc-900 flex items-center justify-center shadow-[3px_3px_0px_0px_#18181b] group-hover:-translate-y-0.5 group-active:translate-y-0.5 transition-all">
            <Radio className="w-5 h-5 text-zinc-900" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-xl tracking-tight text-zinc-900">
                Civic<span className="underline decoration-wavy decoration-[#FDE68A] decoration-2 underline-offset-4">Trace</span>
              </span>
              <span className="stamp-badge bg-[#E0F2FE] text-sky-950">
                DIGIPIN v1
              </span>
            </div>
            <p className="text-[11px] font-medium text-zinc-600 hidden sm:block">
              Zero Accounts · Community Verified · The People’s Voice
            </p>
          </div>
        </Link>

        {/* Action Badges and Button */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="hidden md:flex items-center space-x-1.5 stamp-badge bg-[#DCFCE7] text-emerald-950">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
            <span>Hardware Nullifier Protected</span>
          </div>

          <Link
            href="/report"
            className="editorial-btn flex items-center space-x-2 px-4 py-2 bg-[#FEF3C7] hover:bg-[#FDE68A] text-amber-950 text-xs sm:text-sm"
          >
            <PlusCircle className="w-4 h-4 text-amber-950 stroke-[2.5]" />
            <span>Report Anonymously</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

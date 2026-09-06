'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Map, ListFilter } from 'lucide-react';
import { useSearchFilter } from '@/context/SearchFilterContext';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { viewMode } = useSearchFilter();
  const currentView = viewMode || searchParams.get('view') || 'map';

  // When displaying an issue, bottom navbar is dynamically replaced with the issue action dock
  if (pathname.startsWith('/issue/')) {
    return null;
  }

  // Display on mobile and tablet screen sizes (hidden on lg and above where split screen is active)
  return (
    <nav className="lg:hidden shrink-0 w-full bg-white border-t border-[#E0E2EC] shadow-[0px_-1px_6px_0px_rgba(0,0,0,0.06)] px-6 py-1.5 pb-safe z-30">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Map Destination */}
        <Link
          href="/?view=map"
          className="flex flex-col items-center justify-center py-1 px-4 group"
        >
          <div
            className={`w-14 h-7 rounded-full flex items-center justify-center transition-all ${
              pathname === '/' && currentView === 'map'
                ? 'bg-[#E8F0FE] text-[#1A73E8]'
                : 'text-[#5F6368] group-hover:bg-[#F1F3F4]'
            }`}
          >
            <Map className="w-5 h-5" />
          </div>
          <span
            className={`text-[11px] mt-0.5 font-medium ${
              pathname === '/' && currentView === 'map'
                ? 'text-[#1A73E8] font-semibold'
                : 'text-[#5F6368]'
            }`}
          >
            Map
          </span>
        </Link>

        {/* Ledger Feed Destination */}
        <Link
          href="/?view=ledger"
          className="flex flex-col items-center justify-center py-1 px-4 group"
        >
          <div
            className={`w-14 h-7 rounded-full flex items-center justify-center transition-all ${
              pathname === '/' && currentView === 'ledger'
                ? 'bg-[#E8F0FE] text-[#1A73E8]'
                : 'text-[#5F6368] group-hover:bg-[#F1F3F4]'
            }`}
          >
            <ListFilter className="w-5 h-5" />
          </div>
          <span
            className={`text-[11px] mt-0.5 font-medium ${
              pathname === '/' && currentView === 'ledger'
                ? 'text-[#1A73E8] font-semibold'
                : 'text-[#5F6368]'
            }`}
          >
            Ledger
          </span>
        </Link>
      </div>
    </nav>
  );
};

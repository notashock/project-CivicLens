'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Plus,
  Radio,
  MapPin,
  Lock,
  Layers,
  Info,
  ExternalLink,
  X,
  FileCheck2,
  Search,
  Filter,
  ChevronDown,
  ArrowLeft,
  Navigation,
  RotateCw,
  Share2,
  Check,
  Map,
  ListFilter
} from 'lucide-react';
import { useSearchFilter } from '@/context/SearchFilterContext';
import { useActiveIssue } from '@/context/ActiveIssueContext';
import { ISSUE_CATEGORIES } from '@/lib/issue-feed-model';

export const Navbar: React.FC = () => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const {
    search,
    setSearch,
    category,
    setCategory,
    clearSearch,
    viewMode,
    setViewMode,
  } = useSearchFilter();
  const { activeIssue, headerActions } = useActiveIssue();
  const isIssuePage = pathname.startsWith('/issue/');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowInfoModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (pathname !== '/') {
      router.push('/');
    }
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    if (pathname !== '/') {
      router.push('/');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[1100] w-full bg-white/95 backdrop-blur-md shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)]">
        <div className="px-3.5 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Dynamic Issue Header or Brand Identity */}
          {isIssuePage ? (
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 py-0.5">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/');
                  }
                }}
                className="flex items-center space-x-1 sm:space-x-1.5 text-[#1F1F1F] hover:text-[#1A73E8] py-1.5 px-2 sm:px-2.5 rounded-xl hover:bg-[#F1F3F4] transition-colors group shrink-0"
                aria-label="Back to Issues"
                title="Back to Feed"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[#1F1F1F] group-hover:text-[#1A73E8] transition-colors" />
                <span className="font-bold text-xs sm:text-sm hidden xs:inline">Back</span>
              </button>

              <div className="h-4 w-px bg-[#E0E2EC] shrink-0" />

              {activeIssue ? (
                <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
                  <span className="font-mono text-[11px] sm:text-xs font-bold text-[#1F1F1F] bg-[#F1F3F4] px-2 py-0.5 rounded-lg shrink-0 border border-[#E0E2EC]">
                    {activeIssue.digipin_code || activeIssue.id.slice(0, 10)}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#1F1F1F] truncate hidden sm:inline max-w-[200px] md:max-w-xs lg:max-w-md">
                    {activeIssue.description_neutral}
                  </span>
                  {activeIssue.statusPresentation && (
                    <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${activeIssue.statusPresentation.badgeClass}`}>
                      {activeIssue.statusPresentation.label}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-[#5F6368]">
                  <span className="animate-pulse font-medium">Issue Record</span>
                </div>
              )}
            </div>
          ) : (
            <Link href="/" className="flex items-center space-x-2.5 group min-w-0 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center transition-transform group-hover:scale-105">
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-[#1A73E8]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-base sm:text-xl tracking-tight text-[#1F1F1F]">
                    Civic<span className="text-[#1A73E8]">Trace</span>
                  </span>
                  {/* <span className="hidden lg:inline-flex text-[10px] font-semibold bg-[#F1F3F4] text-[#444746] px-2 py-0.5 rounded-full border border-[#E0E2EC]">
                    DIGIPIN
                  </span> */}
                </div>
                <p className="text-[11px] text-[#5F6368] hidden lg:block truncate font-normal">
                  Anonymous Civic Reports
                </p>
              </div>
            </Link>
          )}

          {/* Desktop Search Bar & Category Filter Dropdown (Hidden on Mobile & Tablet < 1024px) */}
          {!isIssuePage && (
            <div className="hidden lg:flex items-center space-x-2 flex-1 max-w-lg lg:max-w-xl mx-2 lg:mx-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#747775]" />
                <input
                  type="text"
                  placeholder="Search DIGIPIN or keyword..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#F8F9FA] hover:bg-[#F1F3F4] border border-[#C4C7C5] focus:border-[#1A73E8] focus:bg-white rounded-full focus:outline-none focus:ring-1 focus:ring-[#1A73E8] text-[#1F1F1F] placeholder-[#747775] transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#747775] hover:text-[#1F1F1F]"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Dropdown right beside Search Bar */}
              <div className="relative shrink-0">
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="appearance-none pl-8 pr-8 py-1.5 text-xs font-semibold bg-[#F8F9FA] hover:bg-[#F1F3F4] text-[#1F1F1F] border border-[#C4C7C5] focus:border-[#1A73E8] rounded-full focus:outline-none focus:ring-1 focus:ring-[#1A73E8] cursor-pointer transition-all"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6368] pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6368] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Action Hub: Replaced with Location & Share on Issue Page */}
          {isIssuePage ? (
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              {headerActions && (
                <>
                  {/* GPS Proximity / Refresh Button */}
                  <button
                    type="button"
                    onClick={headerActions.refreshLocation}
                    disabled={headerActions.locationLoading}
                    className={`text-[10px] sm:text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border transition-all flex items-center space-x-1.5 active:scale-95 shadow-2xs ${
                      headerActions.isNearby
                        ? 'bg-[#E6F4EA] text-[#0D652D] border-[#CEEAD6] hover:bg-[#D7EEDF]'
                        : headerActions.userDistanceMeters !== null
                        ? 'bg-[#F8F9FA] text-[#5F6368] border-[#E0E2EC] hover:bg-[#E9EEF6] hover:text-[#1A73E8]'
                        : 'bg-[#E8F0FE] text-[#1A73E8] border-[#D3E3FD] hover:bg-[#D3E3FD]'
                    }`}
                    title="Click to check GPS permission and refresh your location"
                    aria-label="Refresh GPS location"
                  >
                    {headerActions.locationLoading ? (
                      <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-[#1A73E8]" />
                    ) : (
                      <Navigation
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                          headerActions.isNearby ? 'text-[#0F9D58]' : ''
                        }`}
                      />
                    )}
                    <span>
                      {headerActions.locationLoading
                        ? 'Refreshing...'
                        : headerActions.isNearby
                        ? 'Nearby (<500m)'
                        : headerActions.userDistanceMeters !== null
                        ? `~${Math.round(headerActions.userDistanceMeters)}m`
                        : 'GPS'}
                    </span>
                    <RotateCw
                      className={`w-2.5 h-2.5 opacity-60 ml-0.5 ${
                        headerActions.locationLoading ? 'animate-spin' : ''
                      }`}
                    />
                  </button>

                  {/* Share Report Button */}
                  <button
                    type="button"
                    onClick={headerActions.handleShare}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-[#E0E2EC] hover:bg-[#F1F3F4] text-[#5F6368] hover:text-[#1F1F1F] flex items-center justify-center transition-colors shadow-2xs shrink-0"
                    title="Share report link"
                    aria-label="Share report"
                  >
                    {headerActions.copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-[#0F9D58]" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              {/* How it Works / Privacy Modal Trigger */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="m3-btn-tonal text-xs py-1.5 px-2.5 sm:px-3.5 text-[#041E49] flex items-center space-x-1.5"
                title="How it Works & Privacy"
                aria-label="How it works"
              >
                <ShieldCheck className="w-4 h-4 text-[#0F9D58] shrink-0" />
                <span className="hidden sm:inline">How It Works</span>
              </button>

              {/* Universal Top Report CTA (Visible across all screens) */}
              <Link
                href="/report"
                className="m3-btn-primary text-xs sm:text-sm py-1.5 px-3 sm:px-4 font-semibold shadow-sm flex items-center space-x-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Report<span className="hidden sm:inline"> Issue</span></span>
              </Link>
            </div>
          )}
        </div>
        </div>

        {/* Mobile & Tablet Search Bar, Filter Dropdown & Map/Feed Toggle (Unified in Navbar component) */}
        {!isIssuePage && pathname === '/' && (
          <div className="lg:hidden px-3.5 sm:px-6 pb-2.5 pt-0.5">
            <div className="flex items-center gap-2 max-w-7xl mx-auto">
              {/* Search Field */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#747775]" />
                <input
                  type="text"
                  placeholder="Search DIGIPIN or keyword..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs bg-[#F8F9FA] hover:bg-[#F1F3F4] border border-[#C4C7C5] focus:border-[#1A73E8] focus:bg-white rounded-full focus:outline-none focus:ring-1 focus:ring-[#1A73E8] text-[#1F1F1F] placeholder-[#747775] transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747775] hover:text-[#1F1F1F]"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="appearance-none pl-7 sm:pl-8 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs font-semibold bg-[#F8F9FA] hover:bg-[#F1F3F4] text-[#1F1F1F] border border-[#C4C7C5] focus:border-[#1A73E8] rounded-full focus:outline-none focus:ring-1 focus:ring-[#1A73E8] cursor-pointer transition-all max-w-[130px] sm:max-w-[180px] truncate"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F6368] pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6368] pointer-events-none" />
              </div>

              {/* Tablet Map vs Feed Toggle Pill */}
              <div className="hidden sm:flex items-center bg-[#F1F3F4] p-0.5 rounded-full shrink-0 border border-[#E0E2EC]">
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`flex items-center space-x-1 py-1 px-3 rounded-full text-xs font-semibold transition-all ${
                    viewMode === 'map' ? 'bg-[#1A73E8] text-white shadow-xs' : 'text-[#5F6368] hover:text-[#1F1F1F]'
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ledger')}
                  className={`flex items-center space-x-1 py-1 px-3 rounded-full text-xs font-semibold transition-all ${
                    viewMode === 'ledger' ? 'bg-[#1A73E8] text-white shadow-xs' : 'text-[#5F6368] hover:text-[#1F1F1F]'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Feed</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Material 3 Privacy & How it Works Dialog Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-m3-elevation-4 border border-[#E0E2EC] p-6 text-[#1F1F1F]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E0E2EC]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-[#E8F0FE] flex items-center justify-center text-[#1A73E8]">
                  <ShieldCheck className="w-5 h-5 text-[#1A73E8]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F1F1F]">
                    How CivicTrace Works
                  </h3>
                  <p className="text-xs text-[#5F6368]">
                    Anonymous, community-verified public reporting
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4] hover:text-[#1F1F1F] transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs sm:text-sm text-[#444746] leading-relaxed">
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E9EEF6] space-y-1.5">
                <div className="flex items-center space-x-2 font-semibold text-[#1A73E8]">
                  <Lock className="w-4 h-4" />
                  <span>100% Anonymous & Private</span>
                </div>
                <p className="text-xs text-[#5F6368] leading-normal">
                  You never need to log in, create an account, or share your phone number. Your phone confirms your vote privately without revealing who you are.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E9EEF6] space-y-1.5">
                <div className="flex items-center space-x-2 font-semibold text-[#0F9D58]">
                  <MapPin className="w-4 h-4" />
                  <span>Exact Location via India DIGIPIN</span>
                </div>
                <p className="text-xs text-[#5F6368] leading-normal">
                  Issues are matched to India&apos;s official postal grid code (DIGIPIN). City authorities know exactly where the issue is, but your personal GPS location is never saved or tracked.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E9EEF6] space-y-1.5">
                <div className="flex items-center space-x-2 font-semibold text-[#EA8600]">
                  <FileCheck2 className="w-4 h-4" />
                  <span>Privacy on Photos & Descriptions</span>
                </div>
                <p className="text-xs text-[#5F6368] leading-normal">
                  Faces and vehicle license plates in photos are automatically blurred on your device before uploading to ensure everyone&apos;s privacy.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E0E2EC] flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="m3-btn-tonal text-xs px-5 py-2 font-semibold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

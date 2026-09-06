'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Droplets,
  Trash2,
  Zap,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Compass,
  X,
  Check,
} from 'lucide-react';
import { fetchIssues, fetchStats, subscribeToRealtimeEvents, Issue, normalizeIssue } from '@/lib/api';
import { MapComponent } from '@/components/MapComponent';
import { formatDigipin } from '@civictrace/digipin';
import {
  filterIssues,
  computeFeedSummary,
  ISSUE_CATEGORIES,
  MapBoundingBox,
} from '@/lib/issue-feed-model';
import { useSearchFilter } from '@/context/SearchFilterContext';

function HomeContent() {
  const { search, category, viewMode } = useSearchFilter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [activeBounds, setActiveBounds] = useState<MapBoundingBox | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Subscribe to live Real-time SSE event stream
    const unsubscribe = subscribeToRealtimeEvents((eventType, data) => {
      if (eventType === 'ISSUE_CREATED') {
        const normalized = normalizeIssue(data);
        setIssues((prev) => {
          if (prev.some((i) => i.id === normalized.id)) return prev;
          return [normalized, ...prev];
        });
        setStats((prev: any) =>
          prev
            ? {
                ...prev,
                total_issues: (prev.total_issues || 0) + 1,
              }
            : prev
        );
      } else if (eventType === 'ISSUE_VERIFIED') {
        setIssues((prev) =>
          prev.map((item) =>
            item.id === data.id
              ? normalizeIssue({ ...item, ...data })
              : item
          )
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [category]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [issuesData, statsData] = await Promise.all([
        fetchIssues(category, 'ALL'),
        fetchStats(),
      ]);
      setIssues(issuesData);
      setStats(statsData);
      if (issuesData.length > 0 && !selectedIssue) {
        if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setSelectedIssue(issuesData[0] || null);
        }
      }
    } catch (err) {
      console.error('Failed to load issues', err);
    } finally {
      setLoading(false);
    }
  };

  // Base filtered by search & category for map rendering
  const categoryIssues = filterIssues(issues, {
    category,
    search,
  });

  // Scoped to visible map bounds if activeBounds is set
  const filteredIssues = filterIssues(issues, {
    category,
    search,
    bounds: activeBounds,
  });

  const summary = computeFeedSummary(filteredIssues);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden bg-[#F8F9FA] relative">
      {/* Main Responsive Split-View Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-0 overflow-hidden relative">
        {/* Left Map Pane (7 of 12 columns on desktop) */}
        <div
          className={`h-full relative overflow-hidden bg-[#F1F3F4] ${
            viewMode === 'map' ? 'block' : 'hidden lg:block'
          } lg:col-span-7 xl:col-span-8 border-b lg:border-b-0 lg:border-r border-[#E0E2EC]`}
        >
          <MapComponent
            issues={categoryIssues}
            selectedIssue={selectedIssue}
            onSelectIssue={(issue) => {
              setSelectedIssue(issue);
            }}
            activeBounds={activeBounds}
            onSearchArea={(bounds) => {
              setActiveBounds(bounds);
            }}
            onResetArea={() => {
              setActiveBounds(null);
            }}
            onLocateUser={(lat, lon, bounds) => {
              setActiveBounds(bounds);
            }}
            loading={loading}
            className="w-full h-full min-h-[300px] rounded-none border-0 overflow-hidden bg-white relative"
          />

          {/* M3 Floating Live Dateline Chip (Desktop) */}
          <div className="absolute top-4 left-4 z-[400] hidden sm:flex items-center space-x-3 px-4 py-2 bg-white/95 backdrop-blur-md border border-[#E0E2EC] rounded-full shadow-m3-elevation-1 text-xs pointer-events-auto">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D58] animate-pulse"></span>
              <span className="font-medium text-[#5F6368]">Active:</span>
              <span className="font-bold text-[#1F1F1F]">{summary.activeCount}</span>
            </div>
            <div className="h-3.5 w-px bg-[#E0E2EC]"></div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-[#5F6368]">Fixed:</span>
              <span className="font-bold text-[#0F9D58]">{summary.resolvedCount}</span>
            </div>
          </div>

          {/* M3 Modal Bottom Sheet for Pin Preview on Mobile */}
          {selectedIssue && (
            <div className="lg:hidden absolute bottom-4 left-3 right-3 z-[450] bg-white rounded-3xl p-4 shadow-m3-elevation-3 border border-[#E0E2EC] animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold bg-[#E8F0FE] text-[#041E49] px-2.5 py-0.5 rounded-full border border-[#D3E3FD]">
                    {formatDigipin(selectedIssue.digipin_code)}
                  </span>
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${selectedIssue.statusPresentation.badgeClass}`}>
                    {selectedIssue.statusPresentation.label}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
                  aria-label="Dismiss pin card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#1F1F1F] line-clamp-2 mb-3 font-normal leading-relaxed">
                {selectedIssue.description_neutral}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-[#E0E2EC] text-xs">
                <span className="text-[11px] font-semibold text-[#0F9D58] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{selectedIssue.verified_confirm_count} Confirmed</span>
                </span>
                <Link
                  href={`/issue/${selectedIssue.id}`}
                  className="m3-btn-primary text-xs py-1.5 px-4 font-semibold"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Ledger Feed Pane (5 of 12 columns on desktop) */}
        <div
          className={`h-full flex flex-col min-h-0 ${
            viewMode === 'ledger' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-5 xl:col-span-4 bg-[#F8F9FA]`}
        >
          {/* Feed Header - Sticking flush below the top navbar with zero gap */}
          <div className="shrink-0 px-3.5 sm:px-4 py-2.5 bg-[#F8F9FA] border-b border-[#E0E2EC] flex items-center justify-between z-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#5F6368] flex items-center space-x-2">
              <Compass className="w-4 h-4 text-[#1A73E8]" />
              <span>Community Reports</span>
              <span className="font-mono text-[11px] bg-[#E8F0FE] text-[#041E49] px-2 py-0.5 rounded-full font-semibold">
                {filteredIssues.length}
              </span>
            </h2>

            {/* Map Area Filter Active Pill & Reset */}
            {activeBounds && (
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#1A73E8] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full border border-[#D3E3FD] animate-in fade-in">
                <span>In Map View</span>
                <button
                  type="button"
                  onClick={() => setActiveBounds(null)}
                  className="text-[#5F6368] hover:text-[#1F1F1F] p-0.5 rounded-full hover:bg-white/50 transition-colors"
                  title="Show all reports city-wide"
                  aria-label="Reset map bounds filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Feed List Container */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-2.5 pb-24">
            {loading ? (
              <div className="space-y-3 animate-pulse" aria-label="Loading reports...">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3.5 sm:p-4 rounded-2xl border border-[#E0E2EC] bg-white space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="h-5 w-24 bg-[#E0E2EC] rounded-full" />
                        <div className="h-5 w-16 bg-[#E0E2EC] rounded-full" />
                      </div>
                      <div className="h-3.5 w-14 bg-[#E0E2EC] rounded" />
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                      <div className="h-4 w-full bg-[#E0E2EC] rounded" />
                      <div className="h-4 w-4/5 bg-[#E0E2EC] rounded" />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F3F4]">
                      <div className="h-3.5 w-24 bg-[#E0E2EC] rounded" />
                      <div className="h-5 w-20 bg-[#E0E2EC] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white border border-[#E0E2EC] rounded-2xl shadow-sm my-6">
              <div className="w-12 h-12 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center mb-3">
                <MapPin className="w-6 h-6 text-[#1A73E8]" />
              </div>
              <h3 className="text-sm font-bold text-[#1F1F1F]">No Reports Found</h3>
              <p className="text-xs text-[#5F6368] mt-1 max-w-xs leading-relaxed">
                {search
                  ? `No reports found matching "${search}". Clear your search to view all.`
                  : 'No issues currently reported in this category.'}
              </p>
              <Link
                href="/report"
                className="mt-4 m3-btn-tonal text-xs px-4 py-2 font-semibold"
              >
                <span>Report an Issue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredIssues.map((issue) => {
                const isSelected = selectedIssue?.id === issue.id;
                const pres = issue.statusPresentation;

                return (
                  <Link
                    key={issue.id}
                    href={`/issue/${issue.id}`}
                    onClick={() => setSelectedIssue(issue)}
                    className={`block p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-white border-[#1A73E8] shadow-m3-elevation-2 ring-1 ring-[#1A73E8]'
                        : 'bg-white hover:bg-[#FAFAFA] border-[#E0E2EC] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04)] hover:shadow-md'
                    }`}
                  >
                    {/* Status & DIGIPIN Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-[#1F1F1F] bg-[#F1F3F4] px-2 py-0.5 rounded-md">
                        {formatDigipin(issue.digipin_code)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${pres.badgeClass}`}>
                        {pres.label}
                      </span>
                    </div>

                    {/* Factual Narrative */}
                    <p className="text-xs text-[#1F1F1F] line-clamp-2 leading-relaxed mb-2.5 font-normal">
                      {issue.description_neutral}
                    </p>

                    {/* Bottom Metadata & Quorum Stats */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F3F4] text-[11px] text-[#5F6368]">
                      <span className="truncate max-w-[160px] font-medium">
                        {issue.jurisdiction_authority || 'Local Jurisdiction'}
                      </span>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="font-semibold text-[#0F9D58] bg-[#E6F4EA] px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>{issue.verified_confirm_count}</span>
                        </span>
                        {issue.verified_dispute_count > 0 && (
                          <span className="font-semibold text-[#D93025] bg-[#FCE8E6] px-2 py-0.5 rounded-full">
                            ✕ {issue.verified_dispute_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden bg-[#F8F9FA] animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-0 overflow-hidden">
        <div className="hidden lg:block lg:col-span-7 xl:col-span-8 bg-[#EAECEF] relative" />
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col p-4 space-y-3 bg-[#F8F9FA]">
          <div className="h-8 w-44 bg-[#E0E2EC] rounded-full mb-2" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-white border border-[#E0E2EC] space-y-3">
              <div className="h-5 w-28 bg-[#E0E2EC] rounded-full" />
              <div className="h-4 w-full bg-[#E0E2EC] rounded" />
              <div className="h-4 w-3/4 bg-[#E0E2EC] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

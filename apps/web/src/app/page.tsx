'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Droplets,
  Trash2,
  Zap,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Filter,
  ShieldCheck,
  ArrowRight,
  Map as MapIcon,
  List,
  Compass,
  X
} from 'lucide-react';
import { fetchIssues, fetchStats, subscribeToRealtimeEvents, Issue } from '@/lib/api';
import { MapComponent } from '@/components/MapComponent';
import { formatDigipin } from '@civictrace/digipin';
import {
  filterIssues,
  getStatusPresentation,
  computeFeedSummary,
} from '@/lib/issue-feed-model';

const CATEGORIES = [
  { id: 'ALL', label: 'All Hazards', icon: Filter },
  { id: 'ROAD_HAZARD', label: 'Roads & Potholes', icon: AlertTriangle },
  { id: 'DRAINAGE_WATER', label: 'Water & Drainage', icon: Droplets },
  { id: 'SOLID_WASTE', label: 'Solid Waste', icon: Trash2 },
  { id: 'ELECTRICAL_HAZARD', label: 'Electrical', icon: Zap },
  { id: 'PUBLIC_INFRASTRUCTURE', label: 'Public Amenities', icon: Building2 },
];

export default function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchDigipin, setSearchDigipin] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'ledger'>('map');

  useEffect(() => {
    loadData();

    // Subscribe to live Real-time SSE event stream
    const unsubscribe = subscribeToRealtimeEvents((eventType, data) => {
      if (eventType === 'ISSUE_CREATED') {
        setIssues((prev) => {
          if (prev.some((i) => i.id === data.id)) return prev;
          return [data, ...prev];
        });
        setStats((prev: any) => prev ? {
          ...prev,
          total_issues: (prev.total_issues || 0) + 1
        } : prev);
      } else if (eventType === 'ISSUE_VERIFIED') {
        setIssues((prev) =>
          prev.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  status: data.status,
                  consensus_score: data.consensus_score,
                  verified_confirm_count: data.verified_confirm_count,
                  verified_dispute_count: data.verified_dispute_count,
                }
              : item
          )
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [issuesData, statsData] = await Promise.all([
        fetchIssues(selectedCategory, 'ALL'),
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

  // Pure filtering through tested deep module
  const filteredIssues = filterIssues(issues, {
    category: selectedCategory,
    search: searchDigipin,
  });

  const summary = computeFeedSummary(issues);

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] lg:h-[calc(100vh-65px)] overflow-hidden bg-[#FBF9F5] relative">
      {/* Top Refined Filter & Search Bar */}
      <div className="bg-white border-b border-zinc-200 px-3 sm:px-6 py-2 shrink-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar touch-pan-x">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-sm ring-1 ring-zinc-800'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input with Clear Action */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter by DIGIPIN or text..."
              value={searchDigipin}
              onChange={(e) => setSearchDigipin(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-full focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white text-zinc-900 placeholder-zinc-400 transition-colors"
            />
            {searchDigipin && (
              <button
                onClick={() => setSearchDigipin('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace: Split-View Dual Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 overflow-hidden">
        {/* Map Pane */}
        <div
          className={`h-full relative overflow-hidden bg-zinc-100 ${
            viewMode === 'map' ? 'block' : 'hidden lg:block'
          } lg:col-span-7 xl:col-span-8 border-b lg:border-b-0 lg:border-r border-zinc-200`}
        >
          <MapComponent
            issues={filteredIssues}
            selectedIssue={selectedIssue}
            onSelectIssue={(issue) => {
              setSelectedIssue(issue);
            }}
            className="w-full h-full min-h-[300px] rounded-none border-0 overflow-hidden bg-white relative"
          />

          {/* Subtle Live Stats Dateline (Desktop) */}
          <div className="absolute top-4 left-4 z-[400] hidden sm:flex items-center space-x-3 px-3.5 py-2 bg-white/90 backdrop-blur-md border border-zinc-200/80 rounded-xl shadow-sm text-xs pointer-events-auto">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium text-zinc-500">Live Active:</span>
              <span className="font-bold text-zinc-900">{summary.activeCount}</span>
            </div>
            <div className="h-3 w-px bg-zinc-200"></div>
            <div className="flex items-center space-x-1.5">
              <span className="font-medium text-zinc-500">Verified & Solved:</span>
              <span className="font-bold text-emerald-700">{summary.resolvedCount}</span>
            </div>
          </div>

          {/* Selected Pin Drawer on Mobile */}
          {selectedIssue && (
            <div className="lg:hidden absolute bottom-20 left-3 right-3 z-[400] bg-white border-2 border-zinc-900 rounded-xl p-3.5 shadow-[3px_3px_0px_0px_#18181b] animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px] font-bold bg-zinc-100 text-zinc-900 px-1.5 py-0.5 rounded border border-zinc-300">
                    {selectedIssue.id}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600 font-semibold">
                    {formatDigipin(selectedIssue.digipin_code)}
                  </span>
                  {(() => {
                    const pres = getStatusPresentation(selectedIssue.status);
                    return (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${pres.badgeClass}`}>
                        {pres.label}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  aria-label="Dismiss pin card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-800 line-clamp-2 mb-3 font-medium leading-relaxed">
                {selectedIssue.description_neutral}
              </p>
              <div className="flex items-center justify-between pt-1 text-xs border-t border-zinc-100">
                <span className="text-[11px] font-semibold text-emerald-800">
                  ✓ {selectedIssue.verified_confirm_count} Local Confirms
                </span>
                <Link
                  href={`/issue/${selectedIssue.id}`}
                  className="editorial-btn px-3 py-1.5 bg-[#FEF3C7] text-amber-950 hover:bg-[#FDE68A] text-xs font-bold inline-flex items-center space-x-1"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Ledger Feed Pane */}
        <div
          className={`h-full overflow-y-auto px-4 py-4 space-y-4 ${
            viewMode === 'ledger' ? 'block' : 'hidden lg:block'
          } lg:col-span-5 xl:col-span-4 bg-[#FAF8F5]`}
        >
          {/* Feed Header */}
          <div className="flex items-center justify-between sticky top-0 bg-[#FAF8F5]/95 backdrop-blur-sm py-1.5 z-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-zinc-500" />
              <span>Community Ledger</span>
              <span className="font-mono text-[11px] bg-zinc-200 text-zinc-800 px-1.5 py-0.5 rounded">
                {filteredIssues.length}
              </span>
            </h2>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white border-2 border-dashed border-zinc-300 rounded-2xl shadow-sm my-6">
              <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] border-2 border-zinc-900 flex items-center justify-center shadow-[2px_2px_0px_0px_#18181b] mb-3">
                <MapPin className="w-6 h-6 text-zinc-900" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">No Active Civic Hazards</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
                {searchDigipin
                  ? `No records found matching "${searchDigipin}". Clear search to view all.`
                  : 'The public spatial ledger is currently clear in this category.'}
              </p>
              <Link
                href="/report"
                className="mt-4 editorial-btn px-4 py-2 bg-[#FEF3C7] text-amber-950 hover:bg-[#FDE68A] text-xs font-bold inline-flex items-center space-x-1.5"
              >
                <span>+ Report Observation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredIssues.map((issue) => {
                const isSelected = selectedIssue?.id === issue.id;
                const pres = getStatusPresentation(issue.status);

                return (
                  <Link
                    key={issue.id}
                    href={`/issue/${issue.id}`}
                    onClick={(e) => {
                      setSelectedIssue(issue);
                    }}
                    className={`block p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-white border-zinc-900 shadow-sm ring-1 ring-zinc-900'
                        : 'bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm'
                    }`}
                  >
                    {/* Status & Location Meta */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[11px] font-bold text-zinc-900">
                          {formatDigipin(issue.digipin_code)}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {issue.id}
                        </span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${pres.badgeClass}`}>
                        {pres.label}
                      </span>
                    </div>

                    {/* Objective Description */}
                    <p className="text-xs text-zinc-800 line-clamp-2 leading-relaxed mb-2 font-medium">
                      {issue.description_neutral}
                    </p>

                    {/* Bottom Authority & Verifications */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
                      <span className="truncate max-w-[180px]">
                        {issue.jurisdiction_authority || 'Local Jurisdiction'}
                      </span>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✓ {issue.verified_confirm_count}
                        </span>
                        {issue.verified_dispute_count > 0 && (
                          <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
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

      {/* Single Mobile Floating Switcher (Ergonomic Thumb Reach) */}
      <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto">
        <button
          onClick={() => setViewMode((prev) => (prev === 'map' ? 'ledger' : 'map'))}
          className="px-4 py-2 bg-zinc-900 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg rounded-full active:scale-95 transition-all"
        >
          {viewMode === 'map' ? (
            <>
              <List className="w-3.5 h-3.5" />
              <span>Show Feed ({filteredIssues.length})</span>
            </>
          ) : (
            <>
              <MapIcon className="w-3.5 h-3.5" />
              <span>Show Map</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

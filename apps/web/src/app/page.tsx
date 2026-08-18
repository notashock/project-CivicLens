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
  Radio
} from 'lucide-react';
import { fetchIssues, fetchStats, subscribeToRealtimeEvents, Issue } from '@/lib/api';
import { MapComponent } from '@/components/MapComponent';
import { formatDigipin } from '@civictrace/digipin';

const CATEGORIES = [
  { id: 'ALL', label: 'All Hazards', icon: Filter, bg: 'bg-white', text: 'text-zinc-900' },
  { id: 'ROAD_HAZARD', label: 'Roads & Potholes', icon: AlertTriangle, bg: 'bg-[#FEF3C7]', text: 'text-amber-950' },
  { id: 'DRAINAGE_WATER', label: 'Water & Sewage', icon: Droplets, bg: 'bg-[#E0F2FE]', text: 'text-sky-950' },
  { id: 'SOLID_WASTE', label: 'Solid Waste', icon: Trash2, bg: 'bg-[#DCFCE7]', text: 'text-emerald-950' },
  { id: 'ELECTRICAL_HAZARD', label: 'Electrical', icon: Zap, bg: 'bg-[#FFEDD5]', text: 'text-orange-950' },
  { id: 'PUBLIC_INFRASTRUCTURE', label: 'Public Amenities', icon: Building2, bg: 'bg-[#F3E8FF]', text: 'text-purple-950' },
];

export default function HomePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchDigipin, setSearchDigipin] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(true);

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
  }, [selectedCategory, selectedStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [issuesData, statsData] = await Promise.all([
        fetchIssues(selectedCategory, selectedStatus),
        fetchStats(),
      ]);
      setIssues(issuesData);
      setStats(statsData);
      if (issuesData.length > 0 && !selectedIssue) {
        setSelectedIssue(issuesData[0] || null);
      }
    } catch (err) {
      console.error('Failed to load issues', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = issues.filter((i) => {
    if (!searchDigipin) return true;
    return (
      i.digipin_code.toLowerCase().includes(searchDigipin.toLowerCase()) ||
      i.id.toLowerCase().includes(searchDigipin.toLowerCase()) ||
      i.description_neutral.toLowerCase().includes(searchDigipin.toLowerCase())
    );
  });

  const getStatusStamp = (status: string) => {
    switch (status) {
      case 'COMMUNITY_CORROBORATED':
        return (
          <span className="stamp-badge bg-[#DCFCE7] text-emerald-950">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-800" /> Corroborated
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="stamp-badge bg-[#FFE4E6] text-rose-950">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-800" /> SLA Escalated
          </span>
        );
      case 'RESOLUTION_CLAIMED':
        return (
          <span className="stamp-badge bg-[#E0F2FE] text-sky-950">
            <Clock className="w-3 h-3 mr-1 text-sky-800" /> 72h Resolution Quorum
          </span>
        );
      case 'COMMUNITY_VERIFIED':
      case 'RESOLVED':
        return (
          <span className="stamp-badge bg-[#DCFCE7] text-emerald-950">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-800" /> Verified & Solved
          </span>
        );
      default:
        return (
          <span className="stamp-badge bg-[#FEF3C7] text-amber-950">
            <Clock className="w-3 h-3 mr-1 text-amber-800" /> Observation Logged
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-69px)] overflow-hidden bg-[#FBF9F5]">
      {/* Top Filter & Search Bar */}
      <div className="bg-[#FDFCF9] border-b-2 border-zinc-900 px-4 lg:px-8 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Soft Pastel Category Chips */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`editorial-btn flex items-center space-x-1.5 px-3 py-1.5 text-xs whitespace-nowrap ${
                    isSelected
                      ? `${cat.bg} ${cat.text} shadow-[3px_3px_0px_0px_#18181b]`
                      : 'bg-white text-zinc-700 hover:bg-[#F5F1EA]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Real-time Indicator & DIGIPIN Search */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 stamp-badge bg-[#DCFCE7] text-emerald-950 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>LIVE SSE STREAM</span>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
              <input
                type="text"
                placeholder="Search DIGIPIN or location..."
                value={searchDigipin}
                onChange={(e) => setSearchDigipin(e.target.value)}
                className="editorial-input w-full pl-9 pr-3 text-xs placeholder-zinc-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Map Frame */}
        <div className="lg:col-span-7 h-[45vh] lg:h-full relative p-3">
          <MapComponent
            issues={filteredIssues}
            selectedIssue={selectedIssue}
            onSelectIssue={(issue) => setSelectedIssue(issue)}
          />

          {/* Floating Public Stats Dateline */}
          {stats && (
            <div className="absolute top-6 left-6 z-10 hidden sm:flex items-center space-x-4 px-4 py-2 bg-white border-2 border-zinc-900 rounded-xl shadow-[3px_3px_0px_0px_#18181b] text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-zinc-900"></span>
                <span className="font-bold text-zinc-600">Active Issues:</span>
                <span className="font-extrabold text-zinc-900 font-mono">{stats.total_issues}</span>
              </div>
              <div className="h-3.5 w-[1.5px] bg-zinc-400"></div>
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-800" />
                <span className="font-bold text-zinc-600">Local Verifications:</span>
                <span className="font-extrabold text-zinc-900 font-mono">{stats.total_local_verifications}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Community Ledger Drawer */}
        <div className="lg:col-span-5 h-[55vh] lg:h-full overflow-y-auto p-4 border-t-2 lg:border-t-0 lg:border-l-2 border-zinc-900 bg-[#F7F4EC] flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-800 flex items-center space-x-2">
              <span>Public Civic Ledger</span>
              <span className="stamp-badge bg-white text-zinc-900">
                {filteredIssues.length} Recorded
              </span>
            </h2>
            <div className="text-[11px] font-semibold text-zinc-500">Live Real-Time Feed</div>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 bg-white border-2 border-dashed border-zinc-400 rounded-2xl">
              <MapPin className="w-10 h-10 mb-2 text-zinc-400 stroke-1" />
              <p className="text-sm font-bold text-zinc-700">No records found for this view.</p>
              <p className="text-xs text-zinc-500 mt-1">Be the first to record a verified observation in this area.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredIssues.map((issue) => {
                const isSelected = selectedIssue?.id === issue.id;
                return (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className={`p-4 rounded-xl border-2 border-zinc-900 transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-white shadow-[5px_5px_0px_0px_#18181b] translate-x-0.5'
                        : 'bg-[#FDFCF9] hover:bg-white shadow-[3px_3px_0px_0px_#18181b]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-extrabold text-zinc-900 bg-[#F5F1EA] px-2 py-0.5 rounded border border-zinc-800">
                            {issue.id}
                          </span>
                          <span className="stamp-badge bg-[#E0F2FE] text-sky-950">
                            {formatDigipin(issue.digipin_code)}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-zinc-600 mt-1">
                          {issue.jurisdiction_authority}
                        </p>
                      </div>
                      {getStatusStamp(issue.status)}
                    </div>

                    {/* Factual Statement */}
                    <p className="text-xs font-medium text-zinc-800 line-clamp-2 leading-relaxed mb-3">
                      {issue.description_neutral}
                    </p>

                    {/* Consensus Bar & Link */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-zinc-200 text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1 font-bold text-emerald-900 bg-[#DCFCE7] px-2 py-0.5 rounded border border-emerald-800 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                          <span>{issue.verified_confirm_count} Confirms</span>
                        </div>
                        {issue.verified_dispute_count > 0 && (
                          <div className="flex items-center space-x-1 font-bold text-rose-950 bg-[#FFE4E6] px-2 py-0.5 rounded border border-rose-800 text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-rose-800" />
                            <span>{issue.verified_dispute_count} Disputes</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/issue/${issue.id}`}
                        className="inline-flex items-center space-x-1 font-bold text-xs text-zinc-900 hover:text-sky-900 underline decoration-2 underline-offset-2"
                      >
                        <span>View Ledger</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  PlusCircle,
  Radio,
  Menu,
  X,
  MapPin,
  Lock,
  Layers,
  Info,
  ExternalLink
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowInfoModal(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-[1100] w-full bg-[#FDFCF9] border-b-2 border-zinc-900 px-3 sm:px-6 lg:px-8 py-2 sm:py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-[#FEF3C7] border-2 border-zinc-900 flex items-center justify-center shadow-[2px_2px_0px_0px_#18181b] group-hover:-translate-y-0.5 group-active:translate-y-0.5 transition-all">
              <Radio className="w-4 h-4 text-zinc-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-black text-base sm:text-xl tracking-tight text-zinc-900">
                  Civic<span className="underline decoration-wavy decoration-[#FDE68A] decoration-2 underline-offset-4">Trace</span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 px-1 sm:px-1.5 py-0.5 rounded border border-zinc-300">
                  DIGIPIN
                </span>
              </div>
              <p className="text-[11px] font-medium text-zinc-500 hidden sm:block truncate">
                Anonymous Community Ledger
              </p>
            </div>
          </Link>

          {/* Action Badges and Navigation */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 mr-1">
              <Link
                href="/"
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === '/'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                Map & Feed
              </Link>
            </nav>

            {/* Protocol Quick Action (Directly accessible on both Mobile and Desktop) */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="editorial-btn flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold border-2 border-zinc-900 shadow-[2px_2px_0px_0px_#18181b]"
              title="Privacy & Cryptographic Protocol"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="hidden xs:inline sm:inline">Protocol</span>
            </button>

            {/* Single Primary Report CTA */}
            <Link
              href="/report"
              className="editorial-btn flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#FEF3C7] hover:bg-[#FDE68A] text-amber-950 text-xs sm:text-sm font-bold shadow-[2px_2px_0px_0px_#18181b]"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-950 stroke-[2.5]" />
              <span>Report Issue</span>
            </Link>

            {/* Mobile Navigation Drawer Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 sm:p-2 rounded-lg border-2 border-zinc-900 bg-white text-zinc-900 shadow-[2px_2px_0px_0px_#18181b] active:translate-y-0.5"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer (Decluttered: No duplicate Report CTA) */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 pb-2 mt-2 border-t-2 border-zinc-900 space-y-2 animate-in slide-in-from-top-2 duration-150">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-bold ${
                pathname === '/'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white border-2 border-zinc-900 text-zinc-900 shadow-[2px_2px_0px_0px_#18181b]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>Live Map & Public Ledger</span>
              </div>
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-75">Feed</span>
            </Link>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowInfoModal(true);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-bold bg-[#E0F2FE] border-2 border-zinc-900 text-sky-950 shadow-[2px_2px_0px_0px_#18181b]"
            >
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-sky-800" />
                <span>Anonymity & DIGIPIN Protocol</span>
              </div>
              <Info className="w-3.5 h-3.5 text-sky-800" />
            </button>
          </div>
        )}
      </header>

      {/* Protocol Architecture & Anonymity Modal (z-[9999] floats above Map and all overlay panes) */}
      {showInfoModal && (
        <div
          onClick={() => setShowInfoModal(false)}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FDFCF9] border-3 border-zinc-900 rounded-2xl shadow-[6px_6px_0px_0px_#18181b] max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto pointer-events-auto"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] border-2 border-zinc-900 flex items-center justify-center shadow-[2px_2px_0px_0px_#18181b]">
                  <Lock className="w-4 h-4 text-emerald-950" />
                </div>
                <div>
                  <h3 className="font-black text-base text-zinc-900">How CivicTrace Works</h3>
                  <p className="text-xs font-semibold text-zinc-600">Zero Accounts · Zero PII Storage</p>
                </div>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1.5 rounded-lg border-2 border-zinc-900 hover:bg-zinc-200 transition-colors"
                aria-label="Close Protocol Modal"
              >
                <X className="w-4 h-4 text-zinc-900" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-700 leading-relaxed">
              <div className="p-3 bg-[#FEF3C7] border-2 border-zinc-900 rounded-xl space-y-1">
                <div className="font-extrabold text-amber-950 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>1. India DIGIPIN Standardization</span>
                </div>
                <p className="text-amber-900">
                  Every civic hazard is locked to an exact 10-character alphanumeric grid cell (~4m × 4m). Upon report intake, GPS coordinates are snapped directly to the cell centroid and raw floats are immediately discarded from memory.
                </p>
              </div>

              <div className="p-3 bg-[#E0F2FE] border-2 border-zinc-900 rounded-xl space-y-1">
                <div className="font-extrabold text-sky-950 flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>2. Hardware-Attested Nullifiers</span>
                </div>
                <p className="text-sky-900">
                  Your device derives a persistent Pseudorandom Key (PRK) locally. Each action computes a one-way nullifier (<code className="font-mono bg-white px-1 rounded">HMAC-SHA256(PRK, IssueID)</code>) ensuring one action per device per issue without linking activity across different issues.
                </p>
              </div>

              <div className="p-3 bg-[#F3E8FF] border-2 border-zinc-900 rounded-xl space-y-1">
                <div className="font-extrabold text-purple-950 flex items-center space-x-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>3. Local Ephemeral Verification</span>
                </div>
                <p className="text-purple-900">
                  Participants must be within 500m of the issue centroid to confirm or dispute. Community consensus scores govern priority escalation and community-verified contractor rectifications.
                </p>
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => setShowInfoModal(false)}
                className="editorial-btn w-full py-2.5 bg-zinc-900 text-white text-xs font-bold shadow-[2px_2px_0px_0px_#18181b]"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


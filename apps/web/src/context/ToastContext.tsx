'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  count?: number;
  remainingMs: number;
  startTime: number;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
  toast: {
    success: (message: string, durationMs?: number) => void;
    warning: (message: string, durationMs?: number) => void;
    error: (message: string, durationMs?: number) => void;
    info: (message: string, durationMs?: number) => void;
    clear: () => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION_MS = 4000;
const MAX_SIMULTANEOUS_TOASTS = 4;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());
  const pathname = usePathname() || '';

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastWheelTime = useRef<number>(0);
  const touchStartY = useRef<number | null>(null);

  const hideToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      return remaining;
    });
    setExpandedTextIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const clearAllToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
    setActiveIndex(0);
    setExpandedTextIds(new Set());
  }, []);

  const toggleTextExpansion = useCallback((id: string) => {
    setExpandedTextIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Timer scheduling helper
  const scheduleDismiss = useCallback(
    (id: string, durationMs: number) => {
      if (durationMs <= 0) return;

      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        hideToast(id);
      }, durationMs);

      timersRef.current.set(id, timer);
    },
    [hideToast]
  );

  // Pause timers when hovered, resume when unhovered
  useEffect(() => {
    if (isHovered) {
      const now = Date.now();
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();

      setToasts((prev) =>
        prev.map((t) => ({
          ...t,
          remainingMs: Math.max(800, t.remainingMs - (now - t.startTime)),
        }))
      );
    } else {
      const now = Date.now();
      toasts.forEach((t) => {
        scheduleDismiss(t.id, t.remainingMs);
      });
      setToasts((prev) =>
        prev.map((t) => ({
          ...t,
          startTime: now,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered]);

  // Clean up all pending timers on unmount
  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  // Navigation between stacked cards
  const goToNext = useCallback(() => {
    setActiveIndex((prev) => Math.min(prev + 1, toasts.length - 1));
  }, [toasts.length]);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Wheel scroll handler to flip through stacked notifications
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (toasts.length <= 1) return;
      const now = Date.now();
      if (now - lastWheelTime.current < 250) return;

      if (e.deltaY > 15) {
        lastWheelTime.current = now;
        goToNext();
      } else if (e.deltaY < -15) {
        lastWheelTime.current = now;
        goToPrev();
      }
    },
    [toasts.length, goToNext, goToPrev]
  );

  // Touch swipe handler to scroll through stacked notifications on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || toasts.length <= 1) return;
      const diff = touchStartY.current - e.changedTouches[0].clientY;
      touchStartY.current = null;

      // Swipe up (diff > 25) -> reveals next notification card
      if (diff > 25) {
        goToNext();
      } else if (diff < -25) {
        // Swipe down (diff < -25) -> reveals previous notification card
        goToPrev();
      }
    },
    [toasts.length, goToNext, goToPrev]
  );

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs: number = DEFAULT_DURATION_MS) => {
      const now = Date.now();

      setToasts((prev) => {
        // 1. Anti-spam / de-duplication
        const existingIndex = prev.findIndex((t) => t.message === message && t.type === type);

        if (existingIndex !== -1) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          const newCount = (existing.count || 1) + 1;
          updated[existingIndex] = {
            ...existing,
            count: newCount,
            remainingMs: durationMs,
            startTime: now,
          };
          if (!isHovered) {
            scheduleDismiss(existing.id, durationMs);
          }
          return updated;
        }

        // 2. Queue limiter: keep at most MAX_SIMULTANEOUS_TOASTS visible in stack
        const id = `${now}-${Math.random().toString(36).substring(2, 7)}`;
        const newToast: ToastItem = {
          id,
          message,
          type,
          count: 1,
          remainingMs: durationMs,
          startTime: now,
        };

        const nextList = [newToast, ...prev.slice(0, MAX_SIMULTANEOUS_TOASTS - 1)];

        if (!isHovered) {
          scheduleDismiss(id, durationMs);
        }

        return nextList;
      });

      // Jump to newest toast (index 0)
      setActiveIndex(0);
    },
    [isHovered, scheduleDismiss]
  );

  const toast = useMemo(
    () => ({
      success: (msg: string, durationMs?: number) => showToast(msg, 'success', durationMs),
      warning: (msg: string, durationMs?: number) => showToast(msg, 'warning', durationMs),
      error: (msg: string, durationMs?: number) => showToast(msg, 'error', durationMs),
      info: (msg: string, durationMs?: number) => showToast(msg, 'info', durationMs),
      clear: () => clearAllToasts(),
    }),
    [showToast, clearAllToasts]
  );

  // Dynamic route-aware bottom clearance on mobile via globals.css
  const isIssuePage = pathname.startsWith('/issue/');
  const isReportPage = pathname === '/report';

  const bottomClass = isIssuePage
    ? 'toast-viewport-issue'
    : isReportPage
    ? 'toast-viewport-report'
    : 'toast-viewport-default';

  return (
    <ToastContext.Provider value={{ showToast, hideToast, clearAllToasts, toast }}>
      {children}

      {/* Toast Viewport Container:
          - Notifications are strictly stacked in one spot (no vertical column expansion).
          - Users can scroll up/down (mouse wheel or swipe) on the notification card to flip through stacked cards.
          - Mobile (< lg): centered at bottom, floating ~10-12px right above the active bottom bar via .toast-viewport-*.
          - Desktop (lg): anchored at bottom-6 right-6.
          - Elevated at z-[1200]. */}
      <aside
        aria-live="polite"
        aria-label="Notifications"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-[1200] max-w-lg sm:max-w-xl w-[calc(100%-1.25rem)] sm:w-[calc(100%-2rem)] lg:w-[30rem] pointer-events-none transition-all duration-300 ease-out`}
      >
        {toasts.length > 0 && (
          <div
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative w-full min-h-[58px] select-none"
          >
            {toasts.map((item, index) => {
              const offsetFromActive = index - activeIndex;
              const isActive = offsetFromActive === 0;
              const isPast = offsetFromActive < 0;
              const isFuture = offsetFromActive > 0;
              const isTextExpanded = expandedTextIds.has(item.id);
              const isLongMessage = item.message.length > 65;

              // Stack transform mechanics:
              // - Active card: translate-y-0, full opacity, interactive
              // - Past card (already scrolled past): slides up and fades out
              // - Future cards (waiting in stack): peek from behind with negative translate and scale
              let stackStyle = 'relative z-20 scale-100 opacity-100 shadow-[0px_6px_20px_rgba(0,0,0,0.12)] pointer-events-auto';

              if (isPast) {
                stackStyle = 'absolute inset-0 -translate-y-6 scale-[0.98] opacity-0 pointer-events-none z-10';
              } else if (isFuture) {
                if (offsetFromActive === 1) {
                  stackStyle = 'absolute inset-0 -translate-y-2.5 scale-[0.96] opacity-90 shadow-[0px_4px_14px_rgba(0,0,0,0.08)] pointer-events-none z-10';
                } else if (offsetFromActive === 2) {
                  stackStyle = 'absolute inset-0 -translate-y-5 scale-[0.92] opacity-75 shadow-[0px_2px_10px_rgba(0,0,0,0.06)] pointer-events-none z-0';
                } else {
                  stackStyle = 'absolute inset-0 -translate-y-7 scale-[0.88] opacity-0 pointer-events-none z-0';
                }
              }

              // Do not render cards beyond depth 3
              if (Math.abs(offsetFromActive) > 3) return null;

              return (
                <div
                  key={item.id}
                  role="status"
                  className={`w-full p-3 sm:px-4 sm:py-3.5 rounded-2xl border text-xs sm:text-sm font-medium flex items-start gap-3 transition-all duration-300 ease-out ${stackStyle} ${
                    item.type === 'success'
                      ? 'bg-[#E6F4EA] border-[#A8DAB5] text-[#0D652D]'
                      : item.type === 'warning'
                      ? 'bg-[#FEF7E0] border-[#F9D68A] text-[#7C4300]'
                      : item.type === 'error'
                      ? 'bg-[#FCE8E6] border-[#F5A8A0] text-[#B3261E]'
                      : 'bg-[#E8F0FE] border-[#ADC8FF] text-[#174EA6]'
                  }`}
                >
                  {/* Semantic Icon with solid contrast */}
                  <div className="shrink-0 mt-0.5">
                    {item.type === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-[#0F9D58]" />
                    )}
                    {item.type === 'warning' && (
                      <AlertTriangle className="w-4 h-4 text-[#E37400]" />
                    )}
                    {item.type === 'error' && (
                      <AlertCircle className="w-4 h-4 text-[#D93025]" />
                    )}
                    {item.type === 'info' && <Info className="w-4 h-4 text-[#1A73E8]" />}
                  </div>

                  {/* Clamped Text Content with Click-to-Expand Toggle */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`leading-snug break-words ${
                        isTextExpanded
                          ? 'line-clamp-none whitespace-normal'
                          : 'line-clamp-2 sm:line-clamp-3'
                      }`}
                    >
                      {item.message}
                    </p>

                    {/* Interactive 'Read more' / 'Show less' hint for long messages */}
                    {isLongMessage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTextExpansion(item.id);
                        }}
                        className="text-[11px] font-bold underline opacity-80 hover:opacity-100 transition-opacity mt-1 inline-block"
                      >
                        {isTextExpanded ? 'Show less' : 'Read more...'}
                      </button>
                    )}
                  </div>

                  {/* Multiplier Badge if identical notification was triggered multiple times */}
                  {item.count && item.count > 1 && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-black/10 text-current mt-0.5">
                      {item.count}×
                    </span>
                  )}

                  {/* Scrollable Stack Navigator Pill (Shown when multiple cards exist) */}
                  {toasts.length > 1 && isActive && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-black/10 text-current text-[10px] font-bold mt-0.5 select-none"
                    >
                      <button
                        type="button"
                        onClick={goToPrev}
                        disabled={activeIndex === 0}
                        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30 transition-opacity"
                        aria-label="Previous notification"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>

                      <span className="px-0.5">
                        {activeIndex + 1}/{toasts.length}
                      </span>

                      <button
                        type="button"
                        onClick={goToNext}
                        disabled={activeIndex === toasts.length - 1}
                        className="p-0.5 rounded hover:bg-black/10 disabled:opacity-30 transition-opacity"
                        aria-label="Next notification"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Dismiss 'X' button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hideToast(item.id);
                    }}
                    className="shrink-0 p-1 -mr-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-all mt-0.5"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </ToastContext.Provider>
  );
};

const defaultContext: ToastContextValue = {
  showToast: (msg, type) => {
    if (typeof console !== 'undefined') {
      console.log(`[Toast] (${type || 'info'}): ${msg}`);
    }
  },
  hideToast: () => {},
  clearAllToasts: () => {},
  toast: {
    success: (msg) => {
      if (typeof console !== 'undefined') console.log(`[Toast] (success): ${msg}`);
    },
    warning: (msg) => {
      if (typeof console !== 'undefined') console.log(`[Toast] (warning): ${msg}`);
    },
    error: (msg) => {
      if (typeof console !== 'undefined') console.log(`[Toast] (error): ${msg}`);
    },
    info: (msg) => {
      if (typeof console !== 'undefined') console.log(`[Toast] (info): ${msg}`);
    },
    clear: () => {},
  },
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  return context || defaultContext;
};

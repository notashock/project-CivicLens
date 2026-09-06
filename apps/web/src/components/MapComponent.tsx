'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Issue } from '@/lib/api';
import { MapBoundingBox } from '@/lib/issue-feed-model';
import { Search, Navigation, RefreshCw, X, Crosshair, AlertCircle } from 'lucide-react';

interface MapComponentProps {
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue) => void;
  onSearchArea?: (bounds: MapBoundingBox) => void;
  activeBounds?: MapBoundingBox | null;
  onResetArea?: () => void;
  onLocateUser?: (lat: number, lon: number, bounds: MapBoundingBox) => void;
  loading?: boolean;
  className?: string;
}

// Category SVG iconography and Material theme colors
const PIN_THEMES: Record<string, { primary: string; light: string; svgPath: string }> = {
  ROAD_HAZARD: {
    primary: '#D93025',
    light: '#FCE8E6',
    // Warning Triangle Pothole Icon
    svgPath: '<path d="M7 1.5L0.5 12.5h13L7 1.5z M7 5.5v3 M7 10v0.8" stroke="#D93025" stroke-width="1.3" stroke-linecap="round" fill="none"/>',
  },
  DRAINAGE_WATER: {
    primary: '#1A73E8',
    light: '#E8F0FE',
    // Water Droplet Icon
    svgPath: '<path d="M7 1.5C7 1.5 2 7 2 9.8a5 5 0 0010 0C12 7 7 1.5 7 1.5z" stroke="#1A73E8" stroke-width="1.2" fill="none"/>',
  },
  SOLID_WASTE: {
    primary: '#188038',
    light: '#E6F4EA',
    // Trash Can Icon
    svgPath: '<path d="M2.5 4h9 M5 4V2.5h4V4 M3.5 4l0.8 8.5h5.4L10.5 4 M5.5 6.5v4.5 M8.5 6.5v4.5" stroke="#188038" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
  },
  ELECTRICAL_HAZARD: {
    primary: '#EA8600',
    light: '#FEF7E0',
    // Lightning Bolt Icon
    svgPath: '<path d="M7.5 1.5L2.5 7.5h4L4.5 13.5L11.5 6.5h-4z" stroke="#EA8600" stroke-width="1.1" stroke-linejoin="round" fill="#EA8600"/>',
  },
  PUBLIC_INFRASTRUCTURE: {
    primary: '#9334E6',
    light: '#F3E8FF',
    // Public Building / Columns Icon
    svgPath: '<path d="M1.5 5.5L7 2l5.5 3.5 M2.5 5.5h9 M3.5 5.5v5.5 M6 5.5v5.5 M8 5.5v5.5 M10.5 5.5v5.5 M1.5 11h11" stroke="#9334E6" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
  },
  ENVIRONMENTAL_VIOLATION: {
    primary: '#C5221F',
    light: '#FCE8E6',
    // Shield / Alert
    svgPath: '<path d="M7 1.5L2 3.8v4.2c0 3.2 2.1 6.2 5 7 2.9-.8 5-3.8 5-7V3.8L7 1.5z" stroke="#C5221F" stroke-width="1.2" fill="none"/>',
  },
};

function createTeardropPinHtml(issue: Issue, isSelected: boolean): string {
  const isResolved = issue.status === 'RESOLVED' || issue.status === 'COMMUNITY_VERIFIED';
  const isEscalated = issue.status === 'ESCALATED';
  const theme = PIN_THEMES[issue.category] || PIN_THEMES.ROAD_HAZARD;

  const width = isSelected ? 34 : 28;
  const height = isSelected ? 44 : 36;
  const pinColor = isResolved ? '#0F9D58' : theme.primary;

  return `
    <div class="civic-map-pin ${isSelected ? 'is-selected' : ''}" style="
      position: relative;
      width: ${width}px;
      height: ${height}px;
      cursor: pointer;
      transform-origin: bottom center;
      transition: transform 0.15s ease-out;
      filter: ${isSelected ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))' : 'drop-shadow(0 2px 5px rgba(0,0,0,0.2))'};
    ">
      ${isEscalated ? `
        <div style="
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: rgba(225, 29, 72, 0.45);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        "></div>
      ` : ''}
      <svg viewBox="0 0 30 38" width="${width}" height="${height}" style="overflow: visible;">
        <path d="M 15 0 C 6.7 0 0 6.7 0 15 C 0 25.5 15 38 15 38 C 15 38 30 25.5 30 15 C 30 6.7 23.3 0 15 0 Z"
              fill="${pinColor}"
              stroke="#FFFFFF"
              stroke-width="${isSelected ? '2.5' : '1.5'}" />
        <circle cx="15" cy="14" r="8.5" fill="#FFFFFF" />
        <g transform="translate(8, 7)">
          ${theme.svgPath}
        </g>
      </svg>
      ${isResolved ? `
        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #0F9D58;
          border: 1.5px solid #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-size: 8px;
          font-weight: bold;
        ">✓</div>
      ` : ''}
    </div>
  `;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  issues,
  selectedIssue,
  onSelectIssue,
  onSearchArea,
  activeBounds,
  onResetArea,
  onLocateUser,
  loading = false,
  className = 'relative w-full h-full min-h-[350px] sm:min-h-[450px] lg:min-h-full overflow-hidden bg-[#F8F9FA]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const userAccuracyCircleRef = useRef<any>(null);

  const [hasMoved, setHasMoved] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<MapBoundingBox | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let resizeObserver: ResizeObserver | null = null;

    import('leaflet').then((L) => {
      if (mapInstanceRef.current || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [12.9716, 77.5946],
        zoom: 12,
        zoomControl: false, // Custom placed or default
      });

      // CartoDB Positron: Clean, high-contrast, modern map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control in bottom left to prevent overlap with My Location button
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      mapInstanceRef.current = map;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Track viewport movements to trigger "Search this area"
      map.on('moveend', () => {
        const b = map.getBounds();
        const bbox: MapBoundingBox = {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        };
        setCurrentBounds(bbox);
        setHasMoved(true);
      });

      // Recalculate dimensions on container resize
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    });

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when issues or selectedIssue change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      issues.forEach((issue) => {
        const isSelected = selectedIssue?.id === issue.id;
        const width = isSelected ? 34 : 28;
        const height = isSelected ? 44 : 36;

        const customIcon = L.divIcon({
          className: 'civic-marker-wrapper',
          html: createTeardropPinHtml(issue, isSelected),
          iconSize: [width, height],
          iconAnchor: [width / 2, height], // Anchor at the sharp bottom tip
        });

        const marker = L.marker([issue.lat, issue.lon], {
          icon: customIcon,
          zIndexOffset: isSelected ? 1000 : 0,
        })
          .addTo(mapInstanceRef.current)
          .on('click', () => {
            onSelectIssue(issue);
          });

        markersRef.current.push(marker);
      });

      if (selectedIssue && mapInstanceRef.current) {
        mapInstanceRef.current.panTo([selectedIssue.lat, selectedIssue.lon], {
          animate: true,
          duration: 0.5,
        });
      }

      mapInstanceRef.current.invalidateSize();
    });
  }, [issues, selectedIssue, onSelectIssue]);

  // Handle "My Location" GPS Centering
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocating(false);

        if (!mapInstanceRef.current) return;

        import('leaflet').then((L) => {
          const map = mapInstanceRef.current;

          // Animate view to user position
          map.flyTo([latitude, longitude], 15, { duration: 1.2 });

          // Remove prior user location markers if present
          if (userMarkerRef.current) userMarkerRef.current.remove();
          if (userAccuracyCircleRef.current) userAccuracyCircleRef.current.remove();

          // Pulsating blue radar icon for user location
          const userIcon = L.divIcon({
            className: 'user-radar-pin',
            html: `
              <div style="position: relative; width: 24px; height: 24px;">
                <div style="
                  position: absolute;
                  inset: 0;
                  border-radius: 9999px;
                  background: rgba(26, 115, 232, 0.35);
                  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>
                <div style="
                  position: absolute;
                  top: 3px;
                  left: 3px;
                  width: 18px;
                  height: 18px;
                  border-radius: 9999px;
                  background: #1A73E8;
                  border: 2.5px solid #FFFFFF;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                "></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          userMarkerRef.current = L.marker([latitude, longitude], {
            icon: userIcon,
            zIndexOffset: 1500,
          }).addTo(map);

          // Translucent accuracy circle
          if (accuracy && accuracy < 2000) {
            userAccuracyCircleRef.current = L.circle([latitude, longitude], {
              radius: Math.max(accuracy, 80),
              color: '#1A73E8',
              fillColor: '#1A73E8',
              fillOpacity: 0.08,
              weight: 1,
            }).addTo(map);
          }

          // Compute new bounds after flying
          setTimeout(() => {
            const b = map.getBounds();
            const bbox: MapBoundingBox = {
              north: b.getNorth(),
              south: b.getSouth(),
              east: b.getEast(),
              west: b.getWest(),
            };
            onLocateUser?.(latitude, longitude, bbox);
            setHasMoved(false);
          }, 1300);
        });
      },
      (err) => {
        setLocating(false);
        setLocationError(err.message || 'Unable to retrieve your location');
        setTimeout(() => setLocationError(null), 4000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [onLocateUser]);

  return (
    <div className={className}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Loading Map Pins Pill */}
      {loading && (
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-[410] bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-m3-elevation-2 border border-[#E0E2EC] flex items-center space-x-2 text-xs font-semibold text-[#1F1F1F] pointer-events-none animate-in fade-in slide-in-from-top-1">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1A73E8]" />
          <span>Syncing civic map pins...</span>
        </div>
      )}

      {/* Floating "Search This Area" Pill (Top Center) */}
      <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-[400] pointer-events-auto flex items-center space-x-2">
        {hasMoved && currentBounds && (
          <button
            type="button"
            onClick={() => {
              onSearchArea?.(currentBounds);
              setHasMoved(false);
            }}
            className="bg-white/95 backdrop-blur-md hover:bg-white text-[#1A73E8] font-bold text-xs py-1.5 px-3.5 rounded-full shadow-m3-elevation-2 border border-[#D3E3FD] flex items-center space-x-1.5 transition-all hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <Search className="w-3.5 h-3.5 text-[#1A73E8]" />
            <span>Search this area</span>
          </button>
        )}

        {activeBounds && (
          <div className="bg-[#E8F0FE]/95 backdrop-blur-md text-[#041E49] font-semibold text-xs py-1 px-3 rounded-full border border-[#D3E3FD] shadow-xs flex items-center space-x-1.5 animate-in fade-in">
            <span>Area filter on</span>
            <button
              type="button"
              onClick={() => {
                onResetArea?.();
                setHasMoved(false);
              }}
              className="text-[#5F6368] hover:text-[#1F1F1F] p-0.5 rounded-full hover:bg-white/50 transition-colors"
              title="Reset area filter"
              aria-label="Reset area filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Floating "My Location" GPS Button (Bottom Right) */}
      <div className="absolute bottom-6 right-3.5 sm:bottom-6 sm:right-4 z-[400] pointer-events-auto flex flex-col items-end space-y-1.5">
        {locationError && (
          <div className="bg-[#FCE8E6] text-[#B3261E] text-[11px] font-medium py-1 px-2.5 rounded-xl border border-[#FAD2CF] shadow-sm flex items-center space-x-1 animate-in fade-in">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{locationError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="w-10 h-10 sm:w-11 sm:h-11 bg-white/95 backdrop-blur-md hover:bg-white text-[#1A73E8] rounded-full border border-[#E0E2EC] shadow-m3-elevation-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
          title="Find my current location"
          aria-label="Find my current location"
        >
          {locating ? (
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#1A73E8]" />
          ) : (
            <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 text-[#1A73E8]" />
          )}
        </button>
      </div>
    </div>
  );
};

'use client';

import React, { useEffect, useRef } from 'react';
import { Issue } from '@/lib/api';

interface MapComponentProps {
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue) => void;
  className?: string;
}

// Soft Editorial Pastel Category Palette
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ROAD_HAZARD: { bg: '#FEF3C7', text: '#78350F', border: '#18181B' },           // Warm Butter
  DRAINAGE_WATER: { bg: '#E0F2FE', text: '#075985', border: '#18181B' },        // Morning Sky
  SOLID_WASTE: { bg: '#DCFCE7', text: '#14532D', border: '#18181B' },           // Soft Sage
  ELECTRICAL_HAZARD: { bg: '#FFEDD5', text: '#7C2D12', border: '#18181B' },     // Soft Apricot
  PUBLIC_INFRASTRUCTURE: { bg: '#F3E8FF', text: '#581C87', border: '#18181B' }, // Heather Lavender
  ENVIRONMENTAL_VIOLATION: { bg: '#FFE4E6', text: '#881337', border: '#18181B' },// Muted Coral
};

export const MapComponent: React.FC<MapComponentProps> = ({
  issues,
  selectedIssue,
  onSelectIssue,
  className = 'relative w-full h-full min-h-[350px] sm:min-h-[450px] lg:min-h-full editorial-card overflow-hidden bg-white',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let resizeObserver: ResizeObserver | null = null;

    import('leaflet').then((L) => {
      if (mapInstanceRef.current || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [12.9716, 77.5946],
        zoom: 12,
        zoomControl: true,
      });

      // CartoDB Positron: Clean, high-contrast, light newsprint map
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);

      mapInstanceRef.current = map;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Automatically recalculate map dimensions when viewport or container resized
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      // Initial dimension trigger after layout settling
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

  // Update markers when issues or selectedIssue change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      issues.forEach((issue) => {
        const theme = CATEGORY_COLORS[issue.category] || { bg: '#FEF3C7', text: '#18181B', border: '#18181B' };
        const isSelected = selectedIssue?.id === issue.id;

        // Soft Neo-Brutalist Map Pin
        const customIcon = L.divIcon({
          className: 'brutalist-pin',
          html: `
            <div style="
              width: ${isSelected ? '32px' : '24px'};
              height: ${isSelected ? '32px' : '24px'};
              background-color: ${theme.bg};
              border: 2px solid #18181B;
              box-shadow: ${isSelected ? '4px 4px 0px 0px #18181B' : '2px 2px 0px 0px #18181B'};
              border-radius: 8px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'JetBrains Mono', monospace;
              font-size: ${isSelected ? '12px' : '10px'};
              font-weight: 800;
              color: #18181B;
              transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
              transition: all 0.15s ease;
            ">
              ${isSelected ? '★' : '•'}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([issue.lat, issue.lon], { icon: customIcon })
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

      // Also trigger invalidateSize in case of dynamic tab change
      mapInstanceRef.current.invalidateSize();
    });
  }, [issues, selectedIssue, onSelectIssue]);

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};


'use client';

import React, { useEffect, useRef } from 'react';
import { Issue } from '@/lib/api';

interface MapComponentProps {
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue) => void;
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current!, {
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
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
              width: ${isSelected ? '30px' : '22px'};
              height: ${isSelected ? '30px' : '22px'};
              background-color: ${theme.bg};
              border: 2px solid #18181B;
              box-shadow: 3px 3px 0px 0px #18181B;
              border-radius: 8px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'JetBrains Mono', monospace;
              font-size: 10px;
              font-weight: 800;
              color: #18181B;
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: transform 0.15s ease;
            ">
              ${isSelected ? '★' : '•'}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
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
          duration: 0.6,
        });
      }
    });
  }, [issues, selectedIssue, onSelectIssue]);

  return (
    <div className="relative w-full h-full min-h-[500px] editorial-card overflow-hidden bg-white">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

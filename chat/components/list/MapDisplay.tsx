import React, { useEffect, useRef, useState } from 'react';
import { useMapKitAuth } from '@/hooks/list/useMapKitAuth';

/**
 * MapKit JS Map Data Structure
 * Stored in content.metadata.map_data
 */
export interface MapData {
  latitude: number;
  longitude: number;
  place_name: string;
  place_address?: string;
  zoom_level?: number;
  map_type?: 'standard' | 'hybrid' | 'satellite';
  annotations?: Array<{
    latitude: number;
    longitude: number;
    title?: string;
    subtitle?: string;
  }>;
  created_via?: 'search' | 'current_location';
  timestamp?: string;
}

interface MapDisplayProps {
  mapData: MapData;
  className?: string;
}

/**
 * MapDisplay Component
 *
 * Displays an interactive Apple Map using MapKit JS.
 * Features:
 * - Embedded map with stored coordinates
 * - Place marker with name/description
 * - Zoom level and map type from metadata
 * - Click to view full-screen
 * - Loading states and error handling
 */
export const MapDisplay: React.FC<MapDisplayProps> = ({
  mapData,
  className = ''
}) => {
  const { token, isLoading: authLoading, error: authError } = useMapKitAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapKitLoaded, setIsMapKitLoaded] = useState(false);

  // Load MapKit JS library
  useEffect(() => {
    if (window.mapkit) {
      setIsMapKitLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
    script.crossOrigin = 'anonymous';
    script.async = true;

    script.onload = () => {
      setIsMapKitLoaded(true);
    };

    script.onerror = () => {
      setMapError('Failed to load MapKit JS library');
      setMapLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script as it may be used by other map instances
    };
  }, []);

  // Initialize map when token and library are ready
  useEffect(() => {
    if (!isMapKitLoaded || !token || !mapContainerRef.current) {
      return;
    }

    try {
      // Initialize MapKit with JWT token
      if (!window.mapkit.init) {
        window.mapkit.init({
          authorizationCallback: (done: (token: string) => void) => {
            done(token);
          },
          language: 'en',
        });
      }

      // Create map instance
      const map = new window.mapkit.Map(mapContainerRef.current, {
        center: new window.mapkit.Coordinate(mapData.latitude, mapData.longitude),
        region: new window.mapkit.CoordinateRegion(
          new window.mapkit.Coordinate(mapData.latitude, mapData.longitude),
          new window.mapkit.CoordinateSpan(0.01, 0.01) // Default span
        ),
        mapType: window.mapkit.Map.MapTypes[
          mapData.map_type === 'hybrid' ? 'Hybrid' :
          mapData.map_type === 'satellite' ? 'Satellite' :
          'Standard'
        ],
        showsZoomControl: true,
        showsMapTypeControl: true,
        showsUserLocationControl: false,
      });

      // Add annotations (markers)
      if (mapData.annotations && mapData.annotations.length > 0) {
        const markers = mapData.annotations.map(annotation => {
          const marker = new window.mapkit.MarkerAnnotation(
            new window.mapkit.Coordinate(annotation.latitude, annotation.longitude),
            {
              title: annotation.title,
              subtitle: annotation.subtitle,
              color: '#007AFF', // Apple blue
            }
          );
          return marker;
        });

        map.showItems(markers);
      } else {
        // Add default marker at center
        const marker = new window.mapkit.MarkerAnnotation(
          new window.mapkit.Coordinate(mapData.latitude, mapData.longitude),
          {
            title: mapData.place_name,
            subtitle: mapData.place_address,
            color: '#007AFF',
          }
        );

        map.addAnnotation(marker);
      }

      mapRef.current = map;
      setMapLoading(false);
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to initialize map');
      setMapLoading(false);
    }

    return () => {
      // Cleanup map instance
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [isMapKitLoaded, token, mapData]);

  const handleViewFullScreen = () => {
    // Open Apple Maps in a new tab with the coordinates
    const url = `https://maps.apple.com/?ll=${mapData.latitude},${mapData.longitude}&q=${encodeURIComponent(mapData.place_name)}`;
    window.open(url, '_blank');
  };

  // Loading state
  if (authLoading || mapLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 overflow-hidden bg-gray-50 ${className}`}>
        <div className="w-full h-64 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 flex flex-col items-center">
            <svg className="w-12 h-12 animate-spin mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (authError || mapError) {
    return (
      <div className={`rounded-lg border border-gray-200 overflow-hidden bg-gray-50 ${className}`}>
        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">Failed to load map</p>
          <p className="text-xs text-gray-400 mt-1">{authError || mapError}</p>
          <button
            onClick={handleViewFullScreen}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Open in Apple Maps
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden bg-white ${className}`}>
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-64 cursor-pointer"
        onClick={handleViewFullScreen}
        style={{ minHeight: '256px' }}
      />

      {/* Map Info Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{mapData.place_name}</p>
              {mapData.place_address && (
                <p className="text-xs text-gray-500 truncate">{mapData.place_address}</p>
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewFullScreen();
            }}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 flex-shrink-0 ml-2"
          >
            <span>Open</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Type declaration for MapKit JS
declare global {
  interface Window {
    mapkit: any;
  }
}

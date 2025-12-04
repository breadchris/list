import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMapKitAuth } from '@/hooks/list/useMapKitAuth';
import type { MapData } from './MapDisplay';

interface MapInputProps {
  onSave: (mapData: MapData, placeName: string) => void;
  onCancel: () => void;
}

type InputMode = 'select' | 'current_location' | 'search';

interface SearchResult {
  coordinate: { latitude: number; longitude: number };
  name: string;
  formattedAddress?: string;
}

/**
 * MapInput Component
 *
 * Interactive map creator for content input.
 * Features:
 * - Two modes: Current Location or Search Location
 * - Draggable marker for fine-tuning
 * - Reverse geocoding for place names
 * - Search using MapKit Search API
 * - Save button to create content with rich metadata
 */
export const MapInput: React.FC<MapInputProps> = ({ onSave, onCancel }) => {
  const { token, isLoading: authLoading, error: authError } = useMapKitAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [mode, setMode] = useState<InputMode>('select');
  const [isMapKitLoaded, setIsMapKitLoaded] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    placeName: string;
    placeAddress?: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<any>(null);

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
    };

    document.head.appendChild(script);
  }, []);

  // Initialize MapKit Search
  useEffect(() => {
    if (!isMapKitLoaded || !token) return;

    if (!window.mapkit.init) {
      window.mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          done(token);
        },
        language: 'en',
      });
    }

    // Create search instance
    searchRef.current = new window.mapkit.Search();
  }, [isMapKitLoaded, token]);

  // Reverse geocode a coordinate to get place name
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    if (!window.mapkit || !isMapKitLoaded) return null;

    try {
      const geocoder = new window.mapkit.Geocoder();
      const coordinate = new window.mapkit.Coordinate(latitude, longitude);

      return new Promise<{ name: string; address?: string } | null>((resolve) => {
        geocoder.reverseLookup(coordinate, (error: any, data: any) => {
          if (error || !data?.results?.length) {
            resolve(null);
            return;
          }

          const result = data.results[0];
          resolve({
            name: result.name || 'Unknown Location',
            address: result.formattedAddress,
          });
        });
      });
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }, [isMapKitLoaded]);

  // Initialize map for current location mode
  const initCurrentLocationMap = useCallback(async () => {
    if (!mapContainerRef.current || !token || !isMapKitLoaded) return;

    setMapLoading(true);
    setMapError(null);

    try {
      // Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Create map
      const map = new window.mapkit.Map(mapContainerRef.current, {
        center: new window.mapkit.Coordinate(latitude, longitude),
        region: new window.mapkit.CoordinateRegion(
          new window.mapkit.Coordinate(latitude, longitude),
          new window.mapkit.CoordinateSpan(0.01, 0.01)
        ),
        showsZoomControl: true,
        showsMapTypeControl: true,
        showsUserLocationControl: true,
      });

      // Create draggable marker
      const marker = new window.mapkit.MarkerAnnotation(
        new window.mapkit.Coordinate(latitude, longitude),
        {
          color: '#007AFF',
          draggable: true,
        }
      );

      map.addAnnotation(marker);
      mapRef.current = map;
      markerRef.current = marker;

      // Get initial place name
      const placeInfo = await reverseGeocode(latitude, longitude);
      setSelectedLocation({
        latitude,
        longitude,
        placeName: placeInfo?.name || 'Current Location',
        placeAddress: placeInfo?.address,
      });

      // Handle marker drag end
      marker.addEventListener('drag-end', async () => {
        const coord = marker.coordinate;
        const placeInfo = await reverseGeocode(coord.latitude, coord.longitude);
        setSelectedLocation({
          latitude: coord.latitude,
          longitude: coord.longitude,
          placeName: placeInfo?.name || 'Selected Location',
          placeAddress: placeInfo?.address,
        });
      });

      setMapLoading(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      setMapError('Could not access your location. Please check permissions.');
      setMapLoading(false);
    }
  }, [token, isMapKitLoaded, reverseGeocode]);

  // Trigger current location initialization after mode change and render
  useEffect(() => {
    if (mode === 'current_location' && !selectedLocation && !mapLoading && !mapError) {
      initCurrentLocationMap();
    }
  }, [mode, selectedLocation, mapLoading, mapError, initCurrentLocationMap]);

  // Initialize map for search mode
  const initSearchMap = useCallback((latitude: number, longitude: number, placeName: string, placeAddress?: string) => {
    if (!mapContainerRef.current || !token || !isMapKitLoaded) return;

    setMapLoading(true);

    try {
      // Destroy existing map if any
      if (mapRef.current) {
        mapRef.current.destroy();
      }

      // Create map
      const map = new window.mapkit.Map(mapContainerRef.current, {
        center: new window.mapkit.Coordinate(latitude, longitude),
        region: new window.mapkit.CoordinateRegion(
          new window.mapkit.Coordinate(latitude, longitude),
          new window.mapkit.CoordinateSpan(0.01, 0.01)
        ),
        showsZoomControl: true,
        showsMapTypeControl: true,
      });

      // Create draggable marker
      const marker = new window.mapkit.MarkerAnnotation(
        new window.mapkit.Coordinate(latitude, longitude),
        {
          title: placeName,
          subtitle: placeAddress,
          color: '#007AFF',
          draggable: true,
        }
      );

      map.addAnnotation(marker);
      mapRef.current = map;
      markerRef.current = marker;

      setSelectedLocation({
        latitude,
        longitude,
        placeName,
        placeAddress,
      });

      // Handle marker drag end
      marker.addEventListener('drag-end', async () => {
        const coord = marker.coordinate;
        const placeInfo = await reverseGeocode(coord.latitude, coord.longitude);
        setSelectedLocation({
          latitude: coord.latitude,
          longitude: coord.longitude,
          placeName: placeInfo?.name || placeName,
          placeAddress: placeInfo?.address || placeAddress,
        });
      });

      setMapLoading(false);
    } catch (error) {
      console.error('Error initializing search map:', error);
      setMapError('Failed to initialize map');
      setMapLoading(false);
    }
  }, [token, isMapKitLoaded, reverseGeocode]);

  // Perform search
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim() || !searchRef.current) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      searchRef.current.search(searchQuery, (error: any, data: any) => {
        setIsSearching(false);

        if (error || !data?.places?.length) {
          setMapError('No results found. Try a different search.');
          return;
        }

        const results: SearchResult[] = data.places.map((place: any) => ({
          coordinate: {
            latitude: place.coordinate.latitude,
            longitude: place.coordinate.longitude,
          },
          name: place.name || 'Unknown',
          formattedAddress: place.formattedAddress,
        }));

        setSearchResults(results);
      });
    } catch (error) {
      console.error('Search error:', error);
      setMapError('Search failed. Please try again.');
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle mode change
  const handleModeChange = (newMode: InputMode) => {
    setMode(newMode);
    setMapError(null);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Handle save
  const handleSave = () => {
    if (!selectedLocation) return;

    const mapData: MapData = {
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      place_name: selectedLocation.placeName,
      place_address: selectedLocation.placeAddress,
      zoom_level: 14,
      map_type: 'standard',
      annotations: [
        {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          title: selectedLocation.placeName,
          subtitle: selectedLocation.placeAddress,
        },
      ],
      created_via: mode === 'current_location' ? 'current_location' : 'search',
      timestamp: new Date().toISOString(),
    };

    onSave(mapData, selectedLocation.placeName);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
      }
    };
  }, []);

  if (authLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-2 text-gray-600">Loading MapKit...</span>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm">Failed to authenticate with MapKit: {authError}</p>
      </div>
    );
  }

  // Mode selection screen
  if (mode === 'select') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Add Map Location</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handleModeChange('current_location')}
            className="flex flex-col items-center justify-center p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-12 h-12 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z" />
            </svg>
            <span className="text-sm font-medium text-gray-900">Current Location</span>
            <span className="text-xs text-gray-500 mt-1">Use your device location</span>
          </button>

          <button
            onClick={() => handleModeChange('search')}
            className="flex flex-col items-center justify-center p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-12 h-12 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-900">Search Location</span>
            <span className="text-xs text-gray-500 mt-1">Find a place by name</span>
          </button>
        </div>
      </div>
    );
  }

  // Map view for current location mode
  if (mode === 'current_location') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4 pt-4">
          <button
            onClick={() => setMode('select')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          <h3 className="text-lg font-medium text-gray-900">Current Location</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {mapError && (
          <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{mapError}</p>
          </div>
        )}

        {mapLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="ml-3 text-gray-600">Getting your location...</span>
          </div>
        )}

        <div ref={mapContainerRef} className="w-full h-80 rounded-lg overflow-hidden" />

        {selectedLocation && (
          <div className="px-4 pb-4 space-y-4">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{selectedLocation.placeName}</p>
              {selectedLocation.placeAddress && (
                <p className="text-xs text-gray-500 mt-1">{selectedLocation.placeAddress}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Location
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Search mode
  if (mode === 'search') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4 pt-4">
          <button
            onClick={() => setMode('select')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          <h3 className="text-lg font-medium text-gray-900">Search Location</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Search for a place..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={performSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {mapError && (
          <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{mapError}</p>
          </div>
        )}

        {searchResults.length > 0 && !selectedLocation && (
          <div className="px-4 max-h-64 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2">Select a location:</p>
            <div className="space-y-2">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => initSearchMap(
                    result.coordinate.latitude,
                    result.coordinate.longitude,
                    result.name,
                    result.formattedAddress
                  )}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{result.name}</p>
                  {result.formattedAddress && (
                    <p className="text-xs text-gray-500 mt-1">{result.formattedAddress}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedLocation && (
          <>
            <div ref={mapContainerRef} className="w-full h-80 rounded-lg overflow-hidden" />

            <div className="px-4 pb-4 space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{selectedLocation.placeName}</p>
                {selectedLocation.placeAddress && (
                  <p className="text-xs text-gray-500 mt-1">{selectedLocation.placeAddress}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedLocation(null);
                    if (mapRef.current) {
                      mapRef.current.destroy();
                      mapRef.current = null;
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Search Again
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Location
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};

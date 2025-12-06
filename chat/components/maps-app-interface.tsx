"use client";

import { useState } from "react";
import { MapDisplay, type MapData } from "@/components/list/MapDisplay";
import { MapInput } from "@/components/list/MapInput";
import { MapPin, Plus } from "lucide-react";

/**
 * MapsAppInterface
 *
 * Standalone maps app interface that allows users to:
 * - Find locations using current position or search
 * - View saved locations on Apple Maps
 */
export function MapsAppInterface() {
  const [savedLocation, setSavedLocation] = useState<MapData | null>(null);
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  const handleMapSaved = (mapData: MapData, placeName: string) => {
    setSavedLocation(mapData);
    setIsAddingLocation(false);
  };

  const handleCancel = () => {
    setIsAddingLocation(false);
  };

  const handleClearLocation = () => {
    setSavedLocation(null);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-400/10">
            <MapPin className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-lg font-semibold text-white">Maps</h1>
        </div>
        {savedLocation && !isAddingLocation && (
          <button
            onClick={() => setIsAddingLocation(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Location
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isAddingLocation ? (
          <div className="bg-white rounded-lg m-4">
            <MapInput onSave={handleMapSaved} onCancel={handleCancel} />
          </div>
        ) : savedLocation ? (
          <div className="p-4 space-y-4">
            <MapDisplay mapData={savedLocation} className="shadow-lg" />
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddingLocation(true)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Change Location
              </button>
              <button
                onClick={handleClearLocation}
                className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="p-4 rounded-full bg-red-400/10 mb-4">
              <MapPin className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              No Location Saved
            </h2>
            <p className="text-neutral-400 mb-6 max-w-sm">
              Find a location using your current position or search for a place.
            </p>
            <button
              onClick={() => setIsAddingLocation(true)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Location
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

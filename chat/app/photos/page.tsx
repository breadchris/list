"use client";

import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";
import { PhotosLanding } from "@/components/photos/photos-landing";

export default function PhotosPage() {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <GlobalGroupProvider>
      <div className="min-h-screen bg-gradient-to-br from-fuchsia-400 via-purple-400 to-pink-400 p-4 md:p-8 flex items-center justify-center">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="photos"
        />
        <div className="w-full h-[calc(100vh-2rem)] md:w-[90vw] md:h-[85vh] md:max-w-7xl md:max-h-[900px] bg-neutral-900 rounded-lg md:shadow-2xl overflow-hidden flex flex-col">
          {/* macOS Window Controls */}
          <div className="hidden md:flex items-center px-4 py-3 bg-neutral-800 border-b border-neutral-700">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer"></div>
            </div>
            <div className="flex-1 text-center text-sm text-neutral-300">
              Photos
            </div>
            <div className="w-[52px]"></div>
          </div>

          {/* Photos Content */}
          <div className="flex-1 overflow-hidden relative">
            <PhotosLanding />
          </div>
        </div>
        <Toaster />
      </div>
    </GlobalGroupProvider>
  );
}

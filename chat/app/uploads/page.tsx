"use client";

import { useState } from "react";
import { Finder } from "@/components/finder/Finder";
import { Toaster } from "@/components/ui/sonner";
import { AppSwitcherButton } from "@/components/app-switcher-button";
import { AppSwitcherPanel } from "@/components/app-switcher-panel";
import { GlobalGroupProvider } from "@/components/GlobalGroupContext";

export default function UploadsPage() {
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  return (
    <GlobalGroupProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-4 md:p-8 flex items-center justify-center">
        <AppSwitcherButton onClick={() => setAppSwitcherOpen(true)} />
        <AppSwitcherPanel
          isOpen={appSwitcherOpen}
          onClose={() => setAppSwitcherOpen(false)}
          currentApp="uploads"
        />
        <div className="w-full h-[calc(100vh-2rem)] md:w-[90vw] md:h-[85vh] md:max-w-7xl md:max-h-[900px] bg-white rounded-lg md:shadow-2xl overflow-hidden flex flex-col">
          {/* macOS Window Controls */}
          <div className="hidden md:flex items-center px-4 py-3 bg-gray-100 border-b border-gray-300">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer"></div>
            </div>
            <div className="flex-1 text-center text-sm text-gray-700">
              Files
            </div>
            <div className="w-[52px]"></div>
          </div>

          {/* Finder Content */}
          <div className="flex-1 overflow-hidden">
            <Finder />
          </div>
        </div>
        <Toaster />
      </div>
    </GlobalGroupProvider>
  );
}

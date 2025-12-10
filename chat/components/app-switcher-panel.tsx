"use client";

import { X, Check, Home, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllApps } from "@/lib/apps.config";
import { useUsername, clearUsername } from "./username-prompt";
import { PublishGroupSelector } from "./PublishGroupSelector";
import { useAppSettings } from "./AppSettingsContext";

interface AppSwitcherPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentApp: string;
}

export function AppSwitcherPanel({
  isOpen,
  onClose,
  currentApp,
}: AppSwitcherPanelProps) {
  const router = useRouter();
  const apps = getAllApps();
  const username = useUsername();
  const settingsComponent = useAppSettings();

  const handleAppClick = (appId: string) => {
    router.push(`/${appId}`);
    onClose();
  };

  const handleHomeClick = () => {
    router.push("/");
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 left-0 w-full sm:w-[400px] bg-neutral-950 border-r border-neutral-800 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950">
          <h2 className="text-neutral-400 font-mono text-sm">Apps</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* App-specific settings component */}
        {settingsComponent && (
          <div className="border-b border-neutral-800 bg-neutral-950">
            {settingsComponent}
          </div>
        )}

        {/* Apps list */}
        <div className="p-4 space-y-2 overflow-y-auto h-[calc(100%-120px)]">
          {/* Home/All Apps button */}
          <button
            onClick={handleHomeClick}
            className="w-full text-left p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                <Home className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-neutral-300 group-hover:text-neutral-100">
                  All Apps
                </div>
                <div className="text-xs text-neutral-500">
                  Return to apps grid
                </div>
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-neutral-800 my-3" />

          {/* Individual apps */}
          {apps.map((app) => {
            const isActive = currentApp === app.id;
            const Icon = app.icon;

            return (
              <button
                key={app.id}
                onClick={() => handleAppClick(app.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors group ${
                  isActive
                    ? "bg-blue-600 border border-blue-500"
                    : "bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-blue-500" : app.bgColor
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? "text-blue-100" : app.color}`}
                    />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-medium ${
                        isActive
                          ? "text-blue-100"
                          : "text-neutral-300 group-hover:text-neutral-100"
                      }`}
                    >
                      {app.name}
                    </div>
                    <div
                      className={`text-xs ${
                        isActive ? "text-blue-200" : "text-neutral-500"
                      }`}
                    >
                      {app.description.split(" ").slice(0, 6).join(" ")}...
                    </div>
                  </div>
                  {isActive && <Check className="w-5 h-5 text-blue-100" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* User section */}
        {username && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-800 bg-neutral-950">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                <User className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-neutral-300">{username}</div>
              </div>
              <PublishGroupSelector />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

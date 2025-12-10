"use client";

import React from "react";
import { Grid3X3, List, Search, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ViewMode = "list" | "icons";

interface FinderToolbarProps {
  groupName: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar?: () => void;
}

export function FinderToolbar({
  groupName,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onToggleSidebar,
}: FinderToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-white border-b border-gray-200">
      {/* Left section: Menu button and View Controls */}
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Mobile Menu Button */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden h-8 w-8 p-0"
            onClick={onToggleSidebar}
          >
            <Menu className="w-4 h-4" />
          </Button>
        )}

        {/* View mode controls */}
        <div className="flex items-center bg-gray-100 rounded-md p-1">
          <Button
            variant={viewMode === "icons" ? "default" : "ghost"}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onViewModeChange("icons")}
          >
            <Grid3X3 className="w-3 h-3" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onViewModeChange("list")}
          >
            <List className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Center section: Group name */}
      <div className="hidden md:flex items-center text-sm text-gray-700 font-medium">
        {groupName || "Select a group"}
      </div>

      {/* Mobile Group name */}
      <div className="md:hidden flex items-center flex-1 justify-center mx-2 min-w-0">
        <span className="text-xs text-gray-700 truncate font-medium">
          {groupName || "Select a group"}
        </span>
      </div>

      {/* Right section: Search */}
      <div className="hidden md:flex items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-8 w-48 bg-gray-100 border-0 focus:bg-white focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              onClick={() => onSearchChange("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

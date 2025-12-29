"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { getAllApps } from "@/lib/apps.config";
import { useSupabaseUser } from "@/hooks/useSupabaseAuth";
import { useGlobalGroup } from "./GlobalGroupContext";
import { AuthModal } from "./AuthModal";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/list/SupabaseClient";
import { useState, useRef, useEffect } from "react";

function UserGroupHeader() {
  const { user, isLoading: authLoading } = useSupabaseUser();
  const { selectedGroup, setSelectedGroup, groups, isLoading: groupsLoading } =
    useGlobalGroup();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsUserDropdownOpen(false);
  };

  const isLoading = authLoading || groupsLoading;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-neutral-500"
      >
        ...
      </motion.div>
    );
  }

  const groupName = selectedGroup?.name || "No group";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-1 text-sm"
      >
        {user ? (
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="text-neutral-400 hover:text-neutral-300 truncate max-w-[200px] transition-colors"
            >
              {user.email}
            </button>
            {isUserDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg overflow-hidden z-50 min-w-[120px]">
                <button
                  onClick={handleSignOut}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-neutral-800 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Login
          </button>
        )}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-400 transition-colors"
        >
          <span className="truncate max-w-[140px]">{groupName}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isDropdownOpen && groups.length > 0 && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  setSelectedGroup(group);
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  selectedGroup?.id === group.id
                    ? "bg-blue-600 text-white"
                    : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
}

export function AppsGrid() {
  const apps = getAllApps();

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center p-8 gap-8">
      <UserGroupHeader />
      <div className="grid grid-cols-4 gap-4 sm:gap-6 max-w-2xl">
        {apps.map((app, index) => (
          <Link key={app.id} href={`/${app.id}`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              {/* App Icon */}
              <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-[22%] ${app.bgColor} flex items-center justify-center shadow-lg`}>
                <app.icon className={`w-8 h-8 sm:w-10 sm:h-10 ${app.color}`} />
              </div>
              {/* App Name */}
              <span className="text-xs sm:text-sm text-neutral-300 text-center font-medium truncate w-full">
                {app.name}
              </span>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

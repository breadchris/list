"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { getAllApps } from "@/lib/apps.config";

export function AppsGrid() {
  const apps = getAllApps();

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center p-8">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6 max-w-2xl">
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
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[22%] ${app.bgColor} flex items-center justify-center shadow-lg`}>
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

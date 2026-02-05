"use client";

import { useRouter, usePathname } from "next/navigation";
import { Bot, Wrench, GitBranch, Database, Activity } from "lucide-react";

const navItems = [
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/agents/tools", icon: Wrench, label: "Tools" },
  { href: "/agents/workflows", icon: GitBranch, label: "Workflows" },
  { href: "/agents/knowledge", icon: Database, label: "Knowledge" },
  { href: "/agents/logs", icon: Activity, label: "Logs" },
];

export function AgentStudioNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname === "/agents") return "/agents";
    for (const item of navItems) {
      if (item.href !== "/agents" && pathname.startsWith(item.href)) {
        return item.href;
      }
    }
    return "/agents";
  };

  const activeTab = getActiveTab();

  return (
    <div className="flex items-center gap-1 px-4 pl-14 py-2 border-b border-neutral-800 bg-neutral-900/50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === activeTab;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title: string;
  showBackButton?: boolean;
}

export function AppHeader({ title, showBackButton = false }: AppHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900 px-8 py-4">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        {showBackButton && (
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-neutral-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Apps
            </Button>
          </Link>
        )}
        <h1 className="text-xl font-semibold text-neutral-100">{title}</h1>
      </div>
    </div>
  );
}

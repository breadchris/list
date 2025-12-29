"use client";

import { Check, Users } from "lucide-react";
import { useState } from "react";
import { useGlobalGroupOptional } from "./GlobalGroupContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GlobalGroupSelectorProps {
  trigger?: React.ReactNode;
}

export function GlobalGroupSelector({ trigger }: GlobalGroupSelectorProps) {
  const context = useGlobalGroupOptional();
  const [open, setOpen] = useState(false);

  // If context not available (provider not mounted), don't render
  if (!context) {
    return null;
  }

  const { selectedGroup, setSelectedGroup, groups, isLoading } = context;

  const defaultTrigger = (
    <button
      disabled={isLoading}
      className="flex items-center gap-0.5 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
    >
      <Users className="w-2.5 h-2.5" />
      <span className="truncate max-w-[60px]">
        {isLoading ? "..." : selectedGroup?.name || "Group"}
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="bg-neutral-900 border-neutral-800 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-neutral-100">
            Select a group
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {groups.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">
              No groups available
            </p>
          ) : (
            groups.map((group) => {
              const isSelected = selectedGroup?.id === group.id;

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-blue-100"
                      : "hover:bg-neutral-800 text-neutral-300"
                  }`}
                >
                  <span className="text-sm truncate">{group.name}</span>
                  {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

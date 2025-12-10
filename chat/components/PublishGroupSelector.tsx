"use client";

import { Check, Users } from "lucide-react";
import { useState } from "react";
import { usePublishGroupOptional } from "./PublishGroupContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PublishGroupSelectorProps {
  trigger?: React.ReactNode;
}

export function PublishGroupSelector({ trigger }: PublishGroupSelectorProps) {
  const context = usePublishGroupOptional();
  const [open, setOpen] = useState(false);

  // If context not available (provider not mounted), don't render
  if (!context) {
    return null;
  }

  const { selectedGroup, setSelectedGroup, groups, isLoading } = context;

  const defaultTrigger = (
    <button
      disabled={isLoading}
      className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
    >
      <Users className="w-3 h-3" />
      <span className="truncate max-w-[80px]">
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

"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ListVideo } from "lucide-react";
import { VideoQueueItem } from "./video-queue-item";
import { useQueueWithSections, useCurrentIndex } from "../hooks/use-dj-state";
import { useQueueActions, usePlaybackActions } from "../hooks/use-dj-actions";

export function VideoQueue() {
  const queueWithSections = useQueueWithSections();
  const currentIndex = useCurrentIndex();
  const { removeVideo, reorderQueue } = useQueueActions();
  const { playVideo } = usePlaybackActions();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Separate videos by section
  const { played, current, upcoming } = useMemo(() => {
    const played = queueWithSections.filter((v) => v.section === "played");
    const current = queueWithSections.find((v) => v.section === "current");
    const upcoming = queueWithSections.filter((v) => v.section === "upcoming");
    return { played, current, upcoming };
  }, [queueWithSections]);

  // Handle drag end for reordering upcoming videos
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find indices in the full queue
    const activeVideo = queueWithSections.find((v) => v.id === active.id);
    const overVideo = queueWithSections.find((v) => v.id === over.id);

    if (!activeVideo || !overVideo) return;

    // Only allow reordering within upcoming section
    if (activeVideo.section !== "upcoming" || overVideo.section !== "upcoming") {
      return;
    }

    reorderQueue({
      old_index: activeVideo.queue_index,
      new_index: overVideo.queue_index,
    });
  };

  // Empty state
  if (queueWithSections.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-neutral-500 p-4">
        <ListVideo className="w-6 h-6 md:w-8 md:h-8 mb-2 opacity-50" />
        <p className="text-xs md:text-sm">No videos in queue</p>
        <p className="text-xs text-neutral-600 mt-1 hidden md:block">
          Press Cmd+K to add videos
        </p>
        <p className="text-xs text-neutral-600 mt-1 md:hidden">
          Tap + to add videos
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Desktop header - hidden on mobile since we have the toggle */}
      <div className="hidden md:block px-4 py-2 border-b border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-300">
          Queue ({queueWithSections.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
        {/* Played videos (non-draggable) */}
        {played.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-neutral-600 px-2 mb-1">Played</p>
            {played.map((video) => (
              <VideoQueueItem
                key={video.id}
                video={video}
                onPlay={playVideo}
                onRemove={removeVideo}
                isDraggable={false}
              />
            ))}
          </div>
        )}

        {/* Current video (non-draggable) */}
        {current && (
          <div className="mb-2">
            <p className="text-xs text-neutral-600 px-2 mb-1">Now Playing</p>
            <VideoQueueItem
              video={current}
              onPlay={playVideo}
              onRemove={removeVideo}
              isDraggable={false}
            />
          </div>
        )}

        {/* Upcoming videos (draggable) */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-xs text-neutral-600 px-2 mb-1">Up Next</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={upcoming.map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {upcoming.map((video) => (
                  <VideoQueueItem
                    key={video.id}
                    video={video}
                    onPlay={playVideo}
                    onRemove={removeVideo}
                    isDraggable={true}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}

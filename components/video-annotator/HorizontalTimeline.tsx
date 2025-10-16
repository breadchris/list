import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { formatTime } from "../../utils/time";
import {
  ZoomIn,
  ZoomOut,
  Repeat,
  PlayCircle,
  MoveHorizontal,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { Slider } from "../ui/slider";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

// Types defined locally for HorizontalTimeline
export interface TimestampAnnotation {
  id: string;
  timestamp: number;
  comment: string;
  transcriptBefore?: string;
  transcriptAfter?: string;
}

export interface VideoSection {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  timestampIds: string[];
}

interface HorizontalTimelineProps {
  currentTime: number;
  duration: number;
  annotations: TimestampAnnotation[];
  sections: VideoSection[];
  activeSection: string | null;
  setActiveSection: (sectionId: string | null) => void;
  onAddAnnotation: (timestamp: number) => void;
  onCreateSection: (startTime: number, endTime: number, timestampIds: string[]) => void;
  onJumpToTimestamp: (timestamp: number) => void;
  onSetLoopSelection?: (startTime: number, endTime: number, sectionId?: string) => void;
  onUpdateSectionBoundary: (id: string, startTime: number, endTime: number) => void;
  isLooping?: boolean;
  toggleLooping?: () => void;
}

export function HorizontalTimeline({
  currentTime,
  duration,
  annotations,
  sections,
  activeSection,
  setActiveSection,
  onAddAnnotation,
  onCreateSection,
  onJumpToTimestamp,
  onSetLoopSelection,
  onUpdateSectionBoundary,
  isLooping = false,
  toggleLooping
}: HorizontalTimelineProps) {
  // Constants for padding and snapping
  const TIMELINE_PADDING_LEFT = 40; // Pixels of padding at the left
  const TIMELINE_PADDING_RIGHT = 40; // Pixels of padding at the right
  const SNAP_THRESHOLD = 3; // Time in seconds to snap to a timestamp
  
  // Timeline state
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showHoverIndicator, setShowHoverIndicator] = useState(false);
  const [snappedToTimestamp, setSnappedToTimestamp] = useState<string | null>(null);
  const [isResizingSelection, setIsResizingSelection] = useState(false);
  const [resizingBoundary, setResizingBoundary] = useState<'start' | 'end' | null>(null);
  const [isResizingSection, setIsResizingSection] = useState(false);
  const [resizingSectionId, setResizingSectionId] = useState<string | null>(null);
  const [resizingSectionBoundary, setResizingSectionBoundary] = useState<'start' | 'end' | null>(null);
  
  // Zoom and scroll state
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, >1 = zoomed in
  const [visibleStartTime, setVisibleStartTime] = useState(0);
  const [visibleDuration, setVisibleDuration] = useState(duration);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  
  // UI state
  const [expanded, setExpanded] = useState(true);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // Sort annotations by timestamp (ascending)
  const sortedAnnotations = [...annotations].sort((a, b) => a.timestamp - b.timestamp);

  // Update visible duration when zoom level changes
  useEffect(() => {
    setVisibleDuration(duration / zoomLevel);
    
    // Ensure current time is visible when zooming
    if (currentTime < visibleStartTime || currentTime > visibleStartTime + visibleDuration) {
      const newStart = Math.max(0, currentTime - (visibleDuration / 2));
      setVisibleStartTime(Math.min(newStart, duration - visibleDuration));
    }
  }, [zoomLevel, duration, currentTime]);

  // Update visible range when duration changes
  useEffect(() => {
    setVisibleDuration(duration / zoomLevel);
    
    // If visible range exceeds new duration, adjust it
    if (visibleStartTime + visibleDuration > duration) {
      setVisibleStartTime(Math.max(0, duration - visibleDuration));
    }
  }, [duration]);

  // Auto-scroll to keep current time in view
  useEffect(() => {
    // Only auto-scroll if current time is outside visible range
    const buffer = visibleDuration * 0.1; // 10% buffer
    
    if (currentTime < visibleStartTime + buffer) {
      // Current time is before visible range
      setVisibleStartTime(Math.max(0, currentTime - buffer));
    } else if (currentTime > visibleStartTime + visibleDuration - buffer) {
      // Current time is after visible range
      setVisibleStartTime(Math.min(
        duration - visibleDuration, 
        currentTime - visibleDuration + buffer
      ));
    }
  }, [currentTime, visibleStartTime, visibleDuration, duration]);

  // Update loop selection when selection changes
  useEffect(() => {
    if (selectionStart !== null && selectionEnd !== null && onSetLoopSelection && isLooping) {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      
      // Only update if there's a valid selection
      if (end - start >= 1) {
        onSetLoopSelection(start, end);
      }
    }
  }, [selectionStart, selectionEnd, onSetLoopSelection, isLooping]);

  // Function to find the nearest timestamp to a given time
  const findNearestTimestamp = (time: number): { id: string, timestamp: number } | null => {
    if (annotations.length === 0) return null;
    
    // Find timestamp closest to the given time within threshold
    let closestTimestamp = null;
    let minDistance = SNAP_THRESHOLD;
    
    for (const annotation of annotations) {
      const distance = Math.abs(annotation.timestamp - time);
      if (distance < minDistance) {
        minDistance = distance;
        closestTimestamp = annotation;
      }
    }
    
    if (closestTimestamp) {
      return {
        id: closestTimestamp.id,
        timestamp: closestTimestamp.timestamp
      };
    }
    
    return null;
  };

  // Function to snap time to nearest timestamp if within threshold
  const snapToNearestTimestamp = (time: number): number => {
    const nearest = findNearestTimestamp(time);
    if (nearest) {
      setSnappedToTimestamp(nearest.id);
      return nearest.timestamp;
    }
    
    setSnappedToTimestamp(null);
    return time;
  };

  // Convert X position to time based on visible range
  const getTimeFromXPosition = (x: number, rect: DOMRect) => {
    // Adjust for padding
    if (x < TIMELINE_PADDING_LEFT) {
      return visibleStartTime; // Start of visible range if clicking in left padding
    } else if (x > rect.width - TIMELINE_PADDING_RIGHT) {
      return visibleStartTime + visibleDuration; // End of visible range if clicking in right padding
    }
    
    // Calculate time within the visible range
    const timePercent = (x - TIMELINE_PADDING_LEFT) / (rect.width - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT);
    return visibleStartTime + (timePercent * visibleDuration);
  };

  // Handle timeline hover to show time indicator
  const handleTimelineHover = (e: React.MouseEvent) => {
    if (!timelineContentRef.current) return;
    
    const rect = timelineContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Skip hover if in the padding areas
    if (x < TIMELINE_PADDING_LEFT || x > rect.width - TIMELINE_PADDING_RIGHT) {
      setShowHoverIndicator(false);
      return;
    }
    
    // Convert x position to time
    const hoverTimeValue = getTimeFromXPosition(x, rect);
    
    // Check if we should snap this hover indicator
    const nearest = findNearestTimestamp(hoverTimeValue);
    if (nearest && !isDragging && !isResizingSelection) {
      setHoverTime(nearest.timestamp);
      setSnappedToTimestamp(nearest.id);
    } else {
      setHoverTime(hoverTimeValue);
      setSnappedToTimestamp(null);
    }
    
    setShowHoverIndicator(true);
  };

  // Clear hover indicator when mouse leaves
  const handleTimelineLeave = () => {
    setShowHoverIndicator(false);
    setSnappedToTimestamp(null);
  };

  // Handle direct timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent) => {
    // If we're resizing, don't seek on click
    if (isResizingSelection) return;
    
    // Skip if we're interacting with other controls
    if ((e.target as HTMLElement).closest('.section-header, .annotation-card, .zoom-controls, .timestamp-marker, .section-indicator, .selection-handle')) {
      return;
    }
    
    if (!timelineContentRef.current) return;
    
    const rect = timelineContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Get time from x position
    let clickTime = getTimeFromXPosition(x, rect);
    
    // Snap to nearest timestamp if close enough
    const snappedTime = snapToNearestTimestamp(clickTime);
    if (snappedTime !== clickTime) {
      clickTime = snappedTime;
    }
    
    // Seek to this position
    onJumpToTimestamp(clickTime);
    
    // Add a visual feedback for the click
    setHoverTime(clickTime);
    setShowHoverIndicator(true);
    setTimeout(() => {
      setShowHoverIndicator(false);
      setSnappedToTimestamp(null);
    }, 800);
  };

  // Handle mouse down to start selection
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start selection if shift key is pressed
    if (!e.shiftKey) return;
    
    // Skip if we're interacting with other controls or sections
    if ((e.target as HTMLElement).closest('.section-header, .annotation-card, .zoom-controls, .timestamp-marker, .section-indicator, .timeline-padding, .selection-handle')) {
      return;
    }
    
    if (!timelineContentRef.current) return;
    
    const rect = timelineContentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Ignore clicks in the padding areas
    if (x < TIMELINE_PADDING_LEFT || x > rect.width - TIMELINE_PADDING_RIGHT) {
      return;
    }
    
    // Convert x position to time based on visible range
    let time = getTimeFromXPosition(x, rect);
    
    // Snap to nearest timestamp if close enough
    const snappedTime = snapToNearestTimestamp(time);
    if (snappedTime !== time) {
      time = snappedTime;
    }
    
    setSelectionStart(time);
    setSelectionEnd(time);
    setIsDragging(true);
    
    // Prevent default behavior
    e.preventDefault();
  };

  // Handle mouse move to update selection
  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle hover time indicator
    handleTimelineHover(e);
    
    // Update selection if we're dragging a selection
    if (isDragging && !isResizingSelection && !isResizingSection && timelineContentRef.current) {
      const rect = timelineContentRef.current.getBoundingClientRect();
      const x = Math.max(TIMELINE_PADDING_LEFT, Math.min(e.clientX - rect.left, rect.width - TIMELINE_PADDING_RIGHT));
      
      // Convert x position to time based on visible range
      let time = getTimeFromXPosition(x, rect);
      
      // Snap to nearest timestamp if close enough
      const snappedTime = snapToNearestTimestamp(time);
      if (snappedTime !== time) {
        time = snappedTime;
      }
      
      setSelectionEnd(time);
    }
    
    // Handle selection resizing
    if (isResizingSelection && resizingBoundary && timelineContentRef.current) {
      const rect = timelineContentRef.current.getBoundingClientRect();
      const x = Math.max(TIMELINE_PADDING_LEFT, Math.min(e.clientX - rect.left, rect.width - TIMELINE_PADDING_RIGHT));
      
      // Convert x position to time based on visible range
      let time = getTimeFromXPosition(x, rect);
      
      // Snap to nearest timestamp if close enough
      const snappedTime = snapToNearestTimestamp(time);
      if (snappedTime !== time) {
        time = snappedTime;
      }
      
      // Update the appropriate boundary
      if (resizingBoundary === 'start') {
        setSelectionStart(time);
      } else {
        setSelectionEnd(time);
      }
      
      // If looping is active, update the loop range in real-time
      if (isLooping && onSetLoopSelection && selectionStart !== null && selectionEnd !== null) {
        const start = resizingBoundary === 'start' ? time : selectionStart;
        const end = resizingBoundary === 'end' ? time : selectionEnd;
        onSetLoopSelection(Math.min(start, end), Math.max(start, end));
      }
    }
    
    // Handle section resizing
    if (isResizingSection && resizingSectionId && resizingSectionBoundary && timelineContentRef.current) {
      const rect = timelineContentRef.current.getBoundingClientRect();
      const x = Math.max(TIMELINE_PADDING_LEFT, Math.min(e.clientX - rect.left, rect.width - TIMELINE_PADDING_RIGHT));
      
      // Convert x position to time based on visible range
      let time = getTimeFromXPosition(x, rect);
      
      // Snap to nearest timestamp if close enough
      const snappedTime = snapToNearestTimestamp(time);
      if (snappedTime !== time) {
        time = snappedTime;
      }
      
      // Get the current section
      const section = sections.find(s => s.id === resizingSectionId);
      if (section) {
        // Calculate new boundaries
        const newStartTime = resizingSectionBoundary === 'start' ? time : section.startTime;
        const newEndTime = resizingSectionBoundary === 'end' ? time : section.endTime;
        
        // Ensure start is before end (minimum 1 second)
        if (newEndTime - newStartTime >= 1) {
          onUpdateSectionBoundary(resizingSectionId, newStartTime, newEndTime);
        }
      }
    }
  };

  // Handle mouse up to finish selection or resizing
  const handleMouseUp = () => {
    // Handle finishing selection creation
    if (isDragging && selectionStart !== null && selectionEnd !== null) {
      // Ensure start is before end
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);
      
      // Only keep a selection if it's at least 1 second
      if (end - start >= 1) {
        // Keep the selection regardless of whether it contains timestamps
        setSelectionStart(start);
        setSelectionEnd(end);
      } else {
        // Too small selection, clear it
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    }
    
    // Reset dragging and resizing states
    setIsDragging(false);
    setIsResizingSelection(false);
    setResizingBoundary(null);
    setIsResizingSection(false);
    setResizingSectionId(null);
    setResizingSectionBoundary(null);
  };

  // Handle selection boundary resize start
  const handleSelectionResizeStart = (e: React.MouseEvent, boundary: 'start' | 'end') => {
    e.stopPropagation(); // Prevent timeline click
    
    if (selectionStart === null || selectionEnd === null) return;
    
    setIsResizingSelection(true);
    setResizingBoundary(boundary);
    
    // Prevent default to avoid any text selection
    e.preventDefault();
  };

  // Handle section boundary resize start
  const handleSectionResizeStart = (e: React.MouseEvent, sectionId: string, boundary: 'start' | 'end') => {
    e.stopPropagation(); // Prevent timeline click and section click
    
    setIsResizingSection(true);
    setResizingSectionId(sectionId);
    setResizingSectionBoundary(boundary);
    
    // Prevent default to avoid any text selection
    e.preventDefault();
  };

  // Handle timeline drag start (for scrolling)
  const handleTimelineDragStart = (e: React.MouseEvent) => {
    // Skip if we're interacting with other controls
    if ((e.target as HTMLElement).closest('.section-header, .annotation-card, .zoom-controls, .timestamp-marker, .section-indicator, .timeline-padding, .selection-handle')) {
      return;
    }
    
    // Only initiate dragging if the middle mouse button is pressed or Alt key is held
    if (e.button !== 1 && !e.altKey) return;
    
    setIsDraggingTimeline(true);
    setDragStartX(e.clientX);
    setDragStartTime(visibleStartTime);
    
    // Prevent default behavior
    e.preventDefault();
  };

  // Handle timeline drag move
  const handleTimelineDragMove = (e: React.MouseEvent) => {
    if (!isDraggingTimeline || !timelineRef.current) return;
    
    const deltaX = dragStartX - e.clientX;
    const timelineWidth = timelineRef.current.getBoundingClientRect().width - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT;
    const timeDelta = (deltaX / timelineWidth) * visibleDuration;
    
    // Calculate new start time ensuring it stays within bounds
    const newStartTime = Math.max(
      0,
      Math.min(
        duration - visibleDuration,
        dragStartTime + timeDelta
      )
    );
    
    setVisibleStartTime(newStartTime);
  };

  // Handle timeline drag end
  const handleTimelineDragEnd = () => {
    setIsDraggingTimeline(false);
  };

  // Handle zoom in/out
  const handleZoomChange = (newZoom: number) => {
    // Ensure zoom level is between 1 and 10
    const clampedZoom = Math.max(1, Math.min(10, newZoom));
    
    // If we're zooming in, center on current time
    if (clampedZoom > zoomLevel) {
      const centerTime = currentTime;
      const newVisibleDuration = duration / clampedZoom;
      const newStartTime = Math.max(
        0,
        Math.min(
          duration - newVisibleDuration,
          centerTime - (newVisibleDuration / 2)
        )
      );
      
      setVisibleStartTime(newStartTime);
    }
    
    setZoomLevel(clampedZoom);
  };

  // Handle mouse wheel for zooming and scrolling
  const handleWheel = (e: React.WheelEvent) => {
    // Prevent default to avoid page scrolling
    e.preventDefault();
    
    // Zoom if Ctrl key is pressed, otherwise scroll
    if (e.ctrlKey || e.metaKey) {
      // Zoom: delta < 0 means zoom in, delta > 0 means zoom out
      const zoomDelta = e.deltaY < 0 ? 0.5 : -0.5;
      handleZoomChange(zoomLevel + zoomDelta);
    } else {
      // Scroll: move visible range left or right
      const scrollDelta = (e.deltaX / (timelineRef.current!.clientWidth - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT)) * visibleDuration;
      const newStartTime = Math.max(
        0,
        Math.min(
          duration - visibleDuration,
          visibleStartTime + scrollDelta
        )
      );
      
      setVisibleStartTime(newStartTime);
    }
  };

  // Clear current selection
  const handleClearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Handle loop selection directly from the current selection
  const handleLoopSelection = () => {
    if (selectionStart === null || selectionEnd === null || !onSetLoopSelection) return;
    
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    // Only proceed if we have a valid selection
    if (end - start >= 1) {
      onSetLoopSelection(start, end);
      
      // Enable looping if it's not already enabled
      if (toggleLooping && !isLooping) {
        toggleLooping();
      }
    }
  };

  // Handle creating a section from the current selection
  const handleCreateSectionFromSelection = () => {
    if (selectionStart === null || selectionEnd === null) return;
    
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    // Find all timestamps within the selection
    const selectedTimestampIds = annotations
      .filter(a => a.timestamp >= start && a.timestamp <= end)
      .map(a => a.id);
    
    // Create the section
    onCreateSection(start, end, selectedTimestampIds);
    
    // Clear the selection after creating section
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Handle clicking on a section to select it
  const handleSectionClick = (section: VideoSection) => {
    // Select this section
    setActiveSection(section.id);
    
    // Set up loop for this section
    if (onSetLoopSelection) {
      onSetLoopSelection(section.startTime, section.endTime, section.id);
    }
    
    // Enable looping if not already enabled
    if (toggleLooping && !isLooping) {
      toggleLooping();
    }
  };

  // Function to map time to X position in the timeline
  const getTimePosition = (time: number) => {
    // If time is outside visible range, return null
    if (time < visibleStartTime || time > visibleStartTime + visibleDuration) {
      return null;
    }
    
    // Calculate position as percentage of visible range, accounting for padding
    const timePercent = (time - visibleStartTime) / visibleDuration;
    const contentWidth = timelineContentRef.current?.clientWidth || 0;
    const availableWidth = contentWidth - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT;
    
    return `${TIMELINE_PADDING_LEFT + (timePercent * availableWidth)}px`;
  };

  // Check if a time is visible in the current view
  const isTimeVisible = (time: number) => {
    return time >= visibleStartTime && time <= visibleStartTime + visibleDuration;
  };

  // Calculate min/max selection times
  const minSelectionTime = selectionStart !== null && selectionEnd !== null 
    ? Math.min(selectionStart, selectionEnd) 
    : null;
  
  const maxSelectionTime = selectionStart !== null && selectionEnd !== null 
    ? Math.max(selectionStart, selectionEnd) 
    : null;

  if (!expanded) {
    return (
      <div className="w-full border-t relative bg-gray-100 shadow-sm">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full py-1 flex justify-center items-center" 
          onClick={() => setExpanded(true)}
        >
          <ChevronUp className="w-4 h-4 mr-1" />
          Show Timeline
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full border-t relative bg-white" ref={containerRef}>
      {/* Header with controls */}
      <div className="flex justify-between items-center px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onAddAnnotation(currentTime)}
            className="flex items-center"
          >
            <span className="mr-1">+ Add Timestamp</span>
            <span className="text-xs text-muted-foreground">({formatTime(currentTime)})</span>
          </Button>
          
          <div className="text-xs text-muted-foreground ml-2 px-2 py-1 bg-gray-50 rounded border">
            Shift+drag to select range
          </div>
          
          {/* Zoom Controls */}
          <div className="zoom-controls flex items-center gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => handleZoomChange(zoomLevel - 0.5)}
              disabled={zoomLevel <= 1}
              className="w-6 h-6"
            >
              <ZoomOut size={14} />
            </Button>
            
            <span className="text-xs font-medium w-8 text-center">
              {zoomLevel.toFixed(1)}x
            </span>
            
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => handleZoomChange(zoomLevel + 0.5)}
              disabled={zoomLevel >= 10}
              className="w-6 h-6"
            >
              <ZoomIn size={14} />
            </Button>
          </div>
        </div>
        
        {/* Loop Controls */}
        <div className="flex items-center">
          {activeSection && sections.find(s => s.id === activeSection) && (
            <div className="mr-3 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium border border-green-300 flex items-center gap-2">
              {sections.find(s => s.id === activeSection)!.title}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSection(null);
                  // Disable looping when deselecting section
                  if (isLooping && toggleLooping) {
                    toggleLooping();
                  }
                }}
                className="hover:bg-green-200 rounded p-0.5"
                title="Deselect section"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          {selectionStart !== null && selectionEnd !== null && (
            <div className="mr-2 text-xs font-medium text-gray-700">
              {formatTime(minSelectionTime!)} - {formatTime(maxSelectionTime!)}
            </div>
          )}
          
          <div className="flex items-center gap-1.5">
            <Switch
              id="horizontal-loop-mode"
              checked={isLooping}
              onCheckedChange={toggleLooping}
              disabled={selectionStart === null && selectionEnd === null}
              className="scale-75"
            />
            <Label 
              htmlFor="horizontal-loop-mode" 
              className={`text-xs flex items-center ${isLooping ? 'text-green-700 font-medium' : 'text-gray-600'} ${(selectionStart === null && selectionEnd === null) ? 'opacity-50' : ''}`}
            >
              <Repeat className={`w-3 h-3 mr-1 ${isLooping ? 'text-green-600' : ''}`} /> 
              {isLooping ? "Looping" : "Loop"}
            </Label>
          </div>
          
          {!isLooping && selectionStart !== null && selectionEnd !== null && (
            <>
              <Button
                onClick={handleLoopSelection}
                size="sm"
                variant="ghost"
                className="ml-1 h-6 px-2 text-xs"
              >
                <PlayCircle className="w-3 h-3 mr-1" /> Start Loop
              </Button>
              <Button
                onClick={handleCreateSectionFromSelection}
                size="sm"
                variant="default"
                className="ml-1 h-6 px-2 text-xs"
              >
                Create Section
              </Button>
            </>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-4" 
            onClick={() => setExpanded(false)}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Timeline Container */}
      <div 
        ref={timelineRef}
        className={`w-full h-16 relative overflow-x-auto border-b cursor-pointer`}
        onClick={handleTimelineClick}
        onMouseDown={(e) => {
          handleMouseDown(e);
          handleTimelineDragStart(e);
        }}
        onMouseMove={(e) => {
          handleMouseMove(e);
          handleTimelineDragMove(e);
        }}
        onMouseUp={(e) => {
          handleMouseUp();
          handleTimelineDragEnd();
        }}
        onMouseLeave={(e) => {
          handleTimelineLeave();
        }}
        onWheel={handleWheel}
      >
        {/* Timeline Content with Padding */}
        <div 
          ref={timelineContentRef}
          className="relative h-full w-full"
        >
          {/* Timeline Line */}
          <div className="absolute left-[40px] right-[40px] top-1/2 h-0.5 bg-gray-300" />
          
          {/* Left Padding Area with Start Time Label */}
          <div className="timeline-padding absolute left-0 top-0 h-full w-[40px] bg-gradient-to-r from-white to-transparent z-5 flex items-center justify-center">
            <div className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 px-1 py-0.5 rounded text-xs font-medium">
              {formatTime(visibleStartTime)}
            </div>
          </div>

          {/* Right Padding Area with End Time Label */}
          <div className="timeline-padding absolute right-0 top-0 h-full w-[40px] bg-gradient-to-l from-white to-transparent z-5 flex items-center justify-center">
            <div className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 px-1 py-0.5 rounded text-xs font-medium">
              {formatTime(Math.min(visibleStartTime + visibleDuration, duration))}
            </div>
          </div>

          {/* Hover Time Indicator */}
          {showHoverIndicator && hoverTime !== null && getTimePosition(hoverTime) && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-secondary/50 z-20 pointer-events-none"
                 style={{ left: getTimePosition(hoverTime) }}>
              <div className="absolute left-0 -translate-x-1/2 bottom-0 px-1 py-0.5 bg-white/90 border shadow-sm rounded text-xs">
                {formatTime(hoverTime)}
              </div>
              
              {/* Snap indicator */}
              {snappedToTimestamp && (
                <div className="absolute left-0 -translate-x-1/2 top-0 px-1 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 shadow-sm rounded-full text-xs">
                  Snap
                </div>
              )}
            </div>
          )}

          {/* Current Time Indicator */}
          {isTimeVisible(currentTime) && getTimePosition(currentTime) && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none"
              style={{ left: getTimePosition(currentTime) }}
            >
              <div className="absolute left-1/2 -translate-x-1/2 top-0 rounded-b-full bg-black w-5 h-5 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
          )}

          {/* Selection Area */}
          {selectionStart !== null && selectionEnd !== null && 
           getTimePosition(minSelectionTime!) && getTimePosition(maxSelectionTime!) && (
            <>
              <div 
                className={`absolute top-2 bottom-2 border-x ${isLooping ? 'bg-green-200/30 border-green-400' : 'bg-primary/20 border-primary'}`}
                style={{ 
                  left: getTimePosition(minSelectionTime!), 
                  width: `${Math.abs(
                    parseInt(getTimePosition(maxSelectionTime!)!) - 
                    parseInt(getTimePosition(minSelectionTime!)!)
                  )}px` 
                }}
              >
                {isLooping && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-green-100 text-green-800 rounded-b-md text-xs flex items-center shadow-sm">
                    <Repeat className="w-3 h-3 mr-1" /> Loop
                  </div>
                )}
              </div>
              
              {/* Selection Resize Handles */}
              <div 
                className="absolute top-1 bottom-1 w-4 -ml-2 bg-transparent cursor-ew-resize z-40 selection-handle"
                style={{ left: getTimePosition(minSelectionTime!) }}
                onMouseDown={(e) => handleSelectionResizeStart(e, 'start')}
                title="Drag to adjust selection start"
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 mx-auto w-4 h-8 rounded-full bg-primary/90 border border-white flex items-center justify-center">
                  <MoveHorizontal className="w-3 h-3 text-white" />
                </div>
              </div>
              
              <div 
                className="absolute top-1 bottom-1 w-4 -ml-2 bg-transparent cursor-ew-resize z-40 selection-handle"
                style={{ left: getTimePosition(maxSelectionTime!) }}
                onMouseDown={(e) => handleSelectionResizeStart(e, 'end')}
                title="Drag to adjust selection end"
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 mx-auto w-4 h-8 rounded-full bg-primary/90 border border-white flex items-center justify-center">
                  <MoveHorizontal className="w-3 h-3 text-white" />
                </div>
              </div>
            </>
          )}

          {/* Sections */}
          {sections.map(section => {
            const startPos = getTimePosition(section.startTime);
            const endPos = getTimePosition(section.endTime);
            
            // Only render if at least partially visible
            if (!startPos && !endPos) return null;
            
            const isActive = activeSection === section.id;
            
            return (
              <div key={section.id}>
                <div
                  className={`section-indicator absolute top-3 bottom-3 rounded cursor-pointer transition-all z-10
                    ${isActive ? 'bg-green-300/60 border-2 border-green-600' : 'bg-blue-200/40 border border-blue-400'}
                    hover:bg-green-200/70 hover:border-green-500`}
                  style={{
                    left: startPos || '0px',
                    width: endPos && startPos 
                      ? `${parseInt(endPos) - parseInt(startPos)}px`
                      : 'auto',
                    right: !startPos ? '0px' : 'auto'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSectionClick(section);
                  }}
                  title={`${section.title} (${formatTime(section.startTime)} - ${formatTime(section.endTime)})`}
                >
                  <div className={`absolute left-2 top-1 text-xs font-medium truncate max-w-[calc(100%-16px)]
                    ${isActive ? 'text-green-800' : 'text-blue-700'}`}>
                    {section.title}
                  </div>
                </div>
                
                {/* Section Resize Handles (only for active section) */}
                {isActive && startPos && (
                  <div 
                    className="absolute top-2 bottom-2 w-4 -ml-2 bg-transparent cursor-ew-resize z-40 selection-handle"
                    style={{ left: startPos }}
                    onMouseDown={(e) => handleSectionResizeStart(e, section.id, 'start')}
                    title="Drag to adjust section start"
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 mx-auto w-4 h-8 rounded-full bg-green-600 border-2 border-white flex items-center justify-center shadow-md">
                      <MoveHorizontal className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
                
                {isActive && endPos && (
                  <div 
                    className="absolute top-2 bottom-2 w-4 -ml-2 bg-transparent cursor-ew-resize z-40 selection-handle"
                    style={{ left: endPos }}
                    onMouseDown={(e) => handleSectionResizeStart(e, section.id, 'end')}
                    title="Drag to adjust section end"
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 mx-auto w-4 h-8 rounded-full bg-green-600 border-2 border-white flex items-center justify-center shadow-md">
                      <MoveHorizontal className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Time Markers (every minute or based on zoom) */}
          {Array.from({ length: Math.ceil(visibleDuration / 60) + 1 }).map((_, i) => {
            const markerTime = Math.floor(visibleStartTime / 60) * 60 + (i * 60);
            if (markerTime <= duration && isTimeVisible(markerTime) && getTimePosition(markerTime)) {
              return (
                <div 
                  key={`marker-${markerTime}`}
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-gray-400 pointer-events-none"
                  style={{ left: getTimePosition(markerTime) }}
                >
                  <span className="absolute left-0 -translate-x-1/2 top-4 text-xs text-gray-500">
                    {formatTime(markerTime)}
                  </span>
                </div>
              );
            }
            return null;
          })}

          {/* Annotations */}
          {sortedAnnotations.map(annotation => {
            if (!isTimeVisible(annotation.timestamp) || !getTimePosition(annotation.timestamp)) return null;
            
            const isInSelection = 
              selectionStart !== null && 
              selectionEnd !== null && 
              annotation.timestamp >= Math.min(selectionStart, selectionEnd) && 
              annotation.timestamp <= Math.max(selectionStart, selectionEnd);
            
            const isSnapped = snappedToTimestamp === annotation.id;
            
            // Different colors for regular vs selected timestamps
            const bgColor = isInSelection ? '#3B82F6' : '#EF4444';

            return (
              <div 
                key={annotation.id}
                className="absolute bottom-2 -translate-x-1/2 z-20"
                style={{ left: getTimePosition(annotation.timestamp) }}
              >
                {/* Timestamp marker */}
                <div 
                  className={`w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform
                    ${isSnapped ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${isInSelection ? 'bg-blue-500' : 'bg-red-500'}`}
                  style={{ backgroundColor: bgColor }}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent timeline click
                    onJumpToTimestamp(annotation.timestamp);
                  }}
                  title={`${formatTime(annotation.timestamp)} - Click to play`}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
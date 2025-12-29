"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Stamp } from "./Stamp";
import { InkPad } from "./InkPad";
import type { Habit, StampPlacement } from "./types";

interface PassportPageProps {
  date: string;
  displayDate: string;
  habits: Habit[];
  stamps: StampPlacement[];
  onAddStamp: (date: string, stamp: StampPlacement) => void;
  onRemoveStamp: (date: string, index: number) => void;
}

interface HeldStamp {
  habit: Habit;
  x: number;
  y: number;
  hasInk: boolean;
  isAnimating: boolean;
  originX: number;
  originY: number;
}

export function PassportPage({
  date,
  displayDate,
  habits,
  stamps,
  onAddStamp,
  onRemoveStamp
}: PassportPageProps) {
  const [heldStamp, setHeldStamp] = useState<HeldStamp | null>(null);
  const [isOverInkPad, setIsOverInkPad] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const inkPadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heldStamp && !heldStamp.isAnimating) {
        setHeldStamp({
          ...heldStamp,
          x: e.clientX,
          y: e.clientY,
        });
        checkInkPadHover(e.clientX, e.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (heldStamp && !heldStamp.isAnimating) {
        e.preventDefault();
        const touch = e.touches[0];
        setHeldStamp({
          ...heldStamp,
          x: touch.clientX,
          y: touch.clientY,
        });
        checkInkPadHover(touch.clientX, touch.clientY);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (heldStamp && !heldStamp.isAnimating) {
        handleStampRelease(e.clientX, e.clientY);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (heldStamp && !heldStamp.isAnimating) {
        const touch = e.changedTouches[0];
        handleStampRelease(touch.clientX, touch.clientY);
      }
    };

    if (heldStamp) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [heldStamp]);

  const checkInkPadHover = (x: number, y: number) => {
    if (!inkPadRef.current) return;

    const rect = inkPadRef.current.getBoundingClientRect();
    const isOver = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    setIsOverInkPad(isOver);
  };

  const handleStampClick = (habit: Habit, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    setHeldStamp({
      habit,
      x: clientX,
      y: clientY,
      hasInk: false,
      isAnimating: false,
      originX,
      originY,
    });
  };

  const handleStampRelease = (x: number, y: number) => {
    if (!heldStamp) return;

    // Check if over ink pad
    if (inkPadRef.current && !heldStamp.hasInk) {
      const rect = inkPadRef.current.getBoundingClientRect();
      const isOverPad = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

      if (isOverPad) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        setHeldStamp({
          ...heldStamp,
          x: centerX,
          y: centerY,
          isAnimating: true,
        });
        setIsOverInkPad(false);

        setTimeout(() => {
          setHeldStamp({
            ...heldStamp,
            x: centerX,
            y: centerY - 40,
            hasInk: true,
            isAnimating: false,
          });
        }, 400);
        return;
      }
    }

    // Check if over page with ink
    if (pageRef.current && heldStamp.hasInk) {
      const rect = pageRef.current.getBoundingClientRect();
      const isOverPage = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

      if (isOverPage) {
        setHeldStamp({
          ...heldStamp,
          isAnimating: true,
        });

        const relX = ((x - rect.left) / rect.width) * 100;
        const relY = ((y - rect.top) / rect.height) * 100;
        const rotation = Math.random() * 30 - 15;

        setTimeout(() => {
          onAddStamp(date, {
            id: crypto.randomUUID(),
            habitId: heldStamp.habit.id,
            x: relX,
            y: relY,
            rotation,
            timestamp: new Date().toISOString(),
          });

          if (heldStamp.originX && heldStamp.originY) {
            setHeldStamp({
              ...heldStamp,
              x: heldStamp.originX,
              y: heldStamp.originY,
              isAnimating: true,
            });

            setTimeout(() => {
              setHeldStamp(null);
            }, 500);
          } else {
            setHeldStamp(null);
          }
        }, 300);
        return;
      }
    }

    // Return to original position
    if (heldStamp.originX && heldStamp.originY) {
      setHeldStamp({
        ...heldStamp,
        x: heldStamp.originX,
        y: heldStamp.originY,
        isAnimating: true,
      });

      setTimeout(() => {
        setHeldStamp(null);
      }, 500);
    } else {
      setHeldStamp(null);
    }
  };

  const handleStampRemove = (index: number) => {
    onRemoveStamp(date, index);
  };

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return "Unknown time";

    const dateObj = new Date(timestamp);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");

    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      {/* Passport Page - Main Interface */}
      <div
        ref={pageRef}
        className="bg-amber-50 rounded-lg p-6 md:p-12 min-h-[500px] md:min-h-[600px] shadow-2xl border border-amber-300 relative max-w-3xl mx-auto"
        style={{
          backgroundImage: `repeating-linear-gradient(
            transparent,
            transparent 31px,
            #d4d4d8 31px,
            #d4d4d8 32px
          )`,
        }}
      >
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="text-green-900" style={{ fontFamily: "cursive" }}>{displayDate}</div>
        </div>

        {/* Placed Stamps */}
        {stamps.map((stamp, index) => {
          const habit = habits.find(h => h.id === stamp.habitId);
          if (!habit) return null;

          return (
            <div
              key={stamp.id || index}
              className="absolute group"
              style={{
                left: `${stamp.x}%`,
                top: `${stamp.y}%`,
                transform: `translate(-50%, -50%) rotate(${stamp.rotation}deg)`,
              }}
            >
              <div className="relative w-28 h-28">
                {/* Timestamp tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-green-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                    <div className="text-center">{formatTimestamp(stamp.timestamp)}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-green-900"></div>
                    </div>
                  </div>
                </div>

                {/* SVG stamp with rough edges */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                  <defs>
                    <filter id={`roughEdge-${index}`}>
                      <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.05"
                        numOctaves={5}
                        seed={index * 13 + 42}
                        result="noise"
                      />
                      <feDisplacementMap
                        in="SourceGraphic"
                        in2="noise"
                        scale={12}
                        xChannelSelector="R"
                        yChannelSelector="G"
                        result="displaced"
                      />
                    </filter>

                    <filter id={`grunge-${index}`}>
                      <feTurbulence
                        type="turbulence"
                        baseFrequency="0.8"
                        numOctaves={6}
                        seed={index * 7 + 21}
                        result="turbulence"
                      />
                      <feColorMatrix
                        in="turbulence"
                        type="saturate"
                        values="0"
                        result="grayscale"
                      />
                      <feComponentTransfer in="grayscale" result="threshold">
                        <feFuncA type="discrete" tableValues="0 0 0 0 1 1 1 1" />
                      </feComponentTransfer>
                      <feGaussianBlur in="threshold" stdDeviation="0.8" />
                    </filter>

                    <mask id={`edgeMask-${index}`}>
                      <circle
                        cx="100"
                        cy="100"
                        r="85"
                        fill="white"
                        filter={`url(#roughEdge-${index})`}
                      />
                      <circle
                        cx="100"
                        cy="100"
                        r="90"
                        fill="white"
                        filter={`url(#grunge-${index})`}
                        opacity="0.8"
                      />
                    </mask>
                  </defs>

                  <circle
                    cx="100"
                    cy="100"
                    r="95"
                    fill={habit.color}
                    mask={`url(#edgeMask-${index})`}
                    opacity="0.9"
                    style={{ mixBlendMode: "multiply" }}
                  />
                </svg>

                {/* Emoji cutout */}
                <div
                  className="absolute inset-0 flex items-center justify-center text-7xl"
                  style={{
                    color: "#fef3c7",
                    textShadow: "0 0 2px #fef3c7",
                  }}
                >
                  {habit.icon}
                </div>

                {/* Additional ink bleeding */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200">
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill={habit.color}
                    mask={`url(#edgeMask-${index})`}
                    opacity="0.25"
                    filter="blur(3px)"
                    style={{ mixBlendMode: "multiply" }}
                  />
                </svg>

                {/* Ink splatters */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at ${15 + (index * 11) % 20}% ${20 + (index * 13) % 25}%, ${habit.color} 0%, transparent 2%),
                                radial-gradient(circle at ${75 + (index * 17) % 20}% ${30 + (index * 19) % 30}%, ${habit.color} 0%, transparent 1.5%),
                                radial-gradient(circle at ${30 + (index * 23) % 25}% ${80 + (index * 7) % 15}%, ${habit.color} 0%, transparent 2.5%),
                                radial-gradient(circle at ${85 + (index * 29) % 10}% ${75 + (index * 31) % 20}%, ${habit.color} 0%, transparent 1.8%)`,
                    opacity: 0.4,
                    mixBlendMode: "multiply",
                  }}
                ></div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStampRemove(index);
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg flex items-center justify-center z-10"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {stamps.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-green-600 text-center opacity-50">
              This page is waiting for your stamps...
            </p>
          </div>
        )}
      </div>

      {/* Stamps and Ink Pad */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-end gap-6">
          {/* Available Stamps */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {habits.map((habit) => {
              const isBeingHeld = heldStamp?.habit.id === habit.id;
              return (
                <div
                  key={habit.id}
                  className={`transition-opacity ${isBeingHeld ? "opacity-30" : "opacity-100"}`}
                >
                  <Stamp
                    habit={habit}
                    hasInk={false}
                    onClick={(e) => handleStampClick(habit, e)}
                  />
                </div>
              );
            })}
          </div>

          {/* Ink Pad */}
          {habits.length > 0 && (
            <div ref={inkPadRef}>
              <InkPad isActive={isOverInkPad} />
            </div>
          )}
        </div>
      </div>

      {/* Held Stamp */}
      <AnimatePresence>
        {heldStamp && (
          <motion.div
            className="fixed pointer-events-none z-50"
            initial={false}
            animate={{
              left: heldStamp.x,
              top: heldStamp.y,
              scale: heldStamp.isAnimating ? 0.85 : 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.5,
            }}
            style={{
              x: "-50%",
              y: "-50%",
            }}
          >
            <div className="flex flex-col items-center">
              {/* Wooden handle */}
              <svg width="56" height="64" viewBox="0 0 56 64" className="drop-shadow-lg">
                <defs>
                  <linearGradient id="woodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8b7355" />
                    <stop offset="100%" stopColor="#6b5644" />
                  </linearGradient>
                </defs>

                <path
                  d="M 14 8 Q 14 20, 10 32 Q 8 42, 10 52 L 10 64 L 46 64 L 46 52 Q 48 42, 46 32 Q 42 20, 42 8 L 14 8 Z"
                  fill="url(#woodGradient)"
                />

                <pattern id="woodGrain" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
                  <rect x="0" y="0" width="4" height="2" fill="rgba(0,0,0,0.1)" />
                </pattern>
                <path
                  d="M 14 8 Q 14 20, 10 32 Q 8 42, 10 52 L 10 64 L 46 64 L 46 52 Q 48 42, 46 32 Q 42 20, 42 8 L 14 8 Z"
                  fill="url(#woodGrain)"
                  opacity="0.4"
                />

                <ellipse cx="28" cy="6" rx="20" ry="8" fill="#a0826d" />
                <ellipse cx="28" cy="8" rx="20" ry="6" fill="url(#woodGradient)" />
              </svg>

              {/* Stamp base */}
              <div
                className="w-20 h-20 rounded-sm flex items-center justify-center text-3xl shadow-2xl relative -mt-1"
                style={{
                  backgroundColor: heldStamp.hasInk ? heldStamp.habit.color : "#e8dcc8",
                  border: "2px solid rgba(0,0,0,0.1)",
                }}
              >
                <div className={`absolute inset-0 flex items-center justify-center ${heldStamp.hasInk ? "opacity-90" : "opacity-40"}`}>
                  {heldStamp.habit.icon}
                </div>

                {!heldStamp.hasInk && (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)",
                    }}
                  ></div>
                )}

                {heldStamp.hasInk && (
                  <>
                    <div className="absolute -bottom-1 left-1/4 w-1.5 h-2 rounded-b-full opacity-70"
                      style={{ backgroundColor: heldStamp.habit.color }}
                    ></div>
                    <div className="absolute -bottom-1 right-1/4 w-1 h-3 rounded-b-full opacity-60"
                      style={{ backgroundColor: heldStamp.habit.color }}
                    ></div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      {habits.length > 0 && !heldStamp && (
        <div className="text-center text-green-700 max-w-3xl mx-auto opacity-60">
          Click and hold a stamp to begin
        </div>
      )}
      {heldStamp && !heldStamp.hasInk && (
        <div className="text-center text-green-700 max-w-3xl mx-auto opacity-60">
          Drag to ink pad and release
        </div>
      )}
      {heldStamp && heldStamp.hasInk && !heldStamp.isAnimating && (
        <div className="text-center text-green-700 max-w-3xl mx-auto opacity-60">
          Drag to page and release to stamp
        </div>
      )}
    </div>
  );
}

"use client";

interface InkPadProps {
  onClick?: () => void;
  isActive: boolean;
}

export function InkPad({ onClick, isActive }: InkPadProps) {
  return (
    <button
      onClick={onClick}
      className={`w-32 h-32 rounded-lg transition-all relative overflow-hidden ${
        isActive
          ? 'ring-4 ring-green-400 shadow-2xl scale-105'
          : 'shadow-lg'
      }`}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      }}
    >
      {/* Ink pad texture */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255,255,255,0.03) 10px,
            rgba(255,255,255,0.03) 20px
          )`,
        }}
      ></div>

      {/* Shine effect */}
      <div className="absolute top-2 left-2 right-2 h-1/3 bg-gradient-to-b from-white to-transparent opacity-10 rounded-t-lg"></div>

      {/* Active pulse */}
      {isActive && (
        <div className="absolute inset-0 bg-green-400 opacity-20 animate-pulse"></div>
      )}
    </button>
  );
}

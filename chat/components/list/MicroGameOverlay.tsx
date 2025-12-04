import React, { useState, useEffect, useRef } from 'react';

interface Dot {
  id: number;
  x: number;
  y: number;
  connected: boolean;
  color: string;
}

interface MicroGameOverlayProps {
  isVisible: boolean;
  operationName: string;
  onClose: () => void;
  children?: React.ReactNode;
}

const DotConnectGame: React.FC<{ gameWidth: number; gameHeight: number }> = ({ 
  gameWidth, 
  gameHeight 
}) => {
  const [dots, setDots] = useState<Dot[]>([]);
  const [score, setScore] = useState(0);
  const [connections, setConnections] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize dots
  useEffect(() => {
    const newDots: Dot[] = [];
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
    
    for (let i = 0; i < 8; i++) {
      newDots.push({
        id: i,
        x: Math.random() * (gameWidth - 40) + 20,
        y: Math.random() * (gameHeight - 40) + 20,
        connected: false,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    setDots(newDots);
  }, [gameWidth, gameHeight]);

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, gameWidth, gameHeight);

    // Draw connections
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    for (let i = 0; i < connections.length - 1; i++) {
      const startDot = dots.find(d => d.id === connections[i]);
      const endDot = dots.find(d => d.id === connections[i + 1]);
      if (startDot && endDot) {
        ctx.beginPath();
        ctx.moveTo(startDot.x, startDot.y);
        ctx.lineTo(endDot.x, endDot.y);
        ctx.stroke();
      }
    }

    // Draw dots
    dots.forEach(dot => {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.connected ? 12 : 8, 0, 2 * Math.PI);
      ctx.fillStyle = dot.connected ? dot.color : '#E5E7EB';
      ctx.fill();
      if (dot.connected) {
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [dots, connections, gameWidth, gameHeight]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked dot
    const clickedDot = dots.find(dot => {
      const distance = Math.sqrt((x - dot.x) ** 2 + (y - dot.y) ** 2);
      return distance <= 12;
    });

    if (clickedDot && !clickedDot.connected) {
      // Connect dot
      setDots(prev => prev.map(dot => 
        dot.id === clickedDot.id ? { ...dot, connected: true } : dot
      ));
      setConnections(prev => [...prev, clickedDot.id]);
      setScore(prev => prev + 10);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Connect the Dots!</h3>
        <p className="text-sm text-gray-300">Score: {score}</p>
      </div>
      <canvas
        ref={canvasRef}
        width={gameWidth}
        height={gameHeight}
        onClick={handleCanvasClick}
        className="border border-gray-600 rounded-lg bg-gray-800 cursor-pointer"
      />
      <p className="mt-2 text-xs text-gray-400 text-center">
        Click dots to connect them while we process your request
      </p>
    </div>
  );
};

export const MicroGameOverlay: React.FC<MicroGameOverlayProps> = ({
  isVisible,
  operationName,
  onClose,
  children
}) => {
  const [gameWidth] = useState(320);
  const [gameHeight] = useState(240);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Processing {operationName}
          </h2>
          <p className="text-gray-400 text-sm">
            Your operation is running. Play a quick game while you wait!
          </p>
        </div>

        <DotConnectGame gameWidth={gameWidth} gameHeight={gameHeight} />

        {children && (
          <div className="mt-4 text-center text-sm text-gray-300">
            {children}
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Close Game
          </button>
        </div>
      </div>
    </div>
  );
};
import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Content } from './ContentRepository';

interface TranscriptViewerProps {
  content: Content; // The transcript content item
  audioUrl: string; // The audio URL from the parent audio content
}

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

interface DeepgramUtterance {
  start: number;
  end: number;
  transcript: string;
  words: DeepgramWord[];
  speaker: number;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ content, audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoveredWord, setHoveredWord] = useState<{ word: DeepgramWord; x: number; y: number } | null>(null);
  const [isTooltipMode, setIsTooltipMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipModeResetRef = useRef<NodeJS.Timeout | null>(null);

  // Extract Deepgram response from content metadata
  const deepgramResponse = content.metadata?.deepgram_response;
  const utterances: DeepgramUtterance[] = deepgramResponse?.results?.utterances || [];

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const isWordActive = (word: DeepgramWord) => {
    return currentTime >= word.start && currentTime <= word.end;
  };

  // Auto-scroll to active word
  useEffect(() => {
    if (isPlaying && utterances.length > 0) {
      const activeElement = document.querySelector('.active-word');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, isPlaying, utterances.length]);

  const getSpeakerName = (speaker: number) => {
    return `Speaker ${speaker + 1}`;
  };

  const getSpeakerColor = (speaker: number) => {
    const colors = [
      'text-blue-600',
      'text-purple-600',
      'text-pink-600',
      'text-orange-600',
      'text-green-600',
      'text-red-600'
    ];
    return colors[speaker % colors.length];
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeDetailed = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  };

  const handleWordMouseEnter = (word: DeepgramWord, event: React.MouseEvent<HTMLSpanElement>) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Clear any pending tooltip mode reset
    if (tooltipModeResetRef.current) {
      clearTimeout(tooltipModeResetRef.current);
      tooltipModeResetRef.current = null;
    }

    // Capture the position immediately while the element is guaranteed to exist
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 10;

    // If we're in tooltip mode, show immediately. Otherwise, use delay
    const delay = isTooltipMode ? 0 : 800;

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredWord({
        word,
        x,
        y
      });
      // Activate tooltip mode once a tooltip has been shown
      setIsTooltipMode(true);
    }, delay);
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredWord(null);

    // Reset tooltip mode after 1.5 seconds of not hovering over any word
    if (tooltipModeResetRef.current) {
      clearTimeout(tooltipModeResetRef.current);
    }
    tooltipModeResetRef.current = setTimeout(() => {
      setIsTooltipMode(false);
    }, 1500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Space bar to play/pause (only if not typing in input)
      if (e.code === 'Space' && utterances.length > 0 && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utterances.length, isPlaying]);

  if (!deepgramResponse || utterances.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <p>No transcript data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Transcript Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">Transcript</h2>

          <div className="space-y-6">
            {utterances.map((utterance, uttIdx) => (
              <div key={uttIdx} className="flex gap-4">
                <div className={`w-24 flex-shrink-0 text-sm font-medium ${getSpeakerColor(utterance.speaker)}`}>
                  {getSpeakerName(utterance.speaker)}
                </div>
                <div className="flex-1">
                  <p className="leading-relaxed text-gray-800">
                    {utterance.words.map((word, wordIdx) => (
                      <span
                        key={`${uttIdx}-${wordIdx}`}
                        className={`cursor-pointer hover:bg-gray-200 transition-all duration-150 px-0.5 rounded ${
                          isWordActive(word) ? 'bg-blue-400 text-white shadow-sm active-word' : ''
                        }`}
                        onClick={() => seekTo(word.start)}
                        onMouseEnter={(e) => handleWordMouseEnter(word, e)}
                        onMouseLeave={handleWordMouseLeave}
                      >
                        {word.punctuated_word || word.word}
                        {' '}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Tooltip */}
      {hoveredWord && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${hoveredWord.x}px`,
            top: `${hoveredWord.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
            <div className="flex flex-col gap-0.5">
              <div className="font-mono">
                {formatTimeDetailed(hoveredWord.word.start)} → {formatTimeDetailed(hoveredWord.word.end)}
              </div>
              <div className="text-gray-400">
                Confidence: {(hoveredWord.word.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Player */}
      <div className="border-t border-gray-200 p-5 bg-white shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex-1">
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600 transition-colors"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className="font-mono">{formatTime(currentTime)}</span>
                  <span className="font-mono">{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400 hidden sm:block">
              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs">Space</kbd>
            </div>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
};

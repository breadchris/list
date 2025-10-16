import React, { useState, useRef, useEffect } from 'react';

interface AudioDisplayProps {
  audioUrl: string;
  filename?: string;
  className?: string;
}

/**
 * Component to display audio files with HTML5 audio player
 * Features:
 * - Custom styled audio player
 * - Shows duration and current time
 * - Play/pause, volume control, seek
 * - Error handling with fallback UI
 * - Loading state
 */
export const AudioDisplay: React.FC<AudioDisplayProps> = ({
  audioUrl,
  filename,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setLoading(false);
      setError(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const vol = parseFloat(e.target.value);
    audio.volume = vol;
    setVolume(vol);
  };

  const downloadAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(audioUrl, '_blank');
  };

  if (error) {
    return (
      <div className={`rounded-lg border border-gray-200 overflow-hidden bg-gray-50 ${className}`}>
        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">Failed to load audio</p>
          <button
            onClick={downloadAudio}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Try downloading instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
        className={`rounded-lg border border-gray-200 overflow-hidden bg-white ${className}`}
        onClick={(e)=> e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="text-sm font-medium text-gray-700 truncate">
              {filename || 'Audio File'}
            </span>
          </div>
          <button
            onClick={downloadAudio}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            title="Download audio"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-pink-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex items-center space-x-3 mb-3">
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayPause}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-600 hover:bg-pink-700 text-white flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Time Display */}
              <div className="text-xs text-gray-600 font-mono flex-shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                style={{
                  background: `linear-gradient(to right, rgb(219 39 119) 0%, rgb(219 39 119) ${(currentTime / duration) * 100}%, rgb(229 231 235) ${(currentTime / duration) * 100}%, rgb(229 231 235) 100%)`
                }}
              />
            </div>

            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
              />
              <span className="text-xs text-gray-500 w-8">{Math.round(volume * 100)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

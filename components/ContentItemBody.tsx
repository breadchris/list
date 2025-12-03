import React from 'react';
import { Content, SEOMetadata, YouTubeVideoMetadata } from './ContentRepository';
import { LinkifiedText } from './LinkifiedText';
import { SEOCard } from './SEOCard';
import { JsContentDisplay } from './JsContentDisplay';
import { UrlPreviewCard } from './UrlPreviewCard';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import { YouTubeSectionCard } from './YouTubeSectionCard';
import { ImageDisplay } from './ImageDisplay';
import { AudioDisplay } from './AudioDisplay';
import { EpubViewer } from './EpubViewer';
import { TranscriptViewer } from './TranscriptViewer';
import { TsxRenderer } from './TsxRenderer';
import { PluginRenderer } from './PluginRenderer';
import { TruncatedContent } from './TruncatedContent';
import { ContentJobsIndicator } from './ContentJobsIndicator';
import { FinanceAccountView } from './FinanceAccountView';
import { QueryKeys } from '../hooks/queryKeys';

// Inline TagDisplay to avoid circular imports
const TagDisplay: React.FC<{ tags: Array<{id: string; name: string; color?: string | null}>; isVisible: boolean }> = ({ tags, isVisible }) => {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 items-center transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {tags.map(tag => (
        <span
          key={tag.id}
          className="inline-block px-2 py-0.5 text-xs rounded-full text-gray-600 bg-gray-100 border"
          style={{
            backgroundColor: tag.color ? `${tag.color}20` : undefined,
            borderColor: tag.color || undefined
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
};

// Helper function for formatting relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Helper function for formatting timestamps
const formatTimestamp = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export interface ContentItemBodyProps {
  item: Content;
  isDownvoted: boolean;
  isSelectionMode: boolean;
  jobs: any[];
  groupId: string;
  loadedTsxComponents: Set<string>;
  onLoadTsxComponent: (id: string) => void;
  onContentClick: (item: Content) => void;
  onInvalidateQueries: (queryKey: any) => void;
}

export const ContentItemBody: React.FC<ContentItemBodyProps> = ({
  item,
  isDownvoted,
  isSelectionMode,
  jobs,
  groupId,
  loadedTsxComponents,
  onLoadTsxComponent,
  onContentClick,
  onInvalidateQueries,
}) => {
  return (
    <div className={`flex-1 min-w-0 ${isSelectionMode ? 'pr-8 sm:pr-10' : ''}`}>
      {isDownvoted ? (
        <div className="text-sm text-gray-400 truncate opacity-60">
          {item.data}
        </div>
      ) : (
        <div>
          {item.type === 'seo' ? (
            <div>
              <SEOCard
                metadata={item.metadata as SEOMetadata}
                onClick={() => onContentClick(item)}
              />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'finance/account' ? (
            <div>
              <FinanceAccountView
                content={item}
                onClick={() => onContentClick(item)}
              />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
              </div>
            </div>
          ) : item.type === 'js' ? (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs font-medium text-green-600 uppercase tracking-wide">JavaScript</span>
              </div>
              <JsContentDisplay code={item.data} maxLines={8} />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'tsx' ? (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">TSX Component</span>
              </div>
              {loadedTsxComponents.has(item.id) ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  <TsxRenderer
                    tsxSource={item.data}
                    filename={item.metadata?.filename || `component-${item.id}.tsx`}
                    minHeight={100}
                    maxHeight={800}
                    fallback={
                      <div className="flex items-center gap-2 text-gray-500 p-4">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        <span>Loading component...</span>
                      </div>
                    }
                    errorFallback={(error) => (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{error.message}</p>
                      </div>
                    )}
                  />
                </div>
              ) : (
                <div
                  className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                  style={{ height: '200px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadTsxComponent(item.id);
                  }}
                >
                  <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm mb-2">
                    Load Component
                  </button>
                  <p className="text-xs text-gray-500 font-mono">
                    {item.metadata?.filename || `component-${item.id}.tsx`}
                  </p>
                </div>
              )}
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'prompt' ? (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">AI Prompt</span>
                {item.metadata?.generated_count && (
                  <span className="text-xs text-gray-500">({item.metadata.generated_count} items generated)</span>
                )}
              </div>
              <TruncatedContent maxHeight={200}>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm text-purple-800 whitespace-pre-wrap break-words">{item.data}</p>
                </div>
              </TruncatedContent>
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'image' ? (
            <div>
              <ImageDisplay imageUrl={item.data} alt="Uploaded image" />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'audio' ? (
            <div>
              <AudioDisplay audioUrl={item.data} filename={item.metadata?.filename} />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'epub' ? (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Book</span>
                {item.metadata?.filename && (
                  <span className="text-xs text-gray-500 truncate">{item.metadata.filename}</span>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
                <EpubViewer
                  epubUrl={item.data}
                  contentId={item.id}
                  groupId={groupId}
                  filename={item.metadata?.filename}
                  onChildContentCreated={() => {
                    onInvalidateQueries(QueryKeys.contentByParent(groupId, item.id));
                  }}
                />
              </div>
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'transcript' ? (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">Transcript</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <TranscriptViewer content={item} audioUrl={item.metadata?.source_audio_url || ''} />
              </div>
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'video_section' ? (
            <div>
              <YouTubeSectionCard
                contentId={item.id}
                youtubeUrl={item.metadata?.youtube_url || ''}
                startTime={item.metadata?.start_time || 0}
                endTime={item.metadata?.end_time || 0}
                title={item.data}
                metadata={item.metadata}
                onClick={() => onContentClick(item)}
              />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.type === 'timestamp' ? (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  {item.metadata?.timestamp_type === 'range' ? 'Time Range' : 'Timestamp'}
                </span>
              </div>
              <div
                className="bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const youtubeUrl = item.metadata?.youtube_url;
                  const startTime = Math.floor(item.metadata?.start_time || 0);
                  if (youtubeUrl) {
                    const urlWithTimestamp = `${youtubeUrl}${youtubeUrl.includes('?') ? '&' : '?'}t=${startTime}`;
                    window.open(urlWithTimestamp, '_blank');
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">{item.data}</h4>
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-blue-700 font-medium">
                    {formatTimestamp(item.metadata?.start_time || 0)}
                    {item.metadata?.timestamp_type === 'range' && item.metadata?.end_time &&
                      ` - ${formatTimestamp(item.metadata.end_time)}`
                    }
                  </span>
                </div>
                {item.metadata?.description && (
                  <p className="text-xs text-blue-800 mt-1">{item.metadata.description}</p>
                )}
              </div>
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.metadata?.youtube_video_id || item.metadata?.extracted_from_playlist ? (
            <div>
              <YouTubeVideoCard
                metadata={item.metadata as YouTubeVideoMetadata}
                videoUrl={(item.metadata as YouTubeVideoMetadata).youtube_url || `https://youtube.com/watch?v=${item.metadata.youtube_video_id}`}
                onClick={() => onContentClick(item)}
              />
              <TagDisplay tags={item.tags || []} isVisible={true} />
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ) : item.metadata?.role ? (
            <div>
              {item.metadata.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-700 uppercase">AI Assistant</span>
                  {item.metadata.streaming && (
                    <div className="flex items-center gap-1 ml-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  )}
                </div>
              )}
              <div className={item.metadata.role === 'assistant' ? 'bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3' : ''}>
                <LinkifiedText
                  text={item.data}
                  className={`whitespace-pre-wrap break-words text-sm sm:text-base ${item.metadata.error ? 'text-red-800' : 'text-gray-900'}`}
                  maxHeight={200}
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 && (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                )}
                <TagDisplay tags={item.tags || []} isVisible={true} />
              </div>
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
            </div>
          ) : (
            <div>
              <LinkifiedText
                text={item.data}
                className="text-gray-900 whitespace-pre-wrap break-words text-sm sm:text-base"
                maxHeight={200}
              />
              {item.metadata?.url_preview && (
                <UrlPreviewCard previewUrl={item.metadata.url_preview} />
              )}
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs text-gray-500">{formatRelativeTime(item.created_at)}</p>
                {item.child_count && item.child_count > 0 ? (
                  <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>{item.child_count}</span>
                  </div>
                ) : null}
                <TagDisplay tags={item.tags || []} isVisible={true} />
              </div>
              <ContentJobsIndicator jobs={jobs} className="mt-2" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Content, contentRepository } from '@/lib/list/ContentRepository';
import { SEOCard } from './SEOCard';
import { LinkifiedText } from './LinkifiedText';
import { UserAuth } from './UserAuth';
import { ContentListSkeleton } from './SkeletonComponents';
import { usePublicContentChildren } from '@/hooks/list/useContentQueries';

export const PublicContentView: React.FC = () => {
  const { contentId } = useParams<{ contentId: string }>();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // Fetch children of current content
  const {
    data: children = [],
    isLoading: childrenLoading
  } = usePublicContentChildren(contentId || null, { enabled: !!contentId && !!content });

  useEffect(() => {
    if (contentId) {
      loadPublicContent(contentId);
    } else {
      setError('Invalid public content URL');
      setIsLoading(false);
    }
  }, [contentId]);

  const loadPublicContent = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const publicContent = await contentRepository.getPublicContent(id);
      
      if (!publicContent) {
        setError('Content not found or not publicly accessible');
      } else {
        setContent(publicContent);
      }
    } catch (err) {
      console.error('Failed to load public content:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Simple Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-gray-900">Public Content</h1>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-sm pt-20">
          <ContentListSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Simple Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-gray-900">Public Content</h1>
              </div>
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-center h-96 pt-20">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Content Not Available</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => setShowAuth(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In to Access More Content
            </button>
          </div>
        </div>

        {/* Auth Modal */}
        {showAuth && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-1 max-w-md w-full mx-4">
              <UserAuth 
                onAuthSuccess={() => {
                  setShowAuth(false);
                  // Navigate to main app using React Router
                  router.push('/');
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-gray-900">Public Content</h1>
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Shared publicly</span>
              </div>
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="max-w-4xl mx-auto p-4 pt-24">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            {/* Content Display */}
            {content.type === 'seo' && content.metadata ? (
              <div className="space-y-4">
                <SEOCard 
                  metadata={content.metadata}
                  className="border-0 shadow-none p-0"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <LinkifiedText
                  text={content.data}
                  className="text-gray-900 whitespace-pre-wrap break-words text-lg leading-relaxed"
                />
              </div>
            )}

            {/* Metadata */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Shared {formatRelativeTime(content.created_at)}</span>
                  <span className="capitalize">{content.type} content</span>
                </div>
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  <span>Read-only</span>
                </div>
              </div>
            </div>

            {/* Children Content List */}
            {children.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Items in this list ({children.length})
                </h3>
                <div className="space-y-2">
                  {children.map((child) => (
                    <div
                      key={child.id}
                      onClick={() => router.push(`/public/content/${child.id}`)}
                      className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-200"
                    >
                      {child.type === 'seo' && child.metadata ? (
                        <SEOCard
                          metadata={child.metadata}
                          className="border-0 shadow-none p-0 bg-transparent"
                        />
                      ) : (
                        <LinkifiedText
                          text={child.data}
                          className="text-gray-900 text-sm line-clamp-2"
                        />
                      )}
                      <div className="mt-1 text-xs text-gray-500">
                        {formatRelativeTime(child.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call to Action */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">
                    Want to create your own lists?
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Sign up to create, organize, and share your own content with others.
                  </p>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-1 max-w-md w-full mx-4">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <UserAuth 
              onAuthSuccess={() => {
                setShowAuth(false);
                // Navigate to main app using React Router
                router.push('/');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
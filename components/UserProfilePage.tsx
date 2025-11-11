import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from './SupabaseClient';
import { User, Group, contentRepository } from './ContentRepository';
import { SEOCard } from './SEOCard';
import { LinkifiedText } from './LinkifiedText';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import { UrlPreviewCard } from './UrlPreviewCard';
import { ImageDisplay } from './ImageDisplay';
import { ContentListSkeleton } from './SkeletonComponents';
import { useUserPublicContent } from '../hooks/useContentQueries';
import { ArrowLeft, User as UserIcon } from 'lucide-react';

export const UserProfilePage: React.FC = () => {
  const { userId, groupId } = useParams<{ userId: string; groupId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's public content using the hook
  const {
    data: publicContent = [],
    isLoading: contentLoading,
  } = useUserPublicContent(userId || '', groupId || '', { enabled: !!userId && !!groupId });

  // Fetch user data
  useEffect(() => {
    if (userId) {
      loadUser(userId);
    } else {
      setError('Invalid user ID');
      setIsLoadingUser(false);
    }
  }, [userId]);

  // Fetch group data
  useEffect(() => {
    if (groupId) {
      loadGroup(groupId);
    } else {
      setError('Invalid group ID');
      setIsLoadingGroup(false);
    }
  }, [groupId]);

  const loadUser = async (id: string) => {
    setIsLoadingUser(true);
    setError(null);

    try {
      const { data, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (userError || !data) {
        setError('User not found');
      } else {
        setUser(data as User);
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      setError('Failed to load user');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const loadGroup = async (id: string) => {
    setIsLoadingGroup(true);
    setError(null);

    try {
      const { data, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (groupError || !data) {
        setError('Group not found');
      } else {
        setGroup(data as Group);
      }
    } catch (err) {
      console.error('Failed to load group:', err);
      setError('Failed to load group');
    } finally {
      setIsLoadingGroup(false);
    }
  };

  const getUserDisplayName = (): string => {
    if (user?.username) {
      return user.username;
    }
    // Fallback to shortened UUID if no username
    return `User ${userId?.substring(0, 8)}`;
  };

  const isLoading = isLoadingUser || isLoadingGroup || contentLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-semibold text-gray-900">User Profile</h1>
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

  if (error || !user || !group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="text-center p-8">
            <p className="text-gray-500 text-lg">{error || 'Profile not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <div className="text-sm text-gray-500">
              {group.name}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-sm pt-20">
        {/* Profile Header */}
        <div className="px-6 py-8 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            {/* User Avatar/Icon */}
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-blue-600" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getUserDisplayName()}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Showcasing public content from {group.name}
              </p>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 px-6 py-6">
          {publicContent.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No public content yet</p>
              <p className="text-gray-400 text-sm mt-2">
                This user hasn't shared anything publicly in this group.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {publicContent.map((item) => (
                <Link
                  key={item.id}
                  to={`/public/content/${item.id}`}
                  className="block group"
                >
                  <div className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-md transition-all">
                    {/* SEO Card for URLs with metadata */}
                    {item.metadata?.seo && (
                      <SEOCard metadata={item.metadata.seo} className="mb-4" />
                    )}

                    {/* URL Preview */}
                    {item.metadata?.url_preview && !item.metadata?.seo && (
                      <UrlPreviewCard
                        previewUrl={item.metadata.url_preview}
                        className="mb-4"
                      />
                    )}

                    {/* YouTube Video Card */}
                    {item.metadata?.youtube_video_id && (
                      <YouTubeVideoCard
                        metadata={item.metadata as any}
                        videoUrl={item.data}
                        className="mb-4"
                      />
                    )}

                    {/* Image Display */}
                    {item.type === 'image' && item.metadata?.url && (
                      <ImageDisplay
                        url={item.metadata.url}
                        width={item.metadata.width}
                        height={item.metadata.height}
                        className="mb-4"
                      />
                    )}

                    {/* Text Content */}
                    {item.type === 'text' && (
                      <div className="prose max-w-none">
                        <LinkifiedText text={item.data} />
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="mt-4 text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

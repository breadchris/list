import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getFastSession } from './SupabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { UserAuth } from './UserAuth';
import { GroupSelector } from './GroupSelector';
import { ContentList } from './ContentList';
import { ContentStack } from './ContentStack';
import { ContentMasonry } from './ContentMasonry';
import { ContentDeck } from './ContentDeck';
import { ContentInput } from './ContentInput';
import { JsEditorView } from './JsEditorView';
import { SavedTagFilterButton } from './SavedTagFilterButton';
import { MicroGameOverlay } from './MicroGameOverlay';
import { SEOProgressOverlay, SEOProgressItem } from './SEOProgressOverlay';
import { MarkdownProgressOverlay } from './MarkdownProgressOverlay';
import { YouTubeProgressOverlay } from './YouTubeProgressOverlay';
import { YouTubeVideoAnnotatorPage } from './YouTubeVideoAnnotatorPage';
import { TMDbSearchModal } from './TMDbSearchModal';
import { SharingSettingsModal } from './SharingSettingsModal';
import { LibgenSearchModal, LibgenSearchConfig } from './LibgenSearchModal';
import { SpotifyImportSelector } from './SpotifyImportSelector';
import { SpotifyPlaylistModal } from './SpotifyPlaylistModal';
import { GroupDropdown } from './GroupDropdown';
import { TagFilterSelector } from './TagFilterSelector';
import SendToGroupModal from './SendToGroupModal';
import { AppSkeleton, HeaderSkeleton, ContentListSkeleton } from './SkeletonComponents';
import { Footer } from './Footer';
import { LLMPromptModal } from './LLMPromptModal';
import { ClaudeCodePromptModal } from './ClaudeCodePromptModal';
import { ClaudeCodeService } from './ClaudeCodeService';
import { Group, Content, Tag, TagFilter, contentRepository } from './ContentRepository';
import { useGroupsQuery, useCreateGroupMutation, useJoinGroupMutation } from '../hooks/useGroupQueries';
import { useBulkDeleteContentMutation } from '../hooks/useContentQueries';
import { useContentSelection } from '../hooks/useContentSelection';
import { useSEOExtraction } from '../hooks/useSEOExtraction';
import { useMarkdownExtraction, MarkdownProgressItem } from '../hooks/useMarkdownExtraction';
import { useYouTubePlaylistExtraction, YouTubeProgressItem } from '../hooks/useYouTubePlaylistExtraction';
import { useLibgenSearch } from '../hooks/useLibgenSearch';
import { useAudioTranscription } from '../hooks/useAudioTranscription';
import { useYouTubeTranscript } from '../hooks/useYouTubeTranscript';
import { useTagsForGroup } from '../hooks/useTagQueries';
import { useToast } from './ToastProvider';
import { extractUrls, getFirstUrl } from '../utils/urlDetection';
import { getYouTubeVideoFromContent } from '../utils/youtubeHelpers';
import { Clock, SkipBack, ArrowDownAZ, Shuffle } from 'lucide-react';
import { ViewDisplaySelector, DisplayMode } from './ViewDisplaySelector';

// Simplified app loading states to prevent rapid transitions
type AppLoadingState = 'loading' | 'ready' | 'error';

// View mode for content ordering
export type ViewMode = 'chronological' | 'random' | 'alphabetical' | 'oldest';

export const ListApp: React.FC = () => {
  // React Router hooks
  const params = useParams<{ groupId?: string; contentId?: string; joinCode?: string }>();
  const navigate = useNavigate();
  // Simplified app state to prevent rapid transitions
  const [appState, setAppState] = useState<AppLoadingState>('loading');
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent concurrent initializations
  const isInitializingRef = useRef(false);
  // Prevent concurrent join attempts
  const isJoiningGroupRef = useRef(false);

  // Standard React state management - no defensive programming needed
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [newContent, setNewContent] = useState<Content | undefined>();
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [currentJsContent, setCurrentJsContent] = useState<Content | null>(null);
  const [navigationStack, setNavigationStack] = useState<Array<{id: string | null, name: string}>>([{id: null, name: 'Root'}]);
  const [showInput, setShowInput] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'join'>('create');
  const [activeExternalSearch, setActiveExternalSearch] = useState<string | null>(null);

  // React Query hooks - only enable when we have user and app is ready for data loading
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useGroupsQuery({ 
    enabled: !!user && (appState === 'loading-data' || appState === 'ready')
  });
  const createGroupMutation = useCreateGroupMutation();
  const joinGroupMutation = useJoinGroupMutation();
  const bulkDeleteMutation = useBulkDeleteContentMutation();

  // Store joinGroupMutation in a ref to avoid dependency issues
  const joinGroupMutationRef = useRef(joinGroupMutation);
  useEffect(() => {
    joinGroupMutationRef.current = joinGroupMutation;
  }, [joinGroupMutation]);
  const seoExtractionMutation = useSEOExtraction();
  const markdownExtractionMutation = useMarkdownExtraction();
  const youTubeExtractionMutation = useYouTubePlaylistExtraction();
  const libgenSearchMutation = useLibgenSearch();
  const audioTranscriptionMutation = useAudioTranscription();
  const youtubeTranscriptMutation = useYouTubeTranscript();

  // Load tags for current group
  const { data: availableTags = [] } = useTagsForGroup(currentGroup?.id || '');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('chronological');

  // Tag filter state - supports multiple tags with include/exclude mode
  const [selectedTagFilter, setSelectedTagFilter] = useState<TagFilter[]>([]);
  const [isTagFilterExpanded, setIsTagFilterExpanded] = useState(false);
  const tagFilterExpandTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagFilterCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tag filter helper functions
  const addTagToFilter = (tag: Tag, mode: 'include' | 'exclude' = 'include') => {
    setSelectedTagFilter(prev => {
      // Don't add if already exists (same tag, regardless of mode)
      if (prev.some(tf => tf.tag.id === tag.id)) return prev;
      return [...prev, { tag, mode }];
    });
  };

  const removeTagFromFilter = (tagId: string) => {
    setSelectedTagFilter(prev => prev.filter(tf => tf.tag.id !== tagId));
  };

  const toggleTagFilterMode = (tagId: string) => {
    setSelectedTagFilter(prev =>
      prev.map(tf =>
        tf.tag.id === tagId
          ? { ...tf, mode: tf.mode === 'include' ? 'exclude' : 'include' }
          : tf
      )
    );
  };

  const clearTagFilter = () => {
    setSelectedTagFilter([]);
  };

  // Tag filter hover handlers for expand/collapse
  const handleTagFilterMouseEnter = () => {
    // Clear any pending collapse timer
    if (tagFilterCollapseTimerRef.current) {
      clearTimeout(tagFilterCollapseTimerRef.current);
      tagFilterCollapseTimerRef.current = null;
    }

    // Set expand timer (300ms delay)
    tagFilterExpandTimerRef.current = setTimeout(() => {
      setIsTagFilterExpanded(true);
    }, 300);
  };

  const handleTagFilterMouseLeave = () => {
    // Clear any pending expand timer
    if (tagFilterExpandTimerRef.current) {
      clearTimeout(tagFilterExpandTimerRef.current);
      tagFilterExpandTimerRef.current = null;
    }

    // Set collapse timer (200ms delay)
    tagFilterCollapseTimerRef.current = setTimeout(() => {
      setIsTagFilterExpanded(false);
    }, 200);
  };

  // Display mode state (list vs stack)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');

  // Content selection state for workflow operations
  const contentSelection = useContentSelection();

  // Toast notifications
  const toast = useToast();
  
  // Micro-game overlay state
  const [showGameOverlay, setShowGameOverlay] = useState(false);
  const [currentOperation, setCurrentOperation] = useState('');
  
  // SEO Progress tracking
  const [showSEOProgress, setShowSEOProgress] = useState(false);
  const [seoProgressItems, setSeoProgressItems] = useState<SEOProgressItem[]>([]);
  const [selectedContentForSEO, setSelectedContentForSEO] = useState<Content[]>([]);

  // Markdown Progress tracking
  const [showMarkdownProgress, setShowMarkdownProgress] = useState(false);
  const [markdownProgressItems, setMarkdownProgressItems] = useState<MarkdownProgressItem[]>([]);
  const [selectedContentForMarkdown, setSelectedContentForMarkdown] = useState<Content[]>([]);

  // YouTube Playlist Progress tracking
  const [showYouTubeProgress, setShowYouTubeProgress] = useState(false);
  const [youTubeProgressItems, setYouTubeProgressItems] = useState<YouTubeProgressItem[]>([]);
  const [selectedContentForYouTube, setSelectedContentForYouTube] = useState<Content[]>([]);

  // TMDb Search modal state
  const [showTMDbModal, setShowTMDbModal] = useState(false);
  const [selectedContentForTMDb, setSelectedContentForTMDb] = useState<Content | null>(null);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState<string | undefined>(undefined);

  // Libgen Search modal state
  const [showLibgenModal, setShowLibgenModal] = useState(false);
  const [selectedContentForLibgen, setSelectedContentForLibgen] = useState<Content[]>([]);
  const [libgenSearchResults, setLibgenSearchResults] = useState<any[]>([]);
  const [isLibgenSearching, setIsLibgenSearching] = useState(false);

  // Sharing settings modal state
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [currentContentForSharing, setCurrentContentForSharing] = useState<Content | null>(null);

  // LLM Prompt modal state
  const [showLLMPromptModal, setShowLLMPromptModal] = useState(false);
  const [selectedContentForLLM, setSelectedContentForLLM] = useState<Content[]>([]);

  // Claude Code Prompt modal state
  const [showClaudeCodeModal, setShowClaudeCodeModal] = useState(false);
  const [selectedContentForClaudeCode, setSelectedContentForClaudeCode] = useState<Content[]>([]);

  // YouTube Video Annotator modal state
  const [showYouTubeAnnotator, setShowYouTubeAnnotator] = useState(false);
  const [selectedVideoForAnnotation, setSelectedVideoForAnnotation] = useState<Content | null>(null);

  // Send to Group modal state
  const [showSendToGroupModal, setShowSendToGroupModal] = useState(false);
  const [isSendingToGroup, setIsSendingToGroup] = useState(false);

  // Spotify Import modal state
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);

  // Track signup completion to prevent false toast notifications
  const hasShownWelcomeRef = useRef(false);
  const isFirstAuthRef = useRef(true);
  
  // Workflow action handlers
  const handleSEOExtraction = async () => {
    console.log('🔍 SEO Extraction button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });
    
    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);
    
    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Get the full content objects for the selected IDs by fetching them individually
      console.log('Fetching content objects for IDs:', selectedIds);
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            const content = await contentRepository.getContentById(id);
            if (!content) {
              console.warn(`Content with ID ${id} not found`);
              return null;
            }
            return content;
          } catch (error) {
            console.warn(`Could not load content ${id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and continue with valid content
      const validContent = selectedContent.filter((content): content is Content => content !== null);
      
      if (validContent.length === 0) {
        toast.error('No content found', 'Unable to find selected items in database.');
        return;
      }

      if (validContent.length < selectedIds.length) {
        toast.warning(
          'Some items not found',
          `Proceeding with ${validContent.length} of ${selectedIds.length} selected items.`
        );
      }
      // Initialize progress tracking
      const initialProgressItems: SEOProgressItem[] = validContent.map(content => ({
        contentId: content.id,
        content,
        status: 'pending' as const,
        urlsFound: 0,
        urlsProcessed: 0,
        seoChildren: []
      }));
      
      setSeoProgressItems(initialProgressItems);
      setSelectedContentForSEO(validContent);
      setShowSEOProgress(true);

      console.log('Starting SEO extraction for:', validContent.map(c => c.id));
      
      // Create progress callback
      const handleProgress = (updatedItem: SEOProgressItem) => {
        console.log('Progress update:', updatedItem);
        setSeoProgressItems(prev => 
          prev.map(item => 
            item.contentId === updatedItem.contentId ? updatedItem : item
          )
        );
      };

      // Trigger the SEO extraction with progress tracking
      const results = await seoExtractionMutation.mutateAsync({
        selectedContent: validContent,
        onProgress: handleProgress
      });
      
      // Show results summary
      const totalUrls = results.reduce((sum, r) => sum + r.total_urls_found, 0);
      const processedUrls = results.reduce((sum, r) => sum + r.urls_processed, 0);
      const failedCount = results.filter(r => r.errors && r.errors.length > 0).length;
      
      if (failedCount === 0) {
        toast.success(
          'SEO extraction completed!', 
          `Processed ${processedUrls}/${totalUrls} URLs from ${validContent.length} items.`
        );
      } else {
        toast.warning(
          'SEO extraction completed with errors',
          `Processed ${processedUrls}/${totalUrls} URLs. ${failedCount} items failed.`
        );
      }
      
      // Clear selection after successful operation
      contentSelection.clearSelection();
    } catch (error) {
      console.error('SEO extraction failed:', error);
      toast.error('SEO extraction failed', 'Please try again.');
      // Update all items to failed status
      setSeoProgressItems(prev => 
        prev.map(item => ({ 
          ...item, 
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error)
        }))
      );
    }
  };
  
  const handleLLMGeneration = async () => {
    console.log('🤖 LLM Generation button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Get the full content objects for the selected IDs
      console.log('Fetching content objects for IDs:', selectedIds);
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          const content = await contentRepository.getContentById(id);
          if (!content) {
            throw new Error(`Content with ID ${id} not found`);
          }
          return content;
        })
      );

      console.log('Fetched content objects:', selectedContent);

      // Set selected content and show modal
      setSelectedContentForLLM(selectedContent);
      setShowLLMPromptModal(true);

    } catch (error) {
      console.error('Error fetching selected content:', error);
      toast.error('Error', 'Failed to load selected content');
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Array.from(contentSelection.selectedItems);

    if (selectedIds.length === 0) {
      return;
    }

    // Show confirmation dialog
    const itemText = selectedIds.length === 1 ? 'item' : 'items';
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} selected ${itemText}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Perform bulk delete
      await bulkDeleteMutation.mutateAsync({
        contentIds: selectedIds,
        groupId: currentGroup.id
      });

      // Clear selection after successful deletion
      contentSelection.clearSelection();

      // Show success message
      toast.success(
        'Items deleted',
        `Successfully deleted ${selectedIds.length} ${itemText}`
      );

    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error(
        'Delete failed',
        error instanceof Error ? error.message : 'Failed to delete items'
      );
    }
  };

  const handleSendToGroup = async (targetGroupId: string) => {
    const selectedIds = Array.from(contentSelection.selectedItems);

    if (selectedIds.length === 0) {
      return;
    }

    if (!currentGroup) {
      toast.error('Error', 'No current group selected');
      return;
    }

    try {
      setIsSendingToGroup(true);

      // Copy content to target group
      const copiedContent = await contentRepository.copyContentToGroup(
        selectedIds,
        targetGroupId,
        true // Copy tags
      );

      // Close modal
      setShowSendToGroupModal(false);

      // Clear selection
      contentSelection.clearSelection();

      // Show success message
      const itemText = copiedContent.length === 1 ? 'item' : 'items';
      toast.success(
        'Sent to group',
        `Successfully copied ${copiedContent.length} ${itemText}`
      );

    } catch (error) {
      console.error('Send to group failed:', error);
      toast.error(
        'Send failed',
        error instanceof Error ? error.message : 'Failed to send items to group'
      );
    } finally {
      setIsSendingToGroup(false);
    }
  };

  const handleCloseSEOProgress = () => {
    setShowSEOProgress(false);
    setSeoProgressItems([]);
    setSelectedContentForSEO([]);
  };

  const handleMarkdownExtraction = async () => {
    console.log('📝 Markdown Extraction button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Get the full content objects for the selected IDs
      console.log('Fetching content objects for IDs:', selectedIds);
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            const content = await contentRepository.getContentById(id);
            if (!content) {
              console.warn(`Content with ID ${id} not found`);
              return null;
            }
            return content;
          } catch (error) {
            console.warn(`Could not load content ${id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and continue with valid content
      const validContent = selectedContent.filter((content): content is Content => content !== null);

      if (validContent.length === 0) {
        toast.error('No content found', 'Unable to find selected items in database.');
        return;
      }

      if (validContent.length < selectedIds.length) {
        toast.warning(
          'Some items not found',
          `Proceeding with ${validContent.length} of ${selectedIds.length} selected items.`
        );
      }

      // Initialize progress tracking
      const initialProgressItems: MarkdownProgressItem[] = validContent.map(content => ({
        contentId: content.id,
        content,
        status: 'pending' as const,
        urlsFound: 0,
        urlsProcessed: 0,
        markdownChildren: []
      }));

      setMarkdownProgressItems(initialProgressItems);
      setSelectedContentForMarkdown(validContent);
      setShowMarkdownProgress(true);

      console.log('Starting markdown extraction for:', validContent.map(c => c.id));

      // Create progress callback
      const handleProgress = (updatedItem: MarkdownProgressItem) => {
        console.log('Progress update:', updatedItem);
        setMarkdownProgressItems(prev =>
          prev.map(item =>
            item.contentId === updatedItem.contentId ? updatedItem : item
          )
        );
      };

      // Trigger the markdown extraction with progress tracking
      const results = await markdownExtractionMutation.mutateAsync({
        selectedContent: validContent,
        onProgress: handleProgress
      });

      // Show results summary
      const totalUrls = results.reduce((sum, r) => sum + r.total_urls_found, 0);
      const processedUrls = results.reduce((sum, r) => sum + r.urls_processed, 0);
      const failedCount = results.filter(r => r.errors && r.errors.length > 0).length;

      if (failedCount === 0) {
        toast.success(
          'Markdown extraction completed!',
          `Converted ${processedUrls}/${totalUrls} URLs from ${validContent.length} items.`
        );
      } else {
        toast.warning(
          'Markdown extraction completed with errors',
          `Converted ${processedUrls}/${totalUrls} URLs. ${failedCount} items failed.`
        );
      }

      // Clear selection after successful operation
      contentSelection.clearSelection();
    } catch (error) {
      console.error('Markdown extraction failed:', error);
      toast.error('Markdown extraction failed', 'Please try again.');
      // Update all items to failed status
      setMarkdownProgressItems(prev =>
        prev.map(item => ({
          ...item,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error)
        }))
      );
    }
  };

  const handleCloseMarkdownProgress = () => {
    setShowMarkdownProgress(false);
    setMarkdownProgressItems([]);
    setSelectedContentForMarkdown([]);
  };

  const handleYouTubePlaylistExtraction = async () => {
    console.log('🎬 YouTube Playlist Extraction button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Get the full content objects for the selected IDs
      console.log('Fetching content objects for IDs:', selectedIds);
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            const content = await contentRepository.getContentById(id);
            if (!content) {
              console.warn(`Content with ID ${id} not found`);
              return null;
            }
            return content;
          } catch (error) {
            console.warn(`Could not load content ${id}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and continue with valid content
      const validContent = selectedContent.filter((content): content is Content => content !== null);

      if (validContent.length === 0) {
        toast.error('No content found', 'Unable to find selected items in database.');
        return;
      }

      if (validContent.length < selectedIds.length) {
        toast.warning(
          'Some items not found',
          `Proceeding with ${validContent.length} of ${selectedIds.length} selected items.`
        );
      }

      // Initialize progress tracking
      const initialProgressItems: YouTubeProgressItem[] = validContent.map(content => ({
        contentId: content.id,
        content,
        status: 'processing' as const,
        playlistsFound: 0,
        videosCreated: 0
      }));

      setYouTubeProgressItems(initialProgressItems);
      setSelectedContentForYouTube(validContent);
      setShowYouTubeProgress(true);

      console.log('Starting YouTube playlist extraction for:', validContent.map(c => c.id));

      // Create progress callback
      const handleProgress = (updatedItem: YouTubeProgressItem) => {
        console.log('Progress update:', updatedItem);
        setYouTubeProgressItems(prev =>
          prev.map(item =>
            item.contentId === updatedItem.contentId ? updatedItem : item
          )
        );
      };

      // Trigger the YouTube playlist extraction with progress tracking
      const results = await youTubeExtractionMutation.mutateAsync({
        selectedContent: validContent,
        onProgress: handleProgress
      });

      // Show results summary
      const totalPlaylists = results.reduce((sum, r) => sum + r.playlists_found, 0);
      const totalVideos = results.reduce((sum, r) => sum + r.videos_created, 0);
      const failedCount = results.filter(r => !r.success).length;

      if (failedCount === 0) {
        toast.success(
          'Playlist extraction completed!',
          `Extracted ${totalVideos} videos from ${totalPlaylists} playlist${totalPlaylists !== 1 ? 's' : ''}.`
        );
      } else {
        toast.warning(
          'Playlist extraction completed with errors',
          `Extracted ${totalVideos} videos. ${failedCount} items failed.`
        );
      }

      // Clear selection after successful operation
      contentSelection.clearSelection();
    } catch (error) {
      console.error('YouTube playlist extraction failed:', error);
      toast.error('Playlist extraction failed', 'Please try again.');
      // Update all items to failed status
      setYouTubeProgressItems(prev =>
        prev.map(item => ({
          ...item,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error)
        }))
      );
    }
  };

  const handleCloseYouTubeProgress = () => {
    setShowYouTubeProgress(false);
    setYouTubeProgressItems([]);
    setSelectedContentForYouTube([]);
  };

  const handleTMDbSearch = async () => {
    console.log('🎬 TMDb Search button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    if (selectedIds.length > 1) {
      toast.warning('Multiple items selected', 'Please select only one content item to search TMDb');
      return;
    }

    try {
      // Get the content object for the selected ID
      const contentId = selectedIds[0];
      const content = await contentRepository.getContentById(contentId);

      if (!content) {
        toast.error('Content not found', 'Unable to find selected item in database');
        return;
      }

      // Open TMDb search modal
      setSelectedContentForTMDb(content);
      setShowTMDbModal(true);

      console.log('Opening TMDb search modal for content:', content.id);

    } catch (error) {
      console.error('Error during TMDb search:', error);
      toast.error(
        'TMDb search failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      // Clear selection after processing
      contentSelection.clearSelection();
    }
  };

  const handleCloseTMDbModal = () => {
    setShowTMDbModal(false);
    setSelectedContentForTMDb(null);
    setTmdbSearchQuery(undefined);
  };

  const handleTMDbResultsAdded = () => {
    // Refresh content list after adding TMDb results
    contentSelection.clearSelection();
    setNewContent(undefined);
  };

  // Libgen Search handlers
  const handleLibgenSearch = async () => {
    console.log('📚 Libgen Search button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Get the content objects for the selected IDs
      const selectedContent = await Promise.all(
        selectedIds.map(id => contentRepository.getContentById(id))
      );

      const validContent = selectedContent.filter((c): c is Content => c !== null);

      if (validContent.length === 0) {
        toast.error('Content not found', 'Unable to find selected items in database');
        return;
      }

      // Open Libgen search modal
      setSelectedContentForLibgen(validContent);
      setShowLibgenModal(true);

      console.log('Opening Libgen search modal for content:', validContent.map(c => c.id));

    } catch (error) {
      console.error('Error during Libgen search:', error);
      toast.error(
        'Libgen search failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleCloseLibgenModal = () => {
    setShowLibgenModal(false);
    setSelectedContentForLibgen([]);
    setLibgenSearchResults([]);
    setIsLibgenSearching(false);
  };

  const handleAddSelectedLibgenBooks = async (books: Content[]) => {
    console.log('Adding selected Libgen books:', books);

    try {
      // Create Content items for each selected book
      // The books have temporary IDs (temp-{md5}), so we need to create new items
      const createdBooks = [];

      for (const book of books) {
        // Extract the data and metadata from the mock Content object
        const { data, metadata, group_id, user_id, parent_content_id } = book;

        // Create the Content item
        const createdBook = await contentRepository.createContent({
          type: 'text',
          data,
          metadata,
          group_id,
          user_id,
          parent_content_id
        });

        createdBooks.push(createdBook);
      }

      console.log(`Successfully created ${createdBooks.length} book content items`);

      // Refresh the content list to show the new books
      // The query invalidation in useLibgenSearch.onSuccess will handle this
      return;
    } catch (error) {
      console.error('Failed to add selected books:', error);
      throw error; // Re-throw to let the modal handle the error
    }
  };

  const handleLibgenSearchExecute = async (config: LibgenSearchConfig) => {
    console.log('Executing Libgen search with config:', config);

    try {
      setIsLibgenSearching(true);
      const results = await libgenSearchMutation.mutateAsync({
        selectedContent: selectedContentForLibgen,
        config: {
          ...config,
          autoCreate: false // Don't auto-create books - let user select which ones to add
        }
      });

      // Store results to display in modal
      setLibgenSearchResults(results);
      setIsLibgenSearching(false);

      const totalBooksFound = results.reduce((sum, r) => sum + r.books_found, 0);

      toast.success(
        'Books Found!',
        `Found ${totalBooksFound} book${totalBooksFound !== 1 ? 's' : ''}. Select which ones to add.`
      );

      // Clear selection but keep modal open for user to see results
      contentSelection.clearSelection();
    } catch (error) {
      console.error('Libgen search mutation failed:', error);
      setIsLibgenSearching(false);
      toast.error(
        'Search Failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  // Query-based external search handlers (from SearchWorkflowSelector)
  const handleTMDbSearchWithQuery = async (query: string) => {
    if (!query.trim() || !currentGroup) return;

    console.log('🎬 TMDb Search with query:', query);

    // Create minimal content object for modal (only used for context, not database lookup)
    const tempContent: Content = {
      id: 'temp-tmdb-search',
      data: query,
      type: 'text',
      group_id: currentGroup.id,
      user_id: user?.id || '',
      parent_content_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      has_children: false,
      is_public: false
    };

    // Open TMDb modal with query passed directly
    setSelectedContentForTMDb(tempContent);
    setTmdbSearchQuery(query);
    setShowTMDbModal(true);
    setActiveExternalSearch(null); // Reset active search
  };

  const handleLibgenSearchWithQuery = async (query: string) => {
    if (!query.trim() || !currentGroup) return;

    console.log('📚 Libgen Search with query:', query);

    // Create temporary content object with the search query
    const tempContent: Content = {
      id: 'temp-search',
      data: query,
      type: 'text',
      group_id: currentGroup.id,
      user_id: user?.id || '',
      parent_content_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      has_children: false,
      is_public: false
    };

    // Open Libgen modal with the temporary content
    setSelectedContentForLibgen([tempContent]);
    setShowLibgenModal(true);
    setActiveExternalSearch(null); // Reset active search
  };

  const handleExecuteExternalSearch = () => {
    if (!activeExternalSearch || !searchQuery.trim()) return;

    if (activeExternalSearch === 'tmdb-search') {
      handleTMDbSearchWithQuery(searchQuery);
    } else if (activeExternalSearch === 'libgen-search') {
      handleLibgenSearchWithQuery(searchQuery);
    }
  };

  const handleOpenSharingModal = async () => {
    if (!currentParentId) return;
    
    try {
      // Get the current content item to share
      const content = await contentRepository.getContentById(currentParentId);
      if (content) {
        setCurrentContentForSharing(content);
        setShowSharingModal(true);
      }
    } catch (error) {
      console.error('Failed to load content for sharing:', error);
      toast.error('Failed to load content', 'Please try again.');
    }
  };

  const handleCloseSharingModal = () => {
    setShowSharingModal(false);
    setCurrentContentForSharing(null);
  };

  const handleCloseLLMPromptModal = () => {
    setShowLLMPromptModal(false);
    setSelectedContentForLLM([]);
  };

  const handleLLMContentGenerated = () => {
    // Exit selection mode and refresh content list
    contentSelection.clearSelection();
    setNewContent(undefined);
  };

  const handleClaudeCodeExecution = async () => {
    console.log('💻 Claude Code button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Get the full content objects for the selected IDs
      console.log('Fetching content objects for IDs:', selectedIds);
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          const content = await contentRepository.getContentById(id);
          if (!content) {
            throw new Error(`Content with ID ${id} not found`);
          }
          return content;
        })
      );

      console.log('Fetched content objects:', selectedContent);

      // Generate default prompt based on content
      const defaultPrompt = 'Create an interactive TSX component based on the selected content. Make it visually appealing and functional.';

      toast.info('Claude Code Starting', 'Generating component from selected content...');

      // Create content item for the execution with selected content in metadata
      const newContent = await contentRepository.createContent({
        type: 'claude-code',
        data: defaultPrompt,
        group_id: currentGroup?.id || '',
        parent_content_id: currentParentId,
        metadata: {
          selected_content: selectedContent.map(c => ({
            id: c.id,
            type: c.type,
            data: c.data,
            metadata: c.metadata
          })),
          selected_content_count: selectedContent.length
        }
      });

      // Execute Claude Code immediately with selected content
      const response = await ClaudeCodeService.executeClaudeCode(
        defaultPrompt,
        currentGroup?.id || '',
        undefined, // No session ID for new execution
        selectedContent,
        newContent.id,
        (status) => {
          console.log('Claude Code progress:', status);
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Execution failed');
      }

      if (!response.session_id) {
        throw new Error('Invalid response from Claude Code Lambda - missing session_id');
      }

      // Store session metadata
      await contentRepository.storeClaudeCodeSession(newContent.id, {
        session_id: response.session_id,
        s3_url: response.s3_url,
        initial_prompt: defaultPrompt,
        last_updated_at: new Date().toISOString()
      });

      toast.success(
        'Claude Code Complete!',
        `Generated component from ${selectedContent.length} item${selectedContent.length !== 1 ? 's' : ''}`
      );

      // Clear selection and navigate to the created content
      contentSelection.clearSelection();
      setNewContent(undefined);

      // Navigate to the claude-code content to see progress and results
      handleNavigate(newContent.id);

    } catch (error) {
      console.error('Error executing Claude Code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Claude Code Failed', errorMessage);
    }
  };

  const handleCloseClaudeCodeModal = () => {
    setShowClaudeCodeModal(false);
    setSelectedContentForClaudeCode([]);
  };

  const handleClaudeCodeContentGenerated = () => {
    // Exit selection mode and refresh content list
    contentSelection.clearSelection();
    setNewContent(undefined);
  };

  const handleScreenshotGeneration = async () => {
    console.log('📸 Screenshot Generation button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Fetch selected content items
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          const content = await contentRepository.getContentById(id);
          return content;
        })
      );

      // Filter valid content and extract URLs
      const validContent = selectedContent.filter(Boolean) as Content[];
      console.log('Valid content items:', validContent.length);

      let urlsToProcess: { url: string; contentId: string }[] = [];
      let contentWithoutUrls = 0;
      let contentWithExistingScreenshots = 0;

      validContent.forEach((content) => {
        const urls = extractUrls(content.data);

        if (urls.length === 0) {
          contentWithoutUrls++;
          return;
        }

        // Check if content already has a screenshot
        if (content.metadata?.url_preview) {
          contentWithExistingScreenshots++;
          console.log(`Content ${content.id} already has screenshot: ${content.metadata.url_preview}`);
          return;
        }

        // Use first URL found in content
        const firstUrl = urls[0].normalizedUrl;
        urlsToProcess.push({
          url: firstUrl,
          contentId: content.id
        });
      });

      console.log('URLs to process:', urlsToProcess.length);
      console.log('Content without URLs:', contentWithoutUrls);
      console.log('Content with existing screenshots:', contentWithExistingScreenshots);

      if (urlsToProcess.length === 0) {
        if (contentWithoutUrls > 0 && contentWithExistingScreenshots === 0) {
          toast.info('No URLs Found', 'Selected content items do not contain any URLs to screenshot.');
        } else if (contentWithExistingScreenshots > 0) {
          toast.info('Already Complete', 'All selected content items already have screenshots.');
        } else {
          toast.info('Nothing to Process', 'No content items available for screenshot generation.');
        }
        return;
      }

      // Show initial progress notification
      toast.info('Generating Screenshots', `Starting screenshot generation for ${urlsToProcess.length} URL${urlsToProcess.length > 1 ? 's' : ''}...`);

      let successCount = 0;
      let failureCount = 0;
      const queuedJobs: Array<{ contentId: string; jobId: string }> = [];

      // Process each URL
      for (const { url, contentId } of urlsToProcess) {
        try {
          console.log(`Generating screenshot for ${url} (content: ${contentId})`);

          const result = await contentRepository.generateUrlPreview(contentId, url);

          if (result.job_id) {
            // Job queued successfully
            queuedJobs.push({ contentId, jobId: result.job_id });
            console.log(`Screenshot job queued for ${contentId}: ${result.job_id}`);
          } else if (result.success && result.screenshot_url) {
            // Immediate success (shouldn't happen with queue)
            await contentRepository.updateContentUrlPreview(contentId, result.screenshot_url);
            console.log(`Successfully generated screenshot for ${contentId}: ${result.screenshot_url}`);
            successCount++;
          } else {
            // Actual failure
            console.error(`Failed to generate screenshot for ${contentId}:`, result.error);
            failureCount++;
          }
        } catch (error) {
          console.error(`Error generating screenshot for ${contentId}:`, error);
          failureCount++;
        }
      }

      // Show completion notification
      if (queuedJobs.length > 0 && successCount === 0 && failureCount === 0) {
        toast.info('Jobs Queued', `${queuedJobs.length} screenshot job${queuedJobs.length > 1 ? 's' : ''} queued for processing`);
      } else if (successCount > 0 && failureCount === 0) {
        toast.success('Screenshots Generated', `Successfully generated ${successCount} screenshot${successCount > 1 ? 's' : ''}!`);
      } else if (queuedJobs.length > 0 || successCount > 0) {
        const parts: string[] = [];
        if (queuedJobs.length > 0) parts.push(`${queuedJobs.length} queued`);
        if (successCount > 0) parts.push(`${successCount} completed`);
        if (failureCount > 0) parts.push(`${failureCount} failed`);
        toast.info('Processing Screenshots', parts.join(', '));
      } else {
        toast.error('Generation Failed', 'Failed to generate any screenshots. Please try again later.');
      }

      // Exit selection mode and refresh content list
      contentSelection.clearSelection();
      setNewContent(undefined);

    } catch (error) {
      console.error('Error in screenshot generation:', error);
      toast.error('Error', 'Failed to process selected content for screenshot generation');
    }
  };

  const handleTranscribeAudio = async () => {
    console.log('🎙️ Audio Transcription button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Fetch selected content items
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          const content = await contentRepository.getContentById(id);
          return content;
        })
      );

      // Filter valid content and check for audio types
      const validContent = selectedContent.filter(Boolean) as Content[];
      const audioContent = validContent.filter(c => c.type === 'audio');

      console.log('Valid content items:', validContent.length);
      console.log('Audio content items:', audioContent.length);

      if (audioContent.length === 0) {
        toast.info('No Audio Files', 'Selected content items do not contain any audio files to transcribe.');
        return;
      }

      // Show initial progress notification
      toast.info('Transcribing Audio', `Starting transcription for ${audioContent.length} audio file${audioContent.length > 1 ? 's' : ''}...`);

      // Call the transcription mutation
      const results = await audioTranscriptionMutation.mutateAsync({
        selectedContent: audioContent,
        useQueue: true,
        onProgress: (item) => {
          console.log('Transcription progress:', item);

          if (item.status === 'completed') {
            toast.success(
              'Transcription Complete',
              `Finished transcribing audio file`
            );
          } else if (item.status === 'failed') {
            toast.error(
              'Transcription Failed',
              item.error || 'Failed to transcribe audio file'
            );
          }
        }
      });

      // Show final notification
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0 && failureCount === 0) {
        toast.success(
          'Transcription Complete',
          `Successfully transcribed ${successCount} audio file${successCount > 1 ? 's' : ''}!`
        );
      } else if (successCount > 0) {
        toast.warning(
          'Transcription Partially Complete',
          `Transcribed ${successCount} file${successCount > 1 ? 's' : ''}, ${failureCount} failed`
        );
      } else if (results.length === 0) {
        // Jobs were queued
        toast.info('Jobs Queued', `${audioContent.length} transcription job${audioContent.length > 1 ? 's' : ''} queued for processing`);
      } else {
        toast.error('Transcription Failed', 'Failed to transcribe any audio files. Please try again later.');
      }

      // Exit selection mode and refresh content list
      contentSelection.clearSelection();
      setNewContent(undefined);

    } catch (error) {
      console.error('Error in audio transcription:', error);
      toast.error('Error', 'Failed to process selected content for transcription');
    }
  };

  const handleYouTubeTranscript = async () => {
    console.log('📜 YouTube Transcript Extraction button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    try {
      // Fetch selected content items
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          const content = await contentRepository.getContentById(id);
          return content;
        })
      );

      // Filter valid content and check for YouTube videos
      const validContent = selectedContent.filter(Boolean) as Content[];

      // Helper function to check if content is a YouTube video
      const isYouTubeVideo = (content: Content): boolean => {
        if (content.metadata?.youtube_video_id) {
          return true;
        }
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        return youtubeRegex.test(content.data);
      };

      const youtubeContent = validContent.filter(isYouTubeVideo);

      console.log('Valid content items:', validContent.length);
      console.log('YouTube video items:', youtubeContent.length);

      if (youtubeContent.length === 0) {
        toast.info('No YouTube Videos', 'Selected content items do not contain any YouTube videos to extract transcripts from.');
        return;
      }

      // Show initial progress notification
      toast.info('Extracting Transcripts', `Starting transcript extraction for ${youtubeContent.length} YouTube video${youtubeContent.length > 1 ? 's' : ''}...`);

      // Call the transcript extraction mutation
      const results = await youtubeTranscriptMutation.mutateAsync({
        selectedContent: youtubeContent,
        useQueue: true,
        onProgress: (item) => {
          console.log('Transcript extraction progress:', item);

          if (item.status === 'completed') {
            toast.success(
              'Transcript Extraction Complete',
              `Finished extracting transcript for video`
            );
          } else if (item.status === 'failed') {
            toast.error(
              'Transcript Extraction Failed',
              item.error || 'Failed to extract transcript'
            );
          }
        }
      });

      // Show final notification
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0 && failureCount === 0) {
        toast.success(
          'Transcript Extraction Complete',
          `Successfully extracted transcripts for ${successCount} video${successCount > 1 ? 's' : ''}!`
        );
      } else if (successCount > 0) {
        toast.warning(
          'Transcript Extraction Partially Complete',
          `Extracted ${successCount} transcript${successCount > 1 ? 's' : ''}, ${failureCount} failed`
        );
      } else if (results.length === 0) {
        // Jobs were queued
        toast.info('Jobs Queued', `${youtubeContent.length} transcript extraction job${youtubeContent.length > 1 ? 's' : ''} queued for processing`);
      } else {
        toast.error('Transcript Extraction Failed', 'Failed to extract any transcripts. Please try again later.');
      }

      // Exit selection mode and refresh content list
      contentSelection.clearSelection();
      setNewContent(undefined);

    } catch (error) {
      console.error('Error in YouTube transcript extraction:', error);
      toast.error('Error', 'Failed to process selected content for transcript extraction');
    }
  };

  const handleYouTubeAnnotation = async () => {
    console.log('🎞️ YouTube Annotation button clicked!');
    console.log('Selection state:', {
      isSelectionMode: contentSelection.isSelectionMode,
      selectedCount: contentSelection.selectedCount,
      selectedItems: contentSelection.selectedItems
    });

    const selectedIds = Array.from(contentSelection.selectedItems);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No items selected, exiting');
      return;
    }

    if (selectedIds.length > 1) {
      toast.warning('Multiple items selected', 'Please select only one YouTube video to annotate');
      return;
    }

    try {
      // Get the content object for the selected ID
      const contentId = selectedIds[0];
      const content = await contentRepository.getContentById(contentId);

      if (!content) {
        toast.error('Content not found', 'Unable to find selected item in database');
        return;
      }

      // Check if content contains a YouTube video URL or has video metadata
      const videoId = getYouTubeVideoFromContent(content);
      if (!videoId) {
        toast.warning('Not a YouTube video', 'Please select content containing a YouTube video URL');
        return;
      }

      // Enrich content with video ID if not already present in metadata
      if (!content.metadata?.youtube_video_id) {
        content.metadata = {
          ...content.metadata,
          youtube_video_id: videoId
        };
      }

      // Open YouTube annotator modal
      setSelectedVideoForAnnotation(content);
      setShowYouTubeAnnotator(true);

      console.log('Opening YouTube annotator modal for video:', content.id);

    } catch (error) {
      console.error('Error during YouTube annotation:', error);
      toast.error(
        'Annotation failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      // Clear selection after processing
      contentSelection.clearSelection();
    }
  };

  const handleCloseYouTubeAnnotator = () => {
    setShowYouTubeAnnotator(false);
    setSelectedVideoForAnnotation(null);
  };

  const handleTimestampsCreated = () => {
    // Refresh content list after adding timestamps
    contentSelection.clearSelection();
    setNewContent(undefined);
  };

  // Spotify Import handlers
  const handleSpotifyImportSelect = () => {
    console.log('🎵 Spotify import selected');
    setShowSpotifyModal(true);
  };

  const handleCloseSpotifyModal = () => {
    setShowSpotifyModal(false);
  };

  const handleSpotifyPlaylistImported = () => {
    // Refresh content list after importing playlist
    setShowSpotifyModal(false);
    setNewContent(undefined);
    toast.success('Playlist Imported!', 'Successfully imported Spotify playlist');
  };

  // Quick AI Chat handler - creates chat instantly without modal
  const handleQuickAIChat = async () => {
    console.log('💬 Quick AI Chat clicked!');

    if (!currentGroup || !user) {
      toast.error('Cannot create chat', 'Please select a group first');
      return;
    }

    try {
      // Create a new chat content item
      const chatContent = await contentRepository.createContent({
        type: 'chat',
        data: '🤖 AI Assistant',
        group_id: currentGroup.id,
        user_id: user.id,
        parent_content_id: currentParentId,
        metadata: {
          created_via: 'quick_chat',
          model: 'gpt-4'
        }
      });

      console.log('Created chat content:', chatContent);

      // Navigate to the new chat
      await handleNavigate(chatContent.id);

      toast.success('AI Chat Started!', 'You can now start chatting');
    } catch (error) {
      console.error('Failed to create quick AI chat:', error);
      toast.error('Failed to create chat', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // AI Content Analysis handler - creates chat with selected content for AI analysis
  const handleAIContentAnalysis = async () => {
    console.log('🧠 AI Content Analysis clicked!');

    const selectedIds = Array.from(contentSelection.selectedItems);

    if (selectedIds.length === 0) {
      toast.error('No content selected', 'Please select content to analyze');
      return;
    }

    if (!currentGroup || !user) {
      toast.error('Cannot create chat', 'Please select a group first');
      return;
    }

    try {
      // Fetch full content objects
      const selectedContent = await Promise.all(
        selectedIds.map(async (id) => {
          const content = await contentRepository.getContentById(id);
          if (!content) {
            throw new Error(`Content with ID ${id} not found`);
          }
          return content;
        })
      );

      // Serialize content into readable format
      const serializedContent = selectedContent.map((item, index) => {
        let contentStr = `${index + 1}. [Type: ${item.type}] ${item.data}`;

        // Add tags if available
        if (item.tags && item.tags.length > 0) {
          contentStr += `\n   Tags: ${item.tags.map(t => t.name).join(', ')}`;
        }

        // Add metadata for certain types
        if (item.type === 'seo' && item.metadata) {
          if (item.metadata.title) contentStr += `\n   Title: ${item.metadata.title}`;
          if (item.metadata.description) contentStr += `\n   Description: ${item.metadata.description}`;
        }

        return contentStr;
      }).join('\n\n');

      // Construct the prompt
      const prompt = `Consider the following content and elaborate on what it is. If you are not sure, then think about what it could be:\n\n${serializedContent}`;

      // Create chat container
      const chatContent = await contentRepository.createContent({
        type: 'chat',
        data: `AI Analysis: ${selectedContent.length} item${selectedContent.length > 1 ? 's' : ''}`,
        group_id: currentGroup.id,
        user_id: user.id,
        parent_content_id: currentParentId,
        metadata: {
          created_via: 'content_analysis',
          analyzed_content_count: selectedContent.length
        }
      });

      // Create user message with the prompt
      await contentRepository.createContent({
        type: 'text',
        data: prompt,
        group_id: currentGroup.id,
        user_id: user.id,
        parent_content_id: chatContent.id,
        metadata: { role: 'user' }
      });

      // Call chat service to get AI response
      const chatResponse = await ChatService.sendMessage({
        chat_content_id: chatContent.id,
        message: prompt,
        group_id: currentGroup.id
      });

      if (!chatResponse.success) {
        throw new Error(chatResponse.error || 'AI analysis failed');
      }

      // Invalidate cache to show AI response
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(currentGroup.id, chatContent.id)
      });

      // Navigate to the chat
      await handleNavigate(chatContent.id);

      // Clear selection
      contentSelection.clearSelection();

      toast.success('AI Analysis Started!', 'Analyzing your content');
    } catch (error) {
      console.error('Failed to create AI content analysis:', error);
      toast.error('Analysis Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Define available workflow actions
  const workflowActions = [
    {
      id: 'ai-chat',
      name: 'AI Chat',
      description: 'Start an AI conversation instantly',
      icon: '💬',
      onClick: () => {
        console.log('💬 WorkflowAction onClick triggered for Quick AI Chat');
        handleQuickAIChat();
      }
    },
    {
      id: 'ai-analyze',
      name: 'Analyze with AI',
      description: 'Ask AI to analyze and elaborate on selected content',
      icon: '🧠',
      onClick: () => {
        console.log('🧠 WorkflowAction onClick triggered for AI Content Analysis');
        handleAIContentAnalysis();
      }
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Execute coding tasks with Claude Code SDK',
      icon: '💻',
      onClick: () => {
        console.log('💻 WorkflowAction onClick triggered for Claude Code execution');
        handleClaudeCodeExecution();
      }
    },
    {
      id: 'seo-extract',
      name: 'Extract SEO',
      description: 'Extract SEO metadata from links',
      icon: '🔍',
      onClick: () => {
        console.log('🔍 WorkflowAction onClick triggered for SEO extraction');
        handleSEOExtraction();
      }
    },
    {
      id: 'markdown-extract',
      name: 'Extract Markdown',
      description: 'Convert URLs to markdown',
      icon: '📝',
      onClick: () => {
        console.log('📝 WorkflowAction onClick triggered for markdown extraction');
        handleMarkdownExtraction();
      }
    },
    {
      id: 'youtube-playlist',
      name: 'Extract Playlist',
      description: 'Extract videos from YouTube playlists',
      icon: '🎬',
      onClick: () => {
        console.log('🎬 WorkflowAction onClick triggered for YouTube playlist extraction');
        handleYouTubePlaylistExtraction();
      }
    },
    {
      id: 'libgen-search',
      name: 'Search Books',
      description: 'Search for books on Library Genesis',
      icon: '📚',
      category: ['search'],
      onClick: () => {
        console.log('📚 WorkflowAction onClick triggered for Libgen search');
        handleLibgenSearch();
      }
    },
    {
      id: 'youtube-annotate',
      name: 'Annotate Video',
      description: 'Add timestamps to YouTube videos',
      icon: '🎞️',
      onClick: () => {
        console.log('🎞️ WorkflowAction onClick triggered for YouTube annotation');
        handleYouTubeAnnotation();
      }
    },
    {
      id: 'tmdb-search',
      name: 'Search TMDb',
      description: 'Search The Movie Database and add results',
      icon: '🎥',
      category: ['search'],
      onClick: () => {
        console.log('🎥 WorkflowAction onClick triggered for TMDb search');
        handleTMDbSearch();
      }
    },
    {
      id: 'screenshot-generate',
      name: 'Take Screenshot',
      description: 'Generate screenshots for URLs in selected content',
      icon: '📸',
      onClick: () => {
        console.log('📸 WorkflowAction onClick triggered for screenshot generation');
        handleScreenshotGeneration();
      }
    },
    {
      id: 'transcribe-audio',
      name: 'Transcribe Audio',
      description: 'Generate transcripts from audio files',
      icon: '🎙️',
      onClick: () => {
        console.log('🎙️ WorkflowAction onClick triggered for audio transcription');
        handleTranscribeAudio();
      }
    },
    {
      id: 'youtube-transcript',
      name: 'Extract Transcript',
      description: 'Get transcripts from YouTube videos',
      icon: '📜',
      onClick: () => {
        console.log('📜 WorkflowAction onClick triggered for YouTube transcript extraction');
        handleYouTubeTranscript();
      }
    },
    {
      id: 'send-to-group',
      name: 'Send to Group',
      description: 'Copy selected items to another group',
      icon: '📤',
      onClick: () => {
        console.log('📤 WorkflowAction onClick triggered for send to group');
        setShowSendToGroupModal(true);
      }
    },
    {
      id: 'bulk-delete',
      name: 'Delete Items',
      description: 'Delete selected items',
      icon: '🗑️',
      onClick: handleBulkDelete
    }
  ];

  // Filter workflows by category for search workflows
  const searchWorkflows = workflowActions.filter(action => action.category?.includes('search'));

  // Gradual initialization with deliberate delays to prevent DOM conflicts
  const initializeApp = async () => {
    // Prevent concurrent initializations
    if (isInitializingRef.current) {
      console.log('Initialization already in progress, skipping...');
      return;
    }
    
    isInitializingRef.current = true;
    // Keep single loading state throughout initialization
    
    try {
      // Step 1: Get authentication session
      const session = await getFastSession();
      
      if (!session?.user) {
        // Add small delay before showing auth screen to let any pending renders complete
        await new Promise(resolve => setTimeout(resolve, 50));
        setAppState('ready');
        isInitializingRef.current = false;
        return;
      }

      // Step 2: Set user state with small delay for React reconciliation
      setUser(session.user);
      setError(null);
      
      // Small delay to allow React to process user state change
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Step 3: Initialize user profile and handle pending invites
      await Promise.all([
        handleUserInitialization(session.user.id),
        handlePendingInvite()
      ]);
      
      // Step 4: Another small delay before final state transition
      await new Promise(resolve => setTimeout(resolve, 50));
      setAppState('ready');
      
    } catch (error) {
      console.error('App initialization error:', error);
      // Single error state update
      setError('Failed to initialize application');
      setAppState('error');
    } finally {
      isInitializingRef.current = false;
    }
  };

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, []);

  // Auth state listener - delayed setup to prevent initialization conflicts
  useEffect(() => {
    // Delay auth listener setup to avoid conflicts with initialization
    const setupAuthListener = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        // Skip token refresh events and skip during initialization
        if (event === 'TOKEN_REFRESHED' || isInitializingRef.current) {
          return;
        }

        // Handle auth state changes with small delay to prevent DOM conflicts
        try {
          if (session?.user) {
            // Check if this is a genuine signup completion (first time login after email confirmation)
            const isActualSignupCompletion = event === 'SIGNED_IN' && 
              isFirstAuthRef.current && 
              !hasShownWelcomeRef.current &&
              (localStorage.getItem('pendingSignupConfirmation') === 'true' || 
               sessionStorage.getItem('pendingInviteCode'));
            
            if (isActualSignupCompletion) {
              console.log('Genuine signup completion detected - email confirmed');
              hasShownWelcomeRef.current = true;
              localStorage.removeItem('pendingSignupConfirmation');
              
              // Check if there's a pending invite to process or if we're on an invite URL
              const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
              const isOnInviteUrl = window.location.pathname.startsWith('/invite/');
              
              if (pendingInviteCode || isOnInviteUrl) {
                console.log('Email confirmed with pending group invite');
                toast.success('Email confirmed!', 'Welcome! Joining your group now...');
              } else {
                toast.success('Email confirmed!', 'Welcome to List App!');
              }
            }
            
            // Mark that we've processed the first auth event
            isFirstAuthRef.current = false;

            // Small delay before re-initializing to prevent DOM conflicts
            await new Promise(resolve => setTimeout(resolve, 100));
            await initializeApp();

            // Session is automatically shared with extension via chrome.storage bridge
            // No explicit notification needed - extension will detect session on next auth check
          } else if (!session?.user && event === 'SIGNED_OUT') {
            // User signed out - batch reset state with small delay
            await new Promise(resolve => setTimeout(resolve, 50));
            setUser(null);
            setCurrentGroup(null);
            setError(null);
            setAppState('ready');
            sessionStorage.removeItem('pendingInviteCode');
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          setError('Authentication error occurred');
          setAppState('error');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    setupAuthListener();
  }, []); // Removed user dependency to prevent loop

  const handleUserInitialization = async (userId: string) => {
    setError(null);
    try {
      await contentRepository.createOrUpdateUser(userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setError('Failed to initialize user profile');
    }
  };

  // Handle pending invites after auth - separated from main auth flow
  const handlePendingInvite = async () => {
    const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
    if (!pendingInviteCode) return;
    
    try {
      const group = await joinGroupMutation.mutateAsync(pendingInviteCode);
      setCurrentGroup(group);
      sessionStorage.removeItem('pendingInviteCode');
      
      // Show different messages based on whether this was a signup completion
      const wasSignupCompletion = hasShownWelcomeRef.current || localStorage.getItem('pendingSignupConfirmation') === 'true';
      if (wasSignupCompletion) {
        toast.success('Welcome! You\'ve joined the group', `Successfully joined "${group.name}" after confirming your email.`);
      } else {
        toast.success('Joined group!', `Welcome to "${group.name}".`);
      }
      
      return group; // Return group for URL update
    } catch (error) {
      console.error('Error joining group after auth:', error);
      sessionStorage.removeItem('pendingInviteCode');
      toast.error('Failed to join group', 'The invite code may be invalid or expired.');
      return null;
    }
  };


  // Auto-select group when groups are loaded (with localStorage persistence)
  useEffect(() => {
    if (!currentGroup && groups.length > 0) {
      const savedGroupId = localStorage.getItem('lastViewedGroupId');
      const savedGroup = groups.find(g => g.id === savedGroupId);
      setCurrentGroup(savedGroup || groups[0]);
    }
  }, [groups, currentGroup]);

  // Save current group to localStorage when it changes
  useEffect(() => {
    if (currentGroup?.id) {
      localStorage.setItem('lastViewedGroupId', currentGroup.id);
    }
  }, [currentGroup]);

  // Load view mode from localStorage when group changes
  useEffect(() => {
    if (currentGroup?.id) {
      const savedViewMode = localStorage.getItem(`viewMode_${currentGroup.id}`) as ViewMode;
      if (savedViewMode && ['chronological', 'random', 'alphabetical', 'oldest'].includes(savedViewMode)) {
        setViewMode(savedViewMode);
      } else {
        setViewMode('chronological'); // Default view mode
      }
    }
  }, [currentGroup?.id]);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (currentGroup?.id && viewMode) {
      localStorage.setItem(`viewMode_${currentGroup.id}`, viewMode);
    }
  }, [currentGroup?.id, viewMode]);

  // Load tag filter from localStorage when group changes
  useEffect(() => {
    if (currentGroup?.id) {
      const savedTagFilter = localStorage.getItem(`tagFilter_${currentGroup.id}`);
      if (savedTagFilter) {
        try {
          const parsedTags = JSON.parse(savedTagFilter);
          // Support both old single tag format and new array format
          setSelectedTagFilter(Array.isArray(parsedTags) ? parsedTags : []);
        } catch (e) {
          setSelectedTagFilter([]);
        }
      } else {
        setSelectedTagFilter([]);
      }
    }
  }, [currentGroup?.id]);

  // Save tag filter to localStorage when it changes
  useEffect(() => {
    if (currentGroup?.id) {
      if (selectedTagFilter.length > 0) {
        localStorage.setItem(`tagFilter_${currentGroup.id}`, JSON.stringify(selectedTagFilter));
      } else {
        localStorage.removeItem(`tagFilter_${currentGroup.id}`);
      }
    }
  }, [currentGroup?.id, selectedTagFilter]);

  // Load display mode from localStorage when group changes
  useEffect(() => {
    if (currentGroup?.id) {
      const savedDisplayMode = localStorage.getItem(`displayMode_${currentGroup.id}`) as DisplayMode;
      if (savedDisplayMode && ['list', 'stack', 'masonry', 'deck'].includes(savedDisplayMode)) {
        setDisplayMode(savedDisplayMode);
      } else {
        setDisplayMode('list'); // Default display mode
      }
    }
  }, [currentGroup?.id]);

  // Save display mode to localStorage when it changes
  useEffect(() => {
    if (currentGroup?.id && displayMode) {
      localStorage.setItem(`displayMode_${currentGroup.id}`, displayMode);
    }
  }, [currentGroup?.id, displayMode]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleContentAdded = (content: Content) => {
    setNewContent(content);
    // Clear newContent after a brief delay to allow ContentList to process it
    setTimeout(() => setNewContent(undefined), 100);
  };

  const handleInputClose = () => {
    setShowInput(false);
  };

  const handleGroupChange = (group: Group) => {
    setCurrentGroup(group);
    setShowInput(false); // Hide input when switching groups
    // Clear content selection when switching groups
    contentSelection.clearSelection();
    // Navigate to the new group's URL
    navigate(`/group/${group.id}`);
  };

  const handleCreateGroup = () => {
    setGroupModalMode('create');
    setShowGroupModal(true);
  };

  const handleJoinGroup = () => {
    setGroupModalMode('join');
    setShowGroupModal(true);
  };

  const handleLeaveGroup = (leftGroupId: string) => {
    // If user left the current group, switch to another group or clear current group
    if (currentGroup?.id === leftGroupId) {
      const remainingGroups = groups.filter(g => g.id !== leftGroupId);
      if (remainingGroups.length > 0) {
        // Switch to the first remaining group
        setCurrentGroup(remainingGroups[0]);
        navigate(`/group/${remainingGroups[0].id}`);
      } else {
        // No groups left, clear current group
        setCurrentGroup(null);
        navigate('/');
      }
    }

    // Clear any cached data for the left group
    localStorage.removeItem('lastViewedGroupId');
  };

  const handleCreateGroupSubmit = async (groupName: string) => {
    try {
      const newGroup = await createGroupMutation.mutateAsync(groupName);
      setCurrentGroup(newGroup);
      setShowGroupModal(false);
    } catch (error) {
      console.error('Error creating group:', error);
      setError('Failed to create group');
    }
  };

  const handleJoinGroupSubmit = async (joinCode: string) => {
    try {
      const group = await joinGroupMutation.mutateAsync(joinCode);
      
      // Check if user was already a member
      if ((group as any).alreadyMember) {
        toast.success('Already a member', `You're already part of "${group.name}".`);
      } else {
        toast.success('Joined group!', `Successfully joined "${group.name}".`);
      }
      
      setCurrentGroup(group);
      setShowGroupModal(false);
    } catch (error) {
      console.error('Error joining group:', error);
      
      // Provide specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Failed to join group';
      if (errorMessage.includes('Invalid join code')) {
        toast.error('Invalid join code', 'Please check the code and try again.');
      } else {
        toast.error('Failed to join group', errorMessage);
      }
      setError('Failed to join group');
    }
  };

  const handleNavigate = async (parentId: string | null) => {
    if (parentId === currentParentId && !currentJsContent) return;

    // Close input when navigating
    setShowInput(false);

    // Clear tag filters when navigating to different content
    clearTagFilter();

    if (parentId === null) {
      // Navigate to root
      setCurrentParentId(null);
      setCurrentJsContent(null);
      setNavigationStack([{id: null, name: 'Root'}]);

      // Use React Router to navigate to group root
      if (currentGroup) {
        navigate(`/group/${currentGroup.id}`);
      }
    } else {
      try {
        // Get the content item to navigate to
        const parentContent = await contentRepository.getContentById(parentId);
        if (parentContent) {
          // Check content type and set appropriate state
          if (parentContent.type === 'js') {
            setCurrentJsContent(parentContent);
            setCurrentParentId(parentId);
          } else {
            // Regular content navigation
            setCurrentJsContent(null);
            setCurrentParentId(parentId);
          }

          // Add to navigation stack
          const displayName = parentContent.type === 'js'
            ? `JS: ${parentContent.data.substring(0, 20)}...`
            : parentContent.data.substring(0, 30);
          const newStack = [...navigationStack, {id: parentId, name: displayName}];
          setNavigationStack(newStack);

          // Use React Router to navigate to content
          if (currentGroup) {
            navigate(`/group/${currentGroup.id}/content/${parentId}`);
          }
        }
      } catch (error) {
        console.error('Error navigating to content:', error);
      }
    }
  };


  // Handle search input with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search activation
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(!!query.trim());
    }, 300);
  };

  // Handle content search query change (without debouncing for SearchWorkflowSelector)
  const handleContentSearchChange = (query: string) => {
    setSearchQuery(query);
    setIsSearching(!!query.trim());
  };

  // Helper function to load content from URL params
  const loadContentFromParams = async (contentId: string) => {
    try {
      const content = await contentRepository.getContentById(contentId);
      if (content) {
        // Check if this is JS content - if so, show the JS editor view
        if (content.type === 'js') {
          setCurrentJsContent(content);
          setCurrentParentId(contentId);
        } else {
          // Regular content navigation
          setCurrentJsContent(null);
          setCurrentParentId(contentId);
        }
        
        // Update navigation stack
        const displayName = content.type === 'js' 
          ? `JS: ${content.data.substring(0, 20)}...`
          : content.data.substring(0, 30);
        setNavigationStack([
          {id: null, name: 'Root'},
          {id: contentId, name: displayName}
        ]);
      }
    } catch (error) {
      console.error('Error loading content from URL params:', error);
    }
  };

  // Handle React Router param changes for navigation synchronization
  useEffect(() => {
    if (!user || !groups.length) return;

    const { groupId, contentId } = params;

    // Handle group changes from URL
    if (groupId && (!currentGroup || currentGroup.id !== groupId)) {
      const targetGroup = groups.find(g => g.id === groupId);
      if (targetGroup) {
        // Only update if it's actually a different group instance
        // This prevents unnecessary re-renders and state updates
        if (!currentGroup || currentGroup.id !== targetGroup.id) {
          setCurrentGroup(targetGroup);
        }
        return; // Let the group change effect handle content navigation
      }
    }
    
    // Handle content navigation from URL (only if we're in the right group)
    if (currentGroup && groupId === currentGroup.id) {
      if (contentId && contentId !== currentParentId) {
        // Navigate to specific content
        loadContentFromParams(contentId);
      } else if (!contentId && currentParentId) {
        // Navigate to group root
        setCurrentParentId(null);
        setCurrentJsContent(null);
        setNavigationStack([{id: null, name: 'Root'}]);
      }
    }
  }, [params.groupId, params.contentId, user, groups, currentGroup, currentParentId]);

  // Reset navigation and search when group changes (but not when navigating to content)
  useEffect(() => {
    if (currentGroup && !params.contentId) {
      setCurrentParentId(null);
      setCurrentJsContent(null);
      setNavigationStack([{id: null, name: 'Root'}]);
      setShowInput(false); // Close input when switching groups
      // Clear search
      setSearchQuery('');
      setIsSearching(false);
      // Note: contentSelection.clearSelection() moved to handleGroupChange
    }
  }, [currentGroup, params.contentId]);

  // Navigation handled by React Router - no manual URL management needed

  // Handle invite URL navigation only (React Router params handle regular navigation)
  useEffect(() => {
    const handleInviteNavigation = async () => {
      const pathname = window.location.pathname;

      // Check for invite URL pattern: /invite/<code>
      const inviteMatch = pathname.match(/^\/invite\/([^\/]+)$/);
      if (inviteMatch) {
        const [, joinCode] = inviteMatch;

        // If user is not authenticated, save invite code and show auth
        if (!user) {
          // Store invite code for after authentication
          sessionStorage.setItem('pendingInviteCode', joinCode);
          // Don't redirect yet - let them authenticate first
          return;
        }

        // Prevent concurrent join attempts
        if (isJoiningGroupRef.current) {
          console.log('Join already in progress, skipping duplicate attempt');
          return;
        }

        // User is authenticated, try to join the group
        try {
          isJoiningGroupRef.current = true;
          setError(null);
          console.log(`Attempting to join group with code: ${joinCode}`);
          const group = await joinGroupMutationRef.current.mutateAsync(joinCode);

          // Ensure we have the correct group ID from the response
          if (!group || !group.id) {
            throw new Error('Invalid group response');
          }

          console.log(`Successfully joined/retrieved group:`, {
            id: group.id,
            name: group.name,
            joinCode: group.join_code,
            alreadyMember: (group as any).alreadyMember
          });

          // Clear any stored invite code first
          sessionStorage.removeItem('pendingInviteCode');

          // Set the current group explicitly
          setCurrentGroup(group);

          // Navigate to the new group using React Router with the correct ID
          // Use replace to avoid back button issues
          console.log(`Navigating to /group/${group.id}`);
          navigate(`/group/${group.id}`, { replace: true });
          return;
        } catch (error) {
          console.error('Error joining group from invite:', error);
          setError('Failed to join group. The invite code may be invalid or expired.');
          // Clear stored invite code on error
          sessionStorage.removeItem('pendingInviteCode');
          return;
        } finally {
          // Always reset the flag after join attempt completes
          isJoiningGroupRef.current = false;
        }
      }
    };

    // Only handle invite URLs - React Router params handle group/content URLs
    if (user && window.location.pathname.startsWith('/invite/')) {
      handleInviteNavigation();
    }

    // Handle browser back/forward navigation for invite URLs only
    const handlePopState = () => {
      if (user && window.location.pathname.startsWith('/invite/')) {
        handleInviteNavigation();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, navigate]);

  // Stable container pattern - always return same structure, conditionally show content
  return (
    <div data-testid="main-app" className="bg-gray-50 flex flex-col transition-all duration-200 ease-in-out overflow-hidden">
      
      {/* Error State */}
      {appState === 'error' && (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md px-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h2>
              <p className="text-red-600 mb-4">{error || 'Failed to initialize application'}</p>
              <button
                onClick={() => {
                  setError(null);
                  initializeApp();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Screen */}
      {appState === 'ready' && !user && (
        <UserAuth onAuthSuccess={() => {}} />
      )}

      {/* Loading State */}
      {(appState === 'loading' || (joinGroupMutation.isPending && window.location.pathname.startsWith('/invite/')) || (appState === 'ready' && user && !currentGroup && (groupsLoading || groups.length > 0))) && (
        <AppSkeleton />
      )}

      {/* Main App Content */}
      {appState === 'ready' && user && (currentGroup || (!groupsLoading && groups.length === 0)) && (
        <>
          {showYouTubeAnnotator ? (
            // Full-page YouTube Video Annotator
            <YouTubeVideoAnnotatorPage
              videoContent={selectedVideoForAnnotation}
              onClose={handleCloseYouTubeAnnotator}
              onTimestampsCreated={handleTimestampsCreated}
              availableTags={availableTags}
            />
          ) : (
            <>
          {/* Header */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200 w-full">
            <div className="w-full px-4 py-3">
              <div className="flex justify-between items-center">
                {/* Centered Group Dropdown */}
                <div className="flex-1 flex justify-center">
                  <GroupDropdown
                    currentGroup={currentGroup}
                    groups={groups}
                    onGroupChange={handleGroupChange}
                    isLoading={groupsLoading}
                  />
                </div>

            {/* View Mode Selector and Tag Filter */}
            {currentGroup && (
              <div className="flex items-center mx-2 sm:mx-4 space-x-2">
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  className="text-gray-600 text-sm bg-transparent border-none cursor-pointer appearance-none focus:outline-none"
                  title="View mode"
                >
                  <option value="chronological">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="alphabetical">A-Z</option>
                  <option value="random">Random</option>
                </select>

                {/* Tag Filter Selector */}
                <TagFilterSelector
                  selectedTags={selectedTagFilter}
                  availableTags={availableTags}
                  groupId={currentGroup.id}
                  onTagAdd={addTagToFilter}
                  onTagRemove={removeTagFromFilter}
                  onClearAll={clearTagFilter}
                />

                {/* Saved Tag Filters */}
                <SavedTagFilterButton
                  groupId={currentGroup.id}
                  currentFilter={selectedTagFilter}
                  onFilterApply={(tags) => setSelectedTagFilter(tags.map(tag => ({ tag, mode: 'include' })))}
                  className="hidden md:flex"
                />

                {/* Selected Tags Display - Collapsible with Hover Expand */}
                {selectedTagFilter.length > 0 && (
                  <div
                    className="relative transition-all duration-200 hidden md:block"
                    onMouseEnter={handleTagFilterMouseEnter}
                    onMouseLeave={handleTagFilterMouseLeave}
                  >
                    {isTagFilterExpanded ? (
                      /* Expanded: Show all tags horizontally scrollable */
                      <div className="flex items-center gap-1 overflow-x-auto max-w-md scrollbar-hide">
                        {selectedTagFilter.map((tagFilter) => (
                          <div key={tagFilter.tag.id} className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTagFilterMode(tagFilter.tag.id);
                              }}
                              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-l-full transition-colors flex-shrink-0 ${
                                tagFilter.mode === 'include'
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                              title={tagFilter.mode === 'include' ? 'Click to exclude' : 'Click to include'}
                            >
                              <span className="text-[10px] font-bold">{tagFilter.mode === 'include' ? '+' : '−'}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTagFromFilter(tagFilter.tag.id);
                              }}
                              className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-r-full transition-colors flex-shrink-0 hover:opacity-80"
                              style={{
                                backgroundColor: tagFilter.tag.color ? `${tagFilter.tag.color}20` : '#e5e7eb',
                                borderColor: tagFilter.tag.color || '#d1d5db',
                                borderWidth: '1px',
                                color: tagFilter.tag.color || '#374151'
                              }}
                              title={`Remove ${tagFilter.tag.name} filter`}
                            >
                              <span>{tagFilter.tag.name}</span>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Collapsed: Show only last tag + count badge */
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTagFilterMode(selectedTagFilter[selectedTagFilter.length - 1].tag.id);
                            }}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-l-full transition-colors flex-shrink-0 ${
                              selectedTagFilter[selectedTagFilter.length - 1].mode === 'include'
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                            title={selectedTagFilter[selectedTagFilter.length - 1].mode === 'include' ? 'Click to exclude' : 'Click to include'}
                          >
                            <span className="text-[10px] font-bold">{selectedTagFilter[selectedTagFilter.length - 1].mode === 'include' ? '+' : '−'}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTagFromFilter(selectedTagFilter[selectedTagFilter.length - 1].tag.id);
                            }}
                            className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-r-full transition-colors flex-shrink-0 hover:opacity-80"
                            style={{
                              backgroundColor: selectedTagFilter[selectedTagFilter.length - 1].tag.color ? `${selectedTagFilter[selectedTagFilter.length - 1].tag.color}20` : '#e5e7eb',
                              borderColor: selectedTagFilter[selectedTagFilter.length - 1].tag.color || '#d1d5db',
                              borderWidth: '1px',
                              color: selectedTagFilter[selectedTagFilter.length - 1].tag.color || '#374151'
                            }}
                            title={`Remove ${selectedTagFilter[selectedTagFilter.length - 1].tag.name} filter`}
                          >
                            <span>{selectedTagFilter[selectedTagFilter.length - 1].tag.name}</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {selectedTagFilter.length > 1 && (
                          <span className="text-xs text-gray-500 font-medium px-1">
                            +{selectedTagFilter.length - 1} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              {(groupsLoading || createGroupMutation.isPending || joinGroupMutation.isPending) && (
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              )}
              {currentGroup && !isSearching && (
                <button
                  onClick={contentSelection.toggleSelectionMode}
                  className={`p-1.5 sm:px-2 sm:py-1 rounded-md transition-colors ${
                    contentSelection.isSelectionMode
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  title={contentSelection.isSelectionMode ? 'Exit selection mode' : 'Enter selection mode'}
                >
                  {contentSelection.isSelectionMode ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>
              )}
              {/* Display Mode Selector */}
              {currentGroup && !isSearching && (
                <ViewDisplaySelector
                  currentMode={displayMode}
                  onSelect={setDisplayMode}
                />
              )}
              {/* Sharing Button - only show when viewing specific content */}
              {currentGroup && currentParentId && (
                <button
                  onClick={handleOpenSharingModal}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1.5 rounded-md hover:bg-gray-50"
                  title="Share this content"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              {/* User info */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                {/* User avatar - always shown */}
                <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center" title={user.email || undefined}>
                  <span className="text-xs text-white font-medium">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  title="Sign out"
                >
                  {/* Icon on mobile, text on desktop */}
                  <span className="hidden sm:inline text-sm">Sign out</span>
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Search Status */}
          {isSearching && currentGroup && searchQuery.trim() && (
            <div className="mt-2 text-sm text-gray-600">
              Searching for "{searchQuery.trim()}"...
            </div>
          )}
            </div>
          </header>

          <div className="m-14 flex-1 flex flex-col max-w-4xl mx-auto w-full shadow-sm transition-all duration-200 ease-in-out">
            {/* Back Button Navigation */}
            {currentGroup && navigationStack.length > 1 && (
              <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-2 flex items-center justify-between">
                <button
                  onClick={() => handleNavigate(navigationStack[navigationStack.length - 2]?.id || null)}
                  className="flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>

                {/* Content Actions Button */}
                {currentParentId && (
                  <button
                    onClick={() => {
                      // Select the current content item to enable workflows
                      contentSelection.toggleItem(currentParentId);
                      // Workflows will appear in the input bar at the bottom
                    }}
                    className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    title="Run workflows on this content"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="hidden sm:inline">Actions</span>
                  </button>
                )}
              </div>
            )}

        {/* Selection Header */}
        {contentSelection.isSelectionMode && currentGroup && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            {/* Mobile Layout - Stack vertically */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  {contentSelection.selectedCount} selected
                </span>
                <button
                  onClick={contentSelection.toggleSelectionMode}
                  className="text-xs text-gray-500 hover:text-gray-700 p-2 -m-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => contentSelection.selectAll([])}
                  className="flex-1 text-xs text-blue-600 hover:text-blue-800 px-3 py-2 rounded-md bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  All
                </button>
                <button
                  onClick={contentSelection.clearSelection}
                  className="flex-1 text-xs text-blue-600 hover:text-blue-800 px-3 py-2 rounded-md bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            
            {/* Desktop Layout - Keep original */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-900">
                  {contentSelection.selectedCount} item{contentSelection.selectedCount !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => contentSelection.selectAll([])}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                >
                  Select All
                </button>
                <button
                  onClick={contentSelection.clearSelection}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                >
                  Clear
                </button>
                <button
                  onClick={contentSelection.toggleSelectionMode}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content List or JS Editor View */}
        {currentJsContent ? (
          <JsEditorView
            jsContent={currentJsContent}
            groupId={currentGroup?.id || ''}
            onClose={() => handleNavigate(null)}
            onNavigate={handleNavigate}
            searchQuery={searchQuery}
            isSearching={isSearching}
            selection={contentSelection}
            newContent={newContent}
            onContentAdded={handleContentAdded}
            showInput={showInput}
            onInputClose={handleInputClose}
            viewMode={viewMode}
            availableTags={availableTags}
          />
        ) : displayMode === 'stack' ? (
          <ContentStack
            groupId={currentGroup?.id || ''}
            newContent={newContent}
            parentContentId={currentParentId}
            onNavigate={handleNavigate}
            searchQuery={searchQuery}
            isSearching={isSearching}
            selection={contentSelection}
            showInput={showInput}
            onInputClose={handleInputClose}
            onContentAdded={handleContentAdded}
            viewMode={viewMode}
            searchWorkflows={searchWorkflows}
            onSearchQueryChange={handleContentSearchChange}
            activeExternalSearch={activeExternalSearch}
            onActivateExternalSearch={setActiveExternalSearch}
            onExecuteExternalSearch={handleExecuteExternalSearch}
          />
        ) : displayMode === 'masonry' ? (
          <ContentMasonry
            groupId={currentGroup?.id || ''}
            userId={user?.id}
            newContent={newContent}
            parentContentId={currentParentId}
            onNavigate={handleNavigate}
            searchQuery={searchQuery}
            isSearching={isSearching}
            selection={contentSelection}
            showInput={showInput}
            onInputClose={handleInputClose}
            onContentAdded={handleContentAdded}
            viewMode={viewMode}
            searchWorkflows={searchWorkflows}
            onSearchQueryChange={handleContentSearchChange}
            activeExternalSearch={activeExternalSearch}
            onActivateExternalSearch={setActiveExternalSearch}
            onExecuteExternalSearch={handleExecuteExternalSearch}
            selectedTagFilter={selectedTagFilter}
          />
        ) : displayMode === 'deck' ? (
          <ContentDeck
            groupId={currentGroup?.id || ''}
            userId={user?.id}
            newContent={newContent}
            parentContentId={currentParentId}
            onNavigate={handleNavigate}
            searchQuery={searchQuery}
            isSearching={isSearching}
            selection={contentSelection}
            showInput={showInput}
            onInputClose={handleInputClose}
            onContentAdded={handleContentAdded}
            viewMode={viewMode}
            searchWorkflows={searchWorkflows}
            onSearchQueryChange={handleContentSearchChange}
            activeExternalSearch={activeExternalSearch}
            onActivateExternalSearch={setActiveExternalSearch}
            onExecuteExternalSearch={handleExecuteExternalSearch}
            selectedTagFilter={selectedTagFilter}
          />
        ) : (
          <ContentList
            groupId={currentGroup?.id || ''}
            userId={user?.id}
            newContent={newContent}
            parentContentId={currentParentId}
            onNavigate={handleNavigate}
            searchQuery={searchQuery}
            isSearching={isSearching}
            selection={contentSelection}
            showInput={showInput}
            onInputClose={handleInputClose}
            onContentAdded={handleContentAdded}
            viewMode={viewMode}
            searchWorkflows={searchWorkflows}
            onSearchQueryChange={handleContentSearchChange}
            activeExternalSearch={activeExternalSearch}
            onActivateExternalSearch={setActiveExternalSearch}
            onExecuteExternalSearch={handleExecuteExternalSearch}
            selectedTagFilter={selectedTagFilter}
          />
        )}
      </div>

      {/* Content Input - Always visible when group is selected and not in JS view */}
      {currentGroup && !currentJsContent && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <ContentInput
            groupId={currentGroup.id}
            parentContentId={currentParentId}
            onContentAdded={handleContentAdded}
            onNavigate={handleNavigate}
            onActionSelect={(action) => {
              if (action === 'import') {
                setShowSpotifyModal(true);
              }
            }}
            workflowActions={workflowActions}
            selectedCount={contentSelection.selectedCount}
            isSelectionMode={contentSelection.isSelectionMode}
            availableTags={availableTags}
          />
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <GroupSelector
          currentGroup={currentGroup}
          onGroupChange={(group) => {
            handleGroupChange(group);
            setShowGroupModal(false);
          }}
          initialMode={groupModalMode}
          initialShowModal={true}
          onModalClose={() => setShowGroupModal(false)}
        />
      )}

      {/* Global Error Toast */}
      {error && user && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-white hover:text-red-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Micro-game overlay during workflow operations */}
      <MicroGameOverlay
        isVisible={showGameOverlay}
        operationName={currentOperation}
        onClose={() => setShowGameOverlay(false)}
      />

      {/* SEO Progress Overlay */}
      <SEOProgressOverlay
        isVisible={showSEOProgress}
        selectedContent={selectedContentForSEO}
        progressItems={seoProgressItems}
        onClose={handleCloseSEOProgress}
      />

      {/* Markdown Progress Overlay */}
      <MarkdownProgressOverlay
        isVisible={showMarkdownProgress}
        selectedContent={selectedContentForMarkdown}
        progressItems={markdownProgressItems}
        onClose={handleCloseMarkdownProgress}
      />

      {/* YouTube Progress Overlay */}
      <YouTubeProgressOverlay
        isVisible={showYouTubeProgress}
        selectedContent={selectedContentForYouTube}
        progressItems={youTubeProgressItems}
        onClose={handleCloseYouTubeProgress}
      />

      {/* TMDb Search Modal */}
      {selectedContentForTMDb && (
        <TMDbSearchModal
          isVisible={showTMDbModal}
          selectedContent={selectedContentForTMDb}
          searchQuery={tmdbSearchQuery}
          onClose={handleCloseTMDbModal}
          onResultsAdded={handleTMDbResultsAdded}
        />
      )}

      {/* Libgen Search Modal */}
      <LibgenSearchModal
        isVisible={showLibgenModal}
        selectedContent={selectedContentForLibgen}
        searchResults={libgenSearchResults}
        isSearching={isLibgenSearching}
        onClose={handleCloseLibgenModal}
        onSearch={handleLibgenSearchExecute}
        onAddSelected={handleAddSelectedLibgenBooks}
      />

      {/* Send to Group Modal */}
      <SendToGroupModal
        isVisible={showSendToGroupModal}
        groups={groups}
        currentGroupId={currentGroup?.id || ''}
        selectedCount={contentSelection.selectedCount}
        onClose={() => setShowSendToGroupModal(false)}
        onSend={handleSendToGroup}
        isLoading={isSendingToGroup}
      />

      {/* Sharing Settings Modal */}
      <SharingSettingsModal
        isVisible={showSharingModal}
        content={currentContentForSharing}
        onClose={handleCloseSharingModal}
      />

      {/* LLM Prompt Modal */}
      <LLMPromptModal
        isVisible={showLLMPromptModal}
        selectedContent={selectedContentForLLM}
        groupId={currentGroup?.id || ''}
        parentContentId={currentParentId}
        onClose={handleCloseLLMPromptModal}
        onContentGenerated={handleLLMContentGenerated}
      />

      {/* Claude Code Prompt Modal */}
      <ClaudeCodePromptModal
        isVisible={showClaudeCodeModal}
        selectedContent={selectedContentForClaudeCode}
        groupId={currentGroup?.id || ''}
        parentContentId={currentParentId}
        onClose={handleCloseClaudeCodeModal}
        onContentGenerated={handleClaudeCodeContentGenerated}
      />

      {/* Spotify Playlist Import Modal */}
      {currentGroup && (
        <SpotifyPlaylistModal
          isVisible={showSpotifyModal}
          groupId={currentGroup.id}
          onClose={handleCloseSpotifyModal}
          onPlaylistImported={handleSpotifyPlaylistImported}
        />
      )}

          {/* Footer */}
          <Footer />
            </>
          )}
        </>
      )}
    </div>
  );
};
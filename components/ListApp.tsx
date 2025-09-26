import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getFastSession } from './SupabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { UserAuth } from './UserAuth';
import { GroupSelector } from './GroupSelector';
import { ContentList } from './ContentList';
import { ContentInput } from './ContentInput';
import { JsEditorView } from './JsEditorView';
import { AppSidebar } from './AppSidebar';
import { FloatingActionButton } from './FloatingActionButton';
import { WorkflowFAB } from './WorkflowFAB';
import { MicroGameOverlay } from './MicroGameOverlay';
import { SEOProgressOverlay, SEOProgressItem } from './SEOProgressOverlay';
import { SharingSettingsModal } from './SharingSettingsModal';
import { GroupDropdown } from './GroupDropdown';
import { AppSkeleton, HeaderSkeleton, ContentListSkeleton } from './SkeletonComponents';
import { Footer } from './Footer';
import { LLMPromptModal } from './LLMPromptModal';
import { Group, Content, contentRepository } from './ContentRepository';
import { useGroupsQuery, useCreateGroupMutation, useJoinGroupMutation } from '../hooks/useGroupQueries';
import { useBulkDeleteContentMutation } from '../hooks/useContentQueries';
import { useContentSelection } from '../hooks/useContentSelection';
import { useSEOExtraction } from '../hooks/useSEOExtraction';
import { useToast } from './ToastProvider';

// Simplified app loading states to prevent rapid transitions
type AppLoadingState = 'loading' | 'ready' | 'error';

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

  // Standard React state management - no defensive programming needed
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [newContent, setNewContent] = useState<Content | undefined>();
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [currentJsContent, setCurrentJsContent] = useState<Content | null>(null);
  const [navigationStack, setNavigationStack] = useState<Array<{id: string | null, name: string}>>([{id: null, name: 'Root'}]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'join'>('create');

  // React Query hooks - only enable when we have user and app is ready for data loading
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useGroupsQuery({ 
    enabled: !!user && (appState === 'loading-data' || appState === 'ready')
  });
  const createGroupMutation = useCreateGroupMutation();
  const joinGroupMutation = useJoinGroupMutation();
  const bulkDeleteMutation = useBulkDeleteContentMutation();
  const seoExtractionMutation = useSEOExtraction();
  
  // Search state  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
  
  // Sharing settings modal state
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [currentContentForSharing, setCurrentContentForSharing] = useState<Content | null>(null);

  // LLM Prompt modal state
  const [showLLMPromptModal, setShowLLMPromptModal] = useState(false);
  const [selectedContentForLLM, setSelectedContentForLLM] = useState<Content[]>([]);
  
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
      await bulkDeleteMutation.mutateAsync(selectedIds);

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

  const handleCloseSEOProgress = () => {
    setShowSEOProgress(false);
    setSeoProgressItems([]);
    setSelectedContentForSEO([]);
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
  
  // Define available workflow actions
  const workflowActions = [
    {
      id: 'llm-generate',
      name: 'Generate with AI',
      description: 'Use AI to generate content from selection',
      icon: '🤖',
      onClick: () => {
        console.log('🤖 WorkflowAction onClick triggered for LLM generation');
        handleLLMGeneration();
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
      id: 'bulk-delete',
      name: 'Delete Items',
      description: 'Delete selected items',
      icon: '🗑️',
      onClick: handleBulkDelete
    }
  ];

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


  // Auto-select first group when groups are loaded
  useEffect(() => {
    if (!currentGroup && groups.length > 0) {
      setCurrentGroup(groups[0]);
    }
  }, [groups, currentGroup]);

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

  const handleFABClick = () => {
    setShowInput(true);
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
          // Check if this is JS content - if so, show the JS editor view
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

        // User is authenticated, try to join the group
        try {
          setError(null);
          console.log(`Attempting to join group with code: ${joinCode}`);
          const group = await joinGroupMutation.mutateAsync(joinCode);

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
  }, [user, navigate, joinGroupMutation]);

  // Stable container pattern - always return same structure, conditionally show content
  return (
    <div data-testid="main-app" className="min-h-screen bg-gray-50 flex flex-col transition-all duration-200 ease-in-out">
      
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
      {(appState === 'loading' || (joinGroupMutation.isPending && window.location.pathname.startsWith('/invite/'))) && (
        <AppSkeleton />
      )}

      {/* Main App Content */}
      {appState === 'ready' && user && (
        <>
          {/* Header */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              {/* Hamburger Menu */}
              <button
                data-testid="sidebar-toggle"
                onClick={() => setShowSidebar(true)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <GroupDropdown
                currentGroup={currentGroup}
                groups={groups}
                onGroupChange={handleGroupChange}
                isLoading={groupsLoading}
              />
            </div>
            
            {/* Search Bar */}
            {currentGroup && (
              <div className="flex-1 max-w-md mx-2 sm:mx-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full px-3 sm:px-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearching(false);
                        if (searchTimeoutRef.current) {
                          clearTimeout(searchTimeoutRef.current);
                        }
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
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
              {/* User info - responsive layout */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                {/* Show email only on larger screens */}
                <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-32">
                  {user.email}
                </span>
                {/* User avatar on mobile */}
                <div className="w-6 h-6 sm:hidden bg-gray-400 rounded-full flex items-center justify-center">
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

          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-sm transition-all duration-200 ease-in-out">
            {/* Back Button Navigation */}
            {currentGroup && navigationStack.length > 1 && (
              <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-2">
                <button
                  onClick={() => handleNavigate(navigationStack[navigationStack.length - 2]?.id || null)}
                  className="flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>
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
          />
        ) : (
          <>
            {/* FAB Content Input - Only show for regular content view */}
            <ContentInput
              groupId={currentGroup?.id || ''}
              parentContentId={currentParentId}
              onContentAdded={handleContentAdded}
              isVisible={showInput}
              onClose={handleInputClose}
            />
            
            <ContentList
              groupId={currentGroup?.id || ''}
              newContent={newContent}
              parentContentId={currentParentId}
              onNavigate={handleNavigate}
              searchQuery={searchQuery}
              isSearching={isSearching}
              selection={contentSelection}
            />
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={handleFABClick}
        isVisible={!!currentGroup && !showInput}
      />

      {/* Workflow FAB for selected items */}
      <WorkflowFAB
        isVisible={contentSelection.isSelectionMode && contentSelection.selectedCount > 0}
        actions={workflowActions}
        selectedCount={contentSelection.selectedCount}
      />

      {/* Sidebar */}
      <AppSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        currentGroup={currentGroup}
        groups={groups}
        onGroupChange={handleGroupChange}
        onCreateGroup={handleCreateGroup}
        onJoinGroup={handleJoinGroup}
        isLoading={groupsLoading || createGroupMutation.isPending || joinGroupMutation.isPending}
      />

      {/* Group Modal */}
      {showGroupModal && (
        <GroupSelector
          currentGroup={currentGroup}
          onGroupChange={(group) => {
            handleGroupChange(group);
            setShowGroupModal(false);
          }}
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

          {/* Footer */}
          <Footer />
        </>
      )}
    </div>
  );
};
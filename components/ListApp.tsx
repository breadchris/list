import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, getFastSession } from './SupabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { UserAuth } from './UserAuth';
import { GroupSelector } from './GroupSelector';
import { ContentList } from './ContentList';
import { ContentInput } from './ContentInput';
import { AppSidebar } from './AppSidebar';
import { FloatingActionButton } from './FloatingActionButton';
import { WorkflowFAB } from './WorkflowFAB';
import { MicroGameOverlay } from './MicroGameOverlay';
import { SEOProgressOverlay, SEOProgressItem } from './SEOProgressOverlay';
import { SharingSettingsModal } from './SharingSettingsModal';
import { GroupDropdown } from './GroupDropdown';
import { Group, Content, contentRepository } from './ContentRepository';
import { useGroupsQuery, useCreateGroupMutation, useJoinGroupMutation } from '../hooks/useGroupQueries';
import { useContentSelection } from '../hooks/useContentSelection';
import { useSEOExtraction } from '../hooks/useSEOExtraction';
import { useToast } from './ToastProvider';

export const ListApp: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Standard React state management - no defensive programming needed
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [newContent, setNewContent] = useState<Content | undefined>();
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<Array<{id: string | null, name: string}>>([{id: null, name: 'Root'}]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'join'>('create');

  // React Query hooks
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useGroupsQuery({ enabled: !!user });
  const createGroupMutation = useCreateGroupMutation();
  const joinGroupMutation = useJoinGroupMutation();
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
  
  const handleBulkDelete = async () => {
    // TODO: Implement bulk delete workflow
    console.log('Bulk delete for selected items:', contentSelection.selectedItems);
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
  
  // Define available workflow actions
  const workflowActions = [
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
  
  console.log('WorkflowActions initialized:', workflowActions.map(a => ({ id: a.id, name: a.name })));

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Auth state listener - stable reference, no recreation cycles
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      // Skip token refresh events
      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      // Defer all state updates to next event loop tick to avoid DOM timing conflicts
      setTimeout(async () => {
        try {
          if (session?.user && session.user.id !== user?.id) {
            setUser(session.user);
            setError(null);
            
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
              await handleUserInitialization(session.user.id);
              await handlePendingInvite();
            }
          } else if (!session?.user && event === 'SIGNED_OUT') {
            setUser(null);
            setCurrentGroup(null);
            setError(null);
            sessionStorage.removeItem('pendingInviteCode');
          }
          
          setAuthChecked(true);
          setLoading(false);
        } catch (error) {
          console.error('Auth state change error:', error);
          setError('Authentication error occurred');
        }
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    setLoading(false);
    setAuthChecked(true);
    
    try {
      const session = await getFastSession();
      if (session?.user) {
        setUser(session.user);
        handleUserInitialization(session.user.id).catch(console.error);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  };

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
      
      // Use setTimeout to defer DOM operation until after React updates
      setTimeout(() => {
        window.history.replaceState(null, '', `/group/${group.id}`);
      }, 0);
      
      toast.success('Joined group!', `Welcome to "${group.name}".`);
    } catch (error) {
      console.error('Error joining group after auth:', error);
      sessionStorage.removeItem('pendingInviteCode');
      toast.error('Failed to join group', 'The invite code may be invalid or expired.');
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
    // Navigate to the new group's root URL
    window.history.pushState(null, '', `/group/${group.id}`);
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
    if (parentId === currentParentId) return;
    
    // Close input when navigating
    setShowInput(false);
    
    if (parentId === null) {
      // Navigate to root
      setCurrentParentId(null);
      setNavigationStack([{id: null, name: 'Root'}]);
      // Update URL to group root
      if (currentGroup) {
        window.history.pushState(null, '', `/group/${currentGroup.id}`);
      }
    } else {
      try {
        // Get the content item to navigate to
        const parentContent = await contentRepository.getContentById(parentId);
        if (parentContent) {
          setCurrentParentId(parentId);
          // Add to navigation stack
          const newStack = [...navigationStack, {id: parentId, name: parentContent.data.substring(0, 30)}];
          setNavigationStack(newStack);
          // Update URL to new pattern
          if (currentGroup) {
            window.history.pushState(null, '', `/group/${currentGroup.id}/content/${parentId}`);
          }
        }
      } catch (error) {
        console.error('Error navigating to content:', error);
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const targetItem = navigationStack[index];
    setCurrentParentId(targetItem.id);
    setNavigationStack(navigationStack.slice(0, index + 1));
    setShowInput(false); // Close input when navigating via breadcrumbs
    
    // Update URL with new pattern
    if (currentGroup) {
      if (targetItem.id === null) {
        window.history.pushState(null, '', `/group/${currentGroup.id}`);
      } else {
        window.history.pushState(null, '', `/group/${currentGroup.id}/content/${targetItem.id}`);
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

  // Reset navigation and search when group changes
  useEffect(() => {
    if (currentGroup) {
      setCurrentParentId(null);
      setNavigationStack([{id: null, name: 'Root'}]);
      setShowInput(false); // Close input when switching groups
      // Clear search
      setSearchQuery('');
      setIsSearching(false);
      // Clear content selection
      contentSelection.clearSelection();
      // Set URL to new group without content path
      window.history.pushState(null, '', `/group/${currentGroup.id}`);
    }
  }, [currentGroup]);

  // Handle URL navigation on page load and browser navigation
  useEffect(() => {
    const handleInitialNavigation = async () => {
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
          const group = await joinGroupMutation.mutateAsync(joinCode);
          setCurrentGroup(group);
          // Clear any stored invite code
          sessionStorage.removeItem('pendingInviteCode');
          // Redirect to the group page after successful join
          window.history.replaceState(null, '', `/group/${group.id}`);
          return;
        } catch (error) {
          console.error('Error joining group from invite:', error);
          setError('Failed to join group. The invite code may be invalid or expired.');
          // Clear stored invite code on error
          sessionStorage.removeItem('pendingInviteCode');
          // Redirect to root on error
          window.history.replaceState(null, '', '/');
          return;
        }
      }
      
      // Parse URL pattern: /group/<group-id>/content/<content-id> or /group/<group-id>
      const groupMatch = pathname.match(/^\/group\/([^\/]+)(?:\/content\/([^\/]+))?$/);
      
      if (groupMatch) {
        const [, groupId, contentId] = groupMatch;
        
        // If URL specifies a different group than current, switch to it
        if (currentGroup && currentGroup.id !== groupId) {
          const targetGroup = groups.find(g => g.id === groupId);
          if (targetGroup) {
            setCurrentGroup(targetGroup);
            return; // Let the group change effect handle the rest
          }
        }
        
        // Handle content navigation within the current group
        if (contentId && currentGroup && currentGroup.id === groupId) {
          try {
            const content = await contentRepository.getContentById(contentId);
            if (content) {
              setCurrentParentId(contentId);
              setNavigationStack([
                {id: null, name: 'Root'},
                {id: contentId, name: content.data.substring(0, 30)}
              ]);
            }
          } catch (error) {
            console.error('Error loading content from URL:', error);
          }
        }
      }
    };

    // Run navigation handling for authenticated users
    // For invite URLs, we don't need to wait for currentGroup
    // For regular group URLs, we need groups to be loaded
    if (user && (window.location.pathname.startsWith('/invite/') || (currentGroup && groups.length > 0))) {
      handleInitialNavigation();
    }

    // Handle browser back/forward navigation
    const handlePopState = () => {
      if (user && (window.location.pathname.startsWith('/invite/') || (currentGroup && groups.length > 0))) {
        handleInitialNavigation();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentGroup, groups, user, joinGroupMutation]);

  // Only show loading for invite joining, never block for auth check
  if (joinGroupMutation.isPending && window.location.pathname.startsWith('/invite/')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Joining group...</p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                initializeAuth();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <UserAuth onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              {/* Hamburger Menu */}
              <button
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

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-sm">
        {/* Breadcrumb Navigation */}
        {currentGroup && navigationStack.length > 1 && (
          <div className="bg-gray-50 border-b border-gray-200 px-3 sm:px-4 py-2">
            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm overflow-x-auto">
              {navigationStack.map((item, index) => (
                <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                  {index > 0 && (
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`hover:text-blue-600 transition-colors whitespace-nowrap touch-manipulation px-1 py-0.5 rounded ${
                      index === navigationStack.length - 1 
                        ? 'text-gray-900 font-medium' 
                        : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    {item.name}
                  </button>
                </div>
              ))}
            </div>
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

        {/* FAB Content Input */}
        <ContentInput
          groupId={currentGroup?.id || ''}
          parentContentId={currentParentId}
          onContentAdded={handleContentAdded}
          isVisible={showInput}
          onClose={handleInputClose}
        />

        {/* Content List */}
        <ContentList
          groupId={currentGroup?.id || ''}
          newContent={newContent}
          parentContentId={currentParentId}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          isSearching={isSearching}
          selection={contentSelection}
        />
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={handleFABClick}
        isVisible={!!currentGroup && !showInput}
      />

      {/* Workflow FAB for selected items */}
      <WorkflowFAB
        isVisible={(() => {
          const isVisible = contentSelection.isSelectionMode && contentSelection.selectedCount > 0;
          console.log('WorkflowFAB visibility check:', {
            isSelectionMode: contentSelection.isSelectionMode,
            selectedCount: contentSelection.selectedCount,
            isVisible
          });
          return isVisible;
        })()}
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
    </div>
  );
};
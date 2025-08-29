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
import { GroupDropdown } from './GroupDropdown';
import { Group, Content, contentRepository } from './ContentRepository';
import { useGroupsQuery, useCreateGroupMutation, useJoinGroupMutation } from '../hooks/useGroupQueries';
import { useContentSelection } from '../hooks/useContentSelection';
import { useSEOExtraction } from '../hooks/useSEOExtraction';

export const ListApp: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  
  // Micro-game overlay state
  const [showGameOverlay, setShowGameOverlay] = useState(false);
  const [currentOperation, setCurrentOperation] = useState('');
  
  // Workflow action handlers
  const handleSEOExtraction = async () => {
    const selectedIds = Array.from(contentSelection.selectedItems);
    if (selectedIds.length === 0) return;

    try {
      // Show micro-game overlay during processing
      setCurrentOperation('SEO Extraction');
      setShowGameOverlay(true);
      
      const results = await seoExtractionMutation.mutateAsync(selectedIds);
      
      // Hide game overlay
      setShowGameOverlay(false);
      
      // Show results summary
      const totalUrls = results.reduce((sum, r) => sum + r.total_urls_found, 0);
      const processedUrls = results.reduce((sum, r) => sum + r.urls_processed, 0);
      
      alert(`SEO extraction completed!\nProcessed ${processedUrls}/${totalUrls} URLs from ${selectedIds.length} items.`);
      
      // Clear selection after successful operation
      contentSelection.clearSelection();
    } catch (error) {
      console.error('SEO extraction failed:', error);
      setShowGameOverlay(false);
      alert('SEO extraction failed. Please try again.');
    }
  };
  
  const handleBulkDelete = async () => {
    // TODO: Implement bulk delete workflow
    console.log('Bulk delete for selected items:', contentSelection.selectedItems);
  };
  
  // Define available workflow actions
  const workflowActions = [
    {
      id: 'seo-extract',
      name: 'Extract SEO',
      description: 'Extract SEO metadata from links',
      icon: '🔍',
      onClick: handleSEOExtraction
    },
    {
      id: 'bulk-delete',
      name: 'Delete Items',
      description: 'Delete selected items',
      icon: '🗑️',
      onClick: handleBulkDelete
    }
  ];

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // First, check for existing session (faster than getUser)
      const session = await getFastSession();

      if (session?.user) {
        setUser(session.user);
        setAuthChecked(true);
        setLoading(false); // Show UI immediately
        
        // Run profile creation and group loading in parallel
        await handleUserInitialization(session.user.id);
      } else {
        setLoading(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setError('Failed to initialize authentication');
      setLoading(false);
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (session?.user && session.user.id !== user?.id) {
        setUser(session.user);
        setError(null);
        await handleUserInitialization(session.user.id);
      } else if (!session?.user) {
        setUser(null);
        setCurrentGroup(null);
        setError(null);
      }
      
      setAuthChecked(true);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  };

  const handleUserInitialization = async (userId: string) => {
    setError(null);
    
    try {
      // Only handle profile creation - React Query will handle groups
      await contentRepository.createOrUpdateUser(userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setError('Failed to initialize user profile');
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
      setCurrentGroup(group);
      setShowGroupModal(false);
    } catch (error) {
      console.error('Error joining group:', error);
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
  }, [currentGroup, contentSelection]);

  // Handle URL navigation on page load and browser navigation
  useEffect(() => {
    const handleInitialNavigation = async () => {
      const pathname = window.location.pathname;
      
      // Check for invite URL pattern: /invite/<code>
      const inviteMatch = pathname.match(/^\/invite\/([^\/]+)$/);
      if (inviteMatch) {
        const [, joinCode] = inviteMatch;
        try {
          setError(null);
          const group = await joinGroupMutation.mutateAsync(joinCode);
          setCurrentGroup(group);
          // Redirect to the group page after successful join
          window.history.replaceState(null, '', `/group/${group.id}`);
          return;
        } catch (error) {
          console.error('Error joining group from invite:', error);
          setError('Failed to join group. The invite code may be invalid or expired.');
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

  // Show loading for initial auth check or invite joining
  if ((loading && !authChecked) || (joinGroupMutation.isPending && window.location.pathname.startsWith('/invite/'))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">
            {joinGroupMutation.isPending ? 'Joining group...' : 'Checking authentication...'}
          </p>
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
            <div className="flex items-center space-x-3 flex-shrink-0">
              {/* Hamburger Menu */}
              <button
                onClick={() => setShowSidebar(true)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="flex-1 max-w-md mx-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full px-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-4 flex-shrink-0">
              {(groupsLoading || createGroupMutation.isPending || joinGroupMutation.isPending) && (
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              )}
              {currentGroup && !isSearching && (
                <button
                  onClick={contentSelection.toggleSelectionMode}
                  className={`text-sm px-2 py-1 rounded-md transition-colors ${
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
              <span className="text-sm text-gray-600">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
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
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
            <div className="flex items-center space-x-2 text-sm">
              {navigationStack.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`hover:text-blue-600 transition-colors ${
                      index === navigationStack.length - 1 
                        ? 'text-gray-900 font-medium' 
                        : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Selection Header */}
        {contentSelection.isSelectionMode && currentGroup && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-900">
                  {contentSelection.selectedCount} item{contentSelection.selectedCount !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => contentSelection.selectAll([])} // Will be updated when we have currentItems
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
            setGroups(prev => prev.some(g => g.id === group.id) ? prev : [group, ...prev]);
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
    </div>
  );
};
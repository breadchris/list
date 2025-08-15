import React, { useState, useEffect } from 'react';
import { supabase, getCurrentUser } from '../data/SupabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { UserAuth } from './UserAuth';
import { GroupSelector } from './GroupSelector';
import { ContentList } from './ContentList';
import { ContentInput } from './ContentInput';
import { Group, Content, contentRepository } from '../data/ContentRepository';

export const ListApp: React.FC = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [newContent, setNewContent] = useState<Content | undefined>();

  useEffect(() => {
    // Check for existing session
    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        setUser(session.user);
        
        // Create or update user profile
        try {
          await contentRepository.createOrUpdateUser(session.user.id);
        } catch (error) {
          console.error('Error creating user profile:', error);
        }
      } else {
        setUser(null);
        setCurrentGroup(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        // Create or update user profile
        await contentRepository.createOrUpdateUser(currentUser.id);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">List App</h1>
          <div className="flex items-center space-x-4">
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
      </header>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-sm">
        {/* Group Selector */}
        <GroupSelector
          currentGroup={currentGroup}
          onGroupChange={setCurrentGroup}
        />

        {/* Content List */}
        <ContentList
          groupId={currentGroup?.id || ''}
          newContent={newContent}
        />

        {/* Content Input */}
        {currentGroup && (
          <ContentInput
            groupId={currentGroup.id}
            onContentAdded={handleContentAdded}
          />
        )}
      </div>
    </div>
  );
};
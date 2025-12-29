'use client';

/**
 * Share page route - P2P file sharing with group selection
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Share2, Users, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SharePage } from '@/components/share/SharePage';
import { useGlobalGroup } from '@/components/GlobalGroupContext';
import { supabase } from '@/lib/list/SupabaseClient';
import type { User } from '@supabase/supabase-js';

export default function ShareRoutePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Use global group context
  const { selectedGroup, setSelectedGroup, groups, isLoading: groupsLoading } = useGlobalGroup();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsAuthLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Get user display name
  const userName = user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Share2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">P2P File Sharing</h1>
          <p className="text-muted-foreground mb-6">
            Share files directly with your group members. Files transfer peer-to-peer,
            so both users need to be online at the same time.
          </p>
          <Button onClick={() => router.push('/')} size="lg">
            <LogIn className="w-4 h-4 mr-2" />
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  // Loading groups
  if (groupsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-4" />
        <p className="text-sm text-muted-foreground">Loading your groups...</p>
      </div>
    );
  }

  // No groups
  if (!groups || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">No Groups Yet</h1>
          <p className="text-muted-foreground mb-6">
            You need to be in a group to share files. Create or join a group first.
          </p>
          <Button onClick={() => router.push('/')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // No group selected (shouldn't happen due to auto-select, but safety check)
  if (!selectedGroup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Select a group to start sharing</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg">
                <Users className="w-4 h-4 mr-2" />
                Select Group
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {groups.map(group => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                >
                  {group.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  // Main share page with group selector in header
  return (
    <div className="flex flex-col h-screen">
      {/* Custom header with group selector */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Share2 className="w-5 h-5 text-primary" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="font-semibold">
                {selectedGroup.name}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {groups.map(group => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={group.id === selectedGroup.id ? 'bg-accent' : ''}
                >
                  {group.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="text-sm text-muted-foreground">
          {userName}
        </div>
      </header>

      {/* Share page content (without its own header) */}
      <div className="flex-1 overflow-hidden">
        <SharePageContent
          key={selectedGroup.id} // Re-mount when group changes
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          userId={user.id}
          userName={userName}
        />
      </div>
    </div>
  );
}

/**
 * Share page content without the header (header is in parent)
 */
function SharePageContent({
  groupId,
  groupName,
  userId,
  userName,
}: {
  groupId: string;
  groupName: string;
  userId: string;
  userName: string;
}) {
  return (
    <SharePage
      groupId={groupId}
      groupName={groupName}
      userId={userId}
      userName={userName}
    />
  );
}

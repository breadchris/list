import React, { useMemo } from 'react';
import Tree from 'react-d3-tree';
import { InviteGraphNode } from '@/lib/list/ContentRepository';
import { useInviteGraphQuery } from '@/hooks/list/useGroupQueries';

interface InviteTreeVisualizationProps {
  groupId: string;
}

interface TreeNode {
  name: string;
  attributes?: {
    userId: string;
    joinedAt: string;
    inviteCode?: string;
    inviteCount: number;
  };
  children?: TreeNode[];
}

export const InviteTreeVisualization: React.FC<InviteTreeVisualizationProps> = ({ groupId }) => {
  // Fetch invite graph data
  const { data: inviteGraph, isLoading, error } = useInviteGraphQuery(groupId, { enabled: !!groupId });

  // Transform flat invite graph into hierarchical tree structure
  const treeData = useMemo(() => {
    if (!inviteGraph || inviteGraph.length === 0) {
      return null;
    }

    // Create a map of userId -> TreeNode
    const nodeMap = new Map<string, TreeNode>();
    const inviteCountMap = new Map<string, number>();

    // Count how many people each user invited
    inviteGraph.forEach(edge => {
      const count = inviteCountMap.get(edge.inviter_user_id) || 0;
      inviteCountMap.set(edge.inviter_user_id, count + 1);
    });

    // Create nodes for all users involved
    const allInviters = new Set(inviteGraph.map(edge => edge.inviter_user_id));
    const allInvitees = new Set(inviteGraph.map(edge => edge.invitee_user_id));

    // Find root nodes (users who invited others but weren't invited themselves)
    const rootUserIds = Array.from(allInviters).filter(id => !allInvitees.has(id));

    // If no root users, the data might be incomplete or circular
    if (rootUserIds.length === 0 && inviteGraph.length > 0) {
      // Use the earliest inviter as root
      const earliest = inviteGraph.sort((a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      )[0];
      rootUserIds.push(earliest.inviter_user_id);
    }

    // Helper function to build tree recursively
    const buildTree = (userId: string, visited = new Set<string>()): TreeNode | null => {
      // Prevent infinite loops in case of circular references
      if (visited.has(userId)) {
        return null;
      }
      visited.add(userId);

      // Find the user's information from the edges
      const userEdge = inviteGraph.find(edge => edge.inviter_user_id === userId);
      const inviteeEdge = inviteGraph.find(edge => edge.invitee_user_id === userId);

      const username = userEdge?.inviter_username || inviteeEdge?.invitee_username;
      const displayName = username || `User ${userId.substring(0, 8)}`;

      const node: TreeNode = {
        name: displayName,
        attributes: {
          userId: userId,
          joinedAt: inviteeEdge?.joined_at || 'Group Creator',
          inviteCode: inviteeEdge?.invite_code_used,
          inviteCount: inviteCountMap.get(userId) || 0
        }
      };

      // Find all users invited by this user
      const invitees = inviteGraph.filter(edge => edge.inviter_user_id === userId);

      if (invitees.length > 0) {
        node.children = invitees
          .map(edge => buildTree(edge.invitee_user_id, new Set(visited)))
          .filter((child): child is TreeNode => child !== null);
      }

      return node;
    };

    // Build trees for all root users
    const trees = rootUserIds
      .map(userId => buildTree(userId))
      .filter((tree): tree is TreeNode => tree !== null);

    // If multiple root trees, wrap them in a single root
    if (trees.length === 0) {
      return null;
    } else if (trees.length === 1) {
      return trees[0];
    } else {
      return {
        name: `${groupId.substring(0, 8)} Group`,
        attributes: {
          userId: 'root',
          joinedAt: '',
          inviteCount: trees.length
        },
        children: trees
      };
    }
  }, [inviteGraph, groupId]);

  // Custom node rendering function
  const renderCustomNode = ({ nodeDatum }: any) => {
    const isRoot = nodeDatum.attributes?.userId === 'root';

    return (
      <g>
        {/* Node rectangle */}
        <rect
          width={200}
          height={isRoot ? 60 : 100}
          x={-100}
          y={isRoot ? -30 : -50}
          rx={8}
          fill={isRoot ? '#3B82F6' : '#FFFFFF'}
          stroke={isRoot ? '#1E40AF' : '#E5E7EB'}
          strokeWidth={2}
        />

        {/* Node name */}
        <text
          fill={isRoot ? '#FFFFFF' : '#111827'}
          x={0}
          y={isRoot ? 5 : -25}
          textAnchor="middle"
          fontWeight="600"
          fontSize="14"
        >
          {nodeDatum.name}
        </text>

        {!isRoot && (
          <>
            {/* Joined date */}
            <text
              fill="#6B7280"
              x={0}
              y={0}
              textAnchor="middle"
              fontSize="11"
            >
              {nodeDatum.attributes?.joinedAt === 'Group Creator'
                ? nodeDatum.attributes.joinedAt
                : new Date(nodeDatum.attributes?.joinedAt).toLocaleDateString()}
            </text>

            {/* Invite code if available */}
            {nodeDatum.attributes?.inviteCode && (
              <text
                fill="#9CA3AF"
                x={0}
                y={18}
                textAnchor="middle"
                fontSize="10"
                fontFamily="monospace"
              >
                Code: {nodeDatum.attributes.inviteCode}
              </text>
            )}

            {/* Number of invites */}
            {nodeDatum.attributes?.inviteCount > 0 && (
              <text
                fill="#10B981"
                x={0}
                y={36}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
              >
                {nodeDatum.attributes.inviteCount} invite{nodeDatum.attributes.inviteCount !== 1 ? 's' : ''}
              </text>
            )}
          </>
        )}
      </g>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Failed to Load Invite Tree</h3>
          <p className="mt-2 text-sm text-gray-600">Could not fetch invitation data.</p>
        </div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Invitations Yet</h3>
          <p className="mt-2 text-sm text-gray-600">
            This group doesn't have any recorded invitations yet.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Start inviting people to see the invitation tree!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Info banner */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 text-sm text-blue-900">
            <strong>How to use:</strong> Drag to pan, scroll to zoom, click nodes to expand/collapse branches.
          </div>
        </div>
      </div>

      {/* Tree container */}
      <div className="border border-gray-200 rounded-lg bg-gray-50" style={{ width: '100%', height: '600px' }}>
        <Tree
          data={treeData}
          orientation="horizontal"
          pathFunc="step"
          translate={{ x: 100, y: 300 }}
          separation={{ siblings: 1.5, nonSiblings: 2 }}
          nodeSize={{ x: 250, y: 150 }}
          renderCustomNodeElement={renderCustomNode}
          zoom={0.8}
          enableLegacyTransitions={true}
          transitionDuration={500}
        />
      </div>
    </div>
  );
};

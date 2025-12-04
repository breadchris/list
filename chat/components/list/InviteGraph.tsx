import React, { useMemo } from 'react';
import { InviteGraphNode } from '@/lib/list/ContentRepository';
import { useInviteGraphQuery } from '@/hooks/list/useGroupQueries';

interface InviteGraphProps {
  groupId: string;
  className?: string;
}

interface GraphNode {
  id: string;
  username: string;
  level: number;
  invited_by?: string;
  children: GraphNode[];
}

export const InviteGraph: React.FC<InviteGraphProps> = ({ groupId, className = '' }) => {
  const { data: inviteData, isLoading, error } = useInviteGraphQuery(groupId);

  const graphData = useMemo(() => {
    if (!inviteData || inviteData.length === 0) return [];

    const nodeMap = new Map<string, GraphNode>();

    // First, create all nodes
    inviteData.forEach((invite: InviteGraphNode) => {
      // Add inviter if not exists
      if (!nodeMap.has(invite.inviter_user_id)) {
        nodeMap.set(invite.inviter_user_id, {
          id: invite.inviter_user_id,
          username: invite.inviter_username || 'Unknown User',
          level: 0,
          children: []
        });
      }

      // Add invitee if not exists
      if (!nodeMap.has(invite.invitee_user_id)) {
        nodeMap.set(invite.invitee_user_id, {
          id: invite.invitee_user_id,
          username: invite.invitee_username || 'Unknown User',
          level: 0,
          invited_by: invite.inviter_user_id,
          children: []
        });
      }
    });

    // Build the tree structure
    const roots: GraphNode[] = [];
    const nodeArray = Array.from(nodeMap.values());

    // Find root nodes (those who weren't invited by anyone in this data)
    nodeArray.forEach(node => {
      if (!node.invited_by || !nodeMap.has(node.invited_by)) {
        node.level = 0;
        roots.push(node);
      }
    });

    // Build children relationships and set levels
    nodeArray.forEach(node => {
      if (node.invited_by && nodeMap.has(node.invited_by)) {
        const parent = nodeMap.get(node.invited_by)!;
        parent.children.push(node);
        node.level = parent.level + 1;
      }
    });

    // Sort children by username for consistent display
    const sortChildren = (node: GraphNode) => {
      node.children.sort((a, b) => a.username.localeCompare(b.username));
      node.children.forEach(sortChildren);
    };

    roots.forEach(sortChildren);
    return roots.sort((a, b) => a.username.localeCompare(b.username));
  }, [inviteData]);

  const renderNode = (node: GraphNode, isLast: boolean = false, prefix: string = '') => {
    const hasChildren = node.children.length > 0;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    return (
      <div key={node.id} className="font-mono text-sm">
        <div data-testid="invite-relationship" data-level={node.level} className="flex items-center text-gray-700">
          <span className="text-gray-400">{prefix}{connector}</span>
          <div className="flex items-center ml-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            <span className="font-medium">{node.username}</span>
            <span className="text-xs text-gray-500 ml-2">
              (Level {node.level})
            </span>
          </div>
        </div>
        {hasChildren && (
          <div>
            {node.children.map((child, index) =>
              renderNode(child, index === node.children.length - 1, childPrefix)
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-2 text-gray-600">Loading invite graph...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <div className="text-red-600 mb-2">Failed to load invite graph</div>
        <div className="text-sm text-gray-500">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </div>
      </div>
    );
  }

  if (!inviteData || inviteData.length === 0) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <div className="text-gray-600 mb-2">No invitation data available</div>
        <div className="text-sm text-gray-500">
          This group has no recorded invitations yet, or all members joined before the invite tracking system was implemented.
        </div>
      </div>
    );
  }

  const totalInvitations = inviteData.length;
  const uniqueInviters = new Set(inviteData.map(d => d.inviter_user_id)).size;

  return (
    <div data-testid="invite-graph-container" className={`bg-white border rounded-lg ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Invitation Graph</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span data-testid="total-invitations-stat">{totalInvitations} total invitations</span>
          <span data-testid="active-inviters-stat">{uniqueInviters} active inviters</span>
          <span data-testid="root-members-stat">{graphData.length} root members</span>
        </div>
      </div>

      <div className="p-4">
        <div data-testid="invite-graph-tree" className="space-y-1">
          {graphData.map((root, index) =>
            renderNode(root, index === graphData.length - 1)
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500">
          <div className="mb-1">
            <strong>How to read this graph:</strong>
          </div>
          <div>• Root members (Level 0) are the original group creators or joined before invite tracking</div>
          <div>• Each level shows who was invited by the level above</div>
          <div>• The tree structure shows the complete invitation chain</div>
        </div>
      </div>
    </div>
  );
};

export default InviteGraph;
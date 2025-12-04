import React from 'react';
import { useUserVote, useVoteScore } from '@/hooks/list/useContentVotes';
import { useCreateContentMutation } from '@/hooks/list/useContentQueries';
import { Content } from '@/lib/list/ContentRepository';

interface VoteButtonsProps {
  contentId: string;
  groupId: string;
  isVisible: boolean;
  userId?: string | null;
  useBatchQueries?: boolean;
  // Optional batch data to avoid individual queries
  userVote?: Content | null;
  voteScore?: { upvotes: number; downvotes: number; score: number; isDownvoted: boolean };
  layout?: 'vertical' | 'horizontal';
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({
  contentId,
  groupId,
  isVisible,
  userId,
  useBatchQueries = false,
  userVote: batchUserVote,
  voteScore: batchVoteScore,
  layout = 'vertical',
}) => {

  // Use batch data if provided, otherwise fall back to individual queries
  const { data: individualUserVote } = useUserVote(contentId, userId, { enabled: !useBatchQueries });
  const individualVoteScore = useVoteScore(contentId, { enabled: !useBatchQueries });

  const userVote = batchUserVote !== undefined ? batchUserVote : individualUserVote;
  const { score, upvotes, downvotes } = batchVoteScore || individualVoteScore;

  const createContentMutation = useCreateContentMutation();

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!userId || userVote) return; // Already voted or not logged in

    try {
      await createContentMutation.mutateAsync({
        type: 'vote',
        data: voteType,
        group_id: groupId,
        parent_content_id: contentId,
      });
    } catch (error) {
      console.error('Error creating vote:', error);
    }
  };

  const hasVoted = !!userVote;
  const userVoteType = userVote?.data;

  if (!isVisible && !hasVoted && score === 0) {
    // Don't show anything if not visible and no votes exist
    return null;
  }

  return (
    <div className={`flex ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} items-center ${layout === 'horizontal' ? 'gap-1' : 'gap-0.5'}`}>
      {/* Upvote button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleVote('upvote');
        }}
        disabled={hasVoted}
        className={`flex-shrink-0 p-0.5 rounded transition-colors ${
          hasVoted
            ? userVoteType === 'upvote'
              ? 'text-green-600'
              : 'text-gray-300 cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600 hover:text-green-600'
        }`}
        title={hasVoted ? (userVoteType === 'upvote' ? 'You upvoted' : 'Already voted') : 'Upvote'}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 4l-8 8h5v8h6v-8h5l-8-8z"/>
        </svg>
      </button>

      {/* Vote count */}
      {(score !== 0 || isVisible) && (
        <span
          className={`text-[10px] font-medium ${
            score > 0 ? 'text-green-600' :
            score < 0 ? 'text-red-600' :
            'text-gray-500'
          }`}
          title={`${upvotes} upvotes, ${downvotes} downvotes`}
        >
          {score > 0 ? `+${score}` : score}
        </span>
      )}

      {/* Downvote button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleVote('downvote');
        }}
        disabled={hasVoted}
        className={`flex-shrink-0 p-0.5 rounded transition-colors ${
          hasVoted
            ? userVoteType === 'downvote'
              ? 'text-red-600'
              : 'text-gray-300 cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600 hover:text-red-600'
        }`}
        title={hasVoted ? (userVoteType === 'downvote' ? 'You downvoted' : 'Already voted') : 'Downvote'}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 20l8-8h-5V4H9v8H4l8 8z"/>
        </svg>
      </button>
    </div>
  );
};

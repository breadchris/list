import { useBookClubRoomQuery, useBookClubMembersQuery } from "./use-bookclub-queries";
import type { BookClubRoom, ClubMemberProgress } from "@/lib/list/ContentRepository";

interface UseBookClubDetailResult {
  club: BookClubRoom | null;
  members: ClubMemberProgress[];
  isLoading: boolean;
  isLoadingMembers: boolean;
  error: Error | null;
  refetch: () => void;
  refetchMembers: () => void;
}

export function useBookClubDetail(clubId: string | null): UseBookClubDetailResult {
  const {
    data: club,
    isLoading: isLoadingClub,
    error: clubError,
    refetch: refetchClub,
  } = useBookClubRoomQuery(clubId);

  const {
    data: members = [],
    isLoading: isLoadingMembers,
    refetch: refetchMembers,
  } = useBookClubMembersQuery(
    club?.book_content_id ?? null,
    club?.group_id ?? null
  );

  return {
    club: club ?? null,
    members,
    isLoading: isLoadingClub,
    isLoadingMembers,
    error: clubError as Error | null,
    refetch: refetchClub,
    refetchMembers,
  };
}

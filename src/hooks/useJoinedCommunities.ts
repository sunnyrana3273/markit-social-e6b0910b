import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JoinedCommunity {
  id: string;
  course_communities: {
    id: string;
    course_name: string;
    course_category: string;
    description: string;
  };
  joined_at: string;
}

const fetchJoinedCommunities = async (userId: string): Promise<JoinedCommunity[]> => {
  const { data: joinedData, error } = await supabase
    .from('community_memberships')
    .select(`
      id,
      joined_at,
      course_communities:community_id (
        id,
        course_name,
        course_category,
        description
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch joined communities: ${error.message}`);
  }

  if (!joinedData) {
    return [];
  }

  return joinedData as JoinedCommunity[];
};

export const useJoinedCommunities = (userId: string | null) => {
  return useQuery({
    queryKey: ['joinedCommunities', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return fetchJoinedCommunities(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 60 minutes (keep in cache for 1 hour)
  });
};







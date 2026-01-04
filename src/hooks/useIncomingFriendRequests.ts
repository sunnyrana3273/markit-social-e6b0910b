import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FriendRequest {
  user_id: string;
  created_at: string;
  profiles?: {
    id: string;
    username?: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email: string;
  };
}

const fetchIncomingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  const { data: incomingFriendsData, error: incomingFriendsError } = await supabase
    .from('friends')
    .select('user_id, created_at')
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (incomingFriendsError) {
    throw new Error(`Failed to fetch incoming friend requests: ${incomingFriendsError.message}`);
  }

  if (!incomingFriendsData || incomingFriendsData.length === 0) {
    return [];
  }

  const userIds = incomingFriendsData.map(req => req.user_id);
  const { data: incomingProfilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name, image_url, email')
    .in('id', userIds);

  if (profilesError) {
    throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
  }

  if (!incomingProfilesData) {
    return [];
  }

  return incomingFriendsData.map(friends => {
    const profile = incomingProfilesData.find(p => p.id === friends.user_id);
    return { ...friends, profiles: profile };
  });
};

export const useIncomingFriendRequests = (userId: string | null) => {
  return useQuery({
    queryKey: ['incomingFriendRequests', userId],
    queryFn: () => fetchIncomingFriendRequests(userId!),
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};



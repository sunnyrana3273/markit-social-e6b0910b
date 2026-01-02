import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FriendProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'plus' | 'pro';
  plan_expires_at?: string | null;
}

export interface FriendProfileData {
  friend_id: string;
  profile: FriendProfile;
}

const fetchFriendProfiles = async (userId: string): Promise<FriendProfileData[]> => {
  // Fetch accepted friends
  const { data: friendsData, error: friendsError } = await supabase
    .from('friends')
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (friendsError) {
    throw new Error(`Failed to fetch friends: ${friendsError.message}`);
  }

  if (!friendsData || friendsData.length === 0) {
    return [];
  }

  // Get unique friend IDs
  const friendIds = Array.from(new Set(friendsData.map(f => 
    f.user_id === userId ? f.friend_id : f.user_id
  )));

  if (friendIds.length === 0) {
    return [];
  }

  // Fetch friend profiles including plan information
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, image_url, email, role, plan, plan_expires_at')
    .in('id', friendIds);

  if (profilesError) {
    throw new Error(`Failed to fetch friend profiles: ${profilesError.message}`);
  }

  if (!profilesData || profilesData.length === 0) {
    return [];
  }

  // Map profiles to friend data structure
  return profilesData.map(profile => ({
    friend_id: profile.id,
    profile: {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      image_url: profile.image_url,
      email: profile.email,
      role: profile.role as 'user' | 'admin' | undefined,
      plan: profile.plan as 'free' | 'plus' | 'pro' | undefined,
      plan_expires_at: profile.plan_expires_at || undefined,
    },
  }));
};

export const useFriendProfiles = (userId: string | null) => {
  return useQuery({
    queryKey: ['friendProfiles', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return fetchFriendProfiles(userId);
    },
    enabled: !!userId,
    staleTime: 20 * 60 * 1000, // 20 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
};


import { useEffect, useState, useMemo, useRef } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { useFriendProfiles } from '@/hooks/useFriendProfiles';

interface FriendActivity {
  friend_id: string;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email: string;
  };
  daily_metrics?: Array<{
    date?: string | null;
    problems_completed: number;
    minutes_studied: number;
  }>;
  user_stats?: {
    lifetime_minutes_studied: number;
    lifetime_questions_answered: number;
    longest_streak: number;
    current_streak: number;
  };
  isOnline: boolean;
}

interface FriendsActivityProps {
  user: User | null;
}

export const FriendsActivity: React.FC<FriendsActivityProps> = ({ user }) => {
  const [friendMetrics, setFriendMetrics] = useState<Record<string, {
    daily_metrics?: Array<{ date?: string | null; problems_completed: number; minutes_studied: number }>;
    user_stats?: {
      lifetime_minutes_studied: number;
      lifetime_questions_answered: number;
      longest_streak: number;
      current_streak: number;
    };
  }>>({});
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [presenceState, setPresenceState] = useState<Record<string, { status: string; updatedAt?: string }>>({});

  // Use React Query to fetch and cache friend profiles (same as Friends page)
  const { data: friendProfilesData = [], isLoading: isLoadingProfiles } = useFriendProfiles(user?.id || null);

  // Memoize friend IDs as a stable string dependency to prevent unnecessary rerenders
  const friendIdsKey = useMemo(() => {
    return friendProfilesData.map(f => f.friend_id).sort().join(',');
  }, [friendProfilesData]);

  // Fetch metrics for friends (separate from profiles, not cached)
  useEffect(() => {
    if (!user?.id || friendProfilesData.length === 0) {
      setFriendMetrics({});
      return;
    }

    const fetchMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const friendIdsArray = friendProfilesData.map(f => f.friend_id);

        // Fetch today's metrics for each friend
        const today = new Date().toISOString().split('T')[0];
        const { data: metricsData } = await supabase
          .from('daily_metrics')
          .select('user_id, date, minutes_studied, problems_completed')
          .in('user_id', friendIdsArray)
          .eq('date', today);

        // Fetch user stats
        const { data: statsData } = await supabase
          .from('user_stats')
          .select('user_id, current_streak, longest_streak, lifetime_minutes_studied, lifetime_questions_answered')
          .in('user_id', friendIdsArray);

        // Build metrics map
        const metricsMap: Record<string, {
          daily_metrics?: Array<{ date?: string | null; problems_completed: number; minutes_studied: number }>;
          user_stats?: {
            lifetime_minutes_studied: number;
            lifetime_questions_answered: number;
            longest_streak: number;
            current_streak: number;
          };
        }> = {};

        friendIdsArray.forEach((friendId) => {
          const todayMetrics = metricsData?.find((m) => m.user_id === friendId);
          const stats = statsData?.find((s) => s.user_id === friendId);

          metricsMap[friendId] = {
            daily_metrics: todayMetrics
              ? [
                  {
                    date: today,
                    minutes_studied: todayMetrics.minutes_studied || 0,
                    problems_completed: todayMetrics.problems_completed || 0,
                  },
                ]
              : [],
            user_stats: stats
              ? {
                  current_streak: stats.current_streak || 0,
                  longest_streak: stats.longest_streak || 0,
                  lifetime_minutes_studied: stats.lifetime_minutes_studied || 0,
                  lifetime_questions_answered: stats.lifetime_questions_answered || 0,
                }
              : undefined,
          };
        });

        setFriendMetrics(metricsMap);
      } catch (error) {
        console.error('Error fetching friend metrics:', error);
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [user?.id, friendIdsKey, friendProfilesData.length]);

  // Combine cached profiles with metrics (same pattern as Friends page)
  const friends = useMemo(() => {
    return friendProfilesData.map(friendData => ({
      friend_id: friendData.friend_id,
      profiles: friendData.profile,
      daily_metrics: friendMetrics[friendData.friend_id]?.daily_metrics || [],
      user_stats: friendMetrics[friendData.friend_id]?.user_stats,
      isOnline: presenceState[friendData.friend_id]?.status === 'online',
      
    }));
  }, [friendProfilesData, friendMetrics, presenceState]);


  // Setup presence tracking with refs to prevent rerenders
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const updatePresenceState = () => {
      if (!channel || cancelled) return;
      const state = channel.presenceState();
      const next: Record<string, { status: string; updatedAt?: string }> = {};
      Object.entries(state).forEach(([key, sessions]) => {
        const metas = sessions as Array<{ status?: string; updatedAt?: string }>;
        if (!metas?.length) return;
        const sorted = metas.slice().sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });
        const latest = sorted[0];
        if (latest?.status) {
          next[key] = { status: latest.status, updatedAt: latest.updatedAt };
        }
      });
      if (!cancelled) {
        setPresenceState(next);
      }
    };

    const setup = async () => {
      if (cancelled) return;
      
      try {
        channel = supabase.channel(`user-presence-${user.id}`, {
          config: { presence: { key: user.id } },
        });
        channelRef.current = channel;

        const trackStatus = async (status: 'online' | 'offline') => {
          if (cancelled || !channel) return;
          try {
            await channel.track({ status, updatedAt: new Date().toISOString() });
          } catch (error) {
            console.warn('[FriendsActivity] Failed to track presence', error);
          }
        };

        channel.on('presence', { event: 'sync' }, updatePresenceState);

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && !cancelled) {
            await trackStatus('online');
          }
        });

        const handleBeforeUnload = () => {
          void trackStatus('offline');
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        const cleanup = () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
          void trackStatus('offline');
        };
        
        cleanupRef.current = cleanup;
      } catch (error) {
        console.warn('[FriendsActivity] Failed to setup presence tracking', error);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  const getFriendName = (friend: FriendActivity): string => {
    if (friend.profiles.first_name) {
      return `${friend.profiles.first_name}${friend.profiles.last_name ? ` ${friend.profiles.last_name}` : ''}`;
    }
    return friend.profiles.email;
  };

  const getInitials = (friend: FriendActivity): string => {
    if (friend.profiles.first_name && friend.profiles.last_name) {
      return `${friend.profiles.first_name[0]}${friend.profiles.last_name[0]}`.toUpperCase();
    }
    if (friend.profiles.first_name) {
      return friend.profiles.first_name[0].toUpperCase();
    }
    return friend.profiles.email[0].toUpperCase();
  };

  const isToday = (iso?: string | null) => {
    if (!iso) return false;
    const date = new Date(iso);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const isRecent = (iso?: string | null, days = 2) => {
    if (!iso) return false;
    const date = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= days;
  };

  const getFriendStatus = (friend: FriendActivity): 'studying' | 'online' | 'offline' => {
    const presenceData = presenceState[friend.friend_id];
    const presence = presenceData?.status;
    const updatedAt = presenceData?.updatedAt;
    
    // Check if presence data is stale (older than 60 seconds)
    if (updatedAt) {
      const now = Date.now();
      const updatedTime = new Date(updatedAt).getTime();
      const isStale = now - updatedTime > 60000; // 60 seconds
      
      if (isStale) {
        // Presence is stale, don't trust it - check metrics instead
      } else {
        // Presence is fresh, use it
        if (presence === 'studying' || presence === 'online') {
          return presence as 'studying' | 'online';
        }
        if (presence === 'offline') {
          return 'offline';
        }
      }
    }

    // If presence is not available or stale, only check for "studying" based on today's activity
    // Don't fall back to "online" based on recent activity - default to offline instead
    const latestMetric = friend.daily_metrics?.[0] as
      | { date?: string | null; minutes_studied?: number | null }
      | undefined;
    
    // Only show "studying" if they have activity TODAY
    if (latestMetric && isToday(latestMetric.date) && (latestMetric.minutes_studied || 0) > 0) {
      return 'studying';
    }
    
    // Default to offline if presence is not available or stale
    // This prevents showing "online" based on stale presence data
    return 'offline';
  };

  const getStatusColor = (status: 'studying' | 'online' | 'offline'): string => {
    switch (status) {
      case 'studying':
        return 'bg-green-500';
      case 'online':
        return 'bg-blue-500';
      case 'offline':
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: 'studying' | 'online' | 'offline'): string => {
    switch (status) {
      case 'studying':
        return 'Studying';
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
    }
  };

  if (isLoadingProfiles) {
    return (
      <div className="text-center py-4 text-gray-600 dark:text-gray-400">
        <p className="text-sm">Loading friends...</p>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        <p className="mb-2">No friends yet</p>
        <p className="text-sm">Add friends to see their activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {friends.slice(0, 3).map((friend) => {
        const name = getFriendName(friend);
        const status = getFriendStatus(friend);

        return (
          <div
            key={friend.friend_id}
            className="flex items-center gap-3 p-3 bg-home-surface rounded-lg hover:bg-accent transition-colors"
          >
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage
                  src={friend.profiles.image_url || undefined}
                  alt={name}
                />
                <AvatarFallback className="bg-home-primary text-white text-sm">
                  {getInitials(friend)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(status)} rounded-full border-2 border-white dark:border-gray-800`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm text-home-foreground truncate">
                  {name}
                </p>
                <Badge 
                  variant="outline" 
                  className={`text-xs px-1.5 py-0 h-5 ${
                    status === 'studying' ? 'border-green-500 text-green-500' :
                    status === 'online' ? 'border-blue-500 text-blue-500' :
                    'border-gray-400 text-gray-400'
                  }`}
                >
                  {getStatusText(status)}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
      <Link to="/friends">
        <Button 
          variant="ghost" 
          className="w-full mt-2 text-home-foreground hover:bg-home-surface"
        >
          View all friends
        </Button>
      </Link>
    </div>
  );
};


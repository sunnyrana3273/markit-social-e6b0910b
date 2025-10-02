import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserStats {
  lifetime_minutes_studied: number;
  lifetime_questions_answered: number;
  longest_streak: number;
  current_streak: number;
  last_study_date: string | null;
  favorite_community_id: string | null;
  favorite_community_name?: string;
}

export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile to get user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('clerk_user_id', user.id)
        .single();

      if (!profile) return;

      // Get or create stats
      let { data: userStats, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      // If no stats exist, create them
      if (!userStats) {
        const { data: newStats, error: insertError } = await supabase
          .from('user_stats')
          .insert({ user_id: profile.id })
          .select()
          .single();

        if (insertError) throw insertError;
        userStats = newStats;
      }

      // Fetch favorite community name if exists
      if (userStats?.favorite_community_id) {
        const { data: community } = await supabase
          .from('course_communities')
          .select('course_name')
          .eq('id', userStats.favorite_community_id)
          .single();

        setStats({
          ...userStats,
          favorite_community_name: community?.course_name || 'Unknown Community'
        });
      } else {
        setStats(userStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error loading stats",
        description: "Could not load your statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { stats, isLoading, refetch: fetchStats };
};

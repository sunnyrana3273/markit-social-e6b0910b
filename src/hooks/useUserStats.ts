import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDateString = (dateStr: string, offset: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return formatLocalDate(date);
};

const calculateCurrentStreak = (activeDates: Set<string>) => {
  let current = 0;
  let cursor = formatLocalDate(new Date());

  while (activeDates.has(cursor)) {
    current += 1;
    cursor = shiftDateString(cursor, -1);
  }

  return current;
};

const calculateLongestStreak = (activeDates: Set<string>) => {
  let longest = 0;

  activeDates.forEach((dateStr) => {
    const previous = shiftDateString(dateStr, -1);
    if (activeDates.has(previous)) {
      return;
    }

    let length = 0;
    let cursor = dateStr;
    while (activeDates.has(cursor)) {
      length += 1;
      cursor = shiftDateString(cursor, 1);
    }

    if (length > longest) {
      longest = length;
    }
  });

  return longest;
};

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      let { data: userStats, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (!userStats) {
        const { data: newStats, error: insertError } = await supabase
          .from('user_stats')
          .insert({ user_id: profile.id })
          .select()
          .single();

        if (insertError) throw insertError;
        userStats = newStats;
      }

      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('date, minutes_studied, problems_completed')
        .eq('user_id', profile.id)
        .order('date', { ascending: false });

      if (metricsError) throw metricsError;

      const metrics = metricsData ?? [];

      let totalMinutes = 0;
      let totalProblems = 0;
      const activeDates = new Set<string>();

      metrics.forEach((metric) => {
        const minutes = metric.minutes_studied ?? 0;
        const problems = metric.problems_completed ?? 0;
        totalMinutes += minutes;
        totalProblems += problems;

        if (minutes > 0 || problems > 0) {
          activeDates.add(metric.date);
        }
      });

      const lastStudyMetric = metrics.find(
        (metric) => (metric.minutes_studied ?? 0) > 0 || (metric.problems_completed ?? 0) > 0
      );

      const currentStreak = calculateCurrentStreak(activeDates);
      const historicalLongest = calculateLongestStreak(activeDates);
      const longestStreak = Math.max(historicalLongest, currentStreak);

      const computedStats: UserStats = {
        lifetime_minutes_studied: totalMinutes,
        lifetime_questions_answered: totalProblems,
        longest_streak: longestStreak,
        current_streak: currentStreak,
        last_study_date: lastStudyMetric?.date ?? userStats.last_study_date,
        favorite_community_id: userStats.favorite_community_id,
      };

      if (userStats.favorite_community_id) {
        const { data: community } = await supabase
          .from('course_communities')
          .select('course_name')
          .eq('id', userStats.favorite_community_id)
          .single();

        computedStats.favorite_community_name = community?.course_name || 'Unknown Community';
      }

      setStats(computedStats);
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

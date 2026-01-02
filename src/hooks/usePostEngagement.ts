import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Hook to periodically check for post engagement and create notifications
 * Runs every 30 minutes
 */
export const usePostEngagement = (user: User | null) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkEngagement = async () => {
      if (!user) return;
      
      try {
        // Call the database function to check engagement for current user
        const { error } = await supabase.rpc('check_post_engagement', {
          p_user_id: user.id
        });
        
        if (error) {
          console.error('Error checking post engagement:', error);
          return;
        }

        lastCheckRef.current = new Date();
      } catch (err) {
        console.error('Exception checking post engagement:', err);
      }
    };

    // Run immediately on mount, then every 30 minutes
    checkEngagement();
    
    // Set interval for 30 minutes (30 * 60 * 1000 ms)
    intervalRef.current = setInterval(checkEngagement, 30 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user]);

  return {
    lastCheck: lastCheckRef.current,
  };
};


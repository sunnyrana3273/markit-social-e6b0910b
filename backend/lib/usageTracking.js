/**
 * API usage tracking functions for daily query limits
 */

import { getPlanConfig } from './subscription.js';

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Increment and check API usage for a user
 * @param {Object} user - User object with id, role, plan, plan_expires_at
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<{count: number, limit: number}>} Current usage count and limit
 * @throws {Error} If daily limit is exceeded
 */
export async function incrementAndCheckUsage(user, supabaseClient) {
  if (!user || !user.id) {
    throw new Error('User is required for usage tracking');
  }

  if (!supabaseClient) {
    throw new Error('Supabase client is required for usage tracking');
  }

  const config = getPlanConfig(user);
  
  // Admins and unlimited plans don't need tracking
  if (!Number.isFinite(config.maxDailyQueries)) {
    return { count: 0, limit: Infinity };
  }

  try {
    // Use the secure database function to track usage
    // This function runs with SECURITY DEFINER and validates the user exists
    const { data: result, error: rpcError } = await supabaseClient
      .rpc('track_api_usage', { p_user_id: user.id });

    if (rpcError) {
      throw new Error(`Failed to track usage: ${rpcError.message}`);
    }

    // The function returns JSON with query_count and date
    const currentCount = result?.query_count || 1;

    // Check if limit exceeded
    if (currentCount > config.maxDailyQueries) {
      throw new Error(
        `Query limit reached for today. You have used ${currentCount} of ${config.maxDailyQueries} queries. Please upgrade your plan or try again tomorrow.`
      );
    }

    return {
      count: currentCount,
      limit: config.maxDailyQueries,
    };
  } catch (error) {
    // If it's already our custom error, rethrow it
    if (error.message.includes('Query limit reached') || error.message.includes('limit exceeded')) {
      throw error;
    }
    // Otherwise wrap it
    throw new Error(`Usage tracking error: ${error.message}`);
  }
}

/**
 * Get today's usage count for a user
 * @param {Object} user - User object with id
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Promise<number>} Current day's query count
 */
export async function getUsageToday(user, supabaseClient) {
  if (!user || !user.id) {
    return 0;
  }

  if (!supabaseClient) {
    return 0;
  }

  const today = getTodayDate();

  try {
    const { data, error } = await supabaseClient
      .from('api_usage')
      .select('query_count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching usage:', error);
      return 0;
    }

    return data?.query_count || 0;
  } catch (error) {
    console.error('Error in getUsageToday:', error);
    return 0;
  }
}





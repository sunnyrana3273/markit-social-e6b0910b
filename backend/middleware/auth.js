/**
 * Authentication middleware for Express
 * Validates Supabase JWT tokens and fetches user data
 */

// Load environment variables first (before any other imports that need them)
import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
// These should be set as environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wvspwskluqkqeniwtoqf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_KEY environment variable is required');
  console.error('Please set SUPABASE_SERVICE_KEY in your backend/.env file');
  console.error('Current working directory:', process.cwd());
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Get user from request (extracts JWT and fetches user from DB)
 * @param {Object} req - Express request object
 * @returns {Promise<Object|null>} User object or null
 */
export async function getUserFromRequest(req) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token and get user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authUser) {
      console.error('[Auth] Token validation error:', authError);
      return null;
    }

    // Fetch user profile - try with role/plan first, fallback to basic fields
    let profile = null;
    let profileError = null;
    
    // First try to get profile with role and plan columns
    const { data: profileWithRole, error: roleError } = await supabase
      .from('profiles')
      .select('id, email, role, plan, plan_expires_at')
      .eq('id', authUser.id)
      .single();

    if (roleError && roleError.code === '42703') {
      // Column doesn't exist, try without role/plan columns
      console.warn('[Auth] Role/plan columns not found, fetching basic profile');
      const { data: basicProfile, error: basicError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', authUser.id)
        .single();
      
      if (basicError || !basicProfile) {
        console.error('[Auth] Profile fetch error:', basicError);
        return null;
      }
      
      profile = basicProfile;
      // Set defaults for missing columns
      profile.role = 'user';
      profile.plan = 'free';
      profile.plan_expires_at = null;
    } else if (roleError || !profileWithRole) {
      console.error('[Auth] Profile fetch error:', roleError);
      return null;
    } else {
      profile = profileWithRole;
    }

    // Check if plan has expired and downgrade if needed (only if plan_expires_at exists)
    if (profile.plan_expires_at) {
      const expiresAt = new Date(profile.plan_expires_at);
      const now = new Date();
      if (expiresAt < now && profile.plan && profile.plan !== 'free') {
        // Plan expired, downgrade to free (only if we can update)
        try {
          await supabase
            .from('profiles')
            .update({ plan: 'free', plan_expires_at: null })
            .eq('id', profile.id);
          
          profile.plan = 'free';
          profile.plan_expires_at = null;
        } catch (updateError) {
          // If update fails (e.g., columns don't exist), just use defaults
          console.warn('[Auth] Could not update plan expiration:', updateError);
        }
      }
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role || 'user',
      plan: profile.plan || 'free',
      plan_expires_at: profile.plan_expires_at || null,
    };
  } catch (error) {
    console.error('[Auth] Error in getUserFromRequest:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 * Attaches user to req.user or returns 401
 */
export function requireUser() {
  return async (req, res, next) => {
    try {
      const user = await getUserFromRequest(req);
      
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'Not authenticated. Please provide a valid authorization token.' 
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('[Auth] Middleware error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Authentication error' 
      });
    }
  };
}

/**
 * Middleware factory to require a specific feature
 * @param {string} feature - Feature name to check (e.g., 'canUseCollaborativeWhiteboard')
 */
export function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      // First require user
      const user = await getUserFromRequest(req);
      
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'Not authenticated' 
        });
      }

      req.user = user;

      // Check feature access
      const { assertFeature } = await import('../lib/subscription.js');
      
      try {
        assertFeature(user, feature);
        next();
      } catch (featureError) {
        return res.status(403).json({ 
          success: false,
          error: featureError.message || 'Upgrade required for this feature.' 
        });
      }
    } catch (error) {
      console.error('[Auth] Feature check error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Feature check error' 
      });
    }
  };
}





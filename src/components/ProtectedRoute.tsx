import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const hasCheckedRef = useRef(false);
  const isCheckingRef = useRef(false);
  const lastActiveTimeRef = useRef(Date.now());

  useEffect(() => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      console.log('[ProtectedRoute] Already checking auth, skipping...');
      return;
    }

    const checkAuthAndUsername = async () => {
      isCheckingRef.current = true;
      console.log('[ProtectedRoute] Starting auth check...');
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[ProtectedRoute] Session error:', sessionError);
          setIsAuthenticated(false);
          setIsLoading(false);
          isCheckingRef.current = false;
          return;
        }
        
        console.log('[ProtectedRoute] Session check result:', { 
          hasSession: !!session, 
          userId: session?.user?.id,
          expiresAt: session?.expires_at,
          path: location.pathname 
        });
        
        if (!session) {
          console.log('[ProtectedRoute] No session found, redirecting to auth');
          setIsAuthenticated(false);
          setIsLoading(false);
          isCheckingRef.current = false;
          return;
        }

        // Check if session is expired - if so, redirect to login
        if (session.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          // Add 5 minute buffer to account for clock skew
          const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
          if (expiresAt.getTime() < (now.getTime() + bufferTime)) {
            console.log('[ProtectedRoute] Session expired or expiring soon, redirecting to login');
            // Clear the expired session
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            setIsLoading(false);
            isCheckingRef.current = false;
            return;
          }
        }

        // Verify session is actually valid by making a test query
        // If this fails, the session is invalid even if it exists
        try {
          const { error: testError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .limit(1)
            .single();
          
          if (testError && testError.code !== 'PGRST116') {
            // PGRST116 is "no rows returned" which is fine, but other errors mean auth failed
            console.error('[ProtectedRoute] Session validation failed:', testError);
            if (testError.message?.includes('JWT') || testError.message?.includes('token') || testError.message?.includes('expired')) {
              console.log('[ProtectedRoute] Session invalid (JWT error), redirecting to login');
              await supabase.auth.signOut();
              setIsAuthenticated(false);
              setIsLoading(false);
              isCheckingRef.current = false;
              return;
            }
          }
        } catch (validationError: any) {
          console.error('[ProtectedRoute] Session validation error:', validationError);
          // If validation fails, assume session is invalid
          if (validationError?.message?.includes('JWT') || validationError?.message?.includes('token') || validationError?.message?.includes('expired')) {
            console.log('[ProtectedRoute] Session invalid, redirecting to login');
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            setIsLoading(false);
            isCheckingRef.current = false;
            return;
          }
        }

        setIsAuthenticated(true);

        // Check if user has a username
        console.log('[ProtectedRoute] Checking username for user:', session.user.id);
        
        // Add timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          console.warn('[ProtectedRoute] Username check timed out after 5s, allowing access');
          setIsLoading(false);
          isCheckingRef.current = false;
          hasCheckedRef.current = true; // Mark as checked to prevent retries
        }, 5000);
        
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .maybeSingle();

          clearTimeout(timeoutId); // Clear timeout if query completes

          if (profileError) {
            console.error('[ProtectedRoute] Error checking username:', profileError);
            // Don't block access if profile check fails - might be a temporary DB issue
            setIsLoading(false);
            isCheckingRef.current = false;
            return;
          }

          console.log('[ProtectedRoute] Profile check result:', { 
            hasProfile: !!profile, 
            hasUsername: !!profile?.username 
          });

          if (!profile?.username) {
            console.log('[ProtectedRoute] User needs username, setting needsUsername=true');
            setNeedsUsername(true);
          } else {
            setNeedsUsername(false);
          }

          setIsLoading(false);
          hasCheckedRef.current = true;
        } catch (error) {
          clearTimeout(timeoutId); // Clear timeout on error
          console.error('[ProtectedRoute] Unexpected error:', error);
          setIsLoading(false);
        } finally {
          isCheckingRef.current = false;
        }
      } catch (error) {
        console.error('[ProtectedRoute] Unexpected error:', error);
        setIsLoading(false);
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkAuthAndUsername();

    // Listen for page visibility changes (user returning to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isCheckingRef.current) {
        const timeAway = Date.now() - lastActiveTimeRef.current;
        const longDuration = 30 * 60 * 1000; // 30 minutes
        
        console.log('[ProtectedRoute] Page became visible, re-checking auth state...', { 
          timeAway: Math.round(timeAway / 1000 / 60) + ' minutes' 
        });
        
        // Always re-check when returning, but log if it was a long duration
        if (timeAway > longDuration) {
          console.log('[ProtectedRoute] User was away for extended period (' + Math.round(timeAway / 1000 / 60) + ' min), forcing auth re-check');
        }
        hasCheckedRef.current = false;
        checkAuthAndUsername();
      } else if (document.visibilityState === 'hidden') {
        // Update last active time when user leaves
        lastActiveTimeRef.current = Date.now();
      }
    };

    // Listen for window focus (user returning to window)
    const handleFocus = () => {
      if (!isCheckingRef.current) {
        const timeAway = Date.now() - lastActiveTimeRef.current;
        const longDuration = 30 * 60 * 1000; // 30 minutes
        
        console.log('[ProtectedRoute] Window focused, re-checking auth state...', { 
          timeAway: Math.round(timeAway / 1000 / 60) + ' minutes' 
        });
        
        if (timeAway > longDuration) {
          console.log('[ProtectedRoute] User was away for extended period (' + Math.round(timeAway / 1000 / 60) + ' min), forcing auth re-check');
        }
        hasCheckedRef.current = false;
        checkAuthAndUsername();
      }
    };

    // Update last active time on user activity
    const updateLastActive = () => {
      lastActiveTimeRef.current = Date.now();
    };
    
    document.addEventListener('mousemove', updateLastActive);
    document.addEventListener('keydown', updateLastActive);
    document.addEventListener('click', updateLastActive);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Listen for auth changes - but only update state, don't trigger full re-check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[ProtectedRoute] Auth state changed:', { event, hasSession: !!session, path: location.pathname });
      
      // Prevent processing if already checking
      if (isCheckingRef.current) {
        console.log('[ProtectedRoute] Already checking, skipping auth state change handler');
        return;
      }
      
      if (!session) {
        console.log('[ProtectedRoute] Session lost, setting authenticated=false');
        setIsAuthenticated(false);
        setNeedsUsername(false);
        setIsLoading(false);
        hasCheckedRef.current = false;
        return;
      }

      setIsAuthenticated(true);

      // Only check username if we haven't checked yet or if it's a sign in event
      if (!hasCheckedRef.current || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        isCheckingRef.current = true;
        console.log('[ProtectedRoute] Checking username on auth state change');
        
        // Add timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          console.warn('[ProtectedRoute] Username check timed out after 5s (auth change), allowing access');
          setIsLoading(false);
          isCheckingRef.current = false;
          hasCheckedRef.current = true; // Mark as checked to prevent retries
        }, 5000);
        
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .maybeSingle();

          clearTimeout(timeoutId); // Clear timeout if query completes

          if (profileError) {
            console.error('[ProtectedRoute] Error checking username on auth change:', profileError);
            setIsLoading(false);
            isCheckingRef.current = false;
            return;
          }

          if (!profile?.username) {
            console.log('[ProtectedRoute] User needs username (from auth change)');
            setNeedsUsername(true);
          } else {
            console.log('[ProtectedRoute] User has username (from auth change)');
            setNeedsUsername(false);
          }
          setIsLoading(false);
          hasCheckedRef.current = true;
        } catch (error) {
          clearTimeout(timeoutId); // Clear timeout on error
          console.error('[ProtectedRoute] Error checking username on auth change:', error);
          setIsLoading(false);
        } finally {
          isCheckingRef.current = false;
        }
      }
    });

    return () => {
      console.log('[ProtectedRoute] Cleaning up auth listener');
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('mousemove', updateLastActive);
      document.removeEventListener('keydown', updateLastActive);
      document.removeEventListener('click', updateLastActive);
    };
  }, []); // Remove location.pathname dependency to prevent re-checks on every navigation

  console.log('[ProtectedRoute] Render state:', { 
    isLoading, 
    isAuthenticated, 
    needsUsername, 
    path: location.pathname 
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-home-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-home-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (needsUsername) {
    console.log('[ProtectedRoute] Needs username, redirecting to /onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  console.log('[ProtectedRoute] All checks passed, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;


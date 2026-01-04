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
  const isLoadingRef = useRef(false);

  useEffect(() => {
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      return;
    }

    // Safety timeout - if we're still loading after 5 seconds, something is wrong
    isLoadingRef.current = true;
    const safetyTimeout = setTimeout(() => {
      if (isLoadingRef.current) {
        console.error('[ProtectedRoute] Safety timeout - forcing loading to false after 5s');
        setIsLoading(false);
        isCheckingRef.current = false;
        hasCheckedRef.current = true;
        setNeedsUsername(false);
        isLoadingRef.current = false;
      }
    }, 5000);

    const checkAuthAndUsername = async () => {
      isCheckingRef.current = true;
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[ProtectedRoute] Session error:', sessionError);
          setIsAuthenticated(false);
          setIsLoading(false);
          isLoadingRef.current = false;
          isCheckingRef.current = false;
          return;
        }
        
        if (!session) {
          setIsAuthenticated(false);
          setIsLoading(false);
          isLoadingRef.current = false;
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
            // Clear the expired session
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            setIsLoading(false);
            isLoadingRef.current = false;
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
              await supabase.auth.signOut();
              setIsAuthenticated(false);
              setIsLoading(false);
              isLoadingRef.current = false;
              isCheckingRef.current = false;
              return;
            }
          }
        } catch (validationError: any) {
          console.error('[ProtectedRoute] Session validation error:', validationError);
          // If validation fails, assume session is invalid
          if (validationError?.message?.includes('JWT') || validationError?.message?.includes('token') || validationError?.message?.includes('expired')) {
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            setIsLoading(false);
            isLoadingRef.current = false;
            isCheckingRef.current = false;
            return;
          }
        }

        setIsAuthenticated(true);

        // Check if user has a username
        let timeoutId: NodeJS.Timeout | null = null;
        let queryCompleted = false;
        
        // Add timeout to prevent hanging - reduced to 3s for faster feedback
        timeoutId = setTimeout(() => {
          if (!queryCompleted) {
            console.warn('[ProtectedRoute] Username check timed out after 3s, allowing access');
            setIsLoading(false);
            isLoadingRef.current = false;
            isCheckingRef.current = false;
            hasCheckedRef.current = true; // Mark as checked to prevent retries
            setNeedsUsername(false); // Assume username exists if query times out
          }
        }, 3000);
        
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .maybeSingle();

          queryCompleted = true;
          if (timeoutId) clearTimeout(timeoutId);

          if (profileError) {
            console.error('[ProtectedRoute] Error checking username:', profileError);
            // Don't block access if profile check fails - might be a temporary DB issue
            setIsLoading(false);
            isLoadingRef.current = false;
            isCheckingRef.current = false;
            setNeedsUsername(false); // Allow access even if check fails
            hasCheckedRef.current = true;
            return;
          }

          // Check if username exists and is not empty/null
          if (!profile?.username || profile.username.trim().length === 0) {
            setNeedsUsername(true);
          } else {
            setNeedsUsername(false);
          }

          setIsLoading(false);
          isLoadingRef.current = false;
          hasCheckedRef.current = true;
        } catch (error) {
          queryCompleted = true;
          if (timeoutId) clearTimeout(timeoutId);
          console.error('[ProtectedRoute] Unexpected error:', error);
          setIsLoading(false);
          isLoadingRef.current = false;
          setNeedsUsername(false); // Allow access on error
          hasCheckedRef.current = true;
        } finally {
          isCheckingRef.current = false;
        }
      } catch (error) {
        console.error('[ProtectedRoute] Unexpected error in checkAuthAndUsername:', error);
        setIsLoading(false);
        isLoadingRef.current = false;
        setIsAuthenticated(false); // Set to false on unexpected error
        isCheckingRef.current = false;
      }
    };

    checkAuthAndUsername();

    // Listen for page visibility changes (user returning to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isCheckingRef.current) {
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
      // Prevent processing if already checking
      if (isCheckingRef.current) {
        return;
      }
      
      if (!session) {
        setIsAuthenticated(false);
        setNeedsUsername(false);
        setIsLoading(false);
        isLoadingRef.current = false;
        hasCheckedRef.current = false;
        return;
      }

      setIsAuthenticated(true);

      // Only check username if we haven't checked yet or if it's a sign in event
      if (!hasCheckedRef.current || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        isCheckingRef.current = true;
        
        // Add timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          console.warn('[ProtectedRoute] Username check timed out after 5s (auth change), allowing access');
          setIsLoading(false);
          isLoadingRef.current = false;
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
            isLoadingRef.current = false;
            isCheckingRef.current = false;
            return;
          }

          // Check if username exists and is not empty/null
          if (!profile?.username || profile.username.trim().length === 0) {
            setNeedsUsername(true);
          } else {
            setNeedsUsername(false);
          }
          setIsLoading(false);
          isLoadingRef.current = false;
          hasCheckedRef.current = true;
        } catch (error) {
          clearTimeout(timeoutId); // Clear timeout on error
          console.error('[ProtectedRoute] Error checking username on auth change:', error);
          setIsLoading(false);
          isLoadingRef.current = false;
        } finally {
          isCheckingRef.current = false;
        }
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('mousemove', updateLastActive);
      document.removeEventListener('keydown', updateLastActive);
      document.removeEventListener('click', updateLastActive);
    };
  }, []); // Remove location.pathname dependency to prevent re-checks on every navigation

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
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (needsUsername) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;


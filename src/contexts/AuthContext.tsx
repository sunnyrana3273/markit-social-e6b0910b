import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, username, image_url, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        return null;
      }

      if (!data) {
        // Create profile if it doesn't exist
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: currentUser?.email || "",
            first_name: currentUser?.user_metadata?.first_name || currentUser?.user_metadata?.name || currentUser?.email?.split("@")[0] || "User",
            last_name: currentUser?.user_metadata?.last_name || "",
            image_url: currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture || "",
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
          return null;
        }

        return newProfile as Profile;
      }

      return data as Profile;
    } catch (err) {
      // Catch any unexpected errors (network failures, etc.)
      console.error("Unexpected error in loadProfile:", err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const prof = await loadProfile(user.id);
    setProfile(prof);
  }, [user, loadProfile]);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!isMounted) return;

      if (sessionError) {
        console.error('[AuthContext] Session error:', sessionError);
        setError(sessionError as Error);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);

      if (session?.user) {
        loadProfile(session.user.id)
          .then((prof) => {
            if (!isMounted) return;
            setProfile(prof);
            setLoading(false);
          })
          .catch((err) => {
            console.error('[AuthContext] Error loading profile:', err);
            if (!isMounted) return;
            setError(err as Error);
            setLoading(false);
          });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const prof = await loadProfile(session.user.id);
          if (!isMounted) return;
          setProfile(prof);
        } catch (err) {
          console.error('[AuthContext] Error loading profile in auth state change:', err);
          if (!isMounted) return;
          setError(err as Error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    error,
    refreshProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Book, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForceLightMode } from "@/hooks/useForceLightMode";

interface Community {
  id: string;
  course_name: string;
  course_category: string;
  description: string | null;
}

const Onboarding = () => {
  useForceLightMode();
  
  const [step, setStep] = useState<"username" | "communities">("username");
  const [username, setUsername] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "MarkIt | Onboarding";
    const initializeOnboarding = async () => {
      // Wait a bit for auth callback to process if coming from OAuth redirect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let sessionRetries = 0;
      const maxRetries = 5;
      let session = null;
      let sessionError = null;
      
      // Retry getting session in case we're coming from OAuth callback
      while (sessionRetries < maxRetries && !session) {
        const result = await supabase.auth.getSession();
        session = result.data?.session || null;
        sessionError = result.error || null;
        
        if (!session && sessionRetries < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
          sessionRetries++;
        } else {
          break;
        }
      }
      
      if (sessionError) {
        console.error('[Onboarding] Session error:', sessionError);
        navigate('/auth');
        return;
      }
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUserId(session.user.id);

      // Check if user already has username set - retry a few times in case profile hasn't been created yet
      let profile = null;
      let profileError = null;
      let profileRetries = 0;
      const maxProfileRetries = 3;
      
      while (profileRetries < maxProfileRetries) {
        const result = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle();
        
        profile = result.data || null;
        profileError = result.error || null;
        
        if (profileError && profileError.code !== 'PGRST116' && profileRetries < maxProfileRetries - 1) {
          // PGRST116 means no rows returned, which is fine - profile might not exist yet
          await new Promise(resolve => setTimeout(resolve, 300));
          profileRetries++;
        } else {
          break;
        }
      }

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[Onboarding] Error checking profile after retries:', profileError);
        // Continue with onboarding if there's an error - user can still set username
      }

      // Check if username exists and is not empty/null
      if (profile?.username && typeof profile.username === 'string' && profile.username.trim().length > 0) {
        navigate('/app', { replace: true });
        return;
      }

      // Fetch available communities
      const { data: communitiesData, error } = await supabase
        .from('course_communities')
        .select('*')
        .order('course_name');

      if (error) {
        console.error('Error fetching communities:', error);
      } else {
        setCommunities(communitiesData || []);
      }
    };

    initializeOnboarding();
  }, [navigate]);

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameToCheck)) {
      setUsernameError("Username can only contain letters, numbers, and underscores");
      return false;
    }

    setIsCheckingUsername(true);
    setUsernameError("");

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', usernameToCheck)
        .maybeSingle();

      if (error) {
        console.error('Error checking username:', error);
        setUsernameError("Error checking availability");
        return false;
      }

      if (data) {
        setUsernameError("Username is already taken");
        return false;
      }

      return true;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameSubmit = async () => {
    const isAvailable = await checkUsernameAvailability(username);
    
    if (!isAvailable) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', userId);

      if (error) {
        console.error('[Onboarding] Error updating username:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Username created successfully!",
      });

      setStep("communities");
    } catch (error: any) {
      console.error('[Onboarding] Error in handleUsernameSubmit:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create username",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCommunity = (communityId: string) => {
    setSelectedCommunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(communityId)) {
        newSet.delete(communityId);
      } else {
        newSet.add(communityId);
      }
      return newSet;
    });
  };

  const handleFinish = async () => {
    setIsSubmitting(true);

    try {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Join selected communities
      if (selectedCommunities.size > 0) {
        const memberships = Array.from(selectedCommunities).map(communityId => ({
          user_id: userId,
          community_id: communityId
        }));

        const { error } = await supabase
          .from('community_memberships')
          .insert(memberships);

        if (error) {
          console.error('[Onboarding] Error joining communities:', error);
          throw error;
        }
      }

      toast({
        title: "Welcome!",
        description: "Your account is all set up",
      });

      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 100);
    } catch (error: any) {
      console.error('[Onboarding] Error in handleFinish:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4 force-light-mode">
      <Card className="w-full max-w-2xl p-8 bg-card shadow-card">
        {/* Logo */}
        <div className="flex items-center gap-1.5 justify-center mb-8">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Book className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-foreground">MarkIt</span>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${step === "username" ? "bg-primary" : "bg-muted"}`} />
          <div className="w-12 h-0.5 bg-muted" />
          <div className={`w-3 h-3 rounded-full ${step === "communities" ? "bg-primary" : "bg-muted"}`} />
        </div>

        {step === "username" ? (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Choose your username</h2>
              <p className="text-muted-foreground">This is how friends will find and add you</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameError("");
                }}
                onBlur={() => username && checkUsernameAvailability(username)}
                placeholder="enter_username_here"
                className={usernameError ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {usernameError && (
                <p className="text-sm text-destructive">{usernameError}</p>
              )}
              {isCheckingUsername && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking availability...
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be at least 3 characters. Only letters, numbers, and underscores.
              </p>
            </div>

            <Button
              onClick={handleUsernameSubmit}
              className="w-full"
              disabled={!username || !!usernameError || isCheckingUsername || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Join Communities</h2>
              <p className="text-muted-foreground">
                Select communities to connect with fellow students
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                💡 Tip: Use your school email to find school communities easier
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {communities.map((community) => (
                <Card
                  key={community.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedCommunities.has(community.id)
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => toggleCommunity(community.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">{community.course_name}</h3>
                        <Badge variant="secondary" className="mt-1">{community.course_category}</Badge>
                        {community.description && (
                          <p className="text-sm text-muted-foreground mt-2">{community.description}</p>
                        )}
                      </div>
                    </div>
                    {selectedCommunities.has(community.id) && (
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleFinish}
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finishing...
                  </>
                ) : (
                  `Finish ${selectedCommunities.size > 0 ? `(${selectedCommunities.size} selected)` : ""}`
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Onboarding;

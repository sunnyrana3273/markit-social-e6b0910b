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

interface Community {
  id: string;
  course_name: string;
  course_category: string;
  description: string | null;
}

const Onboarding = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<"username" | "communities">("username");
  const [username, setUsername] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "MarkIt | Onboarding";
    const initializeOnboarding = async () => {
      console.log('[Onboarding] Initializing onboarding...');
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Onboarding] Session error:', sessionError);
        navigate('/auth');
        return;
      }
      
      if (!session) {
        console.log('[Onboarding] No session, redirecting to auth');
        navigate('/auth');
        return;
      }

      console.log('[Onboarding] Session found:', { userId: session.user.id });
      setUserId(session.user.id);

      // Check if user already has username set
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[Onboarding] Error checking profile:', profileError);
        setIsLoading(false);
        // Continue with onboarding if there's an error - user can still set username
        return;
      }

      if (profile?.username) {
        console.log('[Onboarding] User already has username, redirecting to app');
        navigate('/app', { replace: true });
        return;
      }
      
      console.log('[Onboarding] User needs username, checking if new user...');

      // Check if user is new (has no community memberships = first time signup)
      // vs returning user (has memberships but no username = needs username only)
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('community_memberships')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (membershipsError) {
        console.error('[Onboarding] Error checking memberships:', membershipsError);
      }

      const hasMemberships = membershipsData && membershipsData.length > 0;
      const isNew = !hasMemberships;
      
      console.log('[Onboarding] User type:', { isNew, hasMemberships: !!hasMemberships });
      setIsNewUser(isNew);

      // If returning user (has memberships), only show username step
      // If new user (no memberships), show full onboarding flow
      if (!isNew) {
        console.log('[Onboarding] Returning user - showing username step only');
        setStep("username");
      } else {
        console.log('[Onboarding] New user - showing full onboarding flow');
        setStep("username");
        
        // Fetch available communities for new users
        const { data: communitiesData, error } = await supabase
          .from('course_communities')
          .select('*')
          .order('course_name');

        if (error) {
          console.error('Error fetching communities:', error);
        } else {
          setCommunities(communitiesData || []);
        }
      }

      setIsLoading(false);
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
    console.log('[Onboarding] Submitting username:', username, 'for user:', userId);

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

      console.log('[Onboarding] Username updated successfully');
      toast({
        title: "Success",
        description: "Username created successfully!",
      });

      // Only show communities step for new users
      if (isNewUser) {
        setStep("communities");
      } else {
        // Returning user - just finish onboarding
        navigate('/app', { replace: true });
      }
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
    console.log('[Onboarding] Finishing onboarding for user:', userId);

    try {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Join selected communities
      if (selectedCommunities.size > 0) {
        console.log('[Onboarding] Joining communities:', Array.from(selectedCommunities));
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
        console.log('[Onboarding] Successfully joined communities');
      }

      console.log('[Onboarding] Onboarding complete, navigating to app');
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

  // Show loading state until we know if onboarding is needed
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4 force-light-mode">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Book className="w-6 h-6 text-white animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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

        {/* Progress Indicator - only show for new users */}
        {isNewUser && (
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className={`w-3 h-3 rounded-full ${step === "username" ? "bg-primary" : "bg-muted"}`} />
            <div className="w-12 h-0.5 bg-muted" />
            <div className={`w-3 h-3 rounded-full ${step === "communities" ? "bg-primary" : "bg-muted"}`} />
          </div>
        )}

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

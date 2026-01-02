import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Gift,
  Crown,
  Sparkles,
  Check,
  X,
  Calendar,
  Waypoints,
  ArrowRight,
  Trophy
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { Book } from "lucide-react";
import ReportIssueFooter from "@/components/ReportIssueFooter";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
  knowledge_points?: number;
  role?: 'user' | 'admin';
  plan?: 'free' | 'plus' | 'pro';
  plan_expires_at?: string | null;
}

interface ActiveSubscription {
  subscription_type: string;
  expires_at: string;
  created_at: string;
}

const Rewards = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [knowledgePoints, setKnowledgePoints] = useState<number>(0);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "MarkIt | Rewards";
    const initializeUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/auth');
          return;
        }

        setUser(session.user);

        // Fetch user profile with knowledge_points, plan, and plan_expires_at
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*, knowledge_points, plan, plan_expires_at')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
        } else if (profileData) {
          setProfile(profileData);
          setKnowledgePoints(profileData.knowledge_points || 0);
        }

        // Fetch active subscription
        const { data: subscriptionData } = await supabase
          .rpc('get_active_subscription', { p_user_id: session.user.id });

        if (subscriptionData && subscriptionData !== 'null') {
          setActiveSubscription(subscriptionData as ActiveSubscription);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Subscribe to profile changes to update knowledge points in real-time
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-updates-rewards')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          if (updatedProfile.knowledge_points !== undefined) {
            setKnowledgePoints(updatedProfile.knowledge_points);
          }
          // Update profile with all changes (knowledge_points, plan, plan_expires_at)
          setProfile(prev => prev ? { 
            ...prev, 
            knowledge_points: updatedProfile.knowledge_points,
            plan: updatedProfile.plan,
            plan_expires_at: updatedProfile.plan_expires_at
          } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Calculate effective plan (accounting for expiration)
  const getEffectivePlan = (): 'free' | 'plus' | 'pro' | 'admin' => {
    if (!profile) return 'free';
    if (profile.role === 'admin') return 'admin';
    
    const plan = profile.plan || 'free';
    if (plan === 'free') return 'free';
    
    // Check if plan has expired
    if (profile.plan_expires_at) {
      const expiresAt = new Date(profile.plan_expires_at);
      const now = new Date();
      if (expiresAt < now) {
        return 'free';
      }
    }
    
    return plan;
  };

  // Calculate discount and pricing based on user's plan
  const getPricing = (subscriptionType: 'plus' | 'pro') => {
    const basePrices = {
      plus: 300,
      pro: 900
    };
    
    const effectivePlan = getEffectivePlan();
    
    // Discounts based on plan
    const discounts: Record<string, { plus: number; pro: number }> = {
      plus: { plus: 100, pro: 200 }, // Plus plan: 100 off Plus, 200 off Pro
      pro: { plus: 100, pro: 250 },   // Pro plan: 100 off Plus, 250 off Pro
      admin: { plus: 0, pro: 0 },      // Admin gets no discount (already unlimited)
      free: { plus: 0, pro: 0 }        // Free plan gets no discount
    };
    
    const discount = discounts[effectivePlan]?.[subscriptionType] || 0;
    const originalPrice = basePrices[subscriptionType];
    const discountedPrice = originalPrice - discount;
    
    return {
      originalPrice,
      discountedPrice,
      discount,
      hasDiscount: discount > 0,
      discountLabel: effectivePlan === 'plus' ? 'Plus Member Discount' : effectivePlan === 'pro' ? 'Pro Member Discount' : null
    };
  };

  const handleRedeem = async (subscriptionType: 'plus' | 'pro') => {
    if (!user) return;

    const pricing = getPricing(subscriptionType);
    const cost = pricing.discountedPrice;

    if (knowledgePoints < cost) {
      toast({
        title: "Insufficient Points",
        description: `You need ${cost} Knowledge Points to redeem ${subscriptionType === 'plus' ? 'Plus' : 'Pro'} subscription. You currently have ${knowledgePoints} points.`,
        variant: "destructive"
      });
      return;
    }

    setIsRedeeming(subscriptionType);

    try {
      const { data, error } = await supabase
        .rpc('redeem_subscription', {
          p_subscription_type: subscriptionType,
          p_knowledge_points_cost: cost
        });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        setKnowledgePoints(data.remaining_points);
        
        // Update profile state with new plan
        if (profile) {
          setProfile({
            ...profile,
            knowledge_points: data.remaining_points,
            plan: data.plan || subscriptionType,
            plan_expires_at: data.expires_at
          });
        }
        
        // Refresh active subscription
        const { data: subscriptionData } = await supabase
          .rpc('get_active_subscription', { p_user_id: user.id });

        if (subscriptionData && subscriptionData !== 'null') {
          setActiveSubscription(subscriptionData as ActiveSubscription);
        }

        // Refresh profile from database to ensure we have latest plan info
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('plan, plan_expires_at, knowledge_points')
          .eq('id', user.id)
          .single();

        if (updatedProfile) {
          setProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
        }

        const planName = data.plan === 'pro' ? 'Pro' : data.plan === 'plus' ? 'Plus' : 'Free';
        toast({
          title: "Subscription Redeemed! 🎉",
          description: `You've successfully redeemed ${subscriptionType === 'plus' ? 'Plus' : 'Pro'} subscription! Your plan is now ${planName} and expires on ${new Date(data.expires_at).toLocaleDateString()}.`,
        });
      } else {
        throw new Error(data?.error || 'Failed to redeem subscription');
      }
    } catch (error: any) {
      console.error('Error redeeming subscription:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to redeem subscription",
        variant: "destructive"
      });
    } finally {
      setIsRedeeming(null);
    }
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.first_name) {
      return profile.first_name[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const formatExpirationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-home-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-home-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-home-surface/80 dark:bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-1.5">
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary " />
              </div>
              <span className="text-xl font-bold text-home-foreground ">MarkIt</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-2">
              <Link to="/app">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Dashboard</Button>
              </Link>
              <Link to="/communities">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
              </Link>
              <Link to="/app/rewards">
                <Button variant="ghost" className="text-home-foreground hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 hover:border-purple-500/50 transition-all duration-300">
                  <Trophy className="w-5 h-5" />
                </Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.image_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} />
              <AvatarFallback className="bg-home-primary text-white text-sm font-medium">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {/* Header Section */}
            <div>
              <h1 className="text-3xl font-bold text-home-foreground mb-2">Rewards Store</h1>
              <p className="text-gray-600 dark:text-gray-400">Redeem your Knowledge Points for premium subscriptions</p>
            </div>

            {/* Current Balance Card */}
            <Card className="p-6 bg-gradient-to-br from-purple-500/10 via-white/50 dark:via-home-surface/50 to-purple-500/5 backdrop-blur-md border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 backdrop-blur-sm flex items-center justify-center">
                    <Waypoints className="w-8 h-8 text-purple-600 dark:text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Your Knowledge Points</p>
                    <p className="text-4xl font-bold text-home-foreground">{knowledgePoints}</p>
                  </div>
                </div>
                {activeSubscription && (
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-2">
                      <Crown className="w-3 h-3 mr-1" />
                      Active: {activeSubscription.subscription_type === 'plus' ? 'Plus' : 'Pro'}
                    </Badge>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Expires {formatExpirationDate(activeSubscription.expires_at)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Active Subscription Notice */}
            {activeSubscription && (
              <Card className="p-4 bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-semibold text-home-foreground">
                      You have an active {activeSubscription.subscription_type === 'plus' ? 'Plus' : 'Pro'} subscription
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your subscription will expire on {formatExpirationDate(activeSubscription.expires_at)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Subscription Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Plus Subscription */}
              <Card className="p-6 bg-card border border-border hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-home-foreground">Plus</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">1 Month Subscription</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {(() => {
                    const pricing = getPricing('plus');
                    return (
                      <div className="space-y-2">
                        {pricing.hasDiscount && pricing.discountLabel && (
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 pointer-events-none cursor-default">
                            {pricing.discountLabel}
                          </Badge>
                        )}
                        <div className="flex items-baseline gap-2">
                          {pricing.hasDiscount ? (
                            <>
                              <span className="text-3xl font-bold text-home-foreground">{pricing.discountedPrice}</span>
                              <span className="text-xl font-semibold text-gray-400 line-through">{pricing.originalPrice}</span>
                            </>
                          ) : (
                            <span className="text-3xl font-bold text-home-foreground">{pricing.originalPrice}</span>
                          )}
                          <span className="text-gray-600 dark:text-gray-400">Knowledge Points</span>
                        </div>
                        {pricing.hasDiscount && (
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            Save {pricing.discount} points!
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Premium features included:
                    </p>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Enhanced AI features
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Priority support
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Advanced analytics
                      </li>
                    </ul>
                    <Link to="/pricing" className="block mt-3">
                      <Button variant="ghost" size="sm" className="w-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                        See more features
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleRedeem('plus')}
                    disabled={isRedeeming !== null || knowledgePoints < getPricing('plus').discountedPrice}
                  >
                    {isRedeeming === 'plus' ? (
                      <>Processing...</>
                    ) : knowledgePoints < getPricing('plus').discountedPrice ? (
                      <>Need {getPricing('plus').discountedPrice - knowledgePoints} more points</>
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-2" />
                        Redeem Now
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* Pro Subscription */}
              <Card className="p-6 bg-card border border-border hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-home-foreground">Pro</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">1 Month Subscription</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {(() => {
                    const pricing = getPricing('pro');
                    return (
                      <div className="space-y-2">
                        {pricing.hasDiscount && pricing.discountLabel && (
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 pointer-events-none cursor-default">
                            {pricing.discountLabel}
                          </Badge>
                        )}
                        <div className="flex items-baseline gap-2">
                          {pricing.hasDiscount ? (
                            <>
                              <span className="text-3xl font-bold text-home-foreground">{pricing.discountedPrice}</span>
                              <span className="text-xl font-semibold text-gray-400 line-through">{pricing.originalPrice}</span>
                            </>
                          ) : (
                            <span className="text-3xl font-bold text-home-foreground">{pricing.originalPrice}</span>
                          )}
                          <span className="text-gray-600 dark:text-gray-400">Knowledge Points</span>
                        </div>
                        {pricing.hasDiscount && (
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            Save {pricing.discount} points!
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      All premium features included:
                    </p>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Everything in Plus
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Unlimited AI queries
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Advanced collaboration tools
                      </li>
                    </ul>
                    <Link to="/pricing" className="block mt-3">
                      <Button variant="ghost" size="sm" className="w-full text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-500/10">
                        See more features
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <Button
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    onClick={() => handleRedeem('pro')}
                    disabled={isRedeeming !== null || knowledgePoints < getPricing('pro').discountedPrice}
                  >
                    {isRedeeming === 'pro' ? (
                      <>Processing...</>
                    ) : knowledgePoints < getPricing('pro').discountedPrice ? (
                      <>Need {getPricing('pro').discountedPrice - knowledgePoints} more points</>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 mr-2" />
                        Redeem Now
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Info Card */}
            <Card className="p-6 bg-card border border-border">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-home-foreground mb-2">How it works</h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>• Subscriptions last for 1 month from the date of purchase</li>
                    <li>• Knowledge Points are deducted immediately upon redemption</li>
                    <li>• Premium features will be available once subscriptions are fully implemented</li>
                    <li>• You can redeem multiple subscriptions - they will stack</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ReportIssueFooter />
    </div>
  );
};

export default Rewards;


import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, LogOut, Shield, CreditCard, Crown, Gift, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { UserStatsView } from "./UserStatsView";
import SubscriptionDetailsView from "./SubscriptionDetailsView";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'plus' | 'pro';
  plan_expires_at?: string | null;
  profile_visible_in_communities?: boolean;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Get user profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Failed to load profile information",
          variant: "destructive",
        });
      } else if (!profileData) {
        // No profile exists, create one
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email!,
            first_name: session.user.user_metadata?.first_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            last_name: session.user.user_metadata?.last_name || '',
            image_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
          });

        if (createError) {
          console.error('Error creating profile:', createError);
          toast({
            title: "Error",
            description: "Failed to create profile",
            variant: "destructive",
          });
        } else {
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(newProfile);
        }
      } else {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "Failed to load user information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const handleProfileVisibilityToggle = async (visible: boolean) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_visible_in_communities: visible })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      setProfile({ ...profile, profile_visible_in_communities: visible });
      toast({
        title: "Privacy Updated",
        description: visible 
          ? "Your profile is now visible in communities and discussions"
          : "Your profile is now hidden in communities and discussions",
      });
    } catch (error: any) {
      console.error('Error updating profile visibility:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update privacy settings",
        variant: "destructive",
      });
    }
  };

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.first_name) {
      return profile.first_name;
    }
    if (user?.user_metadata?.name) {
      return user.user_metadata.name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your account and view your statistics
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="account" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="account" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage 
                        src={profile?.image_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} 
                        alt={getDisplayName()} 
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg font-medium">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">{getDisplayName()}</h3>
                      {profile?.username && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            @{profile.username}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Account Information */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Account Information</h4>
                    
                    <div className="space-y-3">
                      {profile?.username && (
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Username</p>
                            <p className="text-sm text-muted-foreground">@{profile.username}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Member since</p>
                          <p className="text-sm text-muted-foreground">
                            {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="privacy" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Profile Visibility
                    </h4>
                    
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="profile-visibility" className="text-base">
                            Make profile viewable in communities
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            When enabled, your name will be clickable in communities and discussions, allowing others to view your profile. When disabled, your name won't be clickable in these areas. Your profile will always be visible to your friends.
                          </p>
                        </div>
                        <Switch
                          id="profile-visibility"
                          checked={profile?.profile_visible_in_communities ?? true}
                          onCheckedChange={handleProfileVisibilityToggle}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-0">
              <SubscriptionDetailsView userId={user?.id} />
            </TabsContent>

            <TabsContent value="stats" className="mt-0">
              <UserStatsView />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;

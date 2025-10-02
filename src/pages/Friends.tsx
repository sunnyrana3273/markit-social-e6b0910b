import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  BookOpen, 
  Users, 
  Plus, 
  Search,
  MessageSquare,
  UserPlus,
  Settings,
  Bell,
  Clock,
  Trophy,
  Zap,
  BookUp,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import SettingsModal from "@/components/SettingsModal";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

interface FriendWithMetrics {
  friend_id: string;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email: string;
  };
  daily_metrics?: {
    problems_completed: number;
    minutes_studied: number;
  }[];
}

// Username validation schema
const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be less than 30 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
  .trim();

interface SearchedUser {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

const Friends = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendsWithMetrics, setFriendsWithMetrics] = useState<FriendWithMetrics[]>([]);
  const [searchUsername, setSearchUsername] = useState("");
  const [searchedUser, setSearchedUser] = useState<SearchedUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [isFriendRequestsExpanded, setIsFriendRequestsExpanded] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profileData && !error) {
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

        if (!createError) {
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(newProfile);
        }
      } else if (profileData) {
        setProfile(profileData);
      }

      // Fetch friends with their metrics
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', session.user.id)
        .eq('status', 'accepted');

      if (friendsData && !friendsError && friendsData.length > 0) {
        const friendIds = friendsData.map(f => f.friend_id);
        
        // Fetch profiles for all friends
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, image_url, email')
          .in('id', friendIds);

        if (profilesData) {
          // Fetch metrics for each friend
          const friendsWithMetricsData = await Promise.all(
            profilesData.map(async (profile) => {
              const { data: metricsData } = await supabase
                .from('daily_metrics')
                .select('problems_completed, minutes_studied')
                .eq('user_id', profile.id)
                .order('date', { ascending: false })
                .limit(7); // Last 7 days

              return {
                friend_id: profile.id,
                profiles: profile,
                daily_metrics: metricsData || []
              };
            })
          );

          setFriendsWithMetrics(friendsWithMetricsData);
        }
      }

      // Fetch incoming friend requests (where current user is the friend_id)
      const { data: incomingFriendsData, error: incomingFriendsError } = await supabase
        .from('friends')
        .select('user_id, created_at')
        .eq('friend_id', session.user.id)
        .eq('status', 'pending');

      if (incomingFriendsData && !incomingFriendsError && incomingFriendsData.length > 0) {
        console.log('Found incoming friend requests:', incomingFriendsData);
        const userIds = incomingFriendsData.map(req => req.user_id);
        const { data: incomingProfilesData } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, image_url, email')
          .in('id', userIds);

        console.log('Found incoming profiles:', incomingProfilesData);
        if (incomingProfilesData) {
          const incomingRequests = incomingFriendsData.map(friends => {
            const profile = incomingProfilesData.find(p => p.id === friends.user_id);
            return { ...friends, profiles: profile };
          });
          console.log('Setting incoming requests:', incomingRequests);
          setIncomingRequests(incomingRequests);
        }
      } else {
        console.log('No incoming friend requests found or error:', { incomingFriendsData, incomingFriendsError });
      }

      // Fetch outgoing friend requests (where current user is the user_id)
      const { data: outgoingFriendsData, error: outgoingFriendsError } = await supabase
        .from('friends')
        .select('friend_id, created_at')
        .eq('user_id', session.user.id)
        .eq('status', 'pending');

      if (outgoingFriendsData && !outgoingFriendsError && outgoingFriendsData.length > 0) {
        const friendIds = outgoingFriendsData.map(req => req.friend_id);
        const { data: outgoingProfilesData } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, image_url, email')
          .in('id', friendIds);

        if (outgoingProfilesData) {
          const outgoingRequests = outgoingFriendsData.map(friends => {
            const profile = outgoingProfilesData.find(p => p.id === friends.friend_id);
            return { ...friends, profiles: profile };
          });
          setOutgoingRequests(outgoingRequests);
        }
      }
    };

    initializeUser();
  }, [navigate]);

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  const getMyInitials = () => {
    return getInitials(profile?.first_name, profile?.last_name, user?.email);
  };

  // Calculate leaderboard with scores
  const leaderboard = friendsWithMetrics
    .map(friend => {
      const totalProblems = friend.daily_metrics?.reduce((sum, day) => sum + day.problems_completed, 0) || 0;
      const totalMinutes = friend.daily_metrics?.reduce((sum, day) => sum + day.minutes_studied, 0) || 0;
      // Equal weighting: average of both metrics
      const score = (totalProblems + totalMinutes) / 2;
      
      return {
        id: friend.friend_id,
        name: `${friend.profiles.first_name || ''} ${friend.profiles.last_name || ''}`.trim() || friend.profiles.email,
        image_url: friend.profiles.image_url,
        initials: getInitials(friend.profiles.first_name, friend.profiles.last_name, friend.profiles.email),
        totalProblems,
        totalMinutes,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10

  const getRankClass = (index: number) => {
    if (index === 0) return "rank-1"; // Gold
    if (index === 1) return "rank-2"; // Silver
    if (index === 2) return "rank-3"; // Bronze
    return "rank-other";
  };

  const getRankColor = (index: number) => {
    if (index === 0) return "from-yellow-400 via-yellow-500 to-yellow-600";
    if (index === 1) return "from-gray-300 via-gray-400 to-gray-500";
    if (index === 2) return "from-amber-600 via-amber-700 to-amber-800";
    return "from-blue-400 via-blue-500 to-blue-600";
  };

  const handleSearchUser = async () => {
    if (!searchUsername.trim()) {
      setSearchError("Please enter a username");
      setSearchedUser(null);
      return;
    }

    // Validate username format
    try {
      usernameSchema.parse(searchUsername);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setSearchError(error.errors[0].message);
        setSearchedUser(null);
        return;
      }
    }

    setIsSearching(true);
    setSearchError("");
    setSearchedUser(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, image_url, email')
        .eq('username', searchUsername.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setSearchError("User not found");
        setSearchedUser(null);
      } else if (data.id === user?.id) {
        setSearchError("You cannot add yourself as a friend");
        setSearchedUser(null);
      } else {
        // Check if already friends or request pending
        const { data: existingFriend } = await supabase
          .from('friends')
          .select('status')
          .or(`and(user_id.eq.${user?.id},friend_id.eq.${data.id}),and(user_id.eq.${data.id},friend_id.eq.${user?.id})`)
          .maybeSingle();

        if (existingFriend) {
          if (existingFriend.status === 'accepted') {
            setSearchError("Already friends with this user");
          } else {
            setSearchError("Friend request already pending");
          }
          setSearchedUser(null);
        } else {
          setSearchedUser(data as SearchedUser);
        }
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchError("Failed to search for user");
      setSearchedUser(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user || !searchedUser) return;

    try {
      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: searchedUser.id,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Friend request sent to ${searchedUser.username}!`
      });

      // Refresh outgoing requests to show the new request
      const { data: outgoingFriendsData } = await supabase
        .from('friends')
        .select('friend_id, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (outgoingFriendsData && outgoingFriendsData.length > 0) {
        const friendIds = outgoingFriendsData.map(req => req.friend_id);
        const { data: outgoingProfilesData } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, image_url, email')
          .in('id', friendIds);

        if (outgoingProfilesData) {
          const outgoingRequests = outgoingFriendsData.map(friends => {
            const profile = outgoingProfilesData.find(p => p.id === friends.friend_id);
            return { ...friends, profiles: profile };
          });
          setOutgoingRequests(outgoingRequests);
        }
      }

      setIsAddFriendOpen(false);
      setSearchUsername("");
      setSearchedUser(null);
      setSearchError("");
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    }
  };

  const handleAcceptRequest = async (userId: string, friendId: string) => {
    try {
      // Update the friend request to accepted
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      if (updateError) throw updateError;

      // Create the reciprocal friendship
      const { error: insertError } = await supabase
        .from('friends')
        .insert({
          user_id: friendId,
          friend_id: userId,
          status: 'accepted'
        });

      if (insertError) throw insertError;

      // Remove from incoming requests
      setIncomingRequests(prev => prev.filter(req => req.user_id !== userId));
      
      toast({
        title: "Success",
        description: "Friend request accepted!"
      });

      // Refresh the page to show updated friends list
      window.location.reload();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast({
        title: "Error",
        description: "Failed to accept friend request",
        variant: "destructive"
      });
    }
  };

  const handleDeclineRequest = async (userId: string, friendId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      if (error) throw error;

      // Remove from incoming requests
      setIncomingRequests(prev => prev.filter(req => req.user_id !== userId));
      
      toast({
        title: "Success",
        description: "Friend request declined"
      });
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast({
        title: "Error",
        description: "Failed to decline friend request",
        variant: "destructive"
      });
    }
  };

  const handleCancelRequest = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user?.id)
        .eq('friend_id', friendId);

      if (error) throw error;

      // Remove from outgoing requests
      setOutgoingRequests(prev => prev.filter(req => req.friend_id !== friendId));
      
      toast({
        title: "Success",
        description: "Friend request cancelled"
      });
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to cancel friend request",
        variant: "destructive"
      });
    }
  };

  // Mock data - will be replaced with real data from Supabase
  const friends: any[] = [];

  const friendRequests: any[] = [];

  const onlineFriends = friends.filter(f => f.status === "online").length;
  const studyingFriends = friends.filter(f => f.status === "studying").length;

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-1">
              <div className="w-8 h-8 flex items-center justify-center">
                <BookUp className="w-5 h-5 text-home-primary " />
              </div>
              <span className="text-xl font-bold text-home-foreground ">MarkIt</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Dashboard</Button>
              </Link>
              <Link to="/communities">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface bg-home-surface">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface relative">
                  <Bell className="w-5 h-5" />
                  {incomingRequests.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-medium">
                      {incomingRequests.length}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 border-b">
                  <h3 className="font-semibold text-home-foreground">Notifications</h3>
                </div>
                {incomingRequests.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    {incomingRequests.slice(0, 5).map((request) => (
                      <DropdownMenuItem key={request.user_id} className="p-3">
                        <div className="flex items-center gap-3 w-full">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={request.profiles?.image_url} />
                            <AvatarFallback className="bg-home-primary text-white text-xs">
                              {getInitials(request.profiles?.first_name, request.profiles?.last_name, request.profiles?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-home-foreground">
                              {request.profiles?.username || request.profiles?.first_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-600">wants to be your friend</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptRequest(request.user_id, request.profiles?.id);
                              }}
                              className="h-6 w-6 p-0 bg-green-500 hover:bg-green-600"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeclineRequest(request.user_id, request.profiles?.id);
                              }}
                              className="h-6 w-6 p-0 bg-red-500 hover:bg-red-600"
                            >
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ) : (
                  <DropdownMenuItem className="p-4 text-center text-gray-500">
                    No notifications
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-home-foreground hover:bg-home-surface"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.image_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} />
              <AvatarFallback className="bg-home-primary text-white text-sm font-medium">
                {getMyInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-home-foreground">Friends</h1>
                <p className="text-gray-600">Connect and study with your learning partners</p>
              </div>
              <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Add Friend
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Friend</DialogTitle>
                    <DialogDescription>
                      Search for a user by their username to send a friend request
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter username..."
                        value={searchUsername}
                        onChange={(e) => {
                          setSearchUsername(e.target.value);
                          setSearchError("");
                          setSearchedUser(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchUser();
                          }
                        }}
                        maxLength={30}
                      />
                      <Button 
                        onClick={handleSearchUser}
                        disabled={isSearching || !searchUsername.trim()}
                      >
                        {isSearching ? "Searching..." : "Search"}
                      </Button>
                    </div>

                    {searchError && (
                      <p className="text-sm text-red-600">{searchError}</p>
                    )}

                    {searchedUser && (
                      <Card className="p-4 border border-home-primary/20 bg-home-surface/30">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={searchedUser.image_url || undefined} />
                            <AvatarFallback className="bg-home-primary text-white">
                              {getInitials(searchedUser.first_name, searchedUser.last_name, searchedUser.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-home-foreground">
                              {searchedUser.first_name && searchedUser.last_name
                                ? `${searchedUser.first_name} ${searchedUser.last_name}`
                                : searchedUser.username}
                            </h3>
                            <p className="text-sm text-gray-600">@{searchedUser.username}</p>
                          </div>
                          <Button 
                            onClick={handleSendFriendRequest}
                            size="sm"
                            className="bg-home-primary hover:bg-home-primary-hover text-white"
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Add Friend
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search */}
            <Card className="p-4 bg-white border border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input 
                  placeholder="Search friends..." 
                  className="pl-10 border-gray-200 focus:border-home-primary"
                />
              </div>
            </Card>

            {/* Friends Leaderboard */}
            <Card className="p-6 bg-gradient-to-br from-home-primary/5 to-home-secondary/5 border border-home-primary/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-home-foreground flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    Friends Leaderboard
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Last 7 days performance</p>
                </div>
              </div>

              {leaderboard.length > 0 ? (
                <>
                  <style>{`
                    .rank-1:hover {
                      transform: translateY(-8px) scale(1.03);
                      box-shadow: 0 20px 40px -10px rgba(234, 179, 8, 0.5), 0 0 60px rgba(234, 179, 8, 0.3);
                    }
                    .rank-2:hover {
                      transform: translateY(-6px) scale(1.025);
                      box-shadow: 0 15px 35px -8px rgba(156, 163, 175, 0.4), 0 0 40px rgba(156, 163, 175, 0.25);
                    }
                    .rank-3:hover {
                      transform: translateY(-5px) scale(1.02);
                      box-shadow: 0 12px 30px -8px rgba(180, 83, 9, 0.4), 0 0 30px rgba(180, 83, 9, 0.2);
                    }
                    .rank-other:hover {
                      transform: translateY(-3px) scale(1.01);
                      box-shadow: 0 8px 20px -5px rgba(59, 130, 246, 0.3);
                    }
                    .leaderboard-item {
                      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .rank-badge {
                      transition: all 0.3s ease;
                    }
                    .rank-1:hover .rank-badge {
                      transform: rotate(360deg) scale(1.2);
                    }
                    .rank-2:hover .rank-badge {
                      transform: rotate(180deg) scale(1.15);
                    }
                    .rank-3:hover .rank-badge {
                      transform: rotate(90deg) scale(1.1);
                    }
                  `}</style>
                  <div className="space-y-3">
                    {leaderboard.map((friend, index) => (
                      <div
                        key={friend.id}
                        className={`leaderboard-item ${getRankClass(index)} p-5 rounded-xl bg-white/80 backdrop-blur-sm border-2 cursor-pointer ${
                          index === 0 ? 'border-yellow-400' :
                          index === 1 ? 'border-gray-400' :
                          index === 2 ? 'border-amber-700' :
                          'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Rank Badge */}
                          <div className={`rank-badge flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${getRankColor(index)} flex items-center justify-center font-bold text-white text-lg shadow-lg`}>
                            {index + 1}
                          </div>
                          
                          {/* Avatar */}
                          <Avatar className="w-12 h-12 border-2 border-white shadow-md">
                            <AvatarImage src={friend.image_url || undefined} />
                            <AvatarFallback className="bg-home-primary text-white font-medium">
                              {friend.initials}
                            </AvatarFallback>
                          </Avatar>
                          
                          {/* Friend Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-home-foreground text-lg truncate">{friend.name}</h3>
                            <div className="flex items-center gap-4 mt-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Trophy className="w-4 h-4 text-orange-500" />
                                <span className="font-semibold text-orange-600">{friend.totalProblems}</span>
                                <span className="text-gray-500">problems</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="w-4 h-4 text-blue-500" />
                                <span className="font-semibold text-blue-600">{friend.totalMinutes}</span>
                                <span className="text-gray-500">min</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Score */}
                          <div className="flex-shrink-0 text-right">
                            <div className={`text-2xl font-bold bg-gradient-to-r ${getRankColor(index)} bg-clip-text text-transparent`}>
                              {friend.score.toFixed(0)}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">score</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No friends to beat yet!</h3>
                  <p className="text-sm text-gray-500 mb-4">Add friends to see who's studying the most</p>
                  <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friends
                  </Button>
                </div>
              )}
            </Card>

            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <Card className="p-6 bg-white border border-gray-200">
                <h2 className="text-xl font-semibold text-home-foreground mb-4">Friend Requests</h2>
                <div className="space-y-4">
                  {friendRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 bg-home-surface rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-home-secondary flex items-center justify-center">
                          <span className="text-sm font-medium text-white">{request.avatar}</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-home-foreground">{request.name}</h3>
                          <p className="text-sm text-gray-600">{request.mutualFriends} mutual friends</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-home-primary hover:bg-home-primary-hover text-white">
                          Accept
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-300 text-gray-600 hover:bg-gray-100">
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Friends List */}
            <Card className="p-6 bg-white border border-gray-200">
              <h2 className="text-xl font-semibold text-home-foreground mb-4">All Friends ({friends.length})</h2>
              {friends.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {friends.map((friend) => (
                    <div key={friend.id} className="p-4 bg-home-surface rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-home-secondary flex items-center justify-center">
                            <span className="text-sm font-medium text-white">{friend.avatar}</span>
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                            friend.status === 'online' ? 'bg-green-500' : 
                            friend.status === 'studying' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-home-foreground truncate">{friend.name}</h3>
                            <Button variant="ghost" size="sm" className="text-home-foreground hover:bg-home-surface">
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="capitalize">{friend.status}</span>
                              <span>•</span>
                              <span>{friend.lastActive}</span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs">
                              <div className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-orange-500" />
                                <span>{friend.studyStreak} day streak</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Trophy className="w-3 h-3 text-yellow-500" />
                                <span>{friend.sessionsThisWeek} sessions</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {friend.favoriteSubjects.slice(0, 2).map((subject, index) => (
                                <Badge key={index} className="bg-home-primary/10 text-home-primary border-home-primary/20 text-xs">
                                  {subject}
                                </Badge>
                              ))}
                            </div>
                            
                            {friend.mutualFriends > 0 && (
                              <p className="text-xs text-gray-500">{friend.mutualFriends} mutual friends</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">No friends yet</p>
                  <p className="text-sm">Start connecting with other students to build your study network!</p>
                </div>
              )}
            </Card>

            {/* Compact Friend Requests Section */}
            {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
              <Card className="p-6 bg-white border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-home-foreground">
                    Friend Requests ({incomingRequests.length + outgoingRequests.length})
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFriendRequestsExpanded(!isFriendRequestsExpanded)}
                    className="text-home-foreground"
                  >
                    {isFriendRequestsExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {isFriendRequestsExpanded && (
                  <div className="space-y-4">
                    {/* Incoming Requests */}
                    {incomingRequests.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Incoming ({incomingRequests.length})</h3>
                        <div className="space-y-2">
                          {incomingRequests.map((request) => (
                            <div key={request.user_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={request.profiles?.image_url} />
                                <AvatarFallback className="bg-home-primary text-white">
                                  {getInitials(request.profiles?.first_name, request.profiles?.last_name, request.profiles?.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-home-foreground truncate">
                                  {request.profiles?.username || request.profiles?.first_name || 'Unknown User'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Sent {new Date(request.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptRequest(request.user_id, request.profiles?.id)}
                                  className="bg-green-500 hover:bg-green-600 text-white h-8 px-3"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeclineRequest(request.user_id, request.profiles?.id)}
                                  className="border-gray-300 text-gray-600 hover:bg-gray-100 h-8 px-3"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Decline
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outgoing Requests */}
                    {outgoingRequests.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Outgoing ({outgoingRequests.length})</h3>
                        <div className="space-y-2">
                          {outgoingRequests.map((request) => (
                            <div key={request.friend_id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={request.profiles?.image_url} />
                                <AvatarFallback className="bg-blue-500 text-white">
                                  {getInitials(request.profiles?.first_name, request.profiles?.last_name, request.profiles?.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-home-foreground truncate">
                                  {request.profiles?.username || request.profiles?.first_name || 'Unknown User'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Sent {new Date(request.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelRequest(request.friend_id)}
                                className="border-gray-300 text-gray-600 hover:bg-gray-100 h-8 px-3"
                              >
                                Cancel
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friends Stats */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="font-semibold text-home-foreground mb-4">Friends Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Friends</span>
                  <span className="font-semibold text-home-foreground">{friends.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Online Now</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-semibold text-home-foreground">{onlineFriends}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Currently Studying</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="font-semibold text-home-foreground">{studyingFriends}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Study Groups */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="font-semibold text-home-foreground mb-4">Active Study Groups</h3>
              <div className="text-center py-8 text-gray-600">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-2">No study groups yet</p>
                <p className="text-xs">Create or join a study group to collaborate!</p>
              </div>
              <Button variant="outline" className="w-full mt-4 border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                Create Study Group
              </Button>
            </Card>

            {/* Friend Activity */}
            <Card className="p-6 bg-home-primary text-white">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Stay Connected</h3>
                <p className="text-sm opacity-90">Study together and motivate each other to reach your goals!</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default Friends;
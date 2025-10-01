import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Friends = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Get user's display name and avatar
  const getUserDisplayName = () => {
    if (!user) return "User";
    return user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || "User";
  };

  const getUserAvatar = () => {
    if (!user) return null;
    return user.user_metadata?.avatar_url || user.user_metadata?.picture;
  };

  const getUserInitials = () => {
    if (!user) return "U";
    const name = getUserDisplayName();
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || "U";
  };

  // Mock data - will be replaced with real data from Supabase
  const friends = [
    { 
      id: 1, 
      name: "Alex Chen", 
      avatar: "AC", 
      status: "online", 
      lastActive: "now",
      studyStreak: 12,
      mutualFriends: 3,
      favoriteSubjects: ["AP Calculus", "Physics"],
      sessionsThisWeek: 8
    },
    { 
      id: 2, 
      name: "Sarah Kim", 
      avatar: "SK", 
      status: "studying", 
      lastActive: "2 hours ago",
      studyStreak: 7,
      mutualFriends: 5,
      favoriteSubjects: ["Chemistry", "Biology"],
      sessionsThisWeek: 6
    },
    { 
      id: 3, 
      name: "Mike Johnson", 
      avatar: "MJ", 
      status: "offline", 
      lastActive: "1 day ago",
      studyStreak: 3,
      mutualFriends: 2,
      favoriteSubjects: ["SAT Prep", "English"],
      sessionsThisWeek: 4
    },
    { 
      id: 4, 
      name: "Emily Rodriguez", 
      avatar: "ER", 
      status: "online", 
      lastActive: "now",
      studyStreak: 15,
      mutualFriends: 7,
      favoriteSubjects: ["AP History", "Literature"],
      sessionsThisWeek: 10
    },
    { 
      id: 5, 
      name: "David Park", 
      avatar: "DP", 
      status: "studying", 
      lastActive: "30 minutes ago",
      studyStreak: 5,
      mutualFriends: 1,
      favoriteSubjects: ["Computer Science", "Math"],
      sessionsThisWeek: 7
    },
    { 
      id: 6, 
      name: "Lisa Wang", 
      avatar: "LW", 
      status: "offline", 
      lastActive: "3 hours ago",
      studyStreak: 21,
      mutualFriends: 4,
      favoriteSubjects: ["AP Spanish", "Art History"],
      sessionsThisWeek: 5
    }
  ];

  const friendRequests = [
    { id: 1, name: "Jordan Smith", avatar: "JS", mutualFriends: 2 },
    { id: 2, name: "Taylor Brown", avatar: "TB", mutualFriends: 1 },
  ];

  const onlineFriends = friends.filter(f => f.status === "online").length;
  const studyingFriends = friends.filter(f => f.status === "studying").length;

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
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
            <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface">
              <Settings className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-home-primary flex items-center justify-center overflow-hidden">
              {getUserAvatar() ? (
                <img 
                  src={getUserAvatar()} 
                  alt={getUserDisplayName()}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide the image and show initials if it fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={`text-white text-sm font-medium ${getUserAvatar() ? 'hidden' : ''}`}>
                {getUserInitials()}
              </span>
            </div>
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
              <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                <UserPlus className="w-5 h-5 mr-2" />
                Add Friend
              </Button>
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
                              <Badge key={index} className="bg-home-primary/10 text-home-primary border-home-primary/20 text-xs hover:bg-home-primary hover:text-white transition-colors duration-200 cursor-pointer">
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
            </Card>
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
              <div className="space-y-3">
                {[
                  { name: "Calculus Squad", members: 4, active: true },
                  { name: "Physics Partners", members: 3, active: false },
                  { name: "SAT Prep Team", members: 6, active: true }
                ].map((group, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-home-surface rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-home-foreground">{group.name}</p>
                      <p className="text-xs text-gray-600">{group.members} members</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${group.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                View All Groups
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
    </div>
  );
};

export default Friends;
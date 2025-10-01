import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, 
  Users, 
  ChevronRight,
  Star,
  Lock,
  Crown,
  Zap,
  Calculator,
  Atom,
  Globe,
  Microscope,
  Code,
  Palette,
  Music,
  History,
  Map,
  Languages,
  Heart,
  MessageSquare,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  Bookmark,
  Brain,
  Search,
  Filter,
  Plus,
  Settings,
  Bell,
  User,
  LogOut,
  BarChart3
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Communities = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("joined");
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
    // Try multiple possible avatar URL fields from Google OAuth
    return user.user_metadata?.avatar_url || 
           user.user_metadata?.picture || 
           user.user_metadata?.avatar_urls?.google ||
           null;
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

  const joinedCommunities = [
    {
      id: "ap-calculus-ab",
      title: "AP Calculus AB",
      description: "Master differential and integral calculus concepts",
      icon: Calculator,
      members: 1847,
      color: "bg-blue-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Derivatives", "Integrals", "Applications", "Limits"],
      recentActivity: "2 hours ago",
      lastMessage: "Sarah shared a new practice problem",
      unreadCount: 3,
      isOnline: true
    },
    {
      id: "ap-calculus-bc",
      title: "AP Calculus BC",
      description: "Advanced calculus including series and parametric equations",
      icon: Calculator,
      members: 1000,
      color: "bg-blue-600",
      level: "Advanced",
      isPremium: false,
      topics: ["Series", "Parametric", "Polar", "Vector Calculus"],
      recentActivity: "1 hour ago",
      lastMessage: "Mike posted a study guide for the exam",
      unreadCount: 0,
      isOnline: true
    },
    {
      id: "ap-chemistry",
      title: "AP Chemistry",
      description: "Dive deep into chemical reactions and molecular structures",
      icon: Microscope,
      members: 1654,
      color: "bg-green-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Atomic Structure", "Bonding", "Reactions", "Thermodynamics"],
      recentActivity: "3 hours ago",
      lastMessage: "New lab report discussion started",
      unreadCount: 7,
      isOnline: false
    }
  ];

  const recommendedCommunities = [
    {
      id: "ap-biology",
      title: "AP Biology",
      description: "Explore the living world and biological processes",
      icon: Heart,
      members: 1456,
      color: "bg-red-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Cell Biology", "Genetics", "Evolution", "Ecology"],
      recentActivity: "4 hours ago"
    },
    {
      id: "ap-physics-1",
      title: "AP Physics 1: Algebra-Based",
      description: "Explore fundamental physics concepts using algebra",
      icon: Atom,
      members: 1923,
      color: "bg-purple-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Mechanics", "Kinematics", "Dynamics", "Energy"],
      recentActivity: "1 hour ago"
    },
    {
      id: "ap-computer-science-a",
      title: "AP Computer Science A",
      description: "Learn Java programming and object-oriented design",
      icon: Code,
      members: 1234,
      color: "bg-orange-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Java", "OOP", "Data Structures", "Algorithms"],
      recentActivity: "30 minutes ago"
    }
  ];

  const allCommunities = [
    // Math and Computer Science
    {
      id: "ap-calculus-ab",
      title: "AP Calculus AB",
      description: "Master differential and integral calculus concepts",
      icon: Calculator,
      members: 1847,
      color: "bg-blue-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Derivatives", "Integrals", "Applications", "Limits"],
      recentActivity: "2 hours ago"
    },
    {
      id: "ap-calculus-bc",
      title: "AP Calculus BC",
      description: "Advanced calculus including series and parametric equations",
      icon: Calculator,
      members: 1000,
      color: "bg-blue-600",
      level: "Advanced",
      isPremium: false,
      topics: ["Series", "Parametric", "Polar", "Vector Calculus"],
      recentActivity: "1 hour ago"
    },
    {
      id: "ap-computer-science-a",
      title: "AP Computer Science A",
      description: "Learn Java programming and object-oriented design",
      icon: Code,
      members: 1234,
      color: "bg-orange-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Java", "OOP", "Data Structures", "Algorithms"],
      recentActivity: "30 minutes ago"
    },
    {
      id: "ap-computer-science-principles",
      title: "AP Computer Science Principles",
      description: "Explore computational thinking and programming concepts",
      icon: Code,
      members: 856,
      color: "bg-orange-600",
      level: "Advanced",
      isPremium: false,
      topics: ["Computational Thinking", "Programming", "Data", "Internet"],
      recentActivity: "4 hours ago"
    },
    {
      id: "ap-precalculus",
      title: "AP Precalculus",
      description: "Prepare for calculus with advanced mathematical concepts",
      icon: Calculator,
      members: 2341,
      color: "bg-blue-400",
      level: "Advanced",
      isPremium: false,
      topics: ["Functions", "Trigonometry", "Complex Numbers", "Vectors"],
      recentActivity: "3 hours ago"
    },
    {
      id: "ap-statistics",
      title: "AP Statistics",
      description: "Learn statistical analysis and data interpretation",
      icon: BarChart3,
      members: 1456,
      color: "bg-blue-700",
      level: "Advanced",
      isPremium: false,
      topics: ["Data Analysis", "Probability", "Inference", "Regression"],
      recentActivity: "5 hours ago"
    },
    // Sciences
    {
      id: "ap-biology",
      title: "AP Biology",
      description: "Explore the living world and biological processes",
      icon: Heart,
      members: 1456,
      color: "bg-red-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Cell Biology", "Genetics", "Evolution", "Ecology"],
      recentActivity: "4 hours ago"
    },
    {
      id: "ap-chemistry",
      title: "AP Chemistry",
      description: "Dive deep into chemical reactions and molecular structures",
      icon: Microscope,
      members: 1654,
      color: "bg-green-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Atomic Structure", "Bonding", "Reactions", "Thermodynamics"],
      recentActivity: "3 hours ago"
    },
    {
      id: "ap-environmental-science",
      title: "AP Environmental Science",
      description: "Study environmental systems and sustainability",
      icon: Globe,
      members: 987,
      color: "bg-green-600",
      level: "Advanced",
      isPremium: false,
      topics: ["Ecosystems", "Pollution", "Climate", "Sustainability"],
      recentActivity: "6 hours ago"
    },
    {
      id: "ap-physics-1",
      title: "AP Physics 1: Algebra-Based",
      description: "Explore fundamental physics concepts using algebra",
      icon: Atom,
      members: 1923,
      color: "bg-purple-500",
      level: "Advanced",
      isPremium: false,
      topics: ["Mechanics", "Kinematics", "Dynamics", "Energy"],
      recentActivity: "1 hour ago"
    },
    {
      id: "ap-physics-2",
      title: "AP Physics 2: Algebra-Based",
      description: "Advanced physics concepts including fluids and thermodynamics",
      icon: Atom,
      members: 1234,
      color: "bg-purple-600",
      level: "Advanced",
      isPremium: false,
      topics: ["Fluids", "Thermodynamics", "Electricity", "Magnetism"],
      recentActivity: "2 hours ago"
    },
    {
      id: "ap-physics-c-electricity",
      title: "AP Physics C: Electricity & Magnetism",
      description: "Advanced calculus-based electricity and magnetism",
      icon: Atom,
      members: 567,
      color: "bg-purple-700",
      level: "Advanced",
      isPremium: false,
      topics: ["Electrostatics", "Circuits", "Magnetism", "Electromagnetic Induction"],
      recentActivity: "1 day ago"
    },
    {
      id: "ap-physics-c-mechanics",
      title: "AP Physics C: Mechanics",
      description: "Advanced calculus-based mechanics and motion",
      icon: Atom,
      members: 789,
      color: "bg-purple-800",
      level: "Advanced",
      isPremium: false,
      topics: ["Kinematics", "Dynamics", "Work & Energy", "Rotation"],
      recentActivity: "2 days ago"
    }
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Advanced": return "bg-red-100 text-red-800";
      case "Intermediate": return "bg-yellow-100 text-yellow-800";
      case "Beginner": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/app" className="text-gray-600 hover:text-home-foreground transition-colors">
              Dashboard
            </Link>
            <Link to="/communities" className="text-home-primary font-medium">
              Communities
            </Link>
            <Link to="/friends" className="text-gray-600 hover:text-home-foreground transition-colors">
              Friends
            </Link>
          </nav>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-home-foreground">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-home-foreground">
              <Settings className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-home-primary rounded-full flex items-center justify-center overflow-hidden">
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
              <span className="text-sm font-medium text-home-foreground hidden sm:block">{getUserDisplayName()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Page Header */}
      <section className="py-8 bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-home-foreground mb-2">Communities</h1>
              <p className="text-gray-600">Connect with study groups and discover new learning communities</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search communities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-80"
                />
              </div>
              <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Community
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 bg-home-surface min-h-screen">
        <div className="container mx-auto px-4">
          {/* Tabs */}
          <div className="flex space-x-1 mb-8 bg-white p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("joined")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "joined"
                  ? "bg-home-primary text-white"
                  : "text-gray-600 hover:text-home-foreground"
              }`}
            >
              My Communities ({joinedCommunities.length})
            </button>
            <button
              onClick={() => setActiveTab("recommended")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "recommended"
                  ? "bg-home-primary text-white"
                  : "text-gray-600 hover:text-home-foreground"
              }`}
            >
              Recommended
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-home-primary text-white"
                  : "text-gray-600 hover:text-home-foreground"
              }`}
            >
              Browse All
            </button>
          </div>

          {/* Joined Communities */}
          {activeTab === "joined" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-home-foreground">My Communities</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {joinedCommunities.map((community) => {
                  const IconComponent = community.icon;
                  return (
                    <Card key={community.id} className="p-6 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-lg group cursor-pointer border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 ${community.color} rounded-lg flex items-center justify-center`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          {community.isOnline && (
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          )}
                          {community.unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">
                              {community.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-semibold text-home-foreground mb-2">{community.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">{community.description}</p>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <Badge className={`${getLevelColor(community.level)} hover:opacity-80 transition-opacity duration-200 cursor-pointer`}>
                          {community.level}
                        </Badge>
                        {community.isPremium && (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors duration-200 cursor-pointer">
                            <Crown className="w-3 h-3 mr-1" />
                            Premium
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {community.members.toLocaleString()} members
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {community.recentActivity}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{community.lastMessage}</p>
                      </div>
                      
                      <Button className="w-full bg-home-primary hover:bg-home-primary-hover text-white">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Open Chat
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended Communities */}
          {activeTab === "recommended" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-home-foreground">Recommended for You</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedCommunities.map((community) => {
                  const IconComponent = community.icon;
                  return (
                    <Card key={community.id} className="p-6 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-lg group cursor-pointer border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 ${community.color} rounded-lg flex items-center justify-center`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        {community.isPremium && (
                          <Crown className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      
                      <h3 className="text-xl font-semibold text-home-foreground mb-2">{community.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">{community.description}</p>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <Badge className={`${getLevelColor(community.level)} hover:opacity-80 transition-opacity duration-200 cursor-pointer`}>
                          {community.level}
                        </Badge>
                        {community.isPremium && (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors duration-200 cursor-pointer">
                            <Crown className="w-3 h-3 mr-1" />
                            Premium
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {community.members.toLocaleString()} members
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {community.recentActivity}
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        variant={community.isPremium ? "outline" : "default"}
                        disabled={community.isPremium}
                      >
                        {community.isPremium ? (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Premium Required
                          </>
                        ) : (
                          "Join Community"
                        )}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Browse All Communities */}
          {activeTab === "all" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-home-foreground">All Communities</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allCommunities.map((community) => {
                  const IconComponent = community.icon;
                  return (
                    <Card key={community.id} className="p-6 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-lg group cursor-pointer border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 ${community.color} rounded-lg flex items-center justify-center`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        {community.isPremium && (
                          <Crown className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      
                      <h3 className="text-lg font-semibold text-home-foreground mb-2">{community.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 leading-relaxed">{community.description}</p>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <Badge className={`${getLevelColor(community.level)} hover:opacity-80 transition-opacity duration-200 cursor-pointer`}>
                          {community.level}
                        </Badge>
                        {community.isPremium && (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors duration-200 cursor-pointer">
                            <Crown className="w-3 h-3 mr-1" />
                            Premium
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {community.members.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {community.recentActivity}
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        variant={community.isPremium ? "outline" : "default"}
                        disabled={community.isPremium}
                      >
                        {community.isPremium ? (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Premium Required
                          </>
                        ) : (
                          "Join Community"
                        )}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default Communities;
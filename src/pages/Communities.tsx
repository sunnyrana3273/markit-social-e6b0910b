import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  BookOpen, 
  Users,
  Plus, 
  Search,
  Bell,
  Settings,
  Book,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import SettingsModal from "@/components/SettingsModal";
import NotificationDropdown from "@/components/NotificationDropdown";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

interface JoinedCommunity {
  id: string;
  course_communities: {
    id: string;
    course_name: string;
    course_category: string;
    description: string;
  };
  joined_at: string;
}

const Communities = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([]);
  const [isCommunitiesMinimized, setIsCommunitiesMinimized] = useState(false);
  const [isMyCommunitiesMinimized, setIsMyCommunitiesMinimized] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    document.title = "MarkIt | Communities";
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

      // Fetch joined communities
      if (session.user) {
        const { data: joinedData } = await supabase
          .from('community_memberships')
          .select(`
            id,
            joined_at,
            course_communities:community_id (
              id,
              course_name,
              course_category,
              description
            )
          `)
          .eq('user_id', session.user.id)
          .order('joined_at', { ascending: false });

        if (joinedData) {
          // Get visit history from localStorage
          const visitKey = `community_visits_${session.user.id}`;
          const visits = JSON.parse(localStorage.getItem(visitKey) || '{}');
          
          // Sort by last visited time (most recent first)
          const sortedData = [...joinedData].sort((a, b) => {
            const aVisitTime = visits[a.course_communities.id];
            const bVisitTime = visits[b.course_communities.id];
            
            // If both have visit times, sort by most recent
            if (aVisitTime && bVisitTime) {
              return new Date(bVisitTime).getTime() - new Date(aVisitTime).getTime();
            }
            // If only one has visit time, prioritize it
            if (aVisitTime && !bVisitTime) return -1;
            if (!aVisitTime && bVisitTime) return 1;
            // If neither has visit time, keep original order
            return 0;
          });
          
          setJoinedCommunities(sortedData as JoinedCommunity[]);
        }
      }
    };

    initializeUser();
  }, [navigate]);

  const [communities, setCommunities] = useState<Array<{id: string, course_name: string, course_category: string}>>([]);

  useEffect(() => {
    const fetchCommunities = async () => {
      const { data } = await supabase
        .from('course_communities')
        .select('id, course_name, course_category')
        .order('course_category', { ascending: true });
      
      if (data) {
        setCommunities(data);
      }
    };

    fetchCommunities();
  }, []);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'today';
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
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

  // Group communities by category
  const courseCategories = communities.reduce((acc, community) => {
    const existing = acc.find(cat => cat.category === community.course_category);
    if (existing) {
      existing.courses.push({ id: community.id, name: community.course_name });
    } else {
      acc.push({
        category: community.course_category,
        courses: [{ id: community.id, name: community.course_name }]
      });
    }
    return acc;
  }, [] as Array<{category: string, courses: Array<{id: string, name: string}>}>);

  // Filter courses based on search query and selected filter
  const filteredCategories = courseCategories
    .filter(category => {
      // If a filter is selected, only show matching categories
      if (selectedFilter === 'AP Courses') {
        // Show categories that contain AP courses
        // Check if any course in the category starts with "AP "
        return category.courses.some(course => 
          course.name.toLowerCase().startsWith('ap ')
        );
      }
      if (selectedFilter === 'SAT Prep') {
        // Show only SAT Prep category
        return category.category === 'SAT Prep';
      }
      // If "All Subjects" or no filter, show all
      return true;
    })
    .map(category => ({
      ...category,
      courses: category.courses.filter(course => {
        // Apply search query filter
        const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // If AP Courses filter is active, also filter individual courses
        if (selectedFilter === 'AP Courses') {
          return matchesSearch && course.name.toLowerCase().startsWith('ap ');
        }
        
        // If SAT Prep filter is active, courses are already filtered by category
        return matchesSearch;
      })
    }))
    .filter(category => category.courses.length > 0);

  

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
            
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Dashboard</Button>
              </Link>
              <Link to="/communities">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationDropdown user={user} profile={profile} />
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
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-home-foreground">Communities</h1>
                <p className="text-gray-600 dark:text-gray-400">Connect with fellow learners and join study groups</p>
              </div>
            </div>

            {/* Search and Filters */}
            <Card className="p-6 bg-card border border-border">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input 
                    placeholder="Search communities..." 
                    className="pl-10 border-gray-200 focus:border-home-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedFilter(null)}
                    className={
                      selectedFilter === null
                        ? "border-home-primary text-home-primary bg-home-primary/10 hover:bg-home-primary hover:text-white"
                        : "border-gray-300 dark:border-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-accent"
                    }
                  >
                    All Subjects
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedFilter('AP Courses')}
                    className={
                      selectedFilter === 'AP Courses'
                        ? "border-home-primary text-home-primary bg-home-primary/10 hover:bg-home-primary hover:text-white"
                        : "border-gray-300 dark:border-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-accent"
                    }
                  >
                    AP Courses
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedFilter('SAT Prep')}
                    className={
                      selectedFilter === 'SAT Prep'
                        ? "border-home-primary text-home-primary bg-home-primary/10 hover:bg-home-primary hover:text-white"
                        : "border-gray-300 dark:border-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-accent"
                    }
                  >
                    SAT Prep
                  </Button>
                </div>
              </div>
            </Card>

            {/* Joined Communities */}
            {joinedCommunities.length > 0 && (
              <Card className="p-6 bg-card border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-home-foreground">My Communities</h2>
                    <Badge variant="secondary">{joinedCommunities.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMyCommunitiesMinimized(!isMyCommunitiesMinimized)}
                    className="text-home-foreground hover:bg-home-surface dark:hover:bg-accent"
                  >
                    {isMyCommunitiesMinimized ? (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Show
                      </>
                    ) : (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Minimize
                      </>
                    )}
                  </Button>
                </div>
                
                {!isMyCommunitiesMinimized && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {joinedCommunities.map((membership, index) => {
                    // Check if this is the most recently visited community
                    const visitKey = `community_visits_${user?.id}`;
                    const visits = user ? JSON.parse(localStorage.getItem(visitKey) || '{}') : {};
                    const hasVisitTime = visits[membership.course_communities.id];
                    const isMostRecent = index === 0 && hasVisitTime;
                    
                    return (
                      <Link 
                        key={membership.id}
                        to={`/community/${membership.course_communities.id}`}
                      >
                        <Card className="p-4 hover:bg-accent transition-colors cursor-pointer border border-border">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-home-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-home-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-home-foreground truncate">{membership.course_communities.course_name}</h3>
                              <Badge variant="secondary" className="mt-1 text-xs">{membership.course_communities.course_category}</Badge>
                              {isMostRecent ? (
                                <p className="text-xs text-home-primary font-medium mt-2">
                                  Recently visited
                                </p>
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  Joined {formatRelativeTime(membership.joined_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                  </div>
                )}
              </Card>
            )}

            {/* Browse All Communities */}
            <Card className="p-6 bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-home-foreground">Browse All Communities</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCommunitiesMinimized(!isCommunitiesMinimized)}
                  className="text-home-foreground hover:bg-home-surface dark:hover:bg-accent"
                >
                  {isCommunitiesMinimized ? (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show All
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Minimize
                    </>
                  )}
                </Button>
              </div>
              
              {!isCommunitiesMinimized && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => (
                <div key={category.category} className="space-y-4">
                  <h2 className="text-2xl font-bold text-home-foreground border-t-4 border-gray-900 dark:border-gray-600 pt-4">
                    {category.category}
                  </h2>
                  <div className="space-y-3">
                    {category.courses.map((course) => (
                      <Link 
                        key={course.id}
                        to={`/community/${course.id}`}
                        className="flex items-center justify-between p-4 bg-card border-b border-border hover:bg-accent transition-colors group"
                      >
                        <span className="text-home-foreground font-medium">{course.name}</span>
                        <span className="text-gray-400 dark:text-gray-500 group-hover:text-home-primary transition-colors">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
                  ) : (
                    <div className="col-span-full text-center py-12 text-gray-600 dark:text-gray-400">
                      <p>No communities found matching "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default Communities;
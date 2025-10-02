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
  Settings
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

const Communities = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('clerk_user_id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
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

  // Filter courses based on search query
  const filteredCategories = courseCategories.map(category => ({
    ...category,
    courses: category.courses.filter(course =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.courses.length > 0);

  

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
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
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
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-home-foreground">Communities</h1>
                <p className="text-gray-600">Connect with fellow learners and join study groups</p>
              </div>
              <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                <Plus className="w-5 h-5 mr-2" />
                Create Community
              </Button>
            </div>

            {/* Search and Filters */}
            <Card className="p-6 bg-white border border-gray-200">
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
                  <Button variant="outline" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                    All Subjects
                  </Button>
                  <Button variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-100">
                    AP Courses
                  </Button>
                  <Button variant="outline" className="border-gray-300 text-gray-600 hover:bg-gray-100">
                    SAT Prep
                  </Button>
                </div>
              </div>
            </Card>

            {/* AP Courses Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => (
                <div key={category.category} className="space-y-4">
                  <h2 className="text-2xl font-bold text-home-foreground border-t-4 border-gray-900 pt-4">
                    {category.category}
                  </h2>
                  <div className="space-y-3">
                    {category.courses.map((course) => (
                      <Link 
                        key={course.id}
                        to={`/community/${course.id}`}
                        className="flex items-center justify-between p-4 bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-home-foreground font-medium">{course.name}</span>
                        <span className="text-gray-400 group-hover:text-home-primary transition-colors">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
              ) : (
                <div className="col-span-2 text-center py-12 text-gray-600">
                  <p>No communities found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Community Tips */}
            <Card className="p-6 bg-home-primary text-white">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Join Active Communities</h3>
                <p className="text-sm opacity-90">Connect with peers studying similar subjects for better learning outcomes!</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Communities;
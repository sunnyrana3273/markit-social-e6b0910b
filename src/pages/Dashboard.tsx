import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  BookOpen, 
  Users, 
  Plus, 
  MessageSquare, 
  Clock,
  Zap,
  Trophy,
  Calendar,
  Settings,
  Bell,
  File,
  FileText,
  Image as ImageIcon
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentFiles, setRecentFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication and fetch profile
    const initializeUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/auth');
          return;
        }

        setUser(session.user);

        // Fetch user profile
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('clerk_user_id', session.user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(profileData);
        }

        // Fetch recent uploaded files (last 3)
        const { data: filesData, error: filesError } = await supabase
          .from('uploaded_files')
          .select('id, file_name, file_type, file_size, created_at')
          .eq('clerk_user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (filesError) {
          console.error('Error fetching files:', filesError);
        } else {
          setRecentFiles(filesData || []);
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

  // Get user's display name
  const getDisplayName = () => {
    if (profile?.first_name) {
      return profile.first_name;
    }
    if (user?.user_metadata?.name) {
      return user.user_metadata.name.split(' ')[0];
    }
    return 'there';
  };

  // Get user's initials for avatar fallback
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

  // Helper function to get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (fileType.includes('pdf') || fileType.includes('document')) return <FileText className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
  };

  const friends = [
    { id: 1, name: "Alex Chen", status: "online", avatar: "AC" },
    { id: 2, name: "Sarah Kim", status: "studying", avatar: "SK" },
    { id: 3, name: "Mike Johnson", status: "offline", avatar: "MJ" },
  ];

  const stats = {
    streak: 7,
    minutesStudied: 120,
    problemsSolved: 15,
    sessionsJoined: 3
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
              <AvatarImage src={profile?.image_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} alt={getDisplayName()} />
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
            {/* Welcome Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-home-foreground">Welcome back, {getDisplayName()}!</h1>
                <p className="text-gray-600">Ready to continue your learning journey?</p>
              </div>
              <Link to="/upload">
                <Button className="group bg-home-primary hover:bg-home-primary-hover text-white">
                  <Plus className="w-5 h-5 mr-2" />
                  Upload New File
                </Button>
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="p-4 bg-home-primary text-white">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">Current Streak</p>
                    <p className="text-2xl font-bold">{stats.streak} days</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-home-secondary text-white">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">Minutes Today</p>
                    <p className="text-2xl font-bold">{stats.minutesStudied}m</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-white border border-gray-200">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">Problems Solved</p>
                    <p className="text-2xl font-bold text-home-foreground">{stats.problemsSolved}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-white border border-gray-200">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-home-secondary" />
                  <div>
                    <p className="text-sm text-gray-600">Sessions Joined</p>
                    <p className="text-2xl font-bold text-home-foreground">{stats.sessionsJoined}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Studying Sessions */}
            <Card className="p-6 bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-home-foreground">Recent Studying Sessions</h2>
                <Link to="/upload">
                  <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">See more files/sessions</Button>
                </Link>
              </div>
              
              <div className="space-y-3">
                {recentFiles.length > 0 ? (
                  recentFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 bg-home-surface rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-home-primary/10 rounded-lg flex items-center justify-center text-home-primary">
                          {getFileIcon(file.file_type)}
                        </div>
                        <div>
                          <h3 className="font-medium text-home-foreground truncate max-w-md">{file.file_name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{formatRelativeTime(file.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                        Open
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">None</p>
                    <p className="text-sm">Upload your first file to start studying!</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 bg-white border border-gray-200">
              <h2 className="text-xl font-semibold text-home-foreground mb-4">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <Link to="/session/new">
                  <Button variant="outline" className="w-full h-20 flex-col border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                    <Plus className="w-6 h-6 mb-2" />
                    Create Session
                  </Button>
                </Link>
                <Link to="/communities">
                  <Button variant="outline" className="w-full h-20 flex-col border-home-secondary text-home-secondary hover:bg-home-secondary hover:text-white">
                    <Users className="w-6 h-6 mb-2" />
                    Browse Communities
                  </Button>
                </Link>
                <Link to="/upload">
                  <Button variant="outline" className="w-full h-20 flex-col border-gray-300 text-gray-600 hover:bg-gray-100">
                    <Calendar className="w-6 h-6 mb-2" />
                    Upload Document
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friends Online */}
            <Card className="p-6 bg-white border border-gray-200">
              <h3 className="font-semibold text-home-foreground mb-4">Friends</h3>
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-home-secondary flex items-center justify-center">
                        <span className="text-xs font-medium text-white">{friend.avatar}</span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        friend.status === 'online' ? 'bg-green-500' : 
                        friend.status === 'studying' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-home-foreground">{friend.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{friend.status}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-home-foreground hover:bg-home-surface">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Link to="/friends">
                <Button variant="outline" className="w-full mt-4 border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
                  View All Friends
                </Button>
              </Link>
            </Card>

            {/* Achievement Card */}
            <Card className="p-6 bg-home-primary text-white">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Week Warrior!</h3>
                <p className="text-sm opacity-90">You've maintained your study streak for 7 days straight!</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
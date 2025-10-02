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
  Image as ImageIcon,
  BookUp
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import SettingsModal from "@/components/SettingsModal";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentFiles, setRecentFiles] = useState<UploadedFile[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
        } else if (!profileData) {
          // No profile exists, create one
          console.log('No profile found for user, creating one...');
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

        // Fetch joined communities
        const { data: communitiesData, error: communitiesError } = await supabase
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
          .order('joined_at', { ascending: false })
          .limit(6);

        if (communitiesError) {
          console.error('Error fetching communities:', communitiesError);
        } else {
          setJoinedCommunities(communitiesData || []);
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
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface">
              <Bell className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-home-foreground hover:bg-home-surface"
              onClick={() => setIsSettingsOpen(true)}
            >
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
        <div className="max-w-7xl mx-auto">
          {/* Main Content */}
          <div className="space-y-6">
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

            {/* Stats Cards with Liquid Glass Effect */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-home-primary/10 via-white/50 to-home-primary/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-home-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-home-primary/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-6 h-6 text-home-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Current Streak</p>
                    <p className="text-2xl font-bold text-home-foreground">-</p>
                  </div>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-home-secondary/10 via-white/50 to-home-secondary/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-home-secondary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-home-secondary/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Clock className="w-6 h-6 text-home-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Minutes Today</p>
                    <p className="text-2xl font-bold text-home-foreground">-</p>
                  </div>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-yellow-500/10 via-white/50 to-yellow-500/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Trophy className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Problems Solved</p>
                    <p className="text-2xl font-bold text-home-foreground">-</p>
                  </div>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-purple-500/10 via-white/50 to-purple-500/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Sessions Joined</p>
                    <p className="text-2xl font-bold text-home-foreground">-</p>
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

            {/* Joined Communities */}
            <Card className="p-6 bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-home-foreground">Joined Communities</h2>
                <Link to="/communities">
                  <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Browse all</Button>
                </Link>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedCommunities.length > 0 ? (
                  joinedCommunities.map((membership) => (
                    <Link 
                      key={membership.id}
                      to={`/community/${membership.course_communities.id}`}
                    >
                      <Card className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-home-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-5 h-5 text-home-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-home-foreground truncate">{membership.course_communities.course_name}</h3>
                            <Badge variant="secondary" className="mt-1 text-xs">{membership.course_communities.course_category}</Badge>
                            <p className="text-xs text-gray-500 mt-2">
                              Joined {formatRelativeTime(membership.joined_at)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-600">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No communities joined yet</p>
                    <p className="text-sm mb-4">Join communities to connect with fellow learners!</p>
                    <Link to="/communities">
                      <Button className="bg-home-primary hover:bg-home-primary-hover text-white">
                        Browse Communities
                      </Button>
                    </Link>
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
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;
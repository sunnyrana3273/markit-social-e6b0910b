import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  BookOpen, 
  Plus, 
  MessageSquare, 
  Clock,
  Zap,
  Trophy,
  Settings,
  Bell,
  File,
  FileText,
  Image as ImageIcon,
  Book,
  Moon,
  Sun,
  Palette,
  RotateCcw
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SettingsModal from "@/components/SettingsModal";
import { useTheme } from "@/contexts/ThemeContext";
import NotificationDropdown from "@/components/NotificationDropdown";


interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface ProblemSet {
  id: string;
  title: string;
  problem_count: number;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme, themeColor, setThemeColor, resetThemeColor } = useTheme();
  const { user, profile, loading: authLoading } = useAuth();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [recentFiles, setRecentFiles] = useState<UploadedFile[]>([]);
  const [recentProblemSets, setRecentProblemSets] = useState<ProblemSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [minutesToday, setMinutesToday] = useState<number>(0);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [problemsToday, setProblemsToday] = useState<number>(0);

  useEffect(() => {
    console.log('[Dashboard] Render:', {
      authLoading,
      hasUser: !!user,
      userId: user?.id,
      hasProfile: !!profile,
      loading,
      timestamp: new Date().toISOString()
    });
  }, [authLoading, user, profile, loading]);

  useEffect(() => {
    document.title = "MarkIt | Dashboard";
    
    console.log('[Dashboard] useEffect triggered:', {
      authLoading,
      hasUser: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });
    
    if (authLoading) {
      console.log('[Dashboard] Auth still loading, waiting...');
      return;
    }
    
    if (!user) {
      console.log('[Dashboard] No user, skipping file fetch');
      return;
    }

    let isMounted = true;
    console.log('[Dashboard] Starting file fetch for user:', user.id);
    
    // Fetch recent uploaded files (last 3)
    const fetchFiles = async () => {
      if (!user || !isMounted) {
        console.log('[Dashboard] fetchFiles cancelled:', { hasUser: !!user, isMounted });
        return;
      }
      
      try {
        const { data: filesData, error: filesError } = await supabase
          .from('uploaded_files')
          .select('id, file_name, file_type, file_size, created_at')
          .eq('clerk_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (filesError) {
          console.error('[Dashboard] Error fetching files:', filesError);
        } else if (isMounted) {
          console.log('[Dashboard] Files fetched successfully:', {
            count: filesData?.length || 0,
            timestamp: new Date().toISOString()
          });
          setRecentFiles(filesData || []);
        }
      } catch (error) {
        console.error('[Dashboard] Exception fetching files:', error);
      } finally {
        if (isMounted) {
          console.log('[Dashboard] Setting loading=false');
          setLoading(false);
        }
      }
    };

    fetchFiles();

    return () => {
      console.log('[Dashboard] Cleanup - unmounting');
      isMounted = false;
    };
  }, [user?.id, authLoading]);

  useEffect(() => {
    // Aggregate today's minutes from localStorage keys written by DocumentEditor
    const aggregateToday = () => {
      try {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const yyyyMmDd = `${y}-${m}-${d}`;
        let totalSeconds = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || '';
          // Keys look like: studySeconds:<fileId>:YYYY-MM-DD
          if (key.startsWith('studySeconds:') && key.endsWith(`:${yyyyMmDd}`)) {
            const val = parseInt(localStorage.getItem(key) || '0', 10);
            if (!isNaN(val)) {
              totalSeconds += val;
            }
          }
        }
        const minutes = Math.floor(totalSeconds / 60);
        setMinutesToday(minutes);
      } catch (e) {
        setMinutesToday(0);
        console.error('[Dashboard] Failed to aggregate minutes today', e);
      }
    };

    const readStreak = () => {
      try {
        const count = parseInt(localStorage.getItem('studyStreak:count') || '0', 10) || 0;
        setStreakCount(count);
      } catch (e) {
        setStreakCount(0);
      }
    };

    const readProblemsToday = () => {
      try {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const yyyyMmDd = `${y}-${m}-${d}`;
        const key = `problemsSolved:${yyyyMmDd}`;
        const val = parseInt(localStorage.getItem(key) || '0', 10) || 0;
        setProblemsToday(val);
      } catch (e) {
        setProblemsToday(0);
      }
    };

    aggregateToday();
    readStreak();
    readProblemsToday();

    // Optionally refresh every minute while dashboard is open
    const interval = setInterval(() => { aggregateToday(); readStreak(); readProblemsToday(); }, 60000);
    return () => clearInterval(interval);
  }, []);

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
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Color Picker */}
            <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-home-foreground hover:bg-home-surface"
                  aria-label="Theme color picker"
                >
                  <div 
                    className="w-5 h-5 rounded-full border-2 border-current"
                    style={{ backgroundColor: themeColor }}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Theme Color</label>
                    <div className="flex items-center gap-3">
                      <label className="relative cursor-pointer">
                        <input
                          type="color"
                          value={themeColor}
                          onChange={(e) => setThemeColor(e.target.value)}
                          className="h-10 w-20 rounded border border-border cursor-pointer appearance-none"
                          style={{ 
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            appearance: 'none',
                            backgroundColor: themeColor
                          }}
                        />
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetThemeColor}
                        className="flex-1"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Changes icon and button accent colors
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Dark Mode Toggle */}
            <div className="flex items-center gap-2 px-2">
              <Sun className={`w-4 h-4 transition-opacity ${theme === 'light' ? 'opacity-100' : 'opacity-40'}`} />
              <Switch 
                checked={theme === 'dark'} 
                onCheckedChange={() => toggleTheme()}
                aria-label="Toggle dark mode"
              />
              <Moon className={`w-4 h-4 transition-opacity ${theme === 'dark' ? 'opacity-100' : 'opacity-40'}`} />
            </div>
            <NotificationDropdown />
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
                <p className="text-gray-600 dark:text-gray-400">Ready to continue your learning journey?</p>
              </div>
              <Link to="/upload">
                <Button className="group bg-home-primary hover:bg-home-primary-hover text-white shine-button">
                  <Plus className="w-5 h-5 mr-2" />
                  Upload New File
                </Button>
              </Link>
            </div>

            {/* Stats Cards with Liquid Glass Effect */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-home-primary/10 via-white/50 dark:via-home-surface/50 to-home-primary/5 backdrop-blur-md border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-home-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-home-primary/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-6 h-6 text-home-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Current Streak</p>
                    <p className="text-2xl font-bold text-home-foreground">{streakCount}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-home-secondary/10 via-white/50 dark:via-home-surface/50 to-home-secondary/5 backdrop-blur-md border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-home-secondary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-home-secondary/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Clock className="w-6 h-6 text-home-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Minutes Today</p>
                    <p className="text-2xl font-bold text-home-foreground">{minutesToday}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-yellow-500/10 via-white/50 dark:via-home-surface/50 to-yellow-500/5 backdrop-blur-md border border-white/20 dark:border-gray-700/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Problems Solved</p>
                    <p className="text-2xl font-bold text-home-foreground">{problemsToday}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Studying Sessions */}
            <Card className="p-6 bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-home-foreground">Recent Studying Sessions</h2>
                <Link to="/upload">
                  <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">See more files/sessions</Button>
                </Link>
              </div>
              
              <div className="space-y-3">
                {recentFiles.length > 0 ? (
                  recentFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 bg-home-surface rounded-lg hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-home-primary/10 rounded-lg flex items-center justify-center text-home-primary">
                          {getFileIcon(file.file_type)}
                        </div>
                        <div>
                          <h3 className="font-medium text-home-foreground truncate max-w-md">{file.file_name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{formatRelativeTime(file.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white"
                        onClick={() => navigate(`/document/${file.id}`)}
                      >
                        Open
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">None</p>
                    <p className="text-sm">Upload your first file to start studying!</p>
                  </div>
                )}
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
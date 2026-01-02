import { useEffect, useState, useRef } from "react";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  RotateCcw,
  Folder,
  FolderOpen,
  Waypoints,
  Reply,
  Phone,
  TrendingUp,
  Paintbrush,
  X,
  Edit,
  Check
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import SettingsModal from "@/components/SettingsModal";
import { useTheme } from "@/contexts/ThemeContext";
import NotificationDropdown from "@/components/NotificationDropdown";
import { StudyContributionsGraph } from "@/components/StudyContributionsGraph";
import { FriendsActivity } from "@/components/FriendsActivity";
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

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  folder_id?: string | null;
}

interface Folder {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
  updated_at: string;
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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Force default theme for free plan users
  useEffect(() => {
    if (profile) {
      const userPlan = profile.plan || 'free';
      const isAdmin = profile.role === 'admin';
      let effectivePlan = userPlan;
      if (profile.plan_expires_at && userPlan !== 'free') {
        const expiresAt = new Date(profile.plan_expires_at);
        const now = new Date();
        if (expiresAt < now) {
          effectivePlan = 'free';
        }
      }
      const canCustomizeTheme = isAdmin || effectivePlan === 'plus' || effectivePlan === 'pro';
      
      if (!canCustomizeTheme && themeColor !== '#22c55e') {
        resetThemeColor();
      }
    }
  }, [profile, themeColor, resetThemeColor]);
  const [recentFiles, setRecentFiles] = useState<UploadedFile[]>([]);
  const [recentProblemSets, setRecentProblemSets] = useState<ProblemSet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [minutesToday, setMinutesToday] = useState<number>(0);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [problemsToday, setProblemsToday] = useState<number>(0);
  const [knowledgePoints, setKnowledgePoints] = useState<number>(0);
  const [dailyMetrics, setDailyMetrics] = useState<Array<{ date: string; minutes_studied: number }>>([]);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    created_at: string;
    read_at: string | null;
    metadata?: any;
  }>>([]);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(() => {
    // Load hidden cards from localStorage
    try {
      const saved = localStorage.getItem('dashboardHiddenCards');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    document.title = "MarkIt | Dashboard";
    // Check authentication and fetch profile
    const initializeUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/auth');
          return;
        }

        setUser(session.user);

        // Fetch user profile with knowledge_points, plan, and role
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*, knowledge_points, plan, role, plan_expires_at')
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
              .select('*, knowledge_points')
              .eq('id', session.user.id)
              .single();
            setProfile(newProfile);
            setKnowledgePoints(newProfile?.knowledge_points || 0);
          }
        } else {
          setProfile(profileData);
          setKnowledgePoints(profileData.knowledge_points || 0);
        }

        // Fetch recent uploaded files (last 3)
        const { data: filesData, error: filesError } = await supabase
          .from('uploaded_files')
          .select('id, file_name, file_type, file_size, created_at, folder_id')
          .eq('clerk_user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (filesError) {
          console.error('Error fetching files:', filesError);
        } else {
          setRecentFiles(filesData || []);
        }

        // Fetch folders
        const { data: foldersData, error: foldersError } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (foldersError) {
          console.error('Error fetching folders:', foldersError);
        } else {
          setFolders(foldersData || []);
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
      .channel('profile-updates')
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
            setProfile(prev => prev ? { ...prev, knowledge_points: updatedProfile.knowledge_points } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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

  // Fetch daily metrics for contributions graph
  useEffect(() => {
    const fetchDailyMetrics = async () => {
      if (!user?.id) return;

      try {
        // Get date range for past month
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const { data, error } = await supabase
          .from('daily_metrics')
          .select('date, minutes_studied')
          .eq('user_id', user.id)
          .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
          .lte('date', today.toISOString().split('T')[0])
          .order('date', { ascending: true });

        if (error) {
          console.error('Error fetching daily metrics:', error);
          return;
        }

        setDailyMetrics(data || []);
      } catch (error) {
        console.error('Error fetching daily metrics:', error);
      }
    };

    if (user?.id) {
      fetchDailyMetrics();
    }
  }, [user?.id]);

  // Fetch notifications for notification center
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        setNotifications(data);
      }
    };

    fetchNotifications();

    // Set up realtime subscription for new notifications
    const channel = supabase
      .channel(`dashboard-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new;
          setNotifications((prev) => [newNotification, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'discussion_reply':
        return <Reply className="w-4 h-4" />;
      case 'call':
        return <Phone className="w-4 h-4" />;
      case 'post_engagement':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  // Get notification icon background color
  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
      case 'discussion_reply':
        return 'bg-green-500/20 text-green-600 dark:text-green-400';
      case 'call':
        return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
      case 'post_engagement':
        return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
      default:
        return 'bg-gray-500/20 text-gray-600 dark:text-gray-400';
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!notification.read_at) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notification.id);
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    }

    // Navigate based on notification type
    if (notification.type === 'message' && notification.metadata?.sender_id) {
      navigate(`/friends?chat=${notification.metadata.sender_id}`);
    } else if (notification.type === 'discussion_reply' && notification.metadata?.community_id) {
      navigate(`/community/${notification.metadata.community_id}`);
    } else if (notification.type === 'call' && notification.metadata?.caller_id) {
      navigate(`/friends?chat=${notification.metadata.caller_id}`);
    } else if (notification.type === 'post_engagement' && notification.metadata?.community_id) {
      navigate(`/community/${notification.metadata.community_id}`);
    }
  };

  // Get notifications to display (new ones first, then past ones)
  const unreadNotifications = notifications.filter(n => !n.read_at);
  const readNotifications = notifications.filter(n => n.read_at);
  const displayNotifications = unreadNotifications.length > 0 
    ? unreadNotifications.slice(0, 3)
    : readNotifications.slice(0, 3);

  // Dashboard editor functions
  const handleStartEditing = () => {
    setIsEditMode(true);
  };

  const handleStopEditing = () => {
    setIsEditMode(false);
  };

  const handleRemoveCard = (cardId: string) => {
    const newHiddenCards = new Set(hiddenCards);
    newHiddenCards.add(cardId);
    setHiddenCards(newHiddenCards);
    // Save to localStorage
    localStorage.setItem('dashboardHiddenCards', JSON.stringify(Array.from(newHiddenCards)));
  };

  const handleRestoreCard = (cardId: string) => {
    const newHiddenCards = new Set(hiddenCards);
    newHiddenCards.delete(cardId);
    setHiddenCards(newHiddenCards);
    // Save to localStorage
    localStorage.setItem('dashboardHiddenCards', JSON.stringify(Array.from(newHiddenCards)));
  };

  const isCardHidden = (cardId: string) => hiddenCards.has(cardId);

  const getCardDisplayName = (cardId: string) => {
    const names: Record<string, string> = {
      'stats-streak': 'Current Streak',
      'stats-minutes': 'Minutes Today',
      'stats-problems': 'Problems Solved',
      'stats-points': 'Knowledge Points',
      'study-activity': 'Study Activity',
      'friends-activity': 'Friends Activity',
      'notification-center': 'Notification Center',
    };
    return names[cardId] || cardId;
  };

  // Get visible cards (filter out hidden ones)
  const getVisibleCards = (cardIds: string[]) => {
    return cardIds.filter(id => !isCardHidden(id));
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
            {/* Theme Color Picker - Only show for Plus/Pro/Admin plans */}
            {(() => {
              const userPlan = profile?.plan || 'free';
              const isAdmin = profile?.role === 'admin';
              // Check if plan has expired
              let effectivePlan = userPlan;
              if (profile?.plan_expires_at && userPlan !== 'free') {
                const expiresAt = new Date(profile.plan_expires_at);
                const now = new Date();
                if (expiresAt < now) {
                  effectivePlan = 'free';
                }
              }
              const canCustomizeTheme = isAdmin || effectivePlan === 'plus' || effectivePlan === 'pro';
              const canUseDashboardEditor = isAdmin || effectivePlan === 'pro';
              
              if (!canCustomizeTheme) {
                // Force default green theme for free plan users
                if (themeColor !== '#22c55e') {
                  resetThemeColor();
                }
                return null; // Don't show color picker
              }
              
              return (
                <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-home-foreground hover:bg-home-surface"
                      aria-label="Theme color picker"
                    >
                      <Paintbrush className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-4" align="end">
                    <Tabs defaultValue="theme" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="theme">Theme Color</TabsTrigger>
                        {canUseDashboardEditor ? (
                          <TabsTrigger value="dashboard">Dashboard Editor</TabsTrigger>
                        ) : (
                          <TooltipProvider>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div className="w-full h-full flex items-center justify-center">
                                  <TabsTrigger 
                                    value="dashboard" 
                                    disabled 
                                    className="opacity-50 cursor-not-allowed w-full pointer-events-none"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    Dashboard Editor
                                  </TabsTrigger>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Dashboard Editor is only available to Pro users</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TabsList>
                      <TabsContent value="theme" className="mt-4">
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
                      </TabsContent>
                      {canUseDashboardEditor && (
                        <TabsContent value="dashboard" className="mt-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Dashboard Editor</label>
                              {!isEditMode ? (
                                <>
                                  <p className="text-sm text-muted-foreground mb-3">
                                    Customize your dashboard by removing cards you don't need.
                                  </p>
                                  <Button
                                    onClick={handleStartEditing}
                                    className="w-full"
                                    variant="default"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Start Editing
                                  </Button>
                                </>
                              ) : (
                                <>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Click on cards to remove them from your dashboard. The "Recent Studying Sessions" card cannot be removed.
                                </p>
                                  <Button
                                    onClick={handleStopEditing}
                                    className="w-full bg-red-500 hover:bg-red-600 text-white"
                                    variant="default"
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    Done Editing
                                  </Button>
                                  {hiddenCards.size > 0 && (
                                    <div className="mt-3 p-3 bg-muted rounded-lg">
                                      <p className="text-xs font-medium mb-2">Hidden Cards:</p>
                                      <div className="space-y-1">
                                        {Array.from(hiddenCards).map((cardId) => (
                                          <div key={cardId} className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">{getCardDisplayName(cardId)}</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2"
                                              onClick={() => handleRestoreCard(cardId)}
                                            >
                                              Restore
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </PopoverContent>
                </Popover>
              );
            })()}
            
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
            <NotificationDropdown 
              user={user} 
              profile={profile} 
              open={notificationDropdownOpen}
              onOpenChange={setNotificationDropdownOpen}
            />
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
            <TooltipProvider>
              <div className="grid md:grid-cols-4 gap-4">
                {(() => {
                  const statsCardIds = ['stats-streak', 'stats-minutes', 'stats-problems', 'stats-points'];
                  const orderedStatsCards = getVisibleCards(statsCardIds);
                  
                  const renderStatCard = (cardId: string) => {
                    const cardConfig: Record<string, { icon: React.ReactNode; label: string; value: number | string; gradient: string; iconBg: string; iconColor: string; tooltip: string }> = {
                      'stats-streak': {
                        icon: <Zap className="w-6 h-6 text-home-primary" />,
                        label: 'Current Streak',
                        value: streakCount,
                        gradient: 'from-home-primary/10 via-white/50 dark:via-home-surface/50 to-home-primary/5',
                        iconBg: 'bg-home-primary/20',
                        iconColor: 'text-home-primary',
                        tooltip: 'Your consecutive days of studying. Keep it going to maintain your streak!'
                      },
                      'stats-minutes': {
                        icon: <Clock className="w-6 h-6 text-home-secondary" />,
                        label: 'Minutes Today',
                        value: minutesToday,
                        gradient: 'from-home-secondary/10 via-white/50 dark:via-home-surface/50 to-home-secondary/5',
                        iconBg: 'bg-home-secondary/20',
                        iconColor: 'text-home-secondary',
                        tooltip: 'Total time spent studying today across all your documents and study sessions.'
                      },
                      'stats-problems': {
                        icon: <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />,
                        label: 'Problems Solved',
                        value: problemsToday,
                        gradient: 'from-yellow-500/10 via-white/50 dark:via-home-surface/50 to-yellow-500/5',
                        iconBg: 'bg-yellow-500/20',
                        iconColor: 'text-yellow-600 dark:text-yellow-500',
                        tooltip: 'Number of practice problems you\'ve completed today while studying.'
                      },
                      'stats-points': {
                        icon: <Waypoints className="w-6 h-6 text-purple-600 dark:text-purple-500" />,
                        label: 'Knowledge Points',
                        value: knowledgePoints,
                        gradient: 'from-purple-500/10 via-white/50 dark:via-home-surface/50 to-purple-500/5',
                        iconBg: 'bg-purple-500/20',
                        iconColor: 'text-purple-600 dark:text-purple-500',
                        tooltip: 'Points earned by contributing to community discussions, helping others learn, and building studying streaks.'
                      }
                    };

                    const config = cardConfig[cardId];
                    if (!config) return null;

                    return (
                      <Tooltip key={cardId}>
                        <TooltipTrigger asChild>
                        <Card 
                          className={`group relative overflow-hidden p-6 bg-gradient-to-br ${config.gradient} backdrop-blur-md border shadow-lg transition-all duration-300 ${
                            isEditMode 
                              ? 'border-orange-500 dark:border-orange-400 border-2 cursor-pointer hover:border-orange-600 dark:hover:border-orange-300' 
                              : 'border-white/20 dark:border-gray-700/20 hover:shadow-2xl hover:scale-105 cursor-pointer'
                          }`}
                          onClick={isEditMode ? () => handleRemoveCard(cardId) : undefined}
                        >
                          {isEditMode && (
                            <div className="absolute top-2 right-2 z-20 bg-orange-500 text-white rounded-full p-1">
                              <X className="w-4 h-4" />
                            </div>
                          )}
                            <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient.includes('home-primary') ? 'from-home-primary/20' : config.gradient.includes('home-secondary') ? 'from-home-secondary/20' : config.gradient.includes('yellow') ? 'from-yellow-500/20' : 'from-purple-500/20'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            <div className="relative z-10 flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full ${config.iconBg} backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                {config.icon}
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{config.label}</p>
                                <p className="text-2xl font-bold text-home-foreground">{config.value}</p>
                              </div>
                            </div>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{config.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  };

                  return orderedStatsCards.map(renderStatCard);
                })()}
              </div>
            </TooltipProvider>

            {/* Recent Studying Sessions - Non-removable */}
            <Card className={`p-6 bg-card border ${
              isEditMode 
                ? 'border-blue-500 dark:border-blue-400 border-2' 
                : 'border-border'
            }`}>
              {isEditMode && (
                <div className="mb-2 text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                  <span>This card cannot be removed</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-home-foreground">Recent Studying Sessions</h2>
                <Link to="/upload">
                  <Button variant="ghost" className="text-home-foreground hover:bg-home-surface hover:text-home-primary transition-colors duration-200">
                    See more files/sessions
                  </Button>
                </Link>
              </div>

              {/* Folder Filter */}
              {folders.length > 0 && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <Button
                    variant={selectedFolderId === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFolderId(null)}
                    className="text-xs"
                  >
                    All Files
                  </Button>
                  {folders.map((folder) => {
                    const folderFileCount = recentFiles.filter(f => f.folder_id === folder.id).length;
                    if (folderFileCount === 0) return null;
                    return (
                      <Button
                        key={folder.id}
                        variant={selectedFolderId === folder.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="text-xs flex items-center gap-1"
                      >
                        <Folder className="w-3 h-3" style={{ color: folder.color || undefined }} />
                        {folder.name}
                      </Button>
                    );
                  })}
                </div>
              )}
              
              <div className="space-y-3">
                {(() => {
                  const filteredFiles = selectedFolderId === null
                    ? recentFiles
                    : recentFiles.filter(f => f.folder_id === selectedFolderId);

                  if (filteredFiles.length > 0) {
                    return filteredFiles.map((file) => {
                      const fileFolder = file.folder_id ? folders.find(f => f.id === file.folder_id) : null;
                      return (
                        <div key={file.id} className="flex items-center justify-between p-4 bg-home-surface rounded-lg hover:bg-accent transition-colors cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-home-primary/10 rounded-lg flex items-center justify-center text-home-primary">
                              {getFileIcon(file.file_type)}
                            </div>
                            <div>
                              <h3 className="font-medium text-home-foreground truncate max-w-md mb-1">{file.file_name}</h3>
                              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-1">
                                <span>{formatFileSize(file.file_size)}</span>
                                <span>•</span>
                                <span>{formatRelativeTime(file.created_at)}</span>
                              </div>
                              {fileFolder && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                                  <Folder className="w-3 h-3" style={{ color: fileFolder.color || undefined }} />
                                  {fileFolder.name}
                                </Badge>
                              )}
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
                      );
                    });
                  } else {
                    return (
                      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                        <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">
                          {selectedFolderId === null ? "None" : "No files in this folder"}
                        </p>
                        <p className="text-sm">
                          {selectedFolderId === null 
                            ? "Upload your first file to start studying!"
                            : "Files in this folder will appear here"
                          }
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            </Card>

            {/* Study Activity, Friends Activity, and Notification Center */}
            <div className="flex gap-6">
              {(() => {
                const bottomCardIds = ['study-activity', 'friends-activity', 'notification-center'];
                const orderedBottomCards = getVisibleCards(bottomCardIds);
                
                return orderedBottomCards.map((cardId) => {
                  if (cardId === 'study-activity') {
                    return (
                      <div key={cardId} className="w-1/3">
                        <Card 
                          className={`p-6 bg-card border relative transition-all duration-300 ${
                            isEditMode 
                              ? 'border-orange-500 dark:border-orange-400 border-2 cursor-pointer hover:border-orange-600 dark:hover:border-orange-300' 
                              : 'border-border'
                          }`}
                          onClick={isEditMode ? () => handleRemoveCard(cardId) : undefined}
                        >
                          {isEditMode && (
                            <div className="absolute top-2 right-2 z-20 bg-orange-500 text-white rounded-full p-1">
                              <X className="w-4 h-4" />
                            </div>
                          )}
                          <h2 className="text-xl font-semibold text-home-foreground mb-4">Study Activity</h2>
                          <StudyContributionsGraph dailyMetrics={dailyMetrics} themeColor={themeColor} />
                        </Card>
                      </div>
                    );
                  }
                  
                  if (cardId === 'friends-activity') {
                    return (
                      <div key={cardId} className="w-1/3">
                        <Card 
                          className={`p-6 bg-card border relative transition-all duration-300 ${
                            isEditMode 
                              ? 'border-orange-500 dark:border-orange-400 border-2 cursor-pointer hover:border-orange-600 dark:hover:border-orange-300' 
                              : 'border-border'
                          }`}
                          onClick={isEditMode ? () => handleRemoveCard(cardId) : undefined}
                        >
                          {isEditMode && (
                            <div className="absolute top-2 right-2 z-20 bg-orange-500 text-white rounded-full p-1">
                              <X className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-home-foreground">Friends Activity</h2>
                          </div>
                          <FriendsActivity user={user} />
                        </Card>
                      </div>
                    );
                  }
                  
                  if (cardId === 'notification-center') {
                    return (
                      <div key={cardId} className="w-1/3">
                        <Card 
                          className={`p-6 bg-card border relative transition-all duration-300 ${
                            isEditMode 
                              ? 'border-orange-500 dark:border-orange-400 border-2 cursor-pointer hover:border-orange-600 dark:hover:border-orange-300' 
                              : 'border-border'
                          }`}
                          onClick={isEditMode ? () => handleRemoveCard(cardId) : undefined}
                        >
                          {isEditMode && (
                            <div className="absolute top-2 right-2 z-20 bg-orange-500 text-white rounded-full p-1">
                              <X className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-home-foreground flex items-center gap-2">
                              <Bell className="w-5 h-5" />
                              Notification Center
                            </h2>
                            <div className="flex items-center gap-2">
                              {unreadNotifications.length > 0 && (
                                <Badge className="bg-home-primary text-white">
                                  {unreadNotifications.length}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-home-foreground hover:bg-home-surface hover:text-home-primary transition-colors duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNotificationDropdownOpen(true);
                                }}
                              >
                                View All
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {displayNotifications.length > 0 ? (
                              displayNotifications.map((notification) => (
                                <div
                                  key={notification.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNotificationClick(notification);
                                  }}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-home-surface/50 ${
                                    !notification.read_at 
                                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' 
                                      : 'border-border'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full ${getNotificationIconBg(notification.type)} flex items-center justify-center flex-shrink-0`}>
                                      {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-semibold mb-1 ${!notification.read_at ? 'text-home-foreground' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {notification.title}
                                      </p>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                        {notification.message}
                                      </p>
                                      <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                                        {formatRelativeTime(notification.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8">
                                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600 opacity-50" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You're all caught up!</p>
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    );
                  }
                  
                  return null;
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      <ReportIssueFooter />
    </div>
  );
};

export default Dashboard;
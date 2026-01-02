import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  Reply,
  Phone,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

interface NotificationDropdownProps {
  user: User | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email: string;
  } | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface FriendRequest {
  user_id: string;
  created_at: string;
  profiles?: {
    id: string;
    username?: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email: string;
  };
}

interface DatabaseNotification {
  id: string;
  type: 'message' | 'discussion_reply' | 'call' | 'post_engagement';
  title: string;
  message: string;
  metadata: {
    sender_id?: string;
    sender_name?: string;
    message_id?: string;
    replier_id?: string;
    replier_name?: string;
    discussion_id?: string;
    reply_id?: string;
    discussion_title?: string;
    caller_id?: string;
    caller_name?: string;
    new_likes?: number;
    new_interactions?: number;
    community_id?: string;
  };
  read_at: string | null;
  created_at: string;
}

interface TestNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
}

const NotificationDropdown = ({ user, profile, open, onOpenChange }: NotificationDropdownProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [testNotifications, setTestNotifications] = useState<TestNotification[]>([]);
  const [databaseNotifications, setDatabaseNotifications] = useState<DatabaseNotification[]>([]);
  const [pastNotifications, setPastNotifications] = useState<TestNotification[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"recent" | "past">("recent");
  const [previousUnreadCount, setPreviousUnreadCount] = useState<number>(-1); // -1 means not initialized yet
  const originalTitleRef = useRef<string>(document.title);

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

  // Load past notifications from localStorage
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`pastNotifications_${user.id}`);
      if (stored) {
        try {
          setPastNotifications(JSON.parse(stored));
        } catch (e) {
          console.error('Error loading past notifications:', e);
        }
      }
    }
  }, [user]);

  // Save past notifications to localStorage
  useEffect(() => {
    if (user && pastNotifications.length > 0) {
      localStorage.setItem(`pastNotifications_${user.id}`, JSON.stringify(pastNotifications));
    }
  }, [pastNotifications, user]);

  // Fetch incoming friend requests
  const fetchIncomingRequests = useCallback(async () => {
    if (!user) return;

    const { data: incomingFriendsData, error: incomingFriendsError } = await supabase
      .from('friends')
      .select('user_id, created_at')
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (incomingFriendsData && !incomingFriendsError && incomingFriendsData.length > 0) {
      const userIds = incomingFriendsData.map(req => req.user_id);
      const { data: incomingProfilesData } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, image_url, email')
        .in('id', userIds);

      if (incomingProfilesData) {
        const incomingRequests = incomingFriendsData.map(friends => {
          const profile = incomingProfilesData.find(p => p.id === friends.user_id);
          return { ...friends, profiles: profile };
        });
        setIncomingRequests(incomingRequests);
      }
    } else {
      setIncomingRequests([]);
    }
  }, [user]);

  useEffect(() => {
    fetchIncomingRequests();
    const interval = setInterval(fetchIncomingRequests, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchIncomingRequests]);

  // Fetch database notifications
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        setDatabaseNotifications(data as DatabaseNotification[]);
      }
    };

    fetchNotifications();
    
    // Set up realtime subscription for new notifications
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as DatabaseNotification;
          setDatabaseNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .subscribe();

    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30 seconds
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }

    setDatabaseNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  // Handle notification click
  const handleNotificationClick = async (notification: DatabaseNotification) => {
    // Mark as read
    if (!notification.read_at) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'message' && notification.metadata.sender_id) {
      // Navigate to friends page with chat query parameter to open the conversation
      navigate(`/friends?chat=${notification.metadata.sender_id}`);
    } else if (notification.type === 'discussion_reply' && notification.metadata.community_id) {
      navigate(`/community/${notification.metadata.community_id}`);
    } else if (notification.type === 'call' && notification.metadata.caller_id) {
      // Navigate to friends page with chat query parameter to open the conversation
      navigate(`/friends?chat=${notification.metadata.caller_id}`);
    } else if (notification.type === 'post_engagement' && notification.metadata.community_id) {
      navigate(`/community/${notification.metadata.community_id}`);
    }
  };

  const handleAcceptRequest = async (userId: string, friendId: string) => {
    if (processingRequestId === userId) return;
    
    setProcessingRequestId(userId);
    
    try {
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      if (updateError) throw updateError;

      const { data: existingReciprocal } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .maybeSingle();

      if (!existingReciprocal) {
        const { error: insertError } = await supabase
          .from('friends')
          .insert({
            user_id: friendId,
            friend_id: userId,
            status: 'accepted'
          });

        if (insertError) throw insertError;
      }

      setIncomingRequests(prev => prev.filter(req => req.user_id !== userId));
      
      // Invalidate friend profiles cache to trigger refetch and show new friend immediately
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['friendProfiles', user.id] });
        // Invalidate incoming friend requests to sync with Friends page
        queryClient.invalidateQueries({ queryKey: ['incomingFriendRequests', user.id] });
      }
      
      // Refetch incoming requests to sync with Friends page
      await fetchIncomingRequests();
      
      toast({
        title: "Success",
        description: "Friend request accepted!"
      });
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept friend request",
        variant: "destructive"
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDeclineRequest = async (userId: string, friendId: string) => {
    if (processingRequestId === userId) return;
    
    setProcessingRequestId(userId);
    
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      if (error) throw error;

      setIncomingRequests(prev => prev.filter(req => req.user_id !== userId));
      
      toast({
        title: "Success",
        description: "Friend request declined"
      });
    } catch (error: any) {
      console.error('Error declining friend request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to decline friend request",
        variant: "destructive"
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDismissNotification = (notif: TestNotification) => {
    setTestNotifications(prev => prev.filter(n => n.id !== notif.id));
    // Move to past notifications
    setPastNotifications(prev => [notif, ...prev]);
  };

  const handleDismissDatabaseNotification = async (notificationId: string) => {
    await handleMarkAsRead(notificationId);
    setDatabaseNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-5 h-5 text-white" />;
      case 'discussion_reply':
        return <Reply className="w-5 h-5 text-white" />;
      case 'call':
        return <Phone className="w-5 h-5 text-white" />;
      case 'post_engagement':
        return <TrendingUp className="w-5 h-5 text-white" />;
      default:
        return <Bell className="w-5 h-5 text-white" />;
    }
  };

  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-gradient-to-br from-blue-500 to-blue-600';
      case 'discussion_reply':
        return 'bg-gradient-to-br from-green-500 to-green-600';
      case 'call':
        return 'bg-gradient-to-br from-purple-500 to-purple-600';
      case 'post_engagement':
        return 'bg-gradient-to-br from-orange-500 to-orange-600';
      default:
        return 'bg-gradient-to-br from-blue-500 to-purple-600';
    }
  };

  const handleTestNotification = useCallback(() => {
    const testNotif: TestNotification = {
      id: `test-${Date.now()}`,
      type: 'test',
      title: 'Test Notification',
      message: 'This is a test notification!',
      timestamp: new Date().toISOString(),
    };
    setTestNotifications(prev => [testNotif, ...prev]);
    toast({
      title: "Test Notification",
      description: "You've received a test notification!",
    });
  }, [toast]);

  // Expose test notification function via window for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).testNotification = handleTestNotification;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).testNotification;
      }
    };
  }, [handleTestNotification]);

  const unreadDatabaseNotifications = databaseNotifications.filter(n => !n.read_at);
  const readDatabaseNotifications = databaseNotifications.filter(n => n.read_at);
  const totalNotifications = incomingRequests.length + testNotifications.length + unreadDatabaseNotifications.length;

  // Store original title on mount
  useEffect(() => {
    // Only store if we haven't stored it yet or if current title doesn't contain notification count
    if (!originalTitleRef.current || originalTitleRef.current === '' || originalTitleRef.current.startsWith('(')) {
      // Extract original title if it contains notification count
      const titleMatch = document.title.match(/^\([^)]+\)\s*-\s*(.+)$/);
      if (titleMatch) {
        originalTitleRef.current = titleMatch[1];
      } else {
        originalTitleRef.current = document.title;
      }
    }
  }, []);

  // Update tab title when new notifications arrive
  useEffect(() => {
    const currentUnreadCount = totalNotifications;
    
    // Initialize previous count on first load (don't show title change for existing notifications)
    if (previousUnreadCount === -1) {
      setPreviousUnreadCount(currentUnreadCount);
      return;
    }
    
    // If unread count increased, update tab title
    if (currentUnreadCount > previousUnreadCount) {
      const newCount = currentUnreadCount - previousUnreadCount;
      const newTitle = `(${newCount} New Notification${newCount > 1 ? 's' : ''}) - ${originalTitleRef.current}`;
      document.title = newTitle;
      
      // Restore original title after 2 seconds
      const timeoutId = setTimeout(() => {
        document.title = originalTitleRef.current;
      }, 2000);
      
      setPreviousUnreadCount(currentUnreadCount);
      return () => clearTimeout(timeoutId);
    }
    
    // Update previous count if it decreased (user read notifications)
    if (currentUnreadCount < previousUnreadCount) {
      setPreviousUnreadCount(currentUnreadCount);
    }
  }, [totalNotifications, previousUnreadCount]);
  
  const recentNotifications = [
    ...testNotifications.map(n => ({ ...n, isDatabase: false })),
    ...incomingRequests.map(req => ({
      id: `friend-${req.user_id}`,
      type: 'friend_request',
      title: `${req.profiles?.username || req.profiles?.first_name || 'Someone'}`,
      message: 'wants to be your friend',
      timestamp: req.created_at,
      request: req,
      isDatabase: false,
    })),
    ...unreadDatabaseNotifications.map(n => ({ ...n, isDatabase: true })),
  ].sort((a, b) => new Date(b.timestamp || b.created_at).getTime() - new Date(a.timestamp || a.created_at).getTime());

  // Combine past notifications from localStorage and read database notifications
  const allPastNotifications = [
    ...pastNotifications.map(n => ({ ...n, isDatabase: false })),
    ...readDatabaseNotifications.map(n => ({ ...n, isDatabase: true })),
  ].sort((a, b) => new Date(b.timestamp || b.created_at).getTime() - new Date(a.timestamp || a.created_at).getTime());

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface relative">
            <Bell className="w-5 h-5" />
            {totalNotifications > 0 && (
              <>
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-lg border-2 border-white dark:border-gray-900 animate-pulse">
                  {totalNotifications > 9 ? '9+' : totalNotifications}
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full opacity-75 animate-ping"></div>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-hidden flex flex-col p-0">
          <div className="p-4 border-b bg-gradient-to-r from-home-primary/5 to-home-secondary/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-home-foreground text-base flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </h3>
              {totalNotifications > 0 && (
                <Badge className="bg-home-primary text-white">
                  {totalNotifications}
                </Badge>
              )}
            </div>
            {databaseNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!user) return;
                  
                  try {
                    // Get unread notification IDs
                    const unreadIds = databaseNotifications
                      .filter(n => !n.read_at)
                      .map(n => n.id);
                    
                    if (unreadIds.length > 0) {
                      const { error } = await supabase
                        .from('notifications')
                        .update({ read_at: new Date().toISOString() })
                        .in('id', unreadIds);
                      
                      if (error) {
                        console.error('Error clearing notifications:', error);
                        toast({
                          title: "Error",
                          description: "Failed to clear notifications",
                          variant: "destructive"
                        });
                        return;
                      }
                    }
                    
                    // Update local state
                    setDatabaseNotifications(prev =>
                      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
                    );
                    
                    toast({
                      title: "Success",
                      description: "All notifications cleared"
                    });
                  } catch (err) {
                    console.error('Error clearing notifications:', err);
                    toast({
                      title: "Error",
                      description: "Failed to clear notifications",
                      variant: "destructive"
                    });
                  }
                }}
                className="w-full text-xs h-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Clear All Notifications
              </Button>
            )}
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "recent" | "past")} className="w-full">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="recent" className="flex-1">
                Recent {totalNotifications > 0 && `(${totalNotifications})`}
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1">
                Past {allPastNotifications.length > 0 && `(${allPastNotifications.length})`}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="recent" className="m-0 overflow-y-auto max-h-[400px]">
              {recentNotifications.length > 0 ? (
                <>
                  {recentNotifications.map((notif) => {
                    if (notif.type === 'friend_request' && 'request' in notif) {
                      const request = notif.request as FriendRequest;
                      return (
                        <DropdownMenuItem 
                          key={notif.id} 
                          className="p-4 border-b hover:bg-home-surface/50"
                          onSelect={(e) => {
                            e.preventDefault();
                          }}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <Avatar className="w-10 h-10 border-2 border-home-primary/20 shadow-md">
                              <AvatarImage src={request.profiles?.image_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-home-primary to-home-secondary text-white text-xs font-semibold">
                                {getInitials(request.profiles?.first_name, request.profiles?.last_name, request.profiles?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-home-foreground mb-1">
                                {request.profiles?.username || request.profiles?.first_name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                wants to be your friend
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptRequest(request.user_id, user?.id!);
                                  }}
                                  className="h-7 px-3 bg-green-500 hover:bg-green-600 text-white text-xs font-medium"
                                  disabled={processingRequestId === request.user_id}
                                >
                                  {processingRequestId === request.user_id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Processing
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Accept
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeclineRequest(request.user_id, user?.id!);
                                  }}
                                  className="h-7 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 text-xs font-medium"
                                  disabled={processingRequestId === request.user_id}
                                >
                                  {processingRequestId === request.user_id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Processing
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Decline
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    } else if (notif.isDatabase) {
                      const dbNotif = notif as DatabaseNotification;
                      return (
                        <DropdownMenuItem 
                          key={dbNotif.id} 
                          className={`p-4 border-b hover:bg-home-surface/50 cursor-pointer ${!dbNotif.read_at ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                          onClick={() => handleNotificationClick(dbNotif)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className={`w-10 h-10 rounded-full ${getNotificationIconBg(dbNotif.type)} flex items-center justify-center flex-shrink-0 shadow-md`}>
                              {getNotificationIcon(dbNotif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-home-foreground mb-1">
                                {dbNotif.title}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                {dbNotif.message}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-500">
                                {new Date(dbNotif.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismissDatabaseNotification(dbNotif.id);
                              }}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </DropdownMenuItem>
                      );
                    } else {
                      return (
                        <DropdownMenuItem 
                          key={notif.id} 
                          className="p-4 border-b hover:bg-home-surface/50 cursor-pointer"
                          onClick={() => handleDismissNotification(notif as TestNotification)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                              <Bell className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-home-foreground mb-1">
                                {notif.title}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                {notif.message}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-500">
                                {new Date(notif.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismissNotification(notif as TestNotification);
                              }}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </DropdownMenuItem>
                      );
                    }
                  })}
                </>
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600 opacity-50" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You're all caught up!</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="past" className="m-0 overflow-y-auto max-h-[400px]">
              {allPastNotifications.length > 0 ? (
                <>
                  {allPastNotifications.map((notif) => {
                    if (notif.isDatabase) {
                      const dbNotif = notif as DatabaseNotification;
                      return (
                        <DropdownMenuItem 
                          key={dbNotif.id} 
                          className="p-4 border-b hover:bg-home-surface/50 cursor-pointer"
                          onClick={() => handleNotificationClick(dbNotif)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className={`w-10 h-10 rounded-full ${getNotificationIconBg(dbNotif.type)} flex items-center justify-center flex-shrink-0 shadow-md opacity-60`}>
                              {getNotificationIcon(dbNotif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                {dbNotif.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                                {dbNotif.message}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-600">
                                {new Date(dbNotif.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    } else {
                      return (
                        <DropdownMenuItem 
                          key={notif.id} 
                          className="p-4 border-b hover:bg-home-surface/50 cursor-pointer"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0 shadow-md opacity-60">
                              <Bell className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                {notif.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                                {notif.message}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-600">
                                {new Date(notif.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    }
                  })}
                </>
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600 opacity-50" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No past notifications</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your notification history will appear here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default NotificationDropdown;


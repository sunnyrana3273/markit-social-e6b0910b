import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

interface NotificationDropdownProps {
  user: User | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    email: string;
  } | null;
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

interface TestNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
}

const NotificationDropdown = ({ user, profile }: NotificationDropdownProps) => {
  const { toast } = useToast();
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [testNotifications, setTestNotifications] = useState<TestNotification[]>([]);
  const [pastNotifications, setPastNotifications] = useState<TestNotification[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"recent" | "past">("recent");

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
  useEffect(() => {
    if (!user) return;

    const fetchIncomingRequests = async () => {
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
      }
    };

    fetchIncomingRequests();
    const interval = setInterval(fetchIncomingRequests, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

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

  const totalNotifications = incomingRequests.length + testNotifications.length;
  const recentNotifications = [...testNotifications, ...incomingRequests.map(req => ({
    id: `friend-${req.user_id}`,
    type: 'friend_request',
    title: `${req.profiles?.username || req.profiles?.first_name || 'Someone'}`,
    message: 'wants to be your friend',
    timestamp: req.created_at,
    request: req,
  }))].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <>
      <DropdownMenu>
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
            <div className="flex items-center justify-between">
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
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "recent" | "past")} className="w-full">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="recent" className="flex-1">
                Recent {totalNotifications > 0 && `(${totalNotifications})`}
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1">
                Past {pastNotifications.length > 0 && `(${pastNotifications.length})`}
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
              {pastNotifications.length > 0 ? (
                <>
                  {pastNotifications.map((notif) => (
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
                  ))}
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


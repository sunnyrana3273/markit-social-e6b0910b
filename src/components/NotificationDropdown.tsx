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
  ThumbsUp,
  Reply,
  Phone,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";

interface NotificationDropdownProps {
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

interface BaseNotification {
  id: string;
  type: 'message' | 'discussion_vote' | 'discussion_reply' | 'reply_vote' | 'reply_reply' | 'voice_call' | 'friend_request' | 'test';
  timestamp: string;
  read: boolean;
}

interface MessageNotification extends BaseNotification {
  type: 'message';
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  messagePreview: string;
  friendId: string;
}

interface DiscussionNotification extends BaseNotification {
  type: 'discussion_vote' | 'discussion_reply';
  discussionId: string;
  communityId: string;
  discussionTitle: string;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
}

interface ReplyNotification extends BaseNotification {
  type: 'reply_vote' | 'reply_reply';
  replyId: string;
  discussionId: string;
  communityId: string;
  discussionTitle: string;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
}

interface VoiceCallNotification extends BaseNotification {
  type: 'voice_call';
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
}

interface FriendRequestNotification extends BaseNotification {
  type: 'friend_request';
  request: FriendRequest;
}

type Notification = MessageNotification | DiscussionNotification | ReplyNotification | VoiceCallNotification | FriendRequestNotification | BaseNotification;

const NotificationDropdown = ({}: NotificationDropdownProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pastNotifications, setPastNotifications] = useState<Notification[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"recent" | "past">("recent");
  
  // Track if user is currently in chat or study session
  const isInChatRef = useRef(false);
  const isInStudySessionRef = useRef(false);
  const currentChatFriendIdRef = useRef<string | null>(null);
  
  // Track processed notification IDs to avoid duplicates
  const processedNotificationIdsRef = useRef<Set<string>>(new Set());

  // Check if user is in chat or study session based on route
  useEffect(() => {
    const path = location.pathname;
    isInChatRef.current = path.includes('/friends') && path.includes('chat');
    isInStudySessionRef.current = path.includes('/session/') || path.includes('/study-session');
    
    // Extract chat friend ID from URL if present
    const chatMatch = path.match(/\/friends\/chat\/([^/]+)/);
    currentChatFriendIdRef.current = chatMatch ? chatMatch[1] : null;
  }, [location.pathname]);

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
          const parsed = JSON.parse(stored);
          setPastNotifications(parsed);
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
    const interval = setInterval(fetchIncomingRequests, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const message = payload.new as any;
          
          // Don't notify if user is in chat with this friend
          if (isInChatRef.current && currentChatFriendIdRef.current === message.sender_id) {
            return;
          }

          // Check if already processed
          const notifId = `msg-${message.id}`;
          if (processedNotificationIdsRef.current.has(notifId)) {
            return;
          }
          processedNotificationIdsRef.current.add(notifId);

          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, image_url, email')
            .eq('id', message.sender_id)
            .single();

          if (senderProfile) {
            const notification: MessageNotification = {
              id: notifId,
              type: 'message',
              timestamp: message.created_at,
              read: false,
              senderId: message.sender_id,
              senderName: senderProfile.username || senderProfile.first_name || 'Someone',
              senderAvatar: senderProfile.image_url,
              messagePreview: message.message.substring(0, 50) + (message.message.length > 50 ? '...' : ''),
              friendId: message.sender_id,
            };

            setNotifications(prev => [notification, ...prev]);
            
            toast({
              title: "New Message",
              description: `${notification.senderName}: ${notification.messagePreview}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Real-time subscription for discussion votes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-discussion-votes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_discussion_votes',
        },
        async (payload) => {
          const vote = payload.new as any;
          
          // Only notify if vote is for user's discussion
          const { data: discussion } = await supabase
            .from('community_discussions')
            .select('id, user_id, title, community_id')
            .eq('id', vote.discussion_id)
            .single();

          if (!discussion || discussion.user_id !== user.id || vote.user_id === user.id) {
            return;
          }

          const notifId = `vote-disc-${vote.id}`;
          if (processedNotificationIdsRef.current.has(notifId)) {
            return;
          }
          processedNotificationIdsRef.current.add(notifId);

          // Fetch voter profile
          const { data: voterProfile } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, image_url, email')
            .eq('id', vote.user_id)
            .single();

          if (voterProfile) {
            const notification: DiscussionNotification = {
              id: notifId,
              type: 'discussion_vote',
              timestamp: new Date().toISOString(),
              read: false,
              discussionId: discussion.id,
              communityId: discussion.community_id,
              discussionTitle: discussion.title,
              actorId: vote.user_id,
              actorName: voterProfile.username || voterProfile.first_name || 'Someone',
              actorAvatar: voterProfile.image_url,
            };

            setNotifications(prev => [notification, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription for discussion replies
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-discussion-replies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_discussion_replies',
        },
        async (payload) => {
          const reply = payload.new as any;
          
          // Only notify if reply is to user's discussion
          const { data: discussion } = await supabase
            .from('community_discussions')
            .select('id, user_id, title, community_id')
            .eq('id', reply.discussion_id)
            .single();

          if (!discussion || discussion.user_id !== user.id || reply.user_id === user.id) {
            return;
          }

          const notifId = `reply-disc-${reply.id}`;
          if (processedNotificationIdsRef.current.has(notifId)) {
            return;
          }
          processedNotificationIdsRef.current.add(notifId);

          // Fetch replier profile
          const { data: replierProfile } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, image_url, email')
            .eq('id', reply.user_id)
            .single();

          if (replierProfile) {
            const notification: DiscussionNotification = {
              id: notifId,
              type: 'discussion_reply',
              timestamp: reply.created_at,
              read: false,
              discussionId: discussion.id,
              communityId: discussion.community_id,
              discussionTitle: discussion.title,
              actorId: reply.user_id,
              actorName: replierProfile.username || replierProfile.first_name || 'Someone',
              actorAvatar: replierProfile.image_url,
            };

            setNotifications(prev => [notification, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription for reply votes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-reply-votes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_discussion_votes',
        },
        async (payload) => {
          const vote = payload.new as any;
          
          // Only notify if vote is for user's reply
          if (!vote.reply_id) return;

          const { data: reply } = await supabase
            .from('community_discussion_replies')
            .select('id, user_id, discussion_id')
            .eq('id', vote.reply_id)
            .single();

          if (!reply || reply.user_id !== user.id || vote.user_id === user.id) {
            return;
          }

          const { data: discussion } = await supabase
            .from('community_discussions')
            .select('id, title, community_id')
            .eq('id', reply.discussion_id)
            .single();

          if (!discussion) return;

          const notifId = `vote-reply-${vote.id}`;
          if (processedNotificationIdsRef.current.has(notifId)) {
            return;
          }
          processedNotificationIdsRef.current.add(notifId);

          // Fetch voter profile
          const { data: voterProfile } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, image_url, email')
            .eq('id', vote.user_id)
            .single();

          if (voterProfile) {
            const notification: ReplyNotification = {
              id: notifId,
              type: 'reply_vote',
              timestamp: new Date().toISOString(),
              read: false,
              replyId: reply.id,
              discussionId: discussion.id,
              communityId: discussion.community_id,
              discussionTitle: discussion.title,
              actorId: vote.user_id,
              actorName: voterProfile.username || voterProfile.first_name || 'Someone',
              actorAvatar: voterProfile.image_url,
            };

            setNotifications(prev => [notification, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription for replies to replies
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-reply-replies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_discussion_replies',
        },
        async (payload) => {
          const reply = payload.new as any;
          
          // Only notify if reply is to user's reply
          if (!reply.parent_reply_id) return;

          const { data: parentReply } = await supabase
            .from('community_discussion_replies')
            .select('id, user_id, discussion_id')
            .eq('id', reply.parent_reply_id)
            .single();

          if (!parentReply || parentReply.user_id !== user.id || reply.user_id === user.id) {
            return;
          }

          const { data: discussion } = await supabase
            .from('community_discussions')
            .select('id, title, community_id')
            .eq('id', parentReply.discussion_id)
            .single();

          if (!discussion) return;

          const notifId = `reply-reply-${reply.id}`;
          if (processedNotificationIdsRef.current.has(notifId)) {
            return;
          }
          processedNotificationIdsRef.current.add(notifId);

          // Fetch replier profile
          const { data: replierProfile } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, image_url, email')
            .eq('id', reply.user_id)
            .single();

          if (replierProfile) {
            const notification: ReplyNotification = {
              id: notifId,
              type: 'reply_reply',
              timestamp: reply.created_at,
              read: false,
              replyId: parentReply.id,
              discussionId: discussion.id,
              communityId: discussion.community_id,
              discussionTitle: discussion.title,
              actorId: reply.user_id,
              actorName: replierProfile.username || replierProfile.first_name || 'Someone',
              actorAvatar: replierProfile.image_url,
            };

            setNotifications(prev => [notification, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Listen for incoming voice calls (via window event or custom event)
  useEffect(() => {
    if (!user) return;

    const handleIncomingCall = (event: CustomEvent) => {
      const callData = event.detail as { callerId: string; callerName: string; callerAvatar?: string | null };
      
      // Don't notify if user is in study session
      if (isInStudySessionRef.current) {
        return;
      }

      const notifId = `call-${callData.callerId}-${Date.now()}`;
      if (processedNotificationIdsRef.current.has(notifId)) {
        return;
      }
      processedNotificationIdsRef.current.add(notifId);

      const notification: VoiceCallNotification = {
        id: notifId,
        type: 'voice_call',
        timestamp: new Date().toISOString(),
        read: false,
        callerId: callData.callerId,
        callerName: callData.callerName,
        callerAvatar: callData.callerAvatar || null,
      };

      setNotifications(prev => [notification, ...prev]);
      
      toast({
        title: "Incoming Call",
        description: `${callData.callerName} is calling you`,
      });
    };

    window.addEventListener('incoming-call' as any, handleIncomingCall as EventListener);
    return () => {
      window.removeEventListener('incoming-call' as any, handleIncomingCall as EventListener);
    };
  }, [user, toast]);

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

  const handleDismissNotification = (notif: Notification) => {
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setPastNotifications(prev => [notif, ...prev]);
  };

  const handleNotificationClick = (notif: Notification) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    
    // Navigate based on type
    if (notif.type === 'message') {
      const msgNotif = notif as MessageNotification;
      navigate(`/friends?chat=${msgNotif.friendId}`);
      handleDismissNotification(notif);
    } else if (notif.type === 'discussion_vote' || notif.type === 'discussion_reply') {
      const discNotif = notif as DiscussionNotification;
      navigate(`/community/${discNotif.communityId}?discussion=${discNotif.discussionId}`);
      handleDismissNotification(notif);
    } else if (notif.type === 'reply_vote' || notif.type === 'reply_reply') {
      const replyNotif = notif as ReplyNotification;
      navigate(`/community/${replyNotif.communityId}?discussion=${replyNotif.discussionId}&reply=${replyNotif.replyId}`);
      handleDismissNotification(notif);
    } else if (notif.type === 'voice_call') {
      navigate('/app');
      handleDismissNotification(notif);
    }
  };

  const handleTestNotification = useCallback(() => {
    const testNotif: BaseNotification = {
      id: `test-${Date.now()}`,
      type: 'test',
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [testNotif, ...prev]);
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

  const allNotifications: Notification[] = [
    ...notifications,
    ...incomingRequests.map(req => ({
      id: `friend-${req.user_id}`,
      type: 'friend_request' as const,
      timestamp: req.created_at,
      read: false,
      request: req,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const renderNotification = (notif: Notification) => {
    if (notif.type === 'friend_request' && 'request' in notif) {
      const request = (notif as FriendRequestNotification).request;
      return (
        <DropdownMenuItem 
          key={notif.id} 
          className="p-4 border-b hover:bg-home-surface/50"
          onSelect={(e) => e.preventDefault()}
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
    }

    if (notif.type === 'message') {
      const msgNotif = notif as MessageNotification;
      return (
        <DropdownMenuItem 
          key={notif.id}
          className={`p-4 border-b hover:bg-home-surface/50 cursor-pointer ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
          onClick={() => handleNotificationClick(notif)}
          onSelect={(e) => e.preventDefault()}
        >
          <div className="flex items-start gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="w-6 h-6 border border-white shadow-sm">
                  <AvatarImage src={msgNotif.senderAvatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-500 text-white text-[10px]">
                    {getInitials(msgNotif.senderName.split(' ')[0], msgNotif.senderName.split(' ')[1])}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-home-foreground">
                  {msgNotif.senderName}
                </p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                {msgNotif.messagePreview}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 dark:text-gray-500">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </p>
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      );
    }

    if (notif.type === 'discussion_vote' || notif.type === 'discussion_reply') {
      const discNotif = notif as DiscussionNotification;
      return (
        <DropdownMenuItem 
          key={notif.id}
          className={`p-4 border-b hover:bg-home-surface/50 cursor-pointer ${!notif.read ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}
          onClick={() => handleNotificationClick(notif)}
          onSelect={(e) => e.preventDefault()}
        >
          <div className="flex items-start gap-3 w-full">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
              notif.type === 'discussion_vote' 
                ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                : 'bg-gradient-to-br from-green-500 to-green-600'
            }`}>
              {notif.type === 'discussion_vote' ? (
                <ThumbsUp className="w-5 h-5 text-white" />
              ) : (
                <Reply className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="w-6 h-6 border border-white shadow-sm">
                  <AvatarImage src={discNotif.actorAvatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-500 text-white text-[10px]">
                    {getInitials(discNotif.actorName.split(' ')[0], discNotif.actorName.split(' ')[1])}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-home-foreground">
                  {discNotif.actorName}
                </p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {notif.type === 'discussion_vote' ? 'upvoted' : 'replied to'} your discussion
              </p>
              <p className="text-xs font-medium text-home-foreground mb-2 line-clamp-1">
                "{discNotif.discussionTitle}"
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 dark:text-gray-500">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </p>
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      );
    }

    if (notif.type === 'reply_vote' || notif.type === 'reply_reply') {
      const replyNotif = notif as ReplyNotification;
      return (
        <DropdownMenuItem 
          key={notif.id}
          className={`p-4 border-b hover:bg-home-surface/50 cursor-pointer ${!notif.read ? 'bg-purple-50/50 dark:bg-purple-950/20' : ''}`}
          onClick={() => handleNotificationClick(notif)}
          onSelect={(e) => e.preventDefault()}
        >
          <div className="flex items-start gap-3 w-full">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
              notif.type === 'reply_vote' 
                ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                : 'bg-gradient-to-br from-purple-500 to-purple-600'
            }`}>
              {notif.type === 'reply_vote' ? (
                <ThumbsUp className="w-5 h-5 text-white" />
              ) : (
                <Reply className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="w-6 h-6 border border-white shadow-sm">
                  <AvatarImage src={replyNotif.actorAvatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-500 text-white text-[10px]">
                    {getInitials(replyNotif.actorName.split(' ')[0], replyNotif.actorName.split(' ')[1])}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-home-foreground">
                  {replyNotif.actorName}
                </p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {notif.type === 'reply_vote' ? 'upvoted' : 'replied to'} your reply
              </p>
              <p className="text-xs font-medium text-home-foreground mb-2 line-clamp-1">
                "{replyNotif.discussionTitle}"
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 dark:text-gray-500">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </p>
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      );
    }

    if (notif.type === 'voice_call') {
      const callNotif = notif as VoiceCallNotification;
      return (
        <DropdownMenuItem 
          key={notif.id}
          className={`p-4 border-b hover:bg-home-surface/50 cursor-pointer ${!notif.read ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
          onClick={() => handleNotificationClick(notif)}
          onSelect={(e) => e.preventDefault()}
        >
          <div className="flex items-start gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-md animate-pulse">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="w-6 h-6 border border-white shadow-sm">
                  <AvatarImage src={callNotif.callerAvatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-red-400 to-red-500 text-white text-[10px]">
                    {getInitials(callNotif.callerName.split(' ')[0], callNotif.callerName.split(' ')[1])}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-home-foreground">
                  {callNotif.callerName}
                </p>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                is calling you. Join a study session to answer.
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 dark:text-gray-500">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </p>
                <ArrowRight className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
        </DropdownMenuItem>
      );
    }

    // Default/fallback notification
    return (
      <DropdownMenuItem 
        key={notif.id} 
        className="p-4 border-b hover:bg-home-surface/50 cursor-pointer"
        onClick={() => handleDismissNotification(notif)}
        onSelect={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-home-foreground mb-1">
              Notification
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {notif.type}
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
              handleDismissNotification(notif);
            }}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <>
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-lg border-2 border-white dark:border-gray-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
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
              {unreadCount > 0 && (
                <Badge className="bg-home-primary text-white">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "recent" | "past")} className="w-full">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="recent" className="flex-1">
                Recent {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="past" className="flex-1">
                Past {pastNotifications.length > 0 && `(${pastNotifications.length})`}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="recent" className="m-0 overflow-y-auto max-h-[400px]">
              {allNotifications.length > 0 ? (
                <>
                  {allNotifications.map((notif) => renderNotification(notif))}
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
                      className="p-4 border-b hover:bg-home-surface/50 cursor-pointer opacity-60"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
                            {notif.type}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
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

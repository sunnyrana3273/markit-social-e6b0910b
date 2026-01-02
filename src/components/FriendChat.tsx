import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, X, ArrowDown, Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { useFriendMessages } from "@/hooks/useFriendMessages";

interface FriendChatProps {
  friendId: string;
  friendName: string;
  onClose: () => void;
  initialMessages?: Message[];
  attachment?: string | null;
  onClearAttachment?: () => void;
  canAttachWhiteboard?: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export function FriendChat({
  friendId,
  friendName,
  onClose,
  initialMessages = [],
  attachment,
  onClearAttachment,
  canAttachWhiteboard = false,
}: FriendChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(attachment || null);
  const initializedKeyRef = useRef<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const oldestMessageIdRef = useRef<string | null>(null);
  const loadOlderTimeoutRef = useRef<number | null>(null);
  const hasDoneInitialScrollRef = useRef(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const activeSessionIntervalRef = useRef<number | null>(null);

  // Use React Query hook for messages (cached)
  const {
    messages,
    isLoading,
    sendMessage: sendMessageMutation,
    isSending,
    loadOlderMessages,
    appendMessage,
    markAsRead,
    refetch: refetchMessages,
  } = useFriendMessages(currentUserId, friendId);
  
  // Store appendMessage and markAsRead in refs to avoid stale closures
  const appendMessageRef = useRef(appendMessage);
  const markAsReadRef = useRef(markAsRead);
  
  useEffect(() => {
    appendMessageRef.current = appendMessage;
    markAsReadRef.current = markAsRead;
  }, [appendMessage, markAsRead]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // Mark chat as active when component mounts and keep it active while viewing
  useEffect(() => {
    if (!currentUserId || !friendId) return;

    // Mark chat as active immediately
    const markChatActive = async () => {
      const { error } = await (supabase as any)
        .from('active_chat_sessions')
        .upsert({
          user_id: currentUserId,
          friend_id: friendId,
          last_active_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,friend_id'
        });
      if (error) {
        console.error('[FriendChat] Failed to mark chat as active:', error);
      }
    };

    markChatActive();

    // Update active status every 20 seconds while chat is open
    activeSessionIntervalRef.current = window.setInterval(() => {
      markChatActive();
    }, 20000);

    // Cleanup: remove active session when component unmounts or chat closes
    return () => {
      if (activeSessionIntervalRef.current) {
        clearInterval(activeSessionIntervalRef.current);
        activeSessionIntervalRef.current = null;
      }
      
      // Remove active session
      const removeActiveSession = async () => {
        const { error } = await (supabase as any)
          .from('active_chat_sessions')
          .delete()
          .eq('user_id', currentUserId)
          .eq('friend_id', friendId);
        if (error) {
          console.error('[FriendChat] Failed to remove active chat session:', error);
        }
      };
      removeActiveSession();
    };
  }, [currentUserId, friendId]);

  useEffect(() => {
    setPendingAttachment(attachment || null);
  }, [attachment]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!currentUserId) return;
    
    // Create a unique key for this user/friend combination
    const initKey = `${currentUserId}-${friendId}`;
    
    // Prevent duplicate initialization for the same user/friend combination
    if (initializedKeyRef.current === initKey) {
      console.log('[FriendChat] Subscription already initialized for', initKey);
      return;
    }
    initializedKeyRef.current = initKey;

    const channelName = `friend-chat-${[currentUserId, friendId].sort().join('-')}`;
    console.log('[FriendChat] Setting up real-time subscription for channel:', channelName);

    const channel = supabase
      .channel(channelName, {
        config: {
          presence: { key: currentUserId },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friend_messages",
        },
        (payload) => {
          console.log('[FriendChat] Real-time INSERT event received:', {
            messageId: payload.new?.id,
            senderId: payload.new?.sender_id,
            receiverId: payload.new?.receiver_id,
            currentUserId,
            friendId
          });
          
          const newMessage = payload.new as Message;
          
          // Only process messages between current user and this friend
          const isRelevantMessage = 
            (newMessage.sender_id === currentUserId && newMessage.receiver_id === friendId) ||
            (newMessage.sender_id === friendId && newMessage.receiver_id === currentUserId);
          
          if (!isRelevantMessage) {
            console.log('[FriendChat] Ignoring message - not for this conversation');
            return;
          }
          
          // If it's a message FROM friend TO current user, append it
          if (newMessage.sender_id === friendId && newMessage.receiver_id === currentUserId) {
            console.log('[FriendChat] Message from friend - appending to cache');
            // Use ref to avoid stale closure
            appendMessageRef.current(newMessage);
            
            // Auto-scroll to bottom if user is near bottom
            if (isNearBottomRef.current) {
              setTimeout(() => scrollToBottom('smooth'), 100);
            }
            
            // Mark as read
            setTimeout(() => {
              markAsReadRef.current(newMessage.id);
            }, 500);
          } else if (newMessage.sender_id === currentUserId && newMessage.receiver_id === friendId) {
            // This is our own message - the mutation should handle it
            console.log('[FriendChat] Received confirmation of our own message');
            // The mutation's onSuccess will handle replacing the optimistic message
          }
        }
      )
      .subscribe((status) => {
        console.log('[FriendChat] Subscription status:', status);
        setIsConnected(status === "SUBSCRIBED");
        
        if (status === "SUBSCRIBED") {
          console.log('[FriendChat] ✅ Successfully subscribed to real-time updates');
        } else if (status === "CHANNEL_ERROR") {
          console.error('[FriendChat] ❌ Channel subscription error');
        } else if (status === "TIMED_OUT") {
          console.error('[FriendChat] ⏱️ Subscription timed out');
        } else if (status === "CLOSED") {
          console.log('[FriendChat] 🔒 Channel closed');
        }
      });

    return () => {
      console.log('[FriendChat] Cleaning up subscription');
      supabase.removeChannel(channel);
      // Reset the initialized key when cleanup runs
      if (initializedKeyRef.current === initKey) {
        initializedKeyRef.current = null;
      }
    };
  }, [currentUserId, friendId]);

  // Track oldest message for pagination
  useEffect(() => {
    if (messages.length > 0) {
      oldestMessageIdRef.current = messages[0].id;
      setHasMoreMessages(messages.length >= 30); // Assume more if we got a full page
    } else {
      setHasMoreMessages(false);
    }
  }, [messages]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current && !isLoading) {
      // Only auto-scroll if user is near bottom or this is the first load
      if (isNearBottom || !hasDoneInitialScrollRef.current) {
        hasDoneInitialScrollRef.current = true;
        // Use multiple attempts to ensure scroll happens
        const timeout1 = setTimeout(() => scrollToBottom('auto'), 50);
        const timeout2 = setTimeout(() => scrollToBottom('auto'), 200);
        const timeout3 = setTimeout(() => scrollToBottom('auto'), 500);
        
        return () => {
          clearTimeout(timeout1);
          clearTimeout(timeout2);
          clearTimeout(timeout3);
        };
      }
    }
  }, [messages.length, isNearBottom, isLoading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadOlderTimeoutRef.current) {
        clearTimeout(loadOlderTimeoutRef.current);
      }
    };
  }, []);

  // Load older messages when scrolling to top
  const handleLoadOlderMessages = async () => {
    if (!currentUserId || !oldestMessageIdRef.current || isLoadingOlder || !hasMoreMessages) {
      return;
    }

    setIsLoadingOlder(true);
    
    try {
      // Find the oldest message
      const oldestMessage = messages.find(m => m.id === oldestMessageIdRef.current);
      
      if (!oldestMessage) {
        setHasMoreMessages(false);
        setIsLoadingOlder(false);
        return;
      }

      // Store scroll position before adding new messages
      const scrollContainer = scrollRef.current;
      const scrollableElement = scrollContainer?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      const targetElement = scrollableElement || scrollContainer;
      const previousScrollHeight = targetElement?.scrollHeight || 0;
      const previousScrollTop = targetElement?.scrollTop || 0;

      // Load older messages using the hook (updates cache)
      const olderMessages = await loadOlderMessages(oldestMessage.created_at);

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
      } else if (olderMessages.length < 30) {
        // If we got fewer than requested, there are no more
        setHasMoreMessages(false);
      }

      // Restore scroll position after DOM update
      requestAnimationFrame(() => {
        if (targetElement) {
          const newScrollHeight = targetElement.scrollHeight;
          const scrollDifference = newScrollHeight - previousScrollHeight;
          targetElement.scrollTop = previousScrollTop + scrollDifference;
        }
        setIsLoadingOlder(false);
      });
    } catch (error) {
      console.error("Error in loadOlderMessages:", error);
      toast.error("Failed to load older messages");
      setIsLoadingOlder(false);
    }
  };

  // Handle scroll events to detect if user is near bottom or top
  const handleScroll = () => {
    if (scrollRef.current) {
      // Find the actual scrollable viewport
      const scrollableElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      const targetElement = scrollableElement || scrollRef.current;
      
      const { scrollTop, scrollHeight, clientHeight } = targetElement;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
      setIsNearBottom(isAtBottom);
      isNearBottomRef.current = isAtBottom; // Keep ref in sync

      // Debounce loading older messages when scrolling near top
      if (scrollTop < 100 && hasMoreMessages && !isLoadingOlder && currentUserId) {
        if (loadOlderTimeoutRef.current) {
          clearTimeout(loadOlderTimeoutRef.current);
        }
        loadOlderTimeoutRef.current = window.setTimeout(() => {
          handleLoadOlderMessages();
        }, 150);
      }
    }
  };

  // Scroll to bottom function
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      // ScrollArea wraps content, find the actual scrollable viewport
      const scrollableElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      const targetElement = scrollableElement || scrollRef.current;
      
      targetElement.scrollTo({
        top: targetElement.scrollHeight,
        behavior
      });
    }
  };

  // Format message date: "Today at XX:XX", "Yesterday at XX:XX", or "Mon, Dec 1 at XX:XX"
  const formatMessageDate = (dateString: string): string => {
    const date = new Date(dateString);
    const time = format(date, "h:mm a");
    
    if (isToday(date)) {
      return `Today at ${time}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${time}`;
    } else {
      return `${format(date, "EEE, MMM d")} at ${time}`;
    }
  };

  // Check if we should show a date separator before this message
  const shouldShowDateSeparator = (currentIndex: number): boolean => {
    if (currentIndex === 0) return true; // Always show date for first message
    
    const currentMsg = messages[currentIndex];
    const previousMsg = messages[currentIndex - 1];
    
    if (!currentMsg || !previousMsg) return false;
    
    const currentDate = new Date(currentMsg.created_at);
    const previousDate = new Date(previousMsg.created_at);
    
    // Show separator if messages are from different days
    return !isSameDay(currentDate, previousDate);
  };

  const requestWhiteboardAttachment = async () => {
    try {
      const channel = new BroadcastChannel('whiteboard-capture');
      const requestId = `capture-${Date.now()}`;

      const cleanup = () => channel.close();

      channel.onmessage = (event) => {
        const payload = event.data as { requestId: string; image?: string; error?: string };
        if (!payload || payload.requestId !== requestId) return;

        if (payload.image) {
          setPendingAttachment(payload.image);
        } else if (payload.error) {
          toast.error(payload.error);
        }
        cleanup();
      };

      channel.postMessage({ type: 'capture-request', requestId });
    } catch (error) {
      console.error('Failed to request whiteboard capture:', error);
    }
  };

  // Handle paste events to capture images
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the pasted item is an image
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) return;
        
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Image = event.target?.result as string;
          if (base64Image) {
            setPendingAttachment(base64Image);
            toast.success('Image pasted! Click send to share.');
          }
        };
        reader.onerror = () => {
          toast.error('Failed to process image');
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    const messageText = newMessage.trim();
    const hasAttachment = !!pendingAttachment;
    if (!messageText && !hasAttachment) return;

    // Clear input immediately
    const messageToSend = messageText;
    const attachmentToSend = pendingAttachment;
    setNewMessage("");
    if (hasAttachment) {
      setPendingAttachment(null);
      onClearAttachment?.();
    }

    // Scroll to bottom
    setTimeout(scrollToBottom, 10);

    try {
      // Send attachment if present
      if (hasAttachment && attachmentToSend) {
        await sendMessageMutation({
          sender_id: currentUserId,
          receiver_id: friendId,
          message: attachmentToSend,
        });
      }

      // Send text message if present
      if (messageToSend) {
        await sendMessageMutation({
          sender_id: currentUserId,
          receiver_id: friendId,
          message: messageToSend,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-3xl h-[720px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Chat with {friendName}</h2>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} 
                 title={isConnected ? 'Connected' : 'Disconnected'} />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 relative" ref={scrollRef} onScrollCapture={handleScroll}>
          <div className="space-y-4">
            {/* Loading indicator for older messages */}
            {isLoadingOlder && (
              <div className="flex justify-center py-2">
                <div className="text-xs text-muted-foreground">Loading older messages...</div>
              </div>
            )}
            
            {/* Empty state - no messages */}
            {!isLoading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
                <div className="text-muted-foreground mb-4">
                  <MessageSquare className="h-16 w-16 mx-auto opacity-50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No messages yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Start a conversation with {friendName} by sending your first message below.
                  </p>
                </div>
              </div>
            )}
            
            {/* Messages in ascending order (oldest → newest) */}
            {messages.map((msg, index) => {
              const isCurrentUser = msg.sender_id === currentUserId;
              const isImageMessage = msg.message.startsWith('data:image');
              const showDateSeparator = shouldShowDateSeparator(index);

              let bubbleClasses = isImageMessage
                ? 'rounded-lg p-2 max-w-fit border border-border/60 bg-background/95 flex flex-col gap-2'
                : 'rounded-lg px-4 py-2 max-w-[70%]';

              if (isImageMessage) {
                bubbleClasses += isCurrentUser
                  ? ' self-end bg-primary/10 text-foreground'
                  : ' bg-muted/70 text-foreground';
              } else {
                bubbleClasses += isCurrentUser
                  ? ' bg-primary text-primary-foreground'
                  : ' bg-muted text-foreground';
              }

              return (
                <div key={msg.id}>
                  {/* Date separator */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <div className="px-3 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
                        {formatMessageDate(msg.created_at).split(' at ')[0]}
                      </div>
                    </div>
                  )}
                  
                  {/* Message bubble */}
                  <div
                    className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className={bubbleClasses}>
                      {isImageMessage ? (
                        <img 
                          src={msg.message} 
                          alt="attachment" 
                          className="rounded-md w-44 h-auto block cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={() => setExpandedImage(msg.message)}
                        />
                      ) : (
                        <p className="text-sm">{msg.message}</p>
                      )}
                      <div className={`flex ${isImageMessage ? 'justify-end' : 'justify-between'} items-center mt-1`}>
                        <span className="text-xs opacity-70">
                          {format(new Date(msg.created_at), "h:mm a")}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs opacity-70 ml-2">
                            {msg.id.startsWith('temp-') ? "⋯" : msg.read_at ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll to bottom button */}
          {!isNearBottom && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-4 right-4 rounded-full shadow-lg"
              onClick={() => scrollToBottom('smooth')}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
        </ScrollArea>

        {/* Attachment Preview */}
        {(pendingAttachment) && (
          <div className="px-4">
            <div className="border rounded-lg p-2 bg-muted/40 inline-flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {pendingAttachment.startsWith('data:image') ? 'Image Preview' : 'Whiteboard Preview'}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setPendingAttachment(null);
                    onClearAttachment?.();
                  }}
                  aria-label="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded-md border overflow-hidden">
                <img
                  src={pendingAttachment}
                  alt="Attached image"
                  className="w-44 h-auto block cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setExpandedImage(pendingAttachment)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-1.5 items-center">
          {canAttachWhiteboard && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={isLoading}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8}>
                <DropdownMenuItem
                  onClick={() => {
                    requestWhiteboardAttachment();
                  }}
                >
                  Attach Whiteboard Preview
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder={pendingAttachment ? "Add a message for your friend..." : "Type a message or paste an image..."}
            disabled={isSending}
            className="flex-1"
          />
          <Button type="submit" disabled={isSending || (!newMessage.trim() && !pendingAttachment)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Expanded Image Dialog */}
      <Dialog open={!!expandedImage} onOpenChange={(open) => !open && setExpandedImage(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-transparent border-none shadow-none">
          {expandedImage && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={expandedImage}
                alt="Expanded view"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

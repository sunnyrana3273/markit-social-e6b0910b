import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Send, X, ArrowDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(attachment || null);
  const initializedKeyRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const oldestMessageIdRef = useRef<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const loadOlderTimeoutRef = useRef<number | null>(null);
  const hasDoneInitialScrollRef = useRef(false);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    setPendingAttachment(attachment || null);
  }, [attachment]);

  useEffect(() => {
    if (!currentUserId) return;
    
    // Create a unique key for this user/friend combination
    const initKey = `${currentUserId}-${friendId}`;
    
    // Prevent duplicate initialization for the same user/friend combination
    if (initializedKeyRef.current === initKey) return;
    initializedKeyRef.current = initKey;

    const channelName = `friend-chat-${[currentUserId, friendId].sort().join('-')}`;

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
          const newMessage = payload.new as Message;
          // Only add message if it's between current user and this friend
          if (
            (newMessage.sender_id === currentUserId && newMessage.receiver_id === friendId) ||
            (newMessage.sender_id === friendId && newMessage.receiver_id === currentUserId)
          ) {
            // Only add if it's not a message we sent (to avoid duplicates from optimistic updates)
            if (newMessage.sender_id !== currentUserId) {
              // New message received real-time from friend
              setMessages((prev) => [...prev, newMessage]);
              
              // Mark as read if it's a message TO the current user
              if (newMessage.receiver_id === currentUserId) {
                setTimeout(async () => {
                  const { error } = await supabase
                    .from('friend_messages')
                    .update({ read_at: new Date().toISOString() })
                    .eq('id', newMessage.id);
                  
                  if (error) {
                    console.error('Failed to mark message as read:', error);
                  }
                }, 500);
              }
            } else {
              // This is our own message from the database - replace the optimistic message
              setMessages((prev) => prev.map(msg => 
                msg.id.startsWith('temp-') && msg.sender_id === currentUserId 
                  ? newMessage 
                  : msg
              ));
            }
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    // Initialize messages only once
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
      if (initialMessages.length > 0) {
        oldestMessageIdRef.current = initialMessages[0].id;
        setHasMoreMessages(initialMessages.length >= 50); // Assume more if we got a full page
      }
      // Use multiple attempts to ensure scroll happens after DOM is ready
      setTimeout(() => scrollToBottom('auto'), 50);
      setTimeout(() => scrollToBottom('auto'), 200);
      setTimeout(() => scrollToBottom('auto'), 500);
    } else if (!isFetchingRef.current) {
      isFetchingRef.current = true;
      const fetchMessages = async () => {
        try {
          const { data, error } = await supabase
            .from("friend_messages")
            .select("*")
            .in('sender_id', [currentUserId, friendId])
            .in('receiver_id', [currentUserId, friendId])
            .order("created_at", { ascending: true })
            .limit(50);

          if (error) {
            console.error("[FriendChat] Error fetching messages:", error);
            toast.error("Failed to load messages");
          } else {
            const fetchedMessages = data || [];
            setMessages(fetchedMessages);
            if (fetchedMessages.length > 0) {
              oldestMessageIdRef.current = fetchedMessages[0].id;
              setHasMoreMessages(fetchedMessages.length >= 50);
            } else {
              setHasMoreMessages(false);
            }
            // Use multiple attempts to ensure scroll happens after DOM is ready
            setTimeout(() => scrollToBottom('auto'), 50);
            setTimeout(() => scrollToBottom('auto'), 200);
            setTimeout(() => scrollToBottom('auto'), 500);
          }
        } finally {
          isFetchingRef.current = false;
        }
      };

      fetchMessages();
    }

    return () => {
      supabase.removeChannel(channel);
      // Reset the initialized key when cleanup runs (this happens when dependencies change or component unmounts)
      // This allows re-initialization when switching friends
      if (initializedKeyRef.current === initKey) {
        initializedKeyRef.current = null;
      }
      isFetchingRef.current = false;
    };
  }, [currentUserId, friendId]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      // Only auto-scroll if user is near bottom or this is the first load
      if (isNearBottom || messages.length <= 1) {
        // Use multiple attempts to ensure scroll happens
        const timeout1 = setTimeout(() => scrollToBottom('auto'), 50);
        const timeout2 = setTimeout(() => scrollToBottom('auto'), 200);
        
        return () => {
          clearTimeout(timeout1);
          clearTimeout(timeout2);
        };
      }
    }
  }, [messages.length, isNearBottom]);

  // Force scroll to bottom when messages first load
  useEffect(() => {
    if (messages.length > 0 && !hasDoneInitialScrollRef.current) {
      hasDoneInitialScrollRef.current = true;
      
      // Try multiple times to ensure scroll happens after DOM is fully rendered
      const timeouts = [
        setTimeout(() => scrollToBottom('auto'), 100),
        setTimeout(() => scrollToBottom('auto'), 300),
        setTimeout(() => scrollToBottom('auto'), 600)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [messages.length]); // Run when messages change

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadOlderTimeoutRef.current) {
        clearTimeout(loadOlderTimeoutRef.current);
      }
    };
  }, []);

  // Load older messages when scrolling to top
  const loadOlderMessages = async () => {
    if (!currentUserId || !oldestMessageIdRef.current || isLoadingOlder || !hasMoreMessages) {
      return;
    }

    setIsLoadingOlder(true);
    
    try {
      // Get the oldest message from current state using a callback
      let oldestMessage: Message | undefined;
      setMessages(prev => {
        oldestMessage = prev.find(m => m.id === oldestMessageIdRef.current);
        return prev;
      });

      // Wait a tick to ensure state is read
      await new Promise(resolve => setTimeout(resolve, 0));

      if (!oldestMessage) {
        setHasMoreMessages(false);
        setIsLoadingOlder(false);
        return;
      }

      const { data, error } = await supabase
        .from("friend_messages")
        .select("*")
        .in('sender_id', [currentUserId, friendId])
        .in('receiver_id', [currentUserId, friendId])
        .lt('created_at', oldestMessage.created_at)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error("Error loading older messages:", error);
        toast.error("Failed to load older messages");
        setIsLoadingOlder(false);
        return;
      }

      const olderMessages = data || [];
      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
        setIsLoadingOlder(false);
        return;
      }

      // Store scroll position before adding new messages
      const scrollContainer = scrollRef.current;
      if (scrollContainer) {
        const scrollableElement = scrollContainer.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        const targetElement = scrollableElement || scrollContainer;
        const previousScrollHeight = targetElement.scrollHeight;
        const previousScrollTop = targetElement.scrollTop;

        // Prepend older messages (maintain ascending order)
        setMessages(prev => {
          const updated = [...olderMessages, ...prev];
          if (olderMessages.length > 0) {
            oldestMessageIdRef.current = olderMessages[0].id;
          }
          return updated;
        });

        // Restore scroll position after DOM update
        requestAnimationFrame(() => {
          if (targetElement) {
            const newScrollHeight = targetElement.scrollHeight;
            const scrollDifference = newScrollHeight - previousScrollHeight;
            targetElement.scrollTop = previousScrollTop + scrollDifference;
          }
          setIsLoadingOlder(false);
        });
      } else {
        setIsLoadingOlder(false);
      }
    } catch (error) {
      console.error("Error in loadOlderMessages:", error);
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

      // Debounce loading older messages when scrolling near top
      if (scrollTop < 100 && hasMoreMessages && !isLoadingOlder && currentUserId) {
        if (loadOlderTimeoutRef.current) {
          clearTimeout(loadOlderTimeoutRef.current);
        }
        loadOlderTimeoutRef.current = window.setTimeout(() => {
          loadOlderMessages();
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    const messageText = newMessage.trim();
    const hasAttachment = !!pendingAttachment;
    if (!messageText && !hasAttachment) return;

    setIsLoading(true);

    const payloads: Array<{ sender_id: string; receiver_id: string; message: string }> = [];
    const optimisticMessages: Message[] = [];

    const timestamp = Date.now();
    let tempIndex = 0;

    if (hasAttachment && pendingAttachment) {
      payloads.push({
        sender_id: currentUserId,
        receiver_id: friendId,
        message: pendingAttachment,
      });
      optimisticMessages.push({
        id: `temp-${timestamp}-${tempIndex++}`,
        sender_id: currentUserId,
        receiver_id: friendId,
        message: pendingAttachment,
        created_at: new Date().toISOString(),
        read_at: null,
      });
    }

    if (messageText) {
      payloads.push({
        sender_id: currentUserId,
        receiver_id: friendId,
        message: messageText,
      });
      optimisticMessages.push({
        id: `temp-${timestamp}-${tempIndex++}`,
        sender_id: currentUserId,
        receiver_id: friendId,
        message: messageText,
        created_at: new Date().toISOString(),
        read_at: null,
      });
    }

    setMessages(prev => [...prev, ...optimisticMessages]);
    setNewMessage("");
    if (hasAttachment) {
      setPendingAttachment(null);
      onClearAttachment?.();
    }

    setTimeout(scrollToBottom, 10);

    const { data, error } = await supabase
      .from("friend_messages")
      .insert(payloads)
      .select();

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setMessages(prev => prev.filter(msg => !msg.id.startsWith(`temp-${timestamp}`)));
    } else if (data) {
      setMessages(prev =>
        prev.map(msg => {
          if (!msg.id.startsWith(`temp-${timestamp}`)) return msg;
          const replacement = data.shift();
          return replacement ? (replacement as Message) : msg;
        })
      );
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-4xl h-[720px] flex flex-col">
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
            
            {/* Messages in ascending order (oldest → newest) */}
            {messages.map((msg) => {
              const isCurrentUser = msg.sender_id === currentUserId;
              const isImageMessage = msg.message.startsWith('data:image');

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
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={bubbleClasses}>
                    {isImageMessage ? (
                      <img src={msg.message} alt="attachment" className="rounded-md w-44 h-auto block" />
                    ) : (
                      <p className="text-sm">{msg.message}</p>
                    )}
                    <div className={`flex ${isImageMessage ? 'justify-end' : 'justify-between'} items-center mt-1`}>
                      <span className="text-xs opacity-70">
                        {format(new Date(msg.created_at), "h:mm a")}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs opacity-70">
                          {msg.id.startsWith('temp-') ? "⋯" : msg.read_at ? "✓✓" : "✓"}
                        </span>
                      )}
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
                <span className="text-xs font-medium text-muted-foreground">Whiteboard Preview</span>
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
                  alt="Attached whiteboard"
                  className="w-44 h-auto block"
                />
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2 items-center">
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
            placeholder={pendingAttachment ? "Add a message for your friend..." : "Type a message..."}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || (!newMessage.trim() && !pendingAttachment)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

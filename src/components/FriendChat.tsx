import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FriendChatProps {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export function FriendChat({ friendId, friendName, onClose }: FriendChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("friend_messages")
        .select("*")
        .in('sender_id', [currentUserId, friendId])
        .in('receiver_id', [currentUserId, friendId])
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        toast.error("Failed to load messages");
      } else {
        setMessages(data || []);
        // Scroll to bottom after loading messages
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'auto'
            });
          }
        }, 100);
      }
    };

    fetchMessages();

    // Set up realtime subscription for new messages
    const channel = supabase
      .channel(`friend-chat-${friendId}`, {
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, friendId]);

  useEffect(() => {
    // Only auto-scroll if user is near bottom or this is the first load
    if (isNearBottom || messages.length === 1) {
      const scrollToBottom = () => {
        if (scrollRef.current) {
          // Use smooth scrolling for better UX
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      };

      // Small delay to ensure DOM is updated with new message
      const timeoutId = setTimeout(scrollToBottom, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isNearBottom]);

  // Handle scroll events to detect if user is near bottom
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
      setIsNearBottom(isAtBottom);
    }
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    setIsLoading(true);
    const messageText = newMessage.trim();
    
    // Create optimistic message to show immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`, // Temporary ID
      sender_id: currentUserId,
      receiver_id: friendId,
      message: messageText,
      created_at: new Date().toISOString(),
      read_at: null
    };

    // Add message immediately to UI
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");

    // Force scroll to bottom immediately after sending
    setTimeout(scrollToBottom, 10);

    // Send to database
    const { data, error } = await supabase.from("friend_messages").insert({
      sender_id: currentUserId,
      receiver_id: friendId,
      message: messageText,
    }).select().single();

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    } else {
      // Replace optimistic message with real message from database
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? data : msg
      ));
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-2xl h-[600px] flex flex-col">
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
            {messages.map((msg) => {
              const isCurrentUser = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      isCurrentUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.message.startsWith('data:image') ? (
                      <img src={msg.message} alt="attachment" className="rounded-md max-w-full h-auto" />
                    ) : (
                      <p className="text-sm">{msg.message}</p>
                    )}
                    <div className="flex justify-between items-center mt-1">
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
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

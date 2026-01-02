import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

const MESSAGES_PER_PAGE = 30;

const fetchMessages = async (
  currentUserId: string,
  friendId: string
): Promise<Message[]> => {
  // For initial load, get the latest 30 messages
  // Fetch in descending order, then reverse to get ascending order for display
  const { data, error } = await supabase
    .from('friend_messages')
    .select('*')
    .in('sender_id', [currentUserId, friendId])
    .in('receiver_id', [currentUserId, friendId])
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PER_PAGE);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const messages = (data || []) as Message[];
  
  // Reverse to get ascending order (oldest to newest)
  return messages.reverse();
};

export const useFriendMessages = (currentUserId: string | null, friendId: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['friendMessages', currentUserId, friendId];

  // Main query for messages
  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!currentUserId) {
        throw new Error('User ID is required');
      }
      return fetchMessages(currentUserId, friendId);
    },
    enabled: !!currentUserId && !!friendId,
    staleTime: 5 * 60 * 1000, // 5 minutes - messages don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
  });

  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { message: string; sender_id: string; receiver_id: string }) => {
      const { data, error } = await supabase
        .from('friend_messages')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as Message;
    },
    onMutate: async (payload) => {
      // Optimistic update - add message to cache immediately
      await queryClient.cancelQueries({ queryKey });

      const previousMessages = queryClient.getQueryData<Message[]>(queryKey) || [];

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        sender_id: payload.sender_id,
        receiver_id: payload.receiver_id,
        message: payload.message,
        created_at: new Date().toISOString(),
        read_at: null,
      };

      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [...old, optimisticMessage]);

      return { previousMessages };
    },
    onError: (err, payload, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKey, context.previousMessages);
      }
    },
    onSuccess: (newMessage, payload, context) => {
      // Replace optimistic message with real one from server
      queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map(msg => 
          msg.id.startsWith('temp-') && msg.sender_id === payload.sender_id
            ? newMessage
            : msg
        )
      );
    },
  });

  // Function to load older messages (pagination)
  const loadOlderMessages = async (beforeDate: string): Promise<Message[]> => {
    if (!currentUserId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from('friend_messages')
      .select('*')
      .in('sender_id', [currentUserId, friendId])
      .in('receiver_id', [currentUserId, friendId])
      .lt('created_at', beforeDate)
      .order('created_at', { ascending: true })
      .limit(MESSAGES_PER_PAGE);

    if (error) {
      throw new Error(`Failed to load older messages: ${error.message}`);
    }

    const olderMessages = (data || []) as Message[];

    // Prepend older messages to cache
    queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
      // Avoid duplicates
      const existingIds = new Set(old.map(m => m.id));
      const newMessages = olderMessages.filter(m => !existingIds.has(m.id));
      return [...newMessages, ...old];
    });

    return olderMessages;
  };

  // Function to append a new message to cache (for real-time updates)
  const appendMessage = (message: Message) => {
    console.log('[useFriendMessages] Appending message to cache:', message.id, message.message.substring(0, 50));
    queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
      // Check if message already exists (avoid duplicates)
      if (old.some(m => m.id === message.id)) {
        console.log('[useFriendMessages] Message already in cache, skipping');
        return old;
      }
      console.log('[useFriendMessages] Adding new message to cache, total messages:', old.length + 1);
      const updated = [...old, message];
      return updated;
    });
  };

  // Function to mark message as read
  const markAsRead = async (messageId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('friend_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to mark message as read:', error);
      return;
    }

    // Update cache
    queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
      old.map(msg =>
        msg.id === messageId
          ? { ...msg, read_at: new Date().toISOString() }
          : msg
      )
    );
  };

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    loadOlderMessages,
    appendMessage,
    markAsRead,
    refetch: query.refetch,
  };
};






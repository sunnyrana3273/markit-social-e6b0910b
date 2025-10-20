import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface Collaborator {
  id: string;
  user_id: string;
  name: string;
  color: string;
  cursor_position: { x: number; y: number } | null;
  is_online: boolean;
  last_seen: string;
}

interface WhiteboardSession {
  id: string;
  name: string;
  course_id: string | null;
  host_user_id: string;
  is_active: boolean;
}

interface SceneData {
  elements: any[];
  appState: any;
  version: number;
}

export const useWhiteboardCollaboration = (sessionId: string) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [session, setSession] = useState<WhiteboardSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const colorRef = useRef<string>(`#${Math.floor(Math.random()*16777215).toString(16)}`);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sceneVersionRef = useRef<number>(0);

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('Please sign in to collaborate');
          return;
        }
        currentUserIdRef.current = user.id;

        // Get session
        const { data: sessionData, error: sessionError } = await supabase
          .from('whiteboard_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionError) {
          console.error('Error loading session:', sessionError);
          toast.error('Failed to load whiteboard session');
          return;
        }

        setSession(sessionData);

        // Get latest scene
        const { data: sceneData, error: sceneError } = await supabase
          .from('whiteboard_scenes')
          .select('*')
          .eq('session_id', sessionId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (sceneData && !sceneError) {
          const loadedScene = {
            elements: sceneData.elements as any[],
            appState: sceneData.app_state as any,
            version: sceneData.version,
          };
          setSceneData(loadedScene);
          sceneVersionRef.current = sceneData.version;
        }

        // Join as collaborator
        const { error: collaboratorError } = await supabase
          .from('whiteboard_collaborators')
          .upsert({
            session_id: sessionId,
            user_id: user.id,
            color: colorRef.current,
            is_online: true,
            last_seen: new Date().toISOString(),
          }, { onConflict: 'session_id,user_id' });

        if (collaboratorError) {
          console.error('Error joining as collaborator:', collaboratorError);
        }

        // Load collaborators
        loadCollaborators();
      } catch (error) {
        console.error('Error in loadSession:', error);
      }
    };

    loadSession();
  }, [sessionId]);

  // Load collaborators
  const loadCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('whiteboard_collaborators')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_online', true);

      if (error) {
        console.error('Error loading collaborators:', error);
        return;
      }

      // Get profile names (simplified - you may want to join with profiles table)
      const collaboratorsWithNames = data.map(c => ({
        ...c,
        name: `User ${c.user_id.substring(0, 8)}`, // Fallback, you can join with profiles table
      }));

      setCollaborators(collaboratorsWithNames as Collaborator[]);
    } catch (error) {
      console.error('Error in loadCollaborators:', error);
    }
  };

  // Setup real-time subscriptions
  useEffect(() => {
    if (!sessionId || !currentUserIdRef.current) return;

    const channel = supabase.channel(`whiteboard:${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: currentUserIdRef.current },
      },
    });

    // Listen for scene updates
    channel
      .on('broadcast', { event: 'scene-update' }, (payload) => {
        console.log('Received scene update:', payload);
        setSceneData(payload.payload as SceneData);
      })
      .on('broadcast', { event: 'cursor-move' }, (payload) => {
        const { user_id, cursor_position } = payload.payload as any;
        setCollaborators(prev => 
          prev.map(c => 
            c.user_id === user_id 
              ? { ...c, cursor_position }
              : c
          )
        );
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Presence sync:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
        loadCollaborators();
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        loadCollaborators();
      });

    // Subscribe to database changes
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whiteboard_collaborators',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadCollaborators();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          // Track presence
          channel.track({
            user_id: currentUserIdRef.current,
            color: colorRef.current,
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
          toast.error('Connection lost. Retrying...');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      // Mark user as offline
      if (currentUserIdRef.current) {
        supabase
          .from('whiteboard_collaborators')
          .update({ is_online: false })
          .eq('session_id', sessionId)
          .eq('user_id', currentUserIdRef.current)
          .then(() => console.log('Marked as offline'));
      }
    };
  }, [sessionId]);

  // Broadcast scene updates (throttled) - Use ref to make it stable
  const broadcastSceneUpdate = useCallback((elements: any[], appState: any) => {
    if (!channelRef.current || !isConnected) return;

    // Throttle updates to avoid overwhelming the network
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(async () => {
      try {
        const newVersion = sceneVersionRef.current + 1;
        sceneVersionRef.current = newVersion;
        
        const payload: SceneData = {
          elements,
          appState,
          version: newVersion,
        };

        // Broadcast to other clients
        await channelRef.current?.send({
          type: 'broadcast',
          event: 'scene-update',
          payload,
        });

        // Save to database (debounced)
        await supabase
          .from('whiteboard_scenes')
          .upsert({
            session_id: sessionId,
            elements: elements as any,
            app_state: appState as any,
            version: newVersion,
          }, {
            onConflict: 'session_id',
            ignoreDuplicates: false,
          });

        // Don't update local state here - it causes infinite loops
      } catch (error) {
        console.error('Error broadcasting scene update:', error);
      }
    }, 100); // 100ms throttle
  }, [sessionId, isConnected]); // Remove sceneData dependency

  // Broadcast cursor movement
  const broadcastCursorMove = useCallback((x: number, y: number) => {
    if (!channelRef.current || !isConnected || !currentUserIdRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: {
        user_id: currentUserIdRef.current,
        cursor_position: { x, y },
      },
    });
  }, [isConnected]);

  // Create a new session
  const createSession = async (name: string, courseId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to create a session');
        return null;
      }

      const { data, error } = await supabase
        .from('whiteboard_sessions')
        .insert({
          name,
          course_id: courseId,
          host_user_id: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        toast.error('Failed to create session');
        return null;
      }

      toast.success('Whiteboard session created!');
      return data;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  };

  return {
    collaborators,
    session,
    isConnected,
    sceneData,
    broadcastSceneUpdate,
    broadcastCursorMove,
    createSession,
    currentColor: colorRef.current,
  };
};


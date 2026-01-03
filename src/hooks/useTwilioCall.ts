import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { BACKEND_URL } from '@/lib/api';

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'disconnected' | 'error';

export interface UseTwilioCallReturn {
  callState: CallState;
  activeCall: Call | null;
  device: Device | null;
  isDeviceReady: boolean;
  error: string | null;
  incomingCallFrom: { id: string; name: string; avatar?: string | null } | null;
  initiateCall: (friendId: string, friendName: string) => Promise<void>;
  answerCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  muteCall: () => void;
  unmuteCall: () => void;
  isMuted: boolean;
}

export const useTwilioCall = (): UseTwilioCallReturn => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [incomingCallFrom, setIncomingCallFrom] = useState<{ id: string; name: string; avatar?: string | null } | null>(null);
  
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const callChannelRef = useRef<RealtimeChannel | null>(null);

  // Initialize device and get user ID
  useEffect(() => {
    const initializeDevice = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[useTwilioCall] No user found');
          setError('User not authenticated');
          return;
        }

        setCurrentUserId(user.id);

        // Set up Supabase Realtime channel for call notifications
        const channel = supabase.channel(`calls:${user.id}`, {
          config: {
            broadcast: { self: true },
          },
        });

        channel
          .on('broadcast', { event: 'call-initiated' }, (payload) => {
            // This is just a notification - the actual call comes through Twilio
            const { fromUserId, fromUserName } = payload.payload;
            setIncomingCallFrom({ id: fromUserId, name: fromUserName });
          })
          .on('broadcast', { event: 'call-answered' }, () => {
            // Call answered notification
          })
          .on('broadcast', { event: 'call-rejected' }, () => {
            // Only disconnect if this is an outgoing call (caller side)
            // Don't disconnect if we're the callee and have already accepted
            if (callRef.current && callState !== 'connected') {
              callRef.current.disconnect();
              setActiveCall(null);
              callRef.current = null;
              setCallState('disconnected');
              setTimeout(() => setCallState('idle'), 1000);
            }
          })
          .subscribe();

        callChannelRef.current = channel;

        // Get Twilio access token
        const response = await fetch(`${BACKEND_URL}/api/twilio/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useTwilioCall] Failed to get token:', response.status, errorText);
          setError(`Failed to get token: ${response.status} ${response.statusText}`);
          return;
        }

        const data = await response.json();

        if (!data.success || !data.token) {
          console.error('[useTwilioCall] Failed to get token:', data.error);
          setError(data.error || 'Failed to get access token');
          return;
        }

        // Validate token format (should be a JWT)
        if (!data.token.includes('.')) {
          console.error('[useTwilioCall] Invalid token format (not a JWT)');
          setError('Invalid token format received from server');
          return;
        }

        // Initialize Twilio Device
        const newDevice = new Device(data.token, {
          logLevel: 0, // 0 = silent (no logs)
        });

        // Set up device event listeners
        newDevice.on('registered', () => {
          setIsDeviceReady(true);
          setError(null);
        });

        newDevice.on('error', (error) => {
          console.error('[useTwilioCall] Device error:', error.message || error);
          let errorMessage = 'Device error occurred';
          
          // Handle specific device errors
          if (error.message) {
            if (error.message.includes('token') || error.message.includes('Token')) {
              errorMessage = 'Authentication error. Please refresh the page.';
            } else if (error.message.includes('network') || error.message.includes('Network')) {
              errorMessage = 'Network error. Please check your connection.';
            } else if (error.message.includes('permission') || error.message.includes('Permission')) {
              errorMessage = 'Microphone permission denied. Please enable microphone access.';
            } else {
              errorMessage = error.message;
            }
          }
          
          setError(errorMessage);
          setCallState('error');
          
          // Try to recover by re-initializing after a delay
          setTimeout(() => {
            if (deviceRef.current) {
              deviceRef.current.destroy();
            }
            // Will re-initialize on next render
          }, 5000);
        });

        newDevice.on('incoming', async (call: Call) => {
          setIncomingCall(call);
          incomingCallRef.current = call;
          setCallState('ringing');
          
          // Get caller info from call parameters
          const callerIdRaw = call.parameters?.From || call.parameters?.from;
          
          // Strip "client:" prefix if present (Twilio adds this prefix)
          const callerId = callerIdRaw?.replace(/^client:/, '') || callerIdRaw;
          
          // If we don't have caller info yet, fetch it from Supabase
          if (callerId && (!incomingCallFrom || incomingCallFrom.id !== callerId)) {
            try {
              // Fetch caller's profile from Supabase
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, image_url, email')
                .eq('id', callerId)
                .single();

              if (profileError) {
                console.error('[useTwilioCall] Error fetching caller profile:', profileError);
                // Fallback: use caller ID as name
                setIncomingCallFrom({ 
                  id: callerId, 
                  name: callerId.substring(0, 8) + '...',
                  avatar: null
                });
              } else if (profile) {
                // Build display name
                let displayName = 'Unknown';
                if (profile.first_name && profile.last_name) {
                  displayName = `${profile.first_name} ${profile.last_name}`;
                } else if (profile.first_name) {
                  displayName = profile.first_name;
                } else if (profile.email) {
                  displayName = profile.email.split('@')[0];
                }

                setIncomingCallFrom({ 
                  id: callerId, 
                  name: displayName,
                  avatar: profile.image_url
                });
              }
            } catch (err) {
              console.error('[useTwilioCall] Error fetching caller profile:', err);
              // Fallback: use caller ID as name
              setIncomingCallFrom({ 
                id: callerId, 
                name: callerId.substring(0, 8) + '...',
                avatar: null
              });
            }
          }
          
          // Set up call event listeners
          call.on('accept', () => {
            setActiveCall(call);
            callRef.current = call;
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallState('connected');
            // Keep incomingCallFrom populated for the active call display
          });

          call.on('cancel', () => {
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallState('idle');
          });

          call.on('disconnect', () => {
            setActiveCall(null);
            callRef.current = null;
            setIncomingCall(null);
            incomingCallRef.current = null;
            setIncomingCallFrom(null); // Clear caller info when call ends
            setCallState('disconnected');
            setTimeout(() => setCallState('idle'), 1000);
          });

          call.on('reject', () => {
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallState('idle');
          });
        });

        // Register device
        newDevice.register();
        
        deviceRef.current = newDevice;
        setDevice(newDevice);
        setError(null);

      } catch (err: any) {
        console.error('[useTwilioCall] Initialization error:', err.message || err);
        setError(err.message || 'Failed to initialize device');
        setCallState('error');
      }
    };

    initializeDevice();

    // Cleanup on unmount
    return () => {
      try {
        if (callRef.current) {
          callRef.current.disconnect();
          callRef.current = null;
        }
        if (incomingCallRef.current) {
          incomingCallRef.current.reject();
          incomingCallRef.current = null;
        }
        if (deviceRef.current) {
          deviceRef.current.destroy();
          deviceRef.current = null;
        }
        if (callChannelRef.current) {
          callChannelRef.current.unsubscribe();
          callChannelRef.current = null;
        }
      } catch (err) {
        console.error('[Twilio] Error during cleanup:', err);
      }
    };
  }, []);

  // Update token when it expires
  useEffect(() => {
    if (!device || !currentUserId) return;

    const handleTokenExpired = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/twilio/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: currentUserId }),
        });

        const data = await response.json();

        if (data.success && data.token) {
          device.updateToken(data.token);
        }
      } catch (err) {
        console.error('[Twilio] Failed to update token:', err);
        // If token update fails, try to reinitialize device
        if (deviceRef.current) {
          deviceRef.current.destroy();
        }
        setDevice(null);
        setIsDeviceReady(false);
        // Will re-initialize on next render
      }
    };

    device.on('tokenWillExpire', handleTokenExpired);

    return () => {
      device.off('tokenWillExpire', handleTokenExpired);
    };
  }, [device, currentUserId]);

  const initiateCall = useCallback(async (friendId: string, friendName: string) => {
    if (!device || !isDeviceReady) {
      setError('Device not ready. Please wait...');
      return;
    }

    if (callState !== 'idle' && callState !== 'disconnected') {
      setError('A call is already in progress');
      return;
    }

    if (!currentUserId) {
      setError('User not authenticated');
      return;
    }

    try {
      setCallState('connecting');
      setError(null);

      // Request microphone permission when initiating the call
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error('[useTwilioCall] Microphone permission denied:', err);
        setError('Microphone permission denied. Please enable microphone access.');
        setCallState('idle');
        return;
      }

      // Send notification to friend via Supabase Realtime
      // Get current user's name for the notification
      let currentUserName = friendName; // Fallback to friendName if we can't get user name
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', currentUserId)
          .single();
        
        if (profile) {
          if (profile.first_name && profile.last_name) {
            currentUserName = `${profile.first_name} ${profile.last_name}`;
          } else if (profile.first_name) {
            currentUserName = profile.first_name;
          } else {
            currentUserName = profile.email.split('@')[0];
          }
        }
      } catch (err) {
        console.warn('[Call] Failed to get current user name for notification:', err);
      }

      if (callChannelRef.current) {
        const friendChannel = supabase.channel(`calls:${friendId}`);
        friendChannel
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              friendChannel.send({
                type: 'broadcast',
                event: 'call-initiated',
                payload: {
                  fromUserId: currentUserId,
                  fromUserName: currentUserName,
                },
              });
              // Unsubscribe after sending
              setTimeout(() => {
                friendChannel.unsubscribe();
              }, 1000);
            }
          });
      }

      // Create call notification in database
      try {
        const { error: notifError } = await supabase.rpc('create_call_notification', {
          p_user_id: friendId,
          p_caller_id: currentUserId,
          p_caller_name: currentUserName,
        });
        if (notifError) {
          console.warn('[Call] Failed to create call notification:', notifError);
        }
      } catch (err) {
        console.warn('[Call] Error creating call notification:', err);
      }

      // Create call parameters - using friendId as the identity
      const params = {
        To: friendId, // The friend's user ID
      };

      const call = await device.connect({ params });
      
      callRef.current = call;
      setActiveCall(call);

      // Set up call event listeners
      call.on('accept', () => {
        setCallState('connected');
        setError(null); // Clear any previous errors
      });

      // Poll call status to catch when it becomes 'open' (connected)
      // This helps catch the connection even if 'accept' event doesn't fire for outgoing calls
      const statusCheckInterval = setInterval(() => {
        try {
          const status = call.status();
          
          if (status === 'open') {
            setCallState('connected');
            setError(null);
            clearInterval(statusCheckInterval);
          } else if (status === 'ringing' || status === 'pending') {
            setCallState((prevState) => {
              if (prevState !== 'ringing' && prevState !== 'connected') {
                return 'ringing';
              }
              return prevState;
            });
          } else if (status === 'closed') {
            clearInterval(statusCheckInterval);
          }
        } catch (err: any) {
          // Don't clear interval on error, might be temporary
        }
      }, 500);

      // Set a timeout for ringing calls (60 seconds) - if recipient doesn't join, end the call
      let ringingTimeout: NodeJS.Timeout | null = null;
      const initialCallStatus = call.status();
      if (initialCallStatus === 'ringing' || initialCallStatus === 'pending') {
        ringingTimeout = setTimeout(() => {
          const currentStatus = call.status();
          // Only timeout if still ringing/pending after 60 seconds
          if (currentStatus === 'ringing' || currentStatus === 'pending') {
            setError('No answer. The recipient may need to open a document editor to receive calls.');
            call.disconnect();
            setActiveCall(null);
            callRef.current = null;
            setCallState('disconnected');
            setTimeout(() => setCallState('idle'), 2000);
          }
        }, 60000); // 60 second timeout
      }

      // Clear interval and timeout when call ends
      const cleanupStatusCheck = () => {
        clearInterval(statusCheckInterval);
        if (ringingTimeout) {
          clearTimeout(ringingTimeout);
        }
      };
      
      call.on('disconnect', cleanupStatusCheck);
      call.on('cancel', cleanupStatusCheck);
      call.on('error', cleanupStatusCheck);
      call.on('accept', () => {
        // Clear timeout if call is accepted
        if (ringingTimeout) {
          clearTimeout(ringingTimeout);
        }
      });

      call.on('disconnect', () => {
        setActiveCall(null);
        callRef.current = null;
        setCallState('disconnected');
        setTimeout(() => setCallState('idle'), 1000);
      });

      call.on('cancel', () => {
        setActiveCall(null);
        callRef.current = null;
        setCallState('idle');
      });

      call.on('error', (error: any) => {
        // Safely extract error details
        const errorMessage = error?.message || String(error) || 'Call error occurred';
        const errorCode = error?.code;
        
        // Ignore code errors (like "is not a function") - these are bugs, not call failures
        if (errorMessage.includes('is not a function') || errorMessage.includes('direction')) {
          return; // Don't treat code errors as call failures
        }
        
        // Error 31000 usually means the recipient client isn't registered
        // Instead of immediately ending, keep ringing and wait for them to join
        if (errorMessage.includes('31000') || errorMessage.includes('General Error') || errorCode === 31000) {
          // Keep the call in ringing state - don't set error or disconnect
          // The call will stay ringing until they join or timeout
          setCallState('ringing');
          setError(null); // Clear any previous errors
          return; // Don't treat this as a fatal error
        }
        
        let userFriendlyMessage = 'Call error occurred';
        
        // Handle other specific error cases
        if (errorMessage) {
          if (errorMessage.includes('busy') || errorMessage.includes('Busy')) {
            userFriendlyMessage = 'Friend is busy. Please try again later.';
          } else if (errorMessage.includes('no-answer') || errorMessage.includes('No answer')) {
            userFriendlyMessage = 'Friend did not answer. Please try again later.';
          } else if (errorMessage.includes('canceled') || errorMessage.includes('Canceled')) {
            userFriendlyMessage = 'Call was canceled.';
          } else if (errorMessage.includes('rejected') || errorMessage.includes('Rejected')) {
            userFriendlyMessage = 'Call was rejected.';
          } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
            userFriendlyMessage = 'Network error. Please check your connection.';
          } else {
            userFriendlyMessage = errorMessage;
          }
        }
        
        setError(userFriendlyMessage);
        setCallState('error');
        setActiveCall(null);
        callRef.current = null;
        
        // Reset to idle after showing error
        setTimeout(() => {
          setCallState('idle');
          setError(null);
        }, 3000);
      });

      // Wait a moment to see if call connects
      setTimeout(() => {
        const status = call.status();
        if (status === 'open') {
          setCallState('connected');
        } else if (status === 'ringing') {
          setCallState('ringing');
        }
      }, 500);

    } catch (err: any) {
      console.error('[useTwilioCall] Failed to initiate call:', err);
      let errorMessage = 'Failed to initiate call';
      
      if (err.message) {
        if (err.message.includes('network') || err.message.includes('Network') || err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.message.includes('permission') || err.message.includes('Permission')) {
          errorMessage = 'Microphone permission denied. Please enable microphone access.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setCallState('error');
      setTimeout(() => {
        setCallState('idle');
        setError(null);
      }, 3000);
    }
  }, [device, isDeviceReady, callState, currentUserId]);

  const answerCall = useCallback(async () => {
    if (incomingCallRef.current) {
      const call = incomingCallRef.current;
      
      // Request microphone permission when answering the call
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error('[useTwilioCall] Microphone permission denied:', err);
        setError('Microphone permission denied. Please enable microphone access.');
        // Reject the call if permission is denied
        call.reject();
        setIncomingCall(null);
        incomingCallRef.current = null;
        setCallState('idle');
        setIncomingCallFrom(null);
        return;
      }
      
      // Accept the call
      call.accept();
      
      // Update refs and state immediately
      setActiveCall(call);
      callRef.current = call;
      setIncomingCall(null);
      // Don't clear incomingCallRef yet - let the accept event handler do it
      
      // Set state to connected - the accept event will also fire but this ensures UI updates
      setCallState('connected');
      
      // Notify caller that call was answered
      if (incomingCallFrom && callChannelRef.current) {
        const callerChannel = supabase.channel(`calls:${incomingCallFrom.id}`);
        callerChannel
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              callerChannel.send({
                type: 'broadcast',
                event: 'call-answered',
                payload: { toUserId: currentUserId },
              });
              setTimeout(() => {
                callerChannel.unsubscribe();
              }, 1000);
            }
          });
      }
      // DON'T clear incomingCallFrom here - we need it for the active call display
      // It will be cleared when the call ends/disconnects
    }
  }, [incomingCallFrom, currentUserId, callState]);

  const rejectCall = useCallback(() => {
    if (incomingCallRef.current) {
      incomingCallRef.current.reject();
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallState('idle');
      
      // Notify caller that call was rejected
      if (incomingCallFrom && callChannelRef.current) {
        const callerChannel = supabase.channel(`calls:${incomingCallFrom.id}`);
        callerChannel
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              callerChannel.send({
                type: 'broadcast',
                event: 'call-rejected',
                payload: { toUserId: currentUserId },
              });
              setTimeout(() => {
                callerChannel.unsubscribe();
              }, 1000);
            }
          });
      }
      setIncomingCallFrom(null);
    }
  }, [incomingCallFrom, currentUserId]);

  const endCall = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      setActiveCall(null);
      callRef.current = null;
      setIncomingCallFrom(null); // Clear caller info when call ends
      setCallState('disconnected');
      setTimeout(() => setCallState('idle'), 1000);
    }
  }, []);

  const muteCall = useCallback(() => {
    if (callRef.current) {
      callRef.current.mute(true);
      setIsMuted(true);
    }
  }, []);

  const unmuteCall = useCallback(() => {
    if (callRef.current) {
      callRef.current.mute(false);
      setIsMuted(false);
    }
  }, []);

  return {
    callState,
    activeCall,
    device,
    isDeviceReady,
    error,
    incomingCallFrom,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    muteCall,
    unmuteCall,
    isMuted,
  };
};


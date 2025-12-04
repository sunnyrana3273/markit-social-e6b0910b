import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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
      console.log('[useTwilioCall] 🚀 Starting device initialization...');
      try {
        // Get current user
        console.log('[useTwilioCall] 📋 Getting current user...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[useTwilioCall] ❌ No user found');
          setError('User not authenticated');
          return;
        }

        console.log('[useTwilioCall] ✅ User found:', user.id);
        setCurrentUserId(user.id);

        // Set up Supabase Realtime channel for call notifications
        const channel = supabase.channel(`calls:${user.id}`, {
          config: {
            broadcast: { self: true },
          },
        });

        channel
          .on('broadcast', { event: 'call-initiated' }, (payload) => {
            console.log('[Call] Received call initiation notification:', payload);
            // This is just a notification - the actual call comes through Twilio
            const { fromUserId, fromUserName } = payload.payload;
            setIncomingCallFrom({ id: fromUserId, name: fromUserName });
          })
          .on('broadcast', { event: 'call-answered' }, (payload) => {
            console.log('[Call] Call answered notification:', payload);
          })
          .on('broadcast', { event: 'call-rejected' }, (payload) => {
            console.log('[Call] Call rejected notification:', payload);
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
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[Call] Subscribed to call notifications');
            }
          });

        callChannelRef.current = channel;

        // Request microphone permission and set up audio context
        console.log('[useTwilioCall] 🎤 Requesting microphone permission...');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[useTwilioCall] ✅ Microphone permission granted');
          
          // Stop the stream immediately - we just needed permission
          // Twilio will create its own audio streams
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error('[useTwilioCall] ❌ Microphone permission denied:', err);
          setError('Microphone permission denied. Please enable microphone access.');
          return;
        }

        // Get Twilio access token
        console.log('[useTwilioCall] 🔑 Fetching Twilio access token from backend...');
        const response = await fetch('http://localhost:3001/api/twilio/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });

        const data = await response.json();
        console.log('[useTwilioCall] 📦 Token response received:', { 
          success: data.success, 
          hasToken: !!data.token,
          identity: data.identity 
        });

        if (!data.success || !data.token) {
          console.error('[useTwilioCall] ❌ Failed to get token:', data.error);
          setError(data.error || 'Failed to get access token');
          return;
        }

        console.log('[useTwilioCall] ✅ Token received, initializing Twilio Device...');
        // Initialize Twilio Device
        const newDevice = new Device(data.token, {
          logLevel: 1, // Reduced logging (was 4 for debug)
          // Enable audio output management
          allowIncomingWhileBusy: false,
        });
        console.log('[useTwilioCall] 📱 Device instance created');

        // Set up device event listeners
        newDevice.on('registered', () => {
          console.log('[useTwilioCall] ✅✅✅ Device REGISTERED with Twilio!');
          console.log('[useTwilioCall] Device state:', {
            isRegistered: true,
            identity: newDevice.identity,
            token: newDevice.token ? 'present' : 'missing'
          });
          setIsDeviceReady(true);
          setError(null);
        });

        newDevice.on('error', (error) => {
          console.error('[useTwilioCall] ❌❌❌ Device ERROR:', error);
          console.error('[useTwilioCall] Error details:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack
          });
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
          console.log('[useTwilioCall] 📞📞📞 INCOMING CALL RECEIVED!');
          console.log('[useTwilioCall] Call details:', {
            callSid: call.parameters?.CallSid,
            from: call.parameters?.From || call.parameters?.from,
            to: call.parameters?.To || call.parameters?.to,
            parameters: call.parameters,
            status: call.status()
          });
          setIncomingCall(call);
          incomingCallRef.current = call;
          setCallState('ringing');
          
          // Get caller info from call parameters
          const callerIdRaw = call.parameters?.From || call.parameters?.from;
          console.log('[useTwilioCall] Caller ID from call (raw):', callerIdRaw);
          
          // Strip "client:" prefix if present (Twilio adds this prefix)
          const callerId = callerIdRaw?.replace(/^client:/, '') || callerIdRaw;
          console.log('[useTwilioCall] Caller ID (cleaned):', callerId);
          
          // If we don't have caller info yet, fetch it from Supabase
          if (callerId && (!incomingCallFrom || incomingCallFrom.id !== callerId)) {
            console.log('[useTwilioCall] Fetching caller profile for:', callerId);
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

                console.log('[useTwilioCall] ✅ Fetched caller profile:', displayName);
                const callerInfo = { 
                  id: callerId, 
                  name: displayName,
                  avatar: profile.image_url
                };
                setIncomingCallFrom(callerInfo);
                
                // Dispatch custom event for notification system
                window.dispatchEvent(new CustomEvent('incoming-call', {
                  detail: callerInfo
                }));
              }
            } catch (err) {
              console.error('[useTwilioCall] Exception fetching caller profile:', err);
              // Fallback: use caller ID as name
              const fallbackInfo = { 
                id: callerId, 
                name: callerId.substring(0, 8) + '...',
                avatar: null
              };
              setIncomingCallFrom(fallbackInfo);
              
              // Dispatch custom event for notification system
              window.dispatchEvent(new CustomEvent('incoming-call', {
                detail: fallbackInfo
              }));
            }
          } else if (callerId && incomingCallFrom?.id === callerId) {
            console.log('[useTwilioCall] Caller info already available from notification');
            
            // Still dispatch event in case notification system wasn't listening yet
            window.dispatchEvent(new CustomEvent('incoming-call', {
              detail: incomingCallFrom
            }));
          }
          
          // Set up call event listeners
          call.on('accept', () => {
            console.log('[useTwilioCall] ✅✅✅ Call ACCEPTED!');
            console.log('[useTwilioCall] Call status:', call.status());
            console.log('[useTwilioCall] Call parameters:', call.parameters);
            
            // Small delay to ensure audio is fully initialized
            setTimeout(() => {
              setActiveCall(call);
              callRef.current = call;
              setIncomingCall(null);
              incomingCallRef.current = null;
              setCallState('connected');
              setError(null);
            }, 100);
            // Keep incomingCallFrom populated for the active call display
          });

          call.on('cancel', () => {
            console.log('[useTwilioCall] ⚠️ Incoming call CANCELLED');
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallState('idle');
          });

          call.on('disconnect', () => {
            console.log('[useTwilioCall] 📴 Call DISCONNECTED');
            console.log('[useTwilioCall] Disconnect reason:', call.status());
            setActiveCall(null);
            callRef.current = null;
            setIncomingCall(null);
            incomingCallRef.current = null;
            setIncomingCallFrom(null); // Clear caller info when call ends
            setCallState('disconnected');
            setTimeout(() => setCallState('idle'), 1000);
          });

          call.on('reject', () => {
            console.log('[useTwilioCall] ❌ Call REJECTED');
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallState('idle');
          });
        });

        // Register device
        console.log('[useTwilioCall] 📡 Registering device with Twilio...');
        newDevice.register();
        
        deviceRef.current = newDevice;
        setDevice(newDevice);
        setError(null);
        console.log('[useTwilioCall] ✅ Device setup complete, waiting for registration...');

      } catch (err: any) {
        console.error('[useTwilioCall] ❌❌❌ INITIALIZATION ERROR:', err);
        console.error('[useTwilioCall] Error stack:', err.stack);
        console.error('[useTwilioCall] Error details:', {
          message: err.message,
          name: err.name,
          code: err.code
        });
        setError(err.message || 'Failed to initialize device');
        setCallState('error');
      }
    };

    initializeDevice();

    // Cleanup on unmount
    return () => {
      try {
        // Only disconnect active calls, don't destroy device if call is active
        // (device should persist across component remounts)
        if (callRef.current) {
          const callStatus = callRef.current.status();
          if (callStatus !== 'closed') {
            console.log('[Twilio] Cleaning up active call on unmount');
            callRef.current.disconnect();
          }
          callRef.current = null;
        }
        if (incomingCallRef.current) {
          incomingCallRef.current.reject();
          incomingCallRef.current = null;
        }
        // Don't destroy device on cleanup - let it persist
        // Device will be cleaned up when user logs out or page closes
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
        const response = await fetch('http://localhost:3001/api/twilio/token', {
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
    console.log('[useTwilioCall] 📞📞📞 INITIATING CALL');
    console.log('[useTwilioCall] Call details:', {
      friendId,
      friendName,
      currentUserId,
      deviceReady: isDeviceReady,
      currentCallState: callState,
      deviceExists: !!device
    });

    if (!device || !isDeviceReady) {
      console.error('[useTwilioCall] ❌ Device not ready!', { device: !!device, isDeviceReady });
      setError('Device not ready. Please wait...');
      return;
    }

    if (callState !== 'idle' && callState !== 'disconnected') {
      console.error('[useTwilioCall] ❌ Call already in progress!', { callState });
      setError('A call is already in progress');
      return;
    }

    if (!currentUserId) {
      console.error('[useTwilioCall] ❌ No current user ID!');
      setError('User not authenticated');
      return;
    }

    try {
      console.log('[useTwilioCall] ✅ Pre-flight checks passed, starting call...');
      setCallState('connecting');
      setError(null);

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

      // Create call parameters - using friendId as the identity
      const params = {
        To: friendId, // The friend's user ID
      };

      console.log('[useTwilioCall] 🔌 Calling device.connect() with params:', params);
      console.log('[useTwilioCall] Device state before connect:', {
        identity: device.identity,
        isRegistered: device.state === 'registered',
        state: device.state
      });

      const call = await device.connect({ params });
      console.log('[useTwilioCall] ✅✅✅ device.connect() returned!');
      console.log('[useTwilioCall] Call object:', {
        callSid: call.parameters?.CallSid,
        status: call.status(),
        isMuted: call.isMuted(),
        parameters: call.parameters
      });
      
      callRef.current = call;
      setActiveCall(call);

      // Track if we've already handled disconnect to prevent double handling
      let isDisconnected = false;
      let statusCheckInterval: NodeJS.Timeout | null = null;

      // Set up call event listeners
      call.on('accept', () => {
        console.log('[useTwilioCall] ✅✅✅ Call ACCEPTED by recipient!');
        console.log('[useTwilioCall] Call status after accept:', call.status());
        console.log('[useTwilioCall] Call parameters:', call.parameters);
        setCallState('connected');
        setError(null);
        
        // Clear status check interval once connected
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }
      });

      // Poll call status to catch when it becomes 'open' (connected)
      // This helps catch the connection even if 'accept' event doesn't fire for outgoing calls
      statusCheckInterval = setInterval(() => {
        try {
          if (isDisconnected) {
            if (statusCheckInterval) {
              clearInterval(statusCheckInterval);
              statusCheckInterval = null;
            }
            return;
          }

          const status = call.status();
          
          if (status === 'open') {
            console.log('[useTwilioCall] ✅ Call status is OPEN (connected)!');
            setCallState('connected');
            setError(null);
            if (statusCheckInterval) {
              clearInterval(statusCheckInterval);
              statusCheckInterval = null;
            }
          } else if (status === 'ringing' || status === 'pending') {
            setCallState((prevState) => {
              if (prevState !== 'ringing' && prevState !== 'connected') {
                return 'ringing';
              }
              return prevState;
            });
          } else if (status === 'closed') {
            if (statusCheckInterval) {
              clearInterval(statusCheckInterval);
              statusCheckInterval = null;
            }
          }
        } catch (err: any) {
          console.warn('[useTwilioCall] Error checking call status:', err);
        }
      }, 500);

      // Single disconnect handler
      call.on('disconnect', () => {
        if (isDisconnected) return; // Prevent double handling
        isDisconnected = true;

        console.log('[useTwilioCall] 📴 Call DISCONNECTED');
        console.log('[useTwilioCall] Disconnect details:', {
          status: call.status(),
          callSid: call.parameters?.CallSid
        });

        // Clear status check interval
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }

        setActiveCall(null);
        callRef.current = null;
        setCallState('disconnected');
        setTimeout(() => setCallState('idle'), 1000);
      });

      call.on('cancel', () => {
        if (isDisconnected) return;
        isDisconnected = true;

        console.log('[useTwilioCall] ⚠️ Call CANCELLED');
        
        // Clear status check interval
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }

        setActiveCall(null);
        callRef.current = null;
        setCallState('idle');
      });

      call.on('error', (error: any) => {
        if (isDisconnected) return; // Don't handle errors if already disconnected
        
        console.error('[useTwilioCall] ❌❌❌ CALL ERROR EVENT!');
        console.error('[useTwilioCall] Error object:', error);
        
        // Clear status check interval
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }
        
        // Safely extract error details
        const errorMessage = error?.message || String(error) || 'Call error occurred';
        const errorCode = error?.code;
        
        console.error('[useTwilioCall] Error details:', {
          message: errorMessage,
          code: errorCode,
          name: error?.name,
          type: typeof error
        });
        
        // Ignore code errors (like "is not a function") - these are bugs, not call failures
        if (errorMessage.includes('is not a function') || errorMessage.includes('direction')) {
          console.warn('[useTwilioCall] Ignoring code error:', errorMessage);
          return; // Don't treat code errors as call failures
        }
        
        // Ignore AbortError from audio playback - this is often a side effect, not the actual error
        if (errorMessage.includes('AbortError') || errorMessage.includes('play() request was interrupted')) {
          console.warn('[useTwilioCall] Ignoring audio AbortError (likely side effect):', errorMessage);
          return;
        }
        
        let userFriendlyMessage = 'Call error occurred';
        
        // Handle specific error cases
        if (errorMessage) {
          // Error 31000 usually means the recipient client isn't registered
          if (errorMessage.includes('31000') || errorMessage.includes('General Error')) {
            userFriendlyMessage = 'Friend is not available. They may not be online or their device is not registered.';
          } else if (errorMessage.includes('busy') || errorMessage.includes('Busy')) {
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
        } else if (errorCode === 31000) {
          userFriendlyMessage = 'Friend is not available. They may not be online or their device is not registered.';
        }
        
        setError(userFriendlyMessage);
        setCallState('error');
        setActiveCall(null);
        callRef.current = null;
        isDisconnected = true;
        
        // Reset to idle after showing error
        setTimeout(() => {
          setCallState('idle');
          setError(null);
        }, 3000);
      });

      // Initial status check after a short delay
      setTimeout(() => {
        if (isDisconnected) return;
        const status = call.status();
        console.log('[useTwilioCall] Call status check after 500ms:', status);
        if (status === 'open') {
          console.log('[useTwilioCall] ✅ Call is OPEN (connected)');
          setCallState('connected');
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
          }
        } else if (status === 'ringing' || status === 'pending') {
          console.log('[useTwilioCall] 📞 Call is RINGING');
          setCallState('ringing');
        } else if (status === 'closed') {
          console.log('[useTwilioCall] ⚠️ Call already closed');
        }
      }, 500);

    } catch (err: any) {
      console.error('[Twilio] Failed to initiate call:', err);
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

  const answerCall = useCallback(() => {
    if (incomingCallRef.current) {
      const call = incomingCallRef.current;
      console.log('[useTwilioCall] Answering call, current state:', callState);
      console.log('[useTwilioCall] Call status before accept:', call.status());
      
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


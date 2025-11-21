import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Phone, PhoneOff, Mic, MicOff, ArrowLeft, Users, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTwilioCall, CallState } from '@/hooks/useTwilioCall';
import { CallInterface } from '@/components/CallInterface';

interface Friend {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

const TestZone: React.FC = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeCallFriend, setActiveCallFriend] = useState<Friend | null>(null);
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'error' | 'success' | 'warning' }>>([]);

  // Initialize Twilio call hook with extensive logging
  const {
    callState,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    muteCall,
    unmuteCall,
    isMuted,
    isDeviceReady,
    error: callError,
    incomingCallFrom,
    device,
    activeCall,
  } = useTwilioCall();

  // Debug logging function
  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { time: timestamp, message, type };
    console.log(`[TEST ZONE ${type.toUpperCase()}] ${timestamp}: ${message}`);
    setDebugLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50 logs
  };

  useEffect(() => {
    document.title = "MarkIt | Voice Call Test Zone";
    addLog('Test Zone page loaded', 'info');
  }, []);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          addLog('No user found, redirecting to auth', 'error');
          navigate('/auth');
          return;
        }
        setCurrentUserId(user.id);
        addLog(`Current user loaded: ${user.id}`, 'success');
      } catch (error: any) {
        addLog(`Error loading user: ${error.message}`, 'error');
      }
    };
    loadUser();
  }, [navigate]);

  // Monitor Twilio device state
  useEffect(() => {
    if (device) {
      addLog('Twilio Device instance created', 'success');
      
      device.on('registered', () => {
        addLog('✅ Device REGISTERED with Twilio', 'success');
      });

      device.on('error', (error: any) => {
        addLog(`❌ Device ERROR: ${error.message || JSON.stringify(error)}`, 'error');
      });

      device.on('incoming', (call: any) => {
        addLog(`📞 INCOMING CALL from: ${call.parameters?.From || 'unknown'}`, 'success');
      });

      return () => {
        addLog('Device cleanup', 'info');
      };
    }
  }, [device]);

  // Monitor call state changes
  useEffect(() => {
    addLog(`Call state changed to: ${callState}`, 'info');
    
    if (callState === 'connected') {
      addLog('✅ CALL CONNECTED!', 'success');
    } else if (callState === 'error') {
      addLog(`❌ Call error state: ${callError || 'Unknown error'}`, 'error');
    } else if (callState === 'disconnected') {
      addLog('Call disconnected', 'warning');
    }
  }, [callState, callError]);

  // Monitor device ready state
  useEffect(() => {
    if (isDeviceReady) {
      addLog('✅ Device is READY for calls', 'success');
    } else {
      addLog('⏳ Device is initializing...', 'info');
    }
  }, [isDeviceReady]);

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUserId) return;

      try {
        addLog('Loading friends list...', 'info');
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          addLog('No session found', 'error');
          return;
        }

        // Fetch friends
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', session.user.id)
          .eq('status', 'accepted')
          .limit(10);

        if (friendsError) {
          addLog(`Error fetching friends: ${friendsError.message}`, 'error');
          return;
        }

        if (!friendsData || friendsData.length === 0) {
          addLog('No friends found', 'warning');
          return;
        }

        const friendIds = friendsData.map((friend) => friend.friend_id);

        // Fetch friend profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, image_url, email')
          .in('id', friendIds);

        if (profilesError) {
          addLog(`Error fetching profiles: ${profilesError.message}`, 'error');
          return;
        }

        setFriends(profilesData || []);
        addLog(`✅ Loaded ${profilesData?.length || 0} friends`, 'success');
      } catch (error: any) {
        addLog(`Error loading friends: ${error.message}`, 'error');
      }
    };

    loadFriends();
  }, [currentUserId]);

  const getInitials = (friend: Friend) => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name[0]}${friend.last_name[0]}`.toUpperCase();
    }
    if (friend.first_name) {
      return friend.first_name[0].toUpperCase();
    }
    return friend.email[0].toUpperCase();
  };

  const getDisplayName = (friend: Friend) => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name} ${friend.last_name}`;
    }
    if (friend.first_name) {
      return friend.first_name;
    }
    return friend.email.split('@')[0];
  };

  const handleCallClick = async (friend: Friend) => {
    addLog(`📞 Initiating call to ${getDisplayName(friend)} (${friend.id})`, 'info');
    
    if (!isDeviceReady) {
      addLog('❌ Device not ready!', 'error');
      alert('Device is not ready. Please wait...');
      return;
    }

    if (callState !== 'idle' && callState !== 'disconnected') {
      addLog(`❌ Call already in progress (state: ${callState})`, 'error');
      alert('A call is already in progress');
      return;
    }

    if (callError) {
      addLog(`❌ Call error exists: ${callError}`, 'error');
      alert(`Call error: ${callError}. Please try again.`);
      return;
    }

    try {
      setActiveCallFriend(friend);
      addLog(`Calling device.connect() with To: ${friend.id}`, 'info');
      await initiateCall(friend.id, getDisplayName(friend));
      addLog('Call initiation completed', 'success');
    } catch (error: any) {
      addLog(`❌ Failed to initiate call: ${error.message}`, 'error');
      console.error('Call initiation error:', error);
      alert(`Failed to start call: ${error.message || 'Unknown error'}`);
      setActiveCallFriend(null);
    }
  };

  const getCallStatusColor = (state: CallState) => {
    switch (state) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
      case 'ringing':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'disconnected':
        return 'text-gray-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/app')}
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Voice Call Test Zone</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isDeviceReady ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isDeviceReady ? '✅ Device Ready' : '⏳ Initializing...'}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getCallStatusColor(callState)}`}>
              Status: {callState}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Friends List */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Friends ({friends.length})
            </h2>
            <div className="space-y-3">
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.image_url || undefined} alt={getDisplayName(friend)} />
                      <AvatarFallback className="bg-blue-500 text-white">
                        {getInitials(friend)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getDisplayName(friend)}</p>
                      <p className="text-xs text-gray-500 truncate">{friend.email}</p>
                    </div>
                    <Button
                      onClick={() => handleCallClick(friend)}
                      disabled={!isDeviceReady || (callState !== 'idle' && callState !== 'disconnected')}
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No friends found</p>
              )}
            </div>
          </Card>

          {/* Debug Logs */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Debug Logs</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDebugLogs([])}
              >
                Clear Logs
              </Button>
            </div>
            <div className="bg-black text-green-400 font-mono text-xs p-4 rounded-lg h-[600px] overflow-y-auto">
              {debugLogs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Actions will appear here...</div>
              ) : (
                debugLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500">[{log.time}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h2 className="text-xl font-semibold mb-4">📋 Testing Instructions</h2>
          <div className="space-y-2 text-sm">
            <p><strong>1.</strong> Both users must be on this Test Zone page</p>
            <p><strong>2.</strong> Wait for "Device Ready" status (green badge) for both users</p>
            <p><strong>3.</strong> User A clicks phone icon next to User B</p>
            <p><strong>4.</strong> Check debug logs below for detailed call flow</p>
            <p><strong>5.</strong> Check backend terminal/logs for TwiML endpoint requests</p>
            <p className="text-red-600 dark:text-red-400 font-semibold mt-2">
              ⚠️ If you see error 31000, the friend's device is not registered (they're not on this page)
            </p>
          </div>
        </Card>

        {/* Device Info */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Device Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Device Ready</p>
              <p className={`font-semibold ${isDeviceReady ? 'text-green-600' : 'text-red-600'}`}>
                {isDeviceReady ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Call State</p>
              <p className="font-semibold">{callState}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Call</p>
              <p className="font-semibold">{activeCall ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Muted</p>
              <p className="font-semibold">{isMuted ? 'Yes' : 'No'}</p>
            </div>
            {callError && (
              <div className="col-span-full">
                <p className="text-sm text-red-500">Error: {callError}</p>
              </div>
            )}
            {incomingCallFrom && (
              <div className="col-span-full">
                <p className="text-sm text-blue-500">
                  Incoming call from: {incomingCallFrom.name} ({incomingCallFrom.id})
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Call Interface */}
        {(callState !== 'idle' || activeCallFriend || incomingCallFrom) && (
          <CallInterface
            friendId={activeCallFriend?.id}
            friendName={activeCallFriend ? getDisplayName(activeCallFriend) : undefined}
            friendAvatar={activeCallFriend?.image_url}
            callState={callState}
            incomingCallFrom={incomingCallFrom}
            onAnswer={() => {
              addLog('Answering call...', 'info');
              answerCall();
            }}
            onReject={() => {
              addLog('Rejecting call...', 'warning');
              rejectCall();
            }}
            onEnd={() => {
              addLog('Ending call...', 'info');
              endCall();
            }}
            onMute={() => {
              addLog('Muting call...', 'info');
              muteCall();
            }}
            onUnmute={() => {
              addLog('Unmuting call...', 'info');
              unmuteCall();
            }}
            isMuted={isMuted}
            error={callError}
            onCallEnd={() => {
              addLog('Call ended callback', 'info');
              setActiveCallFriend(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TestZone;


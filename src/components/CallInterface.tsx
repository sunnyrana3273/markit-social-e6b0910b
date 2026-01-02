import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react';
import { CallState, useTwilioCall } from '@/hooks/useTwilioCall';

interface CallInterfaceProps {
  friendId?: string;
  friendName?: string;
  friendAvatar?: string | null;
  callState: CallState;
  incomingCallFrom?: { id: string; name: string; avatar?: string | null } | null;
  onAnswer: () => void;
  onReject: () => void;
  onEnd: () => void;
  onMute: () => void;
  onUnmute: () => void;
  isMuted: boolean;
  error?: string | null;
  onCallEnd?: () => void;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({
  friendId,
  friendName,
  friendAvatar,
  callState,
  incomingCallFrom,
  onAnswer,
  onReject,
  onEnd,
  onMute,
  onUnmute,
  isMuted,
  error,
  onCallEnd,
}) => {
  // Determine which friend info to use (incoming call or active call)
  const displayFriendId = incomingCallFrom?.id || friendId || '';
  const displayFriendName = incomingCallFrom?.name || friendName || 'Unknown';
  const displayFriendAvatar = incomingCallFrom?.avatar !== undefined 
    ? incomingCallFrom.avatar 
    : friendAvatar;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name[0]?.toUpperCase() || 'U';
  };

  const getCallStatusText = (state: CallState): string => {
    switch (state) {
      case 'connecting':
        return 'Connecting...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Call ended';
      case 'error':
        return 'Call error';
      default:
        return '';
    }
  };

  // Don't render if idle and no error
  if (callState === 'idle' && !error) {
    return null;
  }

  // Incoming call notification (ringing with incomingCallFrom means someone is calling us)
  if (callState === 'ringing' && incomingCallFrom) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-card rounded-lg shadow-md p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-border">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={displayFriendAvatar || undefined} alt={displayFriendName} />
              <AvatarFallback className="bg-home-primary text-white text-2xl">
                {getInitials(displayFriendName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-home-foreground">
                Incoming Call
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                {displayFriendName}
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 text-center">
                {error}
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button
                onClick={() => {
                  onReject();
                  onCallEnd?.();
                }}
                variant="destructive"
                className="flex-1 h-12"
              >
                <X className="w-5 h-5 mr-2" />
                Decline
              </Button>
              <Button
                onClick={() => {
                  onAnswer();
                }}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white"
              >
                <Phone className="w-5 h-5 mr-2" />
                Answer
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active call interface (connecting, ringing, or connected)
  // This handles outgoing calls (ringing without incomingCallFrom) and connected calls
  const isConnecting = callState === 'connecting';
  const isRinging = callState === 'ringing';
  const isConnected = callState === 'connected';
  
  if (isConnecting || isRinging || isConnected) {
    // For ringing state when calling (outgoing), show special message
    const isRingingOutgoing = isRinging && !incomingCallFrom;
    const ringingMessage = isRingingOutgoing 
      ? 'Ringing... Waiting for them to join'
      : getCallStatusText(callState);

    return (
      <div className="fixed bottom-6 right-6 z-[200] bg-white dark:bg-card rounded-lg shadow-md p-4 border border-gray-200 dark:border-border min-w-[280px]">
        <div className="flex flex-col items-center space-y-3">
          <Avatar className="w-16 h-16">
            <AvatarImage src={displayFriendAvatar || undefined} alt={displayFriendName} />
            <AvatarFallback className="bg-home-primary text-white text-lg">
              {getInitials(displayFriendName)}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-home-foreground">
              {displayFriendName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {ringingMessage}
            </p>
            {isRingingOutgoing && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                They may need to open a document editor
              </p>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 text-center">
              {error}
            </div>
          )}

          <div className="flex gap-2 w-full">
            {callState === 'connected' && (
              <Button
                onClick={isMuted ? onUnmute : onMute}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {isMuted ? (
                  <>
                    <MicOff className="w-4 h-4 mr-1" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-1" />
                    Mute
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => {
                onEnd();
                onCallEnd?.();
              }}
              variant="destructive"
              size="sm"
              className={callState === 'connected' ? 'flex-1' : 'w-full'}
            >
              <PhoneOff className="w-4 h-4 mr-1" />
              End
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Call ended or error state
  if (callState === 'disconnected' || callState === 'error') {
    return (
      <div className="fixed bottom-6 right-6 z-[200] bg-white dark:bg-card rounded-lg shadow-lg p-4 border border-gray-200 dark:border-border min-w-[200px]">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-home-foreground">
            {getCallStatusText(callState)}
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
};

interface CallButtonProps {
  friendId: string;
  friendName: string;
  friendAvatar?: string | null;
  disabled?: boolean;
}

export const CallButton: React.FC<CallButtonProps> = ({
  friendId,
  friendName,
  friendAvatar,
  disabled = false,
}) => {
  const { initiateCall, callState, isDeviceReady, error } = useTwilioCall();

  const handleCallClick = async () => {
    if (!isDeviceReady) {
      alert('Device is not ready. Please wait a moment...');
      return;
    }

    if (callState !== 'idle' && callState !== 'disconnected') {
      alert('A call is already in progress');
      return;
    }

    await initiateCall(friendId, friendName);
  };

  return (
    <Button
      onClick={handleCallClick}
      disabled={disabled || !isDeviceReady || (callState !== 'idle' && callState !== 'disconnected')}
      variant="ghost"
      size="sm"
      className="text-gray-400 dark:text-gray-500 hover:text-home-primary hover:bg-home-primary/10 dark:hover:bg-home-primary/20 p-1.5 rounded-md transition-all cursor-pointer hover:scale-110"
      title={error || (isDeviceReady ? 'Call friend' : 'Initializing...')}
    >
      <Phone className="w-7 h-7" />
    </Button>
  );
};


import { createContext, useContext, useState, ReactNode } from 'react';
import { useTwilioCall } from '@/hooks/useTwilioCall';
import { CallInterface } from '@/components/CallInterface';
import { supabase } from '@/integrations/supabase/client';

interface ActiveCallFriend {
  id: string;
  name: string;
  avatar?: string | null;
}

interface CallContextType {
  initiateCall: (friendId: string, friendName: string, friendAvatar?: string | null) => Promise<void>;
  callState: ReturnType<typeof useTwilioCall>['callState'];
  isDeviceReady: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    callState,
    initiateCall: twilioInitiateCall,
    answerCall,
    rejectCall,
    endCall,
    muteCall,
    unmuteCall,
    isMuted,
    isDeviceReady,
    error: callError,
    incomingCallFrom,
  } = useTwilioCall();

  const [activeCallFriend, setActiveCallFriend] = useState<ActiveCallFriend | null>(null);

  const initiateCall = async (friendId: string, friendName: string, friendAvatar?: string | null) => {
    if (!isDeviceReady) {
      alert('Device is not ready. Please wait a moment...');
      return;
    }

    if (callState !== 'idle' && callState !== 'disconnected') {
      alert('A call is already in progress');
      return;
    }

    try {
      // Check current user's plan
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('User not authenticated');
        return;
      }

      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('plan, role, plan_expires_at')
        .eq('id', user.id)
        .single();

      // Check if current user has access to voice calls (plus or pro plan)
      const currentUserPlan = currentUserProfile?.plan || 'free';
      const isCurrentUserAdmin = currentUserProfile?.role === 'admin';
      
      // Check if plan has expired
      let effectivePlan = currentUserPlan;
      if (currentUserProfile?.plan_expires_at && currentUserPlan !== 'free') {
        const expiresAt = new Date(currentUserProfile.plan_expires_at);
        const now = new Date();
        if (expiresAt < now) {
          effectivePlan = 'free';
        }
      }

      if (!isCurrentUserAdmin && effectivePlan === 'free') {
        alert('Voice calls are only available for Plus and Pro plans. Please upgrade your plan to use this feature.');
        return;
      }

      // Get friend's profile to check their plan and get display info
      const { data: friendProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, image_url, email, plan, role, plan_expires_at')
        .eq('id', friendId)
        .single();

      let displayName = friendName;
      let avatar = friendAvatar;

      if (friendProfile) {
        if (friendProfile.first_name && friendProfile.last_name) {
          displayName = `${friendProfile.first_name} ${friendProfile.last_name}`;
        } else if (friendProfile.first_name) {
          displayName = friendProfile.first_name;
        } else if (friendProfile.email) {
          displayName = friendProfile.email.split('@')[0];
        }
        avatar = friendProfile.image_url || friendAvatar;

        // Check if recipient has access to voice calls
        const recipientPlan = friendProfile.plan || 'free';
        const isRecipientAdmin = friendProfile.role === 'admin';
        
        // Check if recipient's plan has expired
        let recipientEffectivePlan = recipientPlan;
        if (friendProfile.plan_expires_at && recipientPlan !== 'free') {
          const expiresAt = new Date(friendProfile.plan_expires_at);
          const now = new Date();
          if (expiresAt < now) {
            recipientEffectivePlan = 'free';
          }
        }

        if (!isRecipientAdmin && recipientEffectivePlan === 'free') {
          alert(`The recipient (${displayName}) cannot accept calls because they are on the Free plan. Voice calls are only available for Plus and Pro plans.`);
          return;
        }
      }

      setActiveCallFriend({
        id: friendId,
        name: displayName,
        avatar,
      });

      await twilioInitiateCall(friendId, displayName);
    } catch (error) {
      console.error('Error initiating call:', error);
      alert('Failed to initiate call');
    }
  };

  return (
    <CallContext.Provider value={{ initiateCall, callState, isDeviceReady }}>
      {children}
      {/* Global Call Interface - shows when there's an active call */}
      {(callState !== 'idle' || activeCallFriend || incomingCallFrom) && (
        <CallInterface
          friendId={activeCallFriend?.id}
          friendName={activeCallFriend?.name}
          friendAvatar={activeCallFriend?.avatar}
          callState={callState}
          incomingCallFrom={incomingCallFrom}
          onAnswer={answerCall}
          onReject={rejectCall}
          onEnd={endCall}
          onMute={muteCall}
          onUnmute={unmuteCall}
          isMuted={isMuted}
          error={callError}
          onCallEnd={() => {
            setActiveCallFriend(null);
          }}
        />
      )}
    </CallContext.Provider>
  );
};






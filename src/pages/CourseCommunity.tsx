import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Book, 
  Users,
  MessageSquare,
  FileText,
  Send,
  Plus,
  ArrowLeft,
  Bell,
  Settings,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Reply,
  Trash2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MousePointerClick,
  Upload,
  X as XIcon,
  Download
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import SettingsModal from "@/components/SettingsModal";
import { FileViewer } from "@/components/FileViewer";
import NotificationDropdown from "@/components/NotificationDropdown";

interface Community {
  id: string;
  course_name: string;
  course_category: string;
  description: string;
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  is_anonymous?: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  profiles: Profile;
}

interface Reply {
  id: string;
  discussion_id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_anonymous?: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  profiles: Profile;
}

interface Vote {
  id: string;
  vote_type: 'upvote' | 'downvote';
  user_id: string;
}

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_url: string;
  resource_type: string;
  created_at: string;
  profiles: Profile;
}

interface ActiveUser {
  user_id: string;
  last_seen: string;
  profiles: Profile;
}

const CourseCommunity = () => {
  const navigate = useNavigate();
  const { communityId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionContent, setNewDiscussionContent] = useState("");
  const [newDiscussionAnonymous, setNewDiscussionAnonymous] = useState(false);
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newDiscussionFile, setNewDiscussionFile] = useState<File | null>(null);
  const [isUploadingDiscussionFile, setIsUploadingDiscussionFile] = useState(false);
  const [isDraggingOverDiscussion, setIsDraggingOverDiscussion] = useState(false);
  const dragCounterRef = useRef(0);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newResourceDesc, setNewResourceDesc] = useState("");
  const [showNewResource, setShowNewResource] = useState(false);
  const [expandedDiscussions, setExpandedDiscussions] = useState<Set<string>>(new Set());
  const expandedDiscussionsRef = useRef<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [replyContents, setReplyContents] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});
  const [showReplyInput, setShowReplyInput] = useState<Record<string, boolean>>({});
  const [replyFiles, setReplyFiles] = useState<Record<string, File | null>>({});
  const [isUploadingReplyFile, setIsUploadingReplyFile] = useState<Record<string, boolean>>({});
  const [expandedDiscussionId, setExpandedDiscussionId] = useState<string | null>(null);
  const expandedDiscussionIdRef = useRef<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{ 
    type: 'discussion' | 'reply' | null; 
    id: string | null;
    discussionId?: string | null;
  }>({ type: null, id: null, discussionId: null });
  const [discussionVotes, setDiscussionVotes] = useState<Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }>>({});
  const [replyVotes, setReplyVotes] = useState<Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }>>({});
  const [interactionCounts, setInteractionCounts] = useState<Record<string, number>>({});

  // Keep refs in sync with state for use in realtime callbacks
  useEffect(() => {
    expandedDiscussionsRef.current = expandedDiscussions;
  }, [expandedDiscussions]);

  useEffect(() => {
    expandedDiscussionIdRef.current = expandedDiscussionId;
  }, [expandedDiscussionId]);

  useEffect(() => {
    document.title = "MarkIt | Community";
  }, [navigate]);

  // Refactored function to fetch discussions and related data
  const fetchDiscussionsData = useCallback(async () => {
    if (!communityId || !user || !isMember) return;

    // Fetch discussions first - show these immediately
    // Limit to 50 for faster initial load
    const { data: discussionsData } = await supabase
      .from('community_discussions')
      .select(`
        *,
        profiles:user_id (first_name, last_name, image_url, email)
      `)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (discussionsData) {
      // Set discussions immediately so UI can render
      setDiscussions(discussionsData as any);
      
      // Fetch all related data in parallel for better performance
      if (discussionsData.length > 0) {
        const discussionIds = discussionsData.map(d => d.id);
        
        // Fetch all counts/votes/interactions in parallel
        // Don't initialize to 0 - only set when we have actual data
        const [repliesResult, votesResult, interactionsResult] = await Promise.all([
          // Reply counts
          supabase
            .from('community_discussion_replies')
            .select('discussion_id')
            .in('discussion_id', discussionIds),
          // Discussion votes
          user ? supabase
            .from('community_discussion_votes')
            .select('discussion_id, vote_type, user_id')
            .in('discussion_id', discussionIds) : Promise.resolve({ data: null, error: null }),
          // Interaction counts
          supabase
            .from('community_discussion_interactions')
            .select('discussion_id')
            .in('discussion_id', discussionIds)
        ]);

        // Process reply counts - only update if we have data, preserve existing values
        if (repliesResult.data) {
          setReplyCounts((prev) => {
            const counts = { ...prev };
            // Count replies per discussion
            const replyCountsByDiscussion: Record<string, number> = {};
            repliesResult.data.forEach((reply) => {
              replyCountsByDiscussion[reply.discussion_id] = (replyCountsByDiscussion[reply.discussion_id] || 0) + 1;
            });
            // Only set if new value is higher or if we don't have a value yet (prevents flashing down)
            discussionIds.forEach(id => {
              const newCount = replyCountsByDiscussion[id] || 0;
              const current = prev[id];
              if (current === undefined || newCount >= current) {
                counts[id] = newCount;
              }
              // If current is higher, keep it (don't flash down)
            });
            return counts;
          });
        }

              // Process votes - only set when we have data
              if (votesResult.data && user) {
                setDiscussionVotes((prev) => {
                  const votes: Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> = {};
                  
                  // Initialize all discussions first
                  discussionIds.forEach(id => {
                    votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
                  });
                  
                  // Count votes from scratch (don't increment on existing values)
                  votesResult.data.forEach((vote) => {
                    if (!votes[vote.discussion_id]) {
                      votes[vote.discussion_id] = { upvotes: 0, downvotes: 0, userVote: null };
                    }
                    if (vote.vote_type === 'upvote') {
                      votes[vote.discussion_id].upvotes++;
                    } else {
                      votes[vote.discussion_id].downvotes++;
                    }
                    if (vote.user_id === user.id) {
                      votes[vote.discussion_id].userVote = vote.vote_type as 'upvote' | 'downvote';
                    }
                  });
                  
                  // Preserve existing values for discussions not in this batch (if any)
                  Object.keys(prev).forEach(id => {
                    if (!discussionIds.includes(id)) {
                      votes[id] = prev[id];
                    }
                  });
                  
                  return votes;
                });
              }

        // Process interaction counts - only update if we have data
        if (interactionsResult.data) {
          setInteractionCounts((prev) => {
            const interactionCountsMap = { ...prev };
            // Count interactions per discussion
            const interactionCountsByDiscussion: Record<string, number> = {};
            interactionsResult.data.forEach((interaction) => {
              interactionCountsByDiscussion[interaction.discussion_id] = (interactionCountsByDiscussion[interaction.discussion_id] || 0) + 1;
            });
            // Only set if new value is higher or if we don't have a value yet (prevents flashing down)
            discussionIds.forEach(id => {
              const newCount = interactionCountsByDiscussion[id] || 0;
              const current = prev[id];
              if (current === undefined || newCount >= current) {
                interactionCountsMap[id] = newCount;
              }
              // If current is higher, keep it (don't flash down)
            });
            return interactionCountsMap;
          });
        }
      }
    }
  }, [communityId, user, isMember]);

  useEffect(() => {
    if (!communityId || !user) return;

    // Track community visit
    const trackVisit = () => {
      try {
        const visitKey = `community_visits_${user.id}`;
        const visits = JSON.parse(localStorage.getItem(visitKey) || '{}');
        visits[communityId] = new Date().toISOString();
        localStorage.setItem(visitKey, JSON.stringify(visits));
      } catch (error) {
        console.error('Failed to track community visit:', error);
      }
    };

    trackVisit();

    const fetchCommunityData = async () => {
      // Fetch community and membership in parallel (they're independent)
      const [communityResult, membershipResult] = await Promise.all([
        supabase
        .from('course_communities')
        .select('*')
        .eq('id', communityId)
          .single(),
        supabase
        .from('community_memberships')
        .select('*')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
          .maybeSingle()
      ]);

      if (communityResult.data) {
        setCommunity(communityResult.data);
      }

      const membershipData = membershipResult.data;
      const isMemberNow = !!membershipData;
      setIsMember(isMemberNow);

      if (membershipData) {
        // Update presence (don't await - fire and forget for faster initial load)
        supabase
          .from('community_presence')
          .upsert({
            community_id: communityId,
            user_id: user.id,
            last_seen: new Date().toISOString()
          });

        // Fetch discussions immediately (don't wait for state update)
        // Fetch discussions first - show these immediately
        const discussionsResult = await supabase
          .from('community_discussions')
          .select(`
            *,
            profiles:user_id (first_name, last_name, image_url, email)
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(50); // Limit initial load for faster response

        if (discussionsResult.data) {
          // Set discussions immediately so UI can render
          setDiscussions(discussionsResult.data as any);
          
          // Fetch all related data in parallel (non-blocking)
          if (discussionsResult.data.length > 0) {
            const discussionIds = discussionsResult.data.map(d => d.id);
            
            // Fetch counts/votes/interactions in parallel (non-blocking)
            // Don't initialize to 0 - only set when we have actual data
            Promise.all([
              supabase
              .from('community_discussion_replies')
              .select('discussion_id')
                .in('discussion_id', discussionIds),
              user ? supabase
                .from('community_discussion_votes')
                .select('discussion_id, vote_type, user_id')
                .in('discussion_id', discussionIds) : Promise.resolve({ data: null, error: null }),
              supabase
                .from('community_discussion_interactions')
                .select('discussion_id')
                .in('discussion_id', discussionIds)
            ]).then(([repliesResult, votesResult, interactionsResult]) => {
              // Process reply counts - only update if we have data, preserve existing values
              if (repliesResult.data) {
                setReplyCounts((prev) => {
                  const counts = { ...prev };
            // Count replies per discussion
                  const replyCountsByDiscussion: Record<string, number> = {};
                  repliesResult.data.forEach((reply) => {
                    replyCountsByDiscussion[reply.discussion_id] = (replyCountsByDiscussion[reply.discussion_id] || 0) + 1;
                  });
                  // Only set if new value is higher or if we don't have a value yet (prevents flashing down)
            discussionIds.forEach(id => {
                    const newCount = replyCountsByDiscussion[id] || 0;
                    const current = prev[id];
                    if (current === undefined || newCount >= current) {
                      counts[id] = newCount;
                    }
                    // If current is higher, keep it (don't flash down)
                  });
                  return counts;
                });
              }

              // Process votes - only set when we have data
              if (votesResult.data && user) {
                setDiscussionVotes((prev) => {
              const votes: Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> = {};
                  
                  // Initialize all discussions first
              discussionIds.forEach(id => {
                votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
              });

                  // Count votes from scratch (don't increment on existing values)
                  votesResult.data.forEach((vote) => {
                if (!votes[vote.discussion_id]) {
                  votes[vote.discussion_id] = { upvotes: 0, downvotes: 0, userVote: null };
                }
                if (vote.vote_type === 'upvote') {
                  votes[vote.discussion_id].upvotes++;
                } else {
                  votes[vote.discussion_id].downvotes++;
                }
                if (vote.user_id === user.id) {
                  votes[vote.discussion_id].userVote = vote.vote_type as 'upvote' | 'downvote';
                }
              });
                  
                  // Preserve existing values for discussions not in this batch (if any)
                  Object.keys(prev).forEach(id => {
                    if (!discussionIds.includes(id)) {
                      votes[id] = prev[id];
                    }
                  });
                  
                  return votes;
                });
              }

              // Process interaction counts - only update if we have data
              if (interactionsResult.data) {
                setInteractionCounts((prev) => {
                  const interactionCountsMap = { ...prev };
                  // Count interactions per discussion
                  const interactionCountsByDiscussion: Record<string, number> = {};
                  interactionsResult.data.forEach((interaction) => {
                    interactionCountsByDiscussion[interaction.discussion_id] = (interactionCountsByDiscussion[interaction.discussion_id] || 0) + 1;
                  });
                  // Only set if new value is higher or if we don't have a value yet (prevents flashing down)
            discussionIds.forEach(id => {
                    const newCount = interactionCountsByDiscussion[id] || 0;
                    const current = prev[id];
                    if (current === undefined || newCount >= current) {
                      interactionCountsMap[id] = newCount;
                    }
                    // If current is higher, keep it (don't flash down)
                  });
                  return interactionCountsMap;
                });
              }
            }).catch(err => {
              console.error('Error fetching discussion metadata:', err);
            });
          }
        }

        // Fetch resources and active users in parallel (less critical, can load after)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        Promise.all([
          supabase
          .from('community_resources')
          .select(`
            *,
            profiles:user_id (first_name, last_name, image_url, email)
          `)
          .eq('community_id', communityId)
            .order('created_at', { ascending: false }),
          supabase
          .from('community_presence')
          .select(`
            user_id,
            last_seen,
            profiles:user_id (first_name, last_name, image_url, email)
          `)
          .eq('community_id', communityId)
          .gte('last_seen', fiveMinutesAgo)
            .neq('user_id', user.id)
        ]).then(([resourcesResult, activeUsersResult]) => {
          if (resourcesResult.data) {
            setResources(resourcesResult.data as any);
          }
          if (activeUsersResult.data) {
            setActiveUsers(activeUsersResult.data as any);
        }
        });
      }
    };

    fetchCommunityData();

    // Set up presence interval
    const presenceInterval = setInterval(async () => {
      if (isMember) {
        await supabase
          .from('community_presence')
          .upsert({
            community_id: communityId,
            user_id: user.id,
            last_seen: new Date().toISOString()
          });
      }
    }, 60000); // Update every minute

    return () => clearInterval(presenceInterval);
  }, [communityId, user]);

  // Realtime subscriptions and polling with visibility detection
  useEffect(() => {
    if (!communityId || !user || !isMember) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let isTabVisible = !document.hidden;

    // Handle visibility change
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      
      // Clear existing interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }

      // Set up new interval based on visibility
      const interval = isTabVisible ? 4000 : 15000; // 4s active, 15s inactive
      pollingInterval = setInterval(() => {
        fetchDiscussionsData();
      }, interval);
    };

    // Set up Realtime channel for discussions
    channel = supabase
      .channel(`community-discussions-${communityId}`, {
        config: {
          presence: { key: user.id },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_discussions",
          filter: `community_id=eq.${communityId}`,
        },
        async (payload) => {
          // Fetch profile for the new discussion
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, image_url, email')
            .eq('id', payload.new.user_id)
            .single();

          const newDiscussion = {
            ...payload.new,
            profiles: profileData || { first_name: null, last_name: null, image_url: null, email: '' }
          } as Discussion;

          setDiscussions((prev) => {
            // Check if discussion already exists (avoid duplicates)
            if (prev.some(d => d.id === newDiscussion.id)) {
              return prev;
            }
            return [newDiscussion, ...prev];
          });

          // Update reply count (initialize to 0)
          setReplyCounts((prev) => ({
            ...prev,
            [newDiscussion.id]: 0
          }));

          // Initialize votes
          setDiscussionVotes((prev) => ({
            ...prev,
            [newDiscussion.id]: { upvotes: 0, downvotes: 0, userVote: null }
          }));

          // Initialize interaction count
          setInteractionCounts((prev) => ({
            ...prev,
            [newDiscussion.id]: 0
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_discussions",
          filter: `community_id=eq.${communityId}`,
        },
        async (payload) => {
          // Fetch profile for the updated discussion
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, image_url, email')
            .eq('id', payload.new.user_id)
            .single();

          const updatedDiscussion = {
            ...payload.new,
            profiles: profileData || { first_name: null, last_name: null, image_url: null, email: '' }
          } as Discussion;

          setDiscussions((prev) =>
            prev.map((d) => (d.id === updatedDiscussion.id ? updatedDiscussion : d))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "community_discussions",
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          setDiscussions((prev) => prev.filter((d) => d.id !== payload.old.id));
          setReplyCounts((prev) => {
            const newCounts = { ...prev };
            delete newCounts[payload.old.id];
            return newCounts;
          });
          setDiscussionVotes((prev) => {
            const newVotes = { ...prev };
            delete newVotes[payload.old.id];
            return newVotes;
          });
          setInteractionCounts((prev) => {
            const newCounts = { ...prev };
            delete newCounts[payload.old.id];
            return newCounts;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_discussion_replies",
        },
        async (payload) => {
          const reply = payload.new as Reply;
          
          // Fetch the discussion to check community_id
          const { data: discussionData } = await supabase
            .from('community_discussions')
            .select('community_id')
            .eq('id', reply.discussion_id)
            .single();
          
          if (!discussionData || discussionData.community_id !== communityId) {
            return; // Not for this community
          }

          // Update reply count
          setReplyCounts((prev) => ({
            ...prev,
            [reply.discussion_id]: (prev[reply.discussion_id] || 0) + 1
          }));

          // Fetch the full reply with profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name, image_url, email')
            .eq('id', reply.user_id)
            .single();

          const fullReply = {
            ...reply,
            profiles: profileData || { first_name: null, last_name: null, image_url: null, email: '' }
          } as Reply & { profiles: Profile };

          // Add to replies if discussion is currently expanded (using refs to avoid stale closure)
          const isExpanded = expandedDiscussionsRef.current.has(reply.discussion_id) || expandedDiscussionIdRef.current === reply.discussion_id;
          if (isExpanded) {
            setReplies((prevReplies) => {
              const existingReplies = prevReplies[reply.discussion_id] || [];
              // Check if reply already exists
              if (existingReplies.some(r => r.id === reply.id)) {
                return prevReplies;
              }
              return {
                ...prevReplies,
                [reply.discussion_id]: [...existingReplies, fullReply]
              };
            });
          }

          // Initialize reply votes
          setReplyVotes((prev) => ({
            ...prev,
            [reply.id]: { upvotes: 0, downvotes: 0, userVote: null }
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "community_discussion_replies",
        },
        async (payload) => {
          const updatedReply = payload.new as Reply;
          
          // Update in replies if it exists
          setReplies((prev) => {
            const discussionReplies = prev[updatedReply.discussion_id];
            if (!discussionReplies) return prev;
            
            return {
              ...prev,
              [updatedReply.discussion_id]: discussionReplies.map((r) =>
                r.id === updatedReply.id ? updatedReply : r
              )
            };
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "community_discussion_replies",
        },
        (payload) => {
          const deletedReply = payload.old as Reply;
          
          // Update reply count
          setReplyCounts((prev) => ({
            ...prev,
            [deletedReply.discussion_id]: Math.max((prev[deletedReply.discussion_id] || 0) - 1, 0)
          }));

          // Remove from replies
          setReplies((prev) => {
            const discussionReplies = prev[deletedReply.discussion_id];
            if (!discussionReplies) return prev;
            
            return {
              ...prev,
              [deletedReply.discussion_id]: discussionReplies.filter((r) => r.id !== deletedReply.id)
            };
          });

          // Remove reply votes
          setReplyVotes((prev) => {
            const newVotes = { ...prev };
            delete newVotes[deletedReply.id];
            return newVotes;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_discussion_votes",
        },
        () => {
          // Refetch votes when any vote changes
          // Use fetchDiscussionsData which will refetch all vote data
          fetchDiscussionsData();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    // Set up visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initialize polling interval based on current visibility
    handleVisibilityChange();

    // Cleanup function
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [communityId, user, isMember, fetchDiscussionsData]);

  const handleJoinCommunity = async () => {
    if (!user || !communityId) return;

    const { error } = await supabase
      .from('community_memberships')
      .insert({
        community_id: communityId,
        user_id: user.id
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to join community",
        variant: "destructive"
      });
    } else {
      setIsMember(true);
      toast({
        title: "Success",
        description: "Joined community successfully!"
      });
    }
  };

  const handleLeaveCommunity = async () => {
    if (!user || !communityId) return;

    const { error } = await supabase
      .from('community_memberships')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to leave community",
        variant: "destructive"
      });
    } else {
      setIsMember(false);
      toast({
        title: "Success",
        description: "Left community successfully"
      });
      navigate('/communities');
    }
  };

  const handleCreateDiscussion = async () => {
    console.log('[handleCreateDiscussion] Starting discussion creation...');
    console.log('[handleCreateDiscussion] Inputs:', {
      user: user?.id,
      communityId,
      title: newDiscussionTitle,
      content: newDiscussionContent?.substring(0, 50) + '...',
      isAnonymous: newDiscussionAnonymous,
      hasFile: !!newDiscussionFile,
      fileName: newDiscussionFile?.name
    });

    if (!user || !communityId || !newDiscussionTitle || !newDiscussionContent) {
      console.error('[handleCreateDiscussion] Validation failed:', {
        hasUser: !!user,
        hasCommunityId: !!communityId,
        hasTitle: !!newDiscussionTitle,
        hasContent: !!newDiscussionContent
      });
      return;
    }

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;

    // Upload file if present
    if (newDiscussionFile) {
      console.log('[handleCreateDiscussion] Uploading file:', {
        name: newDiscussionFile.name,
        type: newDiscussionFile.type,
        size: newDiscussionFile.size
      });
      setIsUploadingDiscussionFile(true);
      try {
      const { url, error } = await uploadFile(newDiscussionFile);
      if (error) {
          console.error('[handleCreateDiscussion] File upload error:', error);
        setIsUploadingDiscussionFile(false);
        toast({
          title: "Error",
          description: error.message || "Failed to upload file",
          variant: "destructive"
        });
        return;
      }
        console.log('[handleCreateDiscussion] File uploaded successfully:', url);
      attachmentUrl = url;
      attachmentType = newDiscussionFile.type;
      attachmentName = newDiscussionFile.name;
      setIsUploadingDiscussionFile(false);
      } catch (uploadError) {
        console.error('[handleCreateDiscussion] File upload exception:', uploadError);
        setIsUploadingDiscussionFile(false);
        toast({
          title: "Error",
          description: "Failed to upload file",
          variant: "destructive"
        });
        return;
      }
    }

    const discussionData: any = {
        community_id: communityId,
        user_id: user.id,
        title: newDiscussionTitle,
        content: newDiscussionContent,
      is_anonymous: newDiscussionAnonymous
    };

    // Only include attachment fields if we have an attachment
    if (attachmentUrl) {
      discussionData.attachment_url = attachmentUrl;
      discussionData.attachment_type = attachmentType;
      discussionData.attachment_name = attachmentName;
    }

    console.log('[handleCreateDiscussion] Inserting discussion to database:', {
      ...discussionData,
      content: discussionData.content.substring(0, 50) + '...'
    });

    try {
      console.log('[handleCreateDiscussion] Making Supabase insert call...');
      const insertResult = await supabase
        .from('community_discussions')
        .insert(discussionData)
      .select(`
        *,
        profiles:user_id (first_name, last_name, image_url, email)
      `)
      .single();
      
      console.log('[handleCreateDiscussion] Insert result received:', {
        hasData: !!insertResult.data,
        hasError: !!insertResult.error,
        error: insertResult.error,
        data: insertResult.data ? { id: insertResult.data.id, title: insertResult.data.title } : null
      });

      const { data: newDiscussion, error } = insertResult;

    if (error) {
        console.error('[handleCreateDiscussion] Database insert error:', error);
        console.error('[handleCreateDiscussion] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: JSON.stringify(error, null, 2)
        });
      toast({
        title: "Error",
          description: error.message || "Failed to create discussion",
        variant: "destructive"
      });
        return;
      }

      if (!newDiscussion) {
        console.error('[handleCreateDiscussion] No data returned from insert, but no error either');
        toast({
          title: "Error",
          description: "Failed to create discussion - no data returned",
          variant: "destructive"
        });
        return;
      }

      console.log('[handleCreateDiscussion] Discussion created successfully:', {
        id: newDiscussion.id,
        title: newDiscussion.title
      });
      
      // Add the new discussion to the top of the list
      console.log('[handleCreateDiscussion] Updating discussions state...');
      setDiscussions(prev => {
        const updated = [newDiscussion as any, ...prev];
        console.log('[handleCreateDiscussion] Updated discussions list, new count:', updated.length);
        return updated;
      });
      
      // Initialize reply count for the new discussion
      setReplyCounts(prev => ({ ...prev, [newDiscussion.id]: 0 }));
      
      console.log('[handleCreateDiscussion] Clearing form fields...');
      setNewDiscussionTitle("");
      setNewDiscussionContent("");
      setNewDiscussionAnonymous(false);
      // Clean up preview URL if it exists
      if (previewFile) {
        URL.revokeObjectURL(previewFile.url);
        setPreviewFile(null);
      }
      setNewDiscussionFile(null);
      setShowNewDiscussion(false);
      console.log('[handleCreateDiscussion] Form cleared and UI updated');
      toast({
        title: "Success",
        description: "Discussion created!"
      });
      console.log('[handleCreateDiscussion] Function completed successfully');
    } catch (dbError) {
      console.error('[handleCreateDiscussion] Database insert exception:', dbError);
      console.error('[handleCreateDiscussion] Exception details:', {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
        fullError: JSON.stringify(dbError, Object.getOwnPropertyNames(dbError), 2)
      });
      toast({
        title: "Error",
        description: "Failed to create discussion",
        variant: "destructive"
      });
    }
  };

  const handleAddResource = async () => {
    if (!user || !communityId || !newResourceTitle || !newResourceUrl) return;

    const { data: newResource, error } = await supabase
      .from('community_resources')
      .insert({
        community_id: communityId,
        user_id: user.id,
        title: newResourceTitle,
        description: newResourceDesc,
        resource_url: newResourceUrl
      })
      .select(`
        *,
        profiles:user_id (first_name, last_name, image_url, email)
      `)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add resource",
        variant: "destructive"
      });
    } else {
      // Add the new resource to the top of the list
      setResources(prev => [newResource as any, ...prev]);
      
      setNewResourceTitle("");
      setNewResourceUrl("");
      setNewResourceDesc("");
      setShowNewResource(false);
      toast({
        title: "Success",
        description: "Resource added!"
      });
    }
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.first_name) {
      return profile.first_name[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserInitials = (prof: Profile) => {
    if (prof.first_name && prof.last_name) {
      return `${prof.first_name[0]}${prof.last_name[0]}`.toUpperCase();
    }
    if (prof.first_name) {
      return prof.first_name[0].toUpperCase();
    }
    if (prof.email) {
      return prof.email[0].toUpperCase();
    }
    return 'U';
  };

  const trackInteraction = async (discussionId: string) => {
    if (!user || !discussionId) return;

    // Upsert interaction (insert if doesn't exist, ignore if already exists)
    // The unique constraint on (discussion_id, user_id) ensures we don't track duplicates
    await supabase
      .from('community_discussion_interactions')
      .upsert({
        discussion_id: discussionId,
        user_id: user.id
      }, {
        onConflict: 'discussion_id,user_id',
        ignoreDuplicates: true
      });
  };

  const uploadFile = async (file: File): Promise<{ url: string; error: Error | null }> => {
    if (!user) {
      return { url: '', error: new Error('User not authenticated') };
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
    ];

    if (!allowedTypes.includes(file.type)) {
      return { url: '', error: new Error('File type not allowed. Only images, PDF, DOC, DOCX, PPT, PPTX are allowed.') };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `discussions/${user.id}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        return { url: '', error: uploadError };
      }

      // Get signed URL that expires in 1 year (for long-term access)
      const expiresIn = 365 * 24 * 60 * 60; // 1 year in seconds
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('user-uploads')
        .createSignedUrl(filePath, expiresIn);

      if (signedUrlError || !signedUrlData) {
        // Fallback to public URL if signed URL fails
        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);
        return { url: publicUrl, error: null };
      }

      return { url: signedUrlData.signedUrl, error: null };
    } catch (error: any) {
      return { url: '', error: error };
    }
  };

  const toggleDiscussionExpansion = async (discussionId: string) => {
    const isExpanded = expandedDiscussions.has(discussionId);
    
    if (isExpanded) {
      // Collapse
      setExpandedDiscussions(prev => {
        const newSet = new Set(prev);
        newSet.delete(discussionId);
        return newSet;
      });
      setShowReplyInput(prev => ({ ...prev, [discussionId]: false }));
    } else {
      // Expand - fetch replies immediately
      setExpandedDiscussions(prev => new Set(prev).add(discussionId));
      
      if (!replies[discussionId]) {
        const repliesResult = await supabase
        .from('community_discussion_replies')
        .select(`
          id,
          discussion_id,
          user_id,
          content,
          created_at,
          updated_at,
          is_anonymous,
            attachment_url,
            attachment_type,
            attachment_name,
          profiles:user_id (first_name, last_name, image_url, email)
        `)
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true });

        if (repliesResult.data) {
          setReplies(prev => ({ ...prev, [discussionId]: repliesResult.data as any }));
          
          // Fetch votes for replies in parallel (non-blocking)
          const replyIds = repliesResult.data.map(r => r.id);
          if (replyIds.length > 0 && user) {
            supabase
              .from('community_reply_votes')
              .select('reply_id, vote_type, user_id')
              .in('reply_id', replyIds)
              .then(({ data: replyVotesData }) => {
                if (replyVotesData) {
                  const votes: Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> = {};
                  replyIds.forEach(id => {
                    votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
                  });

                  replyVotesData.forEach((vote) => {
                    if (!votes[vote.reply_id]) {
                      votes[vote.reply_id] = { upvotes: 0, downvotes: 0, userVote: null };
                    }
                    if (vote.vote_type === 'upvote') {
                      votes[vote.reply_id].upvotes++;
                    } else {
                      votes[vote.reply_id].downvotes++;
                    }
                    if (vote.user_id === user.id) {
                      votes[vote.reply_id].userVote = vote.vote_type as 'upvote' | 'downvote';
      }
                  });
                  setReplyVotes(prev => ({ ...prev, ...votes }));
                }
              })
              .catch(err => console.error('Failed to fetch reply votes:', err));
          }
        }
      }
      
      // Track interaction non-blocking
      trackInteraction(discussionId).catch(err => {
        console.error('Failed to track interaction:', err);
      });
    }
  };

  const handleDiscussionClick = async (discussionId: string) => {
    setExpandedDiscussionId(discussionId);
    
    // Fetch replies immediately (don't wait for interaction tracking)
    if (!replies[discussionId]) {
      const repliesResult = await supabase
        .from('community_discussion_replies')
        .select(`
          id,
          discussion_id,
          user_id,
          content,
          created_at,
          updated_at,
          is_anonymous,
          attachment_url,
          attachment_type,
          attachment_name,
          profiles:user_id (first_name, last_name, image_url, email)
        `)
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true });

      if (repliesResult.data) {
        // Set replies immediately so UI can render
        setReplies(prev => ({ ...prev, [discussionId]: repliesResult.data as any }));
        
        // Fetch votes for replies in parallel (non-blocking)
        const replyIds = repliesResult.data.map(r => r.id);
        if (replyIds.length > 0 && user) {
          supabase
            .from('community_reply_votes')
            .select('reply_id, vote_type, user_id')
            .in('reply_id', replyIds)
            .then(({ data: replyVotesData }) => {
              if (replyVotesData) {
                const votes: Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> = {};
                replyIds.forEach(id => {
                  votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
                });

                replyVotesData.forEach((vote) => {
                  if (!votes[vote.reply_id]) {
                    votes[vote.reply_id] = { upvotes: 0, downvotes: 0, userVote: null };
                  }
                  if (vote.vote_type === 'upvote') {
                    votes[vote.reply_id].upvotes++;
                  } else {
                    votes[vote.reply_id].downvotes++;
                  }
                  if (vote.user_id === user.id) {
                    votes[vote.reply_id].userVote = vote.vote_type as 'upvote' | 'downvote';
      }
                });
                setReplyVotes(prev => ({ ...prev, ...votes }));
              }
            })
            .catch(err => console.error('Failed to fetch reply votes:', err));
        }
      }
    }
    
    // Track interaction non-blocking (fire and forget)
    trackInteraction(discussionId).catch(err => {
      console.error('Failed to track interaction:', err);
    });
  };

  const handleReplySubmit = async (discussionId: string) => {
    const replyContent = replyContents[discussionId]?.trim();
    const isAnonymous = replyAnonymous[discussionId] || false;
    const replyFile = replyFiles[discussionId];
    if (!user || !discussionId || (!replyContent && !replyFile)) return;

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;

    // Upload file if present
    if (replyFile) {
      setIsUploadingReplyFile(prev => ({ ...prev, [discussionId]: true }));
      const { url, error } = await uploadFile(replyFile);
      if (error) {
        setIsUploadingReplyFile(prev => ({ ...prev, [discussionId]: false }));
        toast({
          title: "Error",
          description: error.message || "Failed to upload file",
          variant: "destructive"
        });
        return;
      }
      attachmentUrl = url;
      attachmentType = replyFile.type;
      attachmentName = replyFile.name;
      setIsUploadingReplyFile(prev => ({ ...prev, [discussionId]: false }));
    }

    // Track interaction when replying
    await trackInteraction(discussionId);

    const { error } = await supabase
      .from('community_discussion_replies')
      .insert({
        discussion_id: discussionId,
        user_id: user.id,
        content: replyContent || '',
        is_anonymous: isAnonymous,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        attachment_name: attachmentName
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive"
      });
    } else {
      // Clear reply input
      setReplyContents(prev => ({ ...prev, [discussionId]: '' }));
      setReplyAnonymous(prev => ({ ...prev, [discussionId]: false }));
      setReplyFiles(prev => ({ ...prev, [discussionId]: null }));
      setShowReplyInput(prev => ({ ...prev, [discussionId]: false }));
      
      // Refresh replies
      const { data: repliesData } = await supabase
        .from('community_discussion_replies')
        .select(`
          id,
          discussion_id,
          user_id,
          content,
          created_at,
          updated_at,
          is_anonymous,
          profiles:user_id (first_name, last_name, image_url, email)
        `)
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true });

      if (repliesData) {
        setReplies(prev => ({ ...prev, [discussionId]: repliesData as any }));
        // Update reply count
        setReplyCounts(prev => ({ ...prev, [discussionId]: repliesData.length }));
        
        // Fetch votes for replies
        const replyIds = repliesData.map(r => r.id);
        if (replyIds.length > 0 && user) {
          const { data: votesData } = await supabase
            .from('community_reply_votes')
            .select('reply_id, vote_type, user_id')
            .in('reply_id', replyIds);

          const votes: Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> = {};
          replyIds.forEach(id => {
            votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
          });

          votesData?.forEach((vote) => {
            if (!votes[vote.reply_id]) {
              votes[vote.reply_id] = { upvotes: 0, downvotes: 0, userVote: null };
            }
            if (vote.vote_type === 'upvote') {
              votes[vote.reply_id].upvotes++;
            } else {
              votes[vote.reply_id].downvotes++;
            }
            if (vote.user_id === user.id) {
              votes[vote.reply_id].userVote = vote.vote_type as 'upvote' | 'downvote';
            }
          });
          setReplyVotes(prev => ({ ...prev, ...votes }));
        }
        
        // If discussion is expanded in detail view, ensure it stays expanded
        if (expandedDiscussionId === discussionId) {
          // Replies are already updated, dialog will show them
        }
      }

      toast({
        title: "Success",
        description: "Reply posted!"
      });
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!user || !discussionId) return;

    const { error } = await supabase
      .from('community_discussions')
      .delete()
      .eq('id', discussionId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete discussion",
        variant: "destructive"
      });
    } else {
      // Remove from local state
      setDiscussions(prev => prev.filter(d => d.id !== discussionId));
      // Remove replies if any
      setReplies(prev => {
        const newReplies = { ...prev };
        delete newReplies[discussionId];
        return newReplies;
      });
      // Remove reply count
      setReplyCounts(prev => {
        const newCounts = { ...prev };
        delete newCounts[discussionId];
        return newCounts;
      });
      // Close dialog
      setDeleteDialogOpen({ type: null, id: null, discussionId: null });

      toast({
        title: "Success",
        description: "Discussion deleted"
      });
    }
  };

  const handleDeleteReply = async (replyId: string, discussionId: string) => {
    if (!user || !replyId) return;

    const { error } = await supabase
      .from('community_discussion_replies')
      .delete()
      .eq('id', replyId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete reply",
        variant: "destructive"
      });
    } else {
      // Remove from local state
      setReplies(prev => {
        const discussionReplies = prev[discussionId] || [];
        return {
          ...prev,
          [discussionId]: discussionReplies.filter(r => r.id !== replyId)
        };
      });
      // Update reply count
      setReplyCounts(prev => ({
        ...prev,
        [discussionId]: Math.max(0, (prev[discussionId] || 0) - 1)
      }));
      // Remove votes for this reply
      setReplyVotes(prev => {
        const newVotes = { ...prev };
        delete newVotes[replyId];
        return newVotes;
      });
      // Close dialog
      setDeleteDialogOpen({ type: null, id: null, discussionId: null });

      toast({
        title: "Success",
        description: "Reply deleted"
      });
    }
  };

  const handleDiscussionVote = async (discussionId: string, voteType: 'upvote' | 'downvote') => {
    if (!user || !discussionId) return;

    // Track interaction when voting (only if this is a new vote, not removing)
    const currentVote = discussionVotes[discussionId]?.userVote;
    if (currentVote !== voteType) {
      await trackInteraction(discussionId);
    }

    const current = discussionVotes[discussionId] || { upvotes: 0, downvotes: 0, userVote: null };
    
    // Optimistic update - update UI immediately
    if (currentVote === voteType) {
      // Remove vote optimistically
      const optimisticVotes = { ...current };
      if (voteType === 'upvote') {
        optimisticVotes.upvotes = Math.max(0, optimisticVotes.upvotes - 1);
      } else {
        optimisticVotes.downvotes = Math.max(0, optimisticVotes.downvotes - 1);
      }
      optimisticVotes.userVote = null;
      setDiscussionVotes(prev => ({ ...prev, [discussionId]: optimisticVotes }));

      // Then sync with database
      const { error } = await supabase
        .from('community_discussion_votes')
        .delete()
        .eq('discussion_id', discussionId)
        .eq('user_id', user.id);

      if (error) {
        // Revert on error
        setDiscussionVotes(prev => ({ ...prev, [discussionId]: current }));
      }
    } else {
      // Add/change vote optimistically
      const optimisticVotes = { ...current };
      
      // Remove old vote count
      if (current.userVote === 'upvote') {
        optimisticVotes.upvotes = Math.max(0, optimisticVotes.upvotes - 1);
      } else if (current.userVote === 'downvote') {
        optimisticVotes.downvotes = Math.max(0, optimisticVotes.downvotes - 1);
      }
      
      // Add new vote count
      if (voteType === 'upvote') {
        optimisticVotes.upvotes++;
      } else {
        optimisticVotes.downvotes++;
      }
      
      optimisticVotes.userVote = voteType;
      setDiscussionVotes(prev => ({ ...prev, [discussionId]: optimisticVotes }));

      // Then sync with database
      const { error } = await supabase
        .from('community_discussion_votes')
        .upsert({
          discussion_id: discussionId,
          user_id: user.id,
          vote_type: voteType
        }, {
          onConflict: 'discussion_id,user_id'
        });

      if (error) {
        // Revert on error
        setDiscussionVotes(prev => ({ ...prev, [discussionId]: current }));
      }
    }
  };

  const handleReplyVote = async (replyId: string, voteType: 'upvote' | 'downvote') => {
    if (!user || !replyId) return;

    // Get discussion ID from the reply
    const reply = Object.values(replies).flat().find(r => r.id === replyId);
    const discussionId = reply?.discussion_id;
    
    // Track interaction when voting on reply (only if this is a new vote, not removing)
    const currentVote = replyVotes[replyId]?.userVote;
    if (discussionId && currentVote !== voteType) {
      await trackInteraction(discussionId);
    }

    const current = replyVotes[replyId] || { upvotes: 0, downvotes: 0, userVote: null };
    
    // Optimistic update - update UI immediately
    if (currentVote === voteType) {
      // Remove vote optimistically
      const optimisticVotes = { ...current };
      if (voteType === 'upvote') {
        optimisticVotes.upvotes = Math.max(0, optimisticVotes.upvotes - 1);
      } else {
        optimisticVotes.downvotes = Math.max(0, optimisticVotes.downvotes - 1);
      }
      optimisticVotes.userVote = null;
      setReplyVotes(prev => ({ ...prev, [replyId]: optimisticVotes }));

      // Then sync with database
      const { error } = await supabase
        .from('community_reply_votes')
        .delete()
        .eq('reply_id', replyId)
        .eq('user_id', user.id);

      if (error) {
        // Revert on error
        setReplyVotes(prev => ({ ...prev, [replyId]: current }));
      }
    } else {
      // Add/change vote optimistically
      const optimisticVotes = { ...current };
      
      // Remove old vote count
      if (current.userVote === 'upvote') {
        optimisticVotes.upvotes = Math.max(0, optimisticVotes.upvotes - 1);
      } else if (current.userVote === 'downvote') {
        optimisticVotes.downvotes = Math.max(0, optimisticVotes.downvotes - 1);
      }
      
      // Add new vote count
      if (voteType === 'upvote') {
        optimisticVotes.upvotes++;
      } else {
        optimisticVotes.downvotes++;
      }
      
      optimisticVotes.userVote = voteType;
      setReplyVotes(prev => ({ ...prev, [replyId]: optimisticVotes }));

      // Then sync with database
      const { error } = await supabase
        .from('community_reply_votes')
        .upsert({
          reply_id: replyId,
          user_id: user.id,
          vote_type: voteType
        }, {
          onConflict: 'reply_id,user_id'
        });

      if (error) {
        // Revert on error
        setReplyVotes(prev => ({ ...prev, [replyId]: current }));
      }
    }
  };

  // Handle discussion/reply query parameters from notifications
  useEffect(() => {
    const discussionId = searchParams.get('discussion');
    const replyId = searchParams.get('reply');
    
    if (discussionId && discussions.length > 0) {
      // Expand the discussion
      setExpandedDiscussions(prev => {
        const newSet = new Set([...prev, discussionId]);
        expandedDiscussionsRef.current = newSet;
        return newSet;
      });
      
      // Load replies if not already loaded
      if (!replies[discussionId] || replies[discussionId].length === 0) {
        handleDiscussionClick(discussionId);
      }
      
      // Scroll to discussion after a short delay
      setTimeout(() => {
        const element = document.getElementById(`discussion-${discussionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      
      // If reply ID is specified, scroll to that reply
      if (replyId) {
        setTimeout(() => {
          const element = document.getElementById(`reply-${replyId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 1000);
      }
      
      // Clear query parameters
      searchParams.delete('discussion');
      searchParams.delete('reply');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, discussions, replies, setSearchParams]);

  if (!community) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-home-surface/80 dark:bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-1.5">
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary " />
              </div>
              <span className="text-xl font-bold text-home-foreground ">MarkIt</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Dashboard</Button>
              </Link>
              <Link to="/communities">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface bg-home-surface">Communities</Button>
              </Link>
              <Link to="/friends">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Friends</Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-home-foreground hover:bg-home-surface"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Avatar className="w-8 h-8">
              <AvatarImage src={profile?.image_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} />
              <AvatarFallback className="bg-home-primary text-white text-sm font-medium">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Community Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/communities')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-home-foreground">{community.course_name}</h1>
                  <p className="text-gray-600 dark:text-gray-400">{community.description}</p>
                  <Badge className="mt-2">{community.course_category}</Badge>
                </div>
              </div>
              {!isMember ? (
                <Button onClick={handleJoinCommunity} className="bg-home-primary hover:bg-home-primary-hover text-white">
                  Join Community
                </Button>
              ) : (
                <Button onClick={handleLeaveCommunity} variant="outline" className="border-red-500 dark:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Leave Community
                </Button>
              )}
            </div>

            {isMember ? (
              <>
                {/* Discussions Feed */}
                <Card className="p-6 bg-card border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-home-primary" />
                      <h2 className="text-xl font-bold text-home-foreground">Discussions</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => window.location.reload()}
                        size="sm"
                        variant="outline"
                        className="border-gray-300 dark:border-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-accent"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Load More
                      </Button>
                      <Button 
                        onClick={() => setShowNewDiscussion(!showNewDiscussion)}
                        size="sm"
                        className="bg-home-primary hover:bg-home-primary-hover text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        New Discussion
                      </Button>
                    </div>
                  </div>

                  {showNewDiscussion && (
                    <Card 
                      className={`p-4 mb-4 bg-gray-50 dark:bg-accent transition-colors ${
                        isDraggingOverDiscussion ? 'border-2 border-dashed border-home-primary bg-home-primary/5' : ''
                      }`}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dragCounterRef.current++;
                        if (e.dataTransfer.types.includes('Files') && !newDiscussionFile) {
                          setIsDraggingOverDiscussion(true);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.types.includes('Files') && !newDiscussionFile) {
                          e.dataTransfer.dropEffect = 'copy';
                        } else {
                          e.dataTransfer.dropEffect = 'none';
                        }
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dragCounterRef.current--;
                        if (dragCounterRef.current === 0) {
                          setIsDraggingOverDiscussion(false);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dragCounterRef.current = 0;
                        setIsDraggingOverDiscussion(false);
                        
                        // Only allow drop if no file is already attached
                        if (newDiscussionFile) {
                          toast({
                            title: "Error",
                            description: "Only one file can be attached. Remove the current file first.",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                          const file = files[0];
                          // Validate file type
                          const allowedTypes = [
                            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                            'application/pdf',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'application/vnd.ms-powerpoint',
                            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                          ];
                          
                          if (allowedTypes.includes(file.type)) {
                            setNewDiscussionFile(file);
                          } else {
                            toast({
                              title: "Error",
                              description: "File type not supported. Only images, PDF, DOC, DOCX, PPT, PPTX are allowed.",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                    >
                      {isDraggingOverDiscussion ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Upload className="w-12 h-12 mb-3 text-home-primary" />
                          <p className="text-lg font-semibold text-home-foreground">Drop file here to attach</p>
                          <p className="text-sm text-muted-foreground mt-1">Supported: Images, PDF, DOC, DOCX, PPT, PPTX</p>
                        </div>
                      ) : (
                        <>
                          {/* Title and Upload Button Row */}
                          <div className="flex gap-3 mb-3">
                        <Input
                          placeholder="Discussion title..."
                          value={newDiscussionTitle}
                          onChange={(e) => setNewDiscussionTitle(e.target.value)}
                          className="flex-[0.75]"
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <label className="flex-[0.25]">
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setNewDiscussionFile(file);
                                    }
                                  }}
                                  className="hidden"
                                  id="discussion-file-input"
                                  disabled={!!newDiscussionFile}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (!newDiscussionFile) {
                                      document.getElementById('discussion-file-input')?.click();
                                    }
                                  }}
                                  className="w-full"
                                  disabled={!!newDiscussionFile}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  {newDiscussionFile ? newDiscussionFile.name : 'Attach Files'}
                                </Button>
                              </label>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {newDiscussionFile 
                                  ? 'Only 1 file per post is allowed' 
                                  : 'Supported: Images (JPG, PNG, GIF, WEBP), PDF, DOC, DOCX, PPT, PPTX'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                          <Textarea
                            placeholder="What would you like to discuss?"
                            value={newDiscussionContent}
                            onChange={(e) => setNewDiscussionContent(e.target.value)}
                            className="mb-3"
                            rows={4}
                          />
                      {newDiscussionFile && (
                        <div className="mb-3 flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted transition-colors group"
                          onClick={() => {
                            const url = URL.createObjectURL(newDiscussionFile);
                            setPreviewFile({ file: newDiscussionFile, url });
                          }}
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-sm flex-1 truncate">{newDiscussionFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clean up preview URL if it exists
                              if (previewFile && previewFile.file === newDiscussionFile) {
                                URL.revokeObjectURL(previewFile.url);
                                setPreviewFile(null);
                              }
                              setNewDiscussionFile(null);
                            }}
                          >
                            <XIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                          <div className="flex items-center space-x-2 mt-4 mb-4">
                            <Switch
                              id="anonymous-discussion"
                              checked={newDiscussionAnonymous}
                              onCheckedChange={setNewDiscussionAnonymous}
                            />
                            <Label 
                              htmlFor="anonymous-discussion" 
                              className="text-sm font-normal cursor-pointer"
                            >
                              Post anonymously
                            </Label>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleCreateDiscussion}
                              size="sm"
                              className="bg-home-primary hover:bg-home-primary-hover text-white shine-button relative overflow-hidden"
                              disabled={isUploadingDiscussionFile}
                            >
                              <span className="relative z-10 flex items-center">
                                <Send className="w-4 h-4 mr-1" />
                                {isUploadingDiscussionFile ? 'Uploading...' : 'Post'}
                              </span>
                            </Button>
                            <Button 
                              onClick={() => {
                                setShowNewDiscussion(false);
                                setNewDiscussionAnonymous(false);
                                // Clean up preview URL if it exists
                                if (previewFile) {
                                  URL.revokeObjectURL(previewFile.url);
                                  setPreviewFile(null);
                                }
                                setNewDiscussionFile(null);
                                setIsDraggingOverDiscussion(false);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </Card>
                  )}

                  <div className="space-y-4">
                    {discussions.length === 0 ? (
                      <p className="text-center py-8 text-gray-600 dark:text-gray-400">No discussions yet. Start one!</p>
                    ) : (
                      discussions.map((discussion) => {
                        const isExpanded = expandedDiscussions.has(discussion.id);
                        const discussionReplies = replies[discussion.id] || [];
                        const replyCount = replyCounts[discussion.id] || 0;
                        const showReply = showReplyInput[discussion.id];

                        return (
                          <Card 
                            key={discussion.id} 
                            className="p-4 hover:bg-accent transition-colors border border-border cursor-pointer"
                            onClick={() => handleDiscussionClick(discussion.id)}
                          >
                            <div className="flex gap-3">
                              {!discussion.is_anonymous ? (
                                <Avatar className="w-10 h-10">
                                  <AvatarImage src={discussion.profiles?.image_url || ''} />
                                  <AvatarFallback className="bg-home-primary text-white text-sm">
                                    {getUserInitials(discussion.profiles)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <Avatar className="w-10 h-10 bg-gray-400 dark:bg-gray-600">
                                  <AvatarFallback className="text-white text-sm">A</AvatarFallback>
                                </Avatar>
                              )}
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-home-foreground">
                                      {discussion.is_anonymous ? 'Anonymous' : `${discussion.profiles?.first_name} ${discussion.profiles?.last_name}`}
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-0.5 cursor-help">
                                            <MousePointerClick className="w-4 h-4" />
                                            {interactionCounts[discussion.id] || 0}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Tracks number of interactions on post</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  {user && discussion.user_id === user.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteDialogOpen({ type: 'discussion', id: discussion.id });
                                      }}
                                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                <h3 className="font-semibold text-home-foreground mb-1">{discussion.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-3">{discussion.content}</p>
                                {discussion.attachment_url && discussion.attachment_type && discussion.attachment_name && (
                                  <div className="mb-3">
                                    <FileViewer
                                      url={discussion.attachment_url}
                                      type={discussion.attachment_type}
                                      name={discussion.attachment_name}
                                    />
                                  </div>
                                )}
                                
                                {/* Reply, Expand, and Vote Controls */}
                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowReplyInput(prev => ({ ...prev, [discussion.id]: !showReply }));
                                    }}
                                    className="text-gray-600 dark:text-gray-400 hover:text-home-primary"
                                  >
                                    <Reply className="w-4 h-4 mr-1" />
                                    Reply
                                  </Button>
                                  
                                  {replyCount > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDiscussionExpansion(discussion.id);
                                      }}
                                      className="text-gray-600 dark:text-gray-400 hover:text-home-primary"
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="w-4 h-4 mr-1" />
                                          Hide {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-4 h-4 mr-1" />
                                          Show {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                                        </>
                                      )}
                                    </Button>
                                  )}

                                  {/* Vote Buttons */}
                                  <TooltipProvider>
                                    <div className="flex items-center gap-1 ml-auto">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDiscussionVote(discussion.id, 'upvote');
                                            }}
                                            className={`text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 ${
                                              discussionVotes[discussion.id]?.userVote === 'upvote' 
                                                ? 'text-green-600 dark:text-green-400' 
                                                : ''
                                            }`}
                                          >
                                            <ThumbsUp className={`w-4 h-4 mr-1 ${
                                              discussionVotes[discussion.id]?.userVote === 'upvote' 
                                                ? 'fill-green-600 dark:fill-green-400' 
                                                : ''
                                            }`} />
                                            {discussionVotes[discussion.id]?.upvotes || 0}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Upvote useful posts to add them to shared resources</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDiscussionVote(discussion.id, 'downvote');
                                            }}
                                            className={`text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ${
                                              discussionVotes[discussion.id]?.userVote === 'downvote' 
                                                ? 'text-red-600 dark:text-red-400' 
                                                : ''
                                            }`}
                                          >
                                            <ThumbsDown className={`w-4 h-4 mr-1 ${
                                              discussionVotes[discussion.id]?.userVote === 'downvote' 
                                                ? 'fill-red-600 dark:fill-red-400' 
                                                : ''
                                            }`} />
                                            {discussionVotes[discussion.id]?.downvotes || 0}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Downvote posts that aren't useful</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </div>

                                {/* Reply Input */}
                                {showReply && (
                                  <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                                    <Textarea
                                      placeholder="Write a reply..."
                                      value={replyContents[discussion.id] || ''}
                                      onChange={(e) => setReplyContents(prev => ({ ...prev, [discussion.id]: e.target.value }))}
                                      className="mb-2"
                                      rows={3}
                                    />
                                    {/* File Upload */}
                                    <div className="mb-2">
                                      <label className="block">
                                        <input
                                          type="file"
                                          accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              setReplyFiles(prev => ({ ...prev, [discussion.id]: file }));
                                            }
                                          }}
                                          className="hidden"
                                          id={`reply-file-input-${discussion.id}`}
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => document.getElementById(`reply-file-input-${discussion.id}`)?.click()}
                                          className="w-full"
                                        >
                                          <Upload className="w-4 h-4 mr-2" />
                                          {replyFiles[discussion.id] ? replyFiles[discussion.id]?.name : 'Attach File'}
                                        </Button>
                                      </label>
                                      {replyFiles[discussion.id] && (
                                        <div className="mt-2 flex items-center gap-2 p-2 bg-background rounded border">
                                          <FileText className="w-4 h-4" />
                                          <span className="text-sm flex-1 truncate">{replyFiles[discussion.id]?.name}</span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => setReplyFiles(prev => ({ ...prev, [discussion.id]: null }))}
                                          >
                                            <XIcon className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Switch
                                        id={`anonymous-reply-${discussion.id}`}
                                        checked={replyAnonymous[discussion.id] || false}
                                        onCheckedChange={(checked) => setReplyAnonymous(prev => ({ ...prev, [discussion.id]: checked }))}
                                      />
                                      <Label 
                                        htmlFor={`anonymous-reply-${discussion.id}`} 
                                        className="text-sm font-normal cursor-pointer"
                                      >
                                        Post anonymously
                                      </Label>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReplySubmit(discussion.id);
                                        }}
                                        size="sm"
                                        className="bg-home-primary hover:bg-home-primary-hover text-white"
                                        disabled={(!replyContents[discussion.id]?.trim() && !replyFiles[discussion.id]) || isUploadingReplyFile[discussion.id]}
                                      >
                                        <Send className="w-4 h-4 mr-1" />
                                        {isUploadingReplyFile[discussion.id] ? 'Uploading...' : 'Post Reply'}
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowReplyInput(prev => ({ ...prev, [discussion.id]: false }));
                                          setReplyContents(prev => ({ ...prev, [discussion.id]: '' }));
                                          setReplyAnonymous(prev => ({ ...prev, [discussion.id]: false }));
                                          setReplyFiles(prev => ({ ...prev, [discussion.id]: null }));
                                        }}
                                        size="sm"
                                        variant="outline"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Replies List */}
                                {isExpanded && discussionReplies.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                                    {discussionReplies.map((reply) => (
                                      <div key={reply.id} className="flex gap-3 pl-4 border-l-2 border-home-primary/20">
                                        {reply.is_anonymous !== true ? (
                                          <Avatar className="w-8 h-8">
                                            <AvatarImage src={reply.profiles?.image_url || ''} />
                                            <AvatarFallback className="bg-home-primary text-white text-xs">
                                              {getUserInitials(reply.profiles)}
                                            </AvatarFallback>
                                          </Avatar>
                                        ) : (
                                          <Avatar className="w-8 h-8 bg-gray-400 dark:bg-gray-600">
                                            <AvatarFallback className="text-white text-xs">A</AvatarFallback>
                                          </Avatar>
                                        )}
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-semibold text-home-foreground">
                                                {reply.is_anonymous === true ? 'Anonymous' : `${reply.profiles?.first_name} ${reply.profiles?.last_name}`}
                                              </span>
                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                              </span>
                                            </div>
                                            {user && reply.user_id === user.id && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeleteDialogOpen({ type: 'reply', id: reply.id, discussionId: discussion.id })}
                                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 h-6 px-2"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            )}
                                          </div>
                                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{reply.content}</p>
                                          {reply.attachment_url && reply.attachment_type && reply.attachment_name && (
                                            <div className="mt-2 mb-2">
                                              <FileViewer
                                                url={reply.attachment_url}
                                                type={reply.attachment_type}
                                                name={reply.attachment_name}
                                              />
                                            </div>
                                          )}
                                          {/* Vote Buttons */}
                                          <TooltipProvider>
                                            <div className="flex items-center gap-1 mt-2">
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleReplyVote(reply.id, 'upvote');
                                                    }}
                                                    className={`h-6 px-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 ${
                                                      replyVotes[reply.id]?.userVote === 'upvote' 
                                                        ? 'text-green-600 dark:text-green-400' 
                                                        : ''
                                                    }`}
                                                  >
                                                    <ThumbsUp className={`w-3 h-3 mr-1 ${
                                                      replyVotes[reply.id]?.userVote === 'upvote' 
                                                        ? 'fill-green-600 dark:fill-green-400' 
                                                        : ''
                                                    }`} />
                                                    {replyVotes[reply.id]?.upvotes || 0}
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Upvote helpful replies</p>
                                                </TooltipContent>
                                              </Tooltip>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleReplyVote(reply.id, 'downvote');
                                                    }}
                                                    className={`h-6 px-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ${
                                                      replyVotes[reply.id]?.userVote === 'downvote' 
                                                        ? 'text-red-600 dark:text-red-400' 
                                                        : ''
                                                    }`}
                                                  >
                                                    <ThumbsDown className={`w-3 h-3 mr-1 ${
                                                      replyVotes[reply.id]?.userVote === 'downvote' 
                                                        ? 'fill-red-600 dark:fill-red-400' 
                                                        : ''
                                                    }`} />
                                                    {replyVotes[reply.id]?.downvotes || 0}
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Downvote unhelpful replies</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                          </TooltipProvider>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </Card>

                {/* Shared Resources */}
                <Card className="p-6 bg-card border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-home-primary" />
                      <h2 className="text-xl font-bold text-home-foreground">Shared Resources</h2>
                    </div>
                    <Button 
                      onClick={() => setShowNewResource(!showNewResource)}
                      size="sm"
                      className="bg-home-primary hover:bg-home-primary-hover text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Resource
                    </Button>
                  </div>

                  {showNewResource && (
                    <Card className="p-4 mb-4 bg-gray-50 dark:bg-accent">
                      <Input
                        placeholder="Resource title..."
                        value={newResourceTitle}
                        onChange={(e) => setNewResourceTitle(e.target.value)}
                        className="mb-3"
                      />
                      <Input
                        placeholder="Resource URL..."
                        value={newResourceUrl}
                        onChange={(e) => setNewResourceUrl(e.target.value)}
                        className="mb-3"
                      />
                      <Textarea
                        placeholder="Description (optional)..."
                        value={newResourceDesc}
                        onChange={(e) => setNewResourceDesc(e.target.value)}
                        className="mb-3"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleAddResource}
                          size="sm"
                          className="bg-home-primary hover:bg-home-primary-hover text-white"
                        >
                          Add
                        </Button>
                        <Button 
                          onClick={() => setShowNewResource(false)}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-3">
                    {resources.length === 0 ? (
                      <p className="text-center py-8 text-gray-600 dark:text-gray-400">No resources yet. Add one!</p>
                    ) : (
                      resources.map((resource) => (
                        <Card key={resource.id} className="p-4 hover:bg-accent transition-colors border border-border">
                          <div className="flex gap-3">
                            <LinkIcon className="w-5 h-5 text-home-primary flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <h3 className="font-semibold text-home-foreground mb-1">{resource.title}</h3>
                              {resource.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{resource.description}</p>
                              )}
                              <a 
                                href={resource.resource_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-home-primary hover:underline"
                              >
                                {resource.resource_url}
                              </a>
                              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>
                                  Added by {resource.profiles?.first_name} {resource.profiles?.last_name}
                                </span>
                                <span>•</span>
                                <span>
                                  {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-12 text-center bg-card border border-border">
                <Users className="w-16 h-16 text-home-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-home-foreground mb-2">Join this community</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Join to participate in discussions and access shared resources</p>
                <Button onClick={handleJoinCommunity} className="bg-home-primary hover:bg-home-primary-hover text-white">
                  Join Community
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar - Active Users */}
          <div className="space-y-6">
            <Card className="p-6 bg-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-home-primary" />
                <h3 className="font-semibold text-home-foreground">Studying Now</h3>
                <Badge variant="secondary">{activeUsers.length}</Badge>
              </div>

              <div className="space-y-3">
                {activeUsers.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">No one is studying right now</p>
                ) : (
                  activeUsers.map((activeUser) => (
                    <div key={activeUser.user_id} className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={activeUser.profiles?.image_url || ''} />
                        <AvatarFallback className="bg-home-primary text-white text-xs">
                          {getUserInitials(activeUser.profiles)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-home-foreground truncate">
                          {activeUser.profiles?.first_name} {activeUser.profiles?.last_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Active {formatDistanceToNow(new Date(activeUser.last_seen), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialogOpen.type !== null} 
        onOpenChange={(open) => !open && setDeleteDialogOpen({ type: null, id: null, discussionId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialogOpen.type === 'discussion' ? 'Delete Discussion' : 'Delete Reply'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogOpen.type === 'discussion' 
                ? 'Are you sure you want to delete this discussion? This action cannot be undone and all replies will also be deleted.'
                : 'Are you sure you want to delete this reply? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialogOpen.type === 'discussion' && deleteDialogOpen.id) {
                  handleDeleteDiscussion(deleteDialogOpen.id);
                } else if (deleteDialogOpen.type === 'reply' && deleteDialogOpen.id && deleteDialogOpen.discussionId) {
                  handleDeleteReply(deleteDialogOpen.id, deleteDialogOpen.discussionId);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Expanded Discussion View Dialog */}
      <Dialog open={expandedDiscussionId !== null} onOpenChange={(open) => !open && setExpandedDiscussionId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {expandedDiscussionId && (() => {
            const discussion = discussions.find(d => d.id === expandedDiscussionId);
            if (!discussion) return null;
            
            const discussionReplies = replies[discussion.id] || [];
            const showReply = showReplyInput[discussion.id] || false;

            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <DialogTitle className="text-2xl mb-2">{discussion.title}</DialogTitle>
                      <div className="flex items-center gap-3 mt-2">
                        {!discussion.is_anonymous ? (
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={discussion.profiles?.image_url || ''} />
                            <AvatarFallback className="bg-home-primary text-white text-sm">
                              {getUserInitials(discussion.profiles)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="w-10 h-10 bg-gray-400 dark:bg-gray-600">
                            <AvatarFallback className="text-white text-sm">A</AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          <p className="font-semibold text-home-foreground">
                            {discussion.is_anonymous ? 'Anonymous' : `${discussion.profiles?.first_name} ${discussion.profiles?.last_name}`}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>
                              {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
                            </span>
                            <span>•</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-0.5 cursor-help">
                                    <MousePointerClick className="w-4 h-4" />
                                    {interactionCounts[discussion.id] || 0}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Tracks number of interactions on post</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        {user && discussion.user_id === user.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialogOpen({ type: 'discussion', id: discussion.id });
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="mt-4 space-y-6">
                  {/* Discussion Content */}
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{discussion.content}</p>
                    {discussion.attachment_url && discussion.attachment_type && discussion.attachment_name && (
                      <div className="mt-4">
                        <FileViewer
                          url={discussion.attachment_url}
                          type={discussion.attachment_type}
                          name={discussion.attachment_name}
                        />
                      </div>
                    )}
                  </div>

                  {/* Vote Buttons for Discussion */}
                  <TooltipProvider>
                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDiscussionVote(discussion.id, 'upvote');
                            }}
                            className={`text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 ${
                              discussionVotes[discussion.id]?.userVote === 'upvote' 
                                ? 'text-green-600 dark:text-green-400' 
                                : ''
                            }`}
                          >
                            <ThumbsUp className={`w-4 h-4 mr-1 ${
                              discussionVotes[discussion.id]?.userVote === 'upvote' 
                                ? 'fill-green-600 dark:fill-green-400' 
                                : ''
                            }`} />
                            {discussionVotes[discussion.id]?.upvotes || 0}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upvote useful posts to add them to shared resources</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDiscussionVote(discussion.id, 'downvote');
                            }}
                            className={`text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ${
                              discussionVotes[discussion.id]?.userVote === 'downvote' 
                                ? 'text-red-600 dark:text-red-400' 
                                : ''
                            }`}
                          >
                            <ThumbsDown className={`w-4 h-4 mr-1 ${
                              discussionVotes[discussion.id]?.userVote === 'downvote' 
                                ? 'fill-red-600 dark:fill-red-400' 
                                : ''
                            }`} />
                            {discussionVotes[discussion.id]?.downvotes || 0}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Downvote posts that aren't useful</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>

                  {/* Replies Section */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-home-foreground">
                        Replies ({discussionReplies.length})
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReplyInput(prev => ({ ...prev, [discussion.id]: !showReply }));
                        }}
                        className="text-home-primary hover:bg-home-primary/10"
                      >
                        <Reply className="w-4 h-4 mr-1" />
                        {showReply ? 'Cancel' : 'Reply'}
                      </Button>
                    </div>

                    {/* Reply Input */}
                    {showReply && (
                      <div className="mb-4 p-4 bg-gray-50 dark:bg-accent rounded-lg">
                        <Textarea
                          placeholder="Write a reply..."
                          value={replyContents[discussion.id] || ''}
                          onChange={(e) => setReplyContents(prev => ({ ...prev, [discussion.id]: e.target.value }))}
                          className="mb-2"
                          rows={4}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {/* File Upload */}
                        <div className="mb-2">
                          <label className="block">
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setReplyFiles(prev => ({ ...prev, [discussion.id]: file }));
                                }
                              }}
                              className="hidden"
                              id={`reply-file-input-dialog-${discussion.id}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById(`reply-file-input-dialog-${discussion.id}`)?.click()}
                              className="w-full"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {replyFiles[discussion.id] ? replyFiles[discussion.id]?.name : 'Attach File'}
                            </Button>
                          </label>
                          {replyFiles[discussion.id] && (
                            <div className="mt-2 flex items-center gap-2 p-2 bg-background rounded border">
                              <FileText className="w-4 h-4" />
                              <span className="text-sm flex-1 truncate">{replyFiles[discussion.id]?.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setReplyFiles(prev => ({ ...prev, [discussion.id]: null }))}
                              >
                                <XIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                          <Switch
                            id={`anonymous-reply-dialog-${discussion.id}`}
                            checked={replyAnonymous[discussion.id] || false}
                            onCheckedChange={(checked) => setReplyAnonymous(prev => ({ ...prev, [discussion.id]: checked }))}
                          />
                          <Label 
                            htmlFor={`anonymous-reply-dialog-${discussion.id}`} 
                            className="text-sm font-normal cursor-pointer"
                          >
                            Post anonymously
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplySubmit(discussion.id);
                            }}
                            size="sm"
                            className="bg-home-primary hover:bg-home-primary-hover text-white"
                            disabled={(!replyContents[discussion.id]?.trim() && !replyFiles[discussion.id]) || isUploadingReplyFile[discussion.id]}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            {isUploadingReplyFile[discussion.id] ? 'Uploading...' : 'Post Reply'}
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowReplyInput(prev => ({ ...prev, [discussion.id]: false }));
                              setReplyContents(prev => ({ ...prev, [discussion.id]: '' }));
                              setReplyAnonymous(prev => ({ ...prev, [discussion.id]: false }));
                            }}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Replies List */}
                    <div className="space-y-4">
                      {discussionReplies.length === 0 ? (
                        <p className="text-center py-8 text-gray-600 dark:text-gray-400">
                          No replies yet. Be the first to reply!
                        </p>
                      ) : (
                        discussionReplies.map((reply) => (
                          <div key={reply.id} className="flex gap-3 p-4 bg-gray-50 dark:bg-accent rounded-lg">
                            {reply.is_anonymous !== true ? (
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={reply.profiles?.image_url || ''} />
                                <AvatarFallback className="bg-home-primary text-white text-sm">
                                  {getUserInitials(reply.profiles)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <Avatar className="w-10 h-10 bg-gray-400 dark:bg-gray-600">
                                <AvatarFallback className="text-white text-sm">A</AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-home-foreground">
                                    {reply.is_anonymous === true ? 'Anonymous' : `${reply.profiles?.first_name} ${reply.profiles?.last_name}`}
                                  </span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                              {/* Vote Buttons */}
                                              <TooltipProvider>
                                                <div className="flex items-center gap-1">
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleReplyVote(reply.id, 'upvote');
                                                        }}
                                                        className={`h-6 px-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 ${
                                                          replyVotes[reply.id]?.userVote === 'upvote' 
                                                            ? 'text-green-600 dark:text-green-400' 
                                                            : ''
                                                        }`}
                                                      >
                                                        <ThumbsUp className={`w-3 h-3 mr-1 ${
                                                          replyVotes[reply.id]?.userVote === 'upvote' 
                                                            ? 'fill-green-600 dark:fill-green-400' 
                                                            : ''
                                                        }`} />
                                                        {replyVotes[reply.id]?.upvotes || 0}
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>Upvote helpful replies</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleReplyVote(reply.id, 'downvote');
                                                        }}
                                                        className={`h-6 px-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ${
                                                          replyVotes[reply.id]?.userVote === 'downvote' 
                                                            ? 'text-red-600 dark:text-red-400' 
                                                            : ''
                                                        }`}
                                                      >
                                                        <ThumbsDown className={`w-3 h-3 mr-1 ${
                                                          replyVotes[reply.id]?.userVote === 'downvote' 
                                                            ? 'fill-red-600 dark:fill-red-400' 
                                                            : ''
                                                        }`} />
                                                        {replyVotes[reply.id]?.downvotes || 0}
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>Downvote unhelpful replies</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </div>
                                              </TooltipProvider>
                                  {user && reply.user_id === user.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteDialogOpen({ type: 'reply', id: reply.id, discussionId: discussion.id });
                                      }}
                                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 h-6 px-2"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reply.content}</p>
                              {reply.attachment_url && reply.attachment_type && reply.attachment_name && (
                                <div className="mt-3">
                                  <FileViewer
                                    url={reply.attachment_url}
                                    type={reply.attachment_type}
                                    name={reply.attachment_name}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={(open) => {
          if (!open) {
            URL.revokeObjectURL(previewFile.url);
            setPreviewFile(null);
          }
        }}>
          <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-transparent border-none shadow-none [&>button]:hidden">
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {previewFile.file.type.startsWith('image/') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.file.name}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                />
              ) : previewFile.file.type === 'application/pdf' ? (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[90vh] rounded-lg shadow-2xl bg-white"
                  title={previewFile.file.name}
                />
              ) : (
                <div className="bg-background rounded-lg shadow-2xl p-8 max-w-2xl">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-full">
                      <FileText className="w-10 h-10 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">{previewFile.file.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Office Document preview not available
                      </p>
                      <Button onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewFile.url;
                        link.download = previewFile.file.name;
                        link.click();
                      }}>
                        <Download className="w-4 h-4 mr-2" />
                        Download File
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-6 right-6 bg-background/90 hover:bg-background text-foreground rounded-full shadow-lg"
                onClick={() => {
                  URL.revokeObjectURL(previewFile.url);
                  setPreviewFile(null);
                }}
                aria-label="Close viewer"
              >
                <XIcon className="h-5 w-5" />
              </Button>
              {previewFile.file.type !== 'application/msword' && 
               previewFile.file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
               previewFile.file.type !== 'application/vnd.ms-powerpoint' &&
               previewFile.file.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-6 right-16 bg-background/90 hover:bg-background text-foreground rounded-full shadow-lg"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewFile.url;
                    link.download = previewFile.file.name;
                    link.click();
                  }}
                  aria-label="Download file"
                >
                  <Download className="h-5 w-5" />
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CourseCommunity;

import { Button } from "@/components/ui/button";
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
  Download,
  Flag
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import SettingsModal from "@/components/SettingsModal";
import { FileViewer } from "@/components/FileViewer";
import NotificationDropdown from "@/components/NotificationDropdown";
import { moderateContent } from "@/lib/moderation";
import { useQueryClient } from "@tanstack/react-query";
import ReportIssueFooter from "@/components/ReportIssueFooter";
import { UserProfileModal } from "@/components/UserProfileModal";
import { ReportContentDialog } from "@/components/ReportContentDialog";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'plus' | 'pro';
  plan_expires_at?: string | null;
  profile_visible_in_communities?: boolean;
  is_under_review?: boolean;
}

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
  is_removed?: boolean;
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
  is_removed?: boolean;
  profiles: Profile;
}

interface Vote {
  id: string;
  vote_type: 'upvote' | 'downvote';
  user_id: string;
}


const CourseCommunity = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { communityId } = useParams();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionContent, setNewDiscussionContent] = useState("");
  const [newDiscussionAnonymous, setNewDiscussionAnonymous] = useState(false);
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newDiscussionFile, setNewDiscussionFile] = useState<File | null>(null);
  const [isUploadingDiscussionFile, setIsUploadingDiscussionFile] = useState(false);
  const [isModeratingDiscussion, setIsModeratingDiscussion] = useState(false);
  const [isDraggingOverDiscussion, setIsDraggingOverDiscussion] = useState(false);
  const dragCounterRef = useRef(0);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const [expandedDiscussions, setExpandedDiscussions] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [replyContents, setReplyContents] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});
  const [showReplyInput, setShowReplyInput] = useState<Record<string, boolean>>({});
  const [replyFiles, setReplyFiles] = useState<Record<string, File | null>>({});
  const [isUploadingReplyFile, setIsUploadingReplyFile] = useState<Record<string, boolean>>({});
  const [isModeratingReply, setIsModeratingReply] = useState<Record<string, boolean>>({});
  const [expandedDiscussionId, setExpandedDiscussionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{ 
    type: 'discussion' | 'reply' | null; 
    id: string | null;
    discussionId?: string | null;
  }>({ type: null, id: null, discussionId: null });
  const [discussionVotes, setDiscussionVotes] = useState<Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }>>({});
  const [replyVotes, setReplyVotes] = useState<Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }>>({});
  const [interactionCounts, setInteractionCounts] = useState<Record<string, number>>({});
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState<{ 
    contentType: 'post' | 'reply' | null;
    contentId: string | null;
  }>({ contentType: null, contentId: null });

  useEffect(() => {
    document.title = "MarkIt | Community";
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profileData && !error) {
        // No credentials exists, create one
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email!,
            first_name: session.user.user_metadata?.first_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            last_name: session.user.user_metadata?.last_name || '',
            image_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
          });

        if (!createError) {
          // Fetch the newly created profile
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(newProfile);
        }
      } else if (profileData) {
        setProfile(profileData);
      }
    };

    initializeUser();
  }, [navigate]);

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
      // Fetch community
      const { data: communityData } = await supabase
        .from('course_communities')
        .select('*')
        .eq('id', communityId)
        .single();

      if (communityData) {
        setCommunity(communityData);
      }

      // Check membership
      const { data: membershipData } = await supabase
        .from('community_memberships')
        .select('*')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsMember(!!membershipData);

      if (membershipData) {
        // Update presence
        await supabase
          .from('community_presence')
          .upsert({
            community_id: communityId,
            user_id: user.id,
            last_seen: new Date().toISOString()
          });

        // Fetch discussions (exclude removed ones)
        const { data: discussionsData } = await supabase
          .from('community_discussions')
          .select(`
            *,
            profiles:user_id (first_name, last_name, image_url, email, profile_visible_in_communities)
          `)
          .eq('community_id', communityId)
          .eq('is_removed', false)
          .order('created_at', { ascending: false });

        if (discussionsData) {
          setDiscussions(discussionsData as any);
          
          // Fetch reply counts for discussions (we'll fetch full replies when expanded)
          if (discussionsData.length > 0) {
            const discussionIds = discussionsData.map(d => d.id);
            
            // Fetch all replies and count them by discussion_id (exclude removed)
            const { data: repliesData } = await supabase
              .from('community_discussion_replies')
              .select('discussion_id')
              .in('discussion_id', discussionIds)
              .eq('is_removed', false);
            
            // Count replies per discussion
            const counts: Record<string, number> = {};
            discussionIds.forEach(id => {
              counts[id] = 0;
            });
            repliesData?.forEach((reply) => {
              counts[reply.discussion_id] = (counts[reply.discussion_id] || 0) + 1;
            });
            setReplyCounts(counts);

            // Fetch discussion votes
            if (user) {
              const { data: votesData } = await supabase
                .from('community_discussion_votes')
                .select('discussion_id, vote_type, user_id')
                .in('discussion_id', discussionIds);

              const votes: Record<string, { upvotes: number; downvotes: number; userVote: 'upvote' | 'downvote' | null }> = {};
              discussionIds.forEach(id => {
                votes[id] = { upvotes: 0, downvotes: 0, userVote: null };
              });

              votesData?.forEach((vote) => {
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
              setDiscussionVotes(votes);
            }

            // Fetch interaction counts
            const { data: interactionData } = await supabase
              .from('community_discussion_interactions')
              .select('discussion_id')
              .in('discussion_id', discussionIds);

            const interactionCountsMap: Record<string, number> = {};
            discussionIds.forEach(id => {
              interactionCountsMap[id] = 0;
            });
            interactionData?.forEach((interaction) => {
              interactionCountsMap[interaction.discussion_id] = (interactionCountsMap[interaction.discussion_id] || 0) + 1;
            });
            setInteractionCounts(interactionCountsMap);
          }
        }

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
  }, [communityId, user, isMember]);

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
      // Invalidate joined communities cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['joinedCommunities', user.id] });
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
      // Invalidate joined communities cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['joinedCommunities', user.id] });
      toast({
        title: "Success",
        description: "Left community successfully"
      });
      navigate('/communities');
    }
  };

  // Handle paste events to capture images in discussion textarea
  const handleDiscussionPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the pasted item is an image
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) return;
        
        // Validate file type
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Error",
            description: "Only image files (JPG, PNG, GIF, WEBP) can be pasted.",
            variant: "destructive"
          });
          return;
        }
        
        // Set the file for discussion
        setNewDiscussionFile(file);
        toast({
          title: "Image pasted",
          description: "Image ready to attach. Click Post to share.",
        });
        return;
      }
    }
  };

  const handleCreateDiscussion = async () => {
    // Check if user is under review
    if (profile?.is_under_review) {
      toast({
        title: "Posting Blocked",
        description: "You are currently under review for a post you made. Please wait for the review to complete before posting again.",
        variant: "destructive"
      });
      return;
    }

    // Validate required fields and show user-friendly error messages
    if (!user || !communityId) {
      // System-level validation - shouldn't happen in normal flow
      console.error('[handleCreateDiscussion] Validation failed: missing user or communityId');
      return;
    }
    
    const trimmedTitle = newDiscussionTitle?.trim() || '';
    const trimmedContent = newDiscussionContent?.trim() || '';
    
    if (!trimmedTitle || !trimmedContent) {
      const missingFields: string[] = [];
      if (!trimmedTitle) missingFields.push('title');
      if (!trimmedContent) missingFields.push('content');
      
      toast({
        title: "Missing Required Fields",
        description: `Please fill out the ${missingFields.join(' and ')} ${missingFields.length > 1 ? 'fields' : 'field'} before submitting your post.`,
        variant: "destructive"
      });
      return;
    }

    // Moderate content before submission (including images)
    const combinedText = `${trimmedTitle} ${trimmedContent}`;
    setIsModeratingDiscussion(true);
    try {
      // Only moderate image if it's an image file
      const imageFile = newDiscussionFile && newDiscussionFile.type.startsWith('image/') 
        ? newDiscussionFile 
        : null;
      
      const moderationResult = await moderateContent(combinedText, 'post', imageFile);
      
      if (moderationResult.blocked) {
        setIsModeratingDiscussion(false);
        toast({
          title: "Content Not Allowed",
          description: `Your post contains inappropriate content. ${moderationResult.reason ? `Reason: ${moderationResult.reason}. ` : ''}Please revise and try again.`,
          variant: "destructive"
        });
        return;
      }
    } finally {
      setIsModeratingDiscussion(false);
    }

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;

    // Upload file if present (only after moderation passes)
    if (newDiscussionFile) {
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
      title: trimmedTitle,
      content: trimmedContent,
      is_anonymous: newDiscussionAnonymous
    };

    // Only include attachment fields if we have an attachment
    if (attachmentUrl) {
      discussionData.attachment_url = attachmentUrl;
      discussionData.attachment_type = attachmentType;
      discussionData.attachment_name = attachmentName;
    }

    try {
      const insertResult = await supabase
        .from('community_discussions')
        .insert(discussionData)
        .select(`
          *,
          profiles:user_id (first_name, last_name, image_url, email, profile_visible_in_communities)
        `)
        .single();

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
          description: error.message || "Failed to create post",
          variant: "destructive"
        });
        return;
      }

      if (!newDiscussion) {
        console.error('[handleCreateDiscussion] No data returned from insert, but no error either');
        toast({
          title: "Error",
          description: "Failed to create post - no data returned",
          variant: "destructive"
        });
        return;
      }
      
      // Add the new discussion to the top of the list
      setDiscussions(prev => {
        const updated = [newDiscussion as any, ...prev];
        return updated;
      });
      
      // Initialize reply count for the new discussion
      setReplyCounts(prev => ({ ...prev, [newDiscussion.id]: 0 }));
      
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
      toast({
        title: "Success",
        description: "Post created!"
      });
    } catch (dbError) {
      console.error('[handleCreateDiscussion] Database insert exception:', dbError);
      console.error('[handleCreateDiscussion] Exception details:', {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
        fullError: JSON.stringify(dbError, Object.getOwnPropertyNames(dbError), 2)
      });
      toast({
        title: "Error",
        description: "Failed to create post",
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
      // Expand - fetch replies
      setExpandedDiscussions(prev => new Set(prev).add(discussionId));
      
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
          profiles:user_id (first_name, last_name, image_url, email, profile_visible_in_communities)
        `)
        .eq('discussion_id', discussionId)
        .order('created_at', { ascending: true });

      if (repliesData) {
        setReplies(prev => ({ ...prev, [discussionId]: repliesData as any }));
      }
    }
  };

  const handleDiscussionClick = async (discussionId: string) => {
    setExpandedDiscussionId(discussionId);
    
    // Track interaction when expanding discussion
    await trackInteraction(discussionId);
    
    // Fetch replies if not already loaded
    if (!replies[discussionId]) {
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
          profiles:user_id (first_name, last_name, image_url, email, profile_visible_in_communities)
        `)
        .eq('discussion_id', discussionId)
        .eq('is_removed', false)
        .order('created_at', { ascending: true });

      if (repliesData) {
        setReplies(prev => ({ ...prev, [discussionId]: repliesData as any }));
      }
    }
  };

  const handleReplySubmit = async (discussionId: string) => {
    // Check if user is under review
    if (profile?.is_under_review) {
      toast({
        title: "Posting Blocked",
        description: "You are currently under review for a post you made. Please wait for the review to complete before posting again.",
        variant: "destructive"
      });
      return;
    }

    const replyContent = replyContents[discussionId]?.trim();
    const isAnonymous = replyAnonymous[discussionId] || false;
    const replyFile = replyFiles[discussionId];
    if (!user || !discussionId || (!replyContent && !replyFile)) return;

    // Moderate content before submission (including images)
    const contentToModerate = replyContent || '';
    if (contentToModerate || replyFile) {
      setIsModeratingReply(prev => ({ ...prev, [discussionId]: true }));
      try {
        // Only moderate image if it's an image file
        const imageFile = replyFile && replyFile.type.startsWith('image/') 
          ? replyFile 
          : null;
        
        const moderationResult = await moderateContent(contentToModerate, 'reply', imageFile);
        
        if (moderationResult.blocked) {
          setIsModeratingReply(prev => ({ ...prev, [discussionId]: false }));
          toast({
            title: "Content Not Allowed",
            description: `Your reply contains inappropriate content. ${moderationResult.reason ? `Reason: ${moderationResult.reason}. ` : ''}Please revise and try again.`,
            variant: "destructive"
          });
          return;
        }
      } finally {
        setIsModeratingReply(prev => ({ ...prev, [discussionId]: false }));
      }
    }

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;

    // Upload file if present (only after moderation passes)
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
          profiles:user_id (first_name, last_name, image_url, email, profile_visible_in_communities)
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
          
          <div className="flex items-center gap-2">
            <NotificationDropdown user={user} profile={profile} />
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

      <div className="w-full py-8">
        <div className="max-w-5xl mx-auto px-4 space-y-8">
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
              {/* New Post Form */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-home-primary" />
                  <h2 className="text-2xl font-bold text-home-foreground">Community</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => window.location.reload()}
                    size="sm"
                    variant="outline"
                    className="border-gray-300 dark:border-border text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-accent"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                  <Button 
                    onClick={() => setShowNewDiscussion(!showNewDiscussion)}
                    size="sm"
                    className="bg-home-primary hover:bg-home-primary-hover text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Post
                  </Button>
                </div>
              </div>

              {showNewDiscussion && (
                <div 
                  className={`p-6 mb-8 bg-gray-50 dark:bg-accent rounded-lg border border-border transition-all ${
                    isDraggingOverDiscussion ? 'border-2 border-dashed border-home-primary bg-home-primary/5' : ''
                  } ${
                    isModeratingDiscussion || isUploadingDiscussionFile ? 'opacity-50 pointer-events-none' : ''
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
                          placeholder="Post title..."
                          value={newDiscussionTitle}
                          onChange={(e) => setNewDiscussionTitle(e.target.value)}
                          className="flex-[0.75]"
                          disabled={isModeratingDiscussion || isUploadingDiscussionFile}
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
                                  disabled={!!newDiscussionFile || isModeratingDiscussion || isUploadingDiscussionFile}
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
                                  disabled={!!newDiscussionFile || isModeratingDiscussion || isUploadingDiscussionFile}
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
                            placeholder="What would you like to discuss? (Paste images to attach)"
                            value={newDiscussionContent}
                            onChange={(e) => setNewDiscussionContent(e.target.value)}
                            onPaste={handleDiscussionPaste}
                            className="mb-3"
                            rows={4}
                            disabled={isModeratingDiscussion || isUploadingDiscussionFile}
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
                              disabled={isModeratingDiscussion || isUploadingDiscussionFile}
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
                              disabled={isUploadingDiscussionFile || isModeratingDiscussion}
                            >
                              <span className="relative z-10 flex items-center">
                                <Send className="w-4 h-4 mr-1" />
                                {isModeratingDiscussion ? 'Checking...' : isUploadingDiscussionFile ? 'Uploading...' : 'Post'}
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
                </div>
              )}

              {/* Discussions Feed */}
              <div className="space-y-6">
                {discussions.length === 0 ? (
                  <div className="text-center py-16">
                    <MessageSquare className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-xl text-gray-600 dark:text-gray-400">No posts yet. Start one!</p>
                  </div>
                ) : (
                  discussions.map((discussion) => {
                    const isExpanded = expandedDiscussions.has(discussion.id);
                    const discussionReplies = replies[discussion.id] || [];
                    const replyCount = replyCounts[discussion.id] || 0;
                    const showReply = showReplyInput[discussion.id];

                    return (
                      <div 
                        key={discussion.id} 
                        className="p-6 bg-card rounded-lg border border-border hover:border-home-primary/50 transition-all cursor-pointer"
                        onClick={() => handleDiscussionClick(discussion.id)}
                      >
                            <div className="flex gap-3">
                              {!discussion.is_anonymous ? (
                                <Avatar 
                                  className={`w-10 h-10 ${discussion.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:ring-2 hover:ring-home-primary/50' : ''} transition-all`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (discussion.profiles?.profile_visible_in_communities !== false) {
                                      setSelectedProfileUserId(discussion.user_id);
                                    }
                                  }}
                                >
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
                                    <span 
                                      className={`font-semibold text-home-foreground ${!discussion.is_anonymous && discussion.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:text-home-primary transition-colors' : ''}`}
                                      onClick={(e) => {
                                        if (!discussion.is_anonymous && discussion.profiles?.profile_visible_in_communities !== false) {
                                          e.stopPropagation();
                                          setSelectedProfileUserId(discussion.user_id);
                                        }
                                      }}
                                    >
                                      {discussion.is_anonymous 
                                        ? (user && discussion.user_id === user.id ? 'Anonymous (you)' : 'Anonymous')
                                        : `${discussion.profiles?.first_name} ${discussion.profiles?.last_name}`
                                      }
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
                                  {user && discussion.user_id !== user.id && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setReportDialogOpen({ contentType: 'post', contentId: discussion.id });
                                            }}
                                            className="text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                                          >
                                            <Flag className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Report this post</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
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
                                          <p>Upvote useful posts</p>
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
                                  <div className={`mt-3 pt-3 border-t border-border transition-opacity ${
                                    isModeratingReply[discussion.id] || isUploadingReplyFile[discussion.id] ? 'opacity-50 pointer-events-none' : ''
                                  }`} onClick={(e) => e.stopPropagation()}>
                                    <Textarea
                                      placeholder="Write a reply..."
                                      value={replyContents[discussion.id] || ''}
                                      onChange={(e) => setReplyContents(prev => ({ ...prev, [discussion.id]: e.target.value }))}
                                      className="mb-2"
                                      rows={3}
                                      disabled={isModeratingReply[discussion.id] || isUploadingReplyFile[discussion.id]}
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
                                          disabled={isModeratingReply[discussion.id] || isUploadingReplyFile[discussion.id]}
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => document.getElementById(`reply-file-input-${discussion.id}`)?.click()}
                                          className="w-full"
                                          disabled={isModeratingReply[discussion.id] || isUploadingReplyFile[discussion.id]}
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
                                        disabled={(!replyContents[discussion.id]?.trim() && !replyFiles[discussion.id]) || isUploadingReplyFile[discussion.id] || isModeratingReply[discussion.id]}
                                      >
                                        <Send className="w-4 h-4 mr-1" />
                                        {isModeratingReply[discussion.id] ? 'Checking...' : isUploadingReplyFile[discussion.id] ? 'Uploading...' : 'Post Reply'}
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
                                          <Avatar 
                                            className={`w-8 h-8 ${reply.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:ring-2 hover:ring-home-primary/50' : ''} transition-all`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (reply.profiles?.profile_visible_in_communities !== false) {
                                                setSelectedProfileUserId(reply.user_id);
                                              }
                                            }}
                                          >
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
                                              <span 
                                                className={`text-sm font-semibold text-home-foreground ${reply.is_anonymous !== true && reply.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:text-home-primary transition-colors' : ''}`}
                                                onClick={(e) => {
                                                  if (reply.is_anonymous !== true && reply.profiles?.profile_visible_in_communities !== false) {
                                                    e.stopPropagation();
                                                    setSelectedProfileUserId(reply.user_id);
                                                  }
                                                }}
                                              >
                                                {reply.is_anonymous === true 
                                                  ? (user && reply.user_id === user.id ? 'Anonymous (you)' : 'Anonymous')
                                                  : `${reply.profiles?.first_name} ${reply.profiles?.last_name}`
                                                }
                                              </span>
                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
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
                                              {user && reply.user_id !== user.id && (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setReportDialogOpen({ contentType: 'reply', contentId: reply.id });
                                                        }}
                                                        className="text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 h-6 px-2"
                                                      >
                                                        <Flag className="w-3 h-3" />
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>Report this reply</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              )}
                                            </div>
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
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center bg-card rounded-lg border border-border">
              <Users className="w-16 h-16 text-home-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-home-foreground mb-2">Join this community</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Join to participate in community discussions</p>
              <Button onClick={handleJoinCommunity} className="bg-home-primary hover:bg-home-primary-hover text-white">
                Join Community
              </Button>
            </div>
          )}
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <UserProfileModal
        isOpen={selectedProfileUserId !== null}
        onClose={() => setSelectedProfileUserId(null)}
        userId={selectedProfileUserId || ""}
        currentUserId={user?.id || null}
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
                          <Avatar 
                            className={`w-10 h-10 ${discussion.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:ring-2 hover:ring-home-primary/50' : ''} transition-all`}
                            onClick={() => {
                              if (discussion.profiles?.profile_visible_in_communities !== false) {
                                setSelectedProfileUserId(discussion.user_id);
                              }
                            }}
                          >
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
                          <p 
                            className={`font-semibold text-home-foreground ${!discussion.is_anonymous && discussion.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:text-home-primary transition-colors' : ''}`}
                            onClick={() => {
                              if (!discussion.is_anonymous && discussion.profiles?.profile_visible_in_communities !== false) {
                                setSelectedProfileUserId(discussion.user_id);
                              }
                            }}
                          >
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
                              <Avatar 
                                className={`w-10 h-10 ${reply.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:ring-2 hover:ring-home-primary/50' : ''} transition-all`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (reply.profiles?.profile_visible_in_communities !== false) {
                                    setSelectedProfileUserId(reply.user_id);
                                  }
                                }}
                              >
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
                                  <span 
                                    className={`font-semibold text-home-foreground ${reply.is_anonymous !== true && reply.profiles?.profile_visible_in_communities !== false ? 'cursor-pointer hover:text-home-primary transition-colors' : ''}`}
                                    onClick={(e) => {
                                      if (reply.is_anonymous !== true && reply.profiles?.profile_visible_in_communities !== false) {
                                        e.stopPropagation();
                                        setSelectedProfileUserId(reply.user_id);
                                      }
                                    }}
                                  >
                                    {reply.is_anonymous === true 
                                      ? (user && reply.user_id === user.id ? 'Anonymous (you)' : 'Anonymous')
                                      : `${reply.profiles?.first_name} ${reply.profiles?.last_name}`
                                    }
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
      <ReportIssueFooter />
      
      {/* Report Content Dialog */}
      <ReportContentDialog
        open={reportDialogOpen.contentType !== null && reportDialogOpen.contentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReportDialogOpen({ contentType: null, contentId: null });
          }
        }}
        contentType={reportDialogOpen.contentType || 'post'}
        contentId={reportDialogOpen.contentId || ''}
        onReportSubmitted={() => {
          // Refresh discussions/replies if needed
          if (communityId && user) {
            // Trigger a refresh of the data
            window.location.reload(); // Simple approach - could be optimized with state updates
          }
        }}
      />
    </div>
  );
};

export default CourseCommunity;

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  BookUp, 
  Users,
  MessageSquare,
  FileText,
  Send,
  Plus,
  ArrowLeft,
  Bell,
  Settings,
  Link as LinkIcon
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import SettingsModal from "@/components/SettingsModal";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
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
  profiles: Profile;
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
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionContent, setNewDiscussionContent] = useState("");
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newResourceDesc, setNewResourceDesc] = useState("");
  const [showNewResource, setShowNewResource] = useState(false);

  useEffect(() => {
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
        .eq('clerk_user_id', session.user.id)
        .maybeSingle();

      if (!profileData && !error) {
        // No credentials exists, create one
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            clerk_user_id: session.user.id,
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
            .eq('clerk_user_id', session.user.id)
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

        // Fetch discussions
        const { data: discussionsData } = await supabase
          .from('community_discussions')
          .select(`
            *,
            profiles:user_id (first_name, last_name, image_url, email)
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false });

        if (discussionsData) {
          setDiscussions(discussionsData as any);
        }

        // Fetch resources
        const { data: resourcesData } = await supabase
          .from('community_resources')
          .select(`
            *,
            profiles:user_id (first_name, last_name, image_url, email)
          `)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false });

        if (resourcesData) {
          setResources(resourcesData as any);
        }

        // Fetch active users (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: activeUsersData } = await supabase
          .from('community_presence')
          .select(`
            user_id,
            last_seen,
            profiles:user_id (first_name, last_name, image_url, email)
          `)
          .eq('community_id', communityId)
          .gte('last_seen', fiveMinutesAgo)
          .neq('user_id', user.id);

        if (activeUsersData) {
          setActiveUsers(activeUsersData as any);
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
    if (!user || !communityId || !newDiscussionTitle || !newDiscussionContent) return;

    const { error } = await supabase
      .from('community_discussions')
      .insert({
        community_id: communityId,
        user_id: user.id,
        title: newDiscussionTitle,
        content: newDiscussionContent
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create discussion",
        variant: "destructive"
      });
    } else {
      setNewDiscussionTitle("");
      setNewDiscussionContent("");
      setShowNewDiscussion(false);
      toast({
        title: "Success",
        description: "Discussion created!"
      });
      // Refresh discussions
      window.location.reload();
    }
  };

  const handleAddResource = async () => {
    if (!user || !communityId || !newResourceTitle || !newResourceUrl) return;

    const { error } = await supabase
      .from('community_resources')
      .insert({
        community_id: communityId,
        user_id: user.id,
        title: newResourceTitle,
        description: newResourceDesc,
        resource_url: newResourceUrl
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add resource",
        variant: "destructive"
      });
    } else {
      setNewResourceTitle("");
      setNewResourceUrl("");
      setNewResourceDesc("");
      setShowNewResource(false);
      toast({
        title: "Success",
        description: "Resource added!"
      });
      // Refresh resources
      window.location.reload();
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

  if (!community) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-1">
              <div className="w-8 h-8 flex items-center justify-center">
                <BookUp className="w-5 h-5 text-home-primary " />
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
            <Button variant="ghost" size="icon" className="text-home-foreground hover:bg-home-surface">
              <Bell className="w-5 h-5" />
            </Button>
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
                  <p className="text-gray-600">{community.description}</p>
                  <Badge className="mt-2">{community.course_category}</Badge>
                </div>
              </div>
              {!isMember ? (
                <Button onClick={handleJoinCommunity} className="bg-home-primary hover:bg-home-primary-hover text-white">
                  Join Community
                </Button>
              ) : (
                <Button onClick={handleLeaveCommunity} variant="outline" className="border-red-500 text-red-600 hover:bg-red-50">
                  Leave Community
                </Button>
              )}
            </div>

            {isMember ? (
              <>
                {/* Discussions Feed */}
                <Card className="p-6 bg-white border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-home-primary" />
                      <h2 className="text-xl font-bold text-home-foreground">Discussions</h2>
                    </div>
                    <Button 
                      onClick={() => setShowNewDiscussion(!showNewDiscussion)}
                      size="sm"
                      className="bg-home-primary hover:bg-home-primary-hover text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      New Discussion
                    </Button>
                  </div>

                  {showNewDiscussion && (
                    <Card className="p-4 mb-4 bg-gray-50">
                      <Input
                        placeholder="Discussion title..."
                        value={newDiscussionTitle}
                        onChange={(e) => setNewDiscussionTitle(e.target.value)}
                        className="mb-3"
                      />
                      <Textarea
                        placeholder="What would you like to discuss?"
                        value={newDiscussionContent}
                        onChange={(e) => setNewDiscussionContent(e.target.value)}
                        className="mb-3"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleCreateDiscussion}
                          size="sm"
                          className="bg-home-primary hover:bg-home-primary-hover text-white"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Post
                        </Button>
                        <Button 
                          onClick={() => setShowNewDiscussion(false)}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {discussions.length === 0 ? (
                      <p className="text-center py-8 text-gray-600">No discussions yet. Start one!</p>
                    ) : (
                      discussions.map((discussion) => (
                        <Card key={discussion.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={discussion.profiles?.image_url || ''} />
                              <AvatarFallback className="bg-home-primary text-white text-sm">
                                {getUserInitials(discussion.profiles)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-home-foreground">
                                  {discussion.profiles?.first_name} {discussion.profiles?.last_name}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <h3 className="font-semibold text-home-foreground mb-1">{discussion.title}</h3>
                              <p className="text-gray-600">{discussion.content}</p>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </Card>

                {/* Shared Resources */}
                <Card className="p-6 bg-white border border-gray-200">
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
                    <Card className="p-4 mb-4 bg-gray-50">
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
                      <p className="text-center py-8 text-gray-600">No resources yet. Add one!</p>
                    ) : (
                      resources.map((resource) => (
                        <Card key={resource.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex gap-3">
                            <LinkIcon className="w-5 h-5 text-home-primary flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <h3 className="font-semibold text-home-foreground mb-1">{resource.title}</h3>
                              {resource.description && (
                                <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                              )}
                              <a 
                                href={resource.resource_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-home-primary hover:underline"
                              >
                                {resource.resource_url}
                              </a>
                              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
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
              <Card className="p-12 text-center bg-white border border-gray-200">
                <Users className="w-16 h-16 text-home-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-home-foreground mb-2">Join this community</h2>
                <p className="text-gray-600 mb-6">Join to participate in discussions and access shared resources</p>
                <Button onClick={handleJoinCommunity} className="bg-home-primary hover:bg-home-primary-hover text-white">
                  Join Community
                </Button>
              </Card>
            )}
          </div>

          {/* Sidebar - Active Users */}
          <div className="space-y-6">
            <Card className="p-6 bg-white border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-home-primary" />
                <h3 className="font-semibold text-home-foreground">Studying Now</h3>
                <Badge variant="secondary">{activeUsers.length}</Badge>
              </div>

              <div className="space-y-3">
                {activeUsers.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">No one is studying right now</p>
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
                        <p className="text-xs text-gray-500">
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
    </div>
  );
};

export default CourseCommunity;

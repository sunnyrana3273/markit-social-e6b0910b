import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, Loader2, UserCheck } from "lucide-react";

interface Profile {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
}

interface FavoriteCommunity {
  id: string;
  course_name: string;
  course_category: string;
}

interface MutualFriend {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUserId: string | null;
}

export const UserProfileModal = ({
  isOpen,
  onClose,
  userId,
  currentUserId,
}: UserProfileModalProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favoriteCommunity, setFavoriteCommunity] = useState<FavoriteCommunity | null>(null);
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);
  const [isFriend, setIsFriend] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchProfileData = async () => {
      setIsLoading(true);
      try {
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, first_name, last_name, image_url, email")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          return;
        }

        setProfile(profileData);

        // Check if users are friends
        if (currentUserId && currentUserId !== userId) {
          // Check both directions of the friendship
          const { data: friendshipData1 } = await supabase
            .from("friends")
            .select("status")
            .eq("user_id", currentUserId)
            .eq("friend_id", userId)
            .eq("status", "accepted")
            .maybeSingle();

          const { data: friendshipData2 } = await supabase
            .from("friends")
            .select("status")
            .eq("user_id", userId)
            .eq("friend_id", currentUserId)
            .eq("status", "accepted")
            .maybeSingle();

          setIsFriend(!!(friendshipData1 || friendshipData2));
        } else {
          setIsFriend(false);
        }

        // Fetch first community the user joined (this is their favorite community)
        const { data: firstMembership, error: membershipError } = await supabase
          .from("community_memberships")
          .select("community_id")
          .eq("user_id", userId)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!membershipError && firstMembership?.community_id) {
          const { data: communityData, error: communityError } = await supabase
            .from("course_communities")
            .select("id, course_name, course_category")
            .eq("id", firstMembership.community_id)
            .single();

          if (!communityError && communityData) {
            setFavoriteCommunity(communityData);
          }
        }

        // Fetch mutual friends
        if (currentUserId && currentUserId !== userId) {
          // Get current user's friends
          const { data: currentUserFriends, error: currentUserFriendsError } = await supabase
            .from("friends")
            .select("friend_id, user_id")
            .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
            .eq("status", "accepted");

          if (!currentUserFriendsError && currentUserFriends) {
            const currentUserFriendIds = new Set(
              currentUserFriends.map((f) =>
                f.user_id === currentUserId ? f.friend_id : f.user_id
              )
            );

            // Get viewed user's friends
            const { data: viewedUserFriends, error: viewedUserFriendsError } = await supabase
              .from("friends")
              .select("friend_id, user_id")
              .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
              .eq("status", "accepted");

            if (!viewedUserFriendsError && viewedUserFriends) {
              const viewedUserFriendIds = new Set(
                viewedUserFriends.map((f) =>
                  f.user_id === userId ? f.friend_id : f.user_id
                )
              );

              // Find mutual friends
              const mutualFriendIds = Array.from(currentUserFriendIds).filter((id) =>
                viewedUserFriendIds.has(id)
              );

              if (mutualFriendIds.length > 0) {
                const { data: mutualFriendsData, error: mutualFriendsError } = await supabase
                  .from("profiles")
                  .select("id, username, first_name, last_name, image_url")
                  .in("id", mutualFriendIds)
                  .limit(10);

                if (!mutualFriendsError && mutualFriendsData) {
                  setMutualFriends(mutualFriendsData);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [isOpen, userId, currentUserId]);

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.first_name) {
      return profile.first_name;
    }
    if (profile?.username) {
      return profile.username;
    }
    return profile?.email?.split("@")[0] || "User";
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.first_name) {
      return profile.first_name[0].toUpperCase();
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-home-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.image_url || ""} />
                <AvatarFallback className="bg-home-primary text-white text-lg">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-home-foreground">
                    {getDisplayName()}
                  </h3>
                  {currentUserId && currentUserId !== userId && isFriend && (
                    <Badge variant="default" className="bg-home-primary text-white">
                      <UserCheck className="w-3 h-3 mr-1" />
                      Friend
                    </Badge>
                  )}
                </div>
                {profile?.username && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Username: {profile.username}
                  </p>
                )}
              </div>
            </div>

            {/* Favorite Community */}
            <div className="space-y-2 pt-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-home-primary" />
                <h4 className="font-medium text-home-foreground">Favorite Community</h4>
              </div>
              {favoriteCommunity ? (
                <div className="pl-6">
                  <p className="text-sm font-medium text-home-foreground">
                    {favoriteCommunity.course_name}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {favoriteCommunity.course_category}
                  </Badge>
                </div>
              ) : (
                <p className="pl-6 text-sm text-gray-500 dark:text-gray-400">
                  No favorite community set
                </p>
              )}
            </div>

            {/* Mutual Friends */}
            {currentUserId && currentUserId !== userId && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-home-primary" />
                  <h4 className="font-medium text-home-foreground">
                    Mutual Friends
                  </h4>
                  {mutualFriends.length > 0 && (
                    <Badge variant="secondary">{mutualFriends.length}</Badge>
                  )}
                </div>
                {mutualFriends.length > 0 ? (
                  <div className="pl-6 space-y-2">
                    {mutualFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={friend.image_url || ""} />
                          <AvatarFallback className="bg-home-primary/10 text-home-primary text-xs">
                            {friend.first_name?.[0] || friend.username?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-home-foreground">
                          {friend.username ||
                            `${friend.first_name || ""} ${friend.last_name || ""}`.trim() ||
                            "User"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pl-6 text-sm text-gray-500 dark:text-gray-400">
                    No mutual friends
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};


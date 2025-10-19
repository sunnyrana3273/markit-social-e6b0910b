import React, { useState, useEffect } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MessageSquare, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';

interface Friend {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
  lastMessageTime?: string;
}

const DocumentEditor: React.FC = () => {
  const navigate = useNavigate();
  const { fileId } = useParams();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [isPdf, setIsPdf] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showFriends, setShowFriends] = useState(true);
  const [isPdfScrollerMinimized, setIsPdfScrollerMinimized] = useState(false);

  // Load PDF if the file is a PDF
  useEffect(() => {
    const loadPdf = async () => {
      if (!fileId) {
        setLoading(false);
        return;
      }

      try {
        // Get file metadata
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: fileData, error: fileError } = await supabase
          .from('uploaded_files')
          .select('*')
          .eq('id', fileId)
          .eq('clerk_user_id', session.user.id)
          .single();

        if (fileError) throw fileError;

        // Check if it's a PDF
        if (fileData.file_type === 'application/pdf') {
          setIsPdf(true);

          // Set PDF.js worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';

          // Download and load PDF
          const { data: pdfData, error: downloadError } = await supabase.storage
            .from('user-uploads')
            .download(fileData.file_path);

          if (downloadError) throw downloadError;

          const arrayBuffer = await pdfData.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

          const pages: string[] = [];
          const numPages = pdf.numPages;

          // Render each page as thumbnail
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 0.3; // Thumbnail scale
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            pages.push(canvas.toDataURL('image/png'));
          }

          setPdfPages(pages);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [fileId]);

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('🔍 No session found');
          return;
        }

        console.log('🔍 Loading friends for user:', session.user.id);

        // Fetch friends from friends table (matching Friends.tsx pattern)
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', session.user.id)
          .eq('status', 'accepted')
          .limit(5);

        console.log('🔍 Friends query result:', { friendsData, friendsError });

        if (friendsError) {
          console.error('❌ Error fetching friends:', friendsError);
          return;
        }

        if (!friendsData || friendsData.length === 0) {
          console.log('⚠️ No friends found');
          return;
        }

        console.log('✅ Found friends:', friendsData.length);

        // Get friend IDs
        const friendIds = friendsData.map((friend) => friend.friend_id);

        console.log('🔍 Friend IDs to fetch:', friendIds);

        // Fetch friend profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, image_url, email')
          .in('id', friendIds);

        console.log('🔍 Profiles query result:', { profilesData, profilesError });

        if (profilesError) {
          console.error('❌ Error fetching profiles:', profilesError);
          return;
        }

        console.log('✅ Setting friends:', profilesData?.length || 0);
        setFriends(profilesData || []);
      } catch (error) {
        console.error('❌ Error loading friends:', error);
      }
    };

    loadFriends();
  }, []);

  // Create initial blank scene
  const initialData = {
    elements: [],
    appState: {
      collaborators: [],
      currentItemStrokeColor: '#000000',
      currentItemBackgroundColor: 'transparent',
      currentItemFillStyle: 'solid',
      currentItemStrokeWidth: 1,
      currentItemStrokeStyle: 'solid',
      currentItemRoughness: 1,
      currentItemOpacity: 100,
      currentItemFontFamily: 1,
      currentItemFontSize: 20,
      currentItemTextAlign: 'left',
      currentItemStartArrowhead: null,
      currentItemEndArrowhead: 'arrow',
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      currentItemRoundness: 'legacy',
      gridSize: null,
      colorPalette: {}
    },
    files: {}
  };

  // Calculate visible pages (show 5 at a time, or all if less than 5)
  const maxVisible = Math.min(5, pdfPages.length);
  const visiblePages = pdfPages.slice(scrollPosition, scrollPosition + maxVisible);
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition + maxVisible < pdfPages.length;

  const handleScrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 1));
  };

  const handleScrollRight = () => {
    setScrollPosition(Math.min(pdfPages.length - maxVisible, scrollPosition + 1));
  };

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

  return (
    <div className="relative w-screen h-screen">
      {/* Back button overlay */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="outline"
          onClick={() => navigate('/app')}
          size="sm"
          className="bg-white shadow-md"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Friends List Overlay */}
      {showFriends && (
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 w-64">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-home-primary" />
                <h3 className="text-sm font-semibold text-gray-900">Friends</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFriends(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {/* Friends List */}
            <div className="p-2 max-h-80 overflow-y-auto">
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
                    onClick={() => navigate('/friends')}
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={friend.image_url || undefined} alt={getDisplayName(friend)} />
                      <AvatarFallback className="bg-home-primary text-white text-xs">
                        {getInitials(friend)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getDisplayName(friend)}
                      </p>
                      <p className="text-xs text-gray-500">Click to message</p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-gray-400 group-hover:text-home-primary transition-colors" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No friends yet</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate('/friends')}
                    className="text-home-primary mt-2"
                  >
                    Find friends
                  </Button>
                </div>
              )}
            </div>

            {/* View All Button */}
            {friends.length > 0 && (
              <div className="p-2 border-t border-gray-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/friends')}
                  className="w-full text-home-primary hover:bg-home-primary/10"
                >
                  View all friends
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle Friends Button when hidden */}
      {!showFriends && (
        <div className="absolute top-4 right-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFriends(true)}
            className="bg-white shadow-md"
          >
            <Users className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* PDF Page Scroller Overlay */}
      {isPdf && pdfPages.length > 0 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          {isPdfScrollerMinimized ? (
            // Minimized state - compact button
            <Button
              variant="outline"
              onClick={() => setIsPdfScrollerMinimized(false)}
              className="bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200 hover:bg-white"
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              Select from {pdfPages.length} {pdfPages.length === 1 ? 'page' : 'pages'}
            </Button>
          ) : (
            // Expanded state - full scroller
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-3 border border-gray-200">
              <div className="flex items-center gap-2">
                {/* Left scroll button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleScrollLeft}
                  disabled={!canScrollLeft}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                {/* PDF Page Thumbnails */}
                <div className="flex gap-2 items-center">
                  {visiblePages.map((pageDataUrl, index) => (
                    <div
                      key={scrollPosition + index}
                      className="relative group cursor-pointer hover:scale-105 transition-transform"
                    >
                      <img
                        src={pageDataUrl}
                        alt={`Page ${scrollPosition + index + 1}`}
                        className="h-24 w-auto rounded border-2 border-gray-300 shadow-sm"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-1 rounded-b">
                        Page {scrollPosition + index + 1}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right scroll button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleScrollRight}
                  disabled={!canScrollRight}
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>

                {/* Minimize button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPdfScrollerMinimized(true)}
                  className="h-8 w-8 ml-2"
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full page Excalidraw */}
      <div style={{ width: "100%", height: "100%" }}>
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
        />
      </div>
    </div>
  );
};

export default DocumentEditor;


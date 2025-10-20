import React, { useState, useEffect } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MessageSquare, Users, Send, Command, Move, UserPlus, RadioTower, Timer } from 'lucide-react';
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
  const [pdfPages, setPdfPages] = useState<string[]>([]); // Thumbnails for display
  const [pdfFullPages, setPdfFullPages] = useState<string[]>([]); // Full-res for canvas insertion
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ width: number; height: number }[]>([]);
  const [isPdf, setIsPdf] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showFriends, setShowFriends] = useState(true);
  const [isPdfScrollerMinimized, setIsPdfScrollerMinimized] = useState(false);
  const [showChatInput, setShowChatInput] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [chatPosition, setChatPosition] = useState({ x: 50, y: window.innerHeight - 120 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Timer state
  const [totalStudyTime, setTotalStudyTime] = useState(0); // in seconds
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [isTimerMinimized, setIsTimerMinimized] = useState(false);

  // Load saved timer data on component mount
  useEffect(() => {
    const savedTime = localStorage.getItem(`studyTime_${fileId}`);
    
    if (savedTime) {
      setTotalStudyTime(parseInt(savedTime));
    }
    
    // Always start a fresh session when entering the whiteboard
    const now = Date.now();
    setSessionStartTime(now);
    setLastActivityTime(now);
    setIsTimerActive(true);
    localStorage.setItem(`sessionStart_${fileId}`, now.toString());
  }, [fileId]);

  // Cleanup when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      // Save current progress when leaving the whiteboard
      if (sessionStartTime && isTimerActive) {
        const now = Date.now();
        const sessionTime = Math.floor((now - sessionStartTime) / 1000);
        const currentTotal = totalStudyTime + sessionTime;
        localStorage.setItem(`studyTime_${fileId}`, currentTotal.toString());
      }
    };
  }, [sessionStartTime, isTimerActive, totalStudyTime, fileId]);

  // Activity tracking and timer logic
  useEffect(() => {
    const activityTimeout = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;
      
      // If no activity for 2 minutes (120000ms), pause timer
      if (timeSinceActivity >= 120000 && isTimerActive) {
        setIsTimerActive(false);
        console.log('Timer paused due to inactivity');
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(activityTimeout);
  }, [lastActivityTime, isTimerActive]);

  // Update timer every second
  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (isTimerActive && sessionStartTime) {
        const now = Date.now();
        const sessionTime = Math.floor((now - sessionStartTime) / 1000);
        
        // Update display time (but don't save to total until session ends)
        setTotalStudyTime(totalStudyTime + sessionTime);
        setSessionStartTime(now);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isTimerActive, sessionStartTime, totalStudyTime, fileId]);

  // Track user activity
  const updateActivity = () => {
    const now = Date.now();
    setLastActivityTime(now);
    
    // Resume timer if it was paused
    if (!isTimerActive) {
      setIsTimerActive(true);
      setSessionStartTime(now);
      console.log('Timer resumed due to activity');
    }
  };

  // Add activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [isTimerActive, fileId]);

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
          const fullPages: string[] = [];
          const dimensions: { width: number; height: number }[] = [];
          const numPages = pdf.numPages;

          // Render each page in both thumbnail and full resolution
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 0.3; // Thumbnail scale
            const fullScale = 1.5; // Scale for actual canvas insertion
            const viewport = page.getViewport({ scale });
            const fullViewport = page.getViewport({ scale: fullScale });

            // Store actual dimensions for canvas insertion
            dimensions.push({
              width: fullViewport.width,
              height: fullViewport.height
            });

            // Render thumbnail
            const thumbCanvas = document.createElement('canvas');
            const thumbContext = thumbCanvas.getContext('2d');
            if (thumbContext) {
              thumbCanvas.height = viewport.height;
              thumbCanvas.width = viewport.width;
              await page.render({
                canvasContext: thumbContext,
                viewport: viewport,
              }).promise;
              pages.push(thumbCanvas.toDataURL('image/png'));
            }

            // Render full resolution
            const fullCanvas = document.createElement('canvas');
            const fullContext = fullCanvas.getContext('2d');
            if (fullContext) {
              fullCanvas.height = fullViewport.height;
              fullCanvas.width = fullViewport.width;
              await page.render({
                canvasContext: fullContext,
                viewport: fullViewport,
              }).promise;
              fullPages.push(fullCanvas.toDataURL('image/png'));
            }
          }

          setPdfPages(pages);
          setPdfFullPages(fullPages);
          setPdfPageDimensions(dimensions);
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

  const handlePageClick = (pageIndex: number) => {
    if (!excalidrawAPI) return;

    // Get the full-resolution page and dimensions
    const pageDataUrl = pdfFullPages[pageIndex];
    if (!pageDataUrl) {
      console.error('No full-res page data for index:', pageIndex);
      return;
    }

    const pageDimensions = pdfPageDimensions[pageIndex] || { width: 400, height: 500 };

    // Get current viewport state
    const appState = excalidrawAPI.getAppState();
    const { scrollX, scrollY, zoom } = appState;

    // Calculate position at center of current viewport
    // Account for zoom and scroll to place image in visible area
    const viewportCenterX = -scrollX + (appState.width / 2) / zoom.value;
    const viewportCenterY = -scrollY + (appState.height / 2) / zoom.value;

    // Center the image based on actual dimensions
    const imageX = viewportCenterX - (pageDimensions.width / 2);
    const imageY = viewportCenterY - (pageDimensions.height / 2);

    // Create image element for the clicked page
    const newElement = {
      type: "image",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      id: `page-${pageIndex}-${Date.now()}`,
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: imageX,
      y: imageY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      width: pageDimensions.width,
      height: pageDimensions.height,
      seed: Math.floor(Math.random() * 1000000),
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      status: "saved",
      fileId: `file-page-${pageIndex}-${Date.now()}`,
      scale: [1, 1],
    };

    // Add the file to Excalidraw
    const fileId = newElement.fileId;
    excalidrawAPI.addFiles([{
      id: fileId,
      dataURL: pageDataUrl,
      mimeType: 'image/png',
      created: Date.now(),
    }]);

    // Add the element to the canvas
    const currentElements = excalidrawAPI.getSceneElements();
    excalidrawAPI.updateScene({
      elements: [...currentElements, newElement],
    });

    console.log(`📄 Added page ${pageIndex + 1} to canvas at position:`, {
      x: newElement.x,
      y: newElement.y,
      viewportCenter: { x: viewportCenterX, y: viewportCenterY }
    });
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

  // Handle chat input drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
    
    // Calculate the offset from the mouse position to the component's top-left corner
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    setChatPosition({
      x: Math.max(0, Math.min(window.innerWidth - 320, newX)), // 320px is approximate component width
      y: Math.max(0, Math.min(window.innerHeight - 80, newY))   // 80px is approximate component height
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Handle Command + I keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setShowChatInput(!showChatInput);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChatInput]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      console.log('Chat message:', chatInput);
      // Here you would typically send the message
      setChatInput('');
    }
  };

  const handleInviteFriend = (friend: Friend) => {
    console.log(`Nudging ${getDisplayName(friend)} to join study session`);
    // Here you would typically send a notification/invitation
    // Could integrate with push notifications, email, or in-app notifications
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
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
        <div className="absolute top-16 left-4 z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 w-64">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-home-primary" />
                <h3 className="text-sm font-semibold text-gray-900">Invite Friends</h3>
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
                      onClick={() => handleInviteFriend(friend)}
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
                        <p className="text-xs text-gray-500">Nudge to join session</p>
                      </div>
                      <RadioTower className="w-4 h-4 text-gray-400 group-hover:text-home-primary transition-colors" />
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No friends to invite</p>
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

            {/* Toggle Chat Input Button */}
            <div className="absolute top-4 right-4 z-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChatInput(!showChatInput)}
                className={`bg-white shadow-md ${showChatInput ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>

            {/* Toggle Friends Button when hidden */}
            {!showFriends && (
              <div className="absolute top-16 left-4 z-50">
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

      {/* Movable Chat Input */}
      {showChatInput && (
        <div
          className="fixed z-50"
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleChatSubmit} className="flex items-center">
            <div className="relative bg-gray-900 border border-gray-700 rounded-full px-4 py-3 flex items-center gap-3 shadow-lg min-w-80">
              {/* Draggable handle area - left side */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-8 cursor-grab active:cursor-grabbing flex items-center justify-center"
                onMouseDown={handleMouseDown}
              >
                <Move className="w-4 h-4 text-gray-400" />
              </div>
              
              {/* Input field */}
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question..."
                className="bg-transparent text-gray-200 placeholder-gray-400 flex-1 outline-none text-sm ml-8"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              
              {/* Command key icon */}
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Command className="w-3 h-3" />
                <span>+ I</span>
              </div>
              
              {/* Send button */}
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                disabled={!chatInput.trim()}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
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
                  {visiblePages.map((pageDataUrl, index) => {
                    const actualPageIndex = scrollPosition + index;
                    return (
                      <div
                        key={actualPageIndex}
                        className="relative group cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => handlePageClick(actualPageIndex)}
                        title={`Click to add page ${actualPageIndex + 1} to canvas`}
                      >
                        <img
                          src={pageDataUrl}
                          alt={`Page ${actualPageIndex + 1}`}
                          className="h-24 w-auto rounded border-2 border-gray-300 shadow-sm hover:border-home-primary transition-colors"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-1 rounded-b group-hover:bg-home-primary transition-colors">
                          Page {actualPageIndex + 1}
                        </div>
                      </div>
                    );
                  })}
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

      {/* Study Timer */}
      <div className="absolute bottom-4 right-4 z-50">
        {isTimerMinimized ? (
          // Minimized state - just icon
          <div 
            className={`bg-white/95 backdrop-blur-sm rounded-full shadow-xl border border-gray-200 p-2 cursor-pointer ${!isTimerActive ? 'opacity-60' : ''}`}
            onClick={() => setIsTimerMinimized(false)}
            title={`${formatTime(totalStudyTime)} - ${isTimerActive ? 'Studying' : 'Paused'}`}
          >
            <Timer className={`w-4 h-4 ${isTimerActive ? 'text-green-600' : 'text-gray-400'}`} />
          </div>
        ) : (
          // Expanded state - full timer
          <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-2 ${!isTimerActive ? 'opacity-60' : ''}`}>
            <Timer className={`w-4 h-4 ${isTimerActive ? 'text-green-600' : 'text-gray-400'}`} />
            <div className="flex flex-col cursor-pointer" onClick={() => setIsTimerMinimized(true)}>
              <span className="text-sm font-semibold text-gray-900">
                {formatTime(totalStudyTime)}
              </span>
              <span className="text-xs text-gray-500">
                {isTimerActive ? 'Studying' : 'Paused'}
              </span>
            </div>
          </div>
        )}
      </div>

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


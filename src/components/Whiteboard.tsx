import { useState, useRef, useCallback, useEffect } from "react";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Users, 
  MessageSquare, 
  Video, 
  Upload, 
  Download,
  Settings,
  Palette,
  RotateCcw,
  Wifi,
  WifiOff
} from "lucide-react";
import { useWhiteboardCollaboration } from "@/hooks/useWhiteboardCollaboration";
import { toast } from "sonner";

interface WhiteboardProps {
  sessionId?: string;
  isHost?: boolean;
  onSceneChange?: (elements: any[], appState: any) => void;
}

const Whiteboard = ({ sessionId = "default-session", isHost = false, onSceneChange }: WhiteboardProps) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [selectedElements, setSelectedElements] = useState<any[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [hasLoadedInitialScene, setHasLoadedInitialScene] = useState(false);
  const [aiThreads, setAIThreads] = useState([
    { 
      id: "1", 
      question: "How do I solve this quadratic equation?", 
      answer: "To solve ax² + bx + c = 0, use the quadratic formula...",
      elementId: "element-123"
    }
  ]);

  // Use refs to store latest callbacks to avoid recreating handlers
  const broadcastRef = useRef<((elements: any[], appState: any) => void) | null>(null);
  const broadcastCursorRef = useRef<((x: number, y: number) => void) | null>(null);
  const onSceneChangeRef = useRef(onSceneChange);
  
  useEffect(() => {
    onSceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  // Use the real-time collaboration hook
  const {
    collaborators,
    session,
    isConnected,
    sceneData,
    broadcastSceneUpdate,
    broadcastCursorMove,
    currentColor,
  } = useWhiteboardCollaboration(sessionId);

  // Store the broadcast functions in refs
  useEffect(() => {
    broadcastRef.current = broadcastSceneUpdate;
    broadcastCursorRef.current = broadcastCursorMove;
  }, [broadcastSceneUpdate, broadcastCursorMove]);

  // Load initial scene data once when it becomes available
  useEffect(() => {
    if (sceneData && excalidrawAPI && !hasLoadedInitialScene) {
      excalidrawAPI.updateScene({
        elements: sceneData.elements,
        appState: sceneData.appState,
      });
      setHasLoadedInitialScene(true);
    }
  }, [sceneData, excalidrawAPI, hasLoadedInitialScene]);

  // Handle incoming scene updates from other collaborators
  useEffect(() => {
    if (sceneData && excalidrawAPI && hasLoadedInitialScene) {
      // Only update if the scene was updated by another user
      // We can add a check here to prevent updating if this is our own change
      const currentElements = excalidrawAPI.getSceneElements();
      if (currentElements.length !== sceneData.elements.length) {
        excalidrawAPI.updateScene({
          elements: sceneData.elements,
          appState: sceneData.appState,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneData?.version]); // Only trigger on version changes (excalidrawAPI and hasLoadedInitialScene are intentionally excluded)

  // Create a completely stable onChange handler using refs
  const handleSceneUpdate = useCallback((elements: any[], appState: any) => {
    // Update selected elements for AI assistance
    const selected = elements.filter((el: any) => appState.selectedElementIds?.[el.id]);
    setSelectedElements(selected);
    
    // Broadcast to other collaborators using ref
    if (broadcastRef.current) {
      broadcastRef.current(elements, appState);
    }
    
    // Call parent callback using ref
    if (onSceneChangeRef.current) {
      onSceneChangeRef.current(elements, appState);
    }
  }, []); // Empty dependency array - completely stable

  // Handle pointer movements for cursor tracking - completely stable
  const handlePointerUpdate = useCallback((payload: any) => {
    if (payload.pointer && broadcastCursorRef.current) {
      broadcastCursorRef.current(payload.pointer.x, payload.pointer.y);
    }
  }, []); // Empty dependency array - completely stable

  const handleAskAI = useCallback(() => {
    if (selectedElements.length === 0) {
      // Show toast: "Please select elements first"
      return;
    }
    
    setShowAIPanel(true);
    // TODO: Implement AI query functionality
    console.log("Asking AI about selected elements:", selectedElements);
  }, [selectedElements]);

  const handleUploadDocument = useCallback(() => {
    // TODO: Implement document upload
    console.log("Upload document");
  }, []);

  const handleExportBoard = useCallback(() => {
    if (!excalidrawAPI) return;
    
    // Export as PNG
    excalidrawAPI.exportToCanvas({
      mimeType: "image/png",
      quality: 1,
    }).then((canvas) => {
      const link = document.createElement("a");
      link.download = `markit-board-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  }, [excalidrawAPI]);

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top Toolbar */}
      <div className="border-b border-border bg-surface/90 backdrop-blur-sm p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-foreground">
              {session?.name || "Loading..."}
            </h2>
            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
              <div className="w-2 h-2 bg-success rounded-full mr-2" />
              {collaborators.length} Active
            </Badge>
            <Badge 
              variant="secondary" 
              className={isConnected 
                ? "bg-success/10 text-success border-success/20" 
                : "bg-destructive/10 text-destructive border-destructive/20"
              }
            >
              {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Collaborator avatars */}
            <div className="flex -space-x-2 mr-4">
              {collaborators.map((user) => (
                <div 
                  key={user.id}
                  className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.split(" ").map(n => n[0]).join("")}
                </div>
              ))}
            </div>

            <Button 
              variant={selectedElements.length > 0 ? "hero" : "outline"}
              size="sm" 
              onClick={handleAskAI}
              disabled={selectedElements.length === 0}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Ask AI
            </Button>

            <Button variant="outline" size="sm" onClick={handleUploadDocument}>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>

            <Button variant="secondary" size="sm">
              <Video className="w-4 h-4 mr-2" />
              Join Call
            </Button>

            <Button variant="ghost" size="sm" onClick={handleExportBoard}>
              <Download className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Whiteboard */}
        <div className="flex-1 relative">
          <Excalidraw
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            onChange={handleSceneUpdate}
            onPointerUpdate={handlePointerUpdate}
            theme="dark"
            viewModeEnabled={false}
            zenModeEnabled={false}
            gridModeEnabled={false}
            initialData={{
              elements: [],
              appState: {
                viewBackgroundColor: "hsl(220, 13%, 8%)",
                currentItemFillStyle: "solid",
                currentItemStrokeColor: currentColor,
                currentItemBackgroundColor: "transparent",
              },
            }}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveToActiveFile: false,
              },
            }}
          >
            <MainMenu>
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.ToggleTheme />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.Help />
            </MainMenu>
            <WelcomeScreen>
              <WelcomeScreen.Hints.MenuHint />
              <WelcomeScreen.Hints.ToolbarHint />
            </WelcomeScreen>
          </Excalidraw>

          {/* Floating Action Buttons */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-3">
            <Button 
              variant="hero" 
              size="lg" 
              onClick={handleAskAI}
              disabled={selectedElements.length === 0}
              className="shadow-glow-primary"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              AI Help
            </Button>
            
            {selectedElements.length > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20 justify-center">
                {selectedElements.length} element{selectedElements.length > 1 ? "s" : ""} selected
              </Badge>
            )}
          </div>

          {/* Collaborator Cursors */}
          {collaborators.map((collaborator) => 
            collaborator.cursor_position && collaborator.is_online ? (
              <div
                key={collaborator.id}
                className="absolute pointer-events-none transition-all duration-100"
                style={{
                  left: collaborator.cursor_position.x,
                  top: collaborator.cursor_position.y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div 
                  className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
                  style={{ backgroundColor: collaborator.color }}
                />
                <div 
                  className="absolute top-5 left-0 px-2 py-1 text-xs font-medium text-white rounded shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: collaborator.color }}
                >
                  {collaborator.name}
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Side Panels */}
        <div className="w-80 border-l border-border flex flex-col">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col">
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-secondary" />
                <h3 className="font-semibold text-foreground">Session Chat</h3>
              </div>
            </div>
            
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Chat messages */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs">
                    AC
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Alex Chen</p>
                    <p className="text-sm text-muted-foreground">Anyone know how to approach problem #3?</p>
                    <span className="text-xs text-muted-foreground">2 min ago</span>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center text-xs">
                    SK
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Sarah Kim</p>
                    <p className="text-sm text-muted-foreground">Try using integration by parts first</p>
                    <span className="text-xs text-muted-foreground">1 min ago</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chat Input */}
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  className="flex-1 px-3 py-2 bg-surface border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" variant="hero">Send</Button>
              </div>
            </div>
          </div>

          {/* AI Threads Panel */}
          {showAIPanel && (
            <div className="border-t border-border h-80">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">AI Threads</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowAIPanel(false)}>
                    ×
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {aiThreads.map((thread) => (
                  <Card key={thread.id} className="p-4 bg-card">
                    <p className="text-sm font-medium text-foreground mb-2">{thread.question}</p>
                    <p className="text-sm text-muted-foreground mb-3">{thread.answer}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Regenerate</Button>
                      <Button variant="ghost" size="sm">Copy</Button>
                    </div>
                  </Card>
                ))}
                
                {aiThreads.length === 0 && (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No AI threads yet. Select elements and ask for help!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
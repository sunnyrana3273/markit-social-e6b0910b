import { useState, useRef, useCallback } from "react";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Users, 
  Video, 
  Upload, 
  Download,
  Settings,
  Palette,
  RotateCcw,
  Camera,
  X
} from "lucide-react";

interface WhiteboardProps {
  sessionId?: string;
  isHost?: boolean;
  onSceneChange?: (elements: any[], appState: any) => void;
}

// Key helper for localStorage persistence (scoped by optional sessionId)
const getLocalStorageKey = (sessionId?: string) =>
  `markit.excalidraw.scene${sessionId ? `:${sessionId}` : ""}`;

// Simple debounce utility to avoid excessive localStorage writes
function debounce<T extends (...args: any[]) => void>(fn: T, delay = 500) {
  let handle: number | undefined;
  return (...args: Parameters<T>) => {
    if (handle) window.clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), delay);
  };
}

const Whiteboard = ({ sessionId, isHost = false, onSceneChange }: WhiteboardProps) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [selectedElements, setSelectedElements] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState([
    { id: "1", name: "Alex Chen", color: "#8b5cf6", cursor: { x: 100, y: 100 } },
    { id: "2", name: "Sarah Kim", color: "#06b6d4", cursor: { x: 200, y: 150 } },
  ]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showCapturePanel, setShowCapturePanel] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiThreads, setAIThreads] = useState([
    { 
      id: "1", 
      question: "How do I solve this quadratic equation?", 
      answer: "To solve ax² + bx + c = 0, use the quadratic formula...",
      elementId: "element-123"
    }
  ]);

  // Local storage key
  const storageKey = getLocalStorageKey(sessionId);
  console.debug("[Whiteboard] storageKey:", storageKey);

  // Load saved scene if present
  const savedInitialData = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (!raw) {
        console.debug("[Whiteboard] No saved scene in localStorage for key:", storageKey);
        return null;
      }
      const parsed = JSON.parse(raw);
      console.debug(
        "[Whiteboard] Loaded scene from localStorage",
        {
          elementsCount: Array.isArray(parsed?.elements) ? parsed.elements.length : 0,
          hasFiles: parsed?.files ? Object.keys(parsed.files).length : 0,
        }
      );
      return parsed;
    } catch {
      console.warn("[Whiteboard] Failed to parse saved scene from localStorage for key:", storageKey);
      return null;
    }
  })();

  // Persist scene to localStorage (debounced)
  const persistScene = useCallback(
    debounce((elements: any[], appState: any, files: any) => {
      try {
        const data = {
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            currentItemFillStyle: appState.currentItemFillStyle,
            currentItemStrokeColor: appState.currentItemStrokeColor,
            currentItemBackgroundColor: appState.currentItemBackgroundColor,
          },
          files,
        };
        const serialized = JSON.stringify(data);
        console.debug(
          "[Whiteboard] Persisting scene",
          {
            elementsCount: Array.isArray(elements) ? elements.length : 0,
            filesCount: files ? Object.keys(files).length : 0,
            sizeBytes: serialized.length,
          }
        );
        localStorage.setItem(storageKey, serialized);
      } catch {
        console.warn("[Whiteboard] Failed to save scene to localStorage (quota/serialization)");
      }
    }, 500),
    [storageKey]
  );

  const handleSceneUpdate = useCallback((elements: any[], appState: any, files?: any) => {
    console.debug(
      "[Whiteboard] onChange",
      {
        elementsCount: Array.isArray(elements) ? elements.length : 0,
        filesCount: files ? Object.keys(files).length : 0,
        selectionCount: elements.filter((el: any) => appState.selectedElementIds[el.id]).length,
      }
    );
    const selected = elements.filter((el: any) => appState.selectedElementIds[el.id]);
    setSelectedElements(selected);
    onSceneChange?.(elements, appState);
    persistScene(elements, appState, files ?? {});
  }, [onSceneChange, persistScene]);

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

  const handleCaptureScene = useCallback(() => {
    if (!excalidrawAPI) return;
    
    // Export as PNG and store in state
    excalidrawAPI.exportToCanvas({
      mimeType: "image/png",
      quality: 1,
    }).then((canvas) => {
      const dataURL = canvas.toDataURL("image/png");
      setCapturedImage(dataURL);
      setShowCapturePanel(true);
    });
  }, [excalidrawAPI]);

  const handleSaveCapturedImage = useCallback(() => {
    if (!capturedImage) return;
    
    const link = document.createElement("a");
    link.download = `markit-capture-${Date.now()}.png`;
    link.href = capturedImage;
    link.click();
  }, [capturedImage]);

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top Toolbar */}
      <div className="border-b border-border bg-surface/90 backdrop-blur-sm p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-foreground">AP Calculus Study Session</h2>
            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
              <div className="w-2 h-2 bg-success rounded-full mr-2" />
              {collaborators.length + 1} Active
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

            <Button variant="ghost" size="sm" onClick={handleCaptureScene}>
              <Camera className="w-4 h-4" />
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
            onChange={handleSceneUpdate}
            theme="dark"
            viewModeEnabled={false}
            zenModeEnabled={false}
            gridModeEnabled={false}
            initialData={
              savedInitialData ?? {
                elements: [],
                appState: {
                  viewBackgroundColor: "hsl(220, 13%, 8%)",
                  currentItemFillStyle: "solid",
                  currentItemStrokeColor: "#8b5cf6",
                  currentItemBackgroundColor: "transparent",
                },
                files: {}
              }
            }
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
        </div>

        {/* Capture Panel Sidebar */}
        {showCapturePanel && (
          <div className="w-80 border-l border-border bg-surface flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-secondary" />
                  <h3 className="font-semibold text-foreground">Captured Scene</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowCapturePanel(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Captured Image Preview */}
            <div className="flex-1 p-4 overflow-y-auto">
              {capturedImage ? (
                <div className="space-y-4">
                  <div className="relative">
                    <img 
                      src={capturedImage} 
                      alt="Captured whiteboard"
                      className="w-full h-auto rounded-lg border border-border"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="hero" 
                      onClick={handleSaveCapturedImage}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Image
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCapturePanel(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No capture available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Side Panels */}
        {!showCapturePanel && (
          <div className="w-80 border-l border-border flex flex-col">
            {/* Chat Panel */}
            <div className="flex-1 flex flex-col">
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-secondary" />
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
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
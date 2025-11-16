import { useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Book } from "lucide-react";
import Whiteboard from "@/components/Whiteboard";

const StudySession = () => {
  const { sessionId } = useParams();

  const handleSceneChange = useCallback((elements: any[], appState: any) => {
    // TODO: Implement real-time sync with Supabase
    console.log("Scene updated:", { elements, appState });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Book className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">MarkIt</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Session ID: {sessionId || "demo-session"}</span>
          </div>
        </div>
      </header>

      {/* Whiteboard */}
      <Whiteboard 
        sessionId={sessionId}
        isHost={true}
        onSceneChange={handleSceneChange}
      />
    </div>
  );
};

export default StudySession;
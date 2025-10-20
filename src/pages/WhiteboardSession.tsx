import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Whiteboard from "@/components/Whiteboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const WhiteboardSession = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          toast.error("Please sign in to access the whiteboard");
          navigate("/auth");
          return;
        }

        // If no sessionId, create a new session
        if (!sessionId || sessionId === "new") {
          const { data: newSession, error: createError } = await supabase
            .from("whiteboard_sessions")
            .insert({
              name: `Whiteboard Session - ${new Date().toLocaleDateString()}`,
              host_user_id: user.id,
              is_active: true,
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating session:", createError);
            toast.error("Failed to create whiteboard session");
            return;
          }

          if (newSession) {
            navigate(`/whiteboard/${newSession.id}`, { replace: true });
            return;
          }
        }

        // Check if user is host of existing session
        const { data: session, error: sessionError } = await supabase
          .from("whiteboard_sessions")
          .select("host_user_id")
          .eq("id", sessionId)
          .single();

        if (sessionError) {
          console.error("Error fetching session:", sessionError);
          toast.error("Session not found");
          navigate("/app");
          return;
        }

        setIsHost(session.host_user_id === user.id);
        setIsLoading(false);
      } catch (error) {
        console.error("Error in checkAuth:", error);
        toast.error("An error occurred");
        navigate("/app");
      }
    };

    checkAuth();
  }, [sessionId, navigate]);

  // Memoize the scene change callback to prevent re-renders
  const handleSceneChange = useCallback((elements: any[], appState: any) => {
    // Optional: Add custom logic here
    // Removed console.log to reduce noise
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading whiteboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Optional: Back button */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app")}
          className="bg-surface/80 backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {sessionId && sessionId !== "new" && (
        <Whiteboard 
          sessionId={sessionId} 
          isHost={isHost}
          onSceneChange={handleSceneChange}
        />
      )}
    </div>
  );
};

export default WhiteboardSession;


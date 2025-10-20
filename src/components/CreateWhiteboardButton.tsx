import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateWhiteboardButtonProps {
  courseId?: string;
  defaultName?: string;
  variant?: "default" | "outline" | "ghost" | "hero";
  size?: "default" | "sm" | "lg" | "icon";
}

const CreateWhiteboardButton = ({ 
  courseId, 
  defaultName,
  variant = "hero",
  size = "default"
}: CreateWhiteboardButtonProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName || "");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the whiteboard");
      return;
    }

    setIsCreating(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        toast.error("Please sign in to create a whiteboard");
        navigate("/auth");
        return;
      }

      const { data: session, error } = await supabase
        .from("whiteboard_sessions")
        .insert({
          name: name.trim(),
          course_id: courseId || null,
          host_user_id: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating session:", error);
        toast.error("Failed to create whiteboard session");
        return;
      }

      if (session) {
        toast.success("Whiteboard created!");
        setOpen(false);
        navigate(`/whiteboard/${session.id}`);
      }
    } catch (error) {
      console.error("Error in handleCreate:", error);
      toast.error("An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Palette className="w-4 h-4 mr-2" />
          New Whiteboard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Whiteboard Session</DialogTitle>
          <DialogDescription>
            Create a new collaborative whiteboard for real-time drawing and brainstorming.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Session Name</Label>
            <Input
              id="name"
              placeholder="e.g., AP Calculus Study Session"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
              disabled={isCreating}
            />
          </div>
          {courseId && (
            <p className="text-sm text-muted-foreground">
              This whiteboard will be linked to the current course.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            variant="hero" 
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Palette className="w-4 h-4 mr-2" />
                Create Whiteboard
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWhiteboardButton;


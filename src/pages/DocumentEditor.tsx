import { Excalidraw } from "@excalidraw/excalidraw";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const DocumentEditor = () => {
  const navigate = useNavigate();
  const { fileId } = useParams();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Simple Top Bar */}
      <div style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/app')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Excalidraw Canvas - following official documentation pattern */}
      <div style={{ height: "100%", width: "100%" }}>
        <Excalidraw />
      </div>
    </div>
  );
};

export default DocumentEditor;


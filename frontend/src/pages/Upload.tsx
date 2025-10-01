import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Upload, 
  FileText, 
  X,
  ArrowLeft,
  BookOpen,
  Eye
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

const Upload = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get user once on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
      if (user) {
        loadDocuments();
      }
    };
    getUser();
  }, []);

  // Load documents function
  const loadDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('http://localhost:8081/api/upload/documents', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const formData = new FormData();
      formData.append('document', selectedFile);

      const response = await fetch('http://localhost:8081/api/upload/pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Upload successful",
          description: `${data.document.file_name} has been uploaded`,
        });
        
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        loadDocuments(); // Refresh the documents list
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || 'Failed to upload document',
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = (doc: Document) => {
    setViewingDoc(doc);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-home-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (viewingDoc) {
    return (
      <div className="min-h-screen bg-gradient-surface">
        {/* Header */}
        <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 text-home-foreground hover:bg-home-surface rounded-md transition-colors"
              >
                <X className="w-4 h-4 mr-2 inline" />
                Close
              </button>
            </div>
          </div>
        </header>

        {/* PDF Viewer */}
        <div className="container mx-auto px-4 py-8">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-home-foreground">{viewingDoc.file_name}</h1>
            <p className="text-gray-600">{formatFileSize(viewingDoc.file_size)} • {formatDate(viewingDoc.created_at)}</p>
          </div>
          
          <Card className="p-4">
            <iframe
              src={`http://localhost:8081/api/upload/file/${viewingDoc.file_path.split('/').pop()}`}
              className="w-full h-[80vh] border-0 rounded"
              title={viewingDoc.file_name}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-home-foreground font-homemade">MarkIt</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link 
          to="/app" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-home-foreground mb-4">Upload PDF Documents</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Upload PDF documents and view them directly in your browser.
            </p>
          </div>

          {/* Upload Section */}
          <Card className="p-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-home-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-home-primary" />
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {!selectedFile ? (
                <div>
                  <h3 className="text-lg font-semibold text-home-foreground mb-2">Choose a PDF file</h3>
                  <p className="text-gray-600 mb-4">Maximum file size: 10MB</p>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-home-primary hover:bg-home-primary-hover text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Select PDF File
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <FileText className="w-8 h-8 text-home-primary" />
                    <div className="text-left">
                      <p className="font-medium text-home-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <Button 
                    onClick={handleUpload}
                    disabled={uploading}
                    className="bg-home-primary hover:bg-home-primary-hover text-white"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Documents List */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-home-foreground mb-4">Your Documents</h2>
            
            {documents.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No documents uploaded yet</p>
                <p className="text-sm">Upload your first PDF to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-home-foreground">{doc.file_name}</p>
                        <p className="text-sm text-gray-600">
                          {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleViewDocument(doc)}
                      className="bg-home-primary hover:bg-home-primary-hover text-white"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Upload;
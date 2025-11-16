import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Book,
  BookOpen,
  Upload as UploadIcon,
  File,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Archive,
  X,
  ExternalLink
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  created_at: string;
}

const Upload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "MarkIt | Uploads";
  }, []);

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUserId(session.user.id);
      await fetchFiles(session.user.id);
    };

    initializeUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchFiles = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('clerk_user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (fileList: File[]) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to upload files",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    for (const file of fileList) {
      try {
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('uploaded_files')
          .insert({
            clerk_user_id: userId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            mode: 'upload'
          });

        if (dbError) throw dbError;

        toast({
          title: "Success",
          description: `${file.name} uploaded successfully`,
        });
      } catch (error: any) {
        console.error('Error uploading file:', error);
        toast({
          title: "Error",
          description: `Failed to upload ${file.name}: ${error.message}`,
          variant: "destructive",
        });
      }
    }

    setUploading(false);
    if (userId) await fetchFiles(userId);
  };

  const handleDelete = async (file: UploadedFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('user-uploads')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('uploaded_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      setFiles(files.filter(f => f.id !== file.id));
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: `Failed to delete file: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (file: UploadedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: `Failed to download file: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (fileType.startsWith('video/')) return <Video className="w-6 h-6" />;
    if (fileType.startsWith('audio/')) return <Music className="w-6 h-6" />;
    if (fileType.includes('pdf') || fileType.includes('document')) return <FileText className="w-6 h-6" />;
    if (fileType.includes('zip') || fileType.includes('compressed')) return <Archive className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-home-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-home-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-home-background font-lexend">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-home-surface/80 dark:bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-1.5">
              <div className="w-8 h-8 bg-home-primary rounded-lg flex items-center justify-center">
                <Book className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-home-foreground">MarkIt</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">Dashboard</Button>
              </Link>
              <Link to="/upload">
                <Button variant="ghost" className="text-home-primary font-semibold">Upload</Button>
              </Link>
            </nav>
          </div>
          
          <Link to="/app">
            <Button variant="outline" className="border-home-primary text-home-primary hover:bg-home-primary hover:text-white">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-home-foreground mb-2">File Upload</h1>
            <p className="text-gray-600 dark:text-gray-400">Upload and manage your study materials</p>
          </div>

          {/* Upload Area */}
          <Card className="p-8 bg-card border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-home-primary transition-colors">
            <div
              className={`text-center ${dragActive ? 'opacity-50' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <UploadIcon className="w-16 h-16 mx-auto mb-4 text-home-primary" />
              <h3 className="text-xl font-semibold text-home-foreground mb-2">
                {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Support for PDF, images, documents, and more
              </p>
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
              <label htmlFor="file-upload">
                <Button 
                  className="bg-home-primary hover:bg-home-primary-hover text-white"
                  disabled={uploading}
                  asChild
                >
                  <span>{uploading ? 'Uploading...' : 'Select Files'}</span>
                </Button>
              </label>
            </div>
          </Card>

          {/* File List */}
          <Card className="p-6 bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-home-foreground">
                Your Files ({files.length})
              </h2>
            </div>

            {files.length === 0 ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No files uploaded yet</p>
                <p className="text-sm">Upload your first file to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-4 bg-home-surface rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-home-primary/10 rounded-lg flex items-center justify-center text-home-primary">
                      {getFileIcon(file.file_type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-home-foreground truncate">
                        {file.file_name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/document/${file.id}`)}
                        className="text-home-primary hover:bg-home-primary/10"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file)}
                        className="text-gray-600 dark:text-gray-400 hover:bg-accent"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(file)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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

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
  ExternalLink,
  Folder,
  FolderPlus,
  Edit2,
  MoreVertical,
  Move,
  FolderOpen
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import ReportIssueFooter from "@/components/ReportIssueFooter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  created_at: string;
  folder_id?: string | null;
}

interface Folder {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

const Upload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { themeColor } = useTheme();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [fileToMove, setFileToMove] = useState<UploadedFile | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'plus' | 'pro' | 'admin' | null>(null);

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
      
      // Fetch user profile to get plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, role, plan_expires_at')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (profile) {
        // Check if plan has expired
        if (profile.plan_expires_at && profile.plan !== 'free') {
          const expiresAt = new Date(profile.plan_expires_at);
          const now = new Date();
          if (expiresAt < now) {
            setUserPlan('free');
          } else {
            setUserPlan(profile.role === 'admin' ? 'admin' : (profile.plan || 'free'));
          }
        } else {
          setUserPlan(profile.role === 'admin' ? 'admin' : (profile.plan || 'free'));
        }
      } else {
        setUserPlan('free');
      }
      
      await Promise.all([
        fetchFiles(session.user.id),
        fetchFolders(session.user.id)
      ]);
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

  const fetchFolders = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch folders",
        variant: "destructive",
      });
    }
  };

  const handleCreateFolder = async () => {
    if (!userId || !newFolderName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: userId,
          name: newFolderName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setFolders([data, ...folders]);
      setNewFolderName("");
      setIsCreateFolderOpen(false);
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error",
        description: `Failed to create folder: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleRenameFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;

    try {
      const { error } = await supabase
        .from('folders')
        .update({ name: newFolderName.trim() })
        .eq('id', editingFolder.id);

      if (error) throw error;

      setFolders(folders.map(f => 
        f.id === editingFolder.id 
          ? { ...f, name: newFolderName.trim() }
          : f
      ));
      setNewFolderName("");
      setIsRenameFolderOpen(false);
      setEditingFolder(null);
      toast({
        title: "Success",
        description: "Folder renamed successfully",
      });
    } catch (error: any) {
      console.error('Error renaming folder:', error);
      toast({
        title: "Error",
        description: `Failed to rename folder: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      // First, move all files in this folder to null (no folder)
      const { error: updateError } = await supabase
        .from('uploaded_files')
        .update({ folder_id: null })
        .eq('folder_id', folderToDelete.id);

      if (updateError) throw updateError;

      // Then delete the folder
      const { error: deleteError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderToDelete.id);

      if (deleteError) throw deleteError;

      setFolders(folders.filter(f => f.id !== folderToDelete.id));
      setFiles(files.map(f => 
        f.folder_id === folderToDelete.id 
          ? { ...f, folder_id: null }
          : f
      ));
      setFolderToDelete(null);
      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      toast({
        title: "Error",
        description: `Failed to delete folder: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleMoveFile = async (fileId: string, targetFolderId: string | null) => {
    try {
      const file = files.find(f => f.id === fileId);
      if (!file) return;

      // Don't move if already in the target folder
      if (file.folder_id === targetFolderId) {
        return;
      }

      const { error } = await supabase
        .from('uploaded_files')
        .update({ folder_id: targetFolderId })
        .eq('id', fileId);

      if (error) throw error;

      setFiles(files.map(f => 
        f.id === fileId 
          ? { ...f, folder_id: targetFolderId }
          : f
      ));
      setFileToMove(null);
      
      const targetFolderName = targetFolderId 
        ? folders.find(f => f.id === targetFolderId)?.name || 'folder'
        : 'All Files';
      
      toast({
        title: "Success",
        description: `File moved to ${targetFolderName}`,
      });
    } catch (error: any) {
      console.error('Error moving file:', error);
      toast({
        title: "Error",
        description: `Failed to move file: ${error.message}`,
        variant: "destructive",
      });
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

  const handleFiles = useCallback(async (fileList: File[]) => {
    // Check session directly in case userId state hasn't updated yet
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      toast({
        title: "Error",
        description: "You must be logged in to upload files",
        variant: "destructive",
      });
      return;
    }

    const currentUserId = session.user.id;

    setUploading(true);

    for (const file of fileList) {
      try {
        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${currentUserId}/${fileName}`;

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
            clerk_user_id: currentUserId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size,
            mode: 'upload',
            folder_id: selectedFolderId || null
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
    if (currentUserId) {
      await fetchFiles(currentUserId);
      await fetchFolders(currentUserId);
    }
  }, [selectedFolderId, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
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
      
      if (userId) {
        await fetchFolders(userId);
      }
      
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

  // Filter files by selected folder
  const filteredFiles = selectedFolderId === null
    ? files
    : files.filter(f => f.folder_id === selectedFolderId);


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
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary" />
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

          {/* Storage Usage Progress Bar */}
          {(() => {
            // Calculate total storage used (in bytes)
            const totalStorageUsed = files.reduce((sum, file) => sum + file.file_size, 0);
            
            // Storage limits in bytes based on plan
            const storageLimits: Record<string, number> = {
              free: 1 * 1024 * 1024 * 1024, // 1 GB
              plus: 15 * 1024 * 1024 * 1024, // 15 GB
              pro: 50 * 1024 * 1024 * 1024, // 50 GB
              admin: Infinity, // Unlimited for admin
            };
            
            const plan = userPlan || 'free';
            const maxStorage = plan === 'admin' ? Infinity : (storageLimits[plan] || storageLimits.free);
            const storageUsedGB = totalStorageUsed / (1024 * 1024 * 1024);
            const maxStorageGB = maxStorage === Infinity ? Infinity : maxStorage / (1024 * 1024 * 1024);
            const progressPercentage = maxStorage === Infinity ? 0 : Math.min((totalStorageUsed / maxStorage) * 100, 100);
            
            const planDisplayName = plan === 'admin' ? 'Admin' : plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Free';
            
            if (maxStorage === Infinity) {
              return null; // Don't show progress bar for admin/unlimited
            }
            
            return (
              <Card className="p-4 bg-card border border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {planDisplayName} Plan Storage
                  </span>
                  <span className={`font-semibold text-sm ${
                    progressPercentage >= 90 
                      ? 'text-red-600 dark:text-red-400' 
                      : progressPercentage >= 70 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {storageUsedGB.toFixed(2)} GB / {maxStorageGB.toFixed(0)} GB
                  </span>
                </div>
                <Progress 
                  value={progressPercentage} 
                  className={`h-3 ${
                    progressPercentage >= 90 
                      ? 'bg-red-100 dark:bg-red-900/30' 
                      : progressPercentage >= 70 
                      ? 'bg-yellow-100 dark:bg-yellow-900/30' 
                      : ''
                  }`}
                />
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{progressPercentage.toFixed(1)}% of storage used</span>
                  {progressPercentage >= 90 && (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Storage nearly full
                    </span>
                  )}
                </div>
              </Card>
            );
          })()}

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

          {/* Folder Organizer */}
          <Card className="p-4 bg-card border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-home-foreground">Folders</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNewFolderName("");
                  setIsCreateFolderOpen(true);
                }}
                className="h-8 px-3"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </Button>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  selectedFolderId === null
                    ? 'bg-home-primary/10 text-home-primary font-medium'
                    : draggedOverFolderId === 'all-files'
                    ? 'bg-home-primary/20 border-2 border-home-primary border-dashed scale-105'
                    : 'bg-home-surface text-gray-600 dark:text-gray-400 hover:bg-accent'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedFileId) {
                    setDraggedOverFolderId('all-files');
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX;
                  const y = e.clientY;
                  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setDraggedOverFolderId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedFileId) {
                    handleMoveFile(draggedFileId, null);
                    setDraggedFileId(null);
                    setDraggedOverFolderId(null);
                  }
                }}
              >
                <File className="w-4 h-4" />
                <span>All Files</span>
                <span className="text-xs">({files.length})</span>
              </button>

              {folders.map((folder) => {
                const folderFileCount = files.filter(f => f.folder_id === folder.id).length;
                const isDragOver = draggedOverFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`group flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                      selectedFolderId === folder.id
                        ? 'bg-home-primary/10 text-home-primary font-medium'
                        : isDragOver
                        ? 'bg-home-primary/20 border-2 border-home-primary border-dashed scale-105'
                        : 'bg-home-surface text-gray-600 dark:text-gray-400 hover:bg-accent'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedFileId) {
                        setDraggedOverFolderId(folder.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Only clear if we're actually leaving the folder element
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX;
                      const y = e.clientY;
                      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                        setDraggedOverFolderId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedFileId) {
                        handleMoveFile(draggedFileId, folder.id);
                        setDraggedFileId(null);
                        setDraggedOverFolderId(null);
                      }
                    }}
                  >
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="flex items-center gap-2"
                    >
                      <Folder className="w-4 h-4" style={{ color: folder.color || undefined }} />
                      <span>{folder.name}</span>
                      <span className="text-xs">({folderFileCount})</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingFolder(folder);
                            setNewFolderName(folder.name);
                            setIsRenameFolderOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFolderToDelete(folder)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* File List */}
          <Card className="p-6 bg-card border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-home-foreground">
                    {selectedFolderId === null 
                      ? `All Files (${files.length})`
                      : folders.find(f => f.id === selectedFolderId) 
                        ? `${folders.find(f => f.id === selectedFolderId)?.name} (${filteredFiles.length})`
                        : `Files (${filteredFiles.length})`
                    }
                  </h2>
                  {selectedFolderId === null && folders.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Drag files to folders to organize them
                    </p>
                  )}
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                    <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>
                      {selectedFolderId === null 
                        ? "No files uploaded yet"
                        : "No files in this folder"
                      }
                    </p>
                    <p className="text-sm">
                      {selectedFolderId === null
                        ? "Upload your first file to get started"
                        : folders.length === 0
                        ? "Create a folder first, then move files here"
                        : "Move files here or upload new files to this folder"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedFileId(file.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', file.id);
                          // Add visual feedback by making the dragged element semi-transparent
                          if (e.currentTarget) {
                            (e.currentTarget as HTMLElement).style.opacity = '0.5';
                          }
                        }}
                        onDragEnd={(e) => {
                          setDraggedFileId(null);
                          setDraggedOverFolderId(null);
                          // Reset opacity
                          if (e.currentTarget) {
                            (e.currentTarget as HTMLElement).style.opacity = '1';
                          }
                        }}
                        className={`flex items-center gap-4 p-4 bg-home-surface rounded-lg hover:bg-accent transition-all cursor-grab active:cursor-grabbing ${
                          draggedFileId === file.id ? 'opacity-50 scale-95' : ''
                        }`}
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
                          {folders.length === 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-600 dark:text-gray-400 hover:bg-accent"
                              onClick={() => {
                                setNewFolderName("");
                                setIsCreateFolderOpen(true);
                              }}
                            >
                              <Move className="w-4 h-4" />
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-600 dark:text-gray-400 hover:bg-accent"
                                >
                                  <Move className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleMoveFile(file.id, null)}
                                >
                                  <FolderOpen className="w-4 h-4 mr-2" />
                                  Remove from folder
                                </DropdownMenuItem>
                                {folders.map((folder) => (
                                  <DropdownMenuItem
                                    key={folder.id}
                                    onClick={() => handleMoveFile(file.id, folder.id)}
                                  >
                                    <Folder className="w-4 h-4 mr-2" style={{ color: folder.color || undefined }} />
                                    <span>Move to <span className="font-bold" style={{ color: themeColor }}>{folder.name}</span></span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={isRenameFolderOpen} onOpenChange={setIsRenameFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameFolder();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={!newFolderName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Confirmation Dialog */}
      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete "{folderToDelete?.name}"? All files in this folder will be removed from the folder.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteFolder}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReportIssueFooter />
    </div>
  );
};

export default Upload;

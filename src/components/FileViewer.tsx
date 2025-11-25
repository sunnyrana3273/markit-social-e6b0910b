import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, FileText, Image as ImageIcon, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileViewerProps {
  url: string;
  type: string;
  name: string;
  className?: string;
}

export function FileViewer({ url, type, name, className }: FileViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isImage = type.startsWith('image/');
  const isPdf = type === 'application/pdf';
  const isOfficeDoc = 
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/vnd.ms-powerpoint' ||
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="w-5 h-5" />;
    if (isPdf) return <FileText className="w-5 h-5 text-red-500" />;
    if (isOfficeDoc) return <FileText className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <>
      <div
        className={cn(
          "border rounded-lg p-3 bg-muted/50 hover:bg-muted transition-colors cursor-pointer group",
          className
        )}
        onClick={(e) => {
          e.stopPropagation(); // Prevent parent click handlers from firing
          setIsExpanded(true);
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {isImage ? (
              <img
                src={url}
                alt={name}
                className="w-16 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-background rounded border">
                {getFileIcon()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground">
              {isImage ? 'Image' : isPdf ? 'PDF Document' : isOfficeDoc ? 'Office Document' : 'File'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-transparent border-none shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">File Preview: {name}</DialogTitle>
          <DialogDescription className="sr-only">Preview of {name}</DialogDescription>
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {isImage ? (
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            ) : isPdf ? (
              <iframe
                src={url}
                className="w-full h-[90vh] rounded-lg shadow-2xl bg-white"
                title={name}
              />
            ) : (
              <div className="bg-background rounded-lg shadow-2xl p-8 max-w-2xl">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-full">
                    {getFileIcon()}
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">{name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isOfficeDoc ? 'Office Document' : 'File'} preview not available
                    </p>
                    <Button onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 right-6 bg-background/90 hover:bg-background text-foreground rounded-full shadow-lg"
              onClick={() => setIsExpanded(false)}
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </Button>
            {!isOfficeDoc && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-6 right-16 bg-background/90 hover:bg-background text-foreground rounded-full shadow-lg"
                onClick={handleDownload}
                aria-label="Download file"
              >
                <Download className="h-5 w-5" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


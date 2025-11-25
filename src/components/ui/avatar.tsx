import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn, normalizeImageUrl } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

interface AvatarImageProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  src?: string | null;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  AvatarImageProps
>(({ className, src, onError, ...props }, ref) => {
  const normalizedSrc = normalizeImageUrl(src);
  const isGoogleImage = normalizedSrc?.includes('googleusercontent.com') || normalizedSrc?.includes('googleapis.com');
  const [hasError, setHasError] = React.useState(false);
  
  const handleError = React.useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    // Log for debugging
    if (normalizedSrc) {
      console.warn('[Avatar] Failed to load image:', normalizedSrc);
    }
    onError?.(e);
  }, [normalizedSrc, onError]);
  
  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false);
  }, [normalizedSrc]);
  
  if (hasError || !normalizedSrc) {
    return null; // Let fallback show
  }
  
  return (
    <AvatarPrimitive.Image 
      ref={ref} 
      className={cn("aspect-square h-full w-full", className)} 
      src={normalizedSrc}
      referrerPolicy={isGoogleImage ? "no-referrer" : undefined}
      crossOrigin={isGoogleImage ? "anonymous" : undefined}
      onError={handleError}
      {...props} 
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };

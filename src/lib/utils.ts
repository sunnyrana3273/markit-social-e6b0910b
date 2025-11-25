import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes Google profile image URLs to ensure they load correctly
 * Google images sometimes need size parameters and proper URL formatting
 */
export function normalizeImageUrl(url: string | null | undefined): string | undefined {
  if (!url || url.trim() === '') return undefined;
  
  // Clean up the URL
  const cleanUrl = url.trim();
  
  // If it's a Google image URL, normalize it
  if (cleanUrl.includes('googleusercontent.com') || cleanUrl.includes('googleapis.com')) {
    try {
      // Handle URLs that might already have query parameters or fragments
      const urlObj = new URL(cleanUrl);
      
      // For Google user content URLs, ensure proper size parameter
      // Google uses 'sz' parameter for size (in pixels)
      if (!urlObj.searchParams.has('sz')) {
        urlObj.searchParams.set('sz', '96'); // Standard avatar size
      }
      
      // Remove any conflicting size parameters
      urlObj.searchParams.delete('s');
      
      // Ensure HTTPS for Google images
      if (urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }
      
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails (e.g., relative URL), try to fix it
      // Sometimes Google returns URLs without protocol
      if (cleanUrl.startsWith('//')) {
        return `https:${cleanUrl}`;
      }
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        // If it's a Google domain, add https
        if (cleanUrl.includes('googleusercontent.com') || cleanUrl.includes('googleapis.com')) {
          return `https://${cleanUrl}`;
        }
      }
      // Return original if we can't fix it
      console.warn('[normalizeImageUrl] Failed to parse URL:', cleanUrl, e);
      return cleanUrl;
    }
  }
  
  // For non-Google URLs, ensure they have a protocol
  if (cleanUrl.startsWith('//')) {
    return `https:${cleanUrl}`;
  }
  
  return cleanUrl;
}

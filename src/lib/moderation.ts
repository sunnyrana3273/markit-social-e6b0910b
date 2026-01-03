/**
 * Content moderation utility
 * Uses OpenAI moderation API via backend endpoint to check content for inappropriate material
 */

import { BACKEND_URL } from './api';

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Moderate content using the backend moderation API
 * @param text - The text content to moderate
 * @param contentType - Type of content: 'post' (includes title + content) or 'reply' (just content)
 * @param image - Optional base64 image string or File object to moderate
 * @returns Promise resolving to moderation result
 */
export async function moderateContent(
  text: string,
  contentType: 'post' | 'reply',
  image?: string | File | null
): Promise<ModerationResult> {
  try {
    if (!text || typeof text !== 'string') {
      return { blocked: false };
    }

    // Convert File to base64 if needed
    let imageBase64: string | undefined;
    if (image) {
      if (image instanceof File) {
        // Convert File to base64
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });
      } else if (typeof image === 'string') {
        // Already base64
        imageBase64 = image;
      }
    }

    const response = await fetch(`${BACKEND_URL}/api/moderate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        contentType,
        image: imageBase64,
      }),
    });

    if (!response.ok) {
      console.error('[Moderation] API request failed:', response.status, response.statusText);
      // On API failure, allow content but log warning
      // You can change this to block if preferred
      return { blocked: false };
    }

    const data = await response.json();

    if (!data.success) {
      console.error('[Moderation] API returned error:', data.error);
      return { blocked: false };
    }

    return {
      blocked: data.blocked || false,
      reason: data.reason,
    };
  } catch (error) {
    console.error('[Moderation] Error calling moderation API:', error);
    // On network/API error, allow content but log warning
    // You can change this to block if preferred
    return { blocked: false };
  }
}


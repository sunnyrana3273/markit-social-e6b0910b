/**
 * Centralized API configuration
 * Ensures consistent backend URL usage across the application
 */

/**
 * Get the backend API base URL
 * In production, VITE_BACKEND_URL must be set
 * In development, falls back to localhost:3001
 */
export const getBackendUrl = (): string => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  
  // In production, require the environment variable
  if (import.meta.env.PROD && !backendUrl) {
    console.error('❌ VITE_BACKEND_URL is not set in production!');
    throw new Error('Backend URL is not configured. Please set VITE_BACKEND_URL environment variable.');
  }
  
  // Fallback to localhost for development
  return backendUrl || 'http://localhost:3001';
};

/**
 * Backend API base URL
 * Use this constant throughout the application
 */
export const BACKEND_URL = getBackendUrl();



import { useEffect } from 'react';

/**
 * Hook to force light mode on landing pages by removing the dark class
 * from the document root when the component mounts.
 * On unmount, it restores the user's theme preference.
 */
export const useForceLightMode = () => {
  // Apply synchronously before React renders to prevent FOUC
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  useEffect(() => {
    // Remove dark class from root to ensure light mode on landing pages
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    
    // Cleanup: restore user's theme preference when leaving landing page
    return () => {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      if (savedTheme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };
  }, []);
};






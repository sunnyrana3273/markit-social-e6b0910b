import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  resetThemeColor: () => void;
}

const DEFAULT_THEME_COLOR = '#22c55e'; // Default green color (hsl(140 50% 45%))

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      return savedTheme;
    }
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [themeColor, setThemeColorState] = useState<string>(() => {
    return localStorage.getItem('themeColor') || DEFAULT_THEME_COLOR;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Apply theme color to CSS variables
    const root = document.documentElement;
    const rgb = hexToRgb(themeColor);
    if (rgb && themeColor !== DEFAULT_THEME_COLOR) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      // Update primary color variables
      root.style.setProperty('--home-primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      root.style.setProperty('--ring', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      
      // Update hover states (slightly lighter)
      const hoverL = Math.min(100, hsl.l + 5);
      root.style.setProperty('--home-primary-hover', `${hsl.h} ${hsl.s}% ${hoverL}%`);
      root.style.setProperty('--primary-hover', `${hsl.h} ${hsl.s}% ${hoverL}%`);
    } else if (themeColor === DEFAULT_THEME_COLOR) {
      // Remove custom overrides to use CSS defaults
      root.style.removeProperty('--home-primary');
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--home-primary-hover');
      root.style.removeProperty('--primary-hover');
    }
    localStorage.setItem('themeColor', themeColor);
  }, [themeColor]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setThemeColor = (color: string) => {
    setThemeColorState(color);
  };

  const resetThemeColor = () => {
    setThemeColorState(DEFAULT_THEME_COLOR);
    // The useEffect will handle removing the custom overrides
    localStorage.removeItem('themeColor');
  };

  // Helper functions
  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeColor, setThemeColor, resetThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};


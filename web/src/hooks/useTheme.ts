import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UseThemeReturn {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLightTheme: () => void;
  setDarkTheme: () => void;
  setSystemTheme: () => void;
}

/**
 * Custom hook for managing theme state and switching between light/dark/system modes
 *
 * @returns {UseThemeReturn} Theme state and control functions
 *
 * @example
 * const { theme, effectiveTheme, toggleTheme, setTheme } = useTheme();
 *
 * // Toggle between light and dark
 * toggleTheme();
 *
 * // Set specific theme
 * setTheme('dark');
 *
 * // Check current effective theme (resolved from system preference if theme is 'system')
 * console.log(effectiveTheme); // 'light' or 'dark'
 */
export const useTheme = (): UseThemeReturn => {
  // Initialize theme from localStorage or default to 'system'
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('theme') as ThemeMode;
      return stored || 'system';
    } catch {
      return 'system';
    }
  });

  // Track the system's preferred color scheme
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Calculate the effective theme (resolve 'system' to actual light/dark)
  const effectiveTheme: 'light' | 'dark' = theme === 'system' ? systemPreference : theme;

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      // Remove data-theme attribute to let CSS media queries handle it
      root.removeAttribute('data-theme');
    } else {
      // Set explicit theme
      root.setAttribute('data-theme', theme);
    }

    // Persist theme preference
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, [theme, systemPreference]);

  // Theme setter function
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  // Toggle between light and dark (ignores system mode)
  const toggleTheme = () => {
    setThemeState(prevTheme => {
      // If currently on system mode, toggle based on effective theme
      if (prevTheme === 'system') {
        return effectiveTheme === 'dark' ? 'light' : 'dark';
      }
      // Otherwise toggle between light and dark
      return prevTheme === 'dark' ? 'light' : 'dark';
    });
  };

  // Convenience setters
  const setLightTheme = () => setTheme('light');
  const setDarkTheme = () => setTheme('dark');
  const setSystemTheme = () => setTheme('system');

  return {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setSystemTheme,
  };
};

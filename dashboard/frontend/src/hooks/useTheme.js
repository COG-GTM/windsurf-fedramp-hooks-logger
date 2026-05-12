import { useEffect, useState } from 'react';

const STORAGE_KEY = 'windsurf-theme';

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      window.localStorage.setItem(STORAGE_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      window.localStorage.setItem(STORAGE_KEY, 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return { isDarkMode, toggleTheme };
}

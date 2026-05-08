import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colorScheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  const isDark = colorScheme === 'dark';

  const toggleTheme = useCallback(() => {
    setColorScheme(isDark ? 'light' : 'dark');
  }, [isDark, setColorScheme]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colorScheme: colorScheme ?? 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

/*
 * FILE: src/context/ThemeContext.tsx
 * PURPOSE: Manages the light and dark mode appearance status of the application. It acts as
 *          a bridge between NativeWind (Tailwind styling) and the screens/components.
 * WHERE USED: Wrapped at the root level of the app in App.tsx. Any subcomponent can invoke
 *             `useTheme()` to toggle themes or check if dark mode is active.
 */

// Import React, context creators, hook hooks, types, and callbacks
import React, { createContext, useContext, ReactNode, useCallback } from 'react';
// Import the native color scheme listener hook from NativeWind to adjust Tailwind styling states
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

// Define the properties and functions returned by the useTheme context hook
interface ThemeContextType {
  // True if the active theme is currently dark mode
  isDark: boolean;
  // Function to switch between dark and light modes
  toggleTheme: () => void;
  // String literal representing the active mode ('light' or 'dark')
  colorScheme: 'light' | 'dark';
}

// Create the context container with an initial value of undefined
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ThemeProvider component broadcasts dark/light mode toggle states.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Grab the native color scheme state and setter function from NativeWind SDK
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  // Boolean helper checking if colorScheme is dark mode
  const isDark = colorScheme === 'dark';

  // Toggle callback that switches theme between light and dark
  const toggleTheme = useCallback(() => {
    setColorScheme(isDark ? 'light' : 'dark');
  }, [isDark, setColorScheme]);

  return (
    // Broadcast the variables down the provider hierarchy. Fall back to 'light' if scheme is uninitialized.
    <ThemeContext.Provider value={{ isDark, toggleTheme, colorScheme: colorScheme ?? 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook useTheme allows any component to inspect the current dark/light mode status.
 * Throws helpful error if provider is not present in parent stack.
 */
export const useTheme = (): ThemeContextType => {
  // Extract theme context
  const ctx = useContext(ThemeContext);
  // Throws exception if provider is missing
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  // Return configuration parameters
  return ctx;
};

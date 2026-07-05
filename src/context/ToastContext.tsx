/*
 * FILE: src/context/ToastContext.tsx
 * PURPOSE: Global context provider that manages floating user notification toast alerts. It exposes
 *          functions to trigger or dismiss toasts with custom colors, messages, and display durations.
 * WHERE USED: Wrapped at the root level of the app in App.tsx. Any subcomponent can invoke
 *             `useToast()` to display a visual notification (e.g. success, error warnings).
 */

// Import core React, state managers, callbacks, and reference caching hooks
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Type definition specifying the allowed types of toast styles
type ToastType = 'success' | 'error' | 'info' | 'warning';

// Define the properties and functions exposed by the ToastContext
interface ToastContextType {
  // True if a toast is currently visible on the screen
  visible: boolean;
  // The message text inside the active toast
  message: string;
  // The styling type (determines border and icon colors)
  type: ToastType;
  // Function to show a toast, taking a message string and optional style/duration overrides
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  // Function to instantly hide the active toast (dismiss manually)
  hideToast: () => void;
}

// Create the context container with an initial value of undefined
const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * ToastProvider component wraps application code to broadcast the toast dispatcher.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State hook tracking toast visibility
  const [visible, setVisible] = useState(false);
  // State hook holding the active display message
  const [message, setMessage] = useState('');
  // State hook holding the active toast styling category (defaults to 'info')
  const [type, setType] = useState<ToastType>('info');
  // Cache reference to store the active auto-dismiss timeout ID.
  // This allows us to clear active timers if a new toast overrides an existing one.
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Callback function to instantly hide the toast
  const hideToast = useCallback(() => {
    setVisible(false);
    // If an auto-dismiss timer is running, clear it to free up memory
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  // Callback function to set and display a new toast message
  const showToast = useCallback((msg: string, t: ToastType = 'info', duration: number = 3000) => {
    // If a previous toast is already running, clear its auto-dismiss timer immediately
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Save details to state
    setMessage(msg);
    setType(t);
    setVisible(true);

    // Start a new timer to automatically hide the toast after the specified duration (default: 3 seconds)
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, duration);
  }, []);

  return (
    // Broadcast the variables down the provider hierarchy
    <ToastContext.Provider value={{ visible, message, type, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
};

/**
 * Custom hook useToast allows any component to quickly trigger toast notifications.
 * Throws helpful error if provider is not present in parent stack.
 */
export const useToast = () => {
  // Extract context
  const context = useContext(ToastContext);
  // Throws exception if provider is missing
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  // Return context utilities
  return context;
};

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextType {
  visible: boolean;
  message: string;
  type: ToastType;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    setVisible(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const showToast = useCallback((msg: string, t: ToastType = 'info', duration: number = 3000) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    setMessage(msg);
    setType(t);
    setVisible(true);

    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ visible, message, type, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

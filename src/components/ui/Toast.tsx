'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>('info');

  const toast = useCallback((msg: string, t?: ToastType) => {
    setMessage(msg);
    setType(t ?? 'info');
    setTimeout(() => setMessage(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-md ${
          type === 'success' ? 'border-green-500/30 bg-green-500/15 text-green-400' :
          type === 'error' ? 'border-red-500/30 bg-red-500/15 text-red-400' :
          'border-blue-500/30 bg-blue-500/15 text-blue-400'
        }`}>
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

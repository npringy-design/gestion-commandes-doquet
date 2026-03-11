// =============================================================
// components/Toast.tsx
// Système de notifications toast (messages d'erreur/succès)
// Affiché en bas à droite, disparaît automatiquement après 4s
//
// Usage depuis n'importe quelle page :
//   const { showToast } = useToast();
//   showToast('Fichier importé !', 'success');
//   showToast('Erreur de lecture', 'error');
// =============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// --- Types ---
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id:      number;
  message: string;
  type:    ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// --- Contexte React ---
const ToastContext = createContext<ToastContextValue | null>(null);

// --- Provider : à placer autour de <App /> dans main.tsx ---
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    // Disparaît automatiquement après 4 secondes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Conteneur des toasts — fixed en bas à droite */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// --- Hook pour utiliser les toasts ---
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé à l\'intérieur de <ToastProvider>');
  return ctx;
};

// --- Composant d'un toast individuel ---
const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg:     'bg-emerald-50',
    border: 'border-emerald-400',
    icon: (
      <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
      </svg>
    ),
  },
  error: {
    bg:     'bg-red-50',
    border: 'border-red-400',
    icon: (
      <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    ),
  },
  warning: {
    bg:     'bg-amber-50',
    border: 'border-amber-400',
    icon: (
      <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
    ),
  },
  info: {
    bg:     'bg-blue-50',
    border: 'border-blue-400',
    icon: (
      <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
  },
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const style = TOAST_STYLES[toast.type];

  // Animation d'entrée
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 px-5 py-4 rounded-2xl shadow-xl
        border-l-4 max-w-sm w-full
        transition-all duration-300
        ${style.bg} ${style.border}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      {style.icon}
      <p className="flex-1 text-sm font-bold text-slate-700 leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
};

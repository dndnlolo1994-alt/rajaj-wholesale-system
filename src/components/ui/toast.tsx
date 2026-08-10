'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (title: string, opts?: { description?: string; variant?: ToastVariant }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="size-5 text-primary-600" />,
  error: <AlertCircle className="size-5 text-red-600" />,
  info: <Info className="size-5 text-sky-600" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (title: string, opts?: { description?: string; variant?: ToastVariant }) => {
      const id = ++counter.current;
      const item: ToastItem = { id, title, description: opts?.description, variant: opts?.variant ?? 'info' };
      setItems((prev) => [...prev.slice(-3), item]);
      setTimeout(() => dismiss(id), item.variant === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    toast,
    success: (title, description) => toast(title, { description, variant: 'success' }),
    error: (title, description) => toast(title, { description, variant: 'error' }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3 shadow-pop',
              t.variant === 'error' ? 'border-red-200' : t.variant === 'success' ? 'border-primary-200' : 'border-ink-200',
            )}
          >
            {icons[t.variant]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink-900">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-xs leading-5 text-ink-500">{t.description}</p> : null}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-1 text-ink-500 hover:bg-ink-100" aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-l from-primary-700 to-primary-600 text-white hover:from-primary-800 hover:to-primary-700 active:bg-primary-900 shadow-luxe',
  secondary: 'bg-primary-50 text-primary-900 hover:bg-primary-100 border border-primary-200 shadow-sm',
  ghost: 'text-ink-700 hover:bg-ink-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline: 'border border-ink-300 bg-white text-ink-700 hover:bg-ink-100',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'size-10 shrink-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-extrabold transition-all hover:-translate-y-0.5 active:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

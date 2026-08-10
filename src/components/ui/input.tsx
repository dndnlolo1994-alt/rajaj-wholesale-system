'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-500/70 ' +
  'focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20 disabled:bg-ink-100 disabled:text-ink-500';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);

/** حقل رقمي مالي/كمي: أرقام لاتينية، اتجاه LTR، تحديد الكل عند التركيز */
export const NumericInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { money?: boolean }
>(function NumericInput({ className, money, onFocus, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode={money ? 'decimal' : 'numeric'}
      dir="ltr"
      autoComplete="off"
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      className={cn(inputClass, 'tnum text-end', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-500/70',
          'focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(inputClass, 'appearance-none pe-8 [background:white_url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23667085%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")_no-repeat_left_0.75rem_center]', className)} {...props}>
        {children}
      </select>
    );
  },
);

/** حقل مع عنوان ورسالة خطأ */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label className="block text-sm font-bold text-ink-700">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

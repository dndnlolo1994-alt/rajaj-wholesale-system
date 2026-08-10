'use client';

import { cn } from '@/lib/cn';

/** أزرار اختيار مفردة بشكل شرائح — مناسبة للمس */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-ink-300 bg-ink-100 p-0.5', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-[7px] font-bold transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
            value === opt.value ? 'bg-white text-primary-800 shadow-sm' : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

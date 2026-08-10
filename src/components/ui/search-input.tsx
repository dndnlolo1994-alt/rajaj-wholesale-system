'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** حقل بحث مرتبط بمعامل URL مع تأخير (debounce) — الفلترة تتم في الخادم */
export function SearchInput({
  param = 'q',
  placeholder = 'بحث...',
  className,
  autoFocus,
}: {
  param?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get(param) ?? '';
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(param, value);
      else params.delete(param);
      params.delete('page');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-11 w-full rounded-lg border border-ink-300 bg-white ps-9 pe-9 text-sm focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20"
      />
      {value ? (
        <button
          onClick={() => setValue('')}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-500 hover:bg-ink-100"
          aria-label="مسح"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

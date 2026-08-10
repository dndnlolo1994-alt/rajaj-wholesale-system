'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

/** تبويبات عبر معامل URL (?tab=...) — تعمل مع Server Components */
export function LinkTabs({
  param = 'tab',
  tabs,
  className,
}: {
  param?: string;
  tabs: { value: string; label: React.ReactNode; count?: number }[];
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(param) ?? tabs[0]?.value;

  return (
    <div className={cn('scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b border-ink-200 px-1', className)}>
      {tabs.map((tab) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(param, tab.value);
        params.delete('page');
        return (
          <Link
            key={tab.value}
            href={`${pathname}?${params.toString()}`}
            replace
            scroll={false}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold transition-colors',
              active === tab.value
                ? 'border-primary-700 text-primary-800'
                : 'border-transparent text-ink-500 hover:text-ink-700',
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span className="tnum rounded-full bg-ink-100 px-1.5 text-xs">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

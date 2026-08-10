'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './button';

/** ترقيم صفحات عبر معامل URL — يعمل مع الاستعلامات الخادمية */
export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (pages <= 1) return null;

  const go = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center justify-between gap-2 py-3">
      <p className="text-xs text-ink-500">
        صفحة <span className="tnum font-bold">{page}</span> من <span className="tnum font-bold">{pages}</span>
        {' — '}
        <span className="tnum">{total}</span> سجل
      </p>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronRight className="size-4" />
          السابق
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go(page + 1)}>
          التالي
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}

'use client';

// شريط فلترة الفترة الموحّد لصفحات التقارير:
// chips للفترات الجاهزة (يكتب ?period=) أو مدى مخصص (يكتب ?from=&to=)
// + زر طباعة، وslot لأزرار إضافية (كزر التصدير)

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { periodLabels, type PeriodPreset } from '@/lib/format/date';

const PRESETS: PeriodPreset[] = ['today', 'yesterday', 'week', 'this_month', 'last_month', 'this_year'];

export function PeriodFilter({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlFrom = searchParams.get('from') ?? '';
  const urlTo = searchParams.get('to') ?? '';
  const isCustom = Boolean(urlFrom && urlTo);
  const periodParam = searchParams.get('period');
  const activePreset: PeriodPreset | null = isCustom
    ? null
    : PRESETS.includes(periodParam as PeriodPreset)
      ? (periodParam as PeriodPreset)
      : 'this_month';

  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);

  // مزامنة الحقول عند تغيّر الـ URL
  useEffect(() => {
    setFrom(urlFrom);
    setTo(urlTo);
  }, [urlFrom, urlTo]);

  const replaceParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const pickPreset = (preset: PeriodPreset) => {
    replaceParams((p) => {
      p.set('period', preset);
      p.delete('from');
      p.delete('to');
    });
  };

  const applyCustom = () => {
    if (!from || !to) return;
    replaceParams((p) => {
      p.delete('period');
      p.set('from', from);
      p.set('to', to);
    });
  };

  return (
    <div className="no-print mb-4 space-y-2.5 rounded-[--radius-card] border border-ink-200 bg-white p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => pickPreset(preset)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              activePreset === preset
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-100',
            )}
          >
            {periodLabels[preset]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="من تاريخ"
          className="h-9 rounded-lg border border-ink-300 bg-white px-2.5 text-sm"
        />
        <span className="text-xs text-ink-500">إلى</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="إلى تاريخ"
          className="h-9 rounded-lg border border-ink-300 bg-white px-2.5 text-sm"
        />
        <Button variant={isCustom ? 'secondary' : 'outline'} size="sm" onClick={applyCustom} disabled={!from || !to}>
          تطبيق
        </Button>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {children}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            طباعة
          </Button>
        </div>
      </div>
    </div>
  );
}

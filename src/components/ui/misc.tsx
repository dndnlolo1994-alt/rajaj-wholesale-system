import Link from 'next/link';
import { Loader2, PackageOpen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatJOD } from '@/lib/calc/money';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-primary-600', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-ink-200/60', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-2xl bg-ink-100 p-4 text-ink-500">{icon ?? <PackageOpen className="size-8" />}</div>
      <p className="mt-1 text-base font-extrabold text-ink-900">{title}</p>
      {description ? <p className="max-w-sm text-sm leading-6 text-ink-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** مبلغ مالي منسّق — أخضر/أحمر عند الطلب */
export function Money({
  value,
  signed,
  className,
  symbol = true,
}: {
  value: number | string | null | undefined;
  signed?: boolean;
  className?: string;
  symbol?: boolean;
}) {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  const tone = !signed ? '' : n > 0 ? 'text-[--color-money-pos]' : n < 0 ? 'text-[--color-money-neg]' : '';
  return (
    <span dir="ltr" className={cn('tnum whitespace-nowrap font-bold', tone, className)}>
      {formatJOD(n, { symbol })}
    </span>
  );
}

/** بطاقة مؤشر KPI للوحة التحكم */
export function StatCard({
  title,
  value,
  icon,
  sub,
  tone = 'default',
  href,
}: {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  href?: string;
}) {
  const tones = {
    default: 'border-primary-100/80 bg-gradient-to-br from-white to-primary-50/55',
    success: 'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70',
    danger: 'border-rose-100 bg-gradient-to-br from-white to-rose-50/65',
    warning: 'border-amber-100 bg-gradient-to-br from-white to-amber-50/70',
    info: 'border-sky-100 bg-gradient-to-br from-white to-sky-50/70',
  };
  const iconTones = {
    default: 'bg-primary-50 text-primary-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-600',
    info: 'bg-sky-50 text-sky-700',
  };
  const inner = (
    <div className={cn('group relative flex h-full min-h-24 items-start justify-between gap-3 overflow-hidden rounded-[--radius-card] border p-3.5 shadow-card ring-1 ring-white transition-all', tones[tone], href && 'hover:-translate-y-0.5 hover:shadow-pop')}>
      <div className="min-w-0">
        <p className="truncate text-xs font-extrabold text-ink-500">{title}</p>
        <div className="mt-2 text-xl font-black tracking-tight text-ink-900">{value}</div>
        {sub ? <div className="mt-1 text-xs font-medium text-ink-500">{sub}</div> : null}
      </div>
      {icon ? <div className={cn('relative shrink-0 rounded-lg p-2 shadow-sm ring-1 ring-white/80 transition-transform group-hover:scale-105', iconTones[tone])}>{icon}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-black tracking-tight text-ink-900 lg:text-2xl">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

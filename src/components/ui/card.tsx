import { cn } from '@/lib/cn';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-[--radius-card] border border-ink-200/80 bg-white shadow-card ring-1 ring-white/70', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-ink-100/90 px-4 py-3', className)}>
      <h3 className="text-sm font-black tracking-tight text-ink-900">{title}</h3>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

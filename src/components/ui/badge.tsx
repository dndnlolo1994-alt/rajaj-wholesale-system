import { cn } from '@/lib/cn';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const tones: Record<Tone, string> = {
  default: 'bg-primary-50 text-primary-800 border-primary-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  muted: 'bg-ink-100 text-ink-500 border-ink-200',
};

export function Badge({
  tone = 'default',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** شارة حالة المستند */
export function StatusBadge({ status }: { status: 'completed' | 'void' | 'open' | 'closed' | 'cancelled' }) {
  const map = {
    completed: { tone: 'success' as Tone, label: 'مكتملة' },
    void: { tone: 'danger' as Tone, label: 'ملغاة' },
    open: { tone: 'info' as Tone, label: 'مفتوحة' },
    closed: { tone: 'muted' as Tone, label: 'مغلقة' },
    cancelled: { tone: 'muted' as Tone, label: 'ملغاة' },
  };
  const item = map[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BellOff, CheckCheck, Info, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { fmtRelative } from '@/lib/format/date';
import type { NotifSeverity, Notification } from '@/lib/types/db';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/server/actions/notifications';

// خريطة التوجيه حسب الجدول المرجعي
const refRoutes: Record<string, (refId: string) => string> = {
  customers: (id) => `/customers/${id}`,
  products: (id) => `/products/${id}`,
  sales: (id) => `/sales/${id}`,
  inventory_counts: (id) => `/inventory/counts/${id}`,
  cash_sessions: () => '/cashbox?tab=sessions',
};

const severityIcons: Record<NotifSeverity, React.ReactNode> = {
  info: <Info className="size-5 text-sky-600" />,
  warning: <TriangleAlert className="size-5 text-amber-600" />,
  critical: <AlertCircle className="size-5 text-red-600" />,
};

export function NotificationsClient({ rows }: { rows: Notification[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [markingAll, setMarkingAll] = useState(false);

  const markAll = async () => {
    setMarkingAll(true);
    const res = await markAllNotificationsReadAction();
    setMarkingAll(false);
    if (res.ok) {
      success('عُلّمت كل التنبيهات كمقروءة');
      router.refresh();
    } else {
      error('تعذر التحديث', res.error.message);
    }
  };

  const openNotification = async (n: Notification) => {
    if (!n.is_read) await markNotificationReadAction(n.id);
    const route = n.ref_table ? refRoutes[n.ref_table] : undefined;
    if (route && (n.ref_id || n.ref_table === 'cash_sessions')) {
      router.push(route(n.ref_id ?? ''));
    } else {
      router.refresh();
    }
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={markAll} loading={markingAll}>
          <CheckCheck className="size-4" />
          تعليم الكل كمقروء
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff className="size-8" />}
            title="لا تنبيهات"
            description="ستظهر هنا تنبيهات النظام: مخزون منخفض، ديون متأخرة، فروقات الصندوق..."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openNotification(n)}
              className={cn(
                'block w-full rounded-[--radius-card] border border-ink-200 p-3.5 text-start shadow-card transition-colors hover:border-primary-300',
                n.is_read ? 'bg-white' : 'bg-primary-50/60',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{severityIcons[n.severity]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink-900">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-sm leading-6 text-ink-600">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-ink-500">{fmtRelative(n.created_at)}</p>
                </div>
                {!n.is_read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-600" /> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

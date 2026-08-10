import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage, canSeeProfit } from '@/lib/perms';
import { getInventoryCount } from '@/server/queries/products';
import { PageHeader } from '@/components/ui/misc';
import { Card, CardBody } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmtDateTime } from '@/lib/format/date';
import { CountClient, type CountHeader, type CountItem } from './count-client';

export const dynamic = 'force-dynamic';

const countTypeLabels: Record<string, string> = {
  daily: 'يومي',
  monthly: 'شهري',
  manual: 'يدوي',
};

export default async function CountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;

  const data = await getInventoryCount(id);
  if (!data) notFound();
  const { count, items } = data;

  const header: CountHeader = {
    id: count.id,
    count_no: count.count_no,
    count_type: count.count_type,
    status: count.status,
    items_total: count.items_total,
    total_diff_units: count.total_diff_units,
    total_diff_value: Number(count.total_diff_value),
  };

  const clientItems: CountItem[] = items.map((i) => ({
    id: i.id,
    product_id: i.product_id,
    product_name: i.product_name,
    barcode: i.barcode,
    expected_units: i.expected_units,
    actual_units: i.actual_units,
    diff_units: i.diff_units,
    diff_value: i.diff_value == null ? null : Number(i.diff_value),
    units_per_carton: i.product?.units_per_carton ?? 1,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`جلسة جرد ${count.count_no}`}
        description={`${countTypeLabels[count.count_type] ?? count.count_type} — ${fmtDateTime(count.created_at)}`}
        actions={
          <Link href="/inventory?tab=counts">
            <Button variant="ghost" size="sm">
              <ArrowRight className="size-4" />
              الجرد
            </Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <StatusBadge status={count.status} />
          <span className="text-ink-500">
            القسم: <span className="font-bold text-ink-900">{count.category?.name ?? 'كل الأقسام'}</span>
          </span>
          <span className="text-ink-500">
            فتحها: <span className="font-bold text-ink-900">{count.created_by_profile?.full_name ?? '—'}</span>
          </span>
          {count.completed_at ? (
            <span className="text-ink-500">اعتُمدت: {fmtDateTime(count.completed_at)}</span>
          ) : null}
          {count.cancelled_at ? (
            <span className="text-ink-500">أُلغيت: {fmtDateTime(count.cancelled_at)}</span>
          ) : null}
          {count.notes ? (
            <span className="w-full rounded-lg bg-amber-50 p-2 text-xs text-amber-800">ملاحظة: {count.notes}</span>
          ) : null}
        </CardBody>
      </Card>

      <CountClient
        count={header}
        items={clientItems}
        showProfit={canSeeProfit(profile.role)}
        canCount={['owner', 'manager', 'warehouse'].includes(profile.role)}
        canComplete={canManage(profile.role)}
      />
    </div>
  );
}

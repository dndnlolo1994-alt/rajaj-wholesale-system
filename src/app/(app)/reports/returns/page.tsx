import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { resolvePeriod, returnsList } from '@/server/queries/reports';
import { PeriodFilter } from '@/components/reports/period-filter';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { fmtDateShort } from '@/lib/format/date';

export const metadata = { title: 'تقرير المرتجعات' };
export const dynamic = 'force-dynamic';

interface SP {
  period?: string;
  from?: string;
  to?: string;
}

export default async function ReturnsReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProfile();
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);

  const { rows, totals } = await returnsList(from, to);

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="تقرير المرتجعات"
        description={`${fmtDateShort(`${from}T12:00:00`)} — ${fmtDateShort(`${to}T12:00:00`)}`}
      />

      <PeriodFilter>
        <ExportButton reportKey="returns" from={from} to={to} />
      </PeriodFilter>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          title="عدد المرتجعات"
          value={<span className="tnum">{totals.count}</span>}
          icon={<RotateCcw className="size-5" />}
        />
        <StatCard title="إجمالي المرتجعات" value={<Money value={totals.total} />} tone="warning" />
        <StatCard title="المردود نقدًا" value={<Money value={totals.refund_cash} />} tone="danger" />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا مرتجعات في هذه الفترة" description="جرّب فترة أخرى من شريط الفلترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">الرقم</th>
                  <th className="px-4 py-3 text-start font-bold">فاتورة الأصل</th>
                  <th className="px-4 py-3 text-start font-bold">العميل</th>
                  <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                  <th className="px-4 py-3 text-end font-bold">القيمة</th>
                  <th className="px-4 py-3 text-start font-bold">السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/returns/${r.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                        {r.return_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/sales/${r.sale_id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                        {r.sale?.invoice_no ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-bold">{r.customer?.name ?? 'زبون نقدي'}</td>
                    <td className="px-4 py-3 text-ink-500">{fmtDateShort(r.return_date)}</td>
                    <td className="px-4 py-3 text-end"><Money value={r.total} /></td>
                    <td className="max-w-52 truncate px-4 py-3 text-ink-500">{r.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

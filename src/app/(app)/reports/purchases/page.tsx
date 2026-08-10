import { PackagePlus } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { purchasesSummary, resolvePeriod } from '@/server/queries/reports';
import { PeriodFilter } from '@/components/reports/period-filter';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { fmtDateShort } from '@/lib/format/date';

export const metadata = { title: 'تقرير المشتريات' };
export const dynamic = 'force-dynamic';

interface SP {
  period?: string;
  from?: string;
  to?: string;
}

export default async function PurchasesReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProfile();
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);

  const { rows, totals } = await purchasesSummary(from, to);

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="تقرير المشتريات"
        description={`${fmtDateShort(`${from}T12:00:00`)} — ${fmtDateShort(`${to}T12:00:00`)}`}
      />

      <PeriodFilter>
        <ExportButton reportKey="purchases" from={from} to={to} />
      </PeriodFilter>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="إجمالي المشتريات"
          value={<Money value={totals.total} />}
          icon={<PackagePlus className="size-5" />}
        />
        <StatCard title="المدفوع" value={<Money value={totals.paid} />} tone="success" />
        <StatCard
          title="المتبقي"
          value={<Money value={totals.remaining} />}
          tone={totals.remaining > 0 ? 'danger' : 'default'}
        />
        <StatCard title="عدد الفواتير" value={<span className="tnum">{totals.count}</span>} />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا مشتريات في هذه الفترة" description="جرّب فترة أخرى من شريط الفلترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">المورد</th>
                  <th className="px-4 py-3 text-end font-bold">عدد الفواتير</th>
                  <th className="px-4 py-3 text-end font-bold">الإجمالي</th>
                  <th className="px-4 py-3 text-end font-bold">المدفوع</th>
                  <th className="px-4 py-3 text-end font-bold">المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.supplier_id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3 font-bold">{r.name}</td>
                    <td className="tnum px-4 py-3 text-end">{r.count}</td>
                    <td className="px-4 py-3 text-end"><Money value={r.total} /></td>
                    <td className="px-4 py-3 text-end"><Money value={r.paid} symbol={false} /></td>
                    <td className="px-4 py-3 text-end">
                      {r.remaining > 0 ? (
                        <Money value={r.remaining} className="text-red-600" symbol={false} />
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300 bg-ink-100/50 font-extrabold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="tnum px-4 py-3 text-end">{totals.count}</td>
                  <td className="px-4 py-3 text-end"><Money value={totals.total} /></td>
                  <td className="px-4 py-3 text-end"><Money value={totals.paid} symbol={false} /></td>
                  <td className="px-4 py-3 text-end">
                    <Money value={totals.remaining} className={totals.remaining > 0 ? 'text-red-600' : ''} symbol={false} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

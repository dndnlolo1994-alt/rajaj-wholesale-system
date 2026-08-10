import Link from 'next/link';
import { Banknote } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { reportExpensesSummary, resolvePeriod } from '@/server/queries/reports';
import { PeriodFilter } from '@/components/reports/period-filter';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { formatPercent } from '@/lib/calc/money';
import { fmtDateShort } from '@/lib/format/date';

export const metadata = { title: 'تقرير المصاريف' };
export const dynamic = 'force-dynamic';

interface SP {
  period?: string;
  from?: string;
  to?: string;
}

export default async function ExpensesReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProfile();
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);

  const s = await reportExpensesSummary(from, to);

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="تقرير المصاريف"
        description={`${fmtDateShort(`${from}T12:00:00`)} — ${fmtDateShort(`${to}T12:00:00`)}`}
        actions={
          <Link href="/expenses" className="no-print text-sm font-bold text-primary-700 hover:underline">
            تفاصيل المصروفات
          </Link>
        }
      />

      <PeriodFilter>
        <ExportButton reportKey="expenses" from={from} to={to} />
      </PeriodFilter>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="إجمالي المصاريف"
          value={<Money value={s.total} />}
          tone="danger"
          icon={<Banknote className="size-5" />}
        />
        <StatCard title="عدد الحركات" value={<span className="tnum">{s.count}</span>} />
      </div>

      <Card>
        {s.by_category.length === 0 ? (
          <EmptyState title="لا مصاريف في هذه الفترة" description="جرّب فترة أخرى من شريط الفلترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">التصنيف</th>
                  <th className="px-4 py-3 text-end font-bold">العدد</th>
                  <th className="px-4 py-3 text-end font-bold">الإجمالي</th>
                  <th className="px-4 py-3 text-end font-bold">نسبة من الكل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {s.by_category.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3 font-bold">{c.name}</td>
                    <td className="tnum px-4 py-3 text-end">{c.cnt}</td>
                    <td className="px-4 py-3 text-end"><Money value={c.total} /></td>
                    <td className="tnum px-4 py-3 text-end font-bold text-ink-500">
                      {formatPercent(s.total > 0 ? (c.total / s.total) * 100 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300 bg-ink-100/50 font-extrabold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="tnum px-4 py-3 text-end">{s.count}</td>
                  <td className="px-4 py-3 text-end"><Money value={s.total} /></td>
                  <td className="tnum px-4 py-3 text-end">{formatPercent(s.total > 0 ? 100 : 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { reportSales, resolvePeriod, type SalesGroup } from '@/server/queries/reports';
import { PeriodFilter } from '@/components/reports/period-filter';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { BarChart } from '@/components/charts/bar-chart';
import { fmtDateShort } from '@/lib/format/date';
import { cn } from '@/lib/cn';

export const metadata = { title: 'تقرير المبيعات' };
export const dynamic = 'force-dynamic';

interface SP {
  period?: string;
  from?: string;
  to?: string;
  group?: string;
}

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const showProfit = canSeeProfit(profile.role);
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const group: SalesGroup = sp.group === 'month' ? 'month' : 'day';

  const { rows, totals } = await reportSales(from, to, group);

  const periodLabel = (p: string) =>
    group === 'month' ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : fmtDateShort(`${p}T12:00:00`);
  const chartData = rows.map((r) => ({
    label: group === 'month' ? `${r.period.slice(5, 7)}/${r.period.slice(0, 4)}` : `${r.period.slice(8, 10)}/${r.period.slice(5, 7)}`,
    hint: periodLabel(r.period),
    value: r.net_total,
  }));

  const groupHref = (g: SalesGroup) => {
    const params = new URLSearchParams();
    if (sp.from && sp.to) {
      params.set('from', sp.from);
      params.set('to', sp.to);
    } else if (sp.period) {
      params.set('period', sp.period);
    }
    params.set('group', g);
    return `/reports/sales?${params.toString()}`;
  };

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="تقرير المبيعات"
        description={`${fmtDateShort(`${from}T12:00:00`)} — ${fmtDateShort(`${to}T12:00:00`)}`}
      />

      <PeriodFilter>
        <ExportButton reportKey="sales" from={from} to={to} />
      </PeriodFilter>

      {/* تبديل التجميع */}
      <div className="no-print mb-3 flex items-center gap-2">
        <span className="text-xs font-bold text-ink-500">التجميع:</span>
        {(['day', 'month'] as const).map((g) => (
          <Link
            key={g}
            href={groupHref(g)}
            replace
            scroll={false}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              group === g
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-100',
            )}
          >
            {g === 'day' ? 'يوم' : 'شهر'}
          </Link>
        ))}
      </div>

      <div className={cn('mb-4 grid grid-cols-2 gap-3', showProfit ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <StatCard title="صافي المبيعات" value={<Money value={totals.net_total} />} />
        <StatCard title="عدد الفواتير" value={<span className="tnum">{totals.invoices}</span>} />
        <StatCard title="الخصومات" value={<Money value={totals.discount} />} />
        <StatCard title="المرتجعات" value={<Money value={totals.returns_total} />} />
        {showProfit ? (
          <StatCard title="صافي الربح" value={<Money value={totals.net_profit} signed />} tone="success" />
        ) : null}
      </div>

      {rows.length > 0 ? (
        <Card className="mb-4">
          <CardHeader title="صافي المبيعات عبر الفترات" />
          <CardBody>
            <BarChart data={chartData} color="#0e8a5e" />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا مبيعات في هذه الفترة" description="جرّب فترة أخرى من شريط الفلترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">الفترة</th>
                  <th className="px-4 py-3 text-end font-bold">عدد الفواتير</th>
                  <th className="px-4 py-3 text-end font-bold">الإجمالي</th>
                  <th className="px-4 py-3 text-end font-bold">الخصم</th>
                  <th className="px-4 py-3 text-end font-bold">المرتجعات</th>
                  <th className="px-4 py-3 text-end font-bold">الصافي</th>
                  {showProfit ? <th className="px-4 py-3 text-end font-bold">التكلفة</th> : null}
                  {showProfit ? <th className="px-4 py-3 text-end font-bold">الربح</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.period} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3 font-bold">{periodLabel(r.period)}</td>
                    <td className="tnum px-4 py-3 text-end">{r.invoices}</td>
                    <td className="px-4 py-3 text-end"><Money value={r.total} symbol={false} /></td>
                    <td className="px-4 py-3 text-end"><Money value={r.discount} symbol={false} /></td>
                    <td className="px-4 py-3 text-end"><Money value={r.returns_total} symbol={false} /></td>
                    <td className="px-4 py-3 text-end"><Money value={r.net_total} /></td>
                    {showProfit ? (
                      <td className="px-4 py-3 text-end"><Money value={r.cost} symbol={false} /></td>
                    ) : null}
                    {showProfit ? (
                      <td className="px-4 py-3 text-end"><Money value={r.net_profit} signed symbol={false} /></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300 bg-ink-100/50 font-extrabold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="tnum px-4 py-3 text-end">{totals.invoices}</td>
                  <td className="px-4 py-3 text-end"><Money value={totals.total} symbol={false} /></td>
                  <td className="px-4 py-3 text-end"><Money value={totals.discount} symbol={false} /></td>
                  <td className="px-4 py-3 text-end"><Money value={totals.returns_total} symbol={false} /></td>
                  <td className="px-4 py-3 text-end"><Money value={totals.net_total} /></td>
                  {showProfit ? (
                    <td className="px-4 py-3 text-end"><Money value={totals.cost} symbol={false} /></td>
                  ) : null}
                  {showProfit ? (
                    <td className="px-4 py-3 text-end"><Money value={totals.net_profit} signed symbol={false} /></td>
                  ) : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

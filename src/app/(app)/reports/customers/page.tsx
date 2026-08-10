import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { reportByCustomer, resolvePeriod, type CustomerOrder } from '@/server/queries/reports';
import { PeriodFilter } from '@/components/reports/period-filter';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateShort } from '@/lib/format/date';
import { cn } from '@/lib/cn';

export const metadata = { title: 'تقرير العملاء' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

interface SP {
  period?: string;
  from?: string;
  to?: string;
  order?: string;
  page?: string;
}

export default async function CustomersReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const showProfit = canSeeProfit(profile.role);
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const order: CustomerOrder = sp.order === 'paid' ? 'paid' : sp.order === 'profit' && showProfit ? 'profit' : 'sales';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const { rows, total_count } = await reportByCustomer(from, to, order, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  const orders: { value: CustomerOrder; label: string }[] = [
    { value: 'sales', label: 'المبيعات' },
    { value: 'paid', label: 'المدفوع' },
    ...(showProfit ? [{ value: 'profit' as const, label: 'الربح' }] : []),
  ];

  const orderHref = (o: CustomerOrder) => {
    const params = new URLSearchParams();
    if (sp.from && sp.to) {
      params.set('from', sp.from);
      params.set('to', sp.to);
    } else if (sp.period) {
      params.set('period', sp.period);
    }
    params.set('order', o);
    return `/reports/customers?${params.toString()}`;
  };

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="تقرير حسب العميل"
        description={`${fmtDateShort(`${from}T12:00:00`)} — ${fmtDateShort(`${to}T12:00:00`)} — ${total_count} عميل`}
      />

      <PeriodFilter>
        <ExportButton reportKey="customers" from={from} to={to} />
      </PeriodFilter>

      {/* الترتيب */}
      <div className="no-print mb-3 flex items-center gap-2">
        <span className="text-xs font-bold text-ink-500">الترتيب حسب:</span>
        {orders.map((o) => (
          <Link
            key={o.value}
            href={orderHref(o.value)}
            replace
            scroll={false}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
              order === o.value
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-100',
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا حركة عملاء في هذه الفترة" description="جرّب فترة أخرى من شريط الفلترة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">العميل</th>
                  <th className="px-4 py-3 text-end font-bold">فواتير</th>
                  <th className="px-4 py-3 text-end font-bold">المبيعات</th>
                  <th className="px-4 py-3 text-end font-bold">المدفوع</th>
                  <th className="px-4 py-3 text-end font-bold">المرتجعات</th>
                  <th className="px-4 py-3 text-end font-bold">صافي المبيعات</th>
                  {showProfit ? <th className="px-4 py-3 text-end font-bold">الربح</th> : null}
                  <th className="px-4 py-3 text-end font-bold">رصيده الحالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${r.id}`} className="font-bold text-primary-700 hover:underline">
                        {r.name}
                      </Link>
                      {r.shop_name ? <p className="text-xs text-ink-500">{r.shop_name}</p> : null}
                    </td>
                    <td className="tnum px-4 py-3 text-end">{r.invoices}</td>
                    <td className="px-4 py-3 text-end"><Money value={r.sales_total} symbol={false} /></td>
                    <td className="px-4 py-3 text-end"><Money value={r.paid_total} symbol={false} /></td>
                    <td className="px-4 py-3 text-end">
                      {r.returns_total > 0 ? (
                        <Money value={r.returns_total} className="text-amber-700" symbol={false} />
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end"><Money value={r.net_sales} /></td>
                    {showProfit ? (
                      <td className="px-4 py-3 text-end"><Money value={r.net_profit} signed symbol={false} /></td>
                    ) : null}
                    <td className="px-4 py-3 text-end">
                      <Money value={r.balance} className={r.balance > 0 ? 'text-red-600' : ''} symbol={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="no-print">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total_count} />
      </div>
    </div>
  );
}

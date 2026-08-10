import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import {
  reportByCustomer, reportByProduct, reportProfitSummary, reportSales, resolvePeriod,
} from '@/server/queries/reports';
import { PeriodFilter } from '@/components/reports/period-filter';
import { Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { BarChart } from '@/components/charts/bar-chart';
import { formatJOD, formatPercent } from '@/lib/calc/money';
import { fmtDateShort, fmtWeekday, periodRange } from '@/lib/format/date';

export const metadata = { title: 'الأرباح' };
export const dynamic = 'force-dynamic';

interface SP {
  period?: string;
  from?: string;
  to?: string;
}

export default async function ProfitPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProfile(['owner', 'manager', 'accountant']);
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const week = periodRange('week');

  const [s, topProducts, topCustomers, weekSales] = await Promise.all([
    reportProfitSummary(from, to),
    reportByProduct(from, to, 'profit', 10, 0),
    reportByCustomer(from, to, 'profit', 10, 0),
    reportSales(week.from, week.to, 'day'),
  ]);

  const profitSeries = weekSales.rows.map((r) => ({
    label: fmtWeekday(`${r.period}T12:00:00`),
    hint: fmtDateShort(`${r.period}T12:00:00`),
    value: r.net_profit,
  }));

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="الأرباح"
        description={`${fmtDateShort(`${from}T12:00:00`)} — ${fmtDateShort(`${to}T12:00:00`)}`}
      />

      <PeriodFilter />

      {/* ===== قصة الربح (P&L) ===== */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="الإيراد" value={<Money value={s.revenue} />} />
        <StatCard title="المرتجعات" value={<Money value={s.returns_total} />} tone="warning" />
        <StatCard title="صافي الإيراد" value={<Money value={s.net_revenue} />} />
        <StatCard title="تكلفة البضاعة" value={<Money value={s.cogs} />} />
        <StatCard
          title="مجمل الربح"
          value={<Money value={s.gross_profit} signed />}
          tone="success"
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard title="المصاريف" value={<Money value={s.expenses} />} tone="danger" />
      </div>

      {/* صافي الربح — الأبرز */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[--radius-card] border-2 border-emerald-200 bg-emerald-50 p-5 shadow-card">
        <div>
          <p className="text-base font-extrabold text-emerald-900">صافي الربح</p>
          <p className="mt-0.5 text-xs text-emerald-800/70">مجمل الربح − المصاريف</p>
        </div>
        <Money value={s.net_profit} signed className="text-3xl" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="هامش مجمل الربح" value={<span className="tnum">{formatPercent(s.gross_margin)}</span>} />
        <StatCard title="هامش صافي الربح" value={<span className="tnum">{formatPercent(s.net_margin)}</span>} />
        <StatCard
          title="متوسط الربح لكل فاتورة"
          value={<Money value={s.avg_profit_per_invoice} />}
          sub={`${s.invoices} فاتورة`}
        />
        <StatCard
          title="متوسط الربح لكل عميل"
          value={<Money value={s.avg_profit_per_customer} />}
          sub={`${s.customers} عميل`}
        />
      </div>

      {/* ===== الأعلى ربحًا ===== */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="الأعلى ربحًا (أصناف)"
            action={
              <Link href="/reports/products?order=profit" className="no-print text-xs font-bold text-primary-700 hover:underline">
                الكل
              </Link>
            }
          />
          {topProducts.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">لا بيانات في هذه الفترة</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {topProducts.rows.map((p) => (
                <Link
                  key={p.product_id}
                  href={`/products/${p.product_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-primary-50/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{p.product_name}</p>
                    <p className="text-xs text-ink-500">إيراد {formatJOD(p.net_revenue)}</p>
                  </div>
                  <Money value={p.net_profit} signed className="shrink-0 text-sm" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="الأعلى ربحًا (عملاء)"
            action={
              <Link href="/reports/customers?order=profit" className="no-print text-xs font-bold text-primary-700 hover:underline">
                الكل
              </Link>
            }
          />
          {topCustomers.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">لا بيانات في هذه الفترة</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {topCustomers.rows.map((c) => (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-primary-50/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{c.name}</p>
                    <p className="truncate text-xs text-ink-500">{c.shop_name ?? `${c.invoices} فاتورة`}</p>
                  </div>
                  <Money value={c.net_profit} signed className="shrink-0 text-sm" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ===== أرباح آخر 7 أيام ===== */}
      <Card>
        <CardHeader title="الأرباح — آخر 7 أيام" />
        <CardBody>
          <BarChart data={profitSeries} color="#b45309" />
        </CardBody>
      </Card>
    </div>
  );
}

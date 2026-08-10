import Link from 'next/link';
import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, Bell, Boxes,
  HandCoins, PackagePlus, ReceiptText, RotateCcw, TrendingUp, Wallet,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { fetchDashboard } from '@/server/queries/dashboard';
import { Money, StatCard } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { BarChart } from '@/components/charts/bar-chart';
import { formatQty } from '@/lib/calc/units';
import { fmtDateShort, fmtRelative, fmtTime, fmtWeekday } from '@/lib/format/date';
import { formatJOD } from '@/lib/calc/money';

export const dynamic = 'force-dynamic';

const moveLabels: Record<string, string> = {
  purchase: 'شراء',
  sale: 'بيع',
  sale_return: 'مرتجع',
  sale_void: 'إلغاء بيع',
  purchase_void: 'إلغاء شراء',
  return_void: 'إلغاء مرتجع',
  adjustment: 'تعديل',
  count_adjustment: 'تسوية جرد',
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const showProfit = canSeeProfit(profile.role);
  const d = await fetchDashboard();

  const netToday = d.today.sales_total - d.today_returns.total;
  const netProfitToday = d.today.profit + d.today_returns.profit_delta;

  const series = d.series7.map((p) => ({
    label: fmtWeekday(p.day + 'T12:00:00'),
    hint: fmtDateShort(p.day + 'T12:00:00'),
    value: p.sales,
  }));
  const profitSeries = d.series7.map((p) => ({
    label: fmtWeekday(p.day + 'T12:00:00'),
    hint: fmtDateShort(p.day + 'T12:00:00'),
    value: p.profit,
  }));

  const monthDelta = pctDelta(d.compare.this_month.sales, d.compare.last_month.sales);
  const dayDelta = pctDelta(d.compare.today.sales, d.compare.yesterday.sales);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200/80 pb-4">
        <div>
          <p className="text-xs font-extrabold text-primary-700">لوحة القيادة</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink-900">مرحباً {profile.full_name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-ink-500">نظرة مرتبة على البيع، الصندوق، الديون، والمخزون.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pos"
            className="rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-card transition hover:bg-primary-800"
          >
            بيع جديد
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800 shadow-card transition hover:bg-ink-50"
          >
            التقارير
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="صافي مبيعات اليوم"
          value={<Money value={netToday} />}
          sub={`${d.today.sales_count} فاتورة${dayDelta ? ` · ${dayDelta}` : ''}`}
          icon={<ReceiptText className="size-5" />}
          href="/sales"
        />
        {showProfit ? (
          <StatCard
            title="ربح اليوم"
            value={<Money value={netProfitToday} signed />}
            icon={<TrendingUp className="size-5" />}
            tone="success"
            href="/profit"
          />
        ) : (
          <StatCard
            title="المقبوضات"
            value={<Money value={d.today_cash.receipts} />}
            icon={<ArrowDownToLine className="size-5" />}
            tone="success"
            href="/cashbox"
          />
        )}
        <StatCard
          title="رصيد الصندوق"
          value={<Money value={d.cash_balance} signed />}
          icon={<Wallet className="size-5" />}
          tone="info"
          href="/cashbox"
        />
        <StatCard
          title="قيمة المخزون"
          value={<Money value={d.stock.value} />}
          sub={`${d.stock.products_count} صنف فعال`}
          icon={<Boxes className="size-5" />}
          href="/inventory"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_.85fr]">
        <Card>
          <CardHeader title="مختصر التشغيل" action={<Link href="/day-summary" className="text-xs font-bold text-primary-700 hover:underline">ملخص اليوم</Link>} />
          <CardBody className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CompactMetric title="مقبوضات اليوم" value={<Money value={d.today_cash.receipts} />} icon={<ArrowDownToLine className="size-4" />} />
            <CompactMetric title="مدفوعات الموردين" value={<Money value={d.today_cash.payments} />} icon={<ArrowUpFromLine className="size-4" />} />
            <CompactMetric title="مشتريات اليوم" value={<Money value={d.today_purchases.total} />} sub={`${d.today_purchases.count} فاتورة`} icon={<PackagePlus className="size-4" />} />
            <CompactMetric title="مرتجعات اليوم" value={<Money value={d.today_returns.total} />} sub={`${d.today_returns.count} مرتجع`} icon={<RotateCcw className="size-4" />} />
            <CompactMetric title="مصاريف اليوم" value={<Money value={d.today_cash.expenses} />} icon={<Banknote className="size-4" />} />
            <CompactMetric title="ديون العملاء" value={<Money value={d.debts.customers_total} />} sub={`${d.debts.customers_count} عميل`} icon={<HandCoins className="size-4" />} />
            <CompactMetric title="ديون الموردين" value={<Money value={d.debts.suppliers_total} />} sub={`${d.debts.suppliers_count} مورد`} icon={<HandCoins className="size-4" />} />
            <CompactMetric title="تنبيه مخزون" value={<span className="tnum font-bold">{d.stock.low_stock_count}</span>} icon={<Bell className="size-4" />} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="مقارنة سريعة" />
          <CardBody className="grid grid-cols-2 gap-3">
            <CompareCell label="اليوم" sales={d.compare.today.sales} profit={showProfit ? d.compare.today.profit : null} />
            <CompareCell label="أمس" sales={d.compare.yesterday.sales} profit={showProfit ? d.compare.yesterday.profit : null} />
            <CompareCell label="هذا الشهر" sales={d.compare.this_month.sales} profit={showProfit ? d.compare.this_month.profit : null} delta={monthDelta} />
            <CompareCell label="الشهر الماضي" sales={d.compare.last_month.sales} profit={showProfit ? d.compare.last_month.profit : null} />
          </CardBody>
        </Card>
      </section>

      <section className={`grid gap-3 ${showProfit ? 'lg:grid-cols-2' : ''}`}>
        <Card>
          <CardHeader title="المبيعات آخر 7 أيام" />
          <CardBody>
            <BarChart data={series} color="#176f5b" />
          </CardBody>
        </Card>
        {showProfit ? (
          <Card>
            <CardHeader title="الأرباح آخر 7 أيام" />
            <CardBody>
              <BarChart data={profitSeries} color="#a66f1f" />
            </CardBody>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="أفضل العملاء" action={<Link href="/reports/customers" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا مبيعات بعد"
            rows={d.top_customers.slice(0, 5).map((c) => ({
              key: c.id,
              href: `/customers/${c.id}`,
              title: c.name,
              sub: c.shop_name ?? `${c.invoices} فاتورة`,
              meta: <Money value={c.total} className="text-sm" />,
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="الأكثر مبيعاً" action={<Link href="/reports/products" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا أصناف مباعة بعد"
            rows={d.top_products_qty.slice(0, 5).map((p) => ({
              key: p.id,
              href: `/products/${p.id}`,
              title: p.name,
              sub: formatQty(p.qty_units, p.units_per_carton ?? 1),
              meta: <Money value={p.revenue} className="text-sm" />,
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="حالة المخزون" action={<Link href="/inventory?tab=low" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="كل الأصناف فوق الحد الأدنى"
            rows={d.low_stock_list.slice(0, 5).map((p) => ({
              key: p.id,
              href: `/products/${p.id}`,
              title: p.name,
              sub: `الحد الأدنى ${p.min_stock_units} حبة`,
              meta: (
                <Badge tone={p.stock_units <= 0 ? 'danger' : 'warning'}>
                  {formatQty(p.stock_units, p.units_per_carton)}
                </Badge>
              ),
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="آخر الفواتير" action={<Link href="/sales" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا فواتير بعد"
            rows={d.recent_sales.slice(0, 5).map((s) => ({
              key: s.id,
              href: `/sales/${s.id}`,
              title: s.customer_name,
              sub: `${s.invoice_no} · ${fmtTime(s.sale_date)}`,
              meta: (
                <span className="flex items-center gap-1.5">
                  {s.status === 'void' ? <StatusBadge status="void" /> : null}
                  <Money value={s.total} className="text-sm" />
                </span>
              ),
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="آخر الدفعات" action={<Link href="/debts" className="text-xs font-bold text-primary-700 hover:underline">الديون</Link>} />
          <ListBody
            empty="لا دفعات بعد"
            rows={d.recent_payments.slice(0, 5).map((p) => ({
              key: p.id,
              title: p.party_name ?? '—',
              sub: `${p.payment_no} · ${fmtTime(p.payment_date)}`,
              meta: (
                <span className={`tnum text-sm font-bold ${p.direction === 'in' ? 'text-[--color-money-pos]' : 'text-[--color-money-neg]'}`} dir="ltr">
                  {p.direction === 'in' ? '+' : '−'}{formatJOD(p.amount)}
                </span>
              ),
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="حركات المخزون" action={<Link href="/inventory" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا حركات بعد"
            rows={d.recent_movements.slice(0, 5).map((m) => ({
              key: String(m.id),
              title: m.product_name,
              sub: `${moveLabels[m.move_type] ?? m.move_type} · ${fmtRelative(m.created_at)}`,
              meta: (
                <span className={`tnum text-sm font-bold ${m.qty_change > 0 ? 'text-[--color-money-pos]' : 'text-[--color-money-neg]'}`} dir="ltr">
                  {m.qty_change > 0 ? '+' : ''}{m.qty_change}
                </span>
              ),
            }))}
          />
        </Card>
      </section>
    </div>
  );
}

function pctDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '▲' : '▼';
  return `${sign} ${Math.abs(pct).toFixed(0)}%`;
}

function CompactMetric({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/70 p-3">
      <div className="flex items-center gap-2 text-ink-500">
        <span className="rounded-md bg-white p-1.5 text-primary-700 ring-1 ring-ink-100">{icon}</span>
        <p className="truncate text-xs font-extrabold">{title}</p>
      </div>
      <div className="mt-2 text-base font-black text-ink-900">{value}</div>
      {sub ? <p className="mt-0.5 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );
}

function CompareCell({ label, sales, profit, delta }: { label: string; sales: number; profit: number | null; delta?: string | null }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/70 p-3">
      <p className="text-xs font-bold text-ink-500">
        {label} {delta ? <span className={delta.startsWith('▲') ? 'text-emerald-600' : 'text-red-600'}>{delta}</span> : null}
      </p>
      <p className="mt-1">
        <Money value={sales} className="text-lg" />
      </p>
      {profit != null ? (
        <p className="text-xs text-ink-500">الربح: <Money value={profit} signed symbol={false} className="text-xs" /></p>
      ) : null}
    </div>
  );
}

function ListBody({
  rows,
  empty,
}: {
  rows: { key: string; href?: string; title: string; sub?: string; meta?: React.ReactNode }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-500">{empty}</p>;
  }
  return (
    <div className="divide-y divide-ink-100">
      {rows.map((row) => {
        const inner = (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-900">{row.title}</p>
              {row.sub ? <p className="truncate text-xs text-ink-500">{row.sub}</p> : null}
            </div>
            {row.meta ? <div className="shrink-0">{row.meta}</div> : null}
          </div>
        );
        return row.href ? (
          <Link key={row.key} href={row.href} className="block transition-colors hover:bg-primary-50/50">
            {inner}
          </Link>
        ) : (
          <div key={row.key}>{inner}</div>
        );
      })}
    </div>
  );
}

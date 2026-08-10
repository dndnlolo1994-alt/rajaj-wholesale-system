import Link from 'next/link';
import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, Bell, Boxes, HandCoins,
  PackagePlus, ReceiptText, RotateCcw, TrendingUp, Wallet,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold lg:text-2xl">أهلًا {profile.full_name.split(' ')[0]} 👋</h1>
          <p className="mt-0.5 text-sm text-ink-500">هذا وضع عملك الآن</p>
        </div>
        <Link
          href="/day-summary"
          className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-bold text-primary-800 hover:bg-primary-100"
        >
          ملخص اليوم
        </Link>
      </div>

      {/* ===== مؤشرات اليوم ===== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="مبيعات اليوم (صافي)"
          value={<Money value={netToday} />}
          sub={`${d.today.sales_count} فاتورة${dayDelta ? ` — ${dayDelta} عن أمس` : ''}`}
          icon={<ReceiptText className="size-5" />}
          href="/sales"
        />
        {showProfit ? (
          <StatCard
            title="أرباح اليوم"
            value={<Money value={netProfitToday} signed />}
            icon={<TrendingUp className="size-5" />}
            tone="success"
            href="/profit"
          />
        ) : null}
        <StatCard
          title="المقبوضات اليوم"
          value={<Money value={d.today_cash.receipts} />}
          icon={<ArrowDownToLine className="size-5" />}
          tone="success"
          href="/cashbox"
        />
        <StatCard
          title="المدفوعات للموردين اليوم"
          value={<Money value={d.today_cash.payments} />}
          icon={<ArrowUpFromLine className="size-5" />}
          tone="warning"
          href="/cashbox"
        />
        <StatCard
          title="مشتريات اليوم"
          value={<Money value={d.today_purchases.total} />}
          sub={`${d.today_purchases.count} فاتورة`}
          icon={<PackagePlus className="size-5" />}
          href="/purchases"
        />
        <StatCard
          title="مرتجعات اليوم"
          value={<Money value={d.today_returns.total} />}
          sub={`${d.today_returns.count} مرتجع`}
          icon={<RotateCcw className="size-5" />}
          href="/returns"
        />
        <StatCard
          title="مصاريف اليوم"
          value={<Money value={d.today_cash.expenses} />}
          icon={<Banknote className="size-5" />}
          href="/expenses"
        />
        <StatCard
          title="رصيد الصندوق"
          value={<Money value={d.cash_balance} signed />}
          icon={<Wallet className="size-5" />}
          tone="info"
          href="/cashbox"
        />
      </div>

      {/* ===== الديون والمخزون ===== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="ديون العملاء (لنا)"
          value={<Money value={d.debts.customers_total} />}
          sub={`${d.debts.customers_count} عميل`}
          icon={<HandCoins className="size-5" />}
          tone="danger"
          href="/debts"
        />
        <StatCard
          title="ديون الموردين (علينا)"
          value={<Money value={d.debts.suppliers_total} />}
          sub={`${d.debts.suppliers_count} مورد`}
          icon={<HandCoins className="size-5" />}
          tone="warning"
          href="/debts?tab=suppliers"
        />
        <StatCard
          title="قيمة المخزون"
          value={<Money value={d.stock.value} />}
          sub={`${d.stock.products_count} صنف فعال`}
          icon={<Boxes className="size-5" />}
          href="/inventory"
        />
        <StatCard
          title="أصناف قاربت على النفاد"
          value={<span className="tnum">{d.stock.low_stock_count}</span>}
          icon={<Bell className="size-5" />}
          tone={d.stock.low_stock_count > 0 ? 'danger' : 'default'}
          href="/inventory?tab=low"
        />
      </div>

      {/* ===== الرسوم البيانية ===== */}
      <div className={`grid gap-3 ${showProfit ? 'lg:grid-cols-2' : ''}`}>
        <Card>
          <CardHeader title="المبيعات — آخر 7 أيام" />
          <CardBody>
            <BarChart data={series} color="#0e8a5e" />
          </CardBody>
        </Card>
        {showProfit ? (
          <Card>
            <CardHeader title="الأرباح — آخر 7 أيام" />
            <CardBody>
              <BarChart data={profitSeries} color="#b45309" />
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* ===== المقارنات ===== */}
      <Card>
        <CardHeader title="مقارنة المبيعات" />
        <CardBody className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CompareCell label="اليوم" sales={d.compare.today.sales} profit={showProfit ? d.compare.today.profit : null} />
          <CompareCell label="أمس" sales={d.compare.yesterday.sales} profit={showProfit ? d.compare.yesterday.profit : null} />
          <CompareCell label="هذا الشهر" sales={d.compare.this_month.sales} profit={showProfit ? d.compare.this_month.profit : null} delta={monthDelta} />
          <CompareCell label="الشهر الماضي" sales={d.compare.last_month.sales} profit={showProfit ? d.compare.last_month.profit : null} />
        </CardBody>
      </Card>

      {/* ===== القوائم ===== */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="أفضل العملاء هذا الشهر" action={<Link href="/reports/customers" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا مبيعات هذا الشهر"
            rows={d.top_customers.map((c) => ({
              key: c.id,
              href: `/customers/${c.id}`,
              title: c.name,
              sub: c.shop_name ?? `${c.invoices} فاتورة`,
              meta: <Money value={c.total} className="text-sm" />,
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="الأكثر مبيعًا هذا الشهر" action={<Link href="/reports/products" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا مبيعات هذا الشهر"
            rows={d.top_products_qty.map((p) => ({
              key: p.id,
              href: `/products/${p.id}`,
              title: p.name,
              sub: formatQty(p.qty_units, p.units_per_carton ?? 1),
              meta: <Money value={p.revenue} className="text-sm" />,
            }))}
          />
        </Card>

        {showProfit ? (
          <Card>
            <CardHeader title="الأعلى ربحًا هذا الشهر" />
            <ListBody
              empty="لا مبيعات هذا الشهر"
              rows={d.top_products_profit.map((p) => ({
                key: p.id,
                href: `/products/${p.id}`,
                title: p.name,
                sub: `مبيعات ${formatJOD(p.revenue)}`,
                meta: <Money value={p.profit} signed className="text-sm" />,
              }))}
            />
          </Card>
        ) : null}

        <Card>
          <CardHeader title="مخزون منخفض" action={<Link href="/inventory?tab=low" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="كل الأصناف فوق الحد الأدنى ✓"
            rows={d.low_stock_list.map((p) => ({
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
            rows={d.recent_sales.map((s) => ({
              key: s.id,
              href: `/sales/${s.id}`,
              title: s.customer_name,
              sub: `${s.invoice_no} — ${fmtTime(s.sale_date)}`,
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
            rows={d.recent_payments.map((p) => ({
              key: p.id,
              title: p.party_name ?? '—',
              sub: `${p.payment_no} — ${fmtTime(p.payment_date)}`,
              meta: (
                <span className={`tnum text-sm font-bold ${p.direction === 'in' ? 'text-[--color-money-pos]' : 'text-[--color-money-neg]'}`} dir="ltr">
                  {p.direction === 'in' ? '+' : '−'}{formatJOD(p.amount)}
                </span>
              ),
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="آخر حركات المخزون" action={<Link href="/inventory" className="text-xs font-bold text-primary-700 hover:underline">الكل</Link>} />
          <ListBody
            empty="لا حركات بعد"
            rows={d.recent_movements.map((m) => ({
              key: String(m.id),
              title: m.product_name,
              sub: `${moveLabels[m.move_type] ?? m.move_type} — ${fmtRelative(m.created_at)}`,
              meta: (
                <span className={`tnum text-sm font-bold ${m.qty_change > 0 ? 'text-[--color-money-pos]' : 'text-[--color-money-neg]'}`} dir="ltr">
                  {m.qty_change > 0 ? '+' : ''}{m.qty_change}
                </span>
              ),
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function pctDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '▲' : '▼';
  return `${sign} ${Math.abs(pct).toFixed(0)}%`;
}

function CompareCell({ label, sales, profit, delta }: { label: string; sales: number; profit: number | null; delta?: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold text-ink-500">{label} {delta ? <span className={delta.startsWith('▲') ? 'text-emerald-600' : 'text-red-600'}>{delta}</span> : null}</p>
      <p className="mt-1"><Money value={sales} className="text-lg" /></p>
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

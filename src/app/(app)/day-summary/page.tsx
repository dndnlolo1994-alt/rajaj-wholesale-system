import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { daySummary } from '@/server/queries/reports';
import { paymentMethodLabels } from '@/lib/settings';
import { PrintButton } from '@/components/printing/print-button';
import { Money, PageHeader } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addDaysISO, fmtDate, todayISO } from '@/lib/format/date';
import { round3 } from '@/lib/calc/money';
import type { PaymentMethod } from '@/lib/types/db';

export const metadata = { title: 'ملخص اليوم' };
export const dynamic = 'force-dynamic';

export default async function DaySummaryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const profile = await requireProfile();
  const showProfit = canSeeProfit(profile.role);
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();

  const d = await daySummary(date);
  const netDay = round3(d.sales.profit + d.returns.profit_delta - d.expenses.total);
  const methodsIn = Object.entries(d.cash.by_method_in) as [PaymentMethod, number][];

  return (
    <div>
      <PageHeader
        title="ملخص اليوم"
        description={fmtDate(`${date}T12:00:00`)}
        actions={<PrintButton kind="day" id={date} label="طباعة تقرير الإغلاق" />}
      />

      {/* ===== التنقل بين الأيام ===== */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/day-summary?date=${addDaysISO(date, -1)}`}
          aria-label="اليوم السابق"
          className="flex size-10 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-100"
        >
          <ChevronRight className="size-4" />
        </Link>
        <form method="get" className="flex items-center gap-2">
          <input
            key={date}
            type="date"
            name="date"
            defaultValue={date}
            className="h-10 rounded-lg border border-ink-300 bg-white px-2.5 text-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            عرض
          </Button>
        </form>
        <Link
          href={`/day-summary?date=${addDaysISO(date, 1)}`}
          aria-label="اليوم التالي"
          className="flex size-10 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-700 transition-colors hover:bg-ink-100"
        >
          <ChevronLeft className="size-4" />
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ===== المبيعات ===== */}
        <Card>
          <CardHeader title="المبيعات" />
          <CardBody className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            <Item label="عدد الفواتير" value={<span className="tnum">{d.sales.count}</span>} />
            <Item label="الإجمالي" value={<Money value={d.sales.total} />} />
            <Item label="المقبوض" value={<Money value={d.sales.paid} />} />
            <Item label="الآجل" value={<Money value={d.sales.credit} className={d.sales.credit > 0 ? 'text-red-600' : ''} />} />
            <Item label="الخصومات" value={<Money value={d.sales.discount} />} />
            {showProfit ? <Item label="التكلفة" value={<Money value={d.sales.cogs} />} /> : null}
            {showProfit ? <Item label="الربح" value={<Money value={d.sales.profit} signed />} /> : null}
          </CardBody>
        </Card>

        {/* ===== المرتجعات ===== */}
        <Card>
          <CardHeader title="المرتجعات" />
          <CardBody className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            <Item label="العدد" value={<span className="tnum">{d.returns.count}</span>} />
            <Item label="القيمة" value={<Money value={d.returns.total} />} />
            <Item label="الرد النقدي" value={<Money value={d.returns.refund_cash} />} />
          </CardBody>
        </Card>

        {/* ===== المشتريات ===== */}
        <Card>
          <CardHeader title="المشتريات" />
          <CardBody className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Item label="العدد" value={<span className="tnum">{d.purchases.count}</span>} />
            <Item label="الإجمالي" value={<Money value={d.purchases.total} />} />
            <Item label="المدفوع" value={<Money value={d.purchases.paid} />} />
            <Item label="الآجل" value={<Money value={d.purchases.credit} className={d.purchases.credit > 0 ? 'text-red-600' : ''} />} />
          </CardBody>
        </Card>

        {/* ===== المصروفات ===== */}
        <Card>
          <CardHeader title="المصروفات" />
          <CardBody className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Item label="الإجمالي" value={<Money value={d.expenses.total} />} />
              <Item label="عدد الحركات" value={<span className="tnum">{d.expenses.count}</span>} />
            </div>
            {d.expenses_by_category.length > 0 ? (
              <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                {d.expenses_by_category.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm font-bold text-ink-700">{c.name}</span>
                    <Money value={c.total} className="text-sm" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-ink-500">لا مصروفات اليوم</p>
            )}
          </CardBody>
        </Card>

        {/* ===== المقبوضات ===== */}
        <Card>
          <CardHeader title="المقبوضات" />
          <CardBody className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
              <Item label="قبض مبيعات" value={<Money value={d.cash.sale_receipts} />} />
              <Item label="تحصيل ديون" value={<Money value={d.cash.debt_collected} />} />
              <Item label="إجمالي الداخل" value={<Money value={d.cash.in_total} className="text-[--color-money-pos]" />} />
            </div>
            {methodsIn.length > 0 ? (
              <div className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                {methodsIn.map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm font-bold text-ink-700">{paymentMethodLabels[method] ?? method}</span>
                    <Money value={amount} className="text-sm" />
                  </div>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* ===== المدفوعات ===== */}
        <Card>
          <CardHeader title="المدفوعات" />
          <CardBody className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Item label="دفعات للموردين" value={<Money value={d.cash.supplier_paid} />} />
            <Item label="مصاريف مدفوعة" value={<Money value={d.cash.expenses_paid} />} />
            <Item label="رد نقدي (مرتجعات)" value={<Money value={d.cash.refunds_out} />} />
            <Item label="إجمالي الخارج" value={<Money value={d.cash.out_total} className="text-[--color-money-neg]" />} />
          </CardBody>
        </Card>

        {/* ===== الصندوق ===== */}
        <Card className="lg:col-span-2">
          <CardHeader title="الصندوق" />
          <CardBody className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Item label="الرصيد الحالي" value={<Money value={d.cash_balance.balance} signed />} />
            {d.session ? (
              <>
                <Item label="المتوقع عند الإغلاق" value={<Money value={d.session.expected_cash} />} />
                <Item label="النقد الفعلي" value={<Money value={d.session.actual_cash} />} />
                <Item label="الفرق" value={<Money value={d.session.difference} signed />} />
              </>
            ) : (
              <div className="col-span-1 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 lg:col-span-3">
                <p className="text-sm font-bold text-amber-800">لم تُغلق جلسة الصندوق لهذا اليوم</p>
                <Link
                  href="/cashbox"
                  className="no-print inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary-700 px-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
                >
                  إغلاق الصندوق
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ===== صافي ربح اليوم ===== */}
      {showProfit ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[--radius-card] border-2 border-primary-200 bg-primary-50 p-5 shadow-card">
          <div>
            <p className="text-base font-extrabold text-primary-900">صافي ربح اليوم</p>
            <p className="mt-0.5 text-xs text-primary-800/70">ربح المبيعات + فرق المرتجعات − المصاريف</p>
          </div>
          <Money value={netDay} signed className="text-3xl" />
        </div>
      ) : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-100/50 p-3">
      <p className="text-xs font-bold text-ink-500">{label}</p>
      <div className="mt-1 text-base font-extrabold text-ink-900">{value}</div>
    </div>
  );
}

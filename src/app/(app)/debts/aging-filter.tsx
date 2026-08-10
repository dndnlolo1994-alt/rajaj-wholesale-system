'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, HandCoins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money, EmptyState } from '@/components/ui/misc';
import { PrintButton } from '@/components/printing/print-button';
import { cn } from '@/lib/cn';
import { fmtRelative, monthStartISO, todayISO } from '@/lib/format/date';
import { PaymentDialog } from '@/app/(app)/customers/payment-dialog';
import { SupplierPaymentDialog } from '@/app/(app)/suppliers/supplier-payment-dialog';

/** صف دين كما يعيده rpc report_debts */
export interface DebtRow {
  id: string;
  name: string;
  sub_name: string | null;
  phone: string | null;
  balance: number;
  credit_limit?: number | null;
  last_payment_at: string | null;
  last_activity_at: string | null;
  days_since_payment: number;
}

type AgeFilter = 'all' | '0' | '7' | '30' | '60';

const filters: { value: AgeFilter; label: string; test: (d: number) => boolean }[] = [
  { value: 'all', label: 'الكل', test: () => true },
  { value: '0', label: 'اليوم', test: (d) => d === 0 },
  { value: '7', label: '7+ أيام', test: (d) => d >= 7 },
  { value: '30', label: '30+ يوم', test: (d) => d >= 30 },
  { value: '60', label: '60+ يوم', test: (d) => d >= 60 },
];

function daysTone(days: number): 'danger' | 'warning' | 'muted' {
  if (days >= 60) return 'danger';
  if (days >= 30) return 'warning';
  return 'muted';
}

/** قائمة الديون مع فلترة أعمار على البيانات الممررة + حوارات الدفع */
export function AgingFilter({ party, rows }: { party: 'customers' | 'suppliers'; rows: DebtRow[] }) {
  const [age, setAge] = useState<AgeFilter>('all');
  const [payTarget, setPayTarget] = useState<DebtRow | null>(null);

  const filtered = useMemo(() => {
    const f = filters.find((x) => x.value === age) ?? filters[0];
    return rows.filter((r) => f.test(r.days_since_payment));
  }, [rows, age]);

  const isCustomers = party === 'customers';
  const accountHref = (id: string) => (isCustomers ? `/customers/${id}` : `/suppliers/${id}`);
  const printQuery = { from: monthStartISO(0), to: todayISO() };

  return (
    <div>
      {/* شرائح فلترة الأعمار */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {filters.map((f) => {
          const count = rows.filter((r) => f.test(r.days_since_payment)).length;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setAge(f.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                age === f.value
                  ? 'border-primary-700 bg-primary-700 text-white'
                  : 'border-ink-300 bg-white text-ink-700 hover:border-primary-400 hover:text-primary-800',
              )}
            >
              {f.label}
              <span className={cn('tnum rounded-full px-1.5 text-[10px]', age === f.value ? 'bg-white/20' : 'bg-ink-100')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? (isCustomers ? 'لا ديون على العملاء' : 'لا مستحقات للموردين') : 'لا نتائج ضمن هذا العمر'}
            description={rows.length === 0 ? 'الوضع ممتاز — كل الحسابات مسدّدة' : 'جرّب فلترًا آخر'}
          />
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">{isCustomers ? 'العميل' : 'المورد'}</th>
                    <th className="px-2 py-3 text-start font-bold">الهاتف</th>
                    <th className="px-2 py-3 text-end font-bold">الرصيد</th>
                    <th className="px-2 py-3 text-start font-bold">آخر دفعة</th>
                    <th className="px-2 py-3 text-center font-bold">العمر</th>
                    <th className="px-4 py-3 text-end font-bold">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={accountHref(r.id)} className="font-bold text-primary-700 hover:underline">
                          {r.name}
                        </Link>
                        {r.sub_name ? <p className="text-xs text-ink-500">{r.sub_name}</p> : null}
                      </td>
                      <td className="px-2 py-2.5">
                        {r.phone ? <span className="tnum text-ink-700" dir="ltr">{r.phone}</span> : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-end"><Money value={r.balance} className="text-red-600" /></td>
                      <td className="px-2 py-2.5 text-xs text-ink-500">
                        {r.last_payment_at ? fmtRelative(r.last_payment_at) : 'لا دفعات'}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Badge tone={daysTone(r.days_since_payment)}>
                          <span className="tnum">{r.days_since_payment}</span> يوم
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setPayTarget(r)}>
                            <HandCoins className="size-4" />
                            تسجيل دفعة
                          </Button>
                          <Link href={accountHref(r.id)}>
                            <Button size="sm" variant="outline">
                              <ExternalLink className="size-4" />
                              فتح الحساب
                            </Button>
                          </Link>
                          <PrintButton
                            kind={isCustomers ? 'statement' : 'supplier-statement'}
                            id={r.id}
                            query={printQuery}
                            label="كشف"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات الجوال */}
            <div className="divide-y divide-ink-100 lg:hidden">
              {filtered.map((r) => (
                <div key={r.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={accountHref(r.id)} className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-primary-800">{r.name}</p>
                      {r.sub_name ? <p className="truncate text-xs text-ink-500">{r.sub_name}</p> : null}
                    </Link>
                    <Money value={r.balance} className="text-red-600" />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-500">
                    <span>{r.last_payment_at ? `آخر دفعة ${fmtRelative(r.last_payment_at)}` : 'لا دفعات'}</span>
                    <Badge tone={daysTone(r.days_since_payment)}>
                      <span className="tnum">{r.days_since_payment}</span> يوم
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setPayTarget(r)} className="flex-1">
                      <HandCoins className="size-4" />
                      تسجيل دفعة
                    </Button>
                    <PrintButton
                      kind={isCustomers ? 'statement' : 'supplier-statement'}
                      id={r.id}
                      query={printQuery}
                      label="كشف"
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* حوار الدفع حسب الطرف */}
      {isCustomers ? (
        <PaymentDialog
          customerId={payTarget?.id ?? ''}
          customerName={payTarget?.name ?? ''}
          balance={Number(payTarget?.balance ?? 0)}
          open={payTarget != null}
          onClose={() => setPayTarget(null)}
        />
      ) : (
        <SupplierPaymentDialog
          supplierId={payTarget?.id ?? ''}
          supplierName={payTarget?.name ?? ''}
          balance={Number(payTarget?.balance ?? 0)}
          open={payTarget != null}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}

import { ArrowDownLeft, ArrowUpRight, CalendarCheck2, Wallet } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import {
  getCashBalance,
  listCashSessions,
  listCashTx,
  type CashSessionRow,
  type CashTxListRow,
} from '@/server/queries/cashbox';
import { PageHeader, Money, EmptyState, StatCard } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { PrintButton } from '@/components/printing/print-button';
import { fmtDateShort, fmtDateTime, fmtTime } from '@/lib/format/date';
import { paymentMethodLabels } from '@/lib/settings';
import type { CashTxType, PaymentMethod } from '@/lib/types/db';
import { ManualTxDialog } from './manual-tx-dialog';
import { CloseSessionDialog } from './close-session-dialog';

export const metadata = { title: 'الصندوق' };
export const dynamic = 'force-dynamic';

const txTypeLabels: Record<CashTxType, string> = {
  sale_receipt: 'قبض مبيعات',
  customer_receipt: 'قبض من عميل',
  supplier_payment: 'دفع لمورد',
  expense: 'مصروف',
  extra_income: 'دخل إضافي',
  owner_withdrawal: 'سحب شخصي',
  deposit: 'إيداع',
  adjustment: 'تسوية',
  refund: 'استرداد',
};

export default async function CashboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; method?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireProfile(['owner', 'manager', 'accountant']);
  const sp = await searchParams;
  const tab = sp.tab === 'sessions' ? 'sessions' : 'tx';
  const page = Math.max(1, Number(sp.page ?? 1));

  const [balance, txData, sessionData] = await Promise.all([
    getCashBalance(),
    tab === 'tx'
      ? listCashTx({
          txType: (sp.type || undefined) as CashTxType | undefined,
          method: (sp.method || undefined) as PaymentMethod | undefined,
          from: sp.from,
          to: sp.to,
          page,
        })
      : Promise.resolve({ rows: [] as CashTxListRow[], total: 0 }),
    tab === 'sessions'
      ? listCashSessions(page)
      : Promise.resolve({ rows: [] as CashSessionRow[], total: 0 }),
  ]);

  return (
    <div>
      <PageHeader
        title="الصندوق"
        description="الحركة النقدية اليومية وجلسات الإغلاق"
        actions={
          <>
            <ManualTxDialog />
            <CloseSessionDialog expected={Number(balance.balance)} />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="رصيد الصندوق النقدي الآن"
          value={<Money value={balance.balance} signed />}
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          title="داخل منذ آخر إغلاق"
          value={<Money value={balance.cash_in} />}
          icon={<ArrowDownLeft className="size-5" />}
          tone="success"
        />
        <StatCard
          title="خارج منذ آخر إغلاق"
          value={<Money value={balance.cash_out} />}
          icon={<ArrowUpRight className="size-5" />}
          tone="danger"
        />
        <StatCard
          title="آخر إغلاق"
          value={balance.last_session_date ? fmtDateShort(balance.last_session_date) : 'لم يُغلق بعد'}
          icon={<CalendarCheck2 className="size-5" />}
          tone="info"
        />
      </div>

      <LinkTabs
        tabs={[
          { value: 'tx', label: 'الحركات' },
          { value: 'sessions', label: 'جلسات الإغلاق' },
        ]}
        className="mb-3"
      />

      {tab === 'tx' ? (
        <>
          <TxFilters type={sp.type} method={sp.method} from={sp.from} to={sp.to} />
          <Card>
            {txData.rows.length === 0 ? (
              <EmptyState title="لا توجد حركات" description="ستظهر هنا كل حركات الصندوق الداخلة والخارجة" />
            ) : (
              <>
                {/* جدول الشاشات الكبيرة */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-xs text-ink-500">
                        <th className="px-4 py-3 text-start font-bold">الوقت</th>
                        <th className="px-4 py-3 text-start font-bold">النوع</th>
                        <th className="px-4 py-3 text-start font-bold">البيان</th>
                        <th className="px-4 py-3 text-start font-bold">الطريقة</th>
                        <th className="px-4 py-3 text-end font-bold">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {txData.rows.map((t) => (
                        <tr key={t.id} className="transition-colors hover:bg-primary-50/40">
                          <td className="px-4 py-3 text-ink-500">{fmtDateTime(t.tx_date)}</td>
                          <td className="px-4 py-3">
                            <Badge tone={t.direction === 'in' ? 'success' : 'danger'}>{txTypeLabels[t.tx_type]}</Badge>
                          </td>
                          <td className="max-w-[300px] px-4 py-3">
                            <p className="truncate text-ink-700">{t.notes ?? '—'}</p>
                            {t.creator?.full_name ? (
                              <p className="text-xs text-ink-400">{t.creator.full_name}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-ink-500">{paymentMethodLabels[t.method]}</td>
                          <td className="px-4 py-3 text-end">
                            <Money value={t.direction === 'in' ? Number(t.amount) : -Number(t.amount)} signed />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* بطاقات الجوال */}
                <div className="divide-y divide-ink-100 lg:hidden">
                  {txData.rows.map((t) => (
                    <div key={t.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={t.direction === 'in' ? 'success' : 'danger'}>{txTypeLabels[t.tx_type]}</Badge>
                        <Money value={t.direction === 'in' ? Number(t.amount) : -Number(t.amount)} signed />
                      </div>
                      {t.notes ? <p className="mt-1.5 text-sm text-ink-700">{t.notes}</p> : null}
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-500">
                        <span>{paymentMethodLabels[t.method]}</span>
                        <span>
                          {fmtDateShort(t.tx_date)} {fmtTime(t.tx_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Pagination page={page} pageSize={25} total={txData.total} />
        </>
      ) : (
        <>
          <Card>
            {sessionData.rows.length === 0 ? (
              <EmptyState title="لا توجد جلسات إغلاق" description="أغلق اليوم من زر «إغلاق اليوم» لتوثيق النقد الفعلي" />
            ) : (
              <>
                {/* جدول الشاشات الكبيرة */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-xs text-ink-500">
                        <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                        <th className="px-4 py-3 text-end font-bold">افتتاحي</th>
                        <th className="px-4 py-3 text-end font-bold">داخل</th>
                        <th className="px-4 py-3 text-end font-bold">خارج</th>
                        <th className="px-4 py-3 text-end font-bold">المتوقع</th>
                        <th className="px-4 py-3 text-end font-bold">الفعلي</th>
                        <th className="px-4 py-3 text-end font-bold">الفرق</th>
                        <th className="px-4 py-3 text-start font-bold">من أغلقها</th>
                        <th className="px-4 py-3 text-center font-bold">طباعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {sessionData.rows.map((s) => (
                        <tr key={s.id} className="transition-colors hover:bg-primary-50/40">
                          <td className="px-4 py-3 font-bold">{fmtDateShort(s.session_date)}</td>
                          <td className="px-4 py-3 text-end"><Money value={s.opening_balance} symbol={false} /></td>
                          <td className="px-4 py-3 text-end"><Money value={s.cash_in} symbol={false} className="text-emerald-700" /></td>
                          <td className="px-4 py-3 text-end"><Money value={s.cash_out} symbol={false} className="text-red-600" /></td>
                          <td className="px-4 py-3 text-end"><Money value={s.expected_cash} symbol={false} /></td>
                          <td className="px-4 py-3 text-end"><Money value={s.actual_cash} symbol={false} /></td>
                          <td className="px-4 py-3 text-end">
                            <Money value={s.difference} symbol={false} className={diffClass(Number(s.difference))} />
                          </td>
                          <td className="px-4 py-3 text-ink-500">{s.closer?.full_name ?? '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <PrintButton kind="cash-session" id={s.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* بطاقات الجوال */}
                <div className="divide-y divide-ink-100 lg:hidden">
                  {sessionData.rows.map((s) => (
                    <div key={s.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-extrabold">{fmtDateShort(s.session_date)}</p>
                        <span className="text-xs text-ink-500">{s.closer?.full_name ?? '—'}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <MiniStat label="المتوقع" value={<Money value={s.expected_cash} symbol={false} className="text-xs" />} />
                        <MiniStat label="الفعلي" value={<Money value={s.actual_cash} symbol={false} className="text-xs" />} />
                        <MiniStat
                          label="الفرق"
                          value={<Money value={s.difference} symbol={false} className={`text-xs ${diffClass(Number(s.difference))}`} />}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-ink-500">
                          افتتاحي <Money value={s.opening_balance} symbol={false} className="text-xs" /> — داخل{' '}
                          <Money value={s.cash_in} symbol={false} className="text-xs text-emerald-700" /> — خارج{' '}
                          <Money value={s.cash_out} symbol={false} className="text-xs text-red-600" />
                        </span>
                        <PrintButton kind="cash-session" id={s.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Pagination page={page} pageSize={25} total={sessionData.total} />
        </>
      )}
    </div>
  );
}

function diffClass(d: number): string {
  return d === 0 ? 'text-emerald-700' : d < 0 ? 'text-red-600' : 'text-amber-600';
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-100/60 px-2 py-1.5 text-center">
      <p className="text-[10px] font-bold text-ink-500">{label}</p>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function TxFilters({ type, method, from, to }: { type?: string; method?: string; from?: string; to?: string }) {
  return (
    <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tab" value="tx" />
      <div className="w-44">
        <Select name="type" defaultValue={type ?? ''}>
          <option value="">كل الأنواع</option>
          {(Object.entries(txTypeLabels) as [CashTxType, string][]).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-36">
        <Select name="method" defaultValue={method ?? ''}>
          <option value="">كل الطرق</option>
          {(Object.entries(paymentMethodLabels) as [PaymentMethod, string][]).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <input
        type="date"
        name="from"
        defaultValue={from}
        className="h-11 rounded-lg border border-ink-300 bg-white px-2.5 text-sm"
      />
      <span className="text-xs text-ink-500">إلى</span>
      <input
        type="date"
        name="to"
        defaultValue={to}
        className="h-11 rounded-lg border border-ink-300 bg-white px-2.5 text-sm"
      />
      <Button type="submit" variant="outline" size="sm">
        تصفية
      </Button>
    </form>
  );
}

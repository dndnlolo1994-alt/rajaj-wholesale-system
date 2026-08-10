import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight, Hash, HandCoins, MessageCircle, Pencil, Phone,
  ReceiptText, RotateCcw, ShoppingCart, TrendingUp, Wallet,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import {
  getCustomer, getCustomerStats, listCustomerLedger, listCustomerPayments,
  listCustomerPrices, listCustomerReturns, listCustomerSales,
} from '@/server/queries/customers';
import { Card, CardHeader } from '@/components/ui/card';
import { Money, PageHeader, StatCard, EmptyState } from '@/components/ui/misc';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Pagination } from '@/components/ui/pagination';
import { PrintButton } from '@/components/printing/print-button';
import { fmtDateShort, fmtDateTime, fmtTime, monthStartISO, todayISO } from '@/lib/format/date';
import { unitLabel } from '@/lib/calc/units';
import { paymentMethodLabels } from '@/lib/settings';
import type { LedgerEntryType } from '@/lib/types/db';
import { CustomerFormDialog } from '../customer-form';
import { RecordPaymentButton } from '../payment-dialog';
import { AddPriceButton, DeletePriceButton } from './price-dialog';

export const dynamic = 'force-dynamic';

// أنواع قيود الكشف بالعربي
const ledgerTypeLabels: Record<LedgerEntryType, string> = {
  opening: 'رصيد سابق',
  sale: 'فاتورة',
  purchase: 'مشتريات',
  payment: 'دفعة',
  return: 'مرتجع',
  adjustment: 'تسوية',
  void: 'إلغاء',
};

const ledgerTypeTones: Record<LedgerEntryType, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  opening: 'muted',
  sale: 'default',
  purchase: 'info',
  payment: 'success',
  return: 'warning',
  adjustment: 'info',
  void: 'danger',
};

type Tab = 'ledger' | 'sales' | 'payments' | 'returns' | 'prices';
const TABS: Tab[] = ['ledger', 'sales', 'payments', 'returns', 'prices'];

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'ledger';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [customer, stats] = await Promise.all([getCustomer(id), getCustomerStats(id)]);
  if (!customer) notFound();

  const showProfit = canSeeProfit(profile.role);
  const balance = Number(customer.balance);
  const waDigits = (customer.whatsapp ?? '').replace(/\D/g, '');

  // بيانات التبويب النشط فقط
  const ledger = tab === 'ledger' ? await listCustomerLedger(id, page) : null;
  const salesData = tab === 'sales' ? await listCustomerSales(id, page) : null;
  const paymentsData = tab === 'payments' ? await listCustomerPayments(id, page) : null;
  const returnsData = tab === 'returns' ? await listCustomerReturns(id) : null;
  const pricesData = tab === 'prices' ? await listCustomerPrices(id) : null;

  const chipClass =
    'inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:border-primary-400 hover:text-primary-800';

  return (
    <div className="space-y-4">
      <PageHeader
        title={customer.name}
        description={[customer.shop_name, customer.area].filter(Boolean).join(' — ') || undefined}
        actions={
          <>
            <Link href="/customers">
              <Button variant="ghost" size="sm">
                <ArrowRight className="size-4" />
                العملاء
              </Button>
            </Link>
            <CustomerFormDialog
              customer={customer}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" />
                  تعديل
                </Button>
              }
            />
            <RecordPaymentButton customerId={customer.id} customerName={customer.name} balance={balance} />
            <PrintButton
              kind="statement"
              id={customer.id}
              query={{ from: monthStartISO(0), to: todayISO() }}
              label="كشف حساب"
            />
            <Link href="/pos">
              <Button>
                <ShoppingCart className="size-4" />
                بيع له
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={customer.is_active ? 'success' : 'danger'}>{customer.is_active ? 'فعال' : 'موقوف'}</Badge>
        {customer.phone ? (
          <a href={`tel:${customer.phone}`} className={chipClass}>
            <Phone className="size-3.5" />
            <span className="tnum" dir="ltr">{customer.phone}</span>
          </a>
        ) : null}
        {waDigits ? (
          <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className={chipClass}>
            <MessageCircle className="size-3.5" />
            واتساب
          </a>
        ) : null}
        {customer.address ? <span className="text-xs text-ink-500">{customer.address}</span> : null}
      </div>

      {customer.notes ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">ملاحظة: {customer.notes}</p>
      ) : null}

      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-3 ${showProfit ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
        <StatCard
          title="الرصيد الحالي"
          value={<Money value={balance} className={balance > 0 ? 'text-red-600' : undefined} />}
          sub={
            customer.credit_limit != null ? (
              <>الحد الائتماني: <Money value={customer.credit_limit} className="text-xs" /></>
            ) : undefined
          }
          tone="danger"
          icon={<HandCoins className="size-5" />}
        />
        <StatCard title="إجمالي المبيعات" value={<Money value={stats.sales_total} />} icon={<ReceiptText className="size-5" />} />
        <StatCard title="إجمالي المدفوع" value={<Money value={stats.paid_total} />} tone="success" icon={<Wallet className="size-5" />} />
        <StatCard title="عدد الفواتير" value={<span className="tnum">{stats.invoices_count}</span>} tone="info" icon={<Hash className="size-5" />} />
        <StatCard title="إجمالي المرتجعات" value={<Money value={stats.returns_total} />} tone="warning" icon={<RotateCcw className="size-5" />} />
        {showProfit ? (
          <StatCard title="الربح منه" value={<Money value={stats.profit_total} signed />} tone="success" icon={<TrendingUp className="size-5" />} />
        ) : null}
      </div>

      <LinkTabs
        tabs={[
          { value: 'ledger', label: 'الحركات' },
          { value: 'sales', label: 'الفواتير' },
          { value: 'payments', label: 'الدفعات' },
          { value: 'returns', label: 'المرتجعات' },
          { value: 'prices', label: 'أسعار خاصة' },
        ]}
      />

      {/* ————— الحركات (كشف الحساب) ————— */}
      {ledger ? (
        <>
          <Card>
            {ledger.rows.length === 0 ? (
              <EmptyState title="لا توجد حركات" description="ستظهر هنا الفواتير والدفعات والمرتجعات فور تسجيلها" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-xs text-ink-500">
                      <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                      <th className="px-2 py-3 text-start font-bold">النوع</th>
                      <th className="px-2 py-3 text-start font-bold">البيان</th>
                      <th className="px-2 py-3 text-end font-bold">مدين</th>
                      <th className="px-2 py-3 text-end font-bold">دائن</th>
                      <th className="px-4 py-3 text-end font-bold">الرصيد بعد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {ledger.rows.map((e) => (
                      <tr key={e.id} className="transition-colors hover:bg-primary-50/40">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">{fmtDateTime(e.entry_date)}</td>
                        <td className="px-2 py-2.5">
                          <Badge tone={ledgerTypeTones[e.entry_type]}>{ledgerTypeLabels[e.entry_type]}</Badge>
                        </td>
                        <td className="max-w-56 truncate px-2 py-2.5 text-ink-700">{e.notes ?? '—'}</td>
                        <td className="px-2 py-2.5 text-end">
                          {Number(e.debit) > 0 ? <Money value={e.debit} symbol={false} /> : <span className="text-ink-300">—</span>}
                        </td>
                        <td className="px-2 py-2.5 text-end">
                          {Number(e.credit) > 0 ? (
                            <Money value={e.credit} symbol={false} className="text-[--color-money-pos]" />
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          <Money value={e.balance_after} symbol={false} className={Number(e.balance_after) > 0 ? 'text-red-600' : undefined} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Pagination page={page} pageSize={25} total={ledger.total} />
        </>
      ) : null}

      {/* ————— الفواتير ————— */}
      {salesData ? (
        <>
          <Card>
            {salesData.rows.length === 0 ? (
              <EmptyState title="لا توجد فواتير لهذا العميل" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-xs text-ink-500">
                      <th className="px-4 py-3 text-start font-bold">رقم الفاتورة</th>
                      <th className="px-2 py-3 text-start font-bold">التاريخ</th>
                      <th className="px-2 py-3 text-end font-bold">الإجمالي</th>
                      <th className="px-2 py-3 text-end font-bold">المتبقي</th>
                      <th className="px-4 py-3 text-center font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {salesData.rows.map((s) => (
                      <tr key={s.id} className="transition-colors hover:bg-primary-50/40">
                        <td className="px-4 py-2.5">
                          <Link href={`/sales/${s.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                            {s.invoice_no}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-ink-500">
                          {fmtDateShort(s.sale_date)} — {fmtTime(s.sale_date)}
                        </td>
                        <td className="px-2 py-2.5 text-end"><Money value={s.total} /></td>
                        <td className="px-2 py-2.5 text-end">
                          {Number(s.remaining) > 0 ? (
                            <Money value={s.remaining} symbol={false} className="text-red-600" />
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Pagination page={page} pageSize={25} total={salesData.total} />
        </>
      ) : null}

      {/* ————— الدفعات ————— */}
      {paymentsData ? (
        <>
          <Card>
            {paymentsData.rows.length === 0 ? (
              <EmptyState title="لا توجد دفعات مسجّلة" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-xs text-ink-500">
                      <th className="px-4 py-3 text-start font-bold">رقم السند</th>
                      <th className="px-2 py-3 text-start font-bold">التاريخ</th>
                      <th className="px-2 py-3 text-start font-bold">الطريقة</th>
                      <th className="px-2 py-3 text-end font-bold">المبلغ</th>
                      <th className="px-4 py-3 text-center font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {paymentsData.rows.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-primary-50/40">
                        <td className="tnum px-4 py-2.5 font-bold" dir="ltr">{p.payment_no}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-ink-500">{fmtDateTime(p.payment_date)}</td>
                        <td className="px-2 py-2.5 text-ink-700">{paymentMethodLabels[p.method]}</td>
                        <td className="px-2 py-2.5 text-end"><Money value={p.amount} /></td>
                        <td className="px-4 py-2.5 text-center"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Pagination page={page} pageSize={25} total={paymentsData.total} />
        </>
      ) : null}

      {/* ————— المرتجعات ————— */}
      {returnsData ? (
        <Card>
          {returnsData.length === 0 ? (
            <EmptyState title="لا توجد مرتجعات لهذا العميل" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">رقم المرتجع</th>
                    <th className="px-2 py-3 text-start font-bold">التاريخ</th>
                    <th className="px-2 py-3 text-start font-bold">السبب</th>
                    <th className="px-2 py-3 text-end font-bold">الإجمالي</th>
                    <th className="px-4 py-3 text-center font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {returnsData.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/returns/${r.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                          {r.return_no}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-xs text-ink-500">{fmtDateTime(r.return_date)}</td>
                      <td className="max-w-48 truncate px-2 py-2.5 text-ink-700">{r.reason ?? '—'}</td>
                      <td className="px-2 py-2.5 text-end"><Money value={r.total} /></td>
                      <td className="px-4 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {/* ————— الأسعار الخاصة ————— */}
      {pricesData ? (
        <Card>
          <CardHeader title="الأسعار الخاصة لهذا العميل" action={<AddPriceButton customerId={customer.id} />} />
          {pricesData.length === 0 ? (
            <EmptyState
              title="لا توجد أسعار خاصة"
              description="أضف سعرًا خاصًا ليُطبّق تلقائيًا عند البيع لهذا العميل"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">الصنف</th>
                    <th className="px-2 py-3 text-center font-bold">الوحدة</th>
                    <th className="px-2 py-3 text-end font-bold">السعر الخاص</th>
                    <th className="px-4 py-3 text-center font-bold">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {pricesData.map((cp) => (
                    <tr key={cp.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/products/${cp.product_id}`} className="font-bold hover:text-primary-700 hover:underline">
                          {cp.product?.name ?? 'صنف محذوف'}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Badge tone="muted">{unitLabel[cp.unit]}</Badge>
                      </td>
                      <td className="px-2 py-2.5 text-end"><Money value={cp.price} /></td>
                      <td className="px-4 py-2.5 text-center">
                        <DeletePriceButton id={cp.id} productName={cp.product?.name ?? 'الصنف'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

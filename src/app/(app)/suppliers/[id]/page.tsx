import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight, Hash, HandCoins, MessageCircle, PackagePlus, Pencil, Phone, Wallet,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import {
  getSupplier, getSupplierStats, listSupplierLedger, listSupplierPayments, listSupplierPurchases,
} from '@/server/queries/suppliers';
import { Card } from '@/components/ui/card';
import { Money, PageHeader, StatCard, EmptyState } from '@/components/ui/misc';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Pagination } from '@/components/ui/pagination';
import { PrintButton } from '@/components/printing/print-button';
import { fmtDateShort, fmtDateTime, fmtTime, monthStartISO, todayISO } from '@/lib/format/date';
import { paymentMethodLabels } from '@/lib/settings';
import type { LedgerEntryType } from '@/lib/types/db';
import { SupplierFormDialog } from '../supplier-form';
import { RecordSupplierPaymentButton } from '../supplier-payment-dialog';

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

type Tab = 'ledger' | 'purchases' | 'payments';
const TABS: Tab[] = ['ledger', 'purchases', 'payments'];

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'ledger';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [supplier, stats] = await Promise.all([getSupplier(id), getSupplierStats(id)]);
  if (!supplier) notFound();

  const balance = Number(supplier.balance);
  const waDigits = (supplier.whatsapp ?? '').replace(/\D/g, '');

  // بيانات التبويب النشط فقط
  const ledger = tab === 'ledger' ? await listSupplierLedger(id, page) : null;
  const purchasesData = tab === 'purchases' ? await listSupplierPurchases(id, page) : null;
  const paymentsData = tab === 'payments' ? await listSupplierPayments(id, page) : null;

  const chipClass =
    'inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:border-primary-400 hover:text-primary-800';

  return (
    <div className="space-y-4">
      <PageHeader
        title={supplier.name}
        description={[supplier.company_name, supplier.area].filter(Boolean).join(' — ') || undefined}
        actions={
          <>
            <Link href="/suppliers">
              <Button variant="ghost" size="sm">
                <ArrowRight className="size-4" />
                الموردون
              </Button>
            </Link>
            <SupplierFormDialog
              supplier={supplier}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" />
                  تعديل
                </Button>
              }
            />
            <RecordSupplierPaymentButton supplierId={supplier.id} supplierName={supplier.name} balance={balance} />
            <PrintButton
              kind="supplier-statement"
              id={supplier.id}
              query={{ from: monthStartISO(0), to: todayISO() }}
              label="كشف حساب"
            />
            <Link href="/purchases/new">
              <Button>
                <PackagePlus className="size-4" />
                شراء منه
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={supplier.is_active ? 'success' : 'danger'}>{supplier.is_active ? 'فعال' : 'موقوف'}</Badge>
        {supplier.phone ? (
          <a href={`tel:${supplier.phone}`} className={chipClass}>
            <Phone className="size-3.5" />
            <span className="tnum" dir="ltr">{supplier.phone}</span>
          </a>
        ) : null}
        {waDigits ? (
          <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className={chipClass}>
            <MessageCircle className="size-3.5" />
            واتساب
          </a>
        ) : null}
        {supplier.address ? <span className="text-xs text-ink-500">{supplier.address}</span> : null}
      </div>

      {supplier.notes ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">ملاحظة: {supplier.notes}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="الرصيد (له علينا)"
          value={<Money value={balance} className={balance > 0 ? 'text-red-600' : undefined} />}
          tone="danger"
          icon={<HandCoins className="size-5" />}
        />
        <StatCard title="إجمالي المشتريات" value={<Money value={stats.purchases_total} />} icon={<PackagePlus className="size-5" />} />
        <StatCard title="إجمالي المدفوع له" value={<Money value={stats.paid_total} />} tone="success" icon={<Wallet className="size-5" />} />
        <StatCard title="عدد الفواتير" value={<span className="tnum">{stats.invoices_count}</span>} tone="info" icon={<Hash className="size-5" />} />
      </div>

      <LinkTabs
        tabs={[
          { value: 'ledger', label: 'الحركات' },
          { value: 'purchases', label: 'المشتريات' },
          { value: 'payments', label: 'الدفعات' },
        ]}
      />

      {/* ————— الحركات (كشف الحساب) ————— */}
      {ledger ? (
        <>
          <Card>
            {ledger.rows.length === 0 ? (
              <EmptyState title="لا توجد حركات" description="ستظهر هنا فواتير المشتريات والدفعات فور تسجيلها" />
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
                          {Number(e.debit) > 0 ? (
                            <Money value={e.debit} symbol={false} className="text-[--color-money-pos]" />
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-end">
                          {Number(e.credit) > 0 ? <Money value={e.credit} symbol={false} /> : <span className="text-ink-300">—</span>}
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

      {/* ————— المشتريات ————— */}
      {purchasesData ? (
        <>
          <Card>
            {purchasesData.rows.length === 0 ? (
              <EmptyState title="لا توجد مشتريات من هذا المورد" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-xs text-ink-500">
                      <th className="px-4 py-3 text-start font-bold">رقم الفاتورة</th>
                      <th className="px-2 py-3 text-start font-bold">فاتورة المورد</th>
                      <th className="px-2 py-3 text-start font-bold">التاريخ</th>
                      <th className="px-2 py-3 text-end font-bold">الإجمالي</th>
                      <th className="px-2 py-3 text-end font-bold">المتبقي</th>
                      <th className="px-4 py-3 text-center font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {purchasesData.rows.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-primary-50/40">
                        <td className="px-4 py-2.5">
                          <Link href={`/purchases/${p.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                            {p.invoice_no}
                          </Link>
                        </td>
                        <td className="tnum px-2 py-2.5 text-xs text-ink-500" dir="ltr">{p.supplier_invoice_no ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-ink-500">
                          {fmtDateShort(p.purchase_date)} — {fmtTime(p.purchase_date)}
                        </td>
                        <td className="px-2 py-2.5 text-end"><Money value={p.total} /></td>
                        <td className="px-2 py-2.5 text-end">
                          {Number(p.remaining) > 0 ? (
                            <Money value={p.remaining} symbol={false} className="text-red-600" />
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Pagination page={page} pageSize={25} total={purchasesData.total} />
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
    </div>
  );
}

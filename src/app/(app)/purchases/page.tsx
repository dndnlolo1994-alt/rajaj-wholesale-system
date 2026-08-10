import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { listPurchases } from '@/server/queries/purchases';
import { PageHeader, Money, EmptyState } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { fmtDateShort, fmtTime } from '@/lib/format/date';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'المشتريات' };
export const dynamic = 'force-dynamic';

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string; from?: string; to?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const status = (params.tab as 'completed' | 'void' | 'all') ?? 'all';
  const page = Number(params.page ?? 1);

  const { rows, total } = await listPurchases({
    q: params.q,
    status,
    from: params.from,
    to: params.to,
    page,
  });

  return (
    <div>
      <PageHeader
        title="المشتريات"
        description={`${total} فاتورة مشتريات`}
        actions={
          <Link href="/purchases/new">
            <Button>
              <Plus className="size-4" />
              فاتورة مشتريات
            </Button>
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="بحث برقمنا أو رقم فاتورة المورد..." className="w-full sm:w-72" />
        <DateFilters from={params.from} to={params.to} />
      </div>

      <LinkTabs
        tabs={[
          { value: 'all', label: 'الكل' },
          { value: 'completed', label: 'مكتملة' },
          { value: 'void', label: 'ملغاة' },
        ]}
        className="mb-3"
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا توجد فواتير مشتريات" description="سجّل أول فاتورة مشتريات من زر فاتورة مشتريات" />
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-start text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">رقمنا</th>
                    <th className="px-4 py-3 text-start font-bold">رقم فاتورة المورد</th>
                    <th className="px-4 py-3 text-start font-bold">المورد</th>
                    <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                    <th className="px-4 py-3 text-end font-bold">الإجمالي</th>
                    <th className="px-4 py-3 text-end font-bold">المدفوع</th>
                    <th className="px-4 py-3 text-end font-bold">المتبقي</th>
                    <th className="px-4 py-3 text-center font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-3">
                        <Link href={`/purchases/${p.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                          {p.invoice_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {p.supplier_invoice_no ? (
                          <span className="tnum text-ink-700" dir="ltr">{p.supplier_invoice_no}</span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold">{p.supplier?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-500">
                        {fmtDateShort(p.purchase_date)} — {fmtTime(p.purchase_date)}
                      </td>
                      <td className="px-4 py-3 text-end"><Money value={p.total} /></td>
                      <td className="px-4 py-3 text-end"><Money value={p.paid} symbol={false} /></td>
                      <td className="px-4 py-3 text-end">
                        {p.remaining > 0 ? <Money value={p.remaining} className="text-red-600" symbol={false} /> : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات الجوال */}
            <div className="divide-y divide-ink-100 lg:hidden">
              {rows.map((p) => (
                <Link key={p.id} href={`/purchases/${p.id}`} className="block p-3.5 transition-colors hover:bg-primary-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold">{p.supplier?.name ?? '—'}</p>
                    <Money value={p.total} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                    <span className="tnum" dir="ltr">
                      {p.invoice_no}
                      {p.supplier_invoice_no ? ` / ${p.supplier_invoice_no}` : ''}
                    </span>
                    <span>{fmtDateShort(p.purchase_date)} {fmtTime(p.purchase_date)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StatusBadge status={p.status} />
                    {p.remaining > 0 && p.status === 'completed' ? (
                      <span className="text-xs font-bold text-red-600">متبقٍ للمورد <Money value={p.remaining} className="text-xs" /></span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </div>
  );
}

function DateFilters({ from, to }: { from?: string; to?: string }) {
  return (
    <form className="flex items-center gap-2" method="get">
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

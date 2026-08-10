import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { listSales } from '@/server/queries/sales';
import { PageHeader, Money, EmptyState } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { fmtDateShort, fmtTime } from '@/lib/format/date';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'الفواتير' };
export const dynamic = 'force-dynamic';

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string; from?: string; to?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const status = (params.tab as 'completed' | 'void' | 'all') ?? 'all';
  const page = Number(params.page ?? 1);

  const { rows, total } = await listSales({
    q: params.q,
    status,
    from: params.from,
    to: params.to,
    page,
  });
  const customerLabel = (sale: (typeof rows)[number]) => sale.customer?.name ?? sale.cash_customer_name ?? 'زبون نقدي';

  return (
    <div>
      <PageHeader
        title="الفواتير"
        description={`${total} فاتورة`}
        actions={
          <Link href="/pos">
            <Button>
              <Plus className="size-4" />
              بيع جديد
            </Button>
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="بحث برقم الفاتورة..." className="w-full sm:w-72" />
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
          <EmptyState title="لا توجد فواتير" description="ابدأ البيع من شاشة بيع جديد" />
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-start text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">رقم الفاتورة</th>
                    <th className="px-4 py-3 text-start font-bold">العميل</th>
                    <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                    <th className="px-4 py-3 text-end font-bold">الإجمالي</th>
                    <th className="px-4 py-3 text-end font-bold">المدفوع</th>
                    <th className="px-4 py-3 text-end font-bold">المتبقي</th>
                    <th className="px-4 py-3 text-center font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-3">
                        <Link href={`/sales/${s.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                          {s.invoice_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-bold">{customerLabel(s)}</td>
                      <td className="px-4 py-3 text-ink-500">
                        {fmtDateShort(s.sale_date)} — {fmtTime(s.sale_date)}
                      </td>
                      <td className="px-4 py-3 text-end"><Money value={s.total} /></td>
                      <td className="px-4 py-3 text-end"><Money value={s.paid} symbol={false} /></td>
                      <td className="px-4 py-3 text-end">
                        {s.remaining > 0 ? <Money value={s.remaining} className="text-red-600" symbol={false} /> : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات الجوال */}
            <div className="divide-y divide-ink-100 lg:hidden">
              {rows.map((s) => (
                <Link key={s.id} href={`/sales/${s.id}`} className="block p-3.5 transition-colors hover:bg-primary-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold">{customerLabel(s)}</p>
                    <Money value={s.total} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                    <span className="tnum" dir="ltr">{s.invoice_no}</span>
                    <span>{fmtDateShort(s.sale_date)} {fmtTime(s.sale_date)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StatusBadge status={s.status} />
                    {s.remaining > 0 && s.status === 'completed' ? (
                      <span className="text-xs font-bold text-red-600">متبقٍ <Money value={s.remaining} className="text-xs" /></span>
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

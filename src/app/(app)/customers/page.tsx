import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { listCustomers } from '@/server/queries/customers';
import { PageHeader, Money, EmptyState } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Button } from '@/components/ui/button';
import { CustomerFormDialog } from './customer-form';

export const metadata = { title: 'العملاء' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const tab = (params.tab as 'all' | 'debt' | 'inactive') ?? 'all';
  const page = Number(params.page ?? 1);

  const { rows, total } = await listCustomers({ q: params.q, tab, page });

  return (
    <div>
      <PageHeader
        title="العملاء"
        description={`${total} عميل`}
        actions={
          <CustomerFormDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                عميل جديد
              </Button>
            }
          />
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="بحث بالاسم، المحل، الهاتف..." className="w-full sm:w-72" />
      </div>

      <LinkTabs
        tabs={[
          { value: 'all', label: 'الكل' },
          { value: 'debt', label: 'عليهم ديون' },
          { value: 'inactive', label: 'موقوفون' },
        ]}
        className="mb-3"
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title="لا يوجد عملاء"
            description="أضف عميلك الأول لبدء تسجيل المبيعات الآجلة والأسعار الخاصة"
          />
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-start text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">الاسم</th>
                    <th className="px-4 py-3 text-start font-bold">المحل</th>
                    <th className="px-4 py-3 text-start font-bold">الهاتف</th>
                    <th className="px-4 py-3 text-start font-bold">المنطقة</th>
                    <th className="px-4 py-3 text-end font-bold">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-3">
                        <Link href={`/customers/${c.id}`} className="font-bold text-primary-700 hover:underline">
                          {c.name}
                        </Link>
                        {!c.is_active ? <Badge tone="danger" className="ms-2">موقوف</Badge> : null}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{c.shop_name ?? <span className="text-ink-300">—</span>}</td>
                      <td className="px-4 py-3">
                        {c.phone ? (
                          <span className="tnum text-ink-700" dir="ltr">{c.phone}</span>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-500">{c.area ?? <span className="text-ink-300">—</span>}</td>
                      <td className="px-4 py-3 text-end">
                        {Number(c.balance) !== 0 ? (
                          <Money value={c.balance} className={Number(c.balance) > 0 ? 'text-red-600' : undefined} />
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات الجوال */}
            <div className="divide-y divide-ink-100 lg:hidden">
              {rows.map((c) => (
                <Link key={c.id} href={`/customers/${c.id}`} className="block p-3.5 transition-colors hover:bg-primary-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold">
                      {c.name}
                      {!c.is_active ? <Badge tone="danger" className="ms-2">موقوف</Badge> : null}
                    </p>
                    {Number(c.balance) !== 0 ? (
                      <Money value={c.balance} className={Number(c.balance) > 0 ? 'text-red-600' : undefined} />
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                    <span className="truncate">{[c.shop_name, c.area].filter(Boolean).join(' — ') || '—'}</span>
                    {c.phone ? <span className="tnum shrink-0" dir="ltr">{c.phone}</span> : null}
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

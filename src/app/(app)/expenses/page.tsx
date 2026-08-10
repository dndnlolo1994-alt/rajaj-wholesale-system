import { CalendarRange, ReceiptText } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage } from '@/lib/perms';
import { listExpenseCategories, listExpenses, sumExpenses } from '@/server/queries/expenses';
import { voidExpenseAction } from '@/server/actions/expenses';
import { PageHeader, Money, EmptyState, StatCard } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { VoidDialog } from '@/components/void-dialog';
import { fmtDateTime, monthStartISO, todayISO } from '@/lib/format/date';
import { paymentMethodLabels } from '@/lib/settings';
import type { ExpenseCategory } from '@/lib/types/db';
import { ExpenseDialog } from './expense-dialog';
import { ExpenseCategoriesDialog } from './expense-categories-dialog';

export const metadata = { title: 'المصروفات' };
export const dynamic = 'force-dynamic';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string; from?: string; to?: string; page?: string }>;
}) {
  const profile = await requireProfile(['owner', 'manager', 'accountant']);
  const manage = canManage(profile.role);
  const sp = await searchParams;
  const status = (sp.tab as 'completed' | 'void' | 'all') ?? 'all';
  const page = Math.max(1, Number(sp.page ?? 1));
  const today = todayISO();

  const [todaySum, monthSum, categories, { rows, total }] = await Promise.all([
    sumExpenses(today, today),
    sumExpenses(monthStartISO(), today),
    listExpenseCategories(),
    listExpenses({ categoryId: sp.cat || undefined, status, from: sp.from, to: sp.to, page }),
  ]);

  const activeCategories = categories.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <PageHeader
        title="المصروفات"
        description={`${total} مصروف`}
        actions={
          <>
            <ExpenseCategoriesDialog categories={categories} />
            <ExpenseDialog categories={activeCategories} />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:max-w-xl">
        <StatCard
          title="مصاريف اليوم"
          value={<Money value={todaySum} />}
          icon={<ReceiptText className="size-5" />}
          tone="danger"
        />
        <StatCard
          title="مصاريف هذا الشهر"
          value={<Money value={monthSum} />}
          icon={<CalendarRange className="size-5" />}
          tone="warning"
        />
      </div>

      <ExpenseFilters categories={categories} tab={status} cat={sp.cat} from={sp.from} to={sp.to} />

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
          <EmptyState title="لا توجد مصروفات" description="سجّل أول مصروف من زر «مصروف جديد»" />
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">الرقم</th>
                    <th className="px-4 py-3 text-start font-bold">التصنيف</th>
                    <th className="px-4 py-3 text-end font-bold">المبلغ</th>
                    <th className="px-4 py-3 text-start font-bold">الطريقة</th>
                    <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                    <th className="px-4 py-3 text-start font-bold">ملاحظات</th>
                    <th className="px-4 py-3 text-center font-bold">الحالة</th>
                    <th className="px-4 py-3 text-end font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-3">
                        <span className="tnum font-bold" dir="ltr">{e.expense_no}</span>
                        {e.creator?.full_name ? (
                          <p className="text-xs text-ink-400">{e.creator.full_name}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-bold">{e.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-end"><Money value={e.amount} /></td>
                      <td className="px-4 py-3 text-ink-500">{paymentMethodLabels[e.method]}</td>
                      <td className="px-4 py-3 text-ink-500">{fmtDateTime(e.expense_date)}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-ink-500">{e.notes ?? '—'}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-3 text-end">
                        {e.status === 'completed' && manage ? (
                          <VoidDialog
                            id={e.id}
                            label="المصروف"
                            action={voidExpenseAction}
                            buttonLabel="إلغاء"
                            description="سيُعاد المبلغ إلى الصندوق ويبقى المصروف في السجل بحالة ملغى."
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات الجوال */}
            <div className="divide-y divide-ink-100 lg:hidden">
              {rows.map((e) => (
                <div key={e.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold">{e.category?.name ?? '—'}</p>
                    <Money value={e.amount} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                    <span className="tnum" dir="ltr">{e.expense_no}</span>
                    <span>{fmtDateTime(e.expense_date)}</span>
                  </div>
                  {e.notes ? <p className="mt-1 truncate text-xs text-ink-500">{e.notes}</p> : null}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      <span className="text-xs text-ink-500">{paymentMethodLabels[e.method]}</span>
                    </div>
                    {e.status === 'completed' && manage ? (
                      <VoidDialog
                        id={e.id}
                        label="المصروف"
                        action={voidExpenseAction}
                        buttonLabel="إلغاء"
                        description="سيُعاد المبلغ إلى الصندوق ويبقى المصروف في السجل بحالة ملغى."
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </div>
  );
}

function ExpenseFilters({
  categories,
  tab,
  cat,
  from,
  to,
}: {
  categories: ExpenseCategory[];
  tab: string;
  cat?: string;
  from?: string;
  to?: string;
}) {
  return (
    <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tab" value={tab} />
      <div className="w-48">
        <Select name="cat" defaultValue={cat ?? ''}>
          <option value="">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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

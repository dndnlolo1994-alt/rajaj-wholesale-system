import Link from 'next/link';
import { AlertTriangle, Boxes, Hourglass, Plus, Wallet } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import {
  getStagnantProducts,
  getStockOverview,
  listInventoryCounts,
  listProducts,
  listStockMovements,
} from '@/server/queries/products';
import { PageHeader, Money, EmptyState, StatCard } from '@/components/ui/misc';
import { Card, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Button } from '@/components/ui/button';
import { formatQty } from '@/lib/calc/units';
import { fmtDateShort, fmtDateTime } from '@/lib/format/date';
import type { StockMoveType } from '@/lib/types/db';

export const metadata = { title: 'المخزون والجرد' };
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

const countTypeLabels: Record<string, string> = {
  daily: 'يومي',
  monthly: 'شهري',
  manual: 'يدوي',
};

type Tab = 'overview' | 'movements' | 'counts' | 'low';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; type?: string; from?: string; to?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const tab = (sp.tab as Tab) ?? 'overview';
  const page = Number(sp.page ?? 1);
  const showProfit = canSeeProfit(profile.role);
  const canCount = ['owner', 'manager', 'warehouse'].includes(profile.role);

  return (
    <div>
      <PageHeader
        title="المخزون والجرد"
        description="نظرة عامة، حركات المخزون، وجلسات الجرد"
        actions={
          canCount ? (
            <Link href="/inventory/counts/new">
              <Button>
                <Plus className="size-4" />
                جرد جديد
              </Button>
            </Link>
          ) : undefined
        }
      />

      <LinkTabs
        tabs={[
          { value: 'overview', label: 'نظرة عامة' },
          { value: 'movements', label: 'الحركات' },
          { value: 'counts', label: 'الجرد' },
          { value: 'low', label: 'مخزون منخفض' },
        ]}
        className="mb-3"
      />

      {tab === 'overview' ? (
        <OverviewTab showProfit={showProfit} />
      ) : tab === 'movements' ? (
        <MovementsTab page={page} type={sp.type} from={sp.from} to={sp.to} />
      ) : tab === 'counts' ? (
        <CountsTab page={page} showProfit={showProfit} canCount={canCount} />
      ) : (
        <LowTab page={page} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// نظرة عامة
// ---------------------------------------------------------------------
async function OverviewTab({ showProfit }: { showProfit: boolean }) {
  const [overview, stagnant] = await Promise.all([getStockOverview(), getStagnantProducts()]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showProfit ? (
          <StatCard title="قيمة المخزون (بالتكلفة)" value={<Money value={overview.totalValue} />} icon={<Wallet className="size-5" />} />
        ) : null}
        <StatCard title="الأصناف الفعالة" value={<span className="tnum">{overview.activeCount}</span>} icon={<Boxes className="size-5" />} href="/products?tab=active" />
        <StatCard
          title="تحت الحد الأدنى"
          value={<span className="tnum">{overview.lowCount}</span>}
          tone={overview.lowCount > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className="size-5" />}
          href="/inventory?tab=low"
        />
        <StatCard
          title="أصناف راكدة"
          value={<span className="tnum">{stagnant.rows.length}</span>}
          sub={`بلا بيع منذ ${stagnant.days} يومًا`}
          tone={stagnant.rows.length > 0 ? 'warning' : 'default'}
          icon={<Hourglass className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* مخزون منخفض */}
        <Card>
          <CardHeader
            title={`مخزون منخفض (${overview.lowCount})`}
            action={
              overview.lowCount > 0 ? (
                <Link href="/inventory?tab=low" className="text-xs font-bold text-primary-700 hover:underline">
                  عرض الكل
                </Link>
              ) : undefined
            }
          />
          {overview.lowList.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">كل الأصناف فوق الحد الأدنى ✓</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {overview.lowList.slice(0, 8).map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-primary-50/40">
                  <p className="min-w-0 truncate text-sm font-bold">{p.name}</p>
                  <div className="shrink-0 text-end">
                    <p className="tnum text-sm font-extrabold text-red-600">{formatQty(p.stock_units, p.units_per_carton)}</p>
                    <p className="tnum text-[11px] text-ink-500">الحد: {formatQty(p.min_stock_units, p.units_per_carton)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* الأصناف الراكدة */}
        <Card>
          <CardHeader title={`أصناف راكدة (${stagnant.rows.length})`} />
          {stagnant.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">لا توجد أصناف راكدة ✓</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {stagnant.rows.slice(0, 8).map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-primary-50/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="text-[11px] text-ink-500">
                      {p.last_sale_at ? `آخر بيع: ${fmtDateShort(p.last_sale_at)}` : 'لم يُبع أبدًا'}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="tnum text-sm font-bold">{formatQty(p.stock_units, p.units_per_carton)}</p>
                    {showProfit ? <Money value={p.stock_value} className="text-[11px] text-ink-500" /> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// الحركات
// ---------------------------------------------------------------------
async function MovementsTab({ page, type, from, to }: { page: number; type?: string; from?: string; to?: string }) {
  const { rows, total } = await listStockMovements({
    type: (type as StockMoveType | 'all') ?? 'all',
    from,
    to,
    page,
  });

  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-center gap-2" method="get">
        <input type="hidden" name="tab" value="movements" />
        <select name="type" defaultValue={type ?? 'all'} className="h-11 rounded-lg border border-ink-300 bg-white px-2.5 text-sm">
          <option value="all">كل الأنواع</option>
          {Object.entries(moveLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} className="h-11 rounded-lg border border-ink-300 bg-white px-2.5 text-sm" />
        <span className="text-xs text-ink-500">إلى</span>
        <input type="date" name="to" defaultValue={to} className="h-11 rounded-lg border border-ink-300 bg-white px-2.5 text-sm" />
        <Button type="submit" variant="outline" size="sm">
          تصفية
        </Button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا توجد حركات" description="جرّب تغيير الفلاتر" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">التاريخ</th>
                  <th className="px-2 py-2.5 text-start font-bold">الصنف</th>
                  <th className="px-2 py-2.5 text-start font-bold">النوع</th>
                  <th className="px-2 py-2.5 text-start font-bold">التغير</th>
                  <th className="px-2 py-2.5 text-start font-bold">الرصيد بعد</th>
                  <th className="px-4 py-2.5 text-start font-bold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((m) => {
                  const upc = m.product?.units_per_carton ?? 1;
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">{fmtDateTime(m.created_at)}</td>
                      <td className="max-w-[16rem] px-2 py-2.5">
                        {m.product ? (
                          <Link href={`/products/${m.product.id}`} className="block truncate font-bold text-primary-700 hover:underline">
                            {m.product.name}
                          </Link>
                        ) : (
                          <span className="text-ink-500">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-bold">{moveLabels[m.move_type] ?? m.move_type}</td>
                      <td className="whitespace-nowrap px-2 py-2.5">
                        <span className={`tnum font-extrabold ${m.qty_change > 0 ? 'text-emerald-700' : m.qty_change < 0 ? 'text-red-600' : 'text-ink-500'}`}>
                          {m.qty_change > 0 ? '+' : m.qty_change < 0 ? '−' : ''}
                          {formatQty(Math.abs(m.qty_change), upc)}
                        </span>
                      </td>
                      <td className="tnum whitespace-nowrap px-2 py-2.5 font-bold">{formatQty(m.balance_after, upc)}</td>
                      <td className="max-w-[14rem] truncate px-4 py-2.5 text-xs text-ink-500">{m.notes ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </div>
  );
}

// ---------------------------------------------------------------------
// جلسات الجرد
// ---------------------------------------------------------------------
async function CountsTab({ page, showProfit, canCount }: { page: number; showProfit: boolean; canCount: boolean }) {
  const { rows, total } = await listInventoryCounts(page);

  return (
    <div className="space-y-3">
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="لا توجد جلسات جرد"
            description="ابدأ جلسة جرد لمطابقة المخزون الفعلي مع النظام"
            action={
              canCount ? (
                <Link href="/inventory/counts/new">
                  <Button>
                    <Plus className="size-4" />
                    جرد جديد
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">الرقم</th>
                  <th className="px-2 py-2.5 text-start font-bold">النوع</th>
                  <th className="px-2 py-2.5 text-center font-bold">الحالة</th>
                  <th className="px-2 py-2.5 text-center font-bold">الأصناف</th>
                  <th className="px-2 py-2.5 text-center font-bold">المعدود</th>
                  <th className="px-2 py-2.5 text-center font-bold">فرق الحبات</th>
                  {showProfit ? <th className="px-2 py-2.5 text-end font-bold">فرق القيمة</th> : null}
                  <th className="px-4 py-2.5 text-start font-bold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/inventory/counts/${c.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                        {c.count_no}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-bold">{countTypeLabels[c.count_type] ?? c.count_type}</td>
                    <td className="px-2 py-2.5 text-center"><StatusBadge status={c.status} /></td>
                    <td className="tnum px-2 py-2.5 text-center">{c.items_total}</td>
                    <td className="tnum px-2 py-2.5 text-center">{c.counted_items}</td>
                    <td className="px-2 py-2.5 text-center">
                      {c.status === 'completed' ? (
                        <span className={`tnum font-bold ${c.total_diff_units > 0 ? 'text-emerald-700' : c.total_diff_units < 0 ? 'text-red-600' : 'text-ink-500'}`}>
                          {c.total_diff_units > 0 ? '+' : ''}
                          {c.total_diff_units}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    {showProfit ? (
                      <td className="px-2 py-2.5 text-end">
                        {c.status === 'completed' ? <Money value={c.total_diff_value} signed symbol={false} /> : <span className="text-ink-300">—</span>}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">{fmtDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </div>
  );
}

// ---------------------------------------------------------------------
// المخزون المنخفض (القائمة الكاملة)
// ---------------------------------------------------------------------
async function LowTab({ page }: { page: number }) {
  const { rows, total } = await listProducts({ tab: 'low', page });

  return (
    <div className="space-y-3">
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا يوجد مخزون منخفض" description="كل الأصناف الفعالة فوق حدّها الأدنى ✓" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">الصنف</th>
                  <th className="px-2 py-2.5 text-start font-bold">القسم</th>
                  <th className="px-2 py-2.5 text-start font-bold">المخزون</th>
                  <th className="px-2 py-2.5 text-start font-bold">الحد الأدنى</th>
                  <th className="px-4 py-2.5 text-start font-bold">النقص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((p) => {
                  const shortage = Math.max(0, Number(p.min_stock_units) - Number(p.stock_units));
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/products/${p.id}`} className="font-bold text-primary-700 hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-500">{p.category?.name ?? '—'}</td>
                      <td className="tnum whitespace-nowrap px-2 py-2.5 font-extrabold text-red-600">
                        {formatQty(p.stock_units, p.units_per_carton)}
                      </td>
                      <td className="tnum whitespace-nowrap px-2 py-2.5">{formatQty(p.min_stock_units, p.units_per_carton)}</td>
                      <td className="tnum whitespace-nowrap px-4 py-2.5 font-bold text-amber-700">
                        {shortage > 0 ? formatQty(shortage, p.units_per_carton) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </div>
  );
}

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage } from '@/lib/perms';
import { listBrandsAll, listCategoriesAll, listProducts, type ProductTab } from '@/server/queries/products';
import { PageHeader, Money, EmptyState } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Button } from '@/components/ui/button';
import { ProductIcon } from '@/components/products/product-icon';
import { formatQty } from '@/lib/calc/units';
import { CategoriesDialog } from './categories-dialog';

export const metadata = { title: 'الأصناف' };
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string; category?: string; brand?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;
  const tab = (params.tab as ProductTab) ?? 'all';
  const page = Number(params.page ?? 1);
  const canEdit = ['owner', 'manager', 'warehouse'].includes(profile.role);

  const [{ rows, total }, categories, brands] = await Promise.all([
    listProducts({ q: params.q, categoryId: params.category, brand: params.brand, tab, page }),
    listCategoriesAll(),
    listBrandsAll(),
  ]);

  return (
    <div>
      <PageHeader
        title="الأصناف"
        description={`${total} صنف`}
        actions={
          <>
            <CategoriesDialog categories={categories} canManage={canManage(profile.role)} />
            {canEdit ? (
              <Link href="/products/new">
                <Button>
                  <Plus className="size-4" />
                  صنف جديد
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="بحث بالاسم، الشركة، الباركود..." className="w-full sm:w-72" />
        <CategoryFilter categories={categories} selected={params.category} q={params.q} tab={params.tab} brand={params.brand} />
        <BrandFilter brands={brands} selected={params.brand} q={params.q} tab={params.tab} category={params.category} />
      </div>

      <LinkTabs
        tabs={[
          { value: 'all', label: 'الكل' },
          { value: 'active', label: 'فعال' },
          { value: 'inactive', label: 'موقوف' },
          { value: 'low', label: 'مخزون منخفض' },
        ]}
        className="mb-3"
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="لا توجد أصناف"
            description={tab === 'low' ? 'لا يوجد صنف تحت الحد الأدنى' : 'أضف أصنافك لبدء العمل'}
            action={
              canEdit && tab !== 'low' ? (
                <Link href="/products/new">
                  <Button>
                    <Plus className="size-4" />
                    صنف جديد
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* جدول الشاشات الكبيرة */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-start text-xs text-ink-500">
                    <th className="px-4 py-3 text-start font-bold">الاسم</th>
                    <th className="px-4 py-3 text-start font-bold">الباركود</th>
                    <th className="px-4 py-3 text-start font-bold">القسم</th>
                    <th className="px-4 py-3 text-start font-bold">المخزون</th>
                    <th className="px-4 py-3 text-end font-bold">سعر الكرتونة</th>
                    <th className="px-4 py-3 text-end font-bold">سعر الحبة</th>
                    <th className="px-4 py-3 text-center font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((p) => {
                    const low = Number(p.min_stock_units) > 0 && Number(p.stock_units) <= Number(p.min_stock_units);
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-primary-50/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <ProductIcon name={p.name} brand={p.brand} imageUrl={p.image_url} size="sm" />
                            <div className="min-w-0">
                              <Link href={`/products/${p.id}`} className="font-bold text-primary-700 hover:underline">
                                {p.name}
                              </Link>
                              {p.brand ? <p className="text-xs text-ink-500">{p.brand}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.barcode ? (
                            <span className="tnum text-ink-700" dir="ltr">{p.barcode}</span>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-500">{p.category?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`tnum font-bold ${low ? 'text-red-600' : 'text-ink-700'}`}>
                            {formatQty(p.stock_units, p.units_per_carton)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end"><Money value={p.sale_price_carton} symbol={false} /></td>
                        <td className="px-4 py-3 text-end"><Money value={p.sale_price_piece} symbol={false} /></td>
                        <td className="px-4 py-3 text-center">
                          <Badge tone={p.is_active ? 'success' : 'muted'}>{p.is_active ? 'فعال' : 'موقوف'}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* بطاقات الجوال */}
            <div className="divide-y divide-ink-100 lg:hidden">
              {rows.map((p) => {
                const low = Number(p.min_stock_units) > 0 && Number(p.stock_units) <= Number(p.min_stock_units);
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="block p-3.5 transition-colors hover:bg-primary-50/40">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProductIcon name={p.name} brand={p.brand} imageUrl={p.image_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{p.name}</p>
                          {p.brand ? <p className="truncate text-xs text-ink-500">{p.brand}</p> : null}
                        </div>
                      </div>
                      <Badge tone={p.is_active ? 'success' : 'muted'}>{p.is_active ? 'فعال' : 'موقوف'}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-500">
                      <span>{p.category?.name ?? 'بدون قسم'}</span>
                      {p.barcode ? <span className="tnum" dir="ltr">{p.barcode}</span> : null}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className={`tnum text-xs font-bold ${low ? 'text-red-600' : 'text-ink-700'}`}>
                        {formatQty(p.stock_units, p.units_per_carton)}
                      </span>
                      <span className="text-xs text-ink-500">
                        كرتونة <Money value={p.sale_price_carton} symbol={false} className="text-xs" />
                        {' — '}
                        حبة <Money value={p.sale_price_piece} symbol={false} className="text-xs" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </div>
  );
}

function CategoryFilter({
  categories,
  selected,
  q,
  tab,
  brand,
}: {
  categories: { id: string; name: string }[];
  selected?: string;
  q?: string;
  tab?: string;
  brand?: string;
}) {
  return (
    <form className="flex items-center gap-2" method="get">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {tab ? <input type="hidden" name="tab" value={tab} /> : null}
      {brand ? <input type="hidden" name="brand" value={brand} /> : null}
      <select
        name="category"
        defaultValue={selected ?? ''}
        className="h-11 rounded-lg border border-ink-300 bg-white px-2.5 text-sm font-bold"
      >
        <option value="">كل الأقسام</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        تصفية
      </Button>
    </form>
  );
}

function BrandFilter({
  brands,
  selected,
  q,
  tab,
  category,
}: {
  brands: string[];
  selected?: string;
  q?: string;
  tab?: string;
  category?: string;
}) {
  return (
    <form className="flex items-center gap-2" method="get">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {tab ? <input type="hidden" name="tab" value={tab} /> : null}
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <select
        name="brand"
        defaultValue={selected ?? ''}
        className="h-11 rounded-lg border border-primary-300 bg-white px-2.5 text-sm font-bold text-primary-900 shadow-sm"
      >
        <option value="">🏭 كل الشركات / الماركات</option>
        {brands.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        تصفية شركة
      </Button>
    </form>
  );
}

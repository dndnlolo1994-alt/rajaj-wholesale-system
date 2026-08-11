import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { canManage, canSeeProfit } from '@/lib/perms';
import {
  getProductFull,
  listProductMovements,
  listProductPurchases,
  listProductSales,
} from '@/server/queries/products';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Money, PageHeader, EmptyState } from '@/components/ui/misc';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductIcon } from '@/components/products/product-icon';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateShort, fmtDateTime, fmtTime } from '@/lib/format/date';
import { formatQty, unitLabel, derivePiecePrice } from '@/lib/calc/units';
import { formatPercent, marginPercent, profitPercentOnCost, round3 } from '@/lib/calc/money';
import { AdjustStockDialog, ProductAdminActions } from './adjust-dialog';

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

type Tab = 'movements' | 'purchases' | 'sales';

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const tab = (sp.tab as Tab) ?? 'movements';
  const page = Number(sp.page ?? 1);

  const product = await getProductFull(id);
  if (!product) notFound();

  const showProfit = canSeeProfit(profile.role);
  const isManager = canManage(profile.role);
  const canEdit = ['owner', 'manager', 'warehouse'].includes(profile.role);
  const low = Number(product.min_stock_units) > 0 && Number(product.stock_units) <= Number(product.min_stock_units);
  const upc = Math.max(1, product.units_per_carton);
  const avgCost = Number(product.avg_unit_cost);
  const stockValue = Number(product.stock_units) * avgCost;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <ProductIcon name={product.name} brand={product.brand} imageUrl={product.image_url} size="lg" />
            <span>{product.name}</span>
          </span>
        }
        description={product.brand ?? undefined}
        actions={
          <>
            <Link href="/products">
              <Button variant="ghost" size="sm">
                <ArrowRight className="size-4" />
                الأصناف
              </Button>
            </Link>
            <ProductAdminActions
              product={{ id: product.id, name: product.name, is_active: product.is_active }}
              canEdit={canEdit}
              canDelete={isManager}
            />
          </>
        }
      />

      {!product.is_active ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          هذا الصنف موقوف — لا يظهر في شاشة البيع.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* معلومات الصنف */}
        <Card className="lg:col-span-1">
          <CardHeader title="معلومات الصنف" />
          <CardBody className="space-y-2 text-sm">
            <InfoRow label="الحالة" value={<Badge tone={product.is_active ? 'success' : 'muted'}>{product.is_active ? 'فعال' : 'موقوف'}</Badge>} />
            <InfoRow
              label="الباركود"
              value={product.barcode ? <span className="tnum font-bold" dir="ltr">{product.barcode}</span> : '—'}
            />
            <InfoRow label="SKU" value={product.sku ? <span className="tnum font-bold" dir="ltr">{product.sku}</span> : '—'} />
            <InfoRow label="القسم" value={product.category?.name ?? '—'} />
            <InfoRow label="الشركة / العلامة" value={product.brand ?? '—'} />
            <InfoRow label="عدد الحبات في الكرتونة" value={<span className="tnum font-bold">{product.units_per_carton}</span>} />
            {product.description ? (
              <p className="rounded-lg bg-ink-100/60 p-2 text-xs leading-5 text-ink-700">{product.description}</p>
            ) : null}
            {product.notes ? (
              <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-800">ملاحظة: {product.notes}</p>
            ) : null}
            <div className="border-t border-ink-100 pt-2 text-xs text-ink-500">
              <p>أُضيف: {fmtDateTime(product.created_at)}</p>
              <p className="mt-0.5">آخر تعديل: {fmtDateTime(product.updated_at)}</p>
            </div>
          </CardBody>
        </Card>

        {/* المخزون */}
        <Card className="lg:col-span-1">
          <CardHeader title="المخزون" action={isManager ? (
            <AdjustStockDialog productId={product.id} stockUnits={product.stock_units} unitsPerCarton={product.units_per_carton} />
          ) : undefined} />
          <CardBody className="space-y-3">
            <div>
              <p className={`tnum text-2xl font-extrabold ${low ? 'text-red-600' : 'text-ink-900'}`}>
                {formatQty(product.stock_units, product.units_per_carton)}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                <span className="tnum">{product.stock_units}</span> حبة
                {low ? <span className="ms-2 font-bold text-red-600">— تحت الحد الأدنى</span> : null}
              </p>
            </div>
            <div className="space-y-1.5 border-t border-ink-100 pt-2 text-sm">
              <InfoRow
                label="الحد الأدنى"
                value={<span className="tnum font-bold">{formatQty(product.min_stock_units, product.units_per_carton)}</span>}
              />
              {showProfit ? (
                <>
                  <InfoRow label="قيمة المخزون (بالتكلفة)" value={<Money value={stockValue} />} />
                  <InfoRow label="متوسط تكلفة الحبة" value={<Money value={avgCost} />} />
                  <InfoRow label="متوسط تكلفة الكرتونة" value={<Money value={avgCost * upc} />} />
                </>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* الأسعار */}
        <Card className="lg:col-span-1">
          <CardHeader title="الأسعار" />
          <CardBody className="space-y-1.5 text-sm">
            {showProfit ? <InfoRow label="شراء الكرتونة" value={<Money value={product.purchase_price_carton} />} /> : null}
            <InfoRow label="بيع الكرتونة" value={<Money value={product.sale_price_carton} />} />
            <InfoRow label="بيع الحبة" value={<Money value={product.sale_price_piece} />} />
            {product.wholesale_price_carton != null ? (
              <InfoRow label="جملة خاص — كرتونة" value={<Money value={product.wholesale_price_carton} />} />
            ) : null}
            {product.wholesale_price_piece != null ? (
              <InfoRow label="جملة خاص — حبة" value={<Money value={product.wholesale_price_piece} />} />
            ) : null}
            {showProfit && Number(product.purchase_price_carton) > 0 ? (
              <div className="mt-2 space-y-1 rounded-lg border border-primary-100 bg-primary-50/60 p-2.5 text-xs">
                <p className="font-extrabold text-primary-900">الربح (داخلي)</p>
                <ProfitRow
                  label="الكرتونة"
                  cost={Number(product.purchase_price_carton)}
                  price={Number(product.sale_price_carton)}
                />
                <ProfitRow
                  label="الحبة"
                  cost={derivePiecePrice(Number(product.purchase_price_carton), upc)}
                  price={Number(product.sale_price_piece)}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* التبويبات */}
      <LinkTabs
        tabs={[
          { value: 'movements', label: 'حركة المخزون' },
          { value: 'purchases', label: 'المشتريات' },
          { value: 'sales', label: 'المبيعات' },
        ]}
      />

      {tab === 'movements' ? (
        <MovementsTab productId={product.id} unitsPerCarton={product.units_per_carton} page={page} />
      ) : tab === 'purchases' ? (
        <PurchasesTab productId={product.id} page={page} showProfit={showProfit} />
      ) : (
        <SalesTab productId={product.id} page={page} />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="font-bold text-ink-900">{value}</span>
    </div>
  );
}

function ProfitRow({ label, cost, price }: { label: string; cost: number; price: number }) {
  const profit = round3(price - cost);
  const tone = profit > 0 ? 'text-emerald-700' : profit < 0 ? 'text-red-600' : 'text-ink-500';
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-ink-700">
      <span className="font-bold">{label}:</span>
      <Money value={profit} className={`text-xs ${tone}`} />
      <span className="text-ink-500">
        ({formatPercent(profitPercentOnCost(cost, price))} على التكلفة — هامش {formatPercent(marginPercent(cost, price))})
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------
// تبويب حركة المخزون
// ---------------------------------------------------------------------
async function MovementsTab({ productId, unitsPerCarton, page }: { productId: string; unitsPerCarton: number; page: number }) {
  const { rows, total } = await listProductMovements(productId, page);
  return (
    <>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا توجد حركات" description="تظهر هنا كل حركات هذا الصنف: شراء، بيع، مرتجع، تسويات" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">التاريخ</th>
                  <th className="px-2 py-2.5 text-start font-bold">النوع</th>
                  <th className="px-2 py-2.5 text-start font-bold">التغير</th>
                  <th className="px-2 py-2.5 text-start font-bold">الرصيد بعد</th>
                  <th className="px-2 py-2.5 text-start font-bold">ملاحظات</th>
                  <th className="px-4 py-2.5 text-start font-bold">المستخدم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">{fmtDateTime(m.created_at)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-bold">{moveLabels[m.move_type] ?? m.move_type}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <span className={`tnum font-extrabold ${m.qty_change > 0 ? 'text-emerald-700' : m.qty_change < 0 ? 'text-red-600' : 'text-ink-500'}`}>
                        {m.qty_change > 0 ? '+' : m.qty_change < 0 ? '−' : ''}
                        {formatQty(Math.abs(m.qty_change), unitsPerCarton)}
                      </span>
                    </td>
                    <td className="tnum whitespace-nowrap px-2 py-2.5 font-bold">{formatQty(m.balance_after, unitsPerCarton)}</td>
                    <td className="max-w-[16rem] truncate px-2 py-2.5 text-xs text-ink-500">{m.notes ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">{m.created_by_profile?.full_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </>
  );
}

// ---------------------------------------------------------------------
// تبويب المشتريات
// ---------------------------------------------------------------------
async function PurchasesTab({ productId, page, showProfit }: { productId: string; page: number; showProfit: boolean }) {
  const { rows, total } = await listProductPurchases(productId, page);
  return (
    <>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا توجد مشتريات" description="تظهر هنا فواتير الشراء التي تضمنت هذا الصنف" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">التاريخ</th>
                  <th className="px-2 py-2.5 text-start font-bold">رقم الفاتورة</th>
                  <th className="px-2 py-2.5 text-center font-bold">الحالة</th>
                  <th className="px-2 py-2.5 text-center font-bold">الكمية</th>
                  {showProfit ? <th className="px-2 py-2.5 text-end font-bold">التكلفة</th> : null}
                  {showProfit ? <th className="px-4 py-2.5 text-end font-bold">الإجمالي</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((it) => (
                  <tr key={it.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">
                      {it.purchase ? `${fmtDateShort(it.purchase.purchase_date)} — ${fmtTime(it.purchase.purchase_date)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      {it.purchase ? (
                        <Link href={`/purchases/${it.purchase.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                          {it.purchase.invoice_no}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {it.purchase ? <StatusBadge status={it.purchase.status} /> : null}
                    </td>
                    <td className="tnum whitespace-nowrap px-2 py-2.5 text-center">
                      {it.qty} {unitLabel[it.unit]}
                    </td>
                    {showProfit ? (
                      <td className="px-2 py-2.5 text-end"><Money value={it.unit_cost} symbol={false} /></td>
                    ) : null}
                    {showProfit ? (
                      <td className="px-4 py-2.5 text-end"><Money value={it.line_total} symbol={false} /></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </>
  );
}

// ---------------------------------------------------------------------
// تبويب المبيعات
// ---------------------------------------------------------------------
async function SalesTab({ productId, page }: { productId: string; page: number }) {
  const { rows, total } = await listProductSales(productId, page);
  return (
    <>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا توجد مبيعات" description="تظهر هنا فواتير البيع التي تضمنت هذا الصنف" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">التاريخ</th>
                  <th className="px-2 py-2.5 text-start font-bold">رقم الفاتورة</th>
                  <th className="px-2 py-2.5 text-center font-bold">الحالة</th>
                  <th className="px-2 py-2.5 text-center font-bold">الكمية</th>
                  <th className="px-2 py-2.5 text-end font-bold">السعر</th>
                  <th className="px-4 py-2.5 text-end font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((it) => (
                  <tr key={it.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">
                      {it.sale ? `${fmtDateShort(it.sale.sale_date)} — ${fmtTime(it.sale.sale_date)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      {it.sale ? (
                        <Link href={`/sales/${it.sale.id}`} className="tnum font-bold text-primary-700 hover:underline" dir="ltr">
                          {it.sale.invoice_no}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">{it.sale ? <StatusBadge status={it.sale.status} /> : null}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2.5 text-center">
                      {it.qty} {unitLabel[it.unit]}
                    </td>
                    <td className="px-2 py-2.5 text-end"><Money value={it.unit_price} symbol={false} /></td>
                    <td className="px-4 py-2.5 text-end"><Money value={it.net_total} symbol={false} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={25} total={total} />
    </>
  );
}

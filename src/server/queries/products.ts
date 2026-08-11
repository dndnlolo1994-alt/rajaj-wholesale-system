import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Category,
  DocStatus,
  InventoryCount,
  InventoryCountItem,
  Product,
  PurchaseItem,
  SaleItem,
  StockMovement,
  StockMoveType,
} from '@/lib/types/db';

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------
// قائمة الأصناف
// ---------------------------------------------------------------------
export interface ProductListRow extends Product {
  category: { name: string } | null;
}

export type ProductTab = 'all' | 'active' | 'inactive' | 'low';

export interface ProductListParams {
  q?: string;
  categoryId?: string;
  brand?: string;
  tab?: ProductTab;
  page?: number;
  pageSize?: number;
}

/** تنظيف نص البحث من محارف تكسر صيغة or في PostgREST */
function cleanQ(q?: string): string {
  return (q ?? '').trim().replace(/[(),"]/g, '');
}

export async function listProducts(params: ProductListParams): Promise<{ rows: ProductListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const tab = params.tab ?? 'all';

  const build = () => {
    let query = supabase
      .from('products')
      .select('*, category:categories(name)', { count: 'exact' })
      .order('brand', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });
    const q = cleanQ(params.q);
    if (q) query = query.or(`name.ilike.%${q}%,barcode.eq.${q},sku.ilike.%${q}%,brand.ilike.%${q}%`);
    if (params.categoryId) query = query.eq('category_id', params.categoryId);
    if (params.brand) query = query.eq('brand', params.brand);
    return query;
  };

  if (tab === 'low') {
    // PostgREST لا يدعم مقارنة عمودين (stock <= min) — نجلب الأصناف بطلب واحد ونرشّح
    const { data, error } = await build().eq('is_active', true).range(0, 4999);
    if (error) throw new Error(error.message);
    const all = (data ?? []) as unknown as ProductListRow[];
    const low = all
      .filter((p) => Number(p.min_stock_units) > 0 && Number(p.stock_units) <= Number(p.min_stock_units))
      .sort((a, b) => (a.stock_units - a.min_stock_units) - (b.stock_units - b.min_stock_units));
    return { rows: low.slice((page - 1) * pageSize, page * pageSize), total: low.length };
  }

  let query = build();
  if (tab === 'active') query = query.eq('is_active', true);
  if (tab === 'inactive') query = query.eq('is_active', false);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ProductListRow[], total: count ?? 0 };
}

// ---------------------------------------------------------------------
// صنف واحد كامل
// ---------------------------------------------------------------------
export interface ProductFull extends Product {
  category: { id: string; name: string } | null;
}

export async function getProductFull(id: string): Promise<ProductFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(id, name)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as ProductFull;
}

// ---------------------------------------------------------------------
// حركة المخزون لصنف
// ---------------------------------------------------------------------
export interface ProductMovementRow extends StockMovement {
  created_by_profile: { full_name: string } | null;
}

export async function listProductMovements(
  productId: string,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<{ rows: ProductMovementRow[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('stock_movements')
    .select('*, created_by_profile:profiles!stock_movements_created_by_fkey(full_name)', { count: 'exact' })
    .eq('product_id', productId)
    .order('id', { ascending: false })
    .range((p - 1) * pageSize, p * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ProductMovementRow[], total: count ?? 0 };
}

// ---------------------------------------------------------------------
// مشتريات الصنف
// ---------------------------------------------------------------------
export interface ProductPurchaseRow extends PurchaseItem {
  purchase: { id: string; invoice_no: string; purchase_date: string; status: DocStatus } | null;
}

export async function listProductPurchases(
  productId: string,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<{ rows: ProductPurchaseRow[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('purchase_items')
    .select('*, purchase:purchases(id, invoice_no, purchase_date, status)', { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range((p - 1) * pageSize, p * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ProductPurchaseRow[], total: count ?? 0 };
}

// ---------------------------------------------------------------------
// مبيعات الصنف
// ---------------------------------------------------------------------
export interface ProductSaleRow extends SaleItem {
  sale: { id: string; invoice_no: string; sale_date: string; status: DocStatus } | null;
}

export async function listProductSales(
  productId: string,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<{ rows: ProductSaleRow[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('sale_items')
    .select('*, sale:sales(id, invoice_no, sale_date, status)', { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .range((p - 1) * pageSize, p * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ProductSaleRow[], total: count ?? 0 };
}

// ---------------------------------------------------------------------
// الأقسام
// ---------------------------------------------------------------------
export async function listCategoriesAll(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

// ---------------------------------------------------------------------
// نظرة عامة على المخزون (لصفحة المخزون والجرد)
// ---------------------------------------------------------------------
export interface StockLiteRow {
  id: string;
  name: string;
  stock_units: number;
  min_stock_units: number;
  units_per_carton: number;
  avg_unit_cost: number;
}

export interface StockOverview {
  totalValue: number; // Σ stock * avg (للفعّالة)
  activeCount: number;
  lowCount: number;
  lowList: StockLiteRow[]; // مرتبة بالأشد نقصًا
}

export async function getStockOverview(): Promise<StockOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock_units, min_stock_units, units_per_carton, avg_unit_cost')
    .eq('is_active', true)
    .order('name')
    .range(0, 4999);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as StockLiteRow[];
  const totalValue = rows.reduce((a, r) => a + Number(r.stock_units) * Number(r.avg_unit_cost), 0);
  const lowList = rows
    .filter((r) => Number(r.min_stock_units) > 0 && Number(r.stock_units) <= Number(r.min_stock_units))
    .sort((a, b) => (a.stock_units - a.min_stock_units) - (b.stock_units - b.min_stock_units));
  return { totalValue, activeCount: rows.length, lowCount: lowList.length, lowList };
}

// ---------------------------------------------------------------------
// الأصناف الراكدة (عبر RPC)
// ---------------------------------------------------------------------
export interface StagnantRow {
  id: string;
  name: string;
  stock_units: number;
  units_per_carton: number;
  stock_value: number;
  last_sale_at: string | null;
}

export async function getStagnantProducts(): Promise<{ days: number; rows: StagnantRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_stagnant_products', { p_days: null });
  if (error) throw new Error(error.message);
  return (data ?? { days: 0, rows: [] }) as { days: number; rows: StagnantRow[] };
}

// ---------------------------------------------------------------------
// كل حركات المخزون (لصفحة المخزون والجرد)
// ---------------------------------------------------------------------
export interface MovementListRow extends StockMovement {
  product: { id: string; name: string; units_per_carton: number } | null;
}

export interface MovementListParams {
  type?: StockMoveType | 'all';
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listStockMovements(params: MovementListParams): Promise<{ rows: MovementListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;

  let query = supabase
    .from('stock_movements')
    .select('*, product:products(id, name, units_per_carton)', { count: 'exact' })
    .order('id', { ascending: false });

  if (params.type && params.type !== 'all') query = query.eq('move_type', params.type);
  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00+03:00`);
  if (params.to) query = query.lt('created_at', `${params.to}T23:59:59.999+03:00`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as MovementListRow[], total: count ?? 0 };
}

// ---------------------------------------------------------------------
// جلسات الجرد
// ---------------------------------------------------------------------
export async function listInventoryCounts(page = 1, pageSize = PAGE_SIZE): Promise<{ rows: InventoryCount[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('inventory_counts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((p - 1) * pageSize, p * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as InventoryCount[], total: count ?? 0 };
}

export interface InventoryCountFull extends InventoryCount {
  category: { name: string } | null;
  created_by_profile: { full_name: string } | null;
}

/** بند جرد مع عدد حبات الكرتونة (لعرض formatQty) */
export interface CountItemRow extends InventoryCountItem {
  product: { units_per_carton: number } | null;
}

export async function getInventoryCount(
  id: string,
): Promise<{ count: InventoryCountFull; items: CountItemRow[] } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inventory_counts')
    .select('*, category:categories(name), created_by_profile:profiles!inventory_counts_created_by_fkey(full_name)')
    .eq('id', id)
    .single();
  if (error) return null;

  const { data: items, error: itemsError } = await supabase
    .from('inventory_count_items')
    .select('*, product:products(units_per_carton)')
    .eq('count_id', id)
    .order('product_name', { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  return { count: data as unknown as InventoryCountFull, items: (items ?? []) as unknown as CountItemRow[] };
}

// ---------------------------------------------------------------------
// قائمة الشركات / الماركات
// ---------------------------------------------------------------------
export async function listBrandsAll(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('brand').not('brand', 'is', null);
  if (error) return [];
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.brand?.trim()) set.add(row.brand.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
}

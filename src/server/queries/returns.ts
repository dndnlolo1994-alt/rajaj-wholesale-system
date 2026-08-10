import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Return, ReturnItem, SaleItem, UnitKind } from '@/lib/types/db';

export interface ReturnListRow extends Return {
  sale: { invoice_no: string } | null;
  customer: { id: string; name: string } | null;
}

export interface ReturnListParams {
  q?: string;
  status?: 'completed' | 'void' | 'all';
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listReturns(params: ReturnListParams): Promise<{ rows: ReturnListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;

  let query = supabase
    .from('returns')
    .select('*, sale:sales(invoice_no), customer:customers(id, name)', { count: 'exact' })
    .order('return_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.q) query = query.ilike('return_no', `%${params.q.trim()}%`);
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.from) query = query.gte('return_date', `${params.from}T00:00:00+03:00`);
  if (params.to) query = query.lt('return_date', `${params.to}T23:59:59.999+03:00`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ReturnListRow[], total: count ?? 0 };
}

export interface ReturnFull extends Return {
  sale: { id: string; invoice_no: string } | null;
  customer: { id: string; name: string; shop_name: string | null } | null;
  items: ReturnItem[];
  created_by_profile: { full_name: string } | null;
}

export async function getReturnFull(id: string): Promise<ReturnFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('returns')
    .select(
      `*,
      sale:sales(id, invoice_no),
      customer:customers(id, name, shop_name),
      items:return_items(*),
      created_by_profile:profiles!returns_created_by_fkey(full_name)`,
    )
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as ReturnFull;
}

// ---------------------------------------------------------------------
// بيع قابل للإرجاع: عناصر الفاتورة مع الكمية المتاحة للإرجاع (بالحبة)
// ---------------------------------------------------------------------
export interface ReturnableSaleItem {
  sale_item_id: string;
  product_name: string;
  unit: UnitKind;
  units_per_carton: number;
  qty: number;
  qty_units: number;
  net_total: number;
  unit_price: number;
  returnable_units: number;
}

export interface ReturnableSale {
  sale: {
    id: string;
    invoice_no: string;
    customer_name: string | null;
    sale_date: string;
    total: number;
    customer_id: string | null;
  };
  items: ReturnableSaleItem[];
}

export async function getReturnableSale(saleId: string): Promise<ReturnableSale | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sales')
    .select('id, invoice_no, sale_date, total, customer_id, cash_customer_name, status, customer:customers(name), items:sale_items(*)')
    .eq('id', saleId)
    .single();
  if (error || !data) return null;

  const sale = data as unknown as {
    id: string;
    invoice_no: string;
    sale_date: string;
    total: number;
    customer_id: string | null;
    cash_customer_name: string | null;
    status: string;
    customer: { name: string } | null;
    items: SaleItem[];
  };
  if (sale.status !== 'completed') return null;

  // مجموع المرتجع سابقًا لكل سطر (مرتجعات مكتملة فقط) — استعلام واحد ثم دمج
  const itemIds = sale.items.map((i) => i.id);
  const returnedBy = new Map<string, number>();
  if (itemIds.length > 0) {
    const { data: returned, error: retErr } = await supabase
      .from('return_items')
      .select('sale_item_id, qty_units, return:returns!inner(status)')
      .in('sale_item_id', itemIds)
      .eq('return.status', 'completed');
    if (retErr) throw new Error(retErr.message);
    for (const row of (returned ?? []) as unknown as { sale_item_id: string | null; qty_units: number }[]) {
      if (!row.sale_item_id) continue;
      returnedBy.set(row.sale_item_id, (returnedBy.get(row.sale_item_id) ?? 0) + Number(row.qty_units));
    }
  }

  return {
    sale: {
      id: sale.id,
      invoice_no: sale.invoice_no,
      customer_name: sale.customer?.name ?? sale.cash_customer_name ?? null,
      sale_date: sale.sale_date,
      total: Number(sale.total),
      customer_id: sale.customer_id,
    },
    items: sale.items.map((i) => ({
      sale_item_id: i.id,
      product_name: i.product_name,
      unit: i.unit,
      units_per_carton: i.units_per_carton,
      qty: i.qty,
      qty_units: i.qty_units,
      net_total: Number(i.net_total),
      unit_price: Number(i.unit_price),
      returnable_units: Math.max(0, i.qty_units - (returnedBy.get(i.id) ?? 0)),
    })),
  };
}

/** إيجاد فاتورة مكتملة برقمها (مطابقة تامة غير حساسة لحالة الأحرف) */
export async function findSaleByInvoice(invoiceNo: string): Promise<{ id: string } | null> {
  const trimmed = invoiceNo.trim();
  if (!trimmed) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales')
    .select('id')
    .ilike('invoice_no', trimmed)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: (data as { id: string }).id };
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Payment, Return, ReturnItem, Sale, SaleItem } from '@/lib/types/db';

export interface SaleListRow extends Sale {
  customer: { id: string; name: string; shop_name: string | null } | null;
}

export interface SaleListParams {
  q?: string;
  status?: 'completed' | 'void' | 'all';
  customerId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listSales(params: SaleListParams): Promise<{ rows: SaleListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;

  let query = supabase
    .from('sales')
    .select('*, customer:customers(id, name, shop_name)', { count: 'exact' })
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.q) query = query.ilike('invoice_no', `%${params.q}%`);
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.customerId) query = query.eq('customer_id', params.customerId);
  if (params.from) query = query.gte('sale_date', `${params.from}T00:00:00+03:00`);
  if (params.to) query = query.lt('sale_date', `${params.to}T23:59:59.999+03:00`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as SaleListRow[], total: count ?? 0 };
}

export interface SaleFull extends Sale {
  customer: { id: string; name: string; shop_name: string | null; phone: string | null; balance: number } | null;
  items: SaleItem[];
  payments: Payment[];
  returns: (Return & { items: ReturnItem[] })[];
  created_by_profile: { full_name: string } | null;
}

export async function getSaleFull(id: string): Promise<SaleFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales')
    .select(
      `*,
      customer:customers(id, name, shop_name, phone, balance),
      items:sale_items(*),
      payments:payments(*),
      returns:returns(*, items:return_items(*)),
      created_by_profile:profiles!sales_created_by_fkey(full_name)`,
    )
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as SaleFull;
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Payment, Purchase, PurchaseItem } from '@/lib/types/db';

export interface PurchaseListRow extends Purchase {
  supplier: { id: string; name: string; company_name: string | null } | null;
}

export interface PurchaseListParams {
  q?: string;
  supplierId?: string;
  status?: 'completed' | 'void' | 'all';
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listPurchases(params: PurchaseListParams): Promise<{ rows: PurchaseListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;

  let query = supabase
    .from('purchases')
    .select('*, supplier:suppliers(id, name, company_name)', { count: 'exact' })
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.q) {
    const like = `%${params.q.trim()}%`;
    query = query.or(`invoice_no.ilike.${like},supplier_invoice_no.ilike.${like}`);
  }
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.supplierId) query = query.eq('supplier_id', params.supplierId);
  if (params.from) query = query.gte('purchase_date', `${params.from}T00:00:00+03:00`);
  if (params.to) query = query.lt('purchase_date', `${params.to}T23:59:59.999+03:00`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as PurchaseListRow[], total: count ?? 0 };
}

export interface PurchaseFull extends Purchase {
  supplier: { id: string; name: string; company_name: string | null; phone: string | null; balance: number } | null;
  items: PurchaseItem[];
  payments: Payment[];
  created_by_profile: { full_name: string } | null;
}

export async function getPurchaseFull(id: string): Promise<PurchaseFull | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `*,
      supplier:suppliers(id, name, company_name, phone, balance),
      items:purchase_items(*),
      payments:payments(*),
      created_by_profile:profiles!purchases_created_by_fkey(full_name)`,
    )
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as PurchaseFull;
}

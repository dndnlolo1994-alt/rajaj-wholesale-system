import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Payment, Purchase, Supplier, SupplierLedgerEntry } from '@/lib/types/db';

const PAGE_SIZE = 25;

// تعقيم نص البحث لتراكيب or() في PostgREST
function likeTerm(q: string): string {
  return `%${q.trim().replace(/[,()]/g, ' ')}%`;
}

export interface SupplierListParams {
  q?: string;
  tab?: 'all' | 'debt' | 'inactive';
  page?: number;
  pageSize?: number;
}

export async function listSuppliers(
  params: SupplierListParams,
): Promise<{ rows: Supplier[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const tab = params.tab ?? 'all';

  let query = supabase.from('suppliers').select('*', { count: 'exact' });

  if (params.q?.trim()) {
    const like = likeTerm(params.q);
    query = query.or(`name.ilike.${like},company_name.ilike.${like},phone.ilike.${like}`);
  }
  if (tab === 'debt') query = query.gt('balance', 0).order('balance', { ascending: false });
  else if (tab === 'inactive') query = query.eq('is_active', false).order('name');
  else query = query.order('name');

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Supplier[], total: count ?? 0 };
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single();
  if (error) return null;
  return data as Supplier;
}

export interface SupplierStats {
  invoices_count: number;
  purchases_total: number;
  paid_total: number;
}

/** إحصائيات مجمعة للمورد — مشتريات مكتملة ومدفوعات له */
export async function getSupplierStats(id: string): Promise<SupplierStats> {
  const supabase = await createClient();

  const [purchasesRes, paymentsRes] = await Promise.all([
    supabase
      .from('purchases')
      .select('total', { count: 'exact' })
      .eq('supplier_id', id)
      .eq('status', 'completed')
      .range(0, 9999),
    supabase
      .from('payments')
      .select('amount')
      .eq('supplier_id', id)
      .eq('status', 'completed')
      .eq('direction', 'out')
      .range(0, 9999),
  ]);

  if (purchasesRes.error) throw new Error(purchasesRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);

  const purchases = (purchasesRes.data ?? []) as { total: number }[];
  const payments = (paymentsRes.data ?? []) as { amount: number }[];

  return {
    invoices_count: purchasesRes.count ?? purchases.length,
    purchases_total: purchases.reduce((a, r) => a + Number(r.total), 0),
    paid_total: payments.reduce((a, r) => a + Number(r.amount), 0),
  };
}

/** كشف حركات المورد من دفتر الأستاذ — الأحدث أولًا */
export async function listSupplierLedger(
  id: string,
  page = 1,
): Promise<{ rows: SupplierLedgerEntry[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('supplier_ledger')
    .select('*', { count: 'exact' })
    .eq('supplier_id', id)
    .order('entry_date', { ascending: false })
    .order('id', { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as SupplierLedgerEntry[], total: count ?? 0 };
}

export async function listSupplierPurchases(
  id: string,
  page = 1,
): Promise<{ rows: Purchase[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('purchases')
    .select('*', { count: 'exact' })
    .eq('supplier_id', id)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Purchase[], total: count ?? 0 };
}

export async function listSupplierPayments(
  id: string,
  page = 1,
): Promise<{ rows: Payment[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('supplier_id', id)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Payment[], total: count ?? 0 };
}

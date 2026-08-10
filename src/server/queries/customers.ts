import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Customer, CustomerLedgerEntry, CustomerPrice, Payment, Return, Sale } from '@/lib/types/db';

const PAGE_SIZE = 25;

// تعقيم نص البحث لتراكيب or() في PostgREST
function likeTerm(q: string): string {
  return `%${q.trim().replace(/[,()]/g, ' ')}%`;
}

export interface CustomerListParams {
  q?: string;
  tab?: 'all' | 'debt' | 'inactive';
  page?: number;
  pageSize?: number;
}

export async function listCustomers(
  params: CustomerListParams,
): Promise<{ rows: Customer[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const tab = params.tab ?? 'all';

  let query = supabase.from('customers').select('*', { count: 'exact' });

  if (params.q?.trim()) {
    const like = likeTerm(params.q);
    query = query.or(`name.ilike.${like},shop_name.ilike.${like},phone.ilike.${like}`);
  }
  if (tab === 'debt') query = query.gt('balance', 0).order('balance', { ascending: false });
  else if (tab === 'inactive') query = query.eq('is_active', false).order('name');
  else query = query.order('name');

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Customer[], total: count ?? 0 };
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
  if (error) return null;
  return data as Customer;
}

export interface CustomerStats {
  invoices_count: number;
  sales_total: number;
  profit_total: number;
  paid_total: number;
  returns_total: number;
}

/** إحصائيات مجمعة للعميل — مبيعات مكتملة، مقبوضات، مرتجعات */
export async function getCustomerStats(id: string): Promise<CustomerStats> {
  const supabase = await createClient();

  const [salesRes, paymentsRes, returnsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('total, profit', { count: 'exact' })
      .eq('customer_id', id)
      .eq('status', 'completed')
      .range(0, 9999),
    supabase
      .from('payments')
      .select('amount')
      .eq('customer_id', id)
      .eq('status', 'completed')
      .eq('direction', 'in')
      .range(0, 9999),
    supabase
      .from('returns')
      .select('total')
      .eq('customer_id', id)
      .eq('status', 'completed')
      .range(0, 9999),
  ]);

  if (salesRes.error) throw new Error(salesRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (returnsRes.error) throw new Error(returnsRes.error.message);

  const sales = (salesRes.data ?? []) as { total: number; profit: number }[];
  const payments = (paymentsRes.data ?? []) as { amount: number }[];
  const returns = (returnsRes.data ?? []) as { total: number }[];

  return {
    invoices_count: salesRes.count ?? sales.length,
    sales_total: sales.reduce((a, r) => a + Number(r.total), 0),
    profit_total: sales.reduce((a, r) => a + Number(r.profit), 0),
    paid_total: payments.reduce((a, r) => a + Number(r.amount), 0),
    returns_total: returns.reduce((a, r) => a + Number(r.total), 0),
  };
}

/** كشف حركات العميل من دفتر الأستاذ — الأحدث أولًا */
export async function listCustomerLedger(
  id: string,
  page = 1,
): Promise<{ rows: CustomerLedgerEntry[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('customer_ledger')
    .select('*', { count: 'exact' })
    .eq('customer_id', id)
    .order('entry_date', { ascending: false })
    .order('id', { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as CustomerLedgerEntry[], total: count ?? 0 };
}

export async function listCustomerSales(
  id: string,
  page = 1,
): Promise<{ rows: Sale[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('sales')
    .select('*', { count: 'exact' })
    .eq('customer_id', id)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Sale[], total: count ?? 0 };
}

export async function listCustomerPayments(
  id: string,
  page = 1,
): Promise<{ rows: Payment[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .eq('customer_id', id)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Payment[], total: count ?? 0 };
}

export async function listCustomerReturns(id: string): Promise<Return[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('returns')
    .select('*')
    .eq('customer_id', id)
    .order('return_date', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Return[];
}

export interface CustomerPriceRow extends CustomerPrice {
  product: { name: string; units_per_carton: number } | null;
}

export async function listCustomerPrices(id: string): Promise<CustomerPriceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_prices')
    .select('*, product:products(name, units_per_carton)')
    .eq('customer_id', id)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CustomerPriceRow[];
}

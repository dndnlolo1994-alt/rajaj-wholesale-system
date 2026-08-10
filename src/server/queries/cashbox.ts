import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CashSession, CashTransaction, CashTxType, PaymentMethod } from '@/lib/types/db';

// استعلامات الصندوق النقدي — القراءة فقط (الكتابة عبر RPC في actions/cashbox.ts)

export interface CashBalance {
  opening: number;
  cash_in: number;
  cash_out: number;
  balance: number;
  since: string | null;
  last_session_date: string | null;
}

/** الرصيد النقدي المتوقع الآن (عبر rpc cash_balance) */
export async function getCashBalance(): Promise<CashBalance> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cash_balance');
  if (error) throw new Error(error.message);
  return data as unknown as CashBalance;
}

export interface CashTxListRow extends CashTransaction {
  creator: { full_name: string } | null;
}

export interface CashTxListParams {
  txType?: CashTxType;
  method?: PaymentMethod;
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listCashTx(params: CashTxListParams): Promise<{ rows: CashTxListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;

  let query = supabase
    .from('cash_transactions')
    .select('*, creator:profiles(full_name)', { count: 'exact' })
    .order('tx_date', { ascending: false });

  if (params.txType) query = query.eq('tx_type', params.txType);
  if (params.method) query = query.eq('method', params.method);
  if (params.from) query = query.gte('tx_date', `${params.from}T00:00:00+03:00`);
  if (params.to) query = query.lt('tx_date', `${params.to}T23:59:59.999+03:00`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as CashTxListRow[], total: count ?? 0 };
}

export interface CashSessionRow extends CashSession {
  closer: { full_name: string } | null;
}

export async function listCashSessions(page = 1, pageSize = 25): Promise<{ rows: CashSessionRow[]; total: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, count, error } = await supabase
    .from('cash_sessions')
    .select('*, closer:profiles(full_name)', { count: 'exact' })
    .order('session_date', { ascending: false })
    .range((p - 1) * pageSize, p * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as CashSessionRow[], total: count ?? 0 };
}

export async function getCashSession(id: string): Promise<CashSessionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*, closer:profiles(full_name)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as unknown as CashSessionRow;
}

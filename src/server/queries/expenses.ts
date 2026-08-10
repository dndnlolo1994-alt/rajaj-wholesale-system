import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Expense, ExpenseCategory } from '@/lib/types/db';

// استعلامات المصروفات — القراءة فقط (الكتابة عبر RPC في actions/expenses.ts)

export interface ExpenseListRow extends Expense {
  category: { name: string } | null;
  creator: { full_name: string } | null;
}

export interface ExpenseListParams {
  categoryId?: string;
  status?: 'completed' | 'void' | 'all';
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listExpenses(params: ExpenseListParams): Promise<{ rows: ExpenseListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;

  let query = supabase
    .from('expenses')
    .select('*, category:expense_categories(name), creator:profiles!expenses_created_by_fkey(full_name)', {
      count: 'exact',
    })
    .order('expense_date', { ascending: false });

  if (params.categoryId) query = query.eq('category_id', params.categoryId);
  if (params.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params.from) query = query.gte('expense_date', `${params.from}T00:00:00+03:00`);
  if (params.to) query = query.lt('expense_date', `${params.to}T23:59:59.999+03:00`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as ExpenseListRow[], total: count ?? 0 };
}

/** مجموع المصروفات المكتملة ضمن فترة (اليومان شاملان) */
export async function sumExpenses(from: string, to: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'completed')
    .gte('expense_date', `${from}T00:00:00+03:00`)
    .lt('expense_date', `${to}T23:59:59.999+03:00`);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { amount: number }[]).reduce((sum, r) => sum + Number(r.amount), 0);
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseCategory[];
}

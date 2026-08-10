import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { round3 } from '@/lib/calc/money';
import { periodRange, type PeriodPreset } from '@/lib/format/date';
import type { CashSession, PaymentMethod } from '@/lib/types/db';

// استعلامات مركز التقارير — أغلفة typed للـ RPCs + تجميعات TS بسيطة

// ===== مبدأ الفترة الموحّد لكل صفحات التقارير =====

export interface PeriodSearchParams {
  period?: string;
  from?: string;
  to?: string;
}

const PERIOD_PRESETS: PeriodPreset[] = ['today', 'yesterday', 'week', 'this_month', 'last_month', 'this_year'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** إن وُجد from/to صالحان استُخدما، وإلا periodRange(period ?? 'this_month') */
export function resolvePeriod(sp: PeriodSearchParams): { from: string; to: string; preset: PeriodPreset } {
  if (sp.from && sp.to && DAY_RE.test(sp.from) && DAY_RE.test(sp.to)) {
    return { from: sp.from, to: sp.to, preset: 'custom' };
  }
  const preset = PERIOD_PRESETS.includes(sp.period as PeriodPreset) ? (sp.period as PeriodPreset) : 'this_month';
  return { ...periodRange(preset), preset };
}

/** غلاف موحّد لنداءات RPC */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ===== تقرير المبيعات (report_sales) =====

export type SalesGroup = 'day' | 'month';

export interface SalesReportRow {
  period: string;
  invoices: number;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  profit: number;
  returns_total: number;
  net_total: number;
  net_profit: number;
}

export interface SalesReportTotals {
  invoices: number;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  profit: number;
  returns_total: number;
  net_total: number;
  net_profit: number;
}

export async function reportSales(
  from: string,
  to: string,
  group: SalesGroup = 'day',
): Promise<{ rows: SalesReportRow[]; totals: SalesReportTotals }> {
  return rpc<{ rows: SalesReportRow[]; totals: SalesReportTotals }>('report_sales', {
    p_from: from,
    p_to: to,
    p_group: group,
  });
}

// ===== ملخص الأرباح (report_profit_summary) =====

export interface ProfitSummary {
  revenue: number;
  returns_total: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  /** نسبة مئوية 0..100 */
  gross_margin: number;
  /** نسبة مئوية 0..100 */
  net_margin: number;
  invoices: number;
  avg_profit_per_invoice: number;
  customers: number;
  avg_profit_per_customer: number;
}

export async function reportProfitSummary(from: string, to: string): Promise<ProfitSummary> {
  return rpc<ProfitSummary>('report_profit_summary', { p_from: from, p_to: to });
}

// ===== حسب الصنف (report_by_product) =====

export type ProductOrder = 'revenue' | 'qty' | 'profit';

export interface ProductReportRow {
  product_id: string;
  product_name: string;
  qty_units: number;
  revenue: number;
  cost: number;
  profit: number;
  invoices: number;
  returned_units: number;
  returns_total: number;
  net_revenue: number;
  net_profit: number;
  units_per_carton: number | null;
  stock_units: number | null;
}

export async function reportByProduct(
  from: string,
  to: string,
  order: ProductOrder = 'revenue',
  limit = 30,
  offset = 0,
): Promise<{ rows: ProductReportRow[]; total_count: number }> {
  return rpc<{ rows: ProductReportRow[]; total_count: number }>('report_by_product', {
    p_from: from,
    p_to: to,
    p_order: order,
    p_dir: 'desc',
    p_limit: limit,
    p_offset: offset,
  });
}

// ===== حسب العميل (report_by_customer) =====

export type CustomerOrder = 'sales' | 'profit' | 'paid';

export interface CustomerReportRow {
  id: string;
  name: string;
  shop_name: string | null;
  phone: string | null;
  area: string | null;
  balance: number;
  invoices: number;
  sales_total: number;
  paid_total: number;
  returns_total: number;
  net_sales: number;
  net_profit: number;
}

export async function reportByCustomer(
  from: string,
  to: string,
  order: CustomerOrder = 'sales',
  limit = 30,
  offset = 0,
): Promise<{ rows: CustomerReportRow[]; total_count: number }> {
  return rpc<{ rows: CustomerReportRow[]; total_count: number }>('report_by_customer', {
    p_from: from,
    p_to: to,
    p_order: order,
    p_limit: limit,
    p_offset: offset,
  });
}

// ===== المصاريف حسب التصنيف (report_expenses_summary) =====

export interface ExpensesSummary {
  total: number;
  count: number;
  by_category: { id: string; name: string; total: number; cnt: number }[];
}

export async function reportExpensesSummary(from: string, to: string): Promise<ExpensesSummary> {
  return rpc<ExpensesSummary>('report_expenses_summary', { p_from: from, p_to: to });
}

// ===== أعمار الديون (report_debts) =====

export interface DebtRow {
  id: string;
  name: string;
  /** اسم المحل للعميل أو اسم الشركة للمورد */
  sub_name: string | null;
  phone: string | null;
  balance: number;
  /** موجود للعملاء فقط */
  credit_limit?: number | null;
  last_payment_at: string | null;
  last_activity_at: string | null;
  days_since_payment: number;
}

export async function reportDebts(party: 'customer' | 'supplier'): Promise<DebtRow[]> {
  return rpc<DebtRow[]>('report_debts', { p_party: party });
}

// ===== الأصناف الراكدة (report_stagnant_products) =====

export interface StagnantRow {
  id: string;
  name: string;
  stock_units: number;
  units_per_carton: number;
  stock_value: number;
  last_sale_at: string | null;
}

export interface StagnantReport {
  days: number;
  rows: StagnantRow[];
}

export async function reportStagnant(days?: number): Promise<StagnantReport> {
  return rpc<StagnantReport>('report_stagnant_products', { p_days: days ?? null });
}

// ===== ملخص اليوم (day_summary) =====

export interface DaySummary {
  date: string;
  sales: { count: number; total: number; cogs: number; profit: number; discount: number; paid: number; credit: number };
  returns: { count: number; total: number; profit_delta: number; refund_cash: number };
  purchases: { count: number; total: number; paid: number; credit: number };
  expenses: { count: number; total: number };
  expenses_by_category: { name: string; total: number }[];
  cash: {
    in_total: number;
    out_total: number;
    sale_receipts: number;
    debt_collected: number;
    supplier_paid: number;
    expenses_paid: number;
    refunds_out: number;
    by_method_in: Partial<Record<PaymentMethod, number>>;
  };
  cash_balance: {
    opening: number;
    cash_in: number;
    cash_out: number;
    balance: number;
    since: string | null;
    last_session_date: string | null;
  };
  session: CashSession | null;
}

export async function daySummary(date: string): Promise<DaySummary> {
  return rpc<DaySummary>('day_summary', { p_date: date });
}

// ===== ملخص المشتريات حسب المورد (تجميع TS) =====

export interface PurchasesSupplierRow {
  supplier_id: string;
  name: string;
  count: number;
  total: number;
  paid: number;
  remaining: number;
}

export interface PurchasesSummary {
  rows: PurchasesSupplierRow[];
  totals: { count: number; total: number; paid: number; remaining: number };
}

export async function purchasesSummary(from: string, to: string): Promise<PurchasesSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select('supplier_id, total, paid, supplier:suppliers(name)')
    .eq('status', 'completed')
    .gte('purchase_date', `${from}T00:00:00+03:00`)
    .lt('purchase_date', `${to}T23:59:59.999+03:00`);
  if (error) throw new Error(error.message);

  const raw = (data ?? []) as unknown as {
    supplier_id: string;
    total: number;
    paid: number;
    supplier: { name: string } | null;
  }[];

  const map = new Map<string, PurchasesSupplierRow>();
  const totals = { count: 0, total: 0, paid: 0, remaining: 0 };

  for (const p of raw) {
    const row = map.get(p.supplier_id) ?? {
      supplier_id: p.supplier_id,
      name: p.supplier?.name ?? '—',
      count: 0,
      total: 0,
      paid: 0,
      remaining: 0,
    };
    row.count += 1;
    row.total = round3(row.total + Number(p.total));
    row.paid = round3(row.paid + Number(p.paid));
    row.remaining = round3(row.total - row.paid);
    map.set(p.supplier_id, row);

    totals.count += 1;
    totals.total = round3(totals.total + Number(p.total));
    totals.paid = round3(totals.paid + Number(p.paid));
  }
  totals.remaining = round3(totals.total - totals.paid);

  return { rows: [...map.values()].sort((a, b) => b.total - a.total), totals };
}

// ===== قائمة المرتجعات مع فاتورة الأصل والعميل =====

export interface ReturnListRow {
  id: string;
  return_no: string;
  return_date: string;
  total: number;
  refund_cash: number;
  reason: string | null;
  sale_id: string;
  sale: { invoice_no: string } | null;
  customer: { name: string } | null;
}

export interface ReturnsList {
  rows: ReturnListRow[];
  totals: { count: number; total: number; refund_cash: number };
}

export async function returnsList(from: string, to: string): Promise<ReturnsList> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('returns')
    .select('id, return_no, return_date, total, refund_cash, reason, sale_id, sale:sales(invoice_no), customer:customers(name)')
    .eq('status', 'completed')
    .gte('return_date', `${from}T00:00:00+03:00`)
    .lt('return_date', `${to}T23:59:59.999+03:00`)
    .order('return_date', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ReturnListRow[];
  const totals = { count: rows.length, total: 0, refund_cash: 0 };
  for (const r of rows) {
    totals.total = round3(totals.total + Number(r.total));
    totals.refund_cash = round3(totals.refund_cash + Number(r.refund_cash));
  }
  return { rows, totals };
}

// ===== قيمة المخزون حسب القسم (تجميع TS) =====

export interface StockCategoryRow {
  category: string;
  products: number;
  units: number;
  value: number;
}

export interface StockValueReport {
  rows: StockCategoryRow[];
  totals: { products: number; units: number; value: number };
}

export async function stockByCategory(): Promise<StockValueReport> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category_id, stock_units, avg_unit_cost, units_per_carton, category:categories(name)')
    .eq('is_active', true);
  if (error) throw new Error(error.message);

  const raw = (data ?? []) as unknown as {
    stock_units: number;
    avg_unit_cost: number;
    category: { name: string } | null;
  }[];

  const map = new Map<string, StockCategoryRow>();
  const totals = { products: 0, units: 0, value: 0 };

  for (const p of raw) {
    const key = p.category?.name ?? 'بدون قسم';
    const row = map.get(key) ?? { category: key, products: 0, units: 0, value: 0 };
    const value = round3(Number(p.stock_units) * Number(p.avg_unit_cost));
    row.products += 1;
    row.units += Number(p.stock_units);
    row.value = round3(row.value + value);
    map.set(key, row);

    totals.products += 1;
    totals.units += Number(p.stock_units);
    totals.value = round3(totals.value + value);
  }

  return { rows: [...map.values()].sort((a, b) => b.value - a.value), totals };
}

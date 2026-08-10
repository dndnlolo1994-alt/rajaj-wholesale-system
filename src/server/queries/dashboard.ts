import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface DashboardData {
  today: { sales_total: number; sales_count: number; profit: number; cost_total: number };
  today_returns: { count: number; total: number; profit_delta: number };
  today_purchases: { count: number; total: number };
  today_cash: { receipts: number; payments: number; expenses: number };
  debts: { customers_total: number; customers_count: number; suppliers_total: number; suppliers_count: number };
  stock: { value: number; products_count: number; low_stock_count: number };
  cash_balance: number;
  unread_notifications: number;
  series7: { day: string; sales: number; profit: number; count: number }[];
  compare: {
    today: { sales: number; profit: number };
    yesterday: { sales: number; profit: number };
    this_month: { sales: number; profit: number };
    last_month: { sales: number; profit: number };
  };
  top_customers: { id: string; name: string; shop_name: string | null; total: number; invoices: number }[];
  top_products_qty: { id: string; name: string; qty_units: number; revenue: number; units_per_carton: number | null }[];
  top_products_profit: { id: string; name: string; profit: number; revenue: number }[];
  low_stock_list: { id: string; name: string; stock_units: number; min_stock_units: number; units_per_carton: number }[];
  recent_sales: { id: string; invoice_no: string; total: number; paid: number; status: string; sale_date: string; customer_name: string }[];
  recent_payments: { id: string; payment_no: string; amount: number; direction: 'in' | 'out'; payment_date: string; status: string; party_name: string | null }[];
  recent_movements: { id: number; move_type: string; qty_change: number; balance_after: number; created_at: string; product_name: string }[];
}

export async function fetchDashboard(): Promise<DashboardData> {
  const supabase = await createClient();

  // تنبيهات دورية (محمية داخليًا بفاصل 6 ساعات)
  supabase.rpc('refresh_periodic_notifications').then(() => undefined, () => undefined);

  const { data, error } = await supabase.rpc('report_dashboard');
  if (error) throw new Error(error.message);
  return data as DashboardData;
}

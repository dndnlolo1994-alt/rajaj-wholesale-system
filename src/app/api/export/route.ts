import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/auth';
import { canSeeProfit } from '@/lib/perms';
import { todayISO, monthStartISO } from '@/lib/format/date';

// تصدير CSV للتقارير — بترميز UTF-8 مع BOM ليفتح صحيحًا بالعربية في Excel

export const dynamic = 'force-dynamic';

type Row = (string | number | null | undefined)[];

function csv(headers: string[], rows: Row[]): string {
  const escape = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    // منع تفسير نصوص المستخدم كصيغ عند فتح الملف في Excel/Sheets.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
}

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const showProfit = canSeeProfit(profile.role);

  const sp = request.nextUrl.searchParams;
  const report = sp.get('report') ?? 'sales';
  const from = sp.get('from') || monthStartISO(0);
  const to = sp.get('to') || todayISO();

  const supabase = await createClient();
  let headers: string[] = [];
  let rows: Row[] = [];
  let name = report;

  try {
    switch (report) {
      case 'sales': {
        const { data, error } = await supabase.rpc('report_sales', { p_from: from, p_to: to, p_group: 'day' });
        if (error) throw error;
        const d = data as { rows: { period: string; invoices: number; subtotal: number; discount: number; total: number; cost: number; profit: number; returns_total: number; net_total: number; net_profit: number }[] };
        headers = ['التاريخ', 'عدد الفواتير', 'المجموع', 'الخصم', 'الإجمالي', 'المرتجعات', 'الصافي', ...(showProfit ? ['التكلفة', 'صافي الربح'] : [])];
        rows = d.rows.map((r) => [r.period, r.invoices, r.subtotal, r.discount, r.total, r.returns_total, r.net_total, ...(showProfit ? [r.cost, r.net_profit] : [])]);
        name = 'تقرير-المبيعات';
        break;
      }
      case 'products': {
        const { data, error } = await supabase.rpc('report_by_product', { p_from: from, p_to: to, p_order: 'revenue', p_dir: 'desc', p_limit: 10000, p_offset: 0 });
        if (error) throw error;
        const d = data as { rows: { product_name: string; qty_units: number; invoices: number; revenue: number; returns_total: number; net_revenue: number; cost: number; net_profit: number; stock_units: number | null }[] };
        headers = ['الصنف', 'الكمية المباعة (حبة)', 'عدد الفواتير', 'الإيراد', 'المرتجعات', 'الصافي', 'المخزون الحالي', ...(showProfit ? ['التكلفة', 'الربح'] : [])];
        rows = d.rows.map((r) => [r.product_name, r.qty_units, r.invoices, r.revenue, r.returns_total, r.net_revenue, r.stock_units, ...(showProfit ? [r.cost, r.net_profit] : [])]);
        name = 'المبيعات-حسب-الصنف';
        break;
      }
      case 'customers': {
        const { data, error } = await supabase.rpc('report_by_customer', { p_from: from, p_to: to, p_order: 'sales', p_limit: 10000, p_offset: 0 });
        if (error) throw error;
        const d = data as { rows: { name: string; shop_name: string | null; phone: string | null; invoices: number; sales_total: number; paid_total: number; returns_total: number; net_sales: number; net_profit: number; balance: number }[] };
        headers = ['العميل', 'المحل', 'الهاتف', 'عدد الفواتير', 'المبيعات', 'المدفوع', 'المرتجعات', 'صافي المبيعات', 'الرصيد الحالي', ...(showProfit ? ['الربح'] : [])];
        rows = d.rows.map((r) => [r.name, r.shop_name, r.phone, r.invoices, r.sales_total, r.paid_total, r.returns_total, r.net_sales, r.balance, ...(showProfit ? [r.net_profit] : [])]);
        name = 'المبيعات-حسب-العميل';
        break;
      }
      case 'purchases': {
        const { data, error } = await supabase
          .from('purchases')
          .select('invoice_no, supplier_invoice_no, purchase_date, total, paid, status, supplier:suppliers(name)')
          .gte('purchase_date', `${from}T00:00:00+03:00`)
          .lt('purchase_date', `${to}T23:59:59.999+03:00`)
          .order('purchase_date', { ascending: false })
          .limit(10000);
        if (error) throw error;
        headers = ['رقم الفاتورة', 'فاتورة المورد', 'المورد', 'التاريخ', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'];
        rows = (data as unknown as { invoice_no: string; supplier_invoice_no: string | null; purchase_date: string; total: number; paid: number; status: string; supplier: { name: string } | null }[]).map(
          (r) => [r.invoice_no, r.supplier_invoice_no, r.supplier?.name, r.purchase_date?.slice(0, 16).replace('T', ' '), r.total, r.paid, Number(r.total) - Number(r.paid), r.status === 'void' ? 'ملغاة' : 'مكتملة'],
        );
        name = 'المشتريات';
        break;
      }
      case 'returns': {
        const { data, error } = await supabase
          .from('returns')
          .select('return_no, return_date, total, refund_cash, reason, status, customer:customers(name), sale:sales(invoice_no)')
          .gte('return_date', `${from}T00:00:00+03:00`)
          .lt('return_date', `${to}T23:59:59.999+03:00`)
          .order('return_date', { ascending: false })
          .limit(10000);
        if (error) throw error;
        headers = ['رقم المرتجع', 'فاتورة الأصل', 'العميل', 'التاريخ', 'القيمة', 'رد نقدي', 'السبب', 'الحالة'];
        rows = (data as unknown as { return_no: string; return_date: string; total: number; refund_cash: number; reason: string | null; status: string; customer: { name: string } | null; sale: { invoice_no: string } | null }[]).map(
          (r) => [r.return_no, r.sale?.invoice_no, r.customer?.name ?? 'زبون نقدي', r.return_date?.slice(0, 16).replace('T', ' '), r.total, r.refund_cash, r.reason, r.status === 'void' ? 'ملغى' : 'مكتمل'],
        );
        name = 'المرتجعات';
        break;
      }
      case 'expenses': {
        const { data, error } = await supabase
          .from('expenses')
          .select('expense_no, amount, method, expense_date, notes, status, category:expense_categories(name)')
          .gte('expense_date', `${from}T00:00:00+03:00`)
          .lt('expense_date', `${to}T23:59:59.999+03:00`)
          .order('expense_date', { ascending: false })
          .limit(10000);
        if (error) throw error;
        headers = ['الرقم', 'التصنيف', 'المبلغ', 'الطريقة', 'التاريخ', 'ملاحظات', 'الحالة'];
        rows = (data as unknown as { expense_no: string; amount: number; method: string; expense_date: string; notes: string | null; status: string; category: { name: string } | null }[]).map(
          (r) => [r.expense_no, r.category?.name, r.amount, r.method, r.expense_date?.slice(0, 16).replace('T', ' '), r.notes, r.status === 'void' ? 'ملغى' : 'مكتمل'],
        );
        name = 'المصروفات';
        break;
      }
      case 'customer-debts':
      case 'supplier-debts': {
        const party = report === 'customer-debts' ? 'customer' : 'supplier';
        const { data, error } = await supabase.rpc('report_debts', { p_party: party });
        if (error) throw error;
        const d = data as { name: string; sub_name: string | null; phone: string | null; balance: number; last_payment_at: string | null; days_since_payment: number }[];
        headers = ['الاسم', party === 'customer' ? 'المحل' : 'المنشأة', 'الهاتف', 'الرصيد', 'آخر دفعة', 'أيام بدون دفعة'];
        rows = d.map((r) => [r.name, r.sub_name, r.phone, r.balance, r.last_payment_at?.slice(0, 10), r.days_since_payment]);
        name = party === 'customer' ? 'ديون-العملاء' : 'ديون-الموردين';
        break;
      }
      case 'stock': {
        const { data, error } = await supabase
          .from('products')
          .select('name, barcode, stock_units, units_per_carton, avg_unit_cost, min_stock_units, category:categories(name)')
          .eq('is_active', true)
          .order('name')
          .limit(10000);
        if (error) throw error;
        headers = ['الصنف', 'الباركود', 'القسم', 'المخزون (حبة)', 'حبة/كرتونة', 'الحد الأدنى', ...(showProfit ? ['متوسط تكلفة الحبة', 'قيمة المخزون'] : [])];
        rows = (data as unknown as { name: string; barcode: string | null; stock_units: number; units_per_carton: number; avg_unit_cost: number; min_stock_units: number; category: { name: string } | null }[]).map(
          (r) => [r.name, r.barcode, r.category?.name, r.stock_units, r.units_per_carton, r.min_stock_units, ...(showProfit ? [r.avg_unit_cost, Math.round(r.stock_units * r.avg_unit_cost * 1000) / 1000] : [])],
        );
        name = 'المخزون';
        break;
      }
      default:
        return NextResponse.json({ error: 'unknown report' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const content = '﻿' + csv(headers, rows);
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(`${name}-${from}-${to}.csv`)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

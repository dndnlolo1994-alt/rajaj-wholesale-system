-- =====================================================================
-- Migration 12: لا يعتبر الصنف منخفضًا إذا كان الحد الأدنى = 0
-- =====================================================================

create or replace function public.report_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_today date := app.today_local();
  v_t0 timestamptz := app.day_start(v_today);
  v_t1 timestamptz := app.day_end(v_today);
  v_y0 timestamptz := app.day_start(v_today - 1);
  v_m0 timestamptz := app.day_start(date_trunc('month', v_today)::date);
  v_lm0 timestamptz := app.day_start((date_trunc('month', v_today) - interval '1 month')::date);
  v_result jsonb;
begin
  perform app.require_staff(null);

  select jsonb_build_object(
    'today', (
      select jsonb_build_object(
        'sales_total', coalesce(sum(total), 0),
        'sales_count', count(*),
        'profit', coalesce(sum(profit), 0),
        'cost_total', coalesce(sum(cost_total), 0)
      )
      from public.sales where status = 'completed' and sale_date >= v_t0 and sale_date < v_t1
    ),
    'today_returns', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0), 'profit_delta', coalesce(sum(profit_delta), 0))
      from public.returns where status = 'completed' and return_date >= v_t0 and return_date < v_t1
    ),
    'today_purchases', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0))
      from public.purchases where status = 'completed' and purchase_date >= v_t0 and purchase_date < v_t1
    ),
    'today_cash', (
      select jsonb_build_object(
        'receipts', coalesce(sum(amount) filter (where direction = 'in' and tx_type in ('sale_receipt','customer_receipt')), 0),
        'payments', coalesce(sum(amount) filter (where direction = 'out' and tx_type = 'supplier_payment'), 0),
        'expenses', coalesce(sum(amount) filter (where direction = 'out' and tx_type = 'expense'), 0)
      )
      from public.cash_transactions where tx_date >= v_t0 and tx_date < v_t1
    ),
    'debts', (
      select jsonb_build_object(
        'customers_total', coalesce((select sum(balance) from public.customers where balance > 0), 0),
        'customers_count', coalesce((select count(*) from public.customers where balance > 0), 0),
        'suppliers_total', coalesce((select sum(balance) from public.suppliers where balance > 0), 0),
        'suppliers_count', coalesce((select count(*) from public.suppliers where balance > 0), 0)
      )
    ),
    'stock', (
      select jsonb_build_object(
        'value', coalesce(round(sum(stock_units * avg_unit_cost), 3), 0),
        'products_count', count(*) filter (where is_active),
        'low_stock_count', count(*) filter (where is_active and min_stock_units > 0 and stock_units <= min_stock_units)
      )
      from public.products
    ),
    'cash_balance', (public.cash_balance() -> 'balance'),
    'unread_notifications', (select count(*) from public.notifications where is_read = false),
    'series7', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'sales', coalesce(s.total, 0) - coalesce(r.total, 0),
        'profit', coalesce(s.profit, 0) + coalesce(r.profit_delta, 0),
        'count', coalesce(s.cnt, 0)
      ) order by d.day), '[]'::jsonb)
      from (select generate_series(v_today - 6, v_today, interval '1 day')::date as day) d
      left join lateral (
        select sum(total) as total, sum(profit) as profit, count(*) as cnt
        from public.sales
        where status = 'completed' and sale_date >= app.day_start(d.day) and sale_date < app.day_end(d.day)
      ) s on true
      left join lateral (
        select sum(total) as total, sum(profit_delta) as profit_delta
        from public.returns
        where status = 'completed' and return_date >= app.day_start(d.day) and return_date < app.day_end(d.day)
      ) r on true
    ),
    'compare', jsonb_build_object(
      'today', (
        select jsonb_build_object('sales', coalesce(sum(total), 0), 'profit', coalesce(sum(profit), 0))
        from public.sales where status = 'completed' and sale_date >= v_t0 and sale_date < v_t1
      ),
      'yesterday', (
        select jsonb_build_object('sales', coalesce(sum(total), 0), 'profit', coalesce(sum(profit), 0))
        from public.sales where status = 'completed' and sale_date >= v_y0 and sale_date < v_t0
      ),
      'this_month', (
        select jsonb_build_object('sales', coalesce(sum(total), 0), 'profit', coalesce(sum(profit), 0))
        from public.sales where status = 'completed' and sale_date >= v_m0 and sale_date < v_t1
      ),
      'last_month', (
        select jsonb_build_object('sales', coalesce(sum(total), 0), 'profit', coalesce(sum(profit), 0))
        from public.sales where status = 'completed' and sale_date >= v_lm0 and sale_date < v_m0
      )
    ),
    'top_customers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select c.id, c.name, c.shop_name, sum(s.total) as total, count(*) as invoices
        from public.sales s join public.customers c on c.id = s.customer_id
        where s.status = 'completed' and s.sale_date >= v_m0 and s.sale_date < v_t1
        group by c.id, c.name, c.shop_name
        order by sum(s.total) desc limit 5
      ) t
    ),
    'top_products_qty', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select si.product_id as id, si.product_name as name,
          sum(si.qty_units) as qty_units, sum(si.net_total) as revenue,
          max(p2.units_per_carton) as units_per_carton
        from public.sale_items si
        join public.sales s on s.id = si.sale_id
        left join public.products p2 on p2.id = si.product_id
        where s.status = 'completed' and s.sale_date >= v_m0 and s.sale_date < v_t1
        group by si.product_id, si.product_name
        order by sum(si.qty_units) desc limit 5
      ) t
    ),
    'top_products_profit', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select si.product_id as id, si.product_name as name, sum(si.profit) as profit, sum(si.net_total) as revenue
        from public.sale_items si
        join public.sales s on s.id = si.sale_id
        where s.status = 'completed' and s.sale_date >= v_m0 and s.sale_date < v_t1
        group by si.product_id, si.product_name
        order by sum(si.profit) desc limit 5
      ) t
    ),
    'low_stock_list', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select id, name, stock_units, min_stock_units, units_per_carton
        from public.products
        where is_active and min_stock_units > 0 and stock_units <= min_stock_units
        order by (stock_units - min_stock_units) asc limit 10
      ) t
    ),
    'recent_sales', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select s.id, s.invoice_no, s.total, s.paid, s.status, s.sale_date,
          coalesce(c.name, s.cash_customer_name, 'زبون نقدي') as customer_name
        from public.sales s left join public.customers c on c.id = s.customer_id
        order by s.created_at desc limit 5
      ) t
    ),
    'recent_payments', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select p.id, p.payment_no, p.amount, p.direction, p.payment_date, p.status,
          coalesce(c.name, su.name) as party_name
        from public.payments p
        left join public.customers c on c.id = p.customer_id
        left join public.suppliers su on su.id = p.supplier_id
        order by p.created_at desc limit 5
      ) t
    ),
    'recent_movements', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select m.id, m.move_type, m.qty_change, m.balance_after, m.created_at, p2.name as product_name
        from public.stock_movements m join public.products p2 on p2.id = m.product_id
        order by m.id desc limit 8
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

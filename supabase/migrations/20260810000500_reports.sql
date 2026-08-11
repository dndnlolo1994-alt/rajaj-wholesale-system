-- =====================================================================
-- Migration 5: Reports, dashboard, search, statements, POS lookups
-- Date params are LOCAL days (Asia/Amman), inclusive from/to.
-- Net figures = sales - returns (returns matched by return_date).
-- =====================================================================

-- ---------------------------------------------------------------------
-- report_dashboard: كل مؤشرات لوحة التحكم في نداء واحد
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- report_sales: تقرير مبيعات مجمّع (يوم/شهر)
-- ---------------------------------------------------------------------
create or replace function public.report_sales(p_from date, p_to date, p_group text default 'day')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_fmt text := case when p_group = 'month' then 'YYYY-MM' else 'YYYY-MM-DD' end;
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
  v_rows jsonb;
  v_totals jsonb;
begin
  perform app.require_staff(null);

  select coalesce(jsonb_agg(t order by t.period), '[]'::jsonb) into v_rows from (
    select
      coalesce(s.period, r.period) as period,
      coalesce(s.cnt, 0) as invoices,
      coalesce(s.subtotal, 0) as subtotal,
      coalesce(s.discount, 0) as discount,
      coalesce(s.total, 0) as total,
      coalesce(s.cost, 0) as cost,
      coalesce(s.profit, 0) as profit,
      coalesce(r.total, 0) as returns_total,
      coalesce(s.total, 0) - coalesce(r.total, 0) as net_total,
      coalesce(s.profit, 0) + coalesce(r.profit_delta, 0) as net_profit
    from (
      select to_char(sale_date at time zone app.tz(), v_fmt) as period,
        count(*) as cnt, sum(subtotal) as subtotal,
        sum(line_discount_total + invoice_discount) as discount,
        sum(total) as total, sum(cost_total) as cost, sum(profit) as profit
      from public.sales
      where status = 'completed' and sale_date >= v_from and sale_date < v_to
      group by 1
    ) s
    full join (
      select to_char(return_date at time zone app.tz(), v_fmt) as period,
        sum(total) as total, sum(profit_delta) as profit_delta
      from public.returns
      where status = 'completed' and return_date >= v_from and return_date < v_to
      group by 1
    ) r on r.period = s.period
  ) t;

  select jsonb_build_object(
    'invoices', coalesce(sum((e->>'invoices')::numeric), 0),
    'subtotal', coalesce(sum((e->>'subtotal')::numeric), 0),
    'discount', coalesce(sum((e->>'discount')::numeric), 0),
    'total', coalesce(sum((e->>'total')::numeric), 0),
    'cost', coalesce(sum((e->>'cost')::numeric), 0),
    'profit', coalesce(sum((e->>'profit')::numeric), 0),
    'returns_total', coalesce(sum((e->>'returns_total')::numeric), 0),
    'net_total', coalesce(sum((e->>'net_total')::numeric), 0),
    'net_profit', coalesce(sum((e->>'net_profit')::numeric), 0)
  ) into v_totals
  from jsonb_array_elements(v_rows) e;

  return jsonb_build_object('rows', v_rows, 'totals', v_totals);
end;
$$;

-- ---------------------------------------------------------------------
-- report_profit_summary: ملخص الأرباح (قائمة دخل مبسطة)
-- ---------------------------------------------------------------------
create or replace function public.report_profit_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
  v_revenue numeric := 0;
  v_cogs numeric := 0;
  v_profit numeric := 0;
  v_invoices int := 0;
  v_customers int := 0;
  v_ret_total numeric := 0;
  v_ret_restocked numeric := 0;
  v_ret_profit_delta numeric := 0;
  v_expenses numeric := 0;
  v_net_revenue numeric;
  v_gross numeric;
  v_net numeric;
begin
  perform app.require_staff(null);

  select coalesce(sum(total), 0), coalesce(sum(cost_total), 0), coalesce(sum(profit), 0),
         count(*), count(distinct customer_id)
    into v_revenue, v_cogs, v_profit, v_invoices, v_customers
  from public.sales where status = 'completed' and sale_date >= v_from and sale_date < v_to;

  select coalesce(sum(total), 0), coalesce(sum(restocked_cost_total), 0), coalesce(sum(profit_delta), 0)
    into v_ret_total, v_ret_restocked, v_ret_profit_delta
  from public.returns where status = 'completed' and return_date >= v_from and return_date < v_to;

  select coalesce(sum(amount), 0) into v_expenses
  from public.expenses where status = 'completed' and expense_date >= v_from and expense_date < v_to;

  v_net_revenue := round(v_revenue - v_ret_total, 3);
  v_gross := round(v_profit + v_ret_profit_delta, 3);
  v_net := round(v_gross - v_expenses, 3);

  return jsonb_build_object(
    'revenue', v_revenue,
    'returns_total', v_ret_total,
    'net_revenue', v_net_revenue,
    'cogs', round(v_cogs - v_ret_restocked, 3),
    'gross_profit', v_gross,
    'expenses', v_expenses,
    'net_profit', v_net,
    'gross_margin', case when v_net_revenue <> 0 then round(v_gross / v_net_revenue * 100, 2) else 0 end,
    'net_margin', case when v_net_revenue <> 0 then round(v_net / v_net_revenue * 100, 2) else 0 end,
    'invoices', v_invoices,
    'avg_profit_per_invoice', case when v_invoices > 0 then round(v_gross / v_invoices, 3) else 0 end,
    'customers', v_customers,
    'avg_profit_per_customer', case when v_customers > 0 then round(v_gross / v_customers, 3) else 0 end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- report_by_product: المبيعات/الأرباح حسب الصنف
-- ---------------------------------------------------------------------
create or replace function public.report_by_product(
  p_from date, p_to date,
  p_order text default 'revenue',
  p_dir text default 'desc',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
  v_rows jsonb;
  v_count int;
begin
  perform app.require_staff(null);

  with sold as (
    select si.product_id, si.product_name,
      sum(si.qty_units) as qty_units,
      sum(si.net_total) as revenue,
      sum(si.cost_total) as cost,
      sum(si.profit) as profit,
      count(distinct si.sale_id) as invoices
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    where s.status = 'completed' and s.sale_date >= v_from and s.sale_date < v_to
    group by si.product_id, si.product_name
  ), ret as (
    select ri.product_id,
      sum(ri.qty_units) as qty_units,
      sum(ri.line_total) as total,
      sum(case when ri.condition = 'good' then ri.cost_total else 0 end) as restocked_cost
    from public.return_items ri
    join public.returns r on r.id = ri.return_id
    where r.status = 'completed' and r.return_date >= v_from and r.return_date < v_to
    group by ri.product_id
  ), merged as (
    select so.product_id, so.product_name,
      so.qty_units, so.revenue, so.cost, so.profit, so.invoices,
      coalesce(rt.qty_units, 0) as returned_units,
      coalesce(rt.total, 0) as returns_total,
      round(so.revenue - coalesce(rt.total, 0), 3) as net_revenue,
      round(so.profit + coalesce(rt.restocked_cost, 0) - coalesce(rt.total, 0), 3) as net_profit,
      p2.units_per_carton, p2.stock_units
    from sold so
    left join ret rt on rt.product_id = so.product_id
    left join public.products p2 on p2.id = so.product_id
  )
  select
    (select count(*) from merged),
    coalesce(jsonb_agg(m), '[]'::jsonb)
  into v_count, v_rows
  from (
    select * from merged
    order by
      case when p_dir = 'asc' then
        case p_order when 'qty' then qty_units when 'profit' then net_profit else net_revenue end
      end asc nulls last,
      case when p_dir <> 'asc' then
        case p_order when 'qty' then qty_units when 'profit' then net_profit else net_revenue end
      end desc nulls last
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) m;

  return jsonb_build_object('rows', v_rows, 'total_count', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- report_by_customer: المبيعات/الأرباح حسب العميل
-- ---------------------------------------------------------------------
create or replace function public.report_by_customer(
  p_from date, p_to date,
  p_order text default 'sales',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
  v_rows jsonb;
  v_count int;
begin
  perform app.require_staff(null);

  with s as (
    select customer_id, count(*) as invoices, sum(total) as sales_total,
      sum(cost_total) as cost, sum(profit) as profit, sum(total - paid) as credit_given
    from public.sales
    where status = 'completed' and sale_date >= v_from and sale_date < v_to and customer_id is not null
    group by customer_id
  ), pay as (
    select customer_id, sum(amount) as paid_total
    from public.payments
    where status = 'completed' and party_type = 'customer' and payment_date >= v_from and payment_date < v_to
    group by customer_id
  ), ret as (
    select customer_id, sum(total) as returns_total, sum(profit_delta) as profit_delta
    from public.returns
    where status = 'completed' and customer_id is not null and return_date >= v_from and return_date < v_to
    group by customer_id
  ), ids as (
    select customer_id from s
    union select customer_id from pay
    union select customer_id from ret
  ), merged as (
    select c.id, c.name, c.shop_name, c.phone, c.area, c.balance,
      coalesce(s.invoices, 0) as invoices,
      coalesce(s.sales_total, 0) as sales_total,
      coalesce(pay.paid_total, 0) as paid_total,
      coalesce(ret.returns_total, 0) as returns_total,
      round(coalesce(s.sales_total, 0) - coalesce(ret.returns_total, 0), 3) as net_sales,
      round(coalesce(s.profit, 0) + coalesce(ret.profit_delta, 0), 3) as net_profit
    from ids
    join public.customers c on c.id = ids.customer_id
    left join s on s.customer_id = ids.customer_id
    left join pay on pay.customer_id = ids.customer_id
    left join ret on ret.customer_id = ids.customer_id
  )
  select
    (select count(*) from merged),
    coalesce(jsonb_agg(m), '[]'::jsonb)
  into v_count, v_rows
  from (
    select * from merged
    order by case p_order when 'profit' then net_profit when 'paid' then paid_total else net_sales end desc
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) m;

  return jsonb_build_object('rows', v_rows, 'total_count', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- report_expenses_summary: المصاريف حسب التصنيف
-- ---------------------------------------------------------------------
create or replace function public.report_expenses_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
begin
  perform app.require_staff(null);

  return jsonb_build_object(
    'total', coalesce((select sum(amount) from public.expenses
      where status = 'completed' and expense_date >= v_from and expense_date < v_to), 0),
    'count', coalesce((select count(*) from public.expenses
      where status = 'completed' and expense_date >= v_from and expense_date < v_to), 0),
    'by_category', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select ec.id, ec.name, sum(e.amount) as total, count(*) as cnt
        from public.expenses e join public.expense_categories ec on ec.id = e.category_id
        where e.status = 'completed' and e.expense_date >= v_from and e.expense_date < v_to
        group by ec.id, ec.name
        order by sum(e.amount) desc
      ) t
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- report_stagnant_products: الأصناف الراكدة
-- ---------------------------------------------------------------------
create or replace function public.report_stagnant_products(p_days int default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_days int := coalesce(p_days, app.setting_num('inventory', 'stagnant_days', 45)::int);
  v_cutoff timestamptz := now() - make_interval(days => v_days);
begin
  perform app.require_staff(null);

  return jsonb_build_object('days', v_days, 'rows', (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select p2.id, p2.name, p2.stock_units, p2.units_per_carton,
        round(p2.stock_units * p2.avg_unit_cost, 3) as stock_value,
        ls.last_sale_at
      from public.products p2
      left join lateral (
        select max(si.created_at) as last_sale_at
        from public.sale_items si where si.product_id = p2.id
      ) ls on true
      where p2.is_active and p2.stock_units > 0
        and (ls.last_sale_at is null or ls.last_sale_at < v_cutoff)
      order by coalesce(ls.last_sale_at, '-infinity'::timestamptz) asc, p2.name
      limit 200
    ) t
  ));
end;
$$;

-- ---------------------------------------------------------------------
-- report_debts: أعمار الديون (عملاء أو موردون)
-- ---------------------------------------------------------------------
create or replace function public.report_debts(p_party text default 'customer')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
begin
  perform app.require_staff(null);

  if p_party = 'supplier' then
    return (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select su.id, su.name, su.company_name as sub_name, su.phone, su.balance,
          lp.last_payment_at, la.last_activity_at,
          extract(day from now() - coalesce(lp.last_payment_at, la.first_debt_at, now()))::int as days_since_payment
        from public.suppliers su
        left join lateral (
          select max(payment_date) as last_payment_at from public.payments
          where supplier_id = su.id and status = 'completed'
        ) lp on true
        left join lateral (
          select max(entry_date) as last_activity_at,
                 min(entry_date) filter (where credit > 0) as first_debt_at
          from public.supplier_ledger where supplier_id = su.id
        ) la on true
        where su.balance > 0
        order by su.balance desc
      ) t
    );
  end if;

  return (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select c.id, c.name, c.shop_name as sub_name, c.phone, c.balance, c.credit_limit,
        lp.last_payment_at, la.last_activity_at,
        extract(day from now() - coalesce(lp.last_payment_at, la.first_debt_at, now()))::int as days_since_payment
      from public.customers c
      left join lateral (
        select max(payment_date) as last_payment_at from public.payments
        where customer_id = c.id and status = 'completed'
      ) lp on true
      left join lateral (
        select max(entry_date) as last_activity_at,
               min(entry_date) filter (where debit > 0) as first_debt_at
        from public.customer_ledger where customer_id = c.id
      ) la on true
      where c.balance > 0
      order by c.balance desc
    ) t
  );
end;
$$;

-- ---------------------------------------------------------------------
-- customer_statement / supplier_statement: كشف حساب
-- ---------------------------------------------------------------------
create or replace function public.customer_statement(p_customer_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
  v_opening numeric(14,3);
  v_rows jsonb;
  v_debit numeric(14,3);
  v_credit numeric(14,3);
begin
  perform app.require_staff(null);

  select coalesce(sum(debit - credit), 0) into v_opening
  from public.customer_ledger
  where customer_id = p_customer_id and entry_date < v_from;

  select
    coalesce(jsonb_agg(t order by t.entry_date, t.id), '[]'::jsonb),
    coalesce(sum(t.debit), 0), coalesce(sum(t.credit), 0)
  into v_rows, v_debit, v_credit
  from (
    select l.id, l.entry_type, l.ref_table, l.ref_id, l.debit, l.credit, l.entry_date, l.notes,
      sum(l.debit - l.credit) over (order by l.entry_date, l.id) + v_opening as running_balance
    from public.customer_ledger l
    where l.customer_id = p_customer_id and l.entry_date >= v_from and l.entry_date < v_to
  ) t;

  return jsonb_build_object(
    'customer', (select to_jsonb(c) - 'notes' from public.customers c where id = p_customer_id),
    'opening_balance', v_opening,
    'rows', v_rows,
    'total_debit', v_debit,
    'total_credit', v_credit,
    'closing_balance', round(v_opening + v_debit - v_credit, 3)
  );
end;
$$;

create or replace function public.supplier_statement(p_supplier_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_from timestamptz := app.day_start(p_from);
  v_to timestamptz := app.day_end(p_to);
  v_opening numeric(14,3);
  v_rows jsonb;
  v_debit numeric(14,3);
  v_credit numeric(14,3);
begin
  perform app.require_staff(null);

  select coalesce(sum(credit - debit), 0) into v_opening
  from public.supplier_ledger
  where supplier_id = p_supplier_id and entry_date < v_from;

  select
    coalesce(jsonb_agg(t order by t.entry_date, t.id), '[]'::jsonb),
    coalesce(sum(t.debit), 0), coalesce(sum(t.credit), 0)
  into v_rows, v_debit, v_credit
  from (
    select l.id, l.entry_type, l.ref_table, l.ref_id, l.debit, l.credit, l.entry_date, l.notes,
      sum(l.credit - l.debit) over (order by l.entry_date, l.id) + v_opening as running_balance
    from public.supplier_ledger l
    where l.supplier_id = p_supplier_id and l.entry_date >= v_from and l.entry_date < v_to
  ) t;

  return jsonb_build_object(
    'supplier', (select to_jsonb(s) - 'notes' from public.suppliers s where id = p_supplier_id),
    'opening_balance', v_opening,
    'rows', v_rows,
    'total_debit', v_debit,
    'total_credit', v_credit,
    'closing_balance', round(v_opening + v_credit - v_debit, 3)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- global_search: بحث شامل
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_q text, p_limit int default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_q text := trim(coalesce(p_q, ''));
  v_like text;
begin
  perform app.require_staff(null);

  if length(v_q) < 1 then
    return jsonb_build_object('customers', '[]'::jsonb, 'suppliers', '[]'::jsonb,
      'products', '[]'::jsonb, 'sales', '[]'::jsonb);
  end if;
  v_like := '%' || v_q || '%';

  return jsonb_build_object(
    'customers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select id, name, shop_name, phone, balance from public.customers
        where name ilike v_like or shop_name ilike v_like or phone like v_like or whatsapp like v_like
        order by name limit p_limit
      ) t
    ),
    'suppliers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select id, name, company_name, phone, balance from public.suppliers
        where name ilike v_like or company_name ilike v_like or phone like v_like
        order by name limit p_limit
      ) t
    ),
    'products', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select id, name, barcode, stock_units, units_per_carton, sale_price_carton, sale_price_piece
        from public.products
        where name ilike v_like or barcode = v_q or sku ilike v_like or brand ilike v_like
        order by is_active desc, name limit p_limit
      ) t
    ),
    'sales', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select s.id, s.invoice_no, s.total, s.status, s.sale_date,
          coalesce(c.name, s.cash_customer_name, 'زبون نقدي') as customer_name
        from public.sales s left join public.customers c on c.id = s.customer_id
        where s.invoice_no ilike v_like
           or s.cash_customer_name ilike v_like
        order by s.sale_date desc limit p_limit
      ) t
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- product_lookup_barcode: قراءة صنف بالباركود (مع سعر العميل الخاص)
-- ---------------------------------------------------------------------
create or replace function public.product_lookup_barcode(p_code text, p_customer_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_product public.products;
  v_special_carton numeric;
  v_special_piece numeric;
begin
  perform app.require_staff(null);

  select * into v_product from public.products
  where barcode = trim(coalesce(p_code, '')) and barcode is not null and barcode <> '';

  if v_product.id is null then
    return null;
  end if;

  if p_customer_id is not null then
    select price into v_special_carton from public.customer_prices
    where customer_id = p_customer_id and product_id = v_product.id and unit = 'carton';
    select price into v_special_piece from public.customer_prices
    where customer_id = p_customer_id and product_id = v_product.id and unit = 'piece';
  end if;

  return to_jsonb(v_product) || jsonb_build_object(
    'special_price_carton', v_special_carton,
    'special_price_piece', v_special_piece
  );
end;
$$;

-- ---------------------------------------------------------------------
-- pos_products: بحث أصناف لشاشة البيع (مع الأسعار الخاصة بالعميل)
-- ---------------------------------------------------------------------
create or replace function public.pos_products(
  p_q text default null,
  p_category_id uuid default null,
  p_customer_id uuid default null,
  p_limit int default 30,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_like text := '%' || trim(coalesce(p_q, '')) || '%';
begin
  perform app.require_staff(null);

  return (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select p2.id, p2.name, p2.barcode, p2.category_id, p2.brand, p2.image_url,
        p2.units_per_carton, p2.stock_units, p2.min_stock_units,
        p2.sale_price_carton, p2.sale_price_piece,
        p2.wholesale_price_carton, p2.wholesale_price_piece,
        cpc.price as special_price_carton,
        cpp.price as special_price_piece
      from public.products p2
      left join public.customer_prices cpc
        on p_customer_id is not null and cpc.customer_id = p_customer_id
        and cpc.product_id = p2.id and cpc.unit = 'carton'
      left join public.customer_prices cpp
        on p_customer_id is not null and cpp.customer_id = p_customer_id
        and cpp.product_id = p2.id and cpp.unit = 'piece'
      where p2.is_active
        and (p_category_id is null or p2.category_id = p_category_id)
        and (trim(coalesce(p_q, '')) = '' or p2.name ilike v_like or p2.barcode = trim(p_q) or p2.sku ilike v_like or p2.brand ilike v_like)
      order by p2.name
      limit greatest(p_limit, 1) offset greatest(p_offset, 0)
    ) t
  );
end;
$$;

-- ---------------------------------------------------------------------
-- customer_top_products: أكثر منتجات العميل شراءً + آخر سعر
-- ---------------------------------------------------------------------
create or replace function public.customer_top_products(p_customer_id uuid, p_limit int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
begin
  perform app.require_staff(null);

  return (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select si.product_id as id,
        max(si.product_name) as name,
        sum(si.qty_units) as total_units,
        count(distinct si.sale_id) as times_bought,
        max(s.sale_date) as last_bought_at,
        (
          select jsonb_build_object('unit', si2.unit, 'unit_price', si2.unit_price, 'sale_date', s2.sale_date)
          from public.sale_items si2
          join public.sales s2 on s2.id = si2.sale_id
          where si2.product_id = si.product_id and s2.customer_id = p_customer_id and s2.status = 'completed'
          order by s2.sale_date desc limit 1
        ) as last_purchase,
        p2.units_per_carton, p2.stock_units, p2.image_url,
        p2.sale_price_carton, p2.sale_price_piece, p2.barcode, p2.is_active
      from public.sale_items si
      join public.sales s on s.id = si.sale_id
      join public.products p2 on p2.id = si.product_id
      where s.customer_id = p_customer_id and s.status = 'completed'
      group by si.product_id, p2.units_per_carton, p2.stock_units, p2.image_url,
        p2.sale_price_carton, p2.sale_price_piece, p2.barcode, p2.is_active
      order by max(s.sale_date) desc, sum(si.qty_units) desc
      limit greatest(p_limit, 1)
    ) t
  );
end;
$$;

-- ---------------------------------------------------------------------
-- day_summary: ملخص اليوم الكامل (شاشة نهاية اليوم)
-- ---------------------------------------------------------------------
create or replace function public.day_summary(p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_date date := coalesce(p_date, app.today_local());
  v_from timestamptz := app.day_start(v_date);
  v_to timestamptz := app.day_end(v_date);
begin
  perform app.require_staff(null);

  return jsonb_build_object(
    'date', to_char(v_date, 'YYYY-MM-DD'),
    'sales', (
      select jsonb_build_object(
        'count', count(*), 'total', coalesce(sum(total), 0),
        'cogs', coalesce(sum(cost_total), 0), 'profit', coalesce(sum(profit), 0),
        'discount', coalesce(sum(line_discount_total + invoice_discount), 0),
        'paid', coalesce(sum(paid), 0), 'credit', coalesce(sum(total - paid), 0)
      ) from public.sales where status = 'completed' and sale_date >= v_from and sale_date < v_to
    ),
    'returns', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0),
        'profit_delta', coalesce(sum(profit_delta), 0), 'refund_cash', coalesce(sum(refund_cash), 0))
      from public.returns where status = 'completed' and return_date >= v_from and return_date < v_to
    ),
    'purchases', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(total), 0),
        'paid', coalesce(sum(paid), 0), 'credit', coalesce(sum(total - paid), 0))
      from public.purchases where status = 'completed' and purchase_date >= v_from and purchase_date < v_to
    ),
    'expenses', (
      select jsonb_build_object('count', count(*), 'total', coalesce(sum(amount), 0))
      from public.expenses where status = 'completed' and expense_date >= v_from and expense_date < v_to
    ),
    'expenses_by_category', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select ec.name, sum(e.amount) as total
        from public.expenses e join public.expense_categories ec on ec.id = e.category_id
        where e.status = 'completed' and e.expense_date >= v_from and e.expense_date < v_to
        group by ec.name order by sum(e.amount) desc
      ) t
    ),
    'cash', (
      select jsonb_build_object(
        'in_total', coalesce(sum(amount) filter (where direction = 'in'), 0),
        'out_total', coalesce(sum(amount) filter (where direction = 'out'), 0),
        'sale_receipts', coalesce(sum(amount) filter (where tx_type = 'sale_receipt'), 0),
        'debt_collected', coalesce(sum(amount) filter (where tx_type = 'customer_receipt'), 0),
        'supplier_paid', coalesce(sum(amount) filter (where tx_type = 'supplier_payment'), 0),
        'expenses_paid', coalesce(sum(amount) filter (where tx_type = 'expense'), 0),
        'refunds_out', coalesce(sum(amount) filter (where tx_type = 'refund' and direction = 'out'), 0),
        'by_method_in', (
          select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) from (
            select method, sum(amount) as total from public.cash_transactions
            where tx_date >= v_from and tx_date < v_to and direction = 'in'
            group by method
          ) mm
        )
      )
      from public.cash_transactions where tx_date >= v_from and tx_date < v_to
    ),
    'cash_balance', public.cash_balance(),
    'session', (
      select to_jsonb(cs) from public.cash_sessions cs where cs.session_date = v_date
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- refresh_periodic_notifications: تنبيهات دورية (ديون قديمة، أصناف راكدة)
-- ---------------------------------------------------------------------
create or replace function public.refresh_periodic_notifications(p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_last timestamptz;
  v_old_days int := app.setting_num('debts', 'old_debt_days', 30)::int;
  v_critical_days int := app.setting_num('debts', 'critical_debt_days', 60)::int;
  v_stagnant_days int := app.setting_num('inventory', 'stagnant_days', 45)::int;
  v_row record;
  v_days int;
  v_created int := 0;
begin
  perform app.require_staff(null);

  v_last := nullif(app.setting('notifications') ->> 'periodic_last_run', '')::timestamptz;
  if not p_force and v_last is not null and v_last > now() - interval '6 hours' then
    return jsonb_build_object('skipped', true, 'last_run', v_last);
  end if;

  -- ديون عملاء قديمة
  for v_row in
    select c.id, c.name, c.balance,
      coalesce(lp.last_payment_at, fd.first_debt_at) as ref_date
    from public.customers c
    left join lateral (
      select max(payment_date) as last_payment_at from public.payments
      where customer_id = c.id and status = 'completed'
    ) lp on true
    left join lateral (
      select min(entry_date) as first_debt_at from public.customer_ledger
      where customer_id = c.id and debit > 0
    ) fd on true
    where c.balance > 0
    limit 100
  loop
    if v_row.ref_date is not null then
      v_days := extract(day from now() - v_row.ref_date)::int;
      if v_days >= v_old_days then
        perform app.notify_once('old_debt:' || v_row.id::text, 'old_debt',
          case when v_days >= v_critical_days then 'critical'::public.notif_severity else 'warning'::public.notif_severity end,
          'دين قديم: ' || v_row.name,
          'الرصيد ' || v_row.balance || ' د.أ منذ ' || v_days || ' يومًا بدون دفعة.',
          'customers', v_row.id::text);
        v_created := v_created + 1;
      end if;
    end if;
  end loop;

  -- أصناف راكدة
  for v_row in
    select p2.id, p2.name, p2.stock_units, ls.last_sale_at
    from public.products p2
    left join lateral (
      select max(si.created_at) as last_sale_at from public.sale_items si where si.product_id = p2.id
    ) ls on true
    where p2.is_active and p2.stock_units > 0
      and (ls.last_sale_at is null or ls.last_sale_at < now() - make_interval(days => v_stagnant_days))
      and p2.created_at < now() - make_interval(days => v_stagnant_days)
    limit 50
  loop
    perform app.notify_once('stagnant:' || v_row.id::text, 'stagnant_product', 'info',
      'صنف راكد: ' || v_row.name,
      'لم يُبع منذ أكثر من ' || v_stagnant_days || ' يومًا وفي المخزون ' || v_row.stock_units || ' حبة.',
      'products', v_row.id::text);
    v_created := v_created + 1;
  end loop;

  update public.app_settings
  set value = jsonb_set(coalesce(value, '{}'::jsonb), '{periodic_last_run}', to_jsonb(now()::text))
  where key = 'notifications';

  return jsonb_build_object('skipped', false, 'created', v_created);
end;
$$;

-- ---------------------------------------------------------------------
-- reset_all_data: تصفير كل البيانات (يبقي المستخدمين والإعدادات وسجل التدقيق)
-- يُستخدم لمسح البيانات التجريبية والبدء بالإنتاج الفعلي.
-- ---------------------------------------------------------------------
create or replace function public.reset_all_data(p_confirmation text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
begin
  v_actor := app.require_staff(array['owner']::public.user_role[]);

  if p_confirmation is distinct from 'RESET' then
    perform app.err('CONFIRMATION_REQUIRED', 'أدخل كلمة RESET للتأكيد.');
  end if;

  truncate table
    public.sale_items, public.return_items, public.purchase_items,
    public.inventory_count_items, public.inventory_counts,
    public.returns, public.payments, public.sales, public.purchases,
    public.customer_ledger, public.supplier_ledger,
    public.stock_movements, public.cash_transactions, public.cash_sessions,
    public.expenses, public.notes, public.held_sales, public.notifications,
    public.customer_prices, public.customers, public.suppliers,
    public.products, public.categories, public.counters
  restart identity cascade;

  perform app.audit(v_actor.id, 'system.reset', 'system', null, null,
    jsonb_build_object('confirmed', true), p_ip);

  return jsonb_build_object('ok', true);
end;
$$;

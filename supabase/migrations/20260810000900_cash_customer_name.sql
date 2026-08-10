-- =====================================================================
-- Migration 9: اسم اختياري للزبون النقدي + توحيد اسم النشاط
-- الملفات الأقدم مطبّقة مسبقًا على قواعد البيانات القائمة، لذلك تُعاد هنا
-- الدوال المعدّلة كما هي (create or replace) حتى تسري على القاعدة الحالية.
-- لا يحذف هذا الملف أي بيانات.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) عمود اسم الزبون النقدي الاختياري
-- ---------------------------------------------------------------------
alter table public.sales
  add column if not exists cash_customer_name text;

-- ---------------------------------------------------------------------
-- 2) create_sale: حفظ الاسم الاختياري للبيع النقدي
-- ---------------------------------------------------------------------
create or replace function public.create_sale(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_customer public.customers;
  v_customer_id uuid := nullif(p->>'customer_id', '')::uuid;
  v_sale_date timestamptz := coalesce(nullif(p->>'sale_date','')::timestamptz, now());
  v_allow_negative boolean := app.setting_bool('inventory', 'allow_negative_stock', false);
  v_items jsonb := p->'items';
  v_item jsonb;
  v_product public.products;
  v_pids uuid[];
  v_n int;
  i int := 0;
  a_product uuid[] := '{}'; a_name text[] := '{}'; a_unit public.unit_kind[] := '{}';
  a_upc int[] := '{}'; a_qty int[] := '{}'; a_qty_units int[] := '{}';
  a_price_f bigint[] := '{}'; a_line_f bigint[] := '{}'; a_disc_f bigint[] := '{}';
  a_net_f bigint[] := '{}'; a_alloc_f bigint[] := '{}';
  a_cost numeric[] := '{}'; a_cost_f bigint[] := '{}';
  v_unit public.unit_kind;
  v_qty int;
  v_qty_units int;
  v_price_f bigint;
  v_line_f bigint;
  v_disc_f bigint;
  v_cost_line_f bigint;
  v_subtotal_f bigint := 0;
  v_linedisc_f bigint := 0;
  v_netsum_f bigint := 0;
  v_invdisc_f bigint := app.to_fils(coalesce(nullif(p->>'invoice_discount',''), '0')::numeric);
  v_total_f bigint;
  v_paid_f bigint := app.to_fils(coalesce(nullif(p->>'paid',''), '0')::numeric);
  v_cost_total_f bigint := 0;
  v_needed jsonb := '{}'::jsonb;
  v_stock int;
  v_sale_id uuid := gen_random_uuid();
  v_invoice_no text;
  v_method public.payment_method := nullif(p->>'payment_method','')::public.payment_method;
  v_cash_customer_name text := nullif(left(trim(coalesce(p->>'cash_customer_name', '')), 150), '');
  v_notes text := nullif(p->>'notes', '');
  v_remaining_f bigint;
  v_new_balance numeric;
  v_warnings jsonb := '[]'::jsonb;
  v_payment_no text;
  v_payment_id uuid;
  v_big_threshold numeric := app.setting_num('sales', 'big_invoice_threshold', 0);
  v_held_id uuid := nullif(p->>'held_id','')::uuid;
  v_ip text := nullif(p->>'client_ip', '');
  v_key text;
begin
  v_actor := app.require_staff(array['owner','manager','sales']::public.user_role[]);

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform app.err('SALE_NO_ITEMS', 'لا يمكن حفظ فاتورة بدون أصناف.');
  end if;

  if v_customer_id is not null then
    v_cash_customer_name := null;
    select * into v_customer from public.customers where id = v_customer_id;
    if v_customer.id is null then
      perform app.err('CUSTOMER_NOT_FOUND', 'العميل غير موجود.');
    end if;
    if not v_customer.is_active then
      perform app.err('CUSTOMER_INACTIVE', 'هذا العميل موقوف.');
    end if;
  end if;

  -- قفل أصناف الفاتورة بترتيب ثابت لمنع التعارض
  select array_agg(pid) into v_pids from (
    select distinct (e->>'product_id')::uuid as pid
    from jsonb_array_elements(v_items) e
    order by 1
  ) s;
  perform 1 from public.products where id = any(v_pids) order by id for update;

  -- المرحلة الأولى: قراءة الأصناف وحساب السطور
  for v_item in select value from jsonb_array_elements(v_items) loop
    i := i + 1;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    if v_product.id is null then
      perform app.err('PRODUCT_NOT_FOUND', 'أحد الأصناف غير موجود.', jsonb_build_object('index', i));
    end if;
    if not v_product.is_active then
      perform app.err('PRODUCT_INACTIVE', 'الصنف "' || v_product.name || '" موقوف ولا يمكن بيعه.');
    end if;

    v_unit := (v_item->>'unit')::public.unit_kind;
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then
      perform app.err('INVALID_QTY', 'كمية غير صالحة للصنف "' || v_product.name || '".');
    end if;
    v_qty_units := case when v_unit = 'carton' then v_qty * v_product.units_per_carton else v_qty end;

    v_price_f := app.to_fils((v_item->>'unit_price')::numeric);
    if v_price_f is null or v_price_f < 0 then
      perform app.err('INVALID_PRICE', 'سعر غير صالح للصنف "' || v_product.name || '".');
    end if;
    v_line_f := v_price_f * v_qty;

    v_disc_f := app.to_fils(coalesce(nullif(v_item->>'discount',''), '0')::numeric);
    if v_disc_f < 0 or v_disc_f > v_line_f then
      perform app.err('INVALID_DISCOUNT', 'خصم غير صالح على الصنف "' || v_product.name || '".');
    end if;

    v_cost_line_f := app.to_fils(v_qty_units::numeric * v_product.avg_unit_cost);

    a_product := a_product || v_product.id;
    a_name := a_name || v_product.name;
    a_unit := a_unit || v_unit;
    a_upc := a_upc || v_product.units_per_carton;
    a_qty := a_qty || v_qty;
    a_qty_units := a_qty_units || v_qty_units;
    a_price_f := a_price_f || v_price_f;
    a_line_f := a_line_f || v_line_f;
    a_disc_f := a_disc_f || v_disc_f;
    a_net_f := a_net_f || (v_line_f - v_disc_f);
    a_cost := a_cost || v_product.avg_unit_cost;
    a_cost_f := a_cost_f || v_cost_line_f;

    v_subtotal_f := v_subtotal_f + v_line_f;
    v_linedisc_f := v_linedisc_f + v_disc_f;
    v_netsum_f := v_netsum_f + (v_line_f - v_disc_f);

    v_key := v_product.id::text;
    v_needed := jsonb_set(v_needed, array[v_key],
      to_jsonb(coalesce((v_needed->>v_key)::int, 0) + v_qty_units));
  end loop;
  v_n := i;

  -- فحص توفر المخزون (مجمّعًا لكل صنف)
  if not v_allow_negative then
    for i in 1..v_n loop
      v_key := a_product[i]::text;
      if (v_needed->>v_key) is not null then
        select stock_units into v_stock from public.products where id = a_product[i];
        if v_stock < (v_needed->>v_key)::int then
          perform app.err('INSUFFICIENT_STOCK',
            'الكمية المطلوبة من "' || a_name[i] || '" غير متوفرة. المتوفر: ' || v_stock || ' حبة.',
            jsonb_build_object('product_id', a_product[i], 'product_name', a_name[i],
                               'available_units', v_stock, 'needed_units', (v_needed->>v_key)::int));
        end if;
        v_needed := v_needed - v_key;
      end if;
    end loop;
  end if;

  -- خصم الفاتورة والإجمالي
  if v_invdisc_f < 0 or v_invdisc_f > v_netsum_f then
    perform app.err('INVALID_INVOICE_DISCOUNT', 'خصم الفاتورة غير صالح.');
  end if;
  v_total_f := v_netsum_f - v_invdisc_f;

  if v_paid_f < 0 then
    perform app.err('INVALID_PAID', 'المبلغ المدفوع غير صالح.');
  end if;
  if v_paid_f > v_total_f then
    perform app.err('PAID_EXCEEDS_TOTAL', 'المبلغ المدفوع أكبر من إجمالي الفاتورة.');
  end if;
  if v_customer_id is null and v_paid_f <> v_total_f then
    perform app.err('CASH_SALE_MUST_BE_PAID', 'البيع النقدي بدون عميل مسجّل يجب أن يُدفع بالكامل.');
  end if;
  if v_paid_f > 0 and v_method is null then
    v_method := coalesce(nullif(app.setting_text('sales','default_payment_method','cash'),'')::public.payment_method, 'cash');
  end if;

  -- فحص الحد الائتماني
  v_remaining_f := v_total_f - v_paid_f;
  if v_customer_id is not null and v_remaining_f > 0 and v_customer.credit_limit is not null then
    if (v_customer.balance + app.from_fils(v_remaining_f)) > v_customer.credit_limit then
      if not coalesce((p->>'allow_over_credit')::boolean, false) then
        perform app.err('OVER_CREDIT_LIMIT',
          'هذه الفاتورة تتجاوز الحد الائتماني للعميل "' || v_customer.name || '".',
          jsonb_build_object('balance', v_customer.balance, 'credit_limit', v_customer.credit_limit,
                             'remaining', app.from_fils(v_remaining_f)));
      end if;
      v_warnings := v_warnings || jsonb_build_object('code','OVER_CREDIT_LIMIT','message','تم تجاوز الحد الائتماني للعميل.');
      perform app.notify_once(null, 'over_credit', 'warning',
        'تجاوز الحد الائتماني: ' || v_customer.name,
        'رصيد العميل بعد الفاتورة سيصبح ' || round(v_customer.balance + app.from_fils(v_remaining_f), 3) || ' د.أ والحد الائتماني ' || v_customer.credit_limit || ' د.أ.',
        'customers', v_customer_id::text);
    end if;
  end if;

  -- توزيع خصم الفاتورة على السطور (أكبر البواقي)
  a_alloc_f := app.allocate_discount(a_net_f, v_invdisc_f);

  -- إنشاء الفاتورة
  v_invoice_no := app.next_doc_no('sale', app.setting_text('invoice', 'prefix', 'RM'));

  for i in 1..v_n loop
    v_cost_total_f := v_cost_total_f + a_cost_f[i];
  end loop;

  insert into public.sales (id, invoice_no, customer_id, cash_customer_name, status, sale_date, subtotal, line_discount_total,
    invoice_discount, total, paid, cost_total, profit, payment_method, notes, created_by)
  values (v_sale_id, v_invoice_no, v_customer_id, v_cash_customer_name, 'completed', v_sale_date,
    app.from_fils(v_subtotal_f), app.from_fils(v_linedisc_f), app.from_fils(v_invdisc_f),
    app.from_fils(v_total_f), app.from_fils(v_paid_f),
    app.from_fils(v_cost_total_f), app.from_fils(v_total_f - v_cost_total_f),
    v_method, v_notes, v_actor.id);

  -- السطور + خصم المخزون
  for i in 1..v_n loop
    insert into public.sale_items (sale_id, product_id, product_name, unit, units_per_carton, qty, qty_units,
      unit_price, line_total, discount, inv_discount_share, net_total, unit_cost, cost_total, profit)
    values (v_sale_id, a_product[i], a_name[i], a_unit[i], a_upc[i], a_qty[i], a_qty_units[i],
      app.from_fils(a_price_f[i]), app.from_fils(a_line_f[i]), app.from_fils(a_disc_f[i]),
      app.from_fils(a_alloc_f[i]), app.from_fils(a_net_f[i] - a_alloc_f[i]),
      a_cost[i], app.from_fils(a_cost_f[i]),
      app.from_fils((a_net_f[i] - a_alloc_f[i]) - a_cost_f[i]));

    perform app.apply_stock_change(a_product[i], 'sale', -a_qty_units[i], null,
      'sales', v_sale_id, 'فاتورة ' || v_invoice_no, v_actor.id);
  end loop;

  -- الحركة المالية وحساب العميل
  if v_customer_id is not null then
    perform app.customer_ledger_add(v_customer_id, 'sale', 'sales', v_sale_id,
      app.from_fils(v_total_f), 0, v_sale_date, 'فاتورة ' || v_invoice_no, v_actor.id);

    if v_paid_f > 0 then
      v_payment_no := app.next_doc_no('receipt', app.setting_text('invoice', 'receipt_prefix', 'RCV'));
      v_payment_id := gen_random_uuid();
      insert into public.payments (id, payment_no, party_type, customer_id, sale_id, direction, amount, method, payment_date, notes, created_by)
      values (v_payment_id, v_payment_no, 'customer', v_customer_id, v_sale_id, 'in',
        app.from_fils(v_paid_f), v_method, v_sale_date, 'دفعة عند البيع - فاتورة ' || v_invoice_no, v_actor.id);
      perform app.customer_ledger_add(v_customer_id, 'payment', 'payments', v_payment_id,
        0, app.from_fils(v_paid_f), v_sale_date, 'سند قبض ' || v_payment_no, v_actor.id);
      perform app.cash_add('sale_receipt', 'in', app.from_fils(v_paid_f), v_method,
        'sales', v_sale_id, v_sale_date, 'قبض فاتورة ' || v_invoice_no, v_actor.id);
    end if;
    select balance into v_new_balance from public.customers where id = v_customer_id;
  else
    perform app.cash_add('sale_receipt', 'in', app.from_fils(v_paid_f), v_method,
      'sales', v_sale_id, v_sale_date, 'بيع نقدي ' || v_invoice_no, v_actor.id);
  end if;

  -- تنبيه فاتورة كبيرة
  if v_big_threshold > 0 and app.from_fils(v_total_f) >= v_big_threshold then
    perform app.notify_once('big_sale:' || v_sale_id::text, 'big_sale', 'info',
      'فاتورة كبيرة: ' || v_invoice_no,
      'قيمة الفاتورة ' || app.from_fils(v_total_f) || ' د.أ' ||
        case when v_customer_id is not null then ' للعميل ' || v_customer.name else '' end,
      'sales', v_sale_id::text);
  end if;

  -- حذف المسودة المعلّقة إن وُجدت
  if v_held_id is not null then
    delete from public.held_sales where id = v_held_id;
  end if;

  perform app.audit(v_actor.id, 'sale.create', 'sales', v_sale_id::text, null,
    jsonb_build_object('invoice_no', v_invoice_no, 'customer_id', v_customer_id,
      'total', app.from_fils(v_total_f), 'paid', app.from_fils(v_paid_f),
      'items', v_n), v_ip);

  return jsonb_build_object(
    'id', v_sale_id,
    'invoice_no', v_invoice_no,
    'total', app.from_fils(v_total_f),
    'paid', app.from_fils(v_paid_f),
    'remaining', app.from_fils(v_remaining_f),
    'profit', app.from_fils(v_total_f - v_cost_total_f),
    'customer_balance', v_new_balance,
    'warnings', v_warnings
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3) report_dashboard: إظهار الاسم الاختياري في آخر الفواتير
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
        'low_stock_count', count(*) filter (where is_active and stock_units <= min_stock_units)
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
        where is_active and stock_units <= min_stock_units
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
-- 4) global_search: البحث باسم الزبون النقدي أيضًا
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
-- 5) اسم النشاط: "رجائي المصري" بدل الاسم الطويل (فقط إن كان لا يزال الافتراضي)
-- ---------------------------------------------------------------------
update public.app_settings
set value = jsonb_set(value, '{business_name}', to_jsonb('رجائي المصري'::text))
where key = 'business'
  and value->>'business_name' = 'مؤسسة رجائي المصري للتوزيع والجملة';

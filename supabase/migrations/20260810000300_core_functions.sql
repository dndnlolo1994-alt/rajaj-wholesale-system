-- =====================================================================
-- Migration 3: Core financial RPCs (atomic, security definer)
-- Each function runs in a single transaction: all-or-nothing.
-- Errors: message = machine code, detail = Arabic message, hint = meta JSON.
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_sale: إتمام عملية بيع كاملة
-- payload: {
--   customer_id?, sale_date?, items: [{product_id, unit, qty, unit_price, discount?}],
--   invoice_discount?, paid, payment_method?, cash_customer_name?, notes?, allow_over_credit?,
--   held_id?, client_ip?
-- }
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
-- create_purchase: تسجيل فاتورة مشتريات
-- payload: { supplier_id, purchase_date?, supplier_invoice_no?, notes?, paid,
--   payment_method?, items: [{product_id, unit, qty, unit_cost}], client_ip? }
-- ---------------------------------------------------------------------
create or replace function public.create_purchase(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_supplier public.suppliers;
  v_supplier_id uuid := nullif(p->>'supplier_id','')::uuid;
  v_date timestamptz := coalesce(nullif(p->>'purchase_date','')::timestamptz, now());
  v_items jsonb := p->'items';
  v_item jsonb;
  v_product public.products;
  v_pids uuid[];
  v_unit public.unit_kind;
  v_qty int;
  v_qty_units int;
  v_cost_f bigint;
  v_line_f bigint;
  v_cost_per_unit numeric(14,6);
  v_total_f bigint := 0;
  v_paid_f bigint := app.to_fils(coalesce(nullif(p->>'paid',''), '0')::numeric);
  v_method public.payment_method := nullif(p->>'payment_method','')::public.payment_method;
  v_purchase_id uuid := gen_random_uuid();
  v_invoice_no text;
  v_payment_no text;
  v_payment_id uuid;
  v_new_balance numeric;
  v_ip text := nullif(p->>'client_ip','');
  i int := 0;
begin
  v_actor := app.require_staff(array['owner','manager','warehouse']::public.user_role[]);

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform app.err('PURCHASE_NO_ITEMS', 'لا يمكن حفظ فاتورة مشتريات بدون أصناف.');
  end if;

  select * into v_supplier from public.suppliers where id = v_supplier_id;
  if v_supplier.id is null then
    perform app.err('SUPPLIER_NOT_FOUND', 'المورد غير موجود.');
  end if;

  select array_agg(pid) into v_pids from (
    select distinct (e->>'product_id')::uuid as pid
    from jsonb_array_elements(v_items) e
    order by 1
  ) s;
  perform 1 from public.products where id = any(v_pids) order by id for update;

  -- حساب الإجمالي أولًا
  for v_item in select value from jsonb_array_elements(v_items) loop
    i := i + 1;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    if v_product.id is null then
      perform app.err('PRODUCT_NOT_FOUND', 'أحد الأصناف غير موجود.', jsonb_build_object('index', i));
    end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then
      perform app.err('INVALID_QTY', 'كمية غير صالحة للصنف "' || v_product.name || '".');
    end if;
    v_cost_f := app.to_fils((v_item->>'unit_cost')::numeric);
    if v_cost_f is null or v_cost_f < 0 then
      perform app.err('INVALID_COST', 'سعر شراء غير صالح للصنف "' || v_product.name || '".');
    end if;
    v_total_f := v_total_f + (v_cost_f * v_qty);
  end loop;

  if v_paid_f < 0 then
    perform app.err('INVALID_PAID', 'المبلغ المدفوع غير صالح.');
  end if;
  if v_paid_f > v_total_f then
    perform app.err('PAID_EXCEEDS_TOTAL', 'المبلغ المدفوع أكبر من إجمالي الفاتورة.');
  end if;
  if v_paid_f > 0 and v_method is null then
    v_method := 'cash';
  end if;

  v_invoice_no := app.next_doc_no('purchase', app.setting_text('invoice', 'purchase_prefix', 'PUR'));

  insert into public.purchases (id, invoice_no, supplier_invoice_no, supplier_id, status, purchase_date, total, paid, notes, created_by)
  values (v_purchase_id, v_invoice_no, nullif(p->>'supplier_invoice_no',''), v_supplier_id, 'completed', v_date,
    app.from_fils(v_total_f), app.from_fils(v_paid_f), nullif(p->>'notes',''), v_actor.id);

  -- السطور + رفع المخزون + تحديث متوسط التكلفة
  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    v_unit := (v_item->>'unit')::public.unit_kind;
    v_qty := (v_item->>'qty')::int;
    v_qty_units := case when v_unit = 'carton' then v_qty * v_product.units_per_carton else v_qty end;
    v_cost_f := app.to_fils((v_item->>'unit_cost')::numeric);
    v_line_f := v_cost_f * v_qty;
    v_cost_per_unit := case when v_unit = 'carton'
      then round(app.from_fils(v_cost_f) / v_product.units_per_carton, 6)
      else app.from_fils(v_cost_f) end;

    insert into public.purchase_items (purchase_id, product_id, product_name, unit, units_per_carton, qty, qty_units, unit_cost, cost_per_unit, line_total)
    values (v_purchase_id, v_product.id, v_product.name, v_unit, v_product.units_per_carton,
      v_qty, v_qty_units, app.from_fils(v_cost_f), v_cost_per_unit, app.from_fils(v_line_f));

    perform app.apply_stock_change(v_product.id, 'purchase', v_qty_units, v_cost_per_unit,
      'purchases', v_purchase_id, 'مشتريات ' || v_invoice_no, v_actor.id);

    -- تحديث آخر سعر شراء معروف (لا يمس تكلفة الفواتير السابقة)
    update public.products set
      purchase_price_carton = round(case when v_unit = 'carton'
        then app.from_fils(v_cost_f)
        else app.from_fils(v_cost_f) * units_per_carton end, 3)
    where id = v_product.id;
  end loop;

  -- حساب المورد
  perform app.supplier_ledger_add(v_supplier_id, 'purchase', 'purchases', v_purchase_id,
    0, app.from_fils(v_total_f), v_date, 'مشتريات ' || v_invoice_no, v_actor.id);

  if v_paid_f > 0 then
    v_payment_no := app.next_doc_no('voucher', app.setting_text('invoice', 'voucher_prefix', 'PAY'));
    v_payment_id := gen_random_uuid();
    insert into public.payments (id, payment_no, party_type, supplier_id, purchase_id, direction, amount, method, payment_date, notes, created_by)
    values (v_payment_id, v_payment_no, 'supplier', v_supplier_id, v_purchase_id, 'out',
      app.from_fils(v_paid_f), v_method, v_date, 'دفعة عند الشراء - ' || v_invoice_no, v_actor.id);
    perform app.supplier_ledger_add(v_supplier_id, 'payment', 'payments', v_payment_id,
      app.from_fils(v_paid_f), 0, v_date, 'سند صرف ' || v_payment_no, v_actor.id);
    perform app.cash_add('supplier_payment', 'out', app.from_fils(v_paid_f), v_method,
      'purchases', v_purchase_id, v_date, 'دفعة مشتريات ' || v_invoice_no, v_actor.id);
  end if;

  select balance into v_new_balance from public.suppliers where id = v_supplier_id;

  perform app.audit(v_actor.id, 'purchase.create', 'purchases', v_purchase_id::text, null,
    jsonb_build_object('invoice_no', v_invoice_no, 'supplier_id', v_supplier_id,
      'total', app.from_fils(v_total_f), 'paid', app.from_fils(v_paid_f)), v_ip);

  return jsonb_build_object(
    'id', v_purchase_id,
    'invoice_no', v_invoice_no,
    'total', app.from_fils(v_total_f),
    'paid', app.from_fils(v_paid_f),
    'remaining', app.from_fils(v_total_f - v_paid_f),
    'supplier_balance', v_new_balance
  );
end;
$$;

-- ---------------------------------------------------------------------
-- create_return: مرتجع على فاتورة بيع
-- payload: { sale_id, return_date?, reason?, notes?, refund_cash?, refund_method?,
--   items: [{sale_item_id, qty, unit, unit_price?, condition}], client_ip? }
-- ---------------------------------------------------------------------
create or replace function public.create_return(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_sale public.sales;
  v_sale_id uuid := nullif(p->>'sale_id','')::uuid;
  v_date timestamptz := coalesce(nullif(p->>'return_date','')::timestamptz, now());
  v_items jsonb := p->'items';
  v_item jsonb;
  v_si public.sale_items;
  v_unit public.unit_kind;
  v_qty int;
  v_qty_units int;
  v_price_f bigint;
  v_line_f bigint;
  v_condition public.item_condition;
  v_returned_units int;
  v_total_f bigint := 0;
  v_restock_cost_f bigint := 0;
  v_cost_total_f bigint;
  v_refund_f bigint := app.to_fils(coalesce(nullif(p->>'refund_cash',''), '0')::numeric);
  v_refund_method public.payment_method := coalesce(nullif(p->>'refund_method','')::public.payment_method, 'cash');
  v_credit_f bigint;
  v_prev_returns_f bigint;
  v_return_id uuid := gen_random_uuid();
  v_return_no text;
  v_new_balance numeric;
  v_ip text := nullif(p->>'client_ip','');
  v_pids uuid[];
begin
  v_actor := app.require_staff(array['owner','manager','sales']::public.user_role[]);

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform app.err('RETURN_NO_ITEMS', 'لا يمكن حفظ مرتجع بدون أصناف.');
  end if;

  select * into v_sale from public.sales where id = v_sale_id for update;
  if v_sale.id is null then
    perform app.err('SALE_NOT_FOUND', 'الفاتورة غير موجودة.');
  end if;
  if v_sale.status <> 'completed' then
    perform app.err('SALE_NOT_COMPLETED', 'لا يمكن عمل مرتجع على فاتورة ملغاة.');
  end if;

  select array_agg(pid) into v_pids from (
    select distinct si.product_id as pid
    from jsonb_array_elements(v_items) e
    join public.sale_items si on si.id = (e->>'sale_item_id')::uuid
    order by 1
  ) s;
  perform 1 from public.products where id = any(v_pids) order by id for update;

  v_return_no := app.next_doc_no('return', app.setting_text('invoice', 'return_prefix', 'RET'));

  insert into public.returns (id, return_no, sale_id, customer_id, status, return_date, reason, notes, refund_method, created_by)
  values (v_return_id, v_return_no, v_sale_id, v_sale.customer_id, 'completed', v_date,
    nullif(p->>'reason',''), nullif(p->>'notes',''), v_refund_method, v_actor.id);

  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_si from public.sale_items
      where id = (v_item->>'sale_item_id')::uuid and sale_id = v_sale_id;
    if v_si.id is null then
      perform app.err('SALE_ITEM_NOT_FOUND', 'سطر الفاتورة غير موجود.');
    end if;

    v_unit := coalesce(nullif(v_item->>'unit','')::public.unit_kind, v_si.unit);
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then
      perform app.err('INVALID_QTY', 'كمية مرتجع غير صالحة للصنف "' || v_si.product_name || '".');
    end if;
    v_qty_units := case when v_unit = 'carton' then v_qty * v_si.units_per_carton else v_qty end;

    -- إجمالي المرتجع سابقًا على هذا السطر
    select coalesce(sum(ri.qty_units), 0) into v_returned_units
    from public.return_items ri
    join public.returns r on r.id = ri.return_id
    where ri.sale_item_id = v_si.id and r.status = 'completed';

    if v_returned_units + v_qty_units > v_si.qty_units then
      perform app.err('RETURN_EXCEEDS_SOLD',
        'كمية المرتجع من "' || v_si.product_name || '" أكبر من الكمية المتبقية القابلة للإرجاع.',
        jsonb_build_object('sold_units', v_si.qty_units, 'returned_units', v_returned_units));
    end if;

    -- السعر الافتراضي = صافي سعر البيع الفعلي للوحدة المطلوبة
    if nullif(v_item->>'unit_price','') is not null then
      v_price_f := app.to_fils((v_item->>'unit_price')::numeric);
    else
      v_price_f := case when v_unit = v_si.unit
        then app.to_fils(round(v_si.net_total / v_si.qty, 3))
        else app.to_fils(round(v_si.net_total / v_si.qty_units, 3)) end;
    end if;
    if v_price_f < 0 then
      perform app.err('INVALID_PRICE', 'سعر مرتجع غير صالح.');
    end if;
    v_line_f := v_price_f * v_qty;

    v_condition := coalesce(nullif(v_item->>'condition','')::public.item_condition, 'good');
    v_cost_total_f := app.to_fils(v_qty_units::numeric * v_si.unit_cost);

    insert into public.return_items (return_id, sale_item_id, product_id, product_name, unit, units_per_carton,
      qty, qty_units, unit_price, line_total, condition, unit_cost, cost_total)
    values (v_return_id, v_si.id, v_si.product_id, v_si.product_name, v_unit, v_si.units_per_carton,
      v_qty, v_qty_units, app.from_fils(v_price_f), app.from_fils(v_line_f), v_condition,
      v_si.unit_cost, app.from_fils(v_cost_total_f));

    if v_condition = 'good' then
      perform app.apply_stock_change(v_si.product_id, 'sale_return', v_qty_units, v_si.unit_cost,
        'returns', v_return_id, 'مرتجع ' || v_return_no || ' من فاتورة ' || v_sale.invoice_no, v_actor.id);
      v_restock_cost_f := v_restock_cost_f + v_cost_total_f;
    end if;

    v_total_f := v_total_f + v_line_f;
  end loop;

  -- حماية: مجموع المرتجعات لا يتجاوز قيمة الفاتورة
  select coalesce(sum(app.to_fils(total)), 0) into v_prev_returns_f
  from public.returns where sale_id = v_sale_id and status = 'completed' and id <> v_return_id;
  if v_prev_returns_f + v_total_f > app.to_fils(v_sale.total) then
    perform app.err('RETURN_EXCEEDS_SALE', 'قيمة المرتجعات تجاوزت قيمة الفاتورة الأصلية.');
  end if;

  if v_refund_f < 0 or v_refund_f > v_total_f then
    perform app.err('INVALID_REFUND', 'المبلغ النقدي المرتجع غير صالح.');
  end if;
  if v_sale.customer_id is null and v_refund_f <> v_total_f then
    perform app.err('CASH_RETURN_MUST_REFUND', 'مرتجع البيع النقدي يُرد نقدًا بالكامل.');
  end if;

  v_credit_f := v_total_f - v_refund_f;

  update public.returns set
    total = app.from_fils(v_total_f),
    restocked_cost_total = app.from_fils(v_restock_cost_f),
    profit_delta = app.from_fils(v_restock_cost_f - v_total_f),
    refund_cash = app.from_fils(v_refund_f)
  where id = v_return_id;

  if v_sale.customer_id is not null and v_credit_f > 0 then
    perform app.customer_ledger_add(v_sale.customer_id, 'return', 'returns', v_return_id,
      0, app.from_fils(v_credit_f), v_date,
      'مرتجع ' || v_return_no || ' من فاتورة ' || v_sale.invoice_no, v_actor.id);
  end if;
  if v_sale.customer_id is not null then
    select balance into v_new_balance from public.customers where id = v_sale.customer_id;
  end if;

  if v_refund_f > 0 then
    perform app.cash_add('refund', 'out', app.from_fils(v_refund_f), v_refund_method,
      'returns', v_return_id, v_date, 'رد نقدي - مرتجع ' || v_return_no, v_actor.id);
  end if;

  perform app.audit(v_actor.id, 'return.create', 'returns', v_return_id::text, null,
    jsonb_build_object('return_no', v_return_no, 'sale_id', v_sale_id,
      'total', app.from_fils(v_total_f), 'refund_cash', app.from_fils(v_refund_f)), v_ip);

  return jsonb_build_object(
    'id', v_return_id,
    'return_no', v_return_no,
    'total', app.from_fils(v_total_f),
    'refund_cash', app.from_fils(v_refund_f),
    'credited', app.from_fils(v_credit_f),
    'customer_balance', v_new_balance
  );
end;
$$;

-- ---------------------------------------------------------------------
-- record_customer_payment: قبض دفعة من عميل
-- payload: { customer_id, amount, method?, sale_id?, payment_date?, notes?, client_ip? }
-- ---------------------------------------------------------------------
create or replace function public.record_customer_payment(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_customer_id uuid := nullif(p->>'customer_id','')::uuid;
  v_amount numeric := round(coalesce(nullif(p->>'amount','')::numeric, 0), 3);
  v_method public.payment_method := coalesce(nullif(p->>'method','')::public.payment_method, 'cash');
  v_sale_id uuid := nullif(p->>'sale_id','')::uuid;
  v_date timestamptz := coalesce(nullif(p->>'payment_date','')::timestamptz, now());
  v_sale public.sales;
  v_payment_id uuid := gen_random_uuid();
  v_payment_no text;
  v_new_balance numeric;
  v_ip text := nullif(p->>'client_ip','');
begin
  v_actor := app.require_staff(array['owner','manager','sales','accountant']::public.user_role[]);

  if v_amount <= 0 then
    perform app.err('INVALID_AMOUNT', 'مبلغ الدفعة غير صالح.');
  end if;

  if v_sale_id is not null then
    select * into v_sale from public.sales where id = v_sale_id for update;
    if v_sale.id is null or v_sale.customer_id is distinct from v_customer_id then
      perform app.err('SALE_NOT_FOUND', 'الفاتورة المرتبطة غير موجودة لهذا العميل.');
    end if;
    if v_sale.status <> 'completed' then
      perform app.err('SALE_NOT_COMPLETED', 'لا يمكن تسجيل دفعة على فاتورة ملغاة.');
    end if;
    if v_amount > (v_sale.total - v_sale.paid) then
      perform app.err('EXCEEDS_SALE_REMAINING', 'الدفعة أكبر من المتبقي على الفاتورة.',
        jsonb_build_object('remaining', v_sale.total - v_sale.paid));
    end if;
    update public.sales set paid = round(paid + v_amount, 3) where id = v_sale_id;
  end if;

  v_payment_no := app.next_doc_no('receipt', app.setting_text('invoice', 'receipt_prefix', 'RCV'));
  insert into public.payments (id, payment_no, party_type, customer_id, sale_id, direction, amount, method, payment_date, notes, created_by)
  values (v_payment_id, v_payment_no, 'customer', v_customer_id, v_sale_id, 'in', v_amount, v_method, v_date,
    nullif(p->>'notes',''), v_actor.id);

  v_new_balance := app.customer_ledger_add(v_customer_id, 'payment', 'payments', v_payment_id,
    0, v_amount, v_date, 'سند قبض ' || v_payment_no, v_actor.id);

  perform app.cash_add('customer_receipt', 'in', v_amount, v_method, 'payments', v_payment_id, v_date,
    'قبض من عميل - ' || v_payment_no, v_actor.id);

  perform app.audit(v_actor.id, 'payment.customer_receipt', 'payments', v_payment_id::text, null,
    jsonb_build_object('payment_no', v_payment_no, 'customer_id', v_customer_id, 'amount', v_amount), v_ip);

  return jsonb_build_object('id', v_payment_id, 'payment_no', v_payment_no, 'customer_balance', v_new_balance);
end;
$$;

-- ---------------------------------------------------------------------
-- record_supplier_payment: دفع دفعة لمورد
-- ---------------------------------------------------------------------
create or replace function public.record_supplier_payment(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_supplier_id uuid := nullif(p->>'supplier_id','')::uuid;
  v_amount numeric := round(coalesce(nullif(p->>'amount','')::numeric, 0), 3);
  v_method public.payment_method := coalesce(nullif(p->>'method','')::public.payment_method, 'cash');
  v_purchase_id uuid := nullif(p->>'purchase_id','')::uuid;
  v_date timestamptz := coalesce(nullif(p->>'payment_date','')::timestamptz, now());
  v_purchase public.purchases;
  v_payment_id uuid := gen_random_uuid();
  v_payment_no text;
  v_new_balance numeric;
  v_ip text := nullif(p->>'client_ip','');
begin
  v_actor := app.require_staff(array['owner','manager','accountant']::public.user_role[]);

  if v_amount <= 0 then
    perform app.err('INVALID_AMOUNT', 'مبلغ الدفعة غير صالح.');
  end if;

  if v_purchase_id is not null then
    select * into v_purchase from public.purchases where id = v_purchase_id for update;
    if v_purchase.id is null or v_purchase.supplier_id is distinct from v_supplier_id then
      perform app.err('PURCHASE_NOT_FOUND', 'فاتورة المشتريات المرتبطة غير موجودة لهذا المورد.');
    end if;
    if v_purchase.status <> 'completed' then
      perform app.err('PURCHASE_NOT_COMPLETED', 'لا يمكن تسجيل دفعة على فاتورة ملغاة.');
    end if;
    if v_amount > (v_purchase.total - v_purchase.paid) then
      perform app.err('EXCEEDS_PURCHASE_REMAINING', 'الدفعة أكبر من المتبقي على الفاتورة.',
        jsonb_build_object('remaining', v_purchase.total - v_purchase.paid));
    end if;
    update public.purchases set paid = round(paid + v_amount, 3) where id = v_purchase_id;
  end if;

  v_payment_no := app.next_doc_no('voucher', app.setting_text('invoice', 'voucher_prefix', 'PAY'));
  insert into public.payments (id, payment_no, party_type, supplier_id, purchase_id, direction, amount, method, payment_date, notes, created_by)
  values (v_payment_id, v_payment_no, 'supplier', v_supplier_id, v_purchase_id, 'out', v_amount, v_method, v_date,
    nullif(p->>'notes',''), v_actor.id);

  v_new_balance := app.supplier_ledger_add(v_supplier_id, 'payment', 'payments', v_payment_id,
    v_amount, 0, v_date, 'سند صرف ' || v_payment_no, v_actor.id);

  perform app.cash_add('supplier_payment', 'out', v_amount, v_method, 'payments', v_payment_id, v_date,
    'دفع لمورد - ' || v_payment_no, v_actor.id);

  perform app.audit(v_actor.id, 'payment.supplier_payment', 'payments', v_payment_id::text, null,
    jsonb_build_object('payment_no', v_payment_no, 'supplier_id', v_supplier_id, 'amount', v_amount), v_ip);

  return jsonb_build_object('id', v_payment_id, 'payment_no', v_payment_no, 'supplier_balance', v_new_balance);
end;
$$;

-- ---------------------------------------------------------------------
-- create_expense: تسجيل مصروف
-- ---------------------------------------------------------------------
create or replace function public.create_expense(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_category_id uuid := nullif(p->>'category_id','')::uuid;
  v_amount numeric := round(coalesce(nullif(p->>'amount','')::numeric, 0), 3);
  v_method public.payment_method := coalesce(nullif(p->>'method','')::public.payment_method, 'cash');
  v_date timestamptz := coalesce(nullif(p->>'expense_date','')::timestamptz, now());
  v_expense_id uuid := gen_random_uuid();
  v_expense_no text;
  v_cat_name text;
  v_ip text := nullif(p->>'client_ip','');
begin
  v_actor := app.require_staff(array['owner','manager','accountant']::public.user_role[]);

  if v_amount <= 0 then
    perform app.err('INVALID_AMOUNT', 'مبلغ المصروف غير صالح.');
  end if;
  select name into v_cat_name from public.expense_categories where id = v_category_id;
  if v_cat_name is null then
    perform app.err('CATEGORY_NOT_FOUND', 'تصنيف المصروف غير موجود.');
  end if;

  v_expense_no := app.next_doc_no('expense', app.setting_text('invoice', 'expense_prefix', 'EXP'));
  insert into public.expenses (id, expense_no, category_id, amount, method, expense_date, notes, attachment_url, created_by)
  values (v_expense_id, v_expense_no, v_category_id, v_amount, v_method, v_date,
    nullif(p->>'notes',''), nullif(p->>'attachment_url',''), v_actor.id);

  perform app.cash_add('expense', 'out', v_amount, v_method, 'expenses', v_expense_id, v_date,
    'مصروف ' || v_cat_name || ' - ' || v_expense_no, v_actor.id);

  perform app.audit(v_actor.id, 'expense.create', 'expenses', v_expense_id::text, null,
    jsonb_build_object('expense_no', v_expense_no, 'category', v_cat_name, 'amount', v_amount), v_ip);

  return jsonb_build_object('id', v_expense_id, 'expense_no', v_expense_no);
end;
$$;

-- ---------------------------------------------------------------------
-- cash_manual_tx: حركة صندوق يدوية (دخل إضافي، سحب شخصي، إيداع، تسوية)
-- ---------------------------------------------------------------------
create or replace function public.cash_manual_tx(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_type public.cash_tx_type := nullif(p->>'tx_type','')::public.cash_tx_type;
  v_amount numeric := round(coalesce(nullif(p->>'amount','')::numeric, 0), 3);
  v_method public.payment_method := coalesce(nullif(p->>'method','')::public.payment_method, 'cash');
  v_date timestamptz := coalesce(nullif(p->>'tx_date','')::timestamptz, now());
  v_direction public.cash_direction;
  v_notes text := nullif(p->>'notes','');
  v_ip text := nullif(p->>'client_ip','');
begin
  if v_type = 'adjustment' then
    v_actor := app.require_staff(array['owner']::public.user_role[]);
    v_direction := nullif(p->>'direction','')::public.cash_direction;
    if v_direction is null then
      perform app.err('INVALID_DIRECTION', 'اتجاه التسوية مطلوب.');
    end if;
    if v_notes is null then
      perform app.err('REASON_REQUIRED', 'سبب التسوية مطلوب.');
    end if;
  else
    v_actor := app.require_staff(array['owner','manager','accountant']::public.user_role[]);
    v_direction := case v_type
      when 'extra_income' then 'in'::public.cash_direction
      when 'deposit' then 'in'::public.cash_direction
      when 'owner_withdrawal' then 'out'::public.cash_direction
      else null end;
    if v_direction is null then
      perform app.err('INVALID_TX_TYPE', 'نوع الحركة غير مسموح يدويًا.');
    end if;
  end if;

  if v_amount <= 0 then
    perform app.err('INVALID_AMOUNT', 'المبلغ غير صالح.');
  end if;

  perform app.cash_add(v_type, v_direction, v_amount, v_method, null, null, v_date, v_notes, v_actor.id);

  perform app.audit(v_actor.id, 'cash.manual', 'cash_transactions', null, null,
    jsonb_build_object('tx_type', v_type, 'direction', v_direction, 'amount', v_amount, 'notes', v_notes), v_ip);

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- void_sale: إلغاء فاتورة بيع (يعكس كل الآثار ويحتفظ بالسجل)
-- ---------------------------------------------------------------------
create or replace function public.void_sale(p_sale_id uuid, p_reason text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_sale public.sales;
  v_item public.sale_items;
  v_has_returns boolean;
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  if coalesce(trim(p_reason), '') = '' then
    perform app.err('REASON_REQUIRED', 'سبب الإلغاء مطلوب.');
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    perform app.err('SALE_NOT_FOUND', 'الفاتورة غير موجودة.');
  end if;
  if v_sale.status <> 'completed' then
    perform app.err('ALREADY_VOID', 'الفاتورة ملغاة مسبقًا.');
  end if;

  select exists(select 1 from public.returns where sale_id = p_sale_id and status = 'completed') into v_has_returns;
  if v_has_returns then
    perform app.err('HAS_RETURNS', 'لا يمكن إلغاء فاتورة عليها مرتجعات. ألغِ المرتجعات أولًا.');
  end if;

  perform 1 from public.products
    where id in (select product_id from public.sale_items where sale_id = p_sale_id)
    order by id for update;

  -- إعادة المخزون بتكلفته التاريخية
  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    perform app.apply_stock_change(v_item.product_id, 'sale_void', v_item.qty_units, v_item.unit_cost,
      'sales', p_sale_id, 'إلغاء فاتورة ' || v_sale.invoice_no, v_actor.id);
  end loop;

  -- عكس حساب العميل
  if v_sale.customer_id is not null then
    perform app.customer_ledger_add(v_sale.customer_id, 'void', 'sales', p_sale_id,
      v_sale.paid, v_sale.total, now(), 'إلغاء فاتورة ' || v_sale.invoice_no, v_actor.id);
  end if;

  -- رد المبلغ المقبوض
  if v_sale.paid > 0 then
    perform app.cash_add('refund', 'out', v_sale.paid, coalesce(v_sale.payment_method, 'cash'),
      'sales', p_sale_id, now(), 'رد مبلغ - إلغاء فاتورة ' || v_sale.invoice_no, v_actor.id);
  end if;

  -- إلغاء السندات المرتبطة
  update public.payments set status = 'void', voided_at = now(), voided_by = v_actor.id,
    void_reason = 'إلغاء فاتورة ' || v_sale.invoice_no
  where sale_id = p_sale_id and status = 'completed';

  update public.sales set status = 'void', voided_at = now(), voided_by = v_actor.id, void_reason = trim(p_reason)
  where id = p_sale_id;

  perform app.notify_once(null, 'sale_void', 'warning', 'تم إلغاء فاتورة ' || v_sale.invoice_no,
    'القيمة ' || v_sale.total || ' د.أ — السبب: ' || trim(p_reason), 'sales', p_sale_id::text);

  perform app.audit(v_actor.id, 'sale.void', 'sales', p_sale_id::text,
    jsonb_build_object('status', 'completed', 'invoice_no', v_sale.invoice_no, 'total', v_sale.total, 'paid', v_sale.paid),
    jsonb_build_object('status', 'void', 'reason', trim(p_reason)), p_ip);

  return jsonb_build_object('ok', true, 'invoice_no', v_sale.invoice_no);
end;
$$;

-- ---------------------------------------------------------------------
-- void_purchase: إلغاء فاتورة مشتريات
-- ---------------------------------------------------------------------
create or replace function public.void_purchase(p_purchase_id uuid, p_reason text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_purchase public.purchases;
  v_item public.purchase_items;
  v_allow_negative boolean := app.setting_bool('inventory', 'allow_negative_stock', false);
  v_stock int;
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  if coalesce(trim(p_reason), '') = '' then
    perform app.err('REASON_REQUIRED', 'سبب الإلغاء مطلوب.');
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if v_purchase.id is null then
    perform app.err('PURCHASE_NOT_FOUND', 'الفاتورة غير موجودة.');
  end if;
  if v_purchase.status <> 'completed' then
    perform app.err('ALREADY_VOID', 'الفاتورة ملغاة مسبقًا.');
  end if;

  perform 1 from public.products
    where id in (select product_id from public.purchase_items where purchase_id = p_purchase_id)
    order by id for update;

  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id loop
    if not v_allow_negative then
      select stock_units into v_stock from public.products where id = v_item.product_id;
      if v_stock < v_item.qty_units then
        perform app.err('INSUFFICIENT_STOCK_VOID',
          'لا يمكن الإلغاء: كمية "' || v_item.product_name || '" في المخزون أقل من كمية الفاتورة (تم بيع جزء منها).',
          jsonb_build_object('product_name', v_item.product_name, 'available_units', v_stock, 'needed_units', v_item.qty_units));
      end if;
    end if;
    perform app.remove_stock_at_cost(v_item.product_id, 'purchase_void', v_item.qty_units, v_item.cost_per_unit,
      'purchases', p_purchase_id, 'إلغاء مشتريات ' || v_purchase.invoice_no, v_actor.id);
  end loop;

  perform app.supplier_ledger_add(v_purchase.supplier_id, 'void', 'purchases', p_purchase_id,
    v_purchase.total, v_purchase.paid, now(), 'إلغاء مشتريات ' || v_purchase.invoice_no, v_actor.id);

  if v_purchase.paid > 0 then
    perform app.cash_add('refund', 'in', v_purchase.paid, 'cash',
      'purchases', p_purchase_id, now(), 'استرداد مبلغ - إلغاء مشتريات ' || v_purchase.invoice_no, v_actor.id);
  end if;

  update public.payments set status = 'void', voided_at = now(), voided_by = v_actor.id,
    void_reason = 'إلغاء مشتريات ' || v_purchase.invoice_no
  where purchase_id = p_purchase_id and status = 'completed';

  update public.purchases set status = 'void', voided_at = now(), voided_by = v_actor.id, void_reason = trim(p_reason)
  where id = p_purchase_id;

  perform app.audit(v_actor.id, 'purchase.void', 'purchases', p_purchase_id::text,
    jsonb_build_object('status', 'completed', 'invoice_no', v_purchase.invoice_no, 'total', v_purchase.total),
    jsonb_build_object('status', 'void', 'reason', trim(p_reason)), p_ip);

  return jsonb_build_object('ok', true, 'invoice_no', v_purchase.invoice_no);
end;
$$;

-- ---------------------------------------------------------------------
-- void_payment: إلغاء سند قبض/صرف
-- ---------------------------------------------------------------------
create or replace function public.void_payment(p_payment_id uuid, p_reason text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_payment public.payments;
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  if coalesce(trim(p_reason), '') = '' then
    perform app.err('REASON_REQUIRED', 'سبب الإلغاء مطلوب.');
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    perform app.err('PAYMENT_NOT_FOUND', 'السند غير موجود.');
  end if;
  if v_payment.status <> 'completed' then
    perform app.err('ALREADY_VOID', 'السند ملغى مسبقًا.');
  end if;

  if v_payment.party_type = 'customer' then
    perform app.customer_ledger_add(v_payment.customer_id, 'void', 'payments', p_payment_id,
      v_payment.amount, 0, now(), 'إلغاء سند ' || v_payment.payment_no, v_actor.id);
    if v_payment.sale_id is not null then
      update public.sales set paid = round(paid - v_payment.amount, 3)
      where id = v_payment.sale_id and paid >= v_payment.amount;
    end if;
    perform app.cash_add('adjustment', 'out', v_payment.amount, v_payment.method,
      'payments', p_payment_id, now(), 'عكس قبض - إلغاء سند ' || v_payment.payment_no, v_actor.id);
  else
    perform app.supplier_ledger_add(v_payment.supplier_id, 'void', 'payments', p_payment_id,
      0, v_payment.amount, now(), 'إلغاء سند ' || v_payment.payment_no, v_actor.id);
    if v_payment.purchase_id is not null then
      update public.purchases set paid = round(paid - v_payment.amount, 3)
      where id = v_payment.purchase_id and paid >= v_payment.amount;
    end if;
    perform app.cash_add('adjustment', 'in', v_payment.amount, v_payment.method,
      'payments', p_payment_id, now(), 'عكس صرف - إلغاء سند ' || v_payment.payment_no, v_actor.id);
  end if;

  update public.payments set status = 'void', voided_at = now(), voided_by = v_actor.id, void_reason = trim(p_reason)
  where id = p_payment_id;

  perform app.audit(v_actor.id, 'payment.void', 'payments', p_payment_id::text,
    jsonb_build_object('status', 'completed', 'payment_no', v_payment.payment_no, 'amount', v_payment.amount),
    jsonb_build_object('status', 'void', 'reason', trim(p_reason)), p_ip);

  return jsonb_build_object('ok', true, 'payment_no', v_payment.payment_no);
end;
$$;

-- ---------------------------------------------------------------------
-- void_return: إلغاء مرتجع
-- ---------------------------------------------------------------------
create or replace function public.void_return(p_return_id uuid, p_reason text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_return public.returns;
  v_item public.return_items;
  v_allow_negative boolean := app.setting_bool('inventory', 'allow_negative_stock', false);
  v_stock int;
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  if coalesce(trim(p_reason), '') = '' then
    perform app.err('REASON_REQUIRED', 'سبب الإلغاء مطلوب.');
  end if;

  select * into v_return from public.returns where id = p_return_id for update;
  if v_return.id is null then
    perform app.err('RETURN_NOT_FOUND', 'المرتجع غير موجود.');
  end if;
  if v_return.status <> 'completed' then
    perform app.err('ALREADY_VOID', 'المرتجع ملغى مسبقًا.');
  end if;

  perform 1 from public.products
    where id in (select product_id from public.return_items where return_id = p_return_id)
    order by id for update;

  for v_item in select * from public.return_items where return_id = p_return_id loop
    if v_item.condition = 'good' then
      if not v_allow_negative then
        select stock_units into v_stock from public.products where id = v_item.product_id;
        if v_stock < v_item.qty_units then
          perform app.err('INSUFFICIENT_STOCK_VOID',
            'لا يمكن الإلغاء: كمية "' || v_item.product_name || '" غير متوفرة في المخزون.',
            jsonb_build_object('product_name', v_item.product_name));
        end if;
      end if;
      perform app.remove_stock_at_cost(v_item.product_id, 'return_void', v_item.qty_units, v_item.unit_cost,
        'returns', p_return_id, 'إلغاء مرتجع ' || v_return.return_no, v_actor.id);
    end if;
  end loop;

  if v_return.customer_id is not null and (v_return.total - v_return.refund_cash) > 0 then
    perform app.customer_ledger_add(v_return.customer_id, 'void', 'returns', p_return_id,
      round(v_return.total - v_return.refund_cash, 3), 0, now(), 'إلغاء مرتجع ' || v_return.return_no, v_actor.id);
  end if;

  if v_return.refund_cash > 0 then
    perform app.cash_add('refund', 'in', v_return.refund_cash, coalesce(v_return.refund_method, 'cash'),
      'returns', p_return_id, now(), 'استرداد - إلغاء مرتجع ' || v_return.return_no, v_actor.id);
  end if;

  update public.returns set status = 'void', voided_at = now(), voided_by = v_actor.id, void_reason = trim(p_reason)
  where id = p_return_id;

  perform app.audit(v_actor.id, 'return.void', 'returns', p_return_id::text,
    jsonb_build_object('status', 'completed', 'return_no', v_return.return_no, 'total', v_return.total),
    jsonb_build_object('status', 'void', 'reason', trim(p_reason)), p_ip);

  return jsonb_build_object('ok', true, 'return_no', v_return.return_no);
end;
$$;

-- ---------------------------------------------------------------------
-- void_expense: إلغاء مصروف
-- ---------------------------------------------------------------------
create or replace function public.void_expense(p_expense_id uuid, p_reason text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_expense public.expenses;
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  if coalesce(trim(p_reason), '') = '' then
    perform app.err('REASON_REQUIRED', 'سبب الإلغاء مطلوب.');
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if v_expense.id is null then
    perform app.err('EXPENSE_NOT_FOUND', 'المصروف غير موجود.');
  end if;
  if v_expense.status <> 'completed' then
    perform app.err('ALREADY_VOID', 'المصروف ملغى مسبقًا.');
  end if;

  perform app.cash_add('adjustment', 'in', v_expense.amount, v_expense.method,
    'expenses', p_expense_id, now(), 'عكس مصروف - إلغاء ' || v_expense.expense_no, v_actor.id);

  update public.expenses set status = 'void', voided_at = now(), voided_by = v_actor.id, void_reason = trim(p_reason)
  where id = p_expense_id;

  perform app.audit(v_actor.id, 'expense.void', 'expenses', p_expense_id::text,
    jsonb_build_object('status', 'completed', 'expense_no', v_expense.expense_no, 'amount', v_expense.amount),
    jsonb_build_object('status', 'void', 'reason', trim(p_reason)), p_ip);

  return jsonb_build_object('ok', true, 'expense_no', v_expense.expense_no);
end;
$$;

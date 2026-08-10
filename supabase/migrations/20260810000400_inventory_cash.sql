-- =====================================================================
-- Migration 4: Inventory adjustments, inventory counts, cash sessions
-- =====================================================================

-- ---------------------------------------------------------------------
-- adjust_stock: تعديل مخزون يدوي مصرّح به (مع سبب إلزامي)
-- payload: { product_id, mode: 'set'|'delta', qty_units, reason, client_ip? }
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_product_id uuid := nullif(p->>'product_id','')::uuid;
  v_mode text := coalesce(p->>'mode', 'set');
  v_qty int := (p->>'qty_units')::int;
  v_reason text := nullif(trim(coalesce(p->>'reason','')), '');
  v_product public.products;
  v_delta int;
  v_new_stock int;
  v_ip text := nullif(p->>'client_ip','');
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  if v_reason is null then
    perform app.err('REASON_REQUIRED', 'سبب التعديل مطلوب.');
  end if;
  if v_qty is null then
    perform app.err('INVALID_QTY', 'الكمية غير صالحة.');
  end if;

  select * into v_product from public.products where id = v_product_id for update;
  if v_product.id is null then
    perform app.err('PRODUCT_NOT_FOUND', 'الصنف غير موجود.');
  end if;

  v_delta := case when v_mode = 'set' then v_qty - v_product.stock_units else v_qty end;
  if v_delta = 0 then
    return jsonb_build_object('ok', true, 'stock_units', v_product.stock_units, 'changed', false);
  end if;

  v_new_stock := app.apply_stock_change(v_product_id, 'adjustment', v_delta,
    case when v_delta > 0 then v_product.avg_unit_cost else null end,
    null, null, v_reason, v_actor.id);

  perform app.audit(v_actor.id, 'stock.adjust', 'products', v_product_id::text,
    jsonb_build_object('stock_units', v_product.stock_units),
    jsonb_build_object('stock_units', v_new_stock, 'delta', v_delta, 'reason', v_reason), v_ip);

  return jsonb_build_object('ok', true, 'stock_units', v_new_stock, 'changed', true, 'delta', v_delta);
end;
$$;

-- ---------------------------------------------------------------------
-- start_inventory_count: فتح جلسة جرد (يمنع أكثر من جلسة مفتوحة)
-- payload: { count_type: 'daily'|'monthly'|'manual', category_id?, notes?, client_ip? }
-- ---------------------------------------------------------------------
create or replace function public.start_inventory_count(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_type public.count_type := coalesce(nullif(p->>'count_type','')::public.count_type, 'manual');
  v_category_id uuid := nullif(p->>'category_id','')::uuid;
  v_open_no text;
  v_count_id uuid := gen_random_uuid();
  v_count_no text;
  v_items int;
  v_ip text := nullif(p->>'client_ip','');
begin
  v_actor := app.require_staff(array['owner','manager','warehouse']::public.user_role[]);

  select count_no into v_open_no from public.inventory_counts where status = 'open' limit 1;
  if v_open_no is not null then
    perform app.err('COUNT_OPEN_EXISTS', 'توجد جلسة جرد مفتوحة (' || v_open_no || '). أغلقها أو ألغِها أولًا.');
  end if;

  v_count_no := app.next_doc_no('count', app.setting_text('invoice', 'count_prefix', 'CNT'));

  insert into public.inventory_counts (id, count_no, count_type, status, category_id, notes, created_by)
  values (v_count_id, v_count_no, v_type, 'open', v_category_id, nullif(p->>'notes',''), v_actor.id);

  insert into public.inventory_count_items (count_id, product_id, product_name, barcode, expected_units, unit_cost)
  select v_count_id, pr.id, pr.name, pr.barcode, pr.stock_units, pr.avg_unit_cost
  from public.products pr
  where pr.is_active and (v_category_id is null or pr.category_id = v_category_id)
  order by pr.name;

  get diagnostics v_items = row_count;
  update public.inventory_counts set items_total = v_items where id = v_count_id;

  perform app.audit(v_actor.id, 'count.start', 'inventory_counts', v_count_id::text, null,
    jsonb_build_object('count_no', v_count_no, 'count_type', v_type, 'items', v_items), v_ip);

  return jsonb_build_object('id', v_count_id, 'count_no', v_count_no, 'items_total', v_items);
end;
$$;

-- ---------------------------------------------------------------------
-- set_count_item: تسجيل الكمية الفعلية لصنف داخل الجرد
-- ---------------------------------------------------------------------
create or replace function public.set_count_item(p_count_id uuid, p_product_id uuid, p_actual integer)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_status public.count_status;
  v_item public.inventory_count_items;
begin
  v_actor := app.require_staff(array['owner','manager','warehouse']::public.user_role[]);

  select status into v_status from public.inventory_counts where id = p_count_id;
  if v_status is null then
    perform app.err('COUNT_NOT_FOUND', 'جلسة الجرد غير موجودة.');
  end if;
  if v_status <> 'open' then
    perform app.err('COUNT_NOT_OPEN', 'جلسة الجرد ليست مفتوحة.');
  end if;
  if p_actual is not null and p_actual < 0 then
    perform app.err('INVALID_QTY', 'الكمية الفعلية غير صالحة.');
  end if;

  update public.inventory_count_items set
    actual_units = p_actual,
    diff_units = case when p_actual is null then null else p_actual - expected_units end,
    diff_value = case when p_actual is null then null else round((p_actual - expected_units) * unit_cost, 3) end,
    counted_at = case when p_actual is null then null else now() end
  where count_id = p_count_id and product_id = p_product_id
  returning * into v_item;

  if v_item.id is null then
    perform app.err('COUNT_ITEM_NOT_FOUND', 'الصنف غير موجود في هذه الجلسة.');
  end if;

  update public.inventory_counts set
    counted_items = (select count(*) from public.inventory_count_items where count_id = p_count_id and actual_units is not null)
  where id = p_count_id;

  return jsonb_build_object(
    'product_id', v_item.product_id,
    'expected_units', v_item.expected_units,
    'actual_units', v_item.actual_units,
    'diff_units', v_item.diff_units,
    'diff_value', v_item.diff_value
  );
end;
$$;

-- ---------------------------------------------------------------------
-- complete_inventory_count: اعتماد الجرد وتطبيق التسويات
-- الفرق النهائي يُحسب مقابل المخزون الحي لحظة الاعتماد (وليس لقطة البداية)
-- ---------------------------------------------------------------------
create or replace function public.complete_inventory_count(p_count_id uuid, p_apply boolean default true, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_count public.inventory_counts;
  v_item record;
  v_live int;
  v_avg numeric(14,6);
  v_final_diff int;
  v_total_diff_units int := 0;
  v_total_diff_value numeric(14,3) := 0;
  v_adjusted int := 0;
begin
  v_actor := app.require_staff(array['owner','manager']::public.user_role[]);

  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if v_count.id is null then
    perform app.err('COUNT_NOT_FOUND', 'جلسة الجرد غير موجودة.');
  end if;
  if v_count.status <> 'open' then
    perform app.err('COUNT_NOT_OPEN', 'جلسة الجرد ليست مفتوحة.');
  end if;

  perform 1 from public.products
    where id in (select product_id from public.inventory_count_items where count_id = p_count_id and actual_units is not null)
    order by id for update;

  for v_item in
    select * from public.inventory_count_items
    where count_id = p_count_id and actual_units is not null
  loop
    select stock_units, avg_unit_cost into v_live, v_avg from public.products where id = v_item.product_id;
    v_final_diff := v_item.actual_units - v_live;

    update public.inventory_count_items set
      diff_units = v_final_diff,
      unit_cost = v_avg,
      diff_value = round(v_final_diff * v_avg, 3)
    where id = v_item.id;

    if v_final_diff <> 0 then
      if p_apply then
        perform app.apply_stock_change(v_item.product_id, 'count_adjustment', v_final_diff,
          case when v_final_diff > 0 then v_avg else null end,
          'inventory_counts', p_count_id, 'تسوية جرد ' || v_count.count_no, v_actor.id);
        v_adjusted := v_adjusted + 1;
      end if;
      v_total_diff_units := v_total_diff_units + v_final_diff;
      v_total_diff_value := round(v_total_diff_value + round(v_final_diff * v_avg, 3), 3);
    end if;
  end loop;

  update public.inventory_counts set
    status = 'completed',
    completed_at = now(),
    completed_by = v_actor.id,
    total_diff_units = v_total_diff_units,
    total_diff_value = v_total_diff_value
  where id = p_count_id;

  if v_total_diff_units <> 0 then
    perform app.notify_once(null, 'count_diff', 'warning',
      'فرق جرد في ' || v_count.count_no,
      'إجمالي الفرق ' || v_total_diff_units || ' حبة بقيمة ' || v_total_diff_value || ' د.أ' ||
        case when p_apply then ' (تم تطبيق التسوية)' else ' (بدون تسوية)' end,
      'inventory_counts', p_count_id::text);
  end if;

  perform app.audit(v_actor.id, 'count.complete', 'inventory_counts', p_count_id::text, null,
    jsonb_build_object('count_no', v_count.count_no, 'applied', p_apply,
      'total_diff_units', v_total_diff_units, 'total_diff_value', v_total_diff_value,
      'adjusted_products', v_adjusted), p_ip);

  return jsonb_build_object('ok', true, 'count_no', v_count.count_no,
    'total_diff_units', v_total_diff_units, 'total_diff_value', v_total_diff_value,
    'adjusted_products', v_adjusted);
end;
$$;

-- ---------------------------------------------------------------------
-- cancel_inventory_count
-- ---------------------------------------------------------------------
create or replace function public.cancel_inventory_count(p_count_id uuid, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_count public.inventory_counts;
begin
  v_actor := app.require_staff(array['owner','manager','warehouse']::public.user_role[]);

  select * into v_count from public.inventory_counts where id = p_count_id for update;
  if v_count.id is null then
    perform app.err('COUNT_NOT_FOUND', 'جلسة الجرد غير موجودة.');
  end if;
  if v_count.status <> 'open' then
    perform app.err('COUNT_NOT_OPEN', 'جلسة الجرد ليست مفتوحة.');
  end if;

  update public.inventory_counts set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor.id
  where id = p_count_id;

  perform app.audit(v_actor.id, 'count.cancel', 'inventory_counts', p_count_id::text, null,
    jsonb_build_object('count_no', v_count.count_no), p_ip);

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- close_cash_session: إغلاق الصندوق اليومي
-- payload: { session_date?, actual_cash, notes?, client_ip? }
-- expected = رصيد آخر إغلاق (أو الرصيد الافتتاحي) + النقد الداخل - النقد الخارج
-- منذ آخر إغلاق وحتى نهاية يوم الجلسة (بتوقيت عمّان)
-- ---------------------------------------------------------------------
create or replace function public.close_cash_session(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app, extensions
as $$
declare
  v_actor public.profiles;
  v_date date := coalesce(nullif(p->>'session_date','')::date, app.today_local());
  v_actual numeric := round(coalesce(nullif(p->>'actual_cash','')::numeric, 0), 3);
  v_prev public.cash_sessions;
  v_opening numeric(14,3);
  v_from timestamptz;
  v_to timestamptz := app.day_end(v_date);
  v_in numeric(14,3);
  v_out numeric(14,3);
  v_expected numeric(14,3);
  v_diff numeric(14,3);
  v_session_id uuid := gen_random_uuid();
  v_ip text := nullif(p->>'client_ip','');
begin
  v_actor := app.require_staff(array['owner','manager','accountant']::public.user_role[]);

  if exists(select 1 from public.cash_sessions where session_date = v_date) then
    perform app.err('SESSION_EXISTS', 'تم إغلاق الصندوق لهذا اليوم مسبقًا.');
  end if;
  if v_actual < 0 then
    perform app.err('INVALID_AMOUNT', 'المبلغ الفعلي غير صالح.');
  end if;

  select * into v_prev from public.cash_sessions
  where session_date < v_date order by session_date desc limit 1;

  if v_prev.id is not null then
    v_opening := v_prev.actual_cash;
    v_from := app.day_end(v_prev.session_date);
  else
    v_opening := app.setting_num('cashbox', 'opening_balance', 0);
    v_from := '-infinity'::timestamptz;
  end if;

  select
    coalesce(sum(amount) filter (where direction = 'in'), 0),
    coalesce(sum(amount) filter (where direction = 'out'), 0)
  into v_in, v_out
  from public.cash_transactions
  where method = 'cash' and tx_date >= v_from and tx_date < v_to;

  v_expected := round(v_opening + v_in - v_out, 3);
  v_diff := round(v_actual - v_expected, 3);

  insert into public.cash_sessions (id, session_date, opening_balance, cash_in, cash_out, expected_cash, actual_cash, difference, status, notes, closed_by)
  values (v_session_id, v_date, v_opening, v_in, v_out, v_expected, v_actual, v_diff, 'closed',
    nullif(p->>'notes',''), v_actor.id);

  if v_diff <> 0 then
    perform app.notify_once(null, 'cash_diff',
      case when abs(v_diff) >= 10 then 'critical'::public.notif_severity else 'warning'::public.notif_severity end,
      'فرق في إغلاق الصندوق ' || to_char(v_date, 'YYYY-MM-DD'),
      'المتوقع ' || v_expected || ' د.أ، الفعلي ' || v_actual || ' د.أ، الفرق ' || v_diff || ' د.أ.',
      'cash_sessions', v_session_id::text);
  end if;

  perform app.audit(v_actor.id, 'cash.close_session', 'cash_sessions', v_session_id::text, null,
    jsonb_build_object('session_date', v_date, 'expected', v_expected, 'actual', v_actual, 'difference', v_diff), v_ip);

  return jsonb_build_object(
    'id', v_session_id, 'session_date', v_date,
    'opening_balance', v_opening, 'cash_in', v_in, 'cash_out', v_out,
    'expected_cash', v_expected, 'actual_cash', v_actual, 'difference', v_diff
  );
end;
$$;

-- ---------------------------------------------------------------------
-- cash_balance: الرصيد النقدي المتوقع حاليًا في الصندوق
-- ---------------------------------------------------------------------
create or replace function public.cash_balance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app, extensions
as $$
declare
  v_prev public.cash_sessions;
  v_opening numeric(14,3);
  v_from timestamptz;
  v_in numeric(14,3);
  v_out numeric(14,3);
begin
  perform app.require_staff(null);

  select * into v_prev from public.cash_sessions order by session_date desc limit 1;
  if v_prev.id is not null then
    v_opening := v_prev.actual_cash;
    v_from := app.day_end(v_prev.session_date);
  else
    v_opening := app.setting_num('cashbox', 'opening_balance', 0);
    v_from := '-infinity'::timestamptz;
  end if;

  select
    coalesce(sum(amount) filter (where direction = 'in'), 0),
    coalesce(sum(amount) filter (where direction = 'out'), 0)
  into v_in, v_out
  from public.cash_transactions
  where method = 'cash' and tx_date >= v_from;

  return jsonb_build_object(
    'opening', v_opening,
    'cash_in', v_in,
    'cash_out', v_out,
    'balance', round(v_opening + v_in - v_out, 3),
    'since', v_from,
    'last_session_date', v_prev.session_date
  );
end;
$$;

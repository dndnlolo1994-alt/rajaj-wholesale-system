-- =====================================================================
-- Migration 2: Internal helper functions (schema "app")
-- These are NOT exposed through the API. Public RPCs call them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Errors: message = machine code, detail = Arabic human message, hint = meta json
-- ---------------------------------------------------------------------
create or replace function app.err(p_code text, p_message_ar text, p_meta jsonb default null)
returns void
language plpgsql
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = p_code,
    detail = p_message_ar,
    hint = coalesce(p_meta::text, '');
end;
$$;

-- ---------------------------------------------------------------------
-- Current profile / role assertions
-- ---------------------------------------------------------------------
create or replace function app.current_profile()
returns public.profiles
language plpgsql
stable
as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = auth.uid();
  return v;
end;
$$;

create or replace function app.require_staff(p_roles public.user_role[] default null)
returns public.profiles
language plpgsql
as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = auth.uid();
  if v.id is null then
    perform app.err('AUTH_NO_PROFILE', 'لا يوجد ملف مستخدم مرتبط بهذا الحساب.');
  end if;
  if not v.is_active then
    perform app.err('AUTH_INACTIVE', 'هذا الحساب موقوف. تواصل مع مدير النظام.');
  end if;
  if p_roles is not null and not (v.role = any (p_roles)) then
    perform app.err('AUTH_FORBIDDEN', 'ليست لديك صلاحية لتنفيذ هذه العملية.');
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- Settings access
-- ---------------------------------------------------------------------
create or replace function app.setting(p_key text)
returns jsonb
language sql
stable
as $$
  select value from public.app_settings where key = p_key;
$$;

create or replace function app.setting_bool(p_key text, p_path text, p_default boolean)
returns boolean
language sql
stable
as $$
  select coalesce((app.setting(p_key) ->> p_path)::boolean, p_default);
$$;

create or replace function app.setting_num(p_key text, p_path text, p_default numeric)
returns numeric
language sql
stable
as $$
  select coalesce((app.setting(p_key) ->> p_path)::numeric, p_default);
$$;

create or replace function app.setting_text(p_key text, p_path text, p_default text)
returns text
language sql
stable
as $$
  select coalesce(app.setting(p_key) ->> p_path, p_default);
$$;

-- ---------------------------------------------------------------------
-- Timezone helpers (Asia/Amman)
-- ---------------------------------------------------------------------
create or replace function app.tz()
returns text
language sql
stable
as $$
  select coalesce(app.setting('general') ->> 'timezone', 'Asia/Amman');
$$;

create or replace function app.today_local()
returns date
language sql
stable
as $$
  select (now() at time zone app.tz())::date;
$$;

create or replace function app.day_start(p_day date)
returns timestamptz
language sql
stable
as $$
  select (p_day::text || ' 00:00:00')::timestamp at time zone app.tz();
$$;

create or replace function app.day_end(p_day date)
returns timestamptz
language sql
stable
as $$
  select app.day_start(p_day + 1);
$$;

-- ---------------------------------------------------------------------
-- Money helpers: fils = integer thousandths of a dinar
-- ---------------------------------------------------------------------
create or replace function app.to_fils(p numeric)
returns bigint
language sql
immutable
as $$
  select (round(coalesce(p, 0), 3) * 1000)::bigint;
$$;

create or replace function app.from_fils(p bigint)
returns numeric
language sql
immutable
as $$
  select round(coalesce(p, 0)::numeric / 1000, 3);
$$;

-- ---------------------------------------------------------------------
-- Document numbering (atomic, per kind per local year)
-- ---------------------------------------------------------------------
create or replace function app.next_doc_no(p_kind text, p_prefix text)
returns text
language plpgsql
as $$
declare
  v_year text := to_char(now() at time zone app.tz(), 'YYYY');
  v_key text := p_kind || ':' || v_year;
  v_n bigint;
begin
  insert into public.counters as c (key, value) values (v_key, 1)
  on conflict (key) do update set value = c.value + 1
  returning value into v_n;
  return p_prefix || '-' || v_year || '-' || lpad(v_n::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------
create or replace function app.audit(
  p_actor uuid,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip text default null
)
returns void
language plpgsql
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = p_actor;
  insert into public.audit_logs (user_id, user_name, action, entity, entity_id, before_data, after_data, ip)
  values (p_actor, v_name, p_action, p_entity, p_entity_id, p_before, p_after, p_ip);
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications with dedupe (one open notification per key)
-- ---------------------------------------------------------------------
create or replace function app.notify_once(
  p_dedupe_key text,
  p_type text,
  p_severity public.notif_severity,
  p_title text,
  p_body text default null,
  p_ref_table text default null,
  p_ref_id text default null
)
returns void
language plpgsql
as $$
begin
  insert into public.notifications (type, severity, title, body, ref_table, ref_id, dedupe_key)
  values (p_type, p_severity, p_title, p_body, p_ref_table, p_ref_id, p_dedupe_key)
  on conflict (dedupe_key) where is_read = false and dedupe_key is not null
  do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Customer / supplier ledger entries (lock party row, maintain balance)
-- Customer balance: positive = العميل مدين لنا. debit يزيده، credit ينقصه.
-- Supplier balance: positive = نحن مدينون للمورد. credit يزيده، debit ينقصه.
-- ---------------------------------------------------------------------
create or replace function app.customer_ledger_add(
  p_customer_id uuid,
  p_entry_type public.ledger_entry_type,
  p_ref_table text,
  p_ref_id uuid,
  p_debit numeric,
  p_credit numeric,
  p_entry_date timestamptz,
  p_notes text,
  p_actor uuid
)
returns numeric
language plpgsql
as $$
declare
  v_balance numeric(14,3);
begin
  select balance into v_balance from public.customers where id = p_customer_id for update;
  if v_balance is null then
    perform app.err('CUSTOMER_NOT_FOUND', 'العميل غير موجود.');
  end if;
  v_balance := round(v_balance + round(coalesce(p_debit,0),3) - round(coalesce(p_credit,0),3), 3);
  update public.customers set balance = v_balance where id = p_customer_id;
  insert into public.customer_ledger (customer_id, entry_type, ref_table, ref_id, debit, credit, balance_after, entry_date, notes, created_by)
  values (p_customer_id, p_entry_type, p_ref_table, p_ref_id, round(coalesce(p_debit,0),3), round(coalesce(p_credit,0),3), v_balance, coalesce(p_entry_date, now()), p_notes, p_actor);
  return v_balance;
end;
$$;

create or replace function app.supplier_ledger_add(
  p_supplier_id uuid,
  p_entry_type public.ledger_entry_type,
  p_ref_table text,
  p_ref_id uuid,
  p_debit numeric,
  p_credit numeric,
  p_entry_date timestamptz,
  p_notes text,
  p_actor uuid
)
returns numeric
language plpgsql
as $$
declare
  v_balance numeric(14,3);
begin
  select balance into v_balance from public.suppliers where id = p_supplier_id for update;
  if v_balance is null then
    perform app.err('SUPPLIER_NOT_FOUND', 'المورد غير موجود.');
  end if;
  v_balance := round(v_balance + round(coalesce(p_credit,0),3) - round(coalesce(p_debit,0),3), 3);
  update public.suppliers set balance = v_balance where id = p_supplier_id;
  insert into public.supplier_ledger (supplier_id, entry_type, ref_table, ref_id, debit, credit, balance_after, entry_date, notes, created_by)
  values (p_supplier_id, p_entry_type, p_ref_table, p_ref_id, round(coalesce(p_debit,0),3), round(coalesce(p_credit,0),3), v_balance, coalesce(p_entry_date, now()), p_notes, p_actor);
  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------
-- Cash flow entry
-- ---------------------------------------------------------------------
create or replace function app.cash_add(
  p_tx_type public.cash_tx_type,
  p_direction public.cash_direction,
  p_amount numeric,
  p_method public.payment_method,
  p_ref_table text,
  p_ref_id uuid,
  p_tx_date timestamptz,
  p_notes text,
  p_actor uuid
)
returns void
language plpgsql
as $$
begin
  if round(coalesce(p_amount, 0), 3) <= 0 then
    return;
  end if;
  insert into public.cash_transactions (tx_type, direction, amount, method, ref_table, ref_id, tx_date, notes, created_by)
  values (p_tx_type, p_direction, round(p_amount, 3), coalesce(p_method, 'cash'), p_ref_table, p_ref_id, coalesce(p_tx_date, now()), p_notes, p_actor);
end;
$$;

-- ---------------------------------------------------------------------
-- Stock movement + weighted average cost maintenance
-- The caller MUST hold a row lock on the product (select ... for update).
-- p_recost_unit_cost: when adding stock (purchase / restock return / void),
-- the unit cost (per piece) at which the added quantity enters the WAC pool.
-- Removals never change the average cost.
-- ---------------------------------------------------------------------
create or replace function app.apply_stock_change(
  p_product_id uuid,
  p_move_type public.stock_move_type,
  p_qty_change integer,
  p_recost_unit_cost numeric,
  p_ref_table text,
  p_ref_id uuid,
  p_notes text,
  p_actor uuid
)
returns integer
language plpgsql
as $$
declare
  v_stock integer;
  v_avg numeric(14,6);
  v_new_stock integer;
  v_new_avg numeric(14,6);
  v_min integer;
  v_name text;
begin
  select stock_units, avg_unit_cost, min_stock_units, name
    into v_stock, v_avg, v_min, v_name
    from public.products where id = p_product_id;
  if v_stock is null then
    perform app.err('PRODUCT_NOT_FOUND', 'الصنف غير موجود.');
  end if;

  v_new_stock := v_stock + p_qty_change;
  v_new_avg := v_avg;

  if p_qty_change > 0 and p_recost_unit_cost is not null then
    if v_stock <= 0 then
      v_new_avg := round(p_recost_unit_cost, 6);
    else
      v_new_avg := round(
        ((v_stock::numeric * v_avg) + (p_qty_change::numeric * p_recost_unit_cost)) / v_new_stock::numeric,
        6
      );
    end if;
  end if;

  update public.products
     set stock_units = v_new_stock,
         avg_unit_cost = v_new_avg
   where id = p_product_id;

  insert into public.stock_movements (product_id, move_type, qty_change, balance_after, unit_cost, ref_table, ref_id, notes, created_by)
  values (p_product_id, p_move_type, p_qty_change, v_new_stock,
          coalesce(p_recost_unit_cost, v_avg), p_ref_table, p_ref_id, p_notes, p_actor);

  if v_new_stock <= v_min then
    perform app.notify_once(
      'low_stock:' || p_product_id::text,
      'low_stock', 'warning',
      'مخزون منخفض: ' || v_name,
      'الكمية الحالية ' || v_new_stock || ' حبة (الحد الأدنى ' || v_min || ' حبة).',
      'products', p_product_id::text
    );
  end if;

  return v_new_stock;
end;
$$;

-- ---------------------------------------------------------------------
-- Removal of stock WAC reversal (used when voiding purchases):
-- removes quantity from the WAC pool at a specific cost.
-- ---------------------------------------------------------------------
create or replace function app.remove_stock_at_cost(
  p_product_id uuid,
  p_move_type public.stock_move_type,
  p_qty integer,
  p_unit_cost numeric,
  p_ref_table text,
  p_ref_id uuid,
  p_notes text,
  p_actor uuid
)
returns integer
language plpgsql
as $$
declare
  v_stock integer;
  v_avg numeric(14,6);
  v_new_stock integer;
  v_new_avg numeric(14,6);
begin
  select stock_units, avg_unit_cost into v_stock, v_avg
    from public.products where id = p_product_id;
  if v_stock is null then
    perform app.err('PRODUCT_NOT_FOUND', 'الصنف غير موجود.');
  end if;

  v_new_stock := v_stock - p_qty;
  if v_new_stock > 0 then
    v_new_avg := round(((v_stock::numeric * v_avg) - (p_qty::numeric * p_unit_cost)) / v_new_stock::numeric, 6);
    if v_new_avg < 0 then
      v_new_avg := v_avg;
    end if;
  else
    v_new_avg := v_avg;
  end if;

  update public.products
     set stock_units = v_new_stock,
         avg_unit_cost = v_new_avg
   where id = p_product_id;

  insert into public.stock_movements (product_id, move_type, qty_change, balance_after, unit_cost, ref_table, ref_id, notes, created_by)
  values (p_product_id, p_move_type, -p_qty, v_new_stock, p_unit_cost, p_ref_table, p_ref_id, p_notes, p_actor);

  return v_new_stock;
end;
$$;

-- ---------------------------------------------------------------------
-- Largest-remainder allocation of an invoice discount over line nets.
-- Input/output in fils (bigint). Guarantees sum(result) = p_discount.
-- ---------------------------------------------------------------------
create or replace function app.allocate_discount(p_nets bigint[], p_discount bigint)
returns bigint[]
language plpgsql
immutable
as $$
declare
  v_total bigint := 0;
  v_n int := coalesce(array_length(p_nets, 1), 0);
  v_result bigint[] := array[]::bigint[];
  v_floors bigint[] := array[]::bigint[];
  v_rems numeric[] := array[]::numeric[];
  v_assigned bigint := 0;
  v_left bigint;
  i int;
  v_max_rem numeric;
  v_max_i int;
begin
  if v_n = 0 or p_discount <= 0 then
    for i in 1..v_n loop
      v_result := v_result || 0::bigint;
    end loop;
    return v_result;
  end if;

  for i in 1..v_n loop
    v_total := v_total + p_nets[i];
  end loop;

  if v_total <= 0 then
    for i in 1..v_n loop
      v_result := v_result || 0::bigint;
    end loop;
    return v_result;
  end if;

  for i in 1..v_n loop
    v_floors := v_floors || ((p_nets[i] * p_discount) / v_total)::bigint;
    v_rems := v_rems || ((p_nets[i] * p_discount) % v_total)::numeric;
    v_assigned := v_assigned + v_floors[i];
  end loop;

  v_left := p_discount - v_assigned;
  v_result := v_floors;

  while v_left > 0 loop
    v_max_rem := -1;
    v_max_i := 1;
    for i in 1..v_n loop
      if v_rems[i] > v_max_rem then
        v_max_rem := v_rems[i];
        v_max_i := i;
      end if;
    end loop;
    v_result[v_max_i] := v_result[v_max_i] + 1;
    v_rems[v_max_i] := -2;
    v_left := v_left - 1;
  end loop;

  return v_result;
end;
$$;

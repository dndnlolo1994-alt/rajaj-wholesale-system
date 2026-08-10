-- =====================================================================
-- Migration 6: Audit triggers on master data + Row Level Security
-- Financial tables are writable ONLY through security-definer RPCs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helper functions (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------
create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active);
$$;

create or replace function app.has_role(p_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = any(p_roles)
  );
$$;

-- ---------------------------------------------------------------------
-- Generic audit trigger for master data (strips volatile stock fields
-- on products so routine stock updates don't spam the audit log —
-- stock history lives in stock_movements).
-- ---------------------------------------------------------------------
create or replace function app.tg_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_entity text := tg_argv[0];
  v_old jsonb;
  v_new jsonb;
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_id := coalesce(v_old->>'id', v_old->>'key');
    perform app.audit(auth.uid(), v_entity || '.delete', tg_table_name, v_id, v_old, null, null);
    return old;
  end if;

  v_new := to_jsonb(new);
  v_id := coalesce(v_new->>'id', v_new->>'key');

  if tg_op = 'INSERT' then
    perform app.audit(auth.uid(), v_entity || '.create', tg_table_name, v_id, null, v_new, null);
    return new;
  end if;

  v_old := to_jsonb(old);
  if tg_table_name = 'products' then
    v_old := v_old - 'stock_units' - 'avg_unit_cost' - 'purchase_price_carton' - 'updated_at';
    v_new := v_new - 'stock_units' - 'avg_unit_cost' - 'purchase_price_carton' - 'updated_at';
  else
    v_old := v_old - 'updated_at';
    v_new := v_new - 'updated_at';
  end if;
  if tg_table_name in ('customers', 'suppliers') then
    v_old := v_old - 'balance';
    v_new := v_new - 'balance';
  end if;

  if v_old is distinct from v_new then
    perform app.audit(auth.uid(), v_entity || '.update', tg_table_name, v_id, v_old, v_new, null);
  end if;
  return new;
end;
$$;

create trigger audit_products after insert or update or delete on public.products
  for each row execute function app.tg_audit_row('product');
create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function app.tg_audit_row('customer');
create trigger audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function app.tg_audit_row('supplier');
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function app.tg_audit_row('category');
create trigger audit_customer_prices after insert or update or delete on public.customer_prices
  for each row execute function app.tg_audit_row('customer_price');
create trigger audit_settings after update on public.app_settings
  for each row execute function app.tg_audit_row('setting');
create trigger audit_profiles after update on public.profiles
  for each row execute function app.tg_audit_row('user');

-- ---------------------------------------------------------------------
-- Protect profile role escalation: only owner may change role/is_active
-- ---------------------------------------------------------------------
create or replace function app.tg_protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not app.has_role(array['owner']::public.user_role[]) then
    raise exception using errcode = 'P0001', message = 'AUTH_FORBIDDEN',
      detail = 'فقط المالك يستطيع تغيير الأدوار وتفعيل الحسابات.';
  end if;
  return new;
end;
$$;

create trigger protect_profiles before update on public.profiles
  for each row execute function app.tg_protect_profile();

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.counters enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.customer_prices enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.held_sales enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.payments enable row level security;
alter table public.customer_ledger enable row level security;
alter table public.supplier_ledger enable row level security;
alter table public.stock_movements enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_count_items enable row level security;
alter table public.notes enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.backup_logs enable row level security;

-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------

-- profiles
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or app.is_staff());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or app.has_role(array['owner']::public.user_role[]));
create policy profiles_insert on public.profiles for insert
  with check (app.has_role(array['owner']::public.user_role[]));

-- settings: قراءة للجميع، تعديل للمالك فقط
create policy settings_select on public.app_settings for select using (app.is_staff());
create policy settings_update on public.app_settings for update
  using (app.has_role(array['owner']::public.user_role[]));
create policy settings_insert on public.app_settings for insert
  with check (app.has_role(array['owner']::public.user_role[]));

-- counters: قراءة فقط
create policy counters_select on public.counters for select using (app.is_staff());

-- categories
create policy categories_select on public.categories for select using (app.is_staff());
create policy categories_write on public.categories for insert
  with check (app.has_role(array['owner','manager']::public.user_role[]));
create policy categories_update on public.categories for update
  using (app.has_role(array['owner','manager']::public.user_role[]));
create policy categories_delete on public.categories for delete
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- products
create policy products_select on public.products for select using (app.is_staff());
create policy products_insert on public.products for insert
  with check (app.has_role(array['owner','manager','warehouse']::public.user_role[]));
create policy products_update on public.products for update
  using (app.has_role(array['owner','manager','warehouse']::public.user_role[]));
create policy products_delete on public.products for delete
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- customers (موظف المبيعات يستطيع إضافة عميل جديد من الميدان)
create policy customers_select on public.customers for select using (app.is_staff());
create policy customers_insert on public.customers for insert
  with check (app.has_role(array['owner','manager','sales']::public.user_role[]));
create policy customers_update on public.customers for update
  using (app.has_role(array['owner','manager','sales']::public.user_role[]));
create policy customers_delete on public.customers for delete
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- suppliers
create policy suppliers_select on public.suppliers for select using (app.is_staff());
create policy suppliers_insert on public.suppliers for insert
  with check (app.has_role(array['owner','manager']::public.user_role[]));
create policy suppliers_update on public.suppliers for update
  using (app.has_role(array['owner','manager']::public.user_role[]));
create policy suppliers_delete on public.suppliers for delete
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- customer special prices
create policy customer_prices_select on public.customer_prices for select using (app.is_staff());
create policy customer_prices_insert on public.customer_prices for insert
  with check (app.has_role(array['owner','manager']::public.user_role[]));
create policy customer_prices_update on public.customer_prices for update
  using (app.has_role(array['owner','manager']::public.user_role[]));
create policy customer_prices_delete on public.customer_prices for delete
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- expense categories
create policy expense_categories_select on public.expense_categories for select using (app.is_staff());
create policy expense_categories_insert on public.expense_categories for insert
  with check (app.has_role(array['owner','manager']::public.user_role[]));
create policy expense_categories_update on public.expense_categories for update
  using (app.has_role(array['owner','manager']::public.user_role[]));
create policy expense_categories_delete on public.expense_categories for delete
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- financial documents: SELECT only — all writes via RPCs
create policy sales_select on public.sales for select using (app.is_staff());
create policy sale_items_select on public.sale_items for select using (app.is_staff());
create policy purchases_select on public.purchases for select using (app.is_staff());
create policy purchase_items_select on public.purchase_items for select using (app.is_staff());
create policy payments_select on public.payments for select using (app.is_staff());
create policy customer_ledger_select on public.customer_ledger for select using (app.is_staff());
create policy supplier_ledger_select on public.supplier_ledger for select using (app.is_staff());
create policy stock_movements_select on public.stock_movements for select using (app.is_staff());
create policy returns_select on public.returns for select using (app.is_staff());
create policy return_items_select on public.return_items for select using (app.is_staff());
create policy expenses_select on public.expenses for select using (app.is_staff());
create policy cash_transactions_select on public.cash_transactions for select using (app.is_staff());
create policy cash_sessions_select on public.cash_sessions for select using (app.is_staff());
create policy inventory_counts_select on public.inventory_counts for select using (app.is_staff());
create policy inventory_count_items_select on public.inventory_count_items for select using (app.is_staff());

-- held sales (drafts): صاحبها أو الإدارة
create policy held_sales_select on public.held_sales for select
  using (created_by = auth.uid() or app.has_role(array['owner','manager']::public.user_role[]));
create policy held_sales_insert on public.held_sales for insert
  with check (created_by = auth.uid() and app.is_staff());
create policy held_sales_update on public.held_sales for update
  using (created_by = auth.uid() or app.has_role(array['owner','manager']::public.user_role[]));
create policy held_sales_delete on public.held_sales for delete
  using (created_by = auth.uid() or app.has_role(array['owner','manager']::public.user_role[]));

-- notes (الدفتر اليومي)
create policy notes_select on public.notes for select using (app.is_staff());
create policy notes_insert on public.notes for insert
  with check (created_by = auth.uid() and app.is_staff());
create policy notes_update on public.notes for update
  using (created_by = auth.uid() or app.has_role(array['owner','manager']::public.user_role[]));
create policy notes_delete on public.notes for delete
  using (created_by = auth.uid() or app.has_role(array['owner']::public.user_role[]));

-- notifications
create policy notifications_select on public.notifications for select using (app.is_staff());
create policy notifications_update on public.notifications for update using (app.is_staff());
create policy notifications_delete on public.notifications for delete
  using (app.has_role(array['owner']::public.user_role[]));

-- audit logs: قراءة للمالك والمدير فقط
create policy audit_logs_select on public.audit_logs for select
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- backup logs
create policy backup_logs_select on public.backup_logs for select
  using (app.has_role(array['owner','manager']::public.user_role[]));

-- ---------------------------------------------------------------------
-- Function execution grants
-- app.* is internal: revoked from API roles, EXCEPT the two role-check
-- helpers referenced inside RLS policies (they run with invoker rights).
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema app from public;
revoke execute on all functions in schema app from anon;
revoke execute on all functions in schema app from authenticated;

grant usage on schema app to authenticated;
grant execute on function app.is_staff() to authenticated;
grant execute on function app.has_role(public.user_role[]) to authenticated;

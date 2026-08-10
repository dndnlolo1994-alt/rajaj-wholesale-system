-- =====================================================================
-- نظام رجائي المصري لإدارة التوزيع والجملة
-- Migration 1: Extensions, enum types, tables, constraints, indexes
-- All money: numeric(14,3) JOD (fils precision). Costs: numeric(14,6).
-- Stock quantities are stored in BASE UNITS (pieces) as integers.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------
create type public.user_role as enum ('owner','manager','sales','warehouse','accountant');
create type public.doc_status as enum ('completed','void');
create type public.unit_kind as enum ('carton','piece');
create type public.payment_method as enum ('cash','bank_transfer','wallet','cheque','other');
create type public.party_type as enum ('customer','supplier');
create type public.ledger_entry_type as enum ('opening','sale','purchase','payment','return','adjustment','void');
create type public.stock_move_type as enum ('purchase','sale','sale_return','sale_void','purchase_void','return_void','adjustment','count_adjustment');
create type public.cash_tx_type as enum ('sale_receipt','customer_receipt','supplier_payment','expense','extra_income','owner_withdrawal','deposit','adjustment','refund');
create type public.cash_direction as enum ('in','out');
create type public.item_condition as enum ('good','damaged');
create type public.count_status as enum ('open','completed','cancelled');
create type public.count_type as enum ('daily','monthly','manual');
create type public.session_status as enum ('open','closed');
create type public.notif_severity as enum ('info','warning','critical');
create type public.backup_status as enum ('running','success','failed');
create type public.backup_type as enum ('manual','auto','export');

-- ---------------------------------------------------------------------
-- Users / profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'sales',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Settings & counters
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table public.counters (
  key text primary key,
  value bigint not null default 0
);

-- ---------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text,
  sku text,
  category_id uuid references public.categories (id) on delete set null,
  brand text,
  description text,
  notes text,
  image_url text,
  units_per_carton int not null default 1 check (units_per_carton >= 1),
  stock_units integer not null default 0,
  avg_unit_cost numeric(14,6) not null default 0 check (avg_unit_cost >= 0),
  purchase_price_carton numeric(14,3) not null default 0 check (purchase_price_carton >= 0),
  sale_price_carton numeric(14,3) not null default 0 check (sale_price_carton >= 0),
  sale_price_piece numeric(14,3) not null default 0 check (sale_price_piece >= 0),
  wholesale_price_carton numeric(14,3) check (wholesale_price_carton >= 0),
  wholesale_price_piece numeric(14,3) check (wholesale_price_piece >= 0),
  min_stock_units integer not null default 0 check (min_stock_units >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_barcode_key on public.products (barcode)
  where barcode is not null and barcode <> '';
create index products_name_trgm on public.products using gin (name extensions.gin_trgm_ops);
create index products_category_idx on public.products (category_id);
create index products_active_idx on public.products (is_active);
create index products_low_stock_idx on public.products (id) where stock_units <= min_stock_units;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shop_name text,
  phone text,
  whatsapp text,
  area text,
  address text,
  notes text,
  credit_limit numeric(14,3) check (credit_limit >= 0),
  balance numeric(14,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_trgm on public.customers using gin ((coalesce(name,'') || ' ' || coalesce(shop_name,'')) extensions.gin_trgm_ops);
create index customers_phone_idx on public.customers (phone);
create index customers_balance_idx on public.customers (balance) where balance <> 0;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  phone text,
  whatsapp text,
  area text,
  address text,
  notes text,
  balance numeric(14,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_name_trgm on public.suppliers using gin ((coalesce(name,'') || ' ' || coalesce(company_name,'')) extensions.gin_trgm_ops);
create index suppliers_balance_idx on public.suppliers (balance) where balance <> 0;

-- أسعار خاصة لعميل معيّن على صنف معيّن
create table public.customer_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  unit public.unit_kind not null,
  price numeric(14,3) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, product_id, unit)
);

-- ---------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  customer_id uuid references public.customers (id) on delete restrict,
  status public.doc_status not null default 'completed',
  sale_date timestamptz not null default now(),
  subtotal numeric(14,3) not null default 0 check (subtotal >= 0),
  line_discount_total numeric(14,3) not null default 0 check (line_discount_total >= 0),
  invoice_discount numeric(14,3) not null default 0 check (invoice_discount >= 0),
  total numeric(14,3) not null default 0 check (total >= 0),
  paid numeric(14,3) not null default 0 check (paid >= 0),
  remaining numeric(14,3) generated always as (total - paid) stored,
  cost_total numeric(14,3) not null default 0,
  profit numeric(14,3) not null default 0,
  payment_method public.payment_method,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  check (paid <= total)
);
create index sales_date_idx on public.sales (sale_date desc);
create index sales_customer_idx on public.sales (customer_id, sale_date desc);
create index sales_status_date_idx on public.sales (status, sale_date desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  unit public.unit_kind not null,
  units_per_carton int not null default 1,
  qty integer not null check (qty > 0),
  qty_units integer not null check (qty_units > 0),
  unit_price numeric(14,3) not null check (unit_price >= 0),
  line_total numeric(14,3) not null default 0,
  discount numeric(14,3) not null default 0 check (discount >= 0),
  inv_discount_share numeric(14,3) not null default 0,
  net_total numeric(14,3) not null default 0,
  unit_cost numeric(14,6) not null default 0,
  cost_total numeric(14,3) not null default 0,
  profit numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id, created_at desc);

-- فواتير معلّقة (مسودات) — لا تؤثر على المخزون أو الحسابات
create table public.held_sales (
  id uuid primary key default gen_random_uuid(),
  label text,
  customer_id uuid references public.customers (id) on delete set null,
  payload jsonb not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  supplier_invoice_no text,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  status public.doc_status not null default 'completed',
  purchase_date timestamptz not null default now(),
  total numeric(14,3) not null default 0 check (total >= 0),
  paid numeric(14,3) not null default 0 check (paid >= 0),
  remaining numeric(14,3) generated always as (total - paid) stored,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  check (paid <= total)
);
create index purchases_date_idx on public.purchases (purchase_date desc);
create index purchases_supplier_idx on public.purchases (supplier_id, purchase_date desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  unit public.unit_kind not null,
  units_per_carton int not null default 1,
  qty integer not null check (qty > 0),
  qty_units integer not null check (qty_units > 0),
  unit_cost numeric(14,3) not null check (unit_cost >= 0),
  cost_per_unit numeric(14,6) not null default 0,
  line_total numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_product_idx on public.purchase_items (product_id, created_at desc);

-- ---------------------------------------------------------------------
-- Payments (قبض من عميل / دفع لمورد)
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text not null unique,
  party_type public.party_type not null,
  customer_id uuid references public.customers (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete restrict,
  sale_id uuid references public.sales (id) on delete restrict,
  purchase_id uuid references public.purchases (id) on delete restrict,
  direction public.cash_direction not null,
  amount numeric(14,3) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  status public.doc_status not null default 'completed',
  payment_date timestamptz not null default now(),
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  check (
    (party_type = 'customer' and customer_id is not null and supplier_id is null)
    or
    (party_type = 'supplier' and supplier_id is not null and customer_id is null)
  )
);
create index payments_date_idx on public.payments (payment_date desc);
create index payments_customer_idx on public.payments (customer_id, payment_date desc);
create index payments_supplier_idx on public.payments (supplier_id, payment_date desc);

-- ---------------------------------------------------------------------
-- Ledgers (كشوف الحسابات) — append only
-- ---------------------------------------------------------------------
create table public.customer_ledger (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers (id) on delete restrict,
  entry_type public.ledger_entry_type not null,
  ref_table text,
  ref_id uuid,
  debit numeric(14,3) not null default 0 check (debit >= 0),
  credit numeric(14,3) not null default 0 check (credit >= 0),
  balance_after numeric(14,3) not null,
  entry_date timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index customer_ledger_customer_idx on public.customer_ledger (customer_id, entry_date, id);

create table public.supplier_ledger (
  id bigint generated always as identity primary key,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  entry_type public.ledger_entry_type not null,
  ref_table text,
  ref_id uuid,
  debit numeric(14,3) not null default 0 check (debit >= 0),
  credit numeric(14,3) not null default 0 check (credit >= 0),
  balance_after numeric(14,3) not null,
  entry_date timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index supplier_ledger_supplier_idx on public.supplier_ledger (supplier_id, entry_date, id);

-- ---------------------------------------------------------------------
-- Stock movements (دفتر حركة المخزون) — append only
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete restrict,
  move_type public.stock_move_type not null,
  qty_change integer not null,
  balance_after integer not null,
  unit_cost numeric(14,6),
  ref_table text,
  ref_id uuid,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, id desc);
create index stock_movements_date_idx on public.stock_movements (created_at desc);
create index stock_movements_type_idx on public.stock_movements (move_type, created_at desc);

-- ---------------------------------------------------------------------
-- Returns (المرتجعات)
-- ---------------------------------------------------------------------
create table public.returns (
  id uuid primary key default gen_random_uuid(),
  return_no text not null unique,
  sale_id uuid not null references public.sales (id) on delete restrict,
  customer_id uuid references public.customers (id) on delete restrict,
  status public.doc_status not null default 'completed',
  return_date timestamptz not null default now(),
  total numeric(14,3) not null default 0 check (total >= 0),
  restocked_cost_total numeric(14,3) not null default 0,
  profit_delta numeric(14,3) not null default 0,
  refund_cash numeric(14,3) not null default 0 check (refund_cash >= 0),
  refund_method public.payment_method,
  reason text,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text
);
create index returns_date_idx on public.returns (return_date desc);
create index returns_sale_idx on public.returns (sale_id);
create index returns_customer_idx on public.returns (customer_id, return_date desc);

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns (id) on delete cascade,
  sale_item_id uuid references public.sale_items (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  unit public.unit_kind not null,
  units_per_carton int not null default 1,
  qty integer not null check (qty > 0),
  qty_units integer not null check (qty_units > 0),
  unit_price numeric(14,3) not null check (unit_price >= 0),
  line_total numeric(14,3) not null default 0,
  condition public.item_condition not null default 'good',
  unit_cost numeric(14,6) not null default 0,
  cost_total numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);
create index return_items_return_idx on public.return_items (return_id);
create index return_items_sale_item_idx on public.return_items (sale_item_id);

-- ---------------------------------------------------------------------
-- Expenses (المصروفات)
-- ---------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_no text not null unique,
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  amount numeric(14,3) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  status public.doc_status not null default 'completed',
  expense_date timestamptz not null default now(),
  notes text,
  attachment_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text
);
create index expenses_date_idx on public.expenses (expense_date desc);
create index expenses_category_idx on public.expenses (category_id, expense_date desc);

-- ---------------------------------------------------------------------
-- Cash flow (الصندوق) — append only
-- ---------------------------------------------------------------------
create table public.cash_transactions (
  id bigint generated always as identity primary key,
  tx_type public.cash_tx_type not null,
  direction public.cash_direction not null,
  amount numeric(14,3) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  ref_table text,
  ref_id uuid,
  tx_date timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index cash_tx_date_idx on public.cash_transactions (tx_date desc);
create index cash_tx_method_idx on public.cash_transactions (method, tx_date desc);
create index cash_tx_type_idx on public.cash_transactions (tx_type, tx_date desc);

-- إغلاق الصندوق اليومي
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  opening_balance numeric(14,3) not null default 0,
  cash_in numeric(14,3) not null default 0,
  cash_out numeric(14,3) not null default 0,
  expected_cash numeric(14,3) not null default 0,
  actual_cash numeric(14,3) not null default 0,
  difference numeric(14,3) not null default 0,
  status public.session_status not null default 'closed',
  notes text,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Inventory counts (الجرد)
-- ---------------------------------------------------------------------
create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  count_no text not null unique,
  count_type public.count_type not null default 'manual',
  status public.count_status not null default 'open',
  category_id uuid references public.categories (id) on delete set null,
  notes text,
  items_total int not null default 0,
  counted_items int not null default 0,
  total_diff_units integer not null default 0,
  total_diff_value numeric(14,3) not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id)
);

create table public.inventory_count_items (
  id bigint generated always as identity primary key,
  count_id uuid not null references public.inventory_counts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  barcode text,
  expected_units integer not null default 0,
  actual_units integer,
  diff_units integer,
  unit_cost numeric(14,6) not null default 0,
  diff_value numeric(14,3),
  counted_at timestamptz,
  unique (count_id, product_id)
);
create index count_items_count_idx on public.inventory_count_items (count_id);

-- ---------------------------------------------------------------------
-- Notes (الدفتر اليومي)
-- ---------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  is_task boolean not null default false,
  is_done boolean not null default false,
  is_pinned boolean not null default false,
  note_date timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_date_idx on public.notes (is_pinned desc, note_date desc);
create index notes_content_trgm on public.notes using gin (content extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Notifications (التنبيهات)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity public.notif_severity not null default 'info',
  title text not null,
  body text,
  ref_table text,
  ref_id text,
  dedupe_key text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_unread_idx on public.notifications (is_read, created_at desc);
create unique index notifications_dedupe_key on public.notifications (dedupe_key)
  where is_read = false and dedupe_key is not null;

-- ---------------------------------------------------------------------
-- Audit log — append only
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  user_name text,
  action text not null,
  entity text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_date_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- ---------------------------------------------------------------------
-- Backup logs
-- ---------------------------------------------------------------------
create table public.backup_logs (
  id uuid primary key default gen_random_uuid(),
  backup_type public.backup_type not null default 'manual',
  status public.backup_status not null default 'running',
  file_name text,
  file_size bigint,
  storage_path text,
  tables_count int,
  rows_count bigint,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid
);
create index backup_logs_date_idx on public.backup_logs (started_at desc);

-- ---------------------------------------------------------------------
-- updated_at touch trigger
-- ---------------------------------------------------------------------
create or replace function app.tg_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles for each row execute function app.tg_touch();
create trigger touch_products before update on public.products for each row execute function app.tg_touch();
create trigger touch_customers before update on public.customers for each row execute function app.tg_touch();
create trigger touch_suppliers before update on public.suppliers for each row execute function app.tg_touch();
create trigger touch_customer_prices before update on public.customer_prices for each row execute function app.tg_touch();
create trigger touch_notes before update on public.notes for each row execute function app.tg_touch();
create trigger touch_held_sales before update on public.held_sales for each row execute function app.tg_touch();
create trigger touch_app_settings before update on public.app_settings for each row execute function app.tg_touch();

-- ---------------------------------------------------------------------
-- Hard-delete protection for financial history (works even for service role)
-- reset_all_data() uses TRUNCATE which bypasses row triggers intentionally.
-- ---------------------------------------------------------------------
create or replace function app.tg_no_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'DELETE_FORBIDDEN',
    detail = 'لا يُسمح بالحذف النهائي للسجلات المالية. استخدم الإلغاء (Void) بدلاً من الحذف.';
end;
$$;

create trigger no_delete_sales before delete on public.sales for each row execute function app.tg_no_delete();
create trigger no_delete_purchases before delete on public.purchases for each row execute function app.tg_no_delete();
create trigger no_delete_payments before delete on public.payments for each row execute function app.tg_no_delete();
create trigger no_delete_returns before delete on public.returns for each row execute function app.tg_no_delete();
create trigger no_delete_expenses before delete on public.expenses for each row execute function app.tg_no_delete();
create trigger no_delete_customer_ledger before delete on public.customer_ledger for each row execute function app.tg_no_delete();
create trigger no_delete_supplier_ledger before delete on public.supplier_ledger for each row execute function app.tg_no_delete();
create trigger no_delete_stock_movements before delete on public.stock_movements for each row execute function app.tg_no_delete();
create trigger no_delete_cash_transactions before delete on public.cash_transactions for each row execute function app.tg_no_delete();
create trigger no_delete_audit_logs before delete on public.audit_logs for each row execute function app.tg_no_delete();

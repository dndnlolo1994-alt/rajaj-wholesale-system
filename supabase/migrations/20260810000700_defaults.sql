-- =====================================================================
-- Migration 7: Default settings, expense categories, storage buckets
-- Production-safe: no demo data here (demo lives in supabase/seed.sql).
-- =====================================================================

insert into public.app_settings (key, value) values
  ('business', jsonb_build_object(
    'owner_name', 'رجائي المصري',
    'business_name', 'رجائي المصري',
    'phone', '',
    'address', '',
    'logo_url', null,
    'invoice_footer', 'شكراً لتعاملكم معنا'
  )),
  ('general', jsonb_build_object(
    'timezone', 'Asia/Amman',
    'currency_code', 'JOD',
    'currency_symbol', 'د.أ',
    'currency_decimals', 3
  )),
  ('invoice', jsonb_build_object(
    'prefix', 'RM',
    'purchase_prefix', 'PUR',
    'return_prefix', 'RET',
    'receipt_prefix', 'RCV',
    'voucher_prefix', 'PAY',
    'expense_prefix', 'EXP',
    'count_prefix', 'CNT'
  )),
  ('sales', jsonb_build_object(
    'default_payment_method', 'cash',
    'big_invoice_threshold', 500
  )),
  ('inventory', jsonb_build_object(
    'allow_negative_stock', false,
    'stagnant_days', 45
  )),
  ('debts', jsonb_build_object(
    'old_debt_days', 30,
    'critical_debt_days', 60
  )),
  ('cashbox', jsonb_build_object(
    'opening_balance', 0
  )),
  ('printer', jsonb_build_object(
    'paper_width', 80,
    'mode', 'browser',
    'bridge_url', 'http://127.0.0.1:9723',
    'printer_ip', '',
    'printer_port', 9100,
    'copies', 1,
    'auto_print', false,
    'printer_name', '',
    'cut', true,
    'cash_drawer', false
  )),
  ('backup', jsonb_build_object(
    'auto_enabled', true,
    'retention_days', 30
  )),
  ('notifications', jsonb_build_object(
    'periodic_last_run', null
  ))
on conflict (key) do nothing;

insert into public.expense_categories (name, sort_order) values
  ('بنزين ووقود', 1),
  ('نقل وشحن', 2),
  ('صيانة', 3),
  ('رواتب وأجور', 4),
  ('إيجار', 5),
  ('كهرباء وماء', 6),
  ('هاتف وإنترنت', 7),
  ('ضيافة', 8),
  ('رسوم حكومية', 9),
  ('متفرقات', 99)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Storage buckets + policies (guarded: skipped when storage schema
-- is unavailable, e.g. in the local test database)
-- ---------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values
    ('product-images', 'product-images', true),
    ('attachments', 'attachments', false),
    ('backups', 'backups', false)
  on conflict (id) do nothing;

  execute $pol$
    create policy "product images read" on storage.objects for select
      using (bucket_id = 'product-images')
  $pol$;
  execute $pol$
    create policy "product images write" on storage.objects for insert
      with check (bucket_id = 'product-images' and app.has_role(array['owner','manager','warehouse']::public.user_role[]))
  $pol$;
  execute $pol$
    create policy "product images update" on storage.objects for update
      using (bucket_id = 'product-images' and app.has_role(array['owner','manager','warehouse']::public.user_role[]))
  $pol$;
  execute $pol$
    create policy "product images delete" on storage.objects for delete
      using (bucket_id = 'product-images' and app.has_role(array['owner','manager']::public.user_role[]))
  $pol$;
  execute $pol$
    create policy "attachments read" on storage.objects for select
      using (bucket_id = 'attachments' and app.is_staff())
  $pol$;
  execute $pol$
    create policy "attachments write" on storage.objects for insert
      with check (bucket_id = 'attachments' and app.is_staff())
  $pol$;
exception
  when undefined_table then
    raise notice 'storage schema not available — skipping bucket setup';
  when duplicate_object then
    null;
end;
$$;

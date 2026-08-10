-- حماية إضافية لبيانات الإنتاج:
-- 1) إغلاق تصفير البيانات عن جميع حسابات التطبيق.
-- 2) منع الحذف النهائي للبيانات الأساسية؛ التعطيل هو البديل الآمن.

revoke all on function public.reset_all_data(text, text) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'no_delete_products') then
    create trigger no_delete_products before delete on public.products
      for each row execute function app.tg_no_delete();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'no_delete_customers') then
    create trigger no_delete_customers before delete on public.customers
      for each row execute function app.tg_no_delete();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'no_delete_suppliers') then
    create trigger no_delete_suppliers before delete on public.suppliers
      for each row execute function app.tg_no_delete();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'no_delete_categories') then
    create trigger no_delete_categories before delete on public.categories
      for each row execute function app.tg_no_delete();
  end if;
end $$;


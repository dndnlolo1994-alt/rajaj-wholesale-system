-- =====================================================================
-- Migration 11: كتالوج أصناف أردني أولي + أيقونات SVG خفيفة
-- - يضيف شركات/أصناف شائعة كنقطة بداية بدون مخزون وبدون باركود وهمي.
-- - كل صنف يأخذ SKU ثابت حتى لا يتكرر عند إعادة التطبيق.
-- - الصورة SVG داخلية كـ data URL، ويمكن تعديلها لاحقًا من صفحة الصنف.
-- =====================================================================

with category_seed(name, sort_order) as (
  values
    ('شيبس وسناكات', 10),
    ('بسكويت وكيك', 20),
    ('شوكولاتة وحلويات', 30),
    ('مشروبات وعصائر', 40),
    ('تموين وبيت', 50),
    ('قهوة وتمور', 60)
),
upsert_categories as (
  insert into public.categories (name, sort_order, is_active)
  select name, sort_order, true from category_seed
  on conflict (name) do update
    set sort_order = excluded.sort_order,
        is_active = true
  returning id, name
),
all_categories as (
  select id, name from upsert_categories
  union
  select c.id, c.name
  from public.categories c
  join category_seed s on s.name = c.name
),
catalog(brand, name, category_name, sku, units_per_carton, purchase_price_carton, sale_price_carton, sale_price_piece, color_a, color_b) as (
  values
    ('بترا شيبس', 'بترا شيبس ملح', 'شيبس وسناكات', 'PET-001', 24, 4.800, 6.000, 0.300, '#064e3b', '#34d399'),
    ('بترا شيبس', 'بترا شيبس كاتشب', 'شيبس وسناكات', 'PET-002', 24, 4.800, 6.000, 0.300, '#7f1d1d', '#fca5a5'),
    ('بترا شيبس', 'بترا شيبس خل وملح', 'شيبس وسناكات', 'PET-003', 24, 4.800, 6.000, 0.300, '#1e3a8a', '#93c5fd'),
    ('بترا شيبس', 'بترا شيبس بابريكا', 'شيبس وسناكات', 'PET-004', 24, 4.800, 6.000, 0.300, '#7c2d12', '#fdba74'),
    ('بترا شيبس', 'بترا شيبس حار', 'شيبس وسناكات', 'PET-005', 24, 4.800, 6.000, 0.300, '#991b1b', '#fb7185'),
    ('بترا شيبس', 'بترا شيبس جبنة', 'شيبس وسناكات', 'PET-006', 24, 4.800, 6.000, 0.300, '#713f12', '#fde68a'),
    ('بترا شيبس', 'بترا شيبس باربكيو', 'شيبس وسناكات', 'PET-007', 24, 4.800, 6.000, 0.300, '#431407', '#f97316'),
    ('بترا شيبس', 'بترا شيبس ذرة', 'شيبس وسناكات', 'PET-008', 24, 4.800, 6.000, 0.300, '#365314', '#bef264'),

    ('هلا', 'هلا شيبس ملح', 'شيبس وسناكات', 'HAL-001', 24, 4.500, 5.750, 0.300, '#0f766e', '#99f6e4'),
    ('هلا', 'هلا شيبس كاتشب', 'شيبس وسناكات', 'HAL-002', 24, 4.500, 5.750, 0.300, '#9f1239', '#fda4af'),
    ('هلا', 'هلا شيبس حار', 'شيبس وسناكات', 'HAL-003', 24, 4.500, 5.750, 0.300, '#b91c1c', '#f87171'),
    ('هلا', 'هلا شيبس جبنة', 'شيبس وسناكات', 'HAL-004', 24, 4.500, 5.750, 0.300, '#854d0e', '#fde047'),
    ('هلا', 'هلا أصابع ذرة جبنة', 'شيبس وسناكات', 'HAL-005', 24, 3.900, 5.000, 0.250, '#a16207', '#facc15'),
    ('هلا', 'هلا بفك', 'شيبس وسناكات', 'HAL-006', 24, 3.900, 5.000, 0.250, '#155e75', '#67e8f9'),
    ('هلا', 'هلا حلقات بطاطا', 'شيبس وسناكات', 'HAL-007', 24, 4.200, 5.500, 0.275, '#14532d', '#86efac'),
    ('هلا', 'هلا فشار', 'شيبس وسناكات', 'HAL-008', 24, 3.600, 4.800, 0.250, '#4c1d95', '#c4b5fd'),

    ('مستر شيبس', 'مستر شيبس ملح', 'شيبس وسناكات', 'MRC-001', 24, 5.200, 6.500, 0.325, '#1e40af', '#60a5fa'),
    ('مستر شيبس', 'مستر شيبس كاتشب', 'شيبس وسناكات', 'MRC-002', 24, 5.200, 6.500, 0.325, '#991b1b', '#fca5a5'),
    ('مستر شيبس', 'مستر شيبس خل وملح', 'شيبس وسناكات', 'MRC-003', 24, 5.200, 6.500, 0.325, '#075985', '#7dd3fc'),
    ('مستر شيبس', 'مستر شيبس حار', 'شيبس وسناكات', 'MRC-004', 24, 5.200, 6.500, 0.325, '#7f1d1d', '#fb7185'),
    ('مستر شيبس', 'مستر شيبس جبنة', 'شيبس وسناكات', 'MRC-005', 24, 5.200, 6.500, 0.325, '#713f12', '#fef08a'),
    ('مستر شيبس', 'مستر شيبس باربكيو', 'شيبس وسناكات', 'MRC-006', 24, 5.200, 6.500, 0.325, '#7c2d12', '#fdba74'),
    ('مستر شيبس', 'مستر شيبس ذرة', 'شيبس وسناكات', 'MRC-007', 24, 4.400, 5.750, 0.300, '#365314', '#bef264'),
    ('مستر شيبس', 'مستر شيبس عائلي', 'شيبس وسناكات', 'MRC-008', 12, 5.400, 7.200, 0.650, '#312e81', '#a5b4fc'),

    ('ليز', 'ليز ملح', 'شيبس وسناكات', 'LAY-001', 24, 6.000, 7.500, 0.400, '#1e3a8a', '#93c5fd'),
    ('ليز', 'ليز كاتشب', 'شيبس وسناكات', 'LAY-002', 24, 6.000, 7.500, 0.400, '#9f1239', '#fda4af'),
    ('ليز', 'ليز خل وملح', 'شيبس وسناكات', 'LAY-003', 24, 6.000, 7.500, 0.400, '#075985', '#7dd3fc'),
    ('ليز', 'ليز حار', 'شيبس وسناكات', 'LAY-004', 24, 6.000, 7.500, 0.400, '#991b1b', '#fb7185'),
    ('ليز', 'ليز جبنة', 'شيبس وسناكات', 'LAY-005', 24, 6.000, 7.500, 0.400, '#854d0e', '#fde047'),
    ('ليز', 'ليز باربكيو', 'شيبس وسناكات', 'LAY-006', 24, 6.000, 7.500, 0.400, '#431407', '#fb923c'),

    ('دندنة', 'دندنة شيبس ملح', 'شيبس وسناكات', 'DAN-001', 24, 4.200, 5.500, 0.275, '#064e3b', '#6ee7b7'),
    ('دندنة', 'دندنة شيبس كاتشب', 'شيبس وسناكات', 'DAN-002', 24, 4.200, 5.500, 0.275, '#881337', '#f9a8d4'),
    ('دندنة', 'دندنة شيبس شطة', 'شيبس وسناكات', 'DAN-003', 24, 4.200, 5.500, 0.275, '#7f1d1d', '#f87171'),
    ('دندنة', 'دندنة شيبس جبنة', 'شيبس وسناكات', 'DAN-004', 24, 4.200, 5.500, 0.275, '#713f12', '#fde68a'),
    ('دندنة', 'دندنة بفك', 'شيبس وسناكات', 'DAN-005', 24, 3.800, 4.900, 0.250, '#0f766e', '#5eead4'),
    ('دندنة', 'دندنة فشار', 'شيبس وسناكات', 'DAN-006', 24, 3.800, 4.900, 0.250, '#4c1d95', '#ddd6fe'),
    ('دندنة', 'دندنة سناكس مشكل', 'شيبس وسناكات', 'DAN-007', 24, 4.500, 5.900, 0.300, '#1e1b4b', '#a5b4fc'),

    ('مذيب حداد', 'مذيب حداد معمول تمر', 'بسكويت وكيك', 'HAD-001', 12, 9.600, 12.000, 1.100, '#78350f', '#fcd34d'),
    ('مذيب حداد', 'مذيب حداد بسكويت سادة', 'بسكويت وكيك', 'HAD-002', 24, 5.200, 6.750, 0.350, '#44403c', '#d6d3d1'),
    ('مذيب حداد', 'مذيب حداد ويفر شوكولاتة', 'بسكويت وكيك', 'HAD-003', 24, 5.600, 7.200, 0.375, '#3f1d0b', '#f59e0b'),
    ('مذيب حداد', 'مذيب حداد كيك فانيلا', 'بسكويت وكيك', 'HAD-004', 24, 6.000, 7.800, 0.400, '#713f12', '#fef3c7'),
    ('مذيب حداد', 'مذيب حداد كيك شوكولاتة', 'بسكويت وكيك', 'HAD-005', 24, 6.000, 7.800, 0.400, '#431407', '#fdba74'),
    ('مذيب حداد', 'مذيب حداد كعك شاي', 'بسكويت وكيك', 'HAD-006', 12, 7.200, 9.000, 0.800, '#57534e', '#e7e5e4'),

    ('الأعمدة', 'الأعمدة عصير برتقال 200مل', 'مشروبات وعصائر', 'AMD-001', 27, 4.800, 6.750, 0.300, '#9a3412', '#fed7aa'),
    ('الأعمدة', 'الأعمدة عصير تفاح 200مل', 'مشروبات وعصائر', 'AMD-002', 27, 4.800, 6.750, 0.300, '#365314', '#bef264'),
    ('الأعمدة', 'الأعمدة عصير مانجا 200مل', 'مشروبات وعصائر', 'AMD-003', 27, 4.800, 6.750, 0.300, '#a16207', '#fde047'),
    ('الأعمدة', 'الأعمدة عصير كوكتيل 200مل', 'مشروبات وعصائر', 'AMD-004', 27, 4.800, 6.750, 0.300, '#be123c', '#fda4af'),
    ('الأعمدة', 'الأعمدة مياه 330مل', 'مشروبات وعصائر', 'AMD-005', 40, 3.200, 5.000, 0.150, '#075985', '#bae6fd'),

    ('الأوطة', 'الأوطة معجون بندورة صغير', 'تموين وبيت', 'OTA-001', 24, 7.200, 9.000, 0.450, '#7f1d1d', '#fca5a5'),
    ('الأوطة', 'الأوطة معجون بندورة كبير', 'تموين وبيت', 'OTA-002', 12, 9.600, 12.000, 1.100, '#991b1b', '#fecaca'),
    ('الأوطة', 'الأوطة كاتشب', 'تموين وبيت', 'OTA-003', 12, 8.400, 10.800, 1.000, '#9f1239', '#fda4af'),
    ('الأوطة', 'الأوطة صلصة حارة', 'تموين وبيت', 'OTA-004', 12, 8.400, 10.800, 1.000, '#7f1d1d', '#fb7185'),
    ('الأوطة', 'الأوطة حمص معلب', 'تموين وبيت', 'OTA-005', 24, 10.800, 13.200, 0.650, '#713f12', '#fde68a'),
    ('الأوطة', 'الأوطة فول مدمس', 'تموين وبيت', 'OTA-006', 24, 10.800, 13.200, 0.650, '#44403c', '#d6d3d1'),

    ('الدهاكي', 'الدهاكي بسكويت حليب', 'بسكويت وكيك', 'DHK-001', 24, 4.800, 6.000, 0.300, '#7c2d12', '#fed7aa'),
    ('الدهاكي', 'الدهاكي بسكويت شوكولاتة', 'بسكويت وكيك', 'DHK-002', 24, 4.800, 6.000, 0.300, '#431407', '#fdba74'),
    ('الدهاكي', 'الدهاكي ويفر فانيلا', 'بسكويت وكيك', 'DHK-003', 24, 5.200, 6.750, 0.350, '#713f12', '#fef08a'),
    ('الدهاكي', 'الدهاكي ويفر فراولة', 'بسكويت وكيك', 'DHK-004', 24, 5.200, 6.750, 0.350, '#9d174d', '#f9a8d4'),
    ('الدهاكي', 'الدهاكي كعك سمسم', 'بسكويت وكيك', 'DHK-005', 12, 6.600, 8.400, 0.750, '#57534e', '#e7e5e4'),
    ('الدهاكي', 'الدهاكي معمول تمر', 'بسكويت وكيك', 'DHK-006', 12, 8.400, 10.800, 1.000, '#78350f', '#fcd34d'),

    ('ميلاد', 'ميلاد شوكولاتة حليب', 'شوكولاتة وحلويات', 'MIL-001', 24, 6.000, 7.800, 0.400, '#431407', '#fbbf24'),
    ('ميلاد', 'ميلاد شوكولاتة بندق', 'شوكولاتة وحلويات', 'MIL-002', 24, 6.400, 8.400, 0.450, '#3f1d0b', '#fdba74'),
    ('ميلاد', 'ميلاد ويفر شوكولاتة', 'شوكولاتة وحلويات', 'MIL-003', 24, 5.400, 7.200, 0.375, '#78350f', '#fcd34d'),
    ('ميلاد', 'ميلاد ويفر فانيلا', 'شوكولاتة وحلويات', 'MIL-004', 24, 5.400, 7.200, 0.375, '#854d0e', '#fef3c7'),
    ('ميلاد', 'ميلاد بسكويت شاي', 'بسكويت وكيك', 'MIL-005', 24, 4.800, 6.000, 0.300, '#57534e', '#d6d3d1'),
    ('ميلاد', 'ميلاد كيك شوكولاتة', 'بسكويت وكيك', 'MIL-006', 24, 6.000, 7.800, 0.400, '#431407', '#fdba74'),
    ('ميلاد', 'ميلاد كروسان شوكولاتة', 'بسكويت وكيك', 'MIL-007', 12, 6.600, 8.400, 0.750, '#7c2d12', '#fed7aa')
)
insert into public.products (
  name, barcode, sku, category_id, brand, description, notes, image_url,
  units_per_carton, stock_units, avg_unit_cost,
  purchase_price_carton, sale_price_carton, sale_price_piece,
  wholesale_price_carton, wholesale_price_piece, min_stock_units, is_active
)
select
  c.name,
  null,
  c.sku,
  cat.id,
  c.brand,
  'كتالوج مبدئي — عدّل الباركود والسعر والمخزون حسب الواقع.',
  'أُضيف تلقائيًا ضمن كتالوج الأصناف الأردنية.',
  'data:image/svg+xml;base64,' || encode(convert_to(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' ||
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' || c.color_a || '"/><stop offset="1" stop-color="' || c.color_b || '"/></linearGradient></defs>' ||
    '<rect width="64" height="64" rx="18" fill="url(#g)"/><circle cx="49" cy="15" r="10" fill="rgba(255,255,255,.24)"/>' ||
    '<path d="M14 45c8-13 25-15 36-4" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="5" stroke-linecap="round"/>' ||
    '<text x="32" y="37" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="white">' || left(c.brand, 2) || '</text>' ||
    '</svg>',
    'UTF8'
  ), 'base64'),
  c.units_per_carton,
  0,
  0,
  c.purchase_price_carton,
  c.sale_price_carton,
  c.sale_price_piece,
  null,
  null,
  0,
  true
from catalog c
join all_categories cat on cat.name = c.category_name
where not exists (
  select 1 from public.products p
  where p.sku = c.sku or lower(btrim(p.name)) = lower(btrim(c.name))
);

-- شاشة البيع: إرجاع الصورة مع الأصناف.
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

-- مفضلة العميل: إرجاع الصورة كذلك.
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

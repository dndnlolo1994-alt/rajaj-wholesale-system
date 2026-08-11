-- =====================================================================
-- بيانات تجريبية — نظام رجائي المصري
-- منفصلة تمامًا عن الـ Migrations. لحذفها لاحقًا: صفحة الإعدادات → تصفير
-- البيانات (reset_all_data) أو: select public.reset_all_data('RESET');
--
-- محليًا (supabase db reset): ينشئ مستخدم دخول تجريبي:
--   البريد: rajaei@demo.local   كلمة المرور: Demo1234!
-- على مشروع مستضاف: أنشئ المالك أولًا (npm run create-owner) ثم شغّل هذا
-- الملف من SQL Editor — سيستخدم أول مالك موجود ولن ينشئ مستخدمًا جديدًا.
-- =====================================================================

do $seed$
declare
  v_owner uuid;
  v_demo_uid uuid := '00000000-0000-0000-0000-000000000001';
  -- categories
  v_cat_chips uuid := 'c1000000-0000-4000-8000-000000000001';
  v_cat_juice uuid := 'c1000000-0000-4000-8000-000000000002';
  v_cat_water uuid := 'c1000000-0000-4000-8000-000000000003';
  v_cat_biscuit uuid := 'c1000000-0000-4000-8000-000000000004';
  v_cat_choco uuid := 'c1000000-0000-4000-8000-000000000005';
  v_cat_grocery uuid := 'c1000000-0000-4000-8000-000000000006';
  v_cat_soda uuid := 'c1000000-0000-4000-8000-000000000007';
  v_cat_clean uuid := 'c1000000-0000-4000-8000-000000000008';
  -- products
  v_p01 uuid := 'a0000000-0000-4000-8000-000000000001';
  v_p02 uuid := 'a0000000-0000-4000-8000-000000000002';
  v_p03 uuid := 'a0000000-0000-4000-8000-000000000003';
  v_p04 uuid := 'a0000000-0000-4000-8000-000000000004';
  v_p05 uuid := 'a0000000-0000-4000-8000-000000000005';
  v_p06 uuid := 'a0000000-0000-4000-8000-000000000006';
  v_p07 uuid := 'a0000000-0000-4000-8000-000000000007';
  v_p08 uuid := 'a0000000-0000-4000-8000-000000000008';
  v_p09 uuid := 'a0000000-0000-4000-8000-000000000009';
  v_p10 uuid := 'a0000000-0000-4000-8000-000000000010';
  v_p11 uuid := 'a0000000-0000-4000-8000-000000000011';
  v_p12 uuid := 'a0000000-0000-4000-8000-000000000012';
  v_p13 uuid := 'a0000000-0000-4000-8000-000000000013';
  v_p14 uuid := 'a0000000-0000-4000-8000-000000000014';
  v_p15 uuid := 'a0000000-0000-4000-8000-000000000015';
  v_p16 uuid := 'a0000000-0000-4000-8000-000000000016';
  v_p17 uuid := 'a0000000-0000-4000-8000-000000000017';
  v_p18 uuid := 'a0000000-0000-4000-8000-000000000018';
  v_p19 uuid := 'a0000000-0000-4000-8000-000000000019';
  v_p20 uuid := 'a0000000-0000-4000-8000-000000000020';
  v_p21 uuid := 'a0000000-0000-4000-8000-000000000021';
  v_p22 uuid := 'a0000000-0000-4000-8000-000000000022';
  v_p23 uuid := 'a0000000-0000-4000-8000-000000000023';
  v_p24 uuid := 'a0000000-0000-4000-8000-000000000024';
  v_p25 uuid := 'a0000000-0000-4000-8000-000000000025';
  v_p26 uuid := 'a0000000-0000-4000-8000-000000000026';
  v_p27 uuid := 'a0000000-0000-4000-8000-000000000027';
  v_p28 uuid := 'a0000000-0000-4000-8000-000000000028';
  v_p29 uuid := 'a0000000-0000-4000-8000-000000000029';
  v_p30 uuid := 'a0000000-0000-4000-8000-000000000030';
  v_p31 uuid := 'a0000000-0000-4000-8000-000000000031';
  v_p32 uuid := 'a0000000-0000-4000-8000-000000000032';
  v_p33 uuid := 'a0000000-0000-4000-8000-000000000033';
  v_p34 uuid := 'a0000000-0000-4000-8000-000000000034';
  v_p35 uuid := 'a0000000-0000-4000-8000-000000000035';
  v_p36 uuid := 'a0000000-0000-4000-8000-000000000036';
  v_p37 uuid := 'a0000000-0000-4000-8000-000000000037';
  v_p38 uuid := 'a0000000-0000-4000-8000-000000000038';
  v_p39 uuid := 'a0000000-0000-4000-8000-000000000039';
  v_p40 uuid := 'a0000000-0000-4000-8000-000000000040';
  v_p41 uuid := 'a0000000-0000-4000-8000-000000000041';
  v_p42 uuid := 'a0000000-0000-4000-8000-000000000042';
  v_p43 uuid := 'a0000000-0000-4000-8000-000000000043';
  v_p44 uuid := 'a0000000-0000-4000-8000-000000000044';
  v_p45 uuid := 'a0000000-0000-4000-8000-000000000045';
  v_p46 uuid := 'a0000000-0000-4000-8000-000000000046';
  v_p47 uuid := 'a0000000-0000-4000-8000-000000000047';
  v_p48 uuid := 'a0000000-0000-4000-8000-000000000048';
  -- customers
  v_c1 uuid := 'b0000000-0000-4000-8000-000000000001';
  v_c2 uuid := 'b0000000-0000-4000-8000-000000000002';
  v_c3 uuid := 'b0000000-0000-4000-8000-000000000003';
  v_c4 uuid := 'b0000000-0000-4000-8000-000000000004';
  v_c5 uuid := 'b0000000-0000-4000-8000-000000000005';
  -- suppliers
  v_s1 uuid := 'd0000000-0000-4000-8000-000000000001';
  v_s2 uuid := 'd0000000-0000-4000-8000-000000000002';
  v_s3 uuid := 'd0000000-0000-4000-8000-000000000003';
  -- docs
  v_res jsonb;
  v_sale1 uuid;
  v_sale2 uuid;
  v_sale3 uuid;
  v_si uuid;
  v_cat_fuel uuid;
  v_cat_maint uuid;
begin
  -- -------------------------------------------------------------------
  -- 1) مستخدم المالك
  -- -------------------------------------------------------------------
  select id into v_owner from public.profiles where role = 'owner' order by created_at limit 1;

  if v_owner is null then
    begin
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000', v_demo_uid, 'authenticated', 'authenticated',
        'rajaei@demo.local', extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now()
      );
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_demo_uid, v_demo_uid,
        jsonb_build_object('sub', v_demo_uid::text, 'email', 'rajaei@demo.local', 'email_verified', true),
        'email', now(), now(), now()
      );
    exception when others then
      raise notice 'auth user creation skipped: %', sqlerrm;
    end;

    insert into public.profiles (id, full_name, role, is_active)
    values (v_demo_uid, 'رجائي المصري', 'owner', true)
    on conflict (id) do nothing;
    v_owner := v_demo_uid;
  end if;

  -- محاكاة جلسة المالك حتى تعمل دوال الصلاحيات والتدقيق
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);

  -- رصيد افتتاحي واقعي للصندوق (بيانات تجريبية)
  update public.app_settings
  set value = jsonb_set(value, '{opening_balance}', '600')
  where key = 'cashbox';

  -- -------------------------------------------------------------------
  -- 2) الأقسام
  -- -------------------------------------------------------------------
  insert into public.categories (id, name, sort_order) values
    (v_cat_chips, 'شيبس ومقرمشات', 1),
    (v_cat_juice, 'عصائر ومشروبات', 2),
    (v_cat_water, 'مياه', 3),
    (v_cat_biscuit, 'بسكويت وويفر', 4),
    (v_cat_choco, 'شوكولاتة وحلويات', 5),
    (v_cat_grocery, 'مواد تموينية', 6),
    (v_cat_soda, 'مشروبات غازية', 7),
    (v_cat_clean, 'منظفات وورقيات', 8)
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------
  -- 3) الأصناف (الأسعار بالدينار الأردني)
  -- -------------------------------------------------------------------
  insert into public.products
    (id, name, barcode, category_id, brand, units_per_carton,
     purchase_price_carton, sale_price_carton, sale_price_piece, min_stock_units)
  values
    (v_p01, 'شيبس كتشب 30غم', '6251100000017', v_cat_chips, 'مستر شيبس', 24, 7.200, 8.400, 0.400, 48),
    (v_p02, 'شيبس ملح 30غم', '6251100000024', v_cat_chips, 'مستر شيبس', 24, 7.200, 8.400, 0.400, 48),
    (v_p03, 'بوشار جاهز 80غم', '6251100000031', v_cat_chips, 'سنيورة', 12, 5.400, 6.600, 0.600, 24),
    (v_p04, 'عصير برتقال 250مل', '6281100000048', v_cat_juice, 'سن توب', 24, 5.760, 7.200, 0.350, 48),
    (v_p05, 'عصير مانجا 250مل', '6281100000055', v_cat_juice, 'سن توب', 24, 5.760, 7.200, 0.350, 48),
    (v_p06, 'مياه 1.5 لتر', '6251200000062', v_cat_water, 'جنى', 12, 1.800, 2.400, 0.250, 60),
    (v_p07, 'مياه 0.5 لتر', '6251200000079', v_cat_water, 'جنى', 24, 2.160, 2.880, 0.150, 96),
    (v_p08, 'بسكويت شاي 60غم', '6251300000086', v_cat_biscuit, 'الوطنية', 24, 4.320, 5.520, 0.275, 48),
    (v_p09, 'ويفر شوكولاتة 40غم', '6251300000093', v_cat_biscuit, 'علي بابا', 24, 6.000, 7.440, 0.350, 24),
    (v_p10, 'شوكولاتة حليب 22غم', '6251400000109', v_cat_choco, 'جالكسي', 24, 8.400, 10.080, 0.500, 24),
    (v_p11, 'حلاوة طحينية 700غم', '6251400000116', v_cat_choco, 'الأصيل', 12, 15.600, 18.000, 1.650, 12),
    (v_p12, 'رز مصري 5كغ', '6251500000123', v_cat_grocery, 'الشلال', 4, 14.000, 16.400, 4.400, 8),
    (v_p13, 'سكر ناعم 1كغ', '6251500000130', v_cat_grocery, 'الاتحاد', 10, 6.500, 7.500, 0.800, 20),
    (v_p14, 'زيت دوار الشمس 1.8لتر', '6251500000147', v_cat_grocery, 'العافية', 6, 10.800, 12.600, 2.250, 12),
    (v_p15, 'معكرونة اسباغيتي 400غم', '6251500000154', v_cat_grocery, 'الدرة', 20, 5.000, 6.400, 0.350, 40),
    (v_p16, 'كولا 330مل', '6281600000161', v_cat_soda, 'بيبسي', 24, 6.240, 7.680, 0.400, 48),
    (v_p17, 'مشروب غازي ليمون 330مل', '6281600000178', v_cat_soda, 'سفن أب', 24, 6.240, 7.680, 0.400, 48),
    (v_p18, 'مناديل ورقية 550 منديل', '6251700000185', v_cat_clean, 'فاين', 10, 7.500, 9.000, 1.000, 20),
    (v_p19, 'شيبس حار نار 30غم', '6251100000192', v_cat_chips, 'مستر شيبس', 24, 7.200, 8.400, 0.400, 48),
    (v_p20, 'شيبس جبنة 30غم', '6251100000208', v_cat_chips, 'مستر شيبس', 24, 7.200, 8.400, 0.400, 48),
    (v_p21, 'بوشار بالجبنة 80غم', '6251100000215', v_cat_chips, 'سنيورة', 12, 5.400, 6.600, 0.600, 24),
    (v_p22, 'عصير توت مشكل 250مل', '6281100000222', v_cat_juice, 'سن توب', 24, 5.760, 7.200, 0.350, 48),
    (v_p23, 'عصير تفاح 250مل', '6281100000239', v_cat_juice, 'سن توب', 24, 5.760, 7.200, 0.350, 48),
    (v_p24, 'عصير عنب 250مل', '6281100000246', v_cat_juice, 'ربيع', 24, 6.000, 7.680, 0.350, 48),
    (v_p25, 'مياه 0.33 لتر', '6251200000253', v_cat_water, 'جنى', 30, 2.100, 2.700, 0.120, 90),
    (v_p26, 'مياه 1.5 لتر أكوافينا', '6251200000260', v_cat_water, 'أكوافينا', 12, 2.100, 2.700, 0.280, 48),
    (v_p27, 'مياه 0.5 لتر أكوافينا', '6251200000277', v_cat_water, 'أكوافينا', 24, 2.400, 3.120, 0.160, 72),
    (v_p28, 'بسكويت دايجستف 80غم', '6251300000284', v_cat_biscuit, 'الوطنية', 24, 7.200, 9.120, 0.450, 48),
    (v_p29, 'ويفر فانيلا 40غم', '6251300000291', v_cat_biscuit, 'علي بابا', 24, 6.000, 7.440, 0.350, 24),
    (v_p30, 'بسكويت مالح 50غم', '6251300000307', v_cat_biscuit, 'الريدز', 24, 4.800, 6.000, 0.300, 48),
    (v_p31, 'شوكولاتة كيت كات 4 أصابع', '6251400000314', v_cat_choco, 'نستله', 24, 9.600, 12.000, 0.550, 24),
    (v_p32, 'شوكولاتة سنيكرز 50غم', '6251400000321', v_cat_choco, 'مارس', 24, 9.600, 12.000, 0.550, 24),
    (v_p33, 'شوكولاتة تويكس 50غم', '6251400000338', v_cat_choco, 'مارس', 24, 9.600, 12.000, 0.550, 24),
    (v_p34, 'حلاوة بالفستق 350غم', '6251400000345', v_cat_choco, 'الأصيل', 12, 13.200, 15.600, 1.400, 12),
    (v_p35, 'علكة مستكة', '6251400000352', v_cat_choco, 'شعراوي', 30, 3.000, 4.500, 0.200, 60),
    (v_p36, 'رز تايلندي 5كغ', '6251500000369', v_cat_grocery, 'المصطفى', 4, 13.000, 15.200, 4.000, 8),
    (v_p37, 'زيت زيتون بلدي 1لتر', '6251500000376', v_cat_grocery, 'الزيود', 12, 54.000, 66.000, 6.000, 12),
    (v_p38, 'معجون طماطم 135غم', '6251500000383', v_cat_grocery, 'الدرة', 24, 4.800, 6.000, 0.300, 48),
    (v_p39, 'طحينية سمسم 500غم', '6251500000390', v_cat_grocery, 'الأصيل', 12, 18.000, 21.600, 2.000, 12),
    (v_p40, 'ملح طعام 700غم', '6251500000406', v_cat_grocery, 'الصفي', 20, 2.000, 3.000, 0.180, 40),
    (v_p41, 'شاي أحمر 100 ميدالية', '6251500000413', v_cat_grocery, 'ربيع', 12, 18.000, 22.800, 2.100, 12),
    (v_p42, 'مشروب غازي برتقال 330مل', '6281600000420', v_cat_soda, 'ميرندا', 24, 6.240, 7.680, 0.400, 48),
    (v_p43, 'كولا دايت 330مل', '6281600000437', v_cat_soda, 'بيبسي', 24, 6.240, 7.680, 0.400, 48),
    (v_p44, 'مشروب طاقة 250مل', '6281600000444', v_cat_soda, 'ريد بول', 24, 18.000, 22.800, 1.000, 24),
    (v_p45, 'مناديل رول مطبخ 2 رول', '6251700000451', v_cat_clean, 'فاين', 12, 9.600, 12.000, 1.100, 24),
    (v_p46, 'سائل غسيل صحون 1لتر', '6251700000468', v_cat_clean, 'هاي جين', 12, 9.000, 11.400, 1.000, 24),
    (v_p47, 'مسحوق غسيل 1كغ', '6251700000475', v_cat_clean, 'أريال', 10, 18.000, 22.000, 2.400, 20),
    (v_p48, 'مطهر عام 1لتر', '6251700000482', v_cat_clean, 'ديتول', 12, 24.000, 30.000, 2.750, 12)
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------
  -- 4) العملاء
  -- -------------------------------------------------------------------
  insert into public.customers (id, name, shop_name, phone, whatsapp, area, address, credit_limit, notes) values
    (v_c1, 'أبو أحمد', 'محل النور ماركت', '0795551001', '0795551001', 'خلدا', 'شارع وصفي التل - خلدا', 500, 'زبون قديم وملتزم بالدفع'),
    (v_c2, 'أم محمد', 'سوبرماركت الزهراء', '0785551002', '0785551002', 'صويلح', 'دوار صويلح - مقابل البنك', null, null),
    (v_c3, 'أبو خليل', 'بقالة الحي', '0775551003', null, 'الجبيهة', 'حي الريان - الجبيهة', 300, 'يفضل الدفع نهاية الأسبوع'),
    (v_c4, 'سامر عوض', 'ميني ماركت السعادة', '0795551004', '0795551004', 'تلاع العلي', 'شارع المدينة المنورة', null, null),
    (v_c5, 'أبو يوسف', 'محلات الفردوس', '0785551005', '0785551005', 'الهاشمي الشمالي', 'شارع الهاشمي الرئيسي', 400, null)
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------
  -- 5) الموردون
  -- -------------------------------------------------------------------
  insert into public.suppliers (id, name, company_name, phone, whatsapp, area, notes) values
    (v_s1, 'أبو خالد', 'شركة المنار للتوزيع الغذائي', '0791112001', '0791112001', 'ماركا الشمالية', 'مورد الشيبس والبسكويت'),
    (v_s2, 'م. حسام قاسم', 'مؤسسة الأردن للمواد الغذائية', '0781112002', null, 'البيادر', 'مواد تموينية وزيوت'),
    (v_s3, 'أبو رامي', 'شركة النخبة للمشروبات', '0771112003', '0771112003', 'سحاب', 'مشروبات غازية وعصائر ومياه')
  on conflict (id) do nothing;

  -- سعر خاص: أبو أحمد يأخذ كرتونة الشيبس كتشب بـ 8.200
  insert into public.customer_prices (customer_id, product_id, unit, price)
  values (v_c1, v_p01, 'carton', 8.200)
  on conflict (customer_id, product_id, unit) do nothing;

  -- -------------------------------------------------------------------
  -- 6) المشتريات (تُنشئ المخزون ومتوسط التكلفة عبر نفس دوال النظام)
  -- -------------------------------------------------------------------
  -- شراء 1: قبل 9 أيام — من المنار (شيبس وبسكويت وشوكولاتة)
  v_res := public.create_purchase(jsonb_build_object(
    'supplier_id', v_s1,
    'purchase_date', (now() - interval '9 days')::text,
    'supplier_invoice_no', 'M-4021',
    'paid', 250,
    'payment_method', 'cash',
    'notes', 'توريد أسبوعي',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p01, 'unit', 'carton', 'qty', 30, 'unit_cost', 7.200),
      jsonb_build_object('product_id', v_p02, 'unit', 'carton', 'qty', 20, 'unit_cost', 7.200),
      jsonb_build_object('product_id', v_p03, 'unit', 'carton', 'qty', 10, 'unit_cost', 5.400),
      jsonb_build_object('product_id', v_p08, 'unit', 'carton', 'qty', 15, 'unit_cost', 4.320),
      jsonb_build_object('product_id', v_p09, 'unit', 'carton', 'qty', 10, 'unit_cost', 6.000),
      jsonb_build_object('product_id', v_p10, 'unit', 'carton', 'qty', 12, 'unit_cost', 8.400),
      jsonb_build_object('product_id', v_p11, 'unit', 'carton', 'qty', 5, 'unit_cost', 15.600)
    )
  ));

  -- شراء 2: قبل 7 أيام — من الأردن للمواد الغذائية (تمويني)
  v_res := public.create_purchase(jsonb_build_object(
    'supplier_id', v_s2,
    'purchase_date', (now() - interval '7 days')::text,
    'paid', 150,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p12, 'unit', 'carton', 'qty', 10, 'unit_cost', 14.000),
      jsonb_build_object('product_id', v_p13, 'unit', 'carton', 'qty', 8, 'unit_cost', 6.500),
      jsonb_build_object('product_id', v_p14, 'unit', 'carton', 'qty', 10, 'unit_cost', 10.800),
      jsonb_build_object('product_id', v_p15, 'unit', 'carton', 'qty', 12, 'unit_cost', 5.000),
      jsonb_build_object('product_id', v_p18, 'unit', 'carton', 'qty', 10, 'unit_cost', 7.500)
    )
  ));

  -- شراء 3: قبل 6 أيام — من النخبة (مشروبات)
  v_res := public.create_purchase(jsonb_build_object(
    'supplier_id', v_s3,
    'purchase_date', (now() - interval '6 days')::text,
    'paid', 100,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p04, 'unit', 'carton', 'qty', 20, 'unit_cost', 5.760),
      jsonb_build_object('product_id', v_p05, 'unit', 'carton', 'qty', 15, 'unit_cost', 5.760),
      jsonb_build_object('product_id', v_p06, 'unit', 'carton', 'qty', 25, 'unit_cost', 1.800),
      jsonb_build_object('product_id', v_p07, 'unit', 'carton', 'qty', 20, 'unit_cost', 2.160),
      jsonb_build_object('product_id', v_p16, 'unit', 'carton', 'qty', 25, 'unit_cost', 6.240),
      jsonb_build_object('product_id', v_p17, 'unit', 'carton', 'qty', 15, 'unit_cost', 6.240)
    )
  ));

  -- شراء 4: قبل يومين — نفس الشيبس بسعر أعلى (يُظهر متوسط التكلفة المرجّح)
  v_res := public.create_purchase(jsonb_build_object(
    'supplier_id', v_s1,
    'purchase_date', (now() - interval '2 days')::text,
    'paid', 0,
    'notes', 'ارتفاع سعر التوريد هذا الأسبوع',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p01, 'unit', 'carton', 'qty', 20, 'unit_cost', 7.600),
      jsonb_build_object('product_id', v_p02, 'unit', 'carton', 'qty', 15, 'unit_cost', 7.600),
      jsonb_build_object('product_id', v_p16, 'unit', 'carton', 'qty', 10, 'unit_cost', 6.480)
    )
  ));

  -- -------------------------------------------------------------------
  -- 7) المبيعات
  -- -------------------------------------------------------------------
  -- بيع 1: قبل 6 أيام — أبو أحمد (آجل جزئي) بسعره الخاص للشيبس
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c1,
    'sale_date', (now() - interval '6 days')::text,
    'paid', 60,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p01, 'unit', 'carton', 'qty', 5, 'unit_price', 8.200),
      jsonb_build_object('product_id', v_p04, 'unit', 'carton', 'qty', 3, 'unit_price', 7.200),
      jsonb_build_object('product_id', v_p06, 'unit', 'carton', 'qty', 5, 'unit_price', 2.400),
      jsonb_build_object('product_id', v_p10, 'unit', 'carton', 'qty', 2, 'unit_price', 10.080)
    )
  ));
  v_sale1 := (v_res->>'id')::uuid;

  -- بيع 2: قبل 5 أيام — أم محمد (نقدي كامل)
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c2,
    'sale_date', (now() - interval '5 days')::text,
    'paid', 99.880,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p12, 'unit', 'carton', 'qty', 2, 'unit_price', 16.400),
      jsonb_build_object('product_id', v_p13, 'unit', 'carton', 'qty', 2, 'unit_price', 7.500),
      jsonb_build_object('product_id', v_p14, 'unit', 'carton', 'qty', 2, 'unit_price', 12.600),
      jsonb_build_object('product_id', v_p15, 'unit', 'carton', 'qty', 3, 'unit_price', 6.400),
      jsonb_build_object('product_id', v_p16, 'unit', 'carton', 'qty', 1, 'unit_price', 7.680)
    )
  ));

  -- بيع 3: قبل 4 أيام — أبو خليل (آجل بالكامل)
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c3,
    'sale_date', (now() - interval '4 days')::text,
    'paid', 0,
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p02, 'unit', 'carton', 'qty', 3, 'unit_price', 8.400),
      jsonb_build_object('product_id', v_p07, 'unit', 'carton', 'qty', 4, 'unit_price', 2.880),
      jsonb_build_object('product_id', v_p08, 'unit', 'carton', 'qty', 2, 'unit_price', 5.520),
      jsonb_build_object('product_id', v_p17, 'unit', 'carton', 'qty', 2, 'unit_price', 7.680)
    )
  ));
  v_sale2 := (v_res->>'id')::uuid;

  -- بيع 4: قبل 3 أيام — سامر (بيع بالحبة مع خصم سطر)
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c4,
    'sale_date', (now() - interval '3 days')::text,
    'paid', 30,
    'payment_method', 'cash',
    'invoice_discount', 0.500,
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p10, 'unit', 'piece', 'qty', 24, 'unit_price', 0.500),
      jsonb_build_object('product_id', v_p09, 'unit', 'carton', 'qty', 2, 'unit_price', 7.440, 'discount', 0.380),
      jsonb_build_object('product_id', v_p11, 'unit', 'piece', 'qty', 6, 'unit_price', 1.650)
    )
  ));
  v_sale3 := (v_res->>'id')::uuid;

  -- بيع 5: قبل يومين — أبو يوسف
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c5,
    'sale_date', (now() - interval '2 days')::text,
    'paid', 50,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p01, 'unit', 'carton', 'qty', 4, 'unit_price', 8.400),
      jsonb_build_object('product_id', v_p16, 'unit', 'carton', 'qty', 4, 'unit_price', 7.680),
      jsonb_build_object('product_id', v_p06, 'unit', 'carton', 'qty', 6, 'unit_price', 2.400),
      jsonb_build_object('product_id', v_p18, 'unit', 'carton', 'qty', 2, 'unit_price', 9.000)
    )
  ));

  -- بيع 6: أمس — زبون نقدي بدون تسجيل
  v_res := public.create_sale(jsonb_build_object(
    'sale_date', (now() - interval '1 day')::text,
    'paid', 24.500,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p04, 'unit', 'carton', 'qty', 2, 'unit_price', 7.200),
      jsonb_build_object('product_id', v_p07, 'unit', 'piece', 'qty', 12, 'unit_price', 0.150),
      jsonb_build_object('product_id', v_p13, 'unit', 'piece', 'qty', 6, 'unit_price', 0.800),
      jsonb_build_object('product_id', v_p15, 'unit', 'piece', 'qty', 10, 'unit_price', 0.350)
    )
  ));

  -- بيع 7: أمس — أم محمد مرة ثانية
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c2,
    'sale_date', (now() - interval '1 day')::text,
    'paid', 0,
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p01, 'unit', 'carton', 'qty', 3, 'unit_price', 8.400),
      jsonb_build_object('product_id', v_p05, 'unit', 'carton', 'qty', 2, 'unit_price', 7.200)
    )
  ));

  -- بيع 8: اليوم — أبو أحمد
  v_res := public.create_sale(jsonb_build_object(
    'customer_id', v_c1,
    'sale_date', (now() - interval '3 hours')::text,
    'paid', 40,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p01, 'unit', 'carton', 'qty', 3, 'unit_price', 8.200),
      jsonb_build_object('product_id', v_p16, 'unit', 'carton', 'qty', 2, 'unit_price', 7.680),
      jsonb_build_object('product_id', v_p08, 'unit', 'carton', 'qty', 2, 'unit_price', 5.520)
    )
  ));

  -- بيع 9: اليوم — بيع بالحبة سريع لزبون نقدي
  v_res := public.create_sale(jsonb_build_object(
    'sale_date', (now() - interval '1 hour')::text,
    'paid', 10.500,
    'payment_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('product_id', v_p10, 'unit', 'piece', 'qty', 12, 'unit_price', 0.500),
      jsonb_build_object('product_id', v_p03, 'unit', 'piece', 'qty', 5, 'unit_price', 0.600),
      jsonb_build_object('product_id', v_p07, 'unit', 'piece', 'qty', 10, 'unit_price', 0.150)
    )
  ));

  -- -------------------------------------------------------------------
  -- 8) دفعات تحصيل ديون
  -- -------------------------------------------------------------------
  perform public.record_customer_payment(jsonb_build_object(
    'customer_id', v_c1, 'amount', 30, 'method', 'cash',
    'payment_date', (now() - interval '3 days')::text,
    'notes', 'دفعة على الحساب'
  ));
  perform public.record_customer_payment(jsonb_build_object(
    'customer_id', v_c3, 'amount', 20, 'method', 'cash',
    'payment_date', (now() - interval '1 day')::text,
    'notes', 'دفعة أسبوعية'
  ));

  -- دفعة إضافية للمورد المنار على الحساب
  perform public.record_supplier_payment(jsonb_build_object(
    'supplier_id', v_s1, 'amount', 100, 'method', 'cash',
    'payment_date', (now() - interval '1 day')::text,
    'notes', 'دفعة على الحساب'
  ));

  -- -------------------------------------------------------------------
  -- 9) مرتجعات
  -- -------------------------------------------------------------------
  -- مرتجع سليم يعود للمخزون: من فاتورة أبو أحمد الأولى (كرتونة شيبس)
  select id into v_si from public.sale_items where sale_id = v_sale1 and product_id = v_p01 limit 1;
  perform public.create_return(jsonb_build_object(
    'sale_id', v_sale1,
    'return_date', (now() - interval '2 days')::text,
    'reason', 'قرب انتهاء الصلاحية',
    'refund_cash', 0,
    'items', jsonb_build_array(
      jsonb_build_object('sale_item_id', v_si, 'unit', 'carton', 'qty', 1, 'condition', 'good')
    )
  ));

  -- مرتجع تالف (خسارة): من فاتورة سامر (6 حبات شوكولاتة ذائبة)
  select id into v_si from public.sale_items where sale_id = v_sale3 and product_id = v_p10 limit 1;
  perform public.create_return(jsonb_build_object(
    'sale_id', v_sale3,
    'return_date', (now() - interval '1 day')::text,
    'reason', 'بضاعة تالفة - ذابت الشوكولاتة',
    'refund_cash', 3.000,
    'refund_method', 'cash',
    'items', jsonb_build_array(
      jsonb_build_object('sale_item_id', v_si, 'unit', 'piece', 'qty', 6, 'unit_price', 0.500, 'condition', 'damaged')
    )
  ));

  -- -------------------------------------------------------------------
  -- 10) مصروفات
  -- -------------------------------------------------------------------
  select id into v_cat_fuel from public.expense_categories where name = 'بنزين ووقود';
  select id into v_cat_maint from public.expense_categories where name = 'صيانة';

  perform public.create_expense(jsonb_build_object(
    'category_id', v_cat_fuel, 'amount', 25, 'method', 'cash',
    'expense_date', (now() - interval '4 days')::text, 'notes', 'تعبئة بنزين للباص'
  ));
  perform public.create_expense(jsonb_build_object(
    'category_id', v_cat_maint, 'amount', 35, 'method', 'cash',
    'expense_date', (now() - interval '2 days')::text, 'notes', 'تبديل زيت وفلتر'
  ));
  perform public.create_expense(jsonb_build_object(
    'category_id', v_cat_fuel, 'amount', 20, 'method', 'cash',
    'expense_date', (now() - interval '5 hours')::text, 'notes', 'بنزين'
  ));

  -- -------------------------------------------------------------------
  -- 11) الدفتر اليومي
  -- -------------------------------------------------------------------
  insert into public.notes (content, is_task, is_pinned, note_date, created_by) values
    ('أبو خليل وعد يدفع 50 دينار يوم الخميس القادم.', true, true, now() - interval '2 days', v_owner),
    ('وصلت تشكيلة جديدة من عصائر النخبة — الأسعار نفسها.', false, false, now() - interval '1 day', v_owner),
    ('الاتصال بمورد المنار بخصوص عرض نهاية الشهر على الشيبس.', true, false, now() - interval '4 hours', v_owner);

  raise notice 'Seed completed successfully.';
end;
$seed$;

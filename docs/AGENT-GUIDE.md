# دليل الأنماط — نظام رجائي المصري (للمطورين الآليين)

نظام Next.js 15 (App Router, Turbopack) + TypeScript strict + Tailwind v4 + Supabase. عربي RTL بالكامل.

## قواعد صارمة
1. **ممنوع إضافة أي حزمة npm جديدة.**
2. **ممنوع تعديل ملفات موجودة** إلا الملفات المذكورة في مهمتك حرفيًا. أنشئ ملفاتك الجديدة فقط.
3. Next 15: `const p = await params;` و `const sp = await searchParams;` (كلاهما Promise).
4. كل صفحة داخل `src/app/(app)/` محمية تلقائيًا بالـ layout، لكن استدعِ `requireProfile()` (من `@/lib/auth`) في أول السطر لجلب الدور، و`requireProfile(['owner','manager'])` لتقييد الأدوار.
5. الأرباح والتكاليف **لا تُعرض** إلا إذا `canSeeProfit(profile.role)` (من `@/lib/perms`). ولا تظهر أبدًا في أي صفحة طباعة للعميل.
6. كل الكتابات المالية عبر RPC فقط (انظر القائمة أدناه) — ممنوع insert/update مباشر على جداول مالية. البيانات الأساسية (products/customers/suppliers/categories/customer_prices/notes/expense_categories) يجوز كتابتها مباشرة عبر supabase client (الصلاحيات تحكمها RLS).
7. أضف `export const dynamic = 'force-dynamic';` لكل صفحة تقرأ بيانات.
8. النصوص للمستخدم عربية بالكامل. التعليقات البرمجية عربية مختصرة عند الحاجة فقط.
9. الأرقام المالية: 3 منازل عشرية عبر مكوّن `<Money value={n} />` أو `formatJOD(n)`. الكميات عبر `formatQty(units, unitsPerCarton)`.
10. بعد إنهاء ملفاتك شغّل `npx tsc --noEmit` من جذر المشروع وتأكد ألا يظهر أي خطأ يشير إلى ملفاتك (تجاهل أخطاء ملفات ليست لك — قد يعمل آخرون بالتوازي).
11. لا تشغّل `npm run build` ولا `npm run dev` ولا أي أمر git.

## الملفات المرجعية (اقرأها قبل البدء)
- أنواع قاعدة البيانات: `src/lib/types/db.ts`
- الحسابات: `src/lib/calc/money.ts`, `src/lib/calc/units.ts`
- التواريخ والفترات: `src/lib/format/date.ts` (فيه `periodRange`, `todayISO`, `fmtDateTime`, ...)
- مخططات التحقق: `src/lib/validation/schemas.ts`
- الأخطاء وActionResult: `src/lib/errors.ts`
- الإعدادات: `src/lib/settings.ts` (`getSettings()`, `paymentMethodLabels`)
- مكونات UI: `src/components/ui/*` (button, input [فيه Field/NumericInput/Select/Textarea], card, badge [StatusBadge], dialog [Dialog/ConfirmDialog], misc [Money/StatCard/PageHeader/EmptyState/Skeleton/Spinner], search-input, pagination, link-tabs, segmented, toast [useToast])
- حوار الإلغاء الموحّد: `src/components/void-dialog.tsx`
- زر الطباعة: `src/components/printing/print-button.tsx` + نموذج الإيصالات `src/lib/printing/receipt-model.ts` (فيه `buildStatementReceipt`) + `src/components/printing/receipt-view.tsx` + `src/components/printing/print-controller.tsx`
- **أمثلة كاملة تُحتذى**: صفحة قائمة `src/app/(app)/sales/page.tsx`، صفحة تفاصيل `src/app/(app)/sales/[id]/page.tsx`، استعلامات `src/server/queries/sales.ts`، أفعال `src/server/actions/sales.ts`، صفحة طباعة `src/app/print/sale/[id]/page.tsx`.

## عملاء Supabase
- Server Components/Actions: `const supabase = await createClient();` من `@/lib/supabase/server`.
- استدعاء RPC: `const { data, error } = await supabase.rpc('fn_name', { p: {...} });`
- الأخطاء: `import { actionErr, actionOk, toAppError } from '@/lib/errors'` — الدوال ترفع message=كود، details=رسالة عربية.

## قائمة الـ RPC المتاحة (الأسماء والمعاملات بدقة)
- `create_sale({p})`, `create_purchase({p})`, `create_return({p})` — راجع payload في `src/server/actions/sales.ts` والمخططات في schemas.ts
- `record_customer_payment({p: {customer_id, amount, method, sale_id?, payment_date?, notes?, client_ip?}})`
- `record_supplier_payment({p: {supplier_id, amount, method, purchase_id?, ...}})`
- `create_expense({p: {category_id, amount, method, expense_date?, notes?, attachment_url?, client_ip?}})`
- `cash_manual_tx({p: {tx_type: 'extra_income'|'owner_withdrawal'|'deposit'|'adjustment', direction?, amount, method, tx_date?, notes?}})`
- `void_sale({p_sale_id, p_reason, p_ip})`, `void_purchase({p_purchase_id, p_reason, p_ip})`, `void_payment({p_payment_id, p_reason, p_ip})`, `void_return({p_return_id, p_reason, p_ip})`, `void_expense({p_expense_id, p_reason, p_ip})`
- `adjust_stock({p: {product_id, mode:'set'|'delta', qty_units, reason, client_ip?}})`
- `start_inventory_count({p: {count_type, category_id?, notes?}})`, `set_count_item({p_count_id, p_product_id, p_actual})`, `complete_inventory_count({p_count_id, p_apply, p_ip})`, `cancel_inventory_count({p_count_id, p_ip})`
- `close_cash_session({p: {session_date?, actual_cash, notes?}})`, `cash_balance()` → jsonb {opening, cash_in, cash_out, balance, since, last_session_date}
- `report_dashboard()`, `report_sales({p_from, p_to, p_group: 'day'|'month'})` → {rows[], totals}, `report_profit_summary({p_from, p_to})`, `report_by_product({p_from, p_to, p_order:'revenue'|'qty'|'profit', p_dir, p_limit, p_offset})` → {rows[], total_count}, `report_by_customer({p_from, p_to, p_order:'sales'|'profit'|'paid', p_limit, p_offset})`, `report_expenses_summary({p_from, p_to})`, `report_stagnant_products({p_days})`, `report_debts({p_party: 'customer'|'supplier'})` → jsonb[]
- `customer_statement({p_customer_id, p_from, p_to})` → {customer, opening_balance, rows[{id,entry_type,ref_table,ref_id,debit,credit,entry_date,notes,running_balance}], total_debit, total_credit, closing_balance}
- `supplier_statement({p_supplier_id, p_from, p_to})` — نفس الشكل بمفتاح supplier
- `day_summary({p_date})` → jsonb (sales, returns, purchases, expenses, expenses_by_category, cash{...}, cash_balance, session)
- `product_lookup_barcode({p_code, p_customer_id?})`, `pos_products({p_q,p_category_id,p_customer_id,p_limit,p_offset})`, `customer_top_products({p_customer_id, p_limit})`, `global_search({p_q, p_limit})`
- كل التواريخ للتقارير من نوع DATE بصيغة `YYYY-MM-DD` (استخدم `periodRange`/`todayISO`).

- أنواع الحركات المالية للعرض: استخدم قواميس عربية محلية في ملفك، مثال حركة المخزون: purchase=شراء, sale=بيع, sale_return=مرتجع, sale_void=إلغاء بيع, purchase_void=إلغاء شراء, return_void=إلغاء مرتجع, adjustment=تعديل, count_adjustment=تسوية جرد. حركات الصندوق: sale_receipt=قبض مبيعات, customer_receipt=قبض من عميل, supplier_payment=دفع لمورد, expense=مصروف, extra_income=دخل إضافي, owner_withdrawal=سحب شخصي, deposit=إيداع, adjustment=تسوية, refund=استرداد. أنواع قيود الكشف: opening=رصيد سابق, sale=فاتورة, purchase=مشتريات, payment=دفعة, return=مرتجع, adjustment=تسوية, void=إلغاء.

## نمط الصفحات
- قائمة: PageHeader + فلاتر (SearchInput/LinkTabs/تواريخ) + Card تحتوي جدول `hidden lg:block` وبطاقات `lg:hidden` + Pagination. انسخ بنية sales/page.tsx حرفيًا وعدّل الأعمدة.
- Server Actions: ملف `'use server'` في `src/server/actions/<اسمك>.ts` يعيد `ActionResult<T>`؛ مرر `client_ip: await getClientIp()` (من `@/lib/auth`) داخل payload الـ RPC، و`revalidatePath` للمسارات المتأثرة.
- الاستعلامات: `src/server/queries/<اسمك>.ts` بنمط listX(params)/getX(id) مع أنواع صريحة.
- نماذج الإدخال: client components مع useState بسيطة + `useToast` للنجاح/الفشل + `router.refresh()` بعد النجاح. استخدم `parseMoney`/`parseQty` لقراءة الأرقام.
- التبويبات عبر `?tab=` مع LinkTabs. الفترات عبر `?period=` + `periodRange` أو from/to يدويًا كما في sales/page.tsx.

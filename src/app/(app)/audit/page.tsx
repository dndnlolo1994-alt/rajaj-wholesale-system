import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime } from '@/lib/format/date';
import type { AuditLog } from '@/lib/types/db';
import { AuditRowDetails } from './row-details';

export const metadata = { title: 'سجل التدقيق' };
export const dynamic = 'force-dynamic';

const actionLabels: Record<string, string> = {
  'sale.create': 'إنشاء فاتورة بيع',
  'sale.void': 'إلغاء فاتورة بيع',
  'purchase.create': 'إنشاء مشتريات',
  'purchase.void': 'إلغاء مشتريات',
  'return.create': 'إنشاء مرتجع',
  'return.void': 'إلغاء مرتجع',
  'payment.customer_receipt': 'قبض من عميل',
  'payment.supplier_payment': 'دفع لمورد',
  'payment.void': 'إلغاء سند',
  'expense.create': 'تسجيل مصروف',
  'expense.void': 'إلغاء مصروف',
  'stock.adjust': 'تعديل مخزون',
  'count.start': 'فتح جرد',
  'count.complete': 'اعتماد جرد',
  'count.cancel': 'إلغاء جرد',
  'cash.manual': 'حركة صندوق يدوية',
  'cash.close_session': 'إغلاق الصندوق',
  'auth.login': 'تسجيل دخول',
  'auth.login_failed': 'محاولة دخول فاشلة',
  'user.create': 'إنشاء مستخدم',
  'user.update': 'تعديل مستخدم',
  'product.create': 'إضافة صنف',
  'product.update': 'تعديل صنف',
  'product.delete': 'حذف صنف',
  'customer.create': 'إضافة عميل',
  'customer.update': 'تعديل عميل',
  'customer.delete': 'حذف عميل',
  'supplier.create': 'إضافة مورد',
  'supplier.update': 'تعديل مورد',
  'supplier.delete': 'حذف مورد',
  'category.create': 'إضافة قسم',
  'category.update': 'تعديل قسم',
  'category.delete': 'حذف قسم',
  'customer_price.create': 'سعر خاص جديد',
  'customer_price.update': 'تعديل سعر خاص',
  'customer_price.delete': 'حذف سعر خاص',
  'setting.update': 'تغيير إعدادات',
  'system.reset': 'تصفير البيانات',
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; q?: string }>;
}) {
  await requireProfile(['owner', 'manager']);
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 40;

  const supabase = await createClient();
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (sp.action) query = query.eq('action', sp.action);
  if (sp.q) query = query.or(`entity_id.ilike.%${sp.q}%,user_name.ilike.%${sp.q}%`);
  const { data, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const rows = (data ?? []) as AuditLog[];

  return (
    <div>
      <PageHeader title="سجل التدقيق" description="متابعة داخلية للعمليات الحساسة عند الحاجة" />

      <form method="get" className="mb-3 flex flex-wrap gap-2">
        <select name="action" defaultValue={sp.action ?? ''} className="h-11 rounded-lg border border-ink-300 bg-white px-3 text-sm">
          <option value="">كل العمليات</option>
          {Object.entries(actionLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input name="q" defaultValue={sp.q ?? ''} placeholder="بحث بالمستخدم أو المعرف..."
          className="h-11 w-64 rounded-lg border border-ink-300 bg-white px-3 text-sm" />
        <button type="submit" className="h-11 rounded-lg border border-ink-300 bg-white px-4 text-sm font-bold hover:bg-ink-100">
          تصفية
        </button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="سجل التدقيق فارغ الآن" description="تم تنظيف السجل، وستظهر هنا العمليات الجديدة فقط." />
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((log) => (
              <AuditRowDetails
                key={log.id}
                log={log}
                actionLabel={actionLabels[log.action] ?? log.action}
                dateText={fmtDateTime(log.created_at)}
              />
            ))}
          </div>
        )}
      </Card>
      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}

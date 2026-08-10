import { Download, FileDown, FileJson, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fmtDateTime, fmtRelative, todayISO, monthStartISO } from '@/lib/format/date';
import type { BackupLog } from '@/lib/types/db';

export const metadata = { title: 'النسخ الاحتياطي' };
export const dynamic = 'force-dynamic';

const typeLabels = { manual: 'يدوي', auto: 'تلقائي', export: 'تصدير' } as const;

export default async function BackupPage() {
  await requireProfile(['owner', 'manager']);
  const settings = await getSettings();
  const supabase = await createClient();
  const { data } = await supabase
    .from('backup_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(30);
  const logs = (data ?? []) as BackupLog[];
  const lastSuccess = logs.find((l) => l.status === 'success');

  const csvReports = [
    ['sales', 'المبيعات'],
    ['products', 'المبيعات حسب الصنف'],
    ['customers', 'العملاء'],
    ['purchases', 'المشتريات'],
    ['expenses', 'المصروفات'],
    ['customer-debts', 'ديون العملاء'],
    ['supplier-debts', 'ديون الموردين'],
    ['stock', 'المخزون الحالي'],
  ] as const;
  const from = monthStartISO(0);
  const to = todayISO();

  return (
    <div className="space-y-4">
      <PageHeader title="النسخ الاحتياطي" description="بياناتك التجارية لا يجوز أن تضيع — نسخ يدوية وتلقائية واسترجاع موثّق" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="آخر نسخة ناجحة"
          value={lastSuccess ? fmtRelative(lastSuccess.finished_at ?? lastSuccess.started_at) : 'لا يوجد بعد'}
          sub={lastSuccess ? `${lastSuccess.rows_count ?? '—'} سجل` : 'نزّل نسخة الآن'}
          tone={lastSuccess ? 'success' : 'warning'}
        />
        <StatCard
          title="النسخ التلقائي"
          value={settings.backup.auto_enabled ? 'مفعّل' : 'معطّل'}
          sub="يوميًا 2 فجرًا (عند النشر على Vercel)"
          tone={settings.backup.auto_enabled ? 'success' : 'warning'}
        />
        <StatCard title="مدة الاحتفاظ" value={`${settings.backup.retention_days} يوم`} sub="للنسخ التلقائية في التخزين" />
      </div>

      <Card>
        <CardHeader title="نسخة كاملة الآن" />
        <CardBody className="space-y-3">
          <p className="text-sm leading-6 text-ink-700">
            ملف JSON واحد يحوي كل الجداول (الأصناف، العملاء، الفواتير، الحركات، الدفاتر...).
            احتفظ به في مكان آمن خارج الجهاز — يُستخدم للاسترجاع الكامل وفق docs/BACKUP.md.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/backup/export"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-800 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-primary-900"
            >
              <Download className="size-4" />
              تنزيل نسخة JSON كاملة
            </a>
            <a
              href="/api/reports/full-pdf"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 text-sm font-extrabold text-primary-900 hover:bg-primary-100"
            >
              <FileDown className="size-4" />
              تنزيل تقرير PDF كامل
            </a>
          </div>
          <p className="text-xs text-ink-500">
            إضافة إلى ذلك: Supabase يحتفظ بنسخ يومية على مستوى قاعدة البيانات (حسب خطة مشروعك)،
            ويمكن محليًا تشغيل <code dir="ltr" className="rounded bg-ink-100 px-1">npm run backup:local</code>.
          </p>
        </CardBody>
      </Card>

      <Card className="border-emerald-200 bg-gradient-to-l from-emerald-50/80 to-white">
        <CardBody className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-extrabold text-emerald-950">حماية البيانات مفعلة</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900/75">
              السجلات المالية لا تُحذف نهائيًا، وتُستخدم عملية الإلغاء مع سجل تدقيق محفوظ. كما أُغلق تصفير البيانات من حسابات التطبيق.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="تصدير بيانات مفتوح (CSV لبرنامج Excel)" />
        <CardBody>
          <p className="mb-3 text-sm text-ink-500">بياناتك ليست حبيسة النظام — صدّر أي جدول (الفترة: هذا الشهر):</p>
          <div className="flex flex-wrap gap-2">
            {csvReports.map(([key, label]) => (
              <a
                key={key}
                href={`/api/export?report=${key}&from=${from}&to=${to}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-bold text-ink-700 hover:border-primary-400 hover:text-primary-800"
              >
                <FileSpreadsheet className="size-3.5" />
                {label}
              </a>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="سجل النسخ الاحتياطية" />
        {logs.length === 0 ? (
          <EmptyState icon={<FileJson className="size-8" />} title="لا نسخ بعد" description="نزّل أول نسخة من الأعلى" />
        ) : (
          <div className="divide-y divide-ink-100">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {typeLabels[log.backup_type]} — {log.file_name ?? '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {fmtDateTime(log.started_at)}
                    {log.rows_count != null ? ` — ${log.rows_count} سجل` : ''}
                    {log.file_size != null ? ` — ${(log.file_size / 1024 / 1024).toFixed(2)} MB` : ''}
                    {log.error ? ` — ${log.error}` : ''}
                  </p>
                </div>
                <Badge tone={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'info'}>
                  {log.status === 'success' ? 'نجحت' : log.status === 'failed' ? 'فشلت' : 'جارية'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

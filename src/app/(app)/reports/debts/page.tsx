import { HandCoins } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { reportDebts } from '@/server/queries/reports';
import { ExportButton } from '@/components/reports/export-button';
import { EmptyState, Money, PageHeader, StatCard } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LinkTabs } from '@/components/ui/link-tabs';
import { round3 } from '@/lib/calc/money';
import { fmtDateShort, todayISO } from '@/lib/format/date';

export const metadata = { title: 'تقرير الديون' };
export const dynamic = 'force-dynamic';

interface SP {
  tab?: string;
}

export default async function DebtsReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireProfile();
  const sp = await searchParams;
  const tab = sp.tab === 'suppliers' ? 'suppliers' : 'customers';
  const isSuppliers = tab === 'suppliers';
  const today = todayISO();

  const rows = await reportDebts(isSuppliers ? 'supplier' : 'customer');
  const total = round3(rows.reduce((acc, r) => acc + Number(r.balance), 0));
  const late60 = rows.filter((r) => r.days_since_payment >= 60).length;

  return (
    <div id="report-print">
      <style>{`@media print { .no-print { display: none !important; } #report-print { width: 100%; } }`}</style>
      <PageHeader
        title="تقرير الديون"
        description={isSuppliers ? 'ما علينا للموردين' : 'ما لنا عند العملاء'}
        actions={
          <ExportButton reportKey={isSuppliers ? 'supplier-debts' : 'customer-debts'} from={today} to={today} />
        }
      />

      <div className="no-print">
        <LinkTabs
          tabs={[
            { value: 'customers', label: 'عملاء' },
            { value: 'suppliers', label: 'موردون' },
          ]}
          className="mb-3"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          title={isSuppliers ? 'إجمالي ديون الموردين' : 'إجمالي ديون العملاء'}
          value={<Money value={total} />}
          tone="danger"
          icon={<HandCoins className="size-5" />}
        />
        <StatCard title={isSuppliers ? 'مورد دائن' : 'عميل مدين'} value={<span className="tnum">{rows.length}</span>} />
        <StatCard
          title="متأخرة 60 يومًا أو أكثر"
          value={<span className="tnum">{late60}</span>}
          tone={late60 > 0 ? 'danger' : 'default'}
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={isSuppliers ? 'لا ديون للموردين' : 'لا ديون على العملاء'}
            description="كل الأرصدة مسدّدة ✓"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-3 text-start font-bold">الاسم</th>
                  <th className="px-4 py-3 text-start font-bold">الهاتف</th>
                  <th className="px-4 py-3 text-end font-bold">الرصيد</th>
                  <th className="px-4 py-3 text-start font-bold">آخر دفعة</th>
                  <th className="px-4 py-3 text-center font-bold">الأيام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      <p className="font-bold">{r.name}</p>
                      {r.sub_name ? <p className="text-xs text-ink-500">{r.sub_name}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span dir="ltr" className="tnum text-ink-700">{r.phone ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-end"><Money value={r.balance} className="text-red-600" /></td>
                    <td className="px-4 py-3 text-ink-500">{fmtDateShort(r.last_payment_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        tone={r.days_since_payment >= 60 ? 'danger' : r.days_since_payment >= 30 ? 'warning' : 'muted'}
                      >
                        <span className="tnum">{r.days_since_payment}</span> يوم
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

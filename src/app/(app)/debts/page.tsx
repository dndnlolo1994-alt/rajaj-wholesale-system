import { CalendarClock, HandCoins, Users } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Money, StatCard } from '@/components/ui/misc';
import { LinkTabs } from '@/components/ui/link-tabs';
import { AgingFilter, type DebtRow } from './aging-filter';

export const metadata = { title: 'الديون' };
export const dynamic = 'force-dynamic';

async function fetchDebts(party: 'customer' | 'supplier'): Promise<DebtRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_debts', { p_party: party });
  if (error) throw new Error(error.message);
  return (data ?? []) as DebtRow[];
}

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireProfile();
  const sp = await searchParams;
  const tab = sp.tab === 'suppliers' ? 'suppliers' : 'customers';
  const isCustomers = tab === 'customers';

  const rows = await fetchDebts(isCustomers ? 'customer' : 'supplier');

  const totalDebt = rows.reduce((a, r) => a + Number(r.balance), 0);
  const oldest = rows.reduce<DebtRow | null>(
    (acc, r) => (acc == null || r.days_since_payment > acc.days_since_payment ? r : acc),
    null,
  );

  return (
    <div>
      <PageHeader
        title="الديون"
        description={isCustomers ? 'أرصدة العملاء المستحقة لنا' : 'أرصدة الموردين المستحقة عليهم'}
      />

      <LinkTabs
        tabs={[
          { value: 'customers', label: 'ديون العملاء' },
          { value: 'suppliers', label: 'مستحقات الموردين' },
        ]}
        className="mb-3"
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title={isCustomers ? 'إجمالي ديون العملاء' : 'إجمالي المستحق للموردين'}
          value={<Money value={totalDebt} className={totalDebt > 0 ? 'text-red-600' : undefined} />}
          tone="danger"
          icon={<HandCoins className="size-5" />}
        />
        <StatCard
          title={isCustomers ? 'عدد العملاء المدينين' : 'عدد الموردين الدائنين'}
          value={<span className="tnum">{rows.length}</span>}
          tone="info"
          icon={<Users className="size-5" />}
        />
        <StatCard
          title="أقدم دين"
          value={oldest ? <span className="tnum">{oldest.days_since_payment} يوم</span> : '—'}
          sub={oldest ? `${oldest.name}` : 'لا ديون'}
          tone="warning"
          icon={<CalendarClock className="size-5" />}
        />
      </div>

      <AgingFilter party={tab} rows={rows} />
    </div>
  );
}

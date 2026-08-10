import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/misc';
import { LinkTabs } from '@/components/ui/link-tabs';
import type { Profile } from '@/lib/types/db';
import {
  BusinessForm, SystemForm, PrinterForm, BackupForm, UsersSection, DataProtectionPanel,
} from './forms';

export const metadata = { title: 'الإعدادات' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireProfile(['owner']);
  const { tab = 'business' } = await searchParams;
  const settings = await getSettings();

  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at');

  return (
    <div>
      <PageHeader title="الإعدادات" description="إعدادات النشاط والنظام والطباعة والمستخدمين" />
      <LinkTabs
        tabs={[
          { value: 'business', label: 'النشاط التجاري' },
          { value: 'system', label: 'النظام والمبيعات' },
          { value: 'printer', label: 'الطابعة' },
          { value: 'users', label: 'المستخدمون' },
          { value: 'backup', label: 'النسخ الاحتياطي' },
          { value: 'protection', label: 'حماية البيانات' },
        ]}
        className="mb-4"
      />

      <div className="max-w-2xl">
        {tab === 'business' ? <BusinessForm business={settings.business} invoice={settings.invoice} /> : null}
        {tab === 'system' ? (
          <SystemForm sales={settings.sales} inventory={settings.inventory} debts={settings.debts} cashbox={settings.cashbox} />
        ) : null}
        {tab === 'printer' ? <PrinterForm printer={settings.printer} /> : null}
        {tab === 'users' ? <UsersSection profiles={(profiles ?? []) as Profile[]} /> : null}
        {tab === 'backup' ? <BackupForm backup={settings.backup} /> : null}
        {tab === 'protection' ? <DataProtectionPanel /> : null}
      </div>
    </div>
  );
}

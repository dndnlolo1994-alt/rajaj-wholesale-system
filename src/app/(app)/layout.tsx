import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const settings = await getSettings();
  const supabase = await createClient();

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  return (
    <AppShell
      profile={{ full_name: profile.full_name, role: profile.role }}
      businessName={settings.business.owner_name}
      unreadCount={count ?? 0}
    >
      {children}
    </AppShell>
  );
}

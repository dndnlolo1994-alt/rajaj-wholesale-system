import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';

/** عدد التنبيهات غير المقروءة — استعلام مستقل حتى يمشي بالتوازي مع الباقي. */
async function unreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);
  return count ?? 0;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // بالتوازي: كل استعلام رحلة كاملة لقاعدة البيانات، والتسلسل كان يجمعها على بعض
  const [profile, settings, count] = await Promise.all([
    requireProfile(),
    getSettings(),
    unreadCount(),
  ]);

  return (
    <AppShell
      profile={{ full_name: profile.full_name, role: profile.role }}
      businessName={settings.business.owner_name}
      ownerPhotoUrl={settings.business.owner_photo_url}
      unreadCount={count}
    >
      {children}
    </AppShell>
  );
}

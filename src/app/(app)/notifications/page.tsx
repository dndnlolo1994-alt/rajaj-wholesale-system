import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/misc';
import { LinkTabs } from '@/components/ui/link-tabs';
import { Pagination } from '@/components/ui/pagination';
import type { Notification } from '@/lib/types/db';
import { NotificationsClient } from './notifications-client';

export const metadata = { title: 'التنبيهات' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  await requireProfile();
  const sp = await searchParams;
  const tab = sp.tab === 'all' ? 'all' : 'unread';
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 30;

  const supabase = await createClient();
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (tab === 'unread') query = query.eq('is_read', false);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);

  return (
    <div>
      <PageHeader title="التنبيهات" description={`${count ?? 0} تنبيه`} />
      <LinkTabs
        tabs={[
          { value: 'unread', label: 'غير المقروءة' },
          { value: 'all', label: 'الكل' },
        ]}
        className="mb-3"
      />
      <NotificationsClient rows={(data ?? []) as Notification[]} />
      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}

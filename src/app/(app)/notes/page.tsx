import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/misc';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { NotesClient, type NoteRow } from './notes-client';

export const metadata = { title: 'الدفتر اليومي' };
export const dynamic = 'force-dynamic';

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireProfile();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;

  const supabase = await createClient();
  let query = supabase
    .from('notes')
    .select('*, creator:profiles(full_name)', { count: 'exact' })
    .order('is_pinned', { ascending: false })
    .order('note_date', { ascending: false });
  if (sp.q) query = query.ilike('content', `%${sp.q}%`);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as NoteRow[];

  return (
    <div>
      <PageHeader title="الدفتر اليومي" description={`${count ?? 0} ملاحظة`} />
      <div className="mb-3">
        <SearchInput placeholder="بحث في الملاحظات..." className="w-full sm:w-80" />
      </div>
      <NotesClient rows={rows} />
      <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
    </div>
  );
}

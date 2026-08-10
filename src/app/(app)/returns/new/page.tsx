import { requireProfile } from '@/lib/auth';
import { getReturnableSale } from '@/server/queries/returns';
import { ReturnClient } from './return-client';

export const metadata = { title: 'مرتجع جديد' };
export const dynamic = 'force-dynamic';

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ sale?: string }>;
}) {
  await requireProfile(['owner', 'manager', 'sales']);
  const sp = await searchParams;
  const data = sp.sale ? await getReturnableSale(sp.sale) : null;

  return <ReturnClient data={data} saleNotFound={Boolean(sp.sale) && !data} />;
}

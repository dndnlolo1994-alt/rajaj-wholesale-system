import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { PurchaseClient } from './purchase-client';

export const metadata = { title: 'فاتورة مشتريات جديدة' };
export const dynamic = 'force-dynamic';

export default async function NewPurchasePage() {
  await requireProfile(['owner', 'manager', 'warehouse']);
  const settings = await getSettings();

  return <PurchaseClient defaultMethod={settings.sales.default_payment_method} />;
}

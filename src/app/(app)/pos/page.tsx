import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import type { Category } from '@/lib/types/db';
import { posProductsAction } from '@/server/actions/pos';
import { PosClient } from './pos-client';

export const metadata = { title: 'بيع جديد' };
export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const [, settings, supabase, initialProductsRes] = await Promise.all([
    requireProfile(['owner', 'manager', 'sales']),
    getSettings(),
    createClient(),
    posProductsAction({}),
  ]);

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  return (
    <PosClient
      categories={(categories ?? []) as Category[]}
      initialProducts={initialProductsRes.ok ? initialProductsRes.data : []}
      allowNegativeStock={settings.inventory.allow_negative_stock}
      defaultMethod={settings.sales.default_payment_method}
      printerWidth={settings.printer.paper_width}
      autoPrint={settings.printer.auto_print}
    />
  );
}

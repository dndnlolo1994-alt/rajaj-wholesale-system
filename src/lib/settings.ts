import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/settings-shared';

export {
  DEFAULT_SETTINGS,
  paymentMethodLabels,
  type AppSettings,
  type BusinessSettings,
  type PrinterSettings,
} from '@/lib/settings-shared';

/** قراءة كل الإعدادات (مخزّنة مؤقتًا لكل طلب). */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('key, value');
  const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const row of (data ?? []) as { key: string; value: Record<string, unknown> }[]) {
    if (merged[row.key] && row.value && typeof row.value === 'object') {
      merged[row.key] = { ...merged[row.key], ...row.value };
    }
  }
  return merged as unknown as AppSettings;
});

import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * عميل الخدمة (Service Role) — يتجاوز RLS.
 * يُستخدم فقط في مسارات الخادم المحمية: النسخ الاحتياطي، إنشاء المستخدمين.
 * لا يصل هذا المفتاح إلى المتصفح إطلاقًا.
 */
export function createAdminClient() {
  if (!env.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY غير مضبوط في متغيرات البيئة');
  }
  return createSupabaseClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

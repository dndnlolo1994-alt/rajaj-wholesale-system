'use client';

import { createBrowserClient } from '@supabase/ssr';

/** عميل Supabase للمتصفح (مفتاح anon فقط — الصلاحيات عبر RLS) */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

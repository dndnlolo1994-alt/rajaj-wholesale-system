import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types/db';

/** جلب ملف المستخدم الحالي (مخزّن مؤقتًا لكل طلب) */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return (data as Profile | null) ?? null;
});

/** يتطلب مستخدمًا فعّالًا — وإلا يعيد التوجيه لتسجيل الدخول */
export async function requireProfile(roles?: UserRole[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/login?error=inactive');
  if (roles && !roles.includes(profile.role)) redirect('/?error=forbidden');
  return profile;
}

/** عنوان IP للعميل (للتدقيق) */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip');
}

export const roleLabels: Record<UserRole, string> = {
  owner: 'المالك',
  manager: 'مدير',
  sales: 'موظف مبيعات',
  warehouse: 'موظف مستودع',
  accountant: 'محاسب',
};

'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';

async function auditAuth(action: string, email: string, userId: string | null) {
  if (!env.serviceRoleKey) return;
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      user_id: userId,
      action,
      entity: 'auth',
      entity_id: email,
      ip: await getClientIp(),
    });
  } catch {
    // فشل تسجيل التدقيق لا يمنع تسجيل الدخول
  }
}

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<undefined>> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return actionErr({ message: 'INVALID_INPUT', details: 'أدخل البريد وكلمة المرور.' });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });

  if (error) {
    await auditAuth('auth.login_failed', email, null);
    const msg =
      error.code === 'invalid_credentials'
        ? 'بيانات الدخول غير صحيحة.'
        : error.code === 'email_not_confirmed'
          ? 'البريد غير مؤكد.'
          : 'تعذر تسجيل الدخول. حاول مرة أخرى.';
    return actionErr({ message: 'LOGIN_FAILED', details: msg });
  }

  await auditAuth('auth.login', email, data.user?.id ?? null);
  return actionOk(undefined);
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';

const OWNER_LOGIN_NAME = 'almasri';
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MINUTES = 15;

async function auditAuth(action: string, loginName: string, userId: string | null, ip: string | null) {
  if (!env.serviceRoleKey) return;
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      user_id: userId,
      action,
      entity: 'auth',
      entity_id: loginName,
      ip,
    });
  } catch {
    // فشل تسجيل التدقيق لا يمنع تسجيل الدخول
  }
}

async function resolveLoginEmail(loginName: string): Promise<string | null> {
  if (loginName.includes('@')) return loginName;
  if (loginName !== OWNER_LOGIN_NAME || !env.serviceRoleKey) return null;

  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (ownerError || !owner) return null;
  const { data, error } = await admin.auth.admin.getUserById(owner.id);
  return error ? null : (data.user.email ?? null);
}

async function isRateLimited(loginName: string, ip: string | null): Promise<boolean> {
  if (!env.serviceRoleKey) return false;
  const admin = createAdminClient();
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const byLogin = admin
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'auth.login_failed')
    .eq('entity_id', loginName)
    .gte('created_at', since);
  const byIp = ip
    ? admin
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'auth.login_failed')
        .eq('ip', ip)
        .gte('created_at', since)
    : null;
  const [loginResult, ipResult] = await Promise.all([byLogin, byIp]);
  return (loginResult.count ?? 0) >= MAX_LOGIN_ATTEMPTS || (ipResult?.count ?? 0) >= MAX_LOGIN_ATTEMPTS;
}

export async function loginAction(input: { loginName: string; password: string }): Promise<ActionResult<undefined>> {
  const loginName = input.loginName.trim().toLowerCase();
  if (!loginName || loginName.length > 254 || !input.password || input.password.length > 200) {
    return actionErr({ message: 'INVALID_INPUT', details: 'أدخل اسم المستخدم وكلمة المرور.' });
  }

  const ip = await getClientIp();
  if (await isRateLimited(loginName, ip)) {
    await auditAuth('auth.login_blocked', loginName, null, ip);
    return actionErr({
      message: 'TOO_MANY_ATTEMPTS',
      details: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.',
    });
  }

  const email = await resolveLoginEmail(loginName);
  if (!email) {
    await auditAuth('auth.login_failed', loginName, null, ip);
    return actionErr({ message: 'LOGIN_FAILED', details: 'بيانات الدخول غير صحيحة.' });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });

  if (error) {
    await auditAuth('auth.login_failed', loginName, null, ip);
    const msg =
      error.code === 'invalid_credentials'
        ? 'بيانات الدخول غير صحيحة.'
        : error.code === 'email_not_confirmed'
          ? 'البريد غير مؤكد.'
          : 'تعذر تسجيل الدخول. حاول مرة أخرى.';
    return actionErr({ message: 'LOGIN_FAILED', details: msg });
  }

  await auditAuth('auth.login', loginName, data.user?.id ?? null, ip);
  return actionOk(undefined);
}

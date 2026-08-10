'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import { env } from '@/lib/env';
import type { UserRole } from '@/lib/types/db';

// تحديث الإعدادات — للمالك فقط، مع تحقق لكل مفتاح

const settingSchemas: Record<string, z.ZodType> = {
  business: z.object({
    owner_name: z.string().trim().min(1),
    business_name: z.string().trim().min(1),
    phone: z.string().trim(),
    address: z.string().trim(),
    logo_url: z.string().nullable(),
    invoice_footer: z.string().trim(),
  }),
  invoice: z.object({
    prefix: z.string().trim().min(1).max(6),
    purchase_prefix: z.string().trim().min(1).max(6),
    return_prefix: z.string().trim().min(1).max(6),
    receipt_prefix: z.string().trim().min(1).max(6),
    voucher_prefix: z.string().trim().min(1).max(6),
    expense_prefix: z.string().trim().min(1).max(6),
    count_prefix: z.string().trim().min(1).max(6),
  }),
  sales: z.object({
    default_payment_method: z.enum(['cash', 'bank_transfer', 'wallet', 'cheque', 'other']),
    big_invoice_threshold: z.number().nonnegative(),
  }),
  inventory: z.object({
    allow_negative_stock: z.boolean(),
    stagnant_days: z.number().int().min(1).max(365),
  }),
  debts: z.object({
    old_debt_days: z.number().int().min(1).max(365),
    critical_debt_days: z.number().int().min(1).max(730),
  }),
  cashbox: z.object({
    opening_balance: z.number(),
  }),
  printer: z.object({
    paper_width: z.union([z.literal(58), z.literal(80)]),
    mode: z.enum(['browser', 'bridge']),
    bridge_url: z.string().trim(),
    printer_ip: z.string().trim(),
    printer_port: z.number().int().min(1).max(65535),
    copies: z.number().int().min(1).max(5),
    auto_print: z.boolean(),
    printer_name: z.string().trim(),
    cut: z.boolean(),
    cash_drawer: z.boolean(),
  }),
  backup: z.object({
    auto_enabled: z.boolean(),
    retention_days: z.number().int().min(7).max(365),
  }),
};

export async function updateSettingAction(key: string, value: unknown): Promise<ActionResult<undefined>> {
  await requireProfile(['owner']);
  const schema = settingSchemas[key];
  if (!schema) return actionErr({ message: 'INVALID_KEY', details: 'مفتاح إعدادات غير معروف' });
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'قيم غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: parsed.data as Record<string, unknown> });
    if (error) return actionErr(error);
    revalidatePath('/', 'layout');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// إدارة المستخدمين (Admin API — يتطلب مفتاح الخدمة)
// ---------------------------------------------------------------------
export async function createUserAction(input: {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}): Promise<ActionResult<undefined>> {
  await requireProfile(['owner']);
  const schema = z.object({
    email: z.email('بريد غير صالح').max(254),
    password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل').max(128),
    full_name: z.string().trim().min(2, 'الاسم مطلوب').max(100),
    role: z.enum(['owner', 'manager', 'sales', 'warehouse', 'accountant']),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  if (!env.serviceRoleKey) {
    return actionErr({ message: 'NO_SERVICE_KEY', details: 'إنشاء المستخدمين يتطلب ضبط SUPABASE_SERVICE_ROLE_KEY في الخادم.' });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    });
    if (error) {
      return actionErr({ message: 'CREATE_FAILED', details: error.message.includes('already') ? 'هذا البريد مسجّل مسبقًا.' : error.message });
    }
    const { error: profileError } = await admin.from('profiles').insert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      is_active: true,
    });
    if (profileError) return actionErr(profileError);
    await admin.from('audit_logs').insert({
      user_id: (await requireProfile()).id,
      action: 'user.create',
      entity: 'profiles',
      entity_id: data.user.id,
      after_data: { email: parsed.data.email, role: parsed.data.role },
      ip: await getClientIp(),
    });
    revalidatePath('/settings');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export async function updateUserAction(input: {
  id: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}): Promise<ActionResult<undefined>> {
  const me = await requireProfile(['owner']);
  const parsed = z.object({
    id: z.uuid(),
    full_name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(['owner', 'manager', 'sales', 'warehouse', 'accountant']).optional(),
    is_active: z.boolean().optional(),
  }).strict().safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  if (parsed.data.id === me.id && (parsed.data.role !== undefined || parsed.data.is_active === false)) {
    return actionErr({ message: 'SELF_EDIT', details: 'لا يمكنك تغيير دورك أو إيقاف حسابك بنفسك.' });
  }
  try {
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    if (parsed.data.full_name !== undefined) patch.full_name = parsed.data.full_name;
    if (parsed.data.role !== undefined) patch.role = parsed.data.role;
    if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;
    if (Object.keys(patch).length === 0) {
      return actionErr({ message: 'VALIDATION', details: 'لا توجد تغييرات للحفظ.' });
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', parsed.data.id);
    if (error) return actionErr(error);
    revalidatePath('/settings');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

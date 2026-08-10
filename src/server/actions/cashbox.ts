'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import {
  cashManualSchema,
  closeSessionSchema,
  type CashManualInput,
  type CloseSessionInput,
} from '@/lib/validation/schemas';

/** حركة صندوق يدوية: دخل إضافي / سحب شخصي / إيداع / تسوية */
export async function manualCashTxAction(input: CashManualInput): Promise<ActionResult<{ ok: boolean }>> {
  const parsed = cashManualSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cash_manual_tx', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/cashbox');
    revalidatePath('/');
    return actionOk(data as { ok: boolean });
  } catch (e) {
    return actionErr(e);
  }
}

export interface CloseSessionResult {
  id: string;
  session_date: string;
  opening_balance: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
  actual_cash: number;
  difference: number;
}

/** إغلاق الصندوق لليوم — يحسب المتوقع ويسجل الفعلي والفرق */
export async function closeCashSessionAction(input: CloseSessionInput): Promise<ActionResult<CloseSessionResult>> {
  const parsed = closeSessionSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('close_cash_session', { p: parsed.data });
    if (error) return actionErr(error);
    revalidatePath('/cashbox');
    revalidatePath('/');
    return actionOk(data as CloseSessionResult);
  } catch (e) {
    return actionErr(e);
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import { returnInputSchema, voidSchema, type ReturnInput } from '@/lib/validation/schemas';
import { findSaleByInvoice } from '@/server/queries/returns';

export interface ReturnCreateResult {
  id: string;
  return_no: string;
  total: number;
  refund_cash: number;
  credited: number;
  customer_balance: number | null;
}

export async function createReturnAction(input: ReturnInput): Promise<ActionResult<ReturnCreateResult>> {
  const parsed = returnInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_return', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/returns');
    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return actionOk(data as ReturnCreateResult);
  } catch (e) {
    return actionErr(e);
  }
}

export async function voidReturnAction(input: { id: string; reason: string }): Promise<ActionResult<{ return_no: string }>> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('void_return', {
      p_return_id: parsed.data.id,
      p_reason: parsed.data.reason,
      p_ip: await getClientIp(),
    });
    if (error) return actionErr(error);
    revalidatePath('/returns');
    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return actionOk(data as { return_no: string });
  } catch (e) {
    return actionErr(e);
  }
}

/** بحث عن فاتورة مكتملة برقمها — لبدء مرتجع جديد */
export async function findSaleAction(invoiceNo: string): Promise<ActionResult<{ id: string } | null>> {
  try {
    const found = await findSaleByInvoice(invoiceNo);
    return actionOk(found);
  } catch (e) {
    return actionErr(e);
  }
}

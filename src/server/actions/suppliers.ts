'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import {
  supplierSchema,
  supplierPaymentSchema,
  type SupplierInput,
  type SupplierPaymentInput,
} from '@/lib/validation/schemas';

export async function createSupplierAction(input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('suppliers').insert(parsed.data).select('id').single();
    if (error) return actionErr(error);
    revalidatePath('/suppliers');
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function updateSupplierAction(id: string, input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').update(parsed.data).eq('id', id);
    if (error) return actionErr(error);
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return actionOk({ id });
  } catch (e) {
    return actionErr(e);
  }
}

/** إيقاف/تفعيل مورد */
export async function toggleSupplierActiveAction(id: string, isActive: boolean): Promise<ActionResult<{ is_active: boolean }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').update({ is_active: isActive }).eq('id', id);
    if (error) return actionErr(error);
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return actionOk({ is_active: isActive });
  } catch (e) {
    return actionErr(e);
  }
}

export interface SupplierPaymentResult {
  id: string;
  payment_no: string;
  supplier_balance: number;
}

/** دفع دفعة لمورد — عبر RPC حصراً */
export async function recordSupplierPaymentAction(
  input: SupplierPaymentInput,
): Promise<ActionResult<SupplierPaymentResult>> {
  const parsed = supplierPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('record_supplier_payment', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/dashboard');
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${parsed.data.supplier_id}`);
    revalidatePath('/debts');
    return actionOk(data as SupplierPaymentResult);
  } catch (e) {
    return actionErr(e);
  }
}

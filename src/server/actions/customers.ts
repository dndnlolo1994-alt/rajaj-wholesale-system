'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import {
  customerSchema,
  customerPaymentSchema,
  customerPriceSchema,
  type CustomerInput,
  type CustomerPaymentInput,
} from '@/lib/validation/schemas';

export async function createCustomerAction(input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('customers').insert(parsed.data).select('id').single();
    if (error) return actionErr(error);
    revalidatePath('/customers');
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function updateCustomerAction(id: string, input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('customers').update(parsed.data).eq('id', id);
    if (error) return actionErr(error);
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return actionOk({ id });
  } catch (e) {
    return actionErr(e);
  }
}

/** إيقاف/تفعيل عميل */
export async function toggleCustomerActiveAction(id: string, isActive: boolean): Promise<ActionResult<{ is_active: boolean }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('customers').update({ is_active: isActive }).eq('id', id);
    if (error) return actionErr(error);
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return actionOk({ is_active: isActive });
  } catch (e) {
    return actionErr(e);
  }
}

export interface CustomerPaymentResult {
  id: string;
  payment_no: string;
  customer_balance: number;
}

/** قبض دفعة من عميل — عبر RPC حصراً */
export async function recordCustomerPaymentAction(
  input: CustomerPaymentInput,
): Promise<ActionResult<CustomerPaymentResult>> {
  const parsed = customerPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('record_customer_payment', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    revalidatePath('/debts');
    return actionOk(data as CustomerPaymentResult);
  } catch (e) {
    return actionErr(e);
  }
}

type CustomerPriceInput = z.infer<typeof customerPriceSchema>;

/** حفظ سعر خاص (إدراج أو تحديث على مفتاح العميل+الصنف+الوحدة) */
export async function upsertCustomerPriceAction(input: CustomerPriceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = customerPriceSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('customer_prices')
      .upsert(parsed.data, { onConflict: 'customer_id,product_id,unit' })
      .select('id')
      .single();
    if (error) return actionErr(error);
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function deleteCustomerPriceAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('customer_prices').delete().eq('id', id);
    if (error) return actionErr(error);
    revalidatePath('/customers');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export interface ProductPriceSearchRow {
  id: string;
  name: string;
  units_per_carton: number;
  sale_price_carton: number;
  sale_price_piece: number;
}

/** بحث أصناف لحوار الأسعار الخاصة */
export async function searchProductsForPriceAction(q: string): Promise<ActionResult<ProductPriceSearchRow[]>> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('products')
      .select('id, name, units_per_carton, sale_price_carton, sale_price_piece')
      .eq('is_active', true)
      .order('name')
      .limit(15);
    if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
    const { data, error } = await query;
    if (error) return actionErr(error);
    return actionOk((data ?? []) as ProductPriceSearchRow[]);
  } catch (e) {
    return actionErr(e);
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import { saleInputSchema, voidSchema, type SaleInput } from '@/lib/validation/schemas';

export interface SaleCreateResult {
  id: string;
  invoice_no: string;
  total: number;
  paid: number;
  remaining: number;
  profit: number;
  customer_balance: number | null;
  customer_id: string | null;
  customer_name: string | null;
  auto_customer: boolean;
  warnings: { code: string; message: string }[];
}

export async function createSaleAction(input: SaleInput): Promise<ActionResult<SaleCreateResult>> {
  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_sale', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/dashboard');
    revalidatePath('/sales');
    revalidatePath('/debts');
    revalidatePath('/customers');
    return actionOk(data as SaleCreateResult);
  } catch (e) {
    return actionErr(e);
  }
}

export async function voidSaleAction(input: { id: string; reason: string }): Promise<ActionResult<{ invoice_no: string }>> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('void_sale', {
      p_sale_id: parsed.data.id,
      p_reason: parsed.data.reason,
      p_ip: await getClientIp(),
    });
    if (error) return actionErr(error);
    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return actionOk(data as { invoice_no: string });
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// الفواتير المعلّقة (مسودات)
// ---------------------------------------------------------------------
export interface HeldSalePayload {
  customer_id: string | null;
  customer_name: string | null;
  lines: {
    product_id: string;
    name: string;
    image_url?: string | null;
    unit: 'carton' | 'piece';
    units_per_carton: number;
    qty: number;
    unit_price: number;
    discount: number;
    stock_units: number;
  }[];
  invoice_discount: number;
  notes: string | null;
}

export async function holdSaleAction(payload: HeldSalePayload, label?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionErr({ message: 'AUTH', details: 'انتهت الجلسة' });
    const { data, error } = await supabase
      .from('held_sales')
      .insert({
        label: label ?? payload.customer_name ?? 'مديون',
        customer_id: payload.customer_id,
        payload: payload as unknown as Record<string, unknown>,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (error) return actionErr(error);
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function listHeldSalesAction(): Promise<
  ActionResult<{ id: string; label: string | null; created_at: string; payload: HeldSalePayload }[]>
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('held_sales')
      .select('id, label, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return actionErr(error);
    return actionOk(data as { id: string; label: string | null; created_at: string; payload: HeldSalePayload }[]);
  } catch (e) {
    return actionErr(e);
  }
}

export async function deleteHeldSaleAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('held_sales').delete().eq('id', id);
    if (error) return actionErr(error);
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

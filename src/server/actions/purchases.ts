'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import {
  purchaseInputSchema,
  supplierPaymentSchema,
  voidSchema,
  type PurchaseInput,
  type SupplierPaymentInput,
} from '@/lib/validation/schemas';

export interface PurchaseCreateResult {
  id: string;
  invoice_no: string;
  total: number;
  paid: number;
  remaining: number;
  supplier_balance: number;
}

export async function createPurchaseAction(input: PurchaseInput): Promise<ActionResult<PurchaseCreateResult>> {
  const parsed = purchaseInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_purchase', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/purchases');
    revalidatePath('/dashboard');
    return actionOk(data as PurchaseCreateResult);
  } catch (e) {
    return actionErr(e);
  }
}

export async function voidPurchaseAction(input: { id: string; reason: string }): Promise<ActionResult<{ invoice_no: string }>> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('void_purchase', {
      p_purchase_id: parsed.data.id,
      p_reason: parsed.data.reason,
      p_ip: await getClientIp(),
    });
    if (error) return actionErr(error);
    revalidatePath('/purchases');
    revalidatePath('/dashboard');
    return actionOk(data as { invoice_no: string });
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// بحث سريع عن الموردين (لحوار الاختيار في فاتورة المشتريات)
// ---------------------------------------------------------------------
export interface QuickSupplier {
  id: string;
  name: string;
  company_name: string | null;
  balance: number;
}

export async function listSuppliersQuickAction(q?: string): Promise<ActionResult<QuickSupplier[]>> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('suppliers')
      .select('id, name, company_name, balance')
      .eq('is_active', true)
      .order('name')
      .limit(30);
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      query = query.or(`name.ilike.${like},company_name.ilike.${like},phone.like.${like}`);
    }
    const { data, error } = await query;
    if (error) return actionErr(error);
    return actionOk((data ?? []) as QuickSupplier[]);
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// آخر سعر شراء (للكرتونة) لمجموعة أصناف — لتعبئة سعر الشراء الأولية
// (pos_products لا يعيد purchase_price_carton)
// ---------------------------------------------------------------------
export async function purchasePricesAction(productIds: string[]): Promise<ActionResult<Record<string, number>>> {
  try {
    const ids = productIds.filter(Boolean).slice(0, 100);
    if (ids.length === 0) return actionOk({});
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').select('id, purchase_price_carton').in('id', ids);
    if (error) return actionErr(error);
    const map: Record<string, number> = {};
    for (const row of (data ?? []) as { id: string; purchase_price_carton: number }[]) {
      map[row.id] = Number(row.purchase_price_carton);
    }
    return actionOk(map);
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// سداد دفعة لمورد على فاتورة مشتريات
// ---------------------------------------------------------------------
export interface SupplierPaymentResult {
  id: string;
  payment_no: string;
  supplier_balance: number;
}

export async function paySupplierForPurchaseAction(input: SupplierPaymentInput): Promise<ActionResult<SupplierPaymentResult>> {
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
    revalidatePath('/purchases');
    revalidatePath('/dashboard');
    return actionOk(data as SupplierPaymentResult);
  } catch (e) {
    return actionErr(e);
  }
}

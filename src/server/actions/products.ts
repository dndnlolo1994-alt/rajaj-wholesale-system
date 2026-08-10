'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import {
  adjustStockSchema,
  categorySchema,
  productSchema,
  setCountItemSchema,
  startCountSchema,
  type ProductInput,
} from '@/lib/validation/schemas';

// ---------------------------------------------------------------------
// الأصناف (بيانات أساسية — كتابة مباشرة، الصلاحيات عبر RLS)
// ---------------------------------------------------------------------

/** رسالة عربية واضحة عند تكرار الباركود/SKU (خطأ 23505) */
function duplicateError(error: { code?: string; message?: string }): ActionResult<never> | null {
  if (error.code !== '23505') return null;
  const msg = `${error.message ?? ''}`;
  const details = /barcode/i.test(msg)
    ? 'هذا الباركود مسجّل مسبقًا لصنف آخر — تحقق من الرقم أو ابحث عن الصنف الموجود.'
    : /sku/i.test(msg)
      ? 'رمز SKU مسجّل مسبقًا لصنف آخر.'
      : 'قيمة مكررة — الباركود أو الرمز مسجّل مسبقًا لصنف آخر.';
  return actionErr({ code: '23505', details });
}

export async function createProductAction(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').insert(parsed.data).select('id').single();
    if (error) return duplicateError(error) ?? actionErr(error);
    revalidatePath('/products');
    revalidatePath('/inventory');
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function updateProductAction(id: string, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('products').update(parsed.data).eq('id', id).select('id').single();
    if (error) return duplicateError(error) ?? actionErr(error);
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function toggleProductActiveAction(id: string, isActive: boolean): Promise<ActionResult<{ is_active: boolean }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id)
      .select('is_active')
      .single();
    if (error) return actionErr(error);
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return actionOk({ is_active: (data as { is_active: boolean }).is_active });
  } catch (e) {
    return actionErr(e);
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        return actionErr({ code: '23503', details: 'لا يمكن حذف صنف له حركات — أوقفه بدلًا من ذلك.' });
      }
      return actionErr(error);
    }
    revalidatePath('/products');
    revalidatePath('/inventory');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// تعديل المخزون اليدوي (عبر RPC حصرًا)
// ---------------------------------------------------------------------
export interface AdjustStockResult {
  ok: boolean;
  stock_units: number;
  changed: boolean;
  delta?: number;
}

export async function adjustStockAction(input: {
  product_id: string;
  mode: 'set' | 'delta';
  qty_units: number;
  reason: string;
}): Promise<ActionResult<AdjustStockResult>> {
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('adjust_stock', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/products');
    revalidatePath(`/products/${parsed.data.product_id}`);
    revalidatePath('/inventory');
    return actionOk(data as AdjustStockResult);
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// الأقسام (كتابة مباشرة — RLS: مالك/مدير)
// ---------------------------------------------------------------------
export async function createCategoryAction(name: string): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse({ name, sort_order: 0 });
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('categories').insert({ name: parsed.data.name }).select('id').single();
    if (error) {
      if (error.code === '23505') return actionErr({ code: '23505', details: 'يوجد قسم بهذا الاسم مسبقًا.' });
      return actionErr(error);
    }
    revalidatePath('/products');
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function renameCategoryAction(id: string, name: string): Promise<ActionResult<undefined>> {
  const parsed = categorySchema.safeParse({ name, sort_order: 0 });
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('categories').update({ name: parsed.data.name }).eq('id', id);
    if (error) {
      if (error.code === '23505') return actionErr({ code: '23505', details: 'يوجد قسم بهذا الاسم مسبقًا.' });
      return actionErr(error);
    }
    revalidatePath('/products');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        return actionErr({ code: '23503', details: 'لا يمكن حذف القسم — توجد أصناف مرتبطة به. انقل الأصناف أولًا.' });
      }
      return actionErr(error);
    }
    revalidatePath('/products');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// جلسات الجرد (عبر RPC حصرًا)
// ---------------------------------------------------------------------
export interface StartCountResult {
  id: string;
  count_no: string;
  items_total: number;
}

export async function startCountAction(input: {
  count_type: 'daily' | 'monthly' | 'manual';
  category_id?: string | null;
  notes?: string | null;
}): Promise<ActionResult<StartCountResult>> {
  const parsed = startCountSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('start_inventory_count', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/inventory');
    return actionOk(data as StartCountResult);
  } catch (e) {
    return actionErr(e);
  }
}

export interface SetCountItemResult {
  product_id: string;
  expected_units: number;
  actual_units: number | null;
  diff_units: number | null;
  diff_value: number | null;
}

export async function setCountItemAction(input: {
  count_id: string;
  product_id: string;
  actual_units: number | null;
}): Promise<ActionResult<SetCountItemResult>> {
  const parsed = setCountItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('set_count_item', {
      p_count_id: parsed.data.count_id,
      p_product_id: parsed.data.product_id,
      p_actual: parsed.data.actual_units,
    });
    if (error) return actionErr(error);
    return actionOk(data as SetCountItemResult);
  } catch (e) {
    return actionErr(e);
  }
}

export interface CompleteCountResult {
  ok: boolean;
  count_no: string;
  total_diff_units: number;
  total_diff_value: number;
  adjusted_products: number;
}

export async function completeCountAction(input: { id: string; apply: boolean }): Promise<ActionResult<CompleteCountResult>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('complete_inventory_count', {
      p_count_id: input.id,
      p_apply: input.apply,
      p_ip: await getClientIp(),
    });
    if (error) return actionErr(error);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/counts/${input.id}`);
    revalidatePath('/products');
    return actionOk(data as CompleteCountResult);
  } catch (e) {
    return actionErr(e);
  }
}

export async function cancelCountAction(input: { id: string }): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cancel_inventory_count', {
      p_count_id: input.id,
      p_ip: await getClientIp(),
    });
    if (error) return actionErr(error);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/counts/${input.id}`);
    return actionOk(data as { ok: boolean });
  } catch (e) {
    return actionErr(e);
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/auth';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import { expenseSchema, voidSchema, type ExpenseInput } from '@/lib/validation/schemas';

export interface ExpenseCreateResult {
  id: string;
  expense_no: string;
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult<ExpenseCreateResult>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_expense', {
      p: { ...parsed.data, client_ip: await getClientIp() },
    });
    if (error) return actionErr(error);
    revalidatePath('/expenses');
    revalidatePath('/cashbox');
    revalidatePath('/dashboard');
    return actionOk(data as ExpenseCreateResult);
  } catch (e) {
    return actionErr(e);
  }
}

export async function voidExpenseAction(input: { id: string; reason: string }): Promise<ActionResult<{ expense_no: string }>> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('void_expense', {
      p_expense_id: parsed.data.id,
      p_reason: parsed.data.reason,
      p_ip: await getClientIp(),
    });
    if (error) return actionErr(error);
    revalidatePath('/expenses');
    revalidatePath('/cashbox');
    revalidatePath('/dashboard');
    return actionOk(data as { expense_no: string });
  } catch (e) {
    return actionErr(e);
  }
}

// ---------------------------------------------------------------------
// تصنيفات المصروفات — بيانات أساسية تُكتب مباشرة (تحكمها RLS)
// ---------------------------------------------------------------------
const categoryNameSchema = z.string().trim().min(1, 'اسم التصنيف مطلوب').max(100, 'اسم التصنيف طويل جدًا');

export async function createExpenseCategoryAction(name: string): Promise<ActionResult<{ id: string }>> {
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ name: parsed.data })
      .select('id')
      .single();
    if (error) return actionErr(error);
    revalidatePath('/expenses');
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

export async function renameExpenseCategoryAction(id: string, name: string): Promise<ActionResult<undefined>> {
  const parsedId = z.uuid().safeParse(id);
  const parsedName = categoryNameSchema.safeParse(name);
  if (!parsedId.success || !parsedName.success) {
    return actionErr({ message: 'VALIDATION', details: 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('expense_categories').update({ name: parsedName.data }).eq('id', parsedId.data);
    if (error) return actionErr(error);
    revalidatePath('/expenses');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export async function toggleExpenseCategoryAction(id: string, isActive: boolean): Promise<ActionResult<undefined>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    return actionErr({ message: 'VALIDATION', details: 'معرّف غير صالح' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('expense_categories')
      .update({ is_active: isActive })
      .eq('id', parsedId.data);
    if (error) return actionErr(error);
    revalidatePath('/expenses');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

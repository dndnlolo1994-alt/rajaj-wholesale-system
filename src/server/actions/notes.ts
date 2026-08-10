'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';
import { noteSchema } from '@/lib/validation/schemas';

// الدفتر اليومي — بيانات أساسية تُكتب مباشرة على جدول notes (تحكمها RLS)

export async function createNoteAction(input: {
  content: string;
  is_task?: boolean;
  is_pinned?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr({ message: 'VALIDATION', details: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionErr({ message: 'AUTH', details: 'انتهت الجلسة. سجّل الدخول مجددًا.' });
    const { data, error } = await supabase
      .from('notes')
      .insert({ ...parsed.data, created_by: user.id })
      .select('id')
      .single();
    if (error) return actionErr(error);
    revalidatePath('/notes');
    return actionOk({ id: (data as { id: string }).id });
  } catch (e) {
    return actionErr(e);
  }
}

const noteContentSchema = z.string().trim().min(1, 'اكتب الملاحظة').max(4000);

export async function updateNoteAction(id: string, content: string): Promise<ActionResult<undefined>> {
  const parsedId = z.uuid().safeParse(id);
  const parsedContent = noteContentSchema.safeParse(content);
  if (!parsedId.success) return actionErr({ message: 'VALIDATION', details: 'معرّف غير صالح' });
  if (!parsedContent.success) {
    return actionErr({ message: 'VALIDATION', details: parsedContent.error.issues[0]?.message ?? 'اكتب الملاحظة' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notes')
      .update({ content: parsedContent.data, updated_at: new Date().toISOString() })
      .eq('id', parsedId.data);
    if (error) return actionErr(error);
    revalidatePath('/notes');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export async function toggleNoteAction(
  id: string,
  field: 'is_done' | 'is_pinned' | 'is_task',
  value: boolean,
): Promise<ActionResult<undefined>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return actionErr({ message: 'VALIDATION', details: 'معرّف غير صالح' });
  if (!['is_done', 'is_pinned', 'is_task'].includes(field)) {
    return actionErr({ message: 'VALIDATION', details: 'حقل غير صالح' });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notes')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', parsedId.data);
    if (error) return actionErr(error);
    revalidatePath('/notes');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export async function deleteNoteAction(id: string): Promise<ActionResult<undefined>> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return actionErr({ message: 'VALIDATION', details: 'معرّف غير صالح' });
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('notes').delete().eq('id', parsedId.data);
    if (error) return actionErr(error);
    revalidatePath('/notes');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

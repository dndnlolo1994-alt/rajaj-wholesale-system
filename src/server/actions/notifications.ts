'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { actionErr, actionOk, type ActionResult } from '@/lib/errors';

export async function markNotificationReadAction(id: string): Promise<ActionResult<undefined>> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return actionErr({ message: 'VALIDATION', details: 'معرّف غير صالح' });
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', parsed.data);
    if (error) return actionErr(error);
    revalidatePath('/notifications');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (error) return actionErr(error);
    revalidatePath('/notifications');
    return actionOk(undefined);
  } catch (e) {
    return actionErr(e);
  }
}

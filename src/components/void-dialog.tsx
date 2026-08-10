'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/errors';

/** حوار إلغاء موحّد للمستندات المالية — الإلغاء يعكس الأثر ويحفظ السجل */
export function VoidDialog({
  id,
  label,
  description,
  action,
  buttonLabel = 'إلغاء المستند',
}: {
  id: string;
  label: string;
  description?: string;
  action: (input: { id: string; reason: string }) => Promise<ActionResult<unknown>>;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 2) {
      error('سبب الإلغاء مطلوب');
      return;
    }
    setLoading(true);
    const res = await action({ id, reason: reason.trim() });
    setLoading(false);
    if (res.ok) {
      success(`تم إلغاء ${label}`);
      setOpen(false);
      router.refresh();
    } else {
      error('تعذر الإلغاء', res.error.message);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="border-red-200 text-red-600 hover:bg-red-50">
        <Ban className="size-4" />
        {buttonLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`إلغاء ${label}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              تراجع
            </Button>
            <Button variant="danger" onClick={submit} loading={loading}>
              تأكيد الإلغاء
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm leading-6 text-ink-700">
          {description ?? 'سيعكس النظام أثر هذا المستند على المخزون والحسابات مع الاحتفاظ به في السجل كمستند ملغى. لا يمكن التراجع عن الإلغاء.'}
        </p>
        <Field label="سبب الإلغاء" required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: خطأ في الإدخال..." autoFocus />
        </Field>
      </Dialog>
    </>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, NumericInput, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { formatJOD, parseMoney, round3 } from '@/lib/calc/money';
import { closeCashSessionAction } from '@/server/actions/cashbox';

/** حوار إغلاق الصندوق اليومي — يقارن المتوقع بالفعلي ويعرض الفرق لحظيًا */
export function CloseSessionDialog({ expected }: { expected: number }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [actualText, setActualText] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const actual = parseMoney(actualText);
  const diff = actual == null ? null : round3(actual - expected);

  const diffTone =
    diff == null || diff === 0
      ? { box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', label: 'مطابق تمامًا ✓' }
      : diff < 0
        ? { box: 'border-red-200 bg-red-50', text: 'text-red-700', label: 'عجز في الصندوق' }
        : { box: 'border-amber-300 bg-amber-50', text: 'text-amber-800', label: 'زيادة في الصندوق' };

  const submit = async () => {
    if (actual == null || actual < 0) {
      error('أدخل النقد الفعلي في الصندوق');
      return;
    }
    setLoading(true);
    const res = await closeCashSessionAction({
      actual_cash: actual,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    setLoading(false);
    if (res.ok) {
      const d = round3(Number(res.data.difference ?? diff ?? 0));
      success(
        'تم إغلاق اليوم',
        d === 0
          ? 'الصندوق مطابق تمامًا ✓'
          : d > 0
            ? `زيادة في الصندوق ${formatJOD(d)}`
            : `عجز في الصندوق ${formatJOD(Math.abs(d))}`,
      );
      setOpen(false);
      setActualText('');
      setNotes('');
      router.refresh();
    } else {
      error(res.error.code === 'SESSION_EXISTS' ? 'اليوم مغلق مسبقًا' : 'تعذر إغلاق اليوم', res.error.message);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Lock className="size-4" />
        إغلاق اليوم
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="إغلاق الصندوق اليومي"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              تراجع
            </Button>
            <Button onClick={submit} loading={loading} disabled={actual == null}>
              تأكيد الإغلاق
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-primary-900 p-4 text-center text-white">
            <p className="text-xs font-bold text-primary-300">الرصيد المتوقع في الصندوق (نقدًا)</p>
            <p className="tnum mt-1 text-3xl font-extrabold" dir="ltr">
              {formatJOD(expected)}
            </p>
          </div>

          <Field label="النقد الفعلي في الصندوق" required>
            <NumericInput
              money
              className="h-14 text-2xl"
              value={actualText}
              onChange={(e) => setActualText(e.target.value)}
              placeholder="0.000"
              autoFocus
            />
          </Field>

          {diff != null ? (
            <div className={`flex items-center justify-between rounded-xl border p-3 ${diffTone.box}`}>
              <span className={`text-sm font-bold ${diffTone.text}`}>{diffTone.label}</span>
              <span dir="ltr" className={`tnum text-lg font-extrabold ${diffTone.text}`}>
                {formatJOD(diff)}
              </span>
            </div>
          ) : null}

          <Field label="ملاحظات (اختياري)">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: سبب الفرق إن وجد..."
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

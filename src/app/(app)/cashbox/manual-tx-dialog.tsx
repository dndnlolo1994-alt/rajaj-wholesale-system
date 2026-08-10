'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, NumericInput, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { parseMoney } from '@/lib/calc/money';
import { manualCashTxAction } from '@/server/actions/cashbox';
import type { CashDirection, PaymentMethod } from '@/lib/types/db';

type ManualType = 'extra_income' | 'owner_withdrawal' | 'deposit' | 'adjustment';

const typeOptions: { value: ManualType; label: string }[] = [
  { value: 'extra_income', label: 'دخل إضافي' },
  { value: 'owner_withdrawal', label: 'سحب شخصي' },
  { value: 'deposit', label: 'إيداع' },
  { value: 'adjustment', label: 'تسوية' },
];

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

/** حوار حركة صندوق يدوية */
export function ManualTxDialog() {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [txType, setTxType] = useState<ManualType>('extra_income');
  const [direction, setDirection] = useState<CashDirection>('in');
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTxType('extra_income');
    setDirection('in');
    setAmountText('');
    setMethod('cash');
    setNotes('');
  };

  const submit = async () => {
    const amount = parseMoney(amountText);
    if (amount == null || amount <= 0) {
      error('أدخل مبلغًا صحيحًا أكبر من صفر');
      return;
    }
    if (txType === 'adjustment' && notes.trim().length < 2) {
      error('سبب التسوية مطلوب');
      return;
    }
    setLoading(true);
    const res = await manualCashTxAction({
      tx_type: txType,
      direction: txType === 'adjustment' ? direction : undefined,
      amount,
      method,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    setLoading(false);
    if (res.ok) {
      success('تم تسجيل الحركة في الصندوق');
      setOpen(false);
      reset();
      router.refresh();
    } else {
      error('تعذر تسجيل الحركة', res.error.message);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="size-4" />
        حركة يدوية
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="حركة صندوق يدوية"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button onClick={submit} loading={loading}>
              حفظ الحركة
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="نوع الحركة">
            <Segmented value={txType} onChange={setTxType} options={typeOptions} className="flex-wrap" />
          </Field>

          {txType === 'adjustment' ? (
            <Field label="اتجاه التسوية" required>
              <Segmented
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'in', label: 'داخل (+)' },
                  { value: 'out', label: 'خارج (-)' },
                ]}
              />
            </Field>
          ) : null}

          <Field label="المبلغ" required>
            <NumericInput
              money
              className="h-12 text-lg"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.000"
              autoFocus
            />
          </Field>

          <Field label="طريقة الدفع">
            <Segmented value={method} onChange={setMethod} options={methodOptions} className="flex-wrap" />
          </Field>

          <Field
            label={txType === 'adjustment' ? 'سبب التسوية' : 'ملاحظات (اختياري)'}
            required={txType === 'adjustment'}
          >
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={txType === 'adjustment' ? 'اذكر سبب التسوية...' : 'بيان الحركة...'}
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

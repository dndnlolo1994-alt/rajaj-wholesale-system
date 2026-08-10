'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, NumericInput, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { formatJOD, parseMoney, round3 } from '@/lib/calc/money';
import type { PaymentMethod } from '@/lib/types/db';
import { paySupplierForPurchaseAction } from '@/server/actions/purchases';

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

/** حوار سداد دفعة للمورد على فاتورة مشتريات محددة */
export function PayDialog({
  supplierId,
  supplierName,
  purchaseId,
  remaining,
}: {
  supplierId: string;
  supplierName: string;
  purchaseId: string;
  remaining: number;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const invalid = amount <= 0 || amount > remaining;

  const submit = async () => {
    if (invalid) {
      toastError('المبلغ غير صالح', `أدخل مبلغًا بين فلس واحد و ${formatJOD(remaining)}.`);
      return;
    }
    setLoading(true);
    const res = await paySupplierForPurchaseAction({
      supplier_id: supplierId,
      amount: round3(amount),
      method,
      purchase_id: purchaseId,
      notes: notes.trim() || null,
    });
    setLoading(false);
    if (!res.ok) {
      toastError('لم تُسجَّل الدفعة', res.error.message);
      return;
    }
    success(`سُجّلت الدفعة ${res.data.payment_no}`);
    setOpen(false);
    setAmountText('');
    setNotes('');
    router.refresh();
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <HandCoins className="size-4" />
        سداد دفعة
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`سداد دفعة — ${supplierName}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              رجوع
            </Button>
            <Button onClick={submit} loading={loading} disabled={invalid}>
              تسجيل الدفعة
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 p-3 text-center">
            <p className="text-xs font-bold text-red-700">المتبقي على هذه الفاتورة</p>
            <p className="tnum mt-0.5 text-2xl font-extrabold text-red-700" dir="ltr">{formatJOD(remaining)}</p>
          </div>

          <Field label="مبلغ الدفعة" error={amountText && invalid ? 'المبلغ يجب ألا يتجاوز المتبقي' : null}>
            <NumericInput
              money
              className="h-12 text-lg"
              value={amountText}
              placeholder="0.000"
              onChange={(e) => setAmountText(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setAmountText(round3(remaining).toFixed(3))}
              className="mt-2 rounded-lg border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:border-primary-400 hover:text-primary-800"
            >
              كامل المتبقي
            </button>
          </Field>

          <Field label="طريقة الدفع">
            <Segmented value={method} onChange={setMethod} options={methods} className="flex-wrap" />
          </Field>

          <Field label="ملاحظة (اختياري)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: دفعة شهرية..." />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

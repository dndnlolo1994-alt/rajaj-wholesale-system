'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, NumericInput, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { formatJOD, parseMoney } from '@/lib/calc/money';
import { recordCustomerPaymentAction } from '@/server/actions/customers';
import type { PaymentMethod } from '@/lib/types/db';

// نسخة محلية من تسميات طرق الدفع (settings.ts خادمي فقط)
const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

/** حوار قبض دفعة من عميل — قابل لإعادة الاستخدام من صفحة الديون */
export function PaymentDialog({
  customerId,
  customerName,
  balance,
  open,
  onClose,
}: {
  customerId: string;
  customerName: string;
  balance: number;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountText('');
      setMethod('cash');
      setNotes('');
    }
  }, [open]);

  const submit = async () => {
    const amount = parseMoney(amountText);
    if (amount == null || amount <= 0) {
      error('أدخل مبلغًا صحيحًا أكبر من صفر');
      return;
    }
    setSaving(true);
    const res = await recordCustomerPaymentAction({
      customer_id: customerId,
      amount,
      method,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      success(
        `تم قبض ${formatJOD(amount)} — سند ${res.data.payment_no}`,
        `الرصيد الجديد للعميل: ${formatJOD(res.data.customer_balance)}`,
      );
      onClose();
      router.refresh();
    } else {
      error('تعذر تسجيل الدفعة', res.error.message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`تسجيل دفعة — ${customerName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={saving}>
            حفظ الدفعة
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-ink-100/50 p-3">
          <span className="text-sm font-bold text-ink-700">الرصيد الحالي (عليه)</span>
          <span className={`tnum text-lg font-extrabold ${Number(balance) > 0 ? 'text-red-600' : 'text-ink-900'}`} dir="ltr">
            {formatJOD(balance)}
          </span>
        </div>

        <Field label="المبلغ المقبوض">
          <NumericInput
            money
            className="h-12 text-lg"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="0.000"
            autoFocus
          />
          {Number(balance) > 0 ? (
            <button
              type="button"
              onClick={() => setAmountText(String(balance))}
              className="mt-2 rounded-lg border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:border-primary-400 hover:text-primary-800"
            >
              كامل الرصيد ({formatJOD(balance)})
            </button>
          ) : null}
        </Field>

        <Field label="طريقة الدفع">
          <Segmented value={method} onChange={setMethod} options={methods} className="flex-wrap" />
        </Field>

        <Field label="ملاحظات (اختياري)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: دفعة على الحساب..." />
        </Field>
      </div>
    </Dialog>
  );
}

/** زر جاهز يفتح حوار الدفعة — لصفحة تفاصيل العميل */
export function RecordPaymentButton({
  customerId,
  customerName,
  balance,
}: {
  customerId: string;
  customerName: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <HandCoins className="size-4" />
        تسجيل دفعة
      </Button>
      <PaymentDialog
        customerId={customerId}
        customerName={customerName}
        balance={balance}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

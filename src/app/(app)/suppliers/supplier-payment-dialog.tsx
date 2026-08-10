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
import { recordSupplierPaymentAction } from '@/server/actions/suppliers';
import type { PaymentMethod } from '@/lib/types/db';

// نسخة محلية من تسميات طرق الدفع (settings.ts خادمي فقط)
const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

/** حوار دفع دفعة لمورد — قابل لإعادة الاستخدام من صفحة الديون */
export function SupplierPaymentDialog({
  supplierId,
  supplierName,
  balance,
  open,
  onClose,
}: {
  supplierId: string;
  supplierName: string;
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
    const res = await recordSupplierPaymentAction({
      supplier_id: supplierId,
      amount,
      method,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      success(
        `تم دفع ${formatJOD(amount)} — سند ${res.data.payment_no}`,
        `المتبقي له علينا: ${formatJOD(res.data.supplier_balance)}`,
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
      title={`تسجيل دفعة له — ${supplierName}`}
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
          <span className="text-sm font-bold text-ink-700">الرصيد الحالي (له علينا)</span>
          <span className={`tnum text-lg font-extrabold ${Number(balance) > 0 ? 'text-red-600' : 'text-ink-900'}`} dir="ltr">
            {formatJOD(balance)}
          </span>
        </div>

        <Field label="المبلغ المدفوع">
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

/** زر جاهز يفتح حوار الدفعة — لصفحة تفاصيل المورد */
export function RecordSupplierPaymentButton({
  supplierId,
  supplierName,
  balance,
}: {
  supplierId: string;
  supplierName: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <HandCoins className="size-4" />
        تسجيل دفعة له
      </Button>
      <SupplierPaymentDialog
        supplierId={supplierId}
        supplierName={supplierName}
        balance={balance}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

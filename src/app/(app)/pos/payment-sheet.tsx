'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumericInput, Textarea, Field } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { formatJOD, parseMoney, round3 } from '@/lib/calc/money';
import type { PaymentMethod } from '@/lib/types/db';

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

export function PaymentSheet({
  open,
  onClose,
  total,
  isCashCustomer,
  customerName,
  defaultMethod,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  isCashCustomer: boolean;
  customerName: string | null;
  defaultMethod: PaymentMethod;
  submitting: boolean;
  onConfirm: (paid: number, method: PaymentMethod, notes: string) => void;
}) {
  const [paidText, setPaidText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPaidText(formatJOD(total, { symbol: false }).replace(/,/g, ''));
      setMethod(defaultMethod);
      setNotes('');
    }
  }, [open, total, defaultMethod]);

  const paid = isCashCustomer ? total : (parseMoney(paidText) ?? 0);
  const remaining = round3(total - paid);
  const invalid = paid < 0 || paid > total;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="إتمام البيع"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            رجوع
          </Button>
          <Button
            onClick={() => onConfirm(round3(paid), method, notes.trim())}
            loading={submitting}
            disabled={invalid}
            size="lg"
          >
            حفظ الفاتورة {remaining > 0 ? '(آجل جزئي)' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-primary-900 p-4 text-center text-white">
          <p className="text-xs font-bold text-primary-300">الإجمالي المطلوب {customerName ? `— ${customerName}` : '— زبون نقدي'}</p>
          <p className="tnum mt-1 text-3xl font-extrabold" dir="ltr">{formatJOD(total)}</p>
        </div>

        {isCashCustomer ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            البيع النقدي بدون عميل مسجّل يُدفع بالكامل. لتسجيل دين اختر عميلًا.
          </p>
        ) : (
          <Field label="المبلغ المدفوع الآن" error={invalid ? 'المبلغ يجب أن يكون بين صفر والإجمالي' : null}>
            <NumericInput
              money
              className="h-12 text-lg"
              value={paidText}
              onChange={(e) => setPaidText(e.target.value)}
            />
            <div className="mt-2 flex gap-1.5">
              <QuickBtn label="المبلغ كامل" onClick={() => setPaidText(String(total))} />
              <QuickBtn label="النصف" onClick={() => setPaidText(String(round3(total / 2)))} />
              <QuickBtn label="بدون دفعة (آجل)" onClick={() => setPaidText('0')} />
            </div>
          </Field>
        )}

        {!isCashCustomer ? (
          <div className={`flex items-center justify-between rounded-xl border p-3 ${remaining > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <span className="text-sm font-bold">{remaining > 0 ? 'يبقى على العميل' : 'مدفوعة بالكامل ✓'}</span>
            {remaining > 0 ? (
              <span className="tnum text-lg font-extrabold text-amber-800" dir="ltr">{formatJOD(remaining)}</span>
            ) : null}
          </div>
        ) : null}

        {paid > 0 ? (
          <Field label="طريقة الدفع">
            <Segmented value={method} onChange={setMethod} options={methods} className="flex-wrap" />
          </Field>
        ) : null}

        <Field label="ملاحظة على الفاتورة (اختياري)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: التسليم صباحًا..." />
        </Field>
      </div>
    </Dialog>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:border-primary-400 hover:text-primary-800"
    >
      {label}
    </button>
  );
}

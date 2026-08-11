'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, NumericInput, Textarea, Field } from '@/components/ui/input';
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
  cashCustomerName,
  onCashCustomerNameChange,
  onPickCustomer,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  isCashCustomer: boolean;
  customerName: string | null;
  defaultMethod: PaymentMethod;
  submitting: boolean;
  cashCustomerName: string;
  onCashCustomerNameChange: (value: string) => void;
  onPickCustomer?: () => void;
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

  const paid = parseMoney(paidText) ?? 0;
  const remaining = round3(total - paid);
  const trimmedName = cashCustomerName.trim();
  const needsName = isCashCustomer && remaining > 0 && trimmedName === '';
  const amountInvalid = paid < 0 || paid > total;
  const invalid = amountInvalid || needsName;
  const saveSuffix = remaining > 0 ? (paid <= 0 ? 'ذمم' : 'متبقي') : '';
  const displayCustomerName = (customerName ?? trimmedName) || 'زبون نقدي';

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
            حفظ الفاتورة {saveSuffix ? `(${saveSuffix})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-primary-900 p-4 text-center text-white">
          <p className="text-xs font-bold text-primary-300">الإجمالي المطلوب — {displayCustomerName}</p>
          <p className="tnum mt-1 text-3xl font-extrabold" dir="ltr">{formatJOD(total)}</p>
        </div>

        {isCashCustomer ? (
          <Field
            label={remaining > 0 ? 'اسم العميل (مطلوب لتسجيل الباقي)' : 'اسم العميل على الفاتورة (اختياري)'}
            error={needsName ? 'اكتب اسم العميل حتى يُسجَّل الباقي على حسابه' : null}
            hint={
              remaining > 0
                ? 'سيُفتح له حساب باسمه تلقائيًا (أو يُستخدم حسابه الموجود) ليظهر الباقي في صفحة الديون.'
                : 'يظهر على الفاتورة والطباعة فقط، بدون فتح حساب.'
            }
          >
            <Input
              value={cashCustomerName}
              onChange={(e) => onCashCustomerNameChange(e.target.value)}
              maxLength={150}
              placeholder="مثال: أبو أحمد"
            />
          </Field>
        ) : null}

        <div className="space-y-3">
          <Field label="تفاصيل الدفع" error={amountInvalid ? 'المبلغ يجب أن يكون بين صفر والإجمالي' : null}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <QuickBtn label="مدفوع كامل" active={paid === total} onClick={() => setPaidText(String(total))} />
              <QuickBtn label="ذمم بالكامل" active={paid === 0} onClick={() => setPaidText('0')} />
              <QuickBtn
                label="دفعة + متبقي"
                active={paid > 0 && paid < total}
                onClick={() => setPaidText(String(round3(total / 2)))}
              />
            </div>
          </Field>
          <Field label="المبلغ المدفوع الآن">
            <NumericInput
              money
              className="h-12 text-lg"
              value={paidText}
              onChange={(e) => setPaidText(e.target.value)}
            />
          </Field>
        </div>

        <div className={`rounded-xl border p-3 ${remaining > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">{remaining > 0 ? 'يبقى على العميل' : 'مدفوعة بالكامل ✓'}</span>
            {remaining > 0 ? (
              <span className="tnum text-lg font-extrabold text-amber-800" dir="ltr">{formatJOD(remaining)}</span>
            ) : null}
          </div>
          {remaining > 0 ? (
            <p className="mt-1 text-xs font-bold leading-5 text-amber-800">
              سيظهر هذا المبلغ في صفحة الديون وعلى رصيد {customerName ?? (trimmedName || 'العميل')} بعد حفظ الفاتورة.
            </p>
          ) : null}
        </div>

        {isCashCustomer && onPickCustomer ? (
          <Button variant="outline" className="w-full" onClick={onPickCustomer}>
            أو اختَر عميلًا مسجّلًا عنده حساب
          </Button>
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

function QuickBtn({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-2 text-xs font-bold transition-colors ${
        active
          ? 'border-primary-600 bg-primary-50 text-primary-800 ring-1 ring-primary-300'
          : 'border-ink-300 bg-white text-ink-700 hover:border-primary-400 hover:text-primary-800'
      }`}
    >
      {label}
    </button>
  );
}

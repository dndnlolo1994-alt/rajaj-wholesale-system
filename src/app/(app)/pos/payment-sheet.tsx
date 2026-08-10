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

  const paid = isCashCustomer ? total : (parseMoney(paidText) ?? 0);
  const remaining = round3(total - paid);
  const invalid = paid < 0 || paid > total;
  const saveSuffix = remaining > 0 ? (paid <= 0 ? 'دين كامل' : 'آجل جزئي') : '';
  const displayCustomerName = (customerName ?? cashCustomerName.trim()) || 'زبون نقدي';

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
          <>
            <Field label="اسم العميل على الفاتورة (اختياري)" hint="للبيع السريع بدون فتح حساب عميل — يظهر في الفاتورة والطباعة فقط.">
              <Input
                value={cashCustomerName}
                onChange={(e) => onCashCustomerNameChange(e.target.value)}
                maxLength={150}
                placeholder="مثال: أبو أحمد"
              />
            </Field>
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-extrabold text-amber-900">تفاصيل الدفع: مدفوع كامل</p>
              <p className="text-xs font-bold leading-5 text-amber-800">
                البيع السريع بدون حساب عميل يُحفظ مدفوعًا بالكامل. إذا بدك ذمم أو متبقي، اختَر أو أضف عميل أولًا.
              </p>
              {onPickCustomer ? (
                <Button variant="secondary" className="w-full" onClick={onPickCustomer}>
                  اختيار عميل لتسجيل ذمم أو متبقي
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <Field label="تفاصيل الدفع" error={invalid ? 'المبلغ يجب أن يكون بين صفر والإجمالي' : null}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <QuickBtn label="مدفوع كامل" onClick={() => setPaidText(String(total))} />
                <QuickBtn label="ذمم بالكامل" onClick={() => setPaidText('0')} />
                <QuickBtn label="دفعة + متبقي" onClick={() => setPaidText(String(round3(total / 2)))} />
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
        )}

        {!isCashCustomer ? (
          <div className={`rounded-xl border p-3 ${remaining > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold">{remaining > 0 ? 'يبقى على العميل' : 'مدفوعة بالكامل ✓'}</span>
              {remaining > 0 ? (
                <span className="tnum text-lg font-extrabold text-amber-800" dir="ltr">{formatJOD(remaining)}</span>
              ) : null}
            </div>
            {remaining > 0 ? (
              <p className="mt-1 text-xs font-bold leading-5 text-amber-800">
                سيظهر هذا المبلغ تلقائيًا في صفحة الديون ورصيد {customerName ?? 'العميل'} بعد حفظ الفاتورة.
              </p>
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NumericInput, Select, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { parseMoney } from '@/lib/calc/money';
import { createExpenseAction } from '@/server/actions/expenses';
import type { PaymentMethod } from '@/lib/types/db';

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

/** الآن بصيغة حقل datetime-local */
function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** حوار تسجيل مصروف جديد */
export function ExpenseDialog({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [dateValue, setDateValue] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const openDialog = () => {
    setDateValue(nowLocalInput());
    setOpen(true);
  };

  const submit = async () => {
    if (!categoryId) {
      error('اختر تصنيف المصروف');
      return;
    }
    const amount = parseMoney(amountText);
    if (amount == null || amount <= 0) {
      error('أدخل مبلغًا صحيحًا أكبر من صفر');
      return;
    }
    setLoading(true);
    const res = await createExpenseAction({
      category_id: categoryId,
      amount,
      method,
      expense_date: dateValue ? new Date(dateValue).toISOString() : undefined,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    setLoading(false);
    if (res.ok) {
      success(`تم تسجيل المصروف ${res.data.expense_no}`);
      setOpen(false);
      setCategoryId('');
      setAmountText('');
      setMethod('cash');
      setNotes('');
      router.refresh();
    } else {
      error('تعذر تسجيل المصروف', res.error.message);
    }
  };

  return (
    <>
      <Button onClick={openDialog}>
        <Plus className="size-4" />
        مصروف جديد
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="مصروف جديد"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button onClick={submit} loading={loading}>
              حفظ المصروف
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {categories.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              لا توجد تصنيفات فعّالة — أضف تصنيفًا أولًا من زر «التصنيفات».
            </p>
          ) : null}

          <Field label="التصنيف" required>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">اختر التصنيف...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="المبلغ" required>
            <NumericInput
              money
              className="h-14 text-2xl"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.000"
            />
          </Field>

          <Field label="طريقة الدفع">
            <Segmented value={method} onChange={setMethod} options={methodOptions} className="flex-wrap" />
          </Field>

          <Field label="التاريخ والوقت">
            <Input
              type="datetime-local"
              dir="ltr"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </Field>

          <Field label="ملاحظات (اختياري)">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: فاتورة كهرباء المستودع..."
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

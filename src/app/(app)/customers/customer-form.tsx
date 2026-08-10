'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NumericInput, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { parseMoney } from '@/lib/calc/money';
import { createCustomerAction, updateCustomerAction } from '@/server/actions/customers';
import type { CustomerInput } from '@/lib/validation/schemas';
import type { Customer } from '@/lib/types/db';

/** حوار إنشاء/تعديل عميل — زر الفتح يُمرر عبر trigger */
export function CustomerFormDialog({
  customer,
  trigger,
  onCreated,
}: {
  customer?: Customer;
  trigger: React.ReactNode;
  onCreated?: (customer: {
    id: string;
    name: string;
    shop_name: string | null;
    phone: string | null;
    area: string | null;
    balance: number;
    credit_limit: number | null;
  }) => void;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [creditText, setCreditText] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? '');
    setShopName(customer?.shop_name ?? '');
    setPhone(customer?.phone ?? '');
    setWhatsapp(customer?.whatsapp ?? '');
    setArea(customer?.area ?? '');
    setAddress(customer?.address ?? '');
    setNotes(customer?.notes ?? '');
    setCreditText(customer?.credit_limit != null ? String(customer.credit_limit) : '');
    setIsActive(customer?.is_active ?? true);
  }, [open, customer]);

  const submit = async () => {
    if (!name.trim()) {
      error('اسم العميل مطلوب');
      return;
    }
    let creditLimit: number | null = null;
    if (creditText.trim() !== '') {
      creditLimit = parseMoney(creditText);
      if (creditLimit == null || creditLimit < 0) {
        error('الحد الائتماني غير صالح');
        return;
      }
    }
    const input: CustomerInput = {
      name: name.trim(),
      shop_name: shopName.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      area: area.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      credit_limit: creditLimit,
      is_active: isActive,
    };
    setSaving(true);
    const res = customer
      ? await updateCustomerAction(customer.id, input)
      : await createCustomerAction(input);
    setSaving(false);
    if (res.ok) {
      success(customer ? 'تم تحديث بيانات العميل' : 'تم إضافة العميل');
      if (!customer && onCreated) {
        onCreated({
          id: res.data.id,
          name: input.name,
          shop_name: input.shop_name ?? null,
          phone: input.phone ?? null,
          area: input.area ?? null,
          balance: 0,
          credit_limit: input.credit_limit ?? null,
        });
      }
      setOpen(false);
      router.refresh();
    } else {
      error('تعذر الحفظ', res.error.message);
    }
  };

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={customer ? 'تعديل بيانات العميل' : 'عميل جديد'}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={submit} loading={saving}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" autoFocus />
            </Field>
            <Field label="اسم المحل">
              <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="مثال: سوبرماركت النور" />
            </Field>
            <Field label="الهاتف">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="07XXXXXXXX" className="tnum" />
            </Field>
            <Field label="واتساب">
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" inputMode="tel" placeholder="07XXXXXXXX" className="tnum" />
            </Field>
            <Field label="المنطقة">
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="مثال: جبل الحسين" />
            </Field>
            <Field label="الحد الائتماني (اختياري)" hint="اتركه فارغًا بدون حد">
              <NumericInput money value={creditText} onChange={(e) => setCreditText(e.target.value)} placeholder="0.000" />
            </Field>
          </div>
          <Field label="العنوان">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان التفصيلي" />
          </Field>
          <Field label="ملاحظات">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات داخلية عن العميل..." />
          </Field>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-bold text-ink-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-primary-700"
            />
            عميل فعال
          </label>
        </div>
      </Dialog>
    </>
  );
}

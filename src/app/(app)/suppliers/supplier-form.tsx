'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { createSupplierAction, updateSupplierAction } from '@/server/actions/suppliers';
import type { SupplierInput } from '@/lib/validation/schemas';
import type { Supplier } from '@/lib/types/db';

/** حوار إنشاء/تعديل مورد — زر الفتح يُمرر عبر trigger */
export function SupplierFormDialog({
  supplier,
  trigger,
}: {
  supplier?: Supplier;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(supplier?.name ?? '');
    setCompanyName(supplier?.company_name ?? '');
    setPhone(supplier?.phone ?? '');
    setWhatsapp(supplier?.whatsapp ?? '');
    setArea(supplier?.area ?? '');
    setAddress(supplier?.address ?? '');
    setNotes(supplier?.notes ?? '');
    setIsActive(supplier?.is_active ?? true);
  }, [open, supplier]);

  const submit = async () => {
    if (!name.trim()) {
      error('اسم المورد مطلوب');
      return;
    }
    const input: SupplierInput = {
      name: name.trim(),
      company_name: companyName.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      area: area.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      is_active: isActive,
    };
    setSaving(true);
    const res = supplier
      ? await updateSupplierAction(supplier.id, input)
      : await createSupplierAction(input);
    setSaving(false);
    if (res.ok) {
      success(supplier ? 'تم تحديث بيانات المورد' : 'تم إضافة المورد');
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
        title={supplier ? 'تعديل بيانات المورد' : 'مورد جديد'}
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المورد" autoFocus />
            </Field>
            <Field label="اسم الشركة">
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="مثال: شركة الأغذية المتحدة" />
            </Field>
            <Field label="الهاتف">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="07XXXXXXXX" className="tnum" />
            </Field>
            <Field label="واتساب">
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" inputMode="tel" placeholder="07XXXXXXXX" className="tnum" />
            </Field>
            <Field label="المنطقة">
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="مثال: البيادر" />
            </Field>
            <Field label="العنوان">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان التفصيلي" />
            </Field>
          </div>
          <Field label="ملاحظات">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات داخلية عن المورد..." />
          </Field>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-bold text-ink-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-primary-700"
            />
            مورد فعال
          </label>
        </div>
      </Dialog>
    </>
  );
}

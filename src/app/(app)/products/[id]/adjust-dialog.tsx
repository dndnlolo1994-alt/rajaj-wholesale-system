'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Power, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Field, NumericInput, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { parseQty } from '@/lib/calc/money';
import { formatQty } from '@/lib/calc/units';
import { adjustStockAction, deleteProductAction, toggleProductActiveAction } from '@/server/actions/products';

/** حوار تعديل المخزون اليدوي (rpc adjust_stock) */
export function AdjustStockDialog({
  productId,
  stockUnits,
  unitsPerCarton,
}: {
  productId: string;
  stockUnits: number;
  unitsPerCarton: number;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'set' | 'delta'>('set');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = parseQty(qty);
    if (n == null) {
      error('أدخل الكمية بالحبة (رقم صحيح)');
      return;
    }
    if (reason.trim().length < 2) {
      error('سبب التعديل مطلوب');
      return;
    }
    const qtyUnits = mode === 'set' ? n : direction === 'out' ? -n : n;
    setSaving(true);
    const res = await adjustStockAction({ product_id: productId, mode, qty_units: qtyUnits, reason: reason.trim() });
    setSaving(false);
    if (res.ok) {
      success(
        res.data.changed ? 'تم تعديل المخزون' : 'لا تغيير في المخزون',
        `الرصيد الحالي: ${formatQty(res.data.stock_units, unitsPerCarton)}`,
      );
      setOpen(false);
      setQty('');
      setReason('');
      router.refresh();
    } else {
      error('تعذر التعديل', res.error.message);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" />
        تعديل المخزون
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="تعديل المخزون يدويًا"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={submit} loading={saving}>
              حفظ التعديل
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-ink-100/70 p-2.5 text-xs text-ink-700">
            الرصيد الحالي: <span className="tnum font-extrabold">{formatQty(stockUnits, unitsPerCarton)}</span>
            <span className="tnum"> ({stockUnits} حبة)</span>
          </p>

          <Field label="طريقة التعديل">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'set', label: 'تحديد كمية جديدة' },
                { value: 'delta', label: 'إضافة / خصم فرق' },
              ]}
            />
          </Field>

          {mode === 'delta' ? (
            <Field label="اتجاه الفرق">
              <Segmented
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'in', label: 'إضافة (+)' },
                  { value: 'out', label: 'خصم (−)' },
                ]}
              />
            </Field>
          ) : null}

          <Field label={mode === 'set' ? 'الكمية الجديدة (بالحبة)' : 'مقدار الفرق (بالحبة)'} required>
            <NumericInput value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />
          </Field>

          <Field label="سبب التعديل" required hint="يُسجَّل في حركة المخزون وسجل التدقيق">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تسوية بعد تلف/جرد يدوي..." />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** أزرار إدارة الصنف: تعديل + إيقاف/تفعيل + حذف */
export function ProductAdminActions({
  product,
  canEdit,
  canDelete,
}: {
  product: { id: string; name: string; is_active: boolean };
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { success, error } = useToast();
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggle = async () => {
    setToggling(true);
    const res = await toggleProductActiveAction(product.id, !product.is_active);
    setToggling(false);
    if (res.ok) {
      success(res.data.is_active ? 'تم تفعيل الصنف' : 'تم إيقاف الصنف');
      router.refresh();
    } else {
      error('تعذر تغيير الحالة', res.error.message);
    }
  };

  const remove = async () => {
    setDeleting(true);
    const res = await deleteProductAction(product.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (res.ok) {
      success('حُذف الصنف');
      router.push('/products');
      router.refresh();
    } else {
      error('تعذر الحذف', res.error.message);
    }
  };

  if (!canEdit) return null;

  return (
    <>
      <Link href={`/products/${product.id}/edit`}>
        <Button variant="outline">
          <Pencil className="size-4" />
          تعديل
        </Button>
      </Link>
      <Button variant="outline" onClick={toggle} loading={toggling}>
        <Power className="size-4" />
        {product.is_active ? 'إيقاف' : 'تفعيل'}
      </Button>
      {canDelete ? (
        <>
          <Button variant="outline" onClick={() => setConfirmDelete(true)} className="border-red-200 text-red-600 hover:bg-red-50">
            <Trash2 className="size-4" />
            حذف
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={remove}
            title="حذف الصنف"
            message={`سيُحذف الصنف «${product.name}» نهائيًا. إن كانت له حركات مخزون أو فواتير فلن يُحذف — أوقفه بدلًا من ذلك.`}
            confirmLabel="حذف نهائي"
            danger
            loading={deleting}
          />
        </>
      ) : null}
    </>
  );
}

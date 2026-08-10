'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NumericInput } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { formatJOD, parseMoney } from '@/lib/calc/money';
import {
  deleteCustomerPriceAction,
  searchProductsForPriceAction,
  upsertCustomerPriceAction,
  type ProductPriceSearchRow,
} from '@/server/actions/customers';
import type { UnitKind } from '@/lib/types/db';

/** زر + حوار إضافة سعر خاص: بحث صنف ← وحدة ← سعر ← حفظ */
export function AddPriceButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProductPriceSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<ProductPriceSearchRow | null>(null);
  const [unit, setUnit] = useState<UnitKind>('carton');
  const [priceText, setPriceText] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setProduct(null);
      setUnit('carton');
      setPriceText('');
    }
  }, [open]);

  // بحث مؤجّل عن الأصناف
  useEffect(() => {
    if (!open || product) return;
    setSearching(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await searchProductsForPriceAction(q);
      if (res.ok) setResults(res.data);
      setSearching(false);
    }, q ? 300 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open, product]);

  const pick = (p: ProductPriceSearchRow) => {
    setProduct(p);
    setUnit('carton');
    setPriceText(String(p.sale_price_carton));
  };

  const changeUnit = (u: UnitKind) => {
    setUnit(u);
    if (product) setPriceText(String(u === 'carton' ? product.sale_price_carton : product.sale_price_piece));
  };

  const submit = async () => {
    if (!product) {
      error('اختر الصنف أولًا');
      return;
    }
    const price = parseMoney(priceText);
    if (price == null || price < 0) {
      error('أدخل سعرًا صحيحًا');
      return;
    }
    setSaving(true);
    const res = await upsertCustomerPriceAction({
      customer_id: customerId,
      product_id: product.id,
      unit,
      price,
    });
    setSaving(false);
    if (res.ok) {
      success('تم حفظ السعر الخاص', `${product.name} — ${unit === 'carton' ? 'كرتونة' : 'حبة'}: ${formatJOD(price)}`);
      setOpen(false);
      router.refresh();
    } else {
      error('تعذر حفظ السعر', res.error.message);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        إضافة سعر
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="سعر خاص للعميل"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={submit} loading={saving} disabled={!product}>
              حفظ السعر
            </Button>
          </>
        }
      >
        {!product ? (
          <div className="space-y-3">
            <Input
              placeholder="ابحث عن الصنف بالاسم..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <div className="max-h-[40dvh] space-y-1 overflow-y-auto">
              {searching ? (
                <p className="py-6 text-center text-sm text-ink-500">جارٍ البحث...</p>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">لا توجد أصناف مطابقة</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pick(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block text-xs text-ink-500">الكرتونة = {p.units_per_carton} حبة</span>
                    </span>
                    <span className="tnum shrink-0 text-xs text-ink-500" dir="ltr">
                      {formatJOD(p.sale_price_carton, { symbol: false })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{product.name}</p>
                <p className="text-xs text-ink-500">الكرتونة = {product.units_per_carton} حبة</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setProduct(null)}>
                تغيير الصنف
              </Button>
            </div>
            <Field label="الوحدة">
              <Segmented
                value={unit}
                onChange={changeUnit}
                options={[
                  { value: 'carton', label: 'كرتونة' },
                  { value: 'piece', label: 'حبة' },
                ]}
              />
            </Field>
            <Field
              label="السعر الخاص"
              hint={`السعر العادي: ${formatJOD(unit === 'carton' ? product.sale_price_carton : product.sale_price_piece)}`}
            >
              <NumericInput
                money
                className="h-12 text-lg"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="0.000"
              />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}

/** زر حذف سعر خاص مع تأكيد */
export function DeletePriceButton({ id, productName }: { id: string; productName: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    const res = await deleteCustomerPriceAction(id);
    setLoading(false);
    if (res.ok) {
      success('تم حذف السعر الخاص');
      setOpen(false);
      router.refresh();
    } else {
      error('تعذر الحذف', res.error.message);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50"
        aria-label="حذف السعر"
      >
        <Trash2 className="size-4" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title="حذف السعر الخاص"
        message={`سيعود «${productName}» للسعر العادي عند البيع لهذا العميل. متابعة؟`}
        confirmLabel="حذف"
        danger
        loading={loading}
      />
    </>
  );
}

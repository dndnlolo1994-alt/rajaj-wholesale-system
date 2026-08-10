'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ChevronDown, Minus, Plus, Save, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, NumericInput, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Money } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ScannerDialog } from '@/components/barcode/scanner-dialog';
import { formatJOD, fromFils, parseMoney, parseQty, round3, toFils } from '@/lib/calc/money';
import { formatQty, unitLabel } from '@/lib/calc/units';
import type { PaymentMethod, UnitKind } from '@/lib/types/db';
import { barcodeLookupAction, posProductsAction, type PosProduct } from '@/server/actions/pos';
import {
  createPurchaseAction,
  listSuppliersQuickAction,
  purchasePricesAction,
  type QuickSupplier,
} from '@/server/actions/purchases';

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

/** نص مالي بلا فواصل آلاف — صالح لإعادة القراءة بـ parseMoney */
function moneyText(n: number): string {
  return round3(n).toFixed(3);
}

interface PurchaseLine {
  key: string;
  product_id: string;
  name: string;
  unit: UnitKind;
  units_per_carton: number;
  qty: number;
  /** نص سعر الشراء للوحدة المختارة — فارغ يعني غير مُدخل */
  costText: string;
  stock_units: number;
}

export function PurchaseClient({ defaultMethod }: { defaultMethod: PaymentMethod }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [supplier, setSupplier] = useState<QuickSupplier | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [dateStr, setDateStr] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');

  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [paidText, setPaidText] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ذاكرة آخر سعر شراء للكرتونة لكل صنف (pos_products لا يعيده) */
  const pricesRef = useRef<Record<string, number>>({});

  // تاريخ الفاتورة: الآن بالتوقيت المحلي (يُضبط بعد التحميل لتفادي فرق الخادم/المتصفح)
  useEffect(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setDateStr(d.toISOString().slice(0, 16));
  }, []);

  // ---------- البحث عن الأصناف ----------
  const ensurePrices = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !(id in pricesRef.current));
    if (missing.length === 0) return;
    const res = await purchasePricesAction(missing);
    if (res.ok) Object.assign(pricesRef.current, res.data);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const res = await posProductsAction({ q: query });
      if (res.ok) {
        await ensurePrices(res.data.map((p) => p.id));
        setResults(res.data);
      }
      setSearching(false);
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [q, ensurePrices]);

  // ---------- إضافة سطر ----------
  const addProduct = useCallback((p: PosProduct) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === p.id && l.unit === 'carton');
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l));
      }
      const base = pricesRef.current[p.id] ?? 0;
      return [
        {
          key: `${p.id}:${Date.now()}`,
          product_id: p.id,
          name: p.name,
          unit: 'carton' as UnitKind,
          units_per_carton: p.units_per_carton,
          qty: 1,
          costText: base > 0 ? moneyText(base) : '',
          stock_units: p.stock_units,
        },
        ...prev,
      ];
    });
  }, []);

  const handleBarcode = useCallback(
    (code: string): boolean | void => {
      barcodeLookupAction(code, null).then(async (res) => {
        if (!res.ok) {
          toastError('خطأ في قراءة الباركود', res.error.message);
          return;
        }
        if (res.data) {
          await ensurePrices([res.data.id]);
          addProduct(res.data);
          success(`أُضيف: ${res.data.name}`);
        } else {
          toastError('باركود غير معروف', `لا يوجد صنف بالباركود ${code}. يمكنك إضافته من شاشة الأصناف.`);
        }
      });
    },
    [addProduct, ensurePrices, success, toastError],
  );

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    if (/^\d{6,14}$/.test(value)) {
      handleBarcode(value);
      setQ('');
      return;
    }
    if (results.length > 0) {
      addProduct(results[0]);
      setQ('');
    }
  };

  // ---------- تعديل السطور ----------
  const updateLine = (key: string, patch: Partial<PurchaseLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const changeUnit = (key: string, unit: UnitKind) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key || l.unit === unit) return l;
        const cost = parseMoney(l.costText);
        let costText = l.costText;
        if (cost != null) {
          const upc = Math.max(1, l.units_per_carton);
          costText = moneyText(unit === 'piece' ? round3(cost / upc) : round3(cost * upc));
        }
        return { ...l, unit, costText };
      }),
    );
  };

  // ---------- الحسابات ----------
  const totalFils = useMemo(
    () => lines.reduce((a, l) => a + toFils(parseMoney(l.costText) ?? 0) * l.qty, 0),
    [lines],
  );
  const total = fromFils(totalFils);
  const paid = parseMoney(paidText) ?? 0;
  const remaining = round3(total - paid);
  const paidInvalid = paid < 0 || paid > total;

  // ---------- الحفظ ----------
  const save = async () => {
    if (!supplier) {
      toastError('اختر المورد أولًا', 'فاتورة المشتريات يجب أن تكون على مورد مسجّل.');
      setPickerOpen(true);
      return;
    }
    if (lines.length === 0) {
      toastError('أضف صنفًا واحدًا على الأقل');
      return;
    }
    for (const l of lines) {
      if (parseMoney(l.costText) == null) {
        toastError('سعر الشراء ناقص', `أدخل سعر شراء ال${unitLabel[l.unit]} للصنف "${l.name}".`);
        return;
      }
    }
    if (paidInvalid) {
      toastError('المبلغ المدفوع غير صالح', 'يجب أن يكون بين صفر وإجمالي الفاتورة.');
      return;
    }
    setSubmitting(true);
    const res = await createPurchaseAction({
      supplier_id: supplier.id,
      purchase_date: dateStr ? new Date(dateStr).toISOString() : undefined,
      supplier_invoice_no: supplierInvoiceNo.trim() || null,
      items: lines.map((l) => ({
        product_id: l.product_id,
        unit: l.unit,
        qty: l.qty,
        unit_cost: parseMoney(l.costText) ?? 0,
      })),
      paid: round3(paid),
      payment_method: paid > 0 ? method : null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toastError('لم تُحفظ فاتورة المشتريات', res.error.message);
      return;
    }
    success(`حُفظت فاتورة المشتريات ${res.data.invoice_no}`);
    router.push(`/purchases/${res.data.id}`);
  };

  // ====================================================================
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* المورد */}
      <button
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-ink-200 bg-white p-3 text-start shadow-card transition-colors hover:border-primary-300"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800">
          <Truck className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">
            {supplier ? supplier.name : 'اختر المورد *'}
          </span>
          <span className="block truncate text-xs text-ink-500">
            {supplier
              ? supplier.balance > 0
                ? `له علينا ${formatJOD(supplier.balance)}`
                : (supplier.company_name ?? 'لا مستحقات عليه')
              : 'إلزامي قبل حفظ الفاتورة'}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-500" />
      </button>

      {/* بيانات الفاتورة */}
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label="تاريخ الفاتورة">
            <input
              type="datetime-local"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20"
              dir="ltr"
            />
          </Field>
          <Field label="رقم فاتورة المورد (اختياري)">
            <Input
              value={supplierInvoiceNo}
              onChange={(e) => setSupplierInvoiceNo(e.target.value)}
              placeholder="الرقم المطبوع على فاتورة المورد..."
              dir="ltr"
              className="tnum"
            />
          </Field>
        </CardBody>
      </Card>

      {/* الأصناف */}
      <Card>
        <CardHeader title={`الأصناف (${lines.length})`} />
        <CardBody className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="ابحث بالاسم أو امسح الباركود..."
                className="h-12 w-full rounded-xl border border-ink-300 bg-white px-4 text-sm focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20"
                autoComplete="off"
              />
              {searching ? (
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">...</span>
              ) : null}
            </div>
            <Button variant="secondary" size="lg" className="h-12 shrink-0 px-3.5" onClick={() => setScannerOpen(true)} title="مسح بالكاميرا">
              <Camera className="size-5" />
            </Button>
          </div>

          {/* نتائج البحث */}
          {q.trim() ? (
            <div className="max-h-72 divide-y divide-ink-100 overflow-y-auto rounded-xl border border-ink-200">
              {searching && results.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-500">جارٍ البحث...</p>
              ) : results.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-500">لا توجد أصناف مطابقة</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addProduct(p);
                      setQ('');
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block text-xs text-ink-500">
                        المخزون: {formatQty(p.stock_units, p.units_per_carton)}
                        {pricesRef.current[p.id] > 0
                          ? ` — آخر شراء ${formatJOD(pricesRef.current[p.id], { symbol: false })} / كرتونة`
                          : ''}
                      </span>
                    </span>
                    <Plus className="size-4 shrink-0 text-primary-700" />
                  </button>
                ))
              )}
            </div>
          ) : null}

          {/* السطور */}
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-300 py-8 text-center text-sm text-ink-500">
              لم تُضف أصناف بعد — ابحث أو امسح الباركود لإضافة أول صنف
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <PurchaseLineRow
                  key={l.key}
                  line={l}
                  onQty={(qty) => (qty <= 0 ? removeLine(l.key) : updateLine(l.key, { qty }))}
                  onCostText={(t) => updateLine(l.key, { costText: t })}
                  onUnit={(u) => changeUnit(l.key, u)}
                  onRemove={() => removeLine(l.key)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* الدفع والحفظ */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between border-b border-dashed border-ink-200 pb-3">
            <span className="text-base font-extrabold">الإجمالي الكلي</span>
            <Money value={total} className="text-2xl text-primary-900" />
          </div>

          <Field label="المدفوع الآن" error={paidInvalid ? 'المبلغ يجب أن يكون بين صفر والإجمالي' : null}>
            <NumericInput money className="h-12 text-lg" value={paidText} onChange={(e) => setPaidText(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <QuickBtn label="المبلغ كامل" onClick={() => setPaidText(moneyText(total))} />
              <QuickBtn label="النصف" onClick={() => setPaidText(moneyText(round3(total / 2)))} />
              <QuickBtn label="بدون دفعة (آجل)" onClick={() => setPaidText('0')} />
            </div>
          </Field>

          {paid > 0 ? (
            <Field label="طريقة الدفع">
              <Segmented value={method} onChange={setMethod} options={methods} className="flex-wrap" />
            </Field>
          ) : null}

          <div
            className={`flex items-center justify-between rounded-xl border p-3 ${
              remaining > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <span className={`text-sm font-bold ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {remaining > 0 ? 'يبقى للمورد' : 'مدفوعة بالكامل ✓'}
            </span>
            {remaining > 0 ? <Money value={remaining} className="text-lg text-red-700" /> : null}
          </div>

          <Field label="ملاحظات (اختياري)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: بضاعة موسمية..." />
          </Field>

          <Button size="lg" className="w-full" onClick={save} loading={submitting} disabled={lines.length === 0}>
            <Save className="size-5" />
            حفظ فاتورة المشتريات
          </Button>
        </CardBody>
      </Card>

      {/* الحوارات */}
      <SupplierPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setSupplier} />
      <ScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={handleBarcode} continuous />
    </div>
  );
}

// ======================================================================
function PurchaseLineRow({
  line,
  onQty,
  onCostText,
  onUnit,
  onRemove,
}: {
  line: PurchaseLine;
  onQty: (qty: number) => void;
  onCostText: (t: string) => void;
  onUnit: (u: UnitKind) => void;
  onRemove: () => void;
}) {
  const cost = parseMoney(line.costText);
  const lineTotal = fromFils(toFils(cost ?? 0) * line.qty);

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{line.name}</p>
        <Money value={lineTotal} className="text-sm" />
        <button onClick={onRemove} className="rounded-lg p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600" aria-label="حذف">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-ink-200">
          <button onClick={() => onQty(line.qty - 1)} className="p-2 text-ink-700 hover:text-red-600" aria-label="إنقاص">
            <Minus className="size-4" />
          </button>
          <NumericInput
            className="h-8 w-12 border-0 text-center"
            value={line.qty}
            onChange={(e) => {
              const n = parseQty(e.target.value);
              if (n != null && n > 0) onQty(n);
            }}
          />
          <button onClick={() => onQty(line.qty + 1)} className="p-2 text-ink-700 hover:text-primary-700" aria-label="زيادة">
            <Plus className="size-4" />
          </button>
        </div>
        <Segmented
          size="sm"
          value={line.unit}
          onChange={onUnit}
          options={[
            { value: 'carton', label: 'كرتونة' },
            { value: 'piece', label: 'حبة' },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink-500">سعر شراء ال{unitLabel[line.unit]}</span>
          <NumericInput
            money
            className={`h-9 w-28 ${cost == null ? 'border-amber-400' : ''}`}
            value={line.costText}
            placeholder="0.000"
            onChange={(e) => onCostText(e.target.value)}
          />
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-ink-500">
        المخزون الحالي: {formatQty(line.stock_units, line.units_per_carton)}
      </p>
    </div>
  );
}

// ======================================================================
function SupplierPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (supplier: QuickSupplier) => void;
}) {
  const [q, setQ] = useState('');
  const [suppliers, setSuppliers] = useState<QuickSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await listSuppliersQuickAction(q);
      if (res.ok) setSuppliers(res.data);
      setLoading(false);
    }, q ? 300 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open]);

  return (
    <Dialog open={open} onClose={onClose} title="اختيار المورد">
      <div className="space-y-3">
        <Input placeholder="ابحث بالاسم، الشركة، الهاتف..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />

        <div className="max-h-[45dvh] space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-ink-500">جارٍ البحث...</p>
          ) : suppliers.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">
              لا يوجد موردون مطابقون — أضف الموردين من شاشة الموردين
            </p>
          ) : (
            suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSelect(s);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-primary-50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-extrabold text-primary-800">
                    {s.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{s.name}</span>
                    <span className="block truncate text-xs text-ink-500">{s.company_name ?? 'مورد'}</span>
                  </span>
                </span>
                {s.balance !== 0 ? (
                  <span className="text-end">
                    <Money value={s.balance} className="text-xs text-red-600" />
                    <span className="block text-[10px] text-ink-500">له علينا</span>
                  </span>
                ) : (
                  <Truck className="size-4 text-ink-300" />
                )}
              </button>
            ))
          )}
        </div>
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

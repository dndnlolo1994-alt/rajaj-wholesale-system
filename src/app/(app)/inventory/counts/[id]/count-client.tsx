'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Search, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { NumericInput } from '@/components/ui/input';
import { Money } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ScannerDialog } from '@/components/barcode/scanner-dialog';
import { PrintButton } from '@/components/printing/print-button';
import { parseQty } from '@/lib/calc/money';
import { formatQty } from '@/lib/calc/units';
import type { CountStatus, CountType } from '@/lib/types/db';
import { cancelCountAction, completeCountAction, setCountItemAction } from '@/server/actions/products';

export interface CountHeader {
  id: string;
  count_no: string;
  count_type: CountType;
  status: CountStatus;
  items_total: number;
  total_diff_units: number;
  total_diff_value: number;
}

export interface CountItem {
  id: number;
  product_id: string;
  product_name: string;
  barcode: string | null;
  expected_units: number;
  actual_units: number | null;
  diff_units: number | null;
  diff_value: number | null;
  units_per_carton: number;
}

export function CountClient({
  count,
  items,
  showProfit,
  canCount,
  canComplete,
}: {
  count: CountHeader;
  items: CountItem[];
  showProfit: boolean;
  canCount: boolean;
  canComplete: boolean;
}) {
  const router = useRouter();
  const { success, error } = useToast();

  const [rows, setRows] = useState<CountItem[]>(items);
  const [filter, setFilter] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [apply, setApply] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const counted = useMemo(() => rows.filter((r) => r.actual_units != null).length, [rows]);
  const pct = count.items_total > 0 ? Math.round((counted / count.items_total) * 100) : 0;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.product_name.toLowerCase().includes(q) || (r.barcode ?? '').toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const diffs = useMemo(() => {
    const withDiff = rows.filter((r) => r.diff_units != null && r.diff_units !== 0);
    return {
      items: withDiff,
      totalUnits: withDiff.reduce((a, r) => a + (r.diff_units ?? 0), 0),
      totalValue: withDiff.reduce((a, r) => a + Number(r.diff_value ?? 0), 0),
    };
  }, [rows]);

  // حفظ كمية بند — يعيد النتيجة لتحديث الفرق فورًا
  const saveItem = async (productId: string, actual: number | null): Promise<boolean> => {
    const res = await setCountItemAction({ count_id: count.id, product_id: productId, actual_units: actual });
    if (!res.ok) {
      error('تعذر حفظ العد', res.error.message);
      return false;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.product_id === productId
          ? { ...r, actual_units: res.data.actual_units, diff_units: res.data.diff_units, diff_value: res.data.diff_value }
          : r,
      ),
    );
    return true;
  };

  // قراءة باركود: القفز للبند وتركيز حقله (يُغلق الماسح عند النجاح فقط)
  const handleScan = (code: string): boolean => {
    const target = rows.find((r) => (r.barcode ?? '') === code.trim());
    if (!target) return false;
    setFilter('');
    setTimeout(() => {
      const el = inputRefs.current.get(target.product_id);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus();
      el?.select();
    }, 80);
    return true;
  };

  const focusNext = (productId: string) => {
    const list = filtered;
    const idx = list.findIndex((r) => r.product_id === productId);
    for (let i = idx + 1; i < list.length; i++) {
      const el = inputRefs.current.get(list[i].product_id);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.focus();
        el.select();
        return;
      }
    }
  };

  const complete = async () => {
    setCompleting(true);
    const res = await completeCountAction({ id: count.id, apply });
    setCompleting(false);
    if (res.ok) {
      success(
        `اعتُمد الجرد ${res.data.count_no}`,
        apply
          ? `عُدّل مخزون ${res.data.adjusted_products} صنف — إجمالي الفرق ${res.data.total_diff_units} حبة`
          : 'اعتُمد بدون تطبيق تسويات',
      );
      setCompleteOpen(false);
      router.refresh();
    } else {
      error('تعذر الاعتماد', res.error.message);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    const res = await cancelCountAction({ id: count.id });
    setCancelling(false);
    setCancelOpen(false);
    if (res.ok) {
      success('أُلغيت جلسة الجرد');
      router.refresh();
    } else {
      error('تعذر الإلغاء', res.error.message);
    }
  };

  // ---------- عرض القراءة فقط (معتمدة/ملغاة) ----------
  if (count.status !== 'open') {
    const countedRows = rows.filter((r) => r.actual_units != null);
    const totalDiffUnits = count.status === 'completed' ? count.total_diff_units : diffs.totalUnits;
    const totalDiffValue = count.status === 'completed' ? Number(count.total_diff_value) : diffs.totalValue;
    return (
      <Card>
        <CardHeader
          title={`النتائج (${countedRows.length} صنف معدود)`}
          action={<PrintButton kind="count" id={count.id} />}
        />
        {countedRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">لم يُعدّ أي صنف في هذه الجلسة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-500">
                  <th className="px-4 py-2.5 text-start font-bold">الصنف</th>
                  <th className="px-2 py-2.5 text-center font-bold">المتوقع</th>
                  <th className="px-2 py-2.5 text-center font-bold">الفعلي</th>
                  <th className="px-2 py-2.5 text-center font-bold">الفرق</th>
                  {showProfit ? <th className="px-4 py-2.5 text-end font-bold">قيمة الفرق</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {countedRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-bold">{r.product_name}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2.5 text-center">{formatQty(r.expected_units, r.units_per_carton)}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2.5 text-center font-bold">
                      {formatQty(r.actual_units ?? 0, r.units_per_carton)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-center">
                      <DiffBadge diff={r.diff_units} upc={r.units_per_carton} />
                    </td>
                    {showProfit ? (
                      <td className="px-4 py-2.5 text-end">
                        {r.diff_units !== 0 && r.diff_value != null ? (
                          <Money value={r.diff_value} signed symbol={false} />
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-200 bg-ink-100/40 font-extrabold">
                  <td className="px-4 py-2.5">الإجمالي</td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5" />
                  <td className="whitespace-nowrap px-2 py-2.5 text-center">
                    <span className={`tnum ${totalDiffUnits > 0 ? 'text-emerald-700' : totalDiffUnits < 0 ? 'text-red-600' : 'text-ink-500'}`}>
                      {totalDiffUnits > 0 ? '+' : ''}
                      {totalDiffUnits} حبة
                    </span>
                  </td>
                  {showProfit ? (
                    <td className="px-4 py-2.5 text-end"><Money value={totalDiffValue} signed /></td>
                  ) : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    );
  }

  // ---------- الجلسة المفتوحة ----------
  return (
    <div className="space-y-3">
      {/* شريط التقدم والأدوات */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold">
                المعدود: <span className="tnum">{counted}</span> من <span className="tnum">{count.items_total}</span>
                <span className="tnum ms-2 text-ink-500">({pct}%)</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canComplete ? (
                <Button onClick={() => setCompleteOpen(true)}>
                  <CheckCircle2 className="size-4" />
                  اعتماد الجرد
                </Button>
              ) : null}
              {canCount ? (
                <Button variant="outline" onClick={() => setCancelOpen(true)} className="border-red-200 text-red-600 hover:bg-red-50">
                  <XCircle className="size-4" />
                  إلغاء الجلسة
                </Button>
              ) : null}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-200">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="تصفية بالاسم أو الباركود..."
                className="h-11 w-full rounded-lg border border-ink-300 bg-white pe-9 ps-9 text-sm focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20"
              />
              {filter ? (
                <button
                  onClick={() => setFilter('')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-500 hover:bg-ink-100"
                  aria-label="مسح"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} aria-label="مسح بالكاميرا">
              <Camera className="size-5" />
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* البنود */}
      <Card>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-500">لا نتائج مطابقة</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {filtered.map((item) => (
              <CountItemRow
                key={item.id}
                item={item}
                disabled={!canCount}
                showProfit={showProfit}
                onSave={saveItem}
                onNext={() => focusNext(item.product_id)}
                registerRef={(el) => {
                  if (el) inputRefs.current.set(item.product_id, el);
                  else inputRefs.current.delete(item.product_id);
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {/* حوار الاعتماد */}
      <Dialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="اعتماد الجرد"
        footer={
          <>
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={completing}>
              تراجع
            </Button>
            <Button onClick={complete} loading={completing}>
              اعتماد
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-ink-100/60 p-3">
            <p>
              المعدود: <span className="tnum font-extrabold">{counted}</span> من{' '}
              <span className="tnum font-extrabold">{count.items_total}</span> صنف
            </p>
            <p className="mt-1">
              بنود بفروق: <span className="tnum font-extrabold">{diffs.items.length}</span>
              {' — '}إجمالي الفرق:{' '}
              <span className={`tnum font-extrabold ${diffs.totalUnits > 0 ? 'text-emerald-700' : diffs.totalUnits < 0 ? 'text-red-600' : ''}`}>
                {diffs.totalUnits > 0 ? '+' : ''}
                {diffs.totalUnits} حبة
              </span>
            </p>
            {showProfit ? (
              <p className="mt-1">
                قيمة الفرق: <Money value={diffs.totalValue} signed className="text-sm" />
              </p>
            ) : null}
          </div>
          {counted < count.items_total ? (
            <p className="rounded-lg bg-amber-50 p-2.5 text-xs font-bold text-amber-800">
              {count.items_total - counted} صنف لم يُعدّ — البنود غير المعدودة لن تُعدَّل.
            </p>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={apply}
              onChange={(e) => setApply(e.target.checked)}
              className="size-4.5 accent-primary-700"
            />
            <span className="font-bold">تطبيق التسويات على المخزون</span>
          </label>
          <p className="text-xs leading-5 text-ink-500">
            عند التفعيل: يُسوَّى مخزون كل صنف معدود إلى الكمية الفعلية (الفرق يُحسب مقابل المخزون الحي لحظة الاعتماد).
          </p>
        </div>
      </Dialog>

      {/* حوار الإلغاء */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
        title="إلغاء جلسة الجرد"
        message="ستُغلق الجلسة دون أي تعديل على المخزون، وتبقى في السجل بحالة ملغاة."
        confirmLabel="إلغاء الجلسة"
        danger
        loading={cancelling}
      />

      <ScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={handleScan} continuous />
    </div>
  );
}

// ---------------------------------------------------------------------
// بند جرد واحد
// ---------------------------------------------------------------------
function CountItemRow({
  item,
  disabled,
  showProfit,
  onSave,
  onNext,
  registerRef,
}: {
  item: CountItem;
  disabled: boolean;
  showProfit: boolean;
  onSave: (productId: string, actual: number | null) => Promise<boolean>;
  onNext: () => void;
  registerRef: (el: HTMLInputElement | null) => void;
}) {
  const [value, setValue] = useState(item.actual_units != null ? String(item.actual_units) : '');
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const trimmed = value.trim();
    const actual = trimmed === '' ? null : parseQty(trimmed);
    if (trimmed !== '' && actual == null) {
      setValue(item.actual_units != null ? String(item.actual_units) : '');
      return;
    }
    if (actual === item.actual_units) return; // لا تغيير
    setSaving(true);
    const ok = await onSave(item.product_id, actual);
    setSaving(false);
    if (!ok) setValue(item.actual_units != null ? String(item.actual_units) : '');
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 ${item.actual_units != null ? 'bg-primary-50/30' : ''}`}>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-bold">{item.product_name}</p>
        <p className="text-[11px] text-ink-500">
          {item.barcode ? <span className="tnum me-2" dir="ltr">{item.barcode}</span> : null}
          المتوقع: <span className="tnum font-bold">{formatQty(item.expected_units, item.units_per_carton)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <NumericInput
          ref={registerRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
              onNext();
            }
          }}
          disabled={disabled || saving}
          placeholder="الفعلي بالحبة"
          className="h-10 w-28"
        />
        <div className="w-24 text-end text-xs">
          {saving ? (
            <span className="text-ink-500">حفظ...</span>
          ) : item.diff_units != null ? (
            <div>
              <DiffBadge diff={item.diff_units} upc={item.units_per_carton} />
              {showProfit && item.diff_units !== 0 && item.diff_value != null ? (
                <Money value={item.diff_value} signed symbol={false} className="mt-0.5 block text-[11px]" />
              ) : null}
            </div>
          ) : (
            <span className="text-ink-300">لم يُعدّ</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffBadge({ diff, upc }: { diff: number | null; upc: number }) {
  if (diff == null) return <span className="text-ink-300">—</span>;
  if (diff === 0) return <span className="text-xs font-bold text-ink-500">مطابق ✓</span>;
  return (
    <span className={`tnum text-xs font-extrabold ${diff > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
      {diff > 0 ? '+' : ''}
      {formatQty(diff, upc)}
    </span>
  );
}

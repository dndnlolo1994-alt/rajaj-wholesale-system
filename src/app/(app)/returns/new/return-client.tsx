'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReceiptText, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NumericInput, Select, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { formatJOD, fromFils, parseMoney, parseQty, round3, toFils } from '@/lib/calc/money';
import { unitLabel } from '@/lib/calc/units';
import { fmtDateTime } from '@/lib/format/date';
import type { ItemCondition, PaymentMethod, UnitKind } from '@/lib/types/db';
import type { ReturnableSale, ReturnableSaleItem } from '@/server/queries/returns';
import { createReturnAction, findSaleAction } from '@/server/actions/returns';

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل' },
  { value: 'wallet', label: 'محفظة' },
  { value: 'cheque', label: 'شيك' },
  { value: 'other', label: 'أخرى' },
];

const reasonOptions = ['قرب انتهاء الصلاحية', 'بضاعة تالفة', 'خطأ في الطلب', 'تراجع العميل'];

/** نص مالي بلا فواصل آلاف — صالح لإعادة القراءة بـ parseMoney */
function moneyText(n: number): string {
  return round3(n).toFixed(3);
}

/** السعر الافتراضي: نفس وحدة البيع ← net_total/qty، وإلا ← net_total/qty_units */
function defaultPrice(it: ReturnableSaleItem, unit: UnitKind): number {
  return unit === it.unit
    ? round3(it.net_total / Math.max(1, it.qty))
    : round3(it.net_total / Math.max(1, it.qty_units));
}

export function ReturnClient({ data, saleNotFound }: { data: ReturnableSale | null; saleNotFound?: boolean }) {
  if (!data) return <FindSaleCard saleNotFound={saleNotFound} />;
  return <ReturnBuilder data={data} />;
}

// ======================================================================
// البحث عن الفاتورة الأصل
// ======================================================================
function FindSaleCard({ saleNotFound }: { saleNotFound?: boolean }) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [invoiceNo, setInvoiceNo] = useState('');
  const [finding, setFinding] = useState(false);

  const find = async () => {
    const v = invoiceNo.trim();
    if (!v) return;
    setFinding(true);
    const res = await findSaleAction(v);
    if (!res.ok) {
      setFinding(false);
      toastError('تعذر البحث', res.error.message);
      return;
    }
    if (!res.data) {
      setFinding(false);
      toastError('لا توجد فاتورة', `لا توجد فاتورة مكتملة بالرقم "${v}".`);
      return;
    }
    router.replace(`/returns/new?sale=${res.data.id}`);
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card>
        <CardHeader title="مرتجع جديد — ابحث عن فاتورة البيع" />
        <CardBody className="space-y-3">
          {saleNotFound ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              الفاتورة المطلوبة غير موجودة أو ملغاة — ابحث برقم فاتورة آخر.
            </p>
          ) : null}
          <p className="text-sm leading-6 text-ink-500">
            أدخل رقم فاتورة البيع لإنشاء مرتجع عليها، أو افتح الفاتورة من شاشة الفواتير واضغط «إنشاء مرتجع».
          </p>
          <Field label="رقم الفاتورة">
            <Input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  find();
                }
              }}
              placeholder="مثال: RM-000123"
              dir="ltr"
              className="tnum"
              autoFocus
            />
          </Field>
          <Button className="w-full" onClick={find} loading={finding} disabled={!invoiceNo.trim()}>
            <Search className="size-4" />
            بحث عن الفاتورة
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

// ======================================================================
// بناء المرتجع
// ======================================================================
interface LineState {
  qtyText: string;
  unit: UnitKind;
  priceText: string;
  condition: ItemCondition;
}

function ReturnBuilder({ data }: { data: ReturnableSale }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const isCash = data.sale.customer_id === null;

  const [lines, setLines] = useState<Record<string, LineState>>(() => {
    const init: Record<string, LineState> = {};
    for (const it of data.items) {
      init[it.sale_item_id] = {
        qtyText: '',
        unit: 'piece',
        priceText: moneyText(defaultPrice(it, 'piece')),
        condition: 'good',
      };
    }
    return init;
  });
  const [refundText, setRefundText] = useState('0');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [reasonSel, setReasonSel] = useState('');
  const [reasonOther, setReasonOther] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const patchLine = (id: string, patch: Partial<LineState>) => {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const setUnit = (it: ReturnableSaleItem, unit: UnitKind) => {
    patchLine(it.sale_item_id, { unit, priceText: moneyText(defaultPrice(it, unit)) });
  };

  const parsed = data.items.map((it) => {
    const st = lines[it.sale_item_id];
    const qty = parseQty(st.qtyText) ?? 0;
    const qtyUnits = qty * (st.unit === 'carton' ? it.units_per_carton : 1);
    const price = parseMoney(st.priceText) ?? defaultPrice(it, st.unit);
    return { it, st, qty, qtyUnits, price, totalF: toFils(price) * qty, over: qtyUnits > it.returnable_units };
  });
  const active = parsed.filter((l) => l.qty > 0);
  const hasOver = active.some((l) => l.over);
  const total = fromFils(active.reduce((a, l) => a + l.totalF, 0));

  const refund = isCash ? total : (parseMoney(refundText) ?? 0);
  const refundInvalid = refund < 0 || round3(refund) > total;

  const save = async () => {
    if (active.length === 0) {
      toastError('لم تُحدَّد كميات', 'أدخل كمية إرجاع لصنف واحد على الأقل.');
      return;
    }
    if (hasOver) {
      toastError('كمية تتجاوز المتاح', 'بعض الكميات أكبر من المتاح للإرجاع — عدّلها أولًا.');
      return;
    }
    if (refundInvalid) {
      toastError('المبلغ المردود غير صالح', 'يجب أن يكون بين صفر وإجمالي المرتجع.');
      return;
    }
    const reasonFinal = reasonSel === 'other' ? (reasonOther.trim() || 'أخرى') : (reasonSel || null);
    setSubmitting(true);
    const res = await createReturnAction({
      sale_id: data.sale.id,
      items: active.map((l) => ({
        sale_item_id: l.it.sale_item_id,
        unit: l.st.unit,
        qty: l.qty,
        unit_price: l.price,
        condition: l.st.condition,
      })),
      refund_cash: round3(refund),
      refund_method: refund > 0 ? refundMethod : null,
      reason: reasonFinal,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toastError('لم يُحفظ المرتجع', res.error.message);
      return;
    }
    success(`حُفظ المرتجع ${res.data.return_no}`);
    router.push(`/returns/${res.data.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* رأس الفاتورة الأصل */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-extrabold">
              <ReceiptText className="size-4 text-primary-700" />
              مرتجع على فاتورة{' '}
              <Link href={`/sales/${data.sale.id}`} className="tnum text-primary-700 hover:underline" dir="ltr">
                {data.sale.invoice_no}
              </Link>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {data.sale.customer_name ?? 'زبون نقدي'} — {fmtDateTime(data.sale.sale_date)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[11px] font-bold text-ink-500">قيمة الفاتورة</p>
            <Money value={data.sale.total} />
            <Link href="/returns/new" className="mt-0.5 block text-[11px] font-bold text-primary-700 hover:underline">
              تغيير الفاتورة
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* الأصناف */}
      <div className="space-y-2">
        {parsed.map(({ it, st, qty, price, totalF, over }) => {
          const fullyReturned = it.returnable_units <= 0;
          const unitOptions: { value: UnitKind; label: string }[] =
            it.returnable_units >= it.units_per_carton
              ? [
                  { value: 'piece', label: 'حبة' },
                  { value: 'carton', label: 'كرتونة' },
                ]
              : [{ value: 'piece', label: 'حبة' }];
          return (
            <div
              key={it.sale_item_id}
              className={`rounded-xl border bg-white p-3 ${over && qty > 0 ? 'border-red-300 bg-red-50/50' : 'border-ink-200'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{it.product_name}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    بيع: <span className="tnum">{it.qty}</span> {unitLabel[it.unit]} — المتاح للإرجاع:{' '}
                    <span className="tnum font-bold">{it.returnable_units}</span> حبة
                  </p>
                </div>
                {fullyReturned ? (
                  <Badge tone="muted">أُرجع بالكامل</Badge>
                ) : qty > 0 ? (
                  <Money value={fromFils(totalF)} className="text-sm" />
                ) : null}
              </div>

              {!fullyReturned ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-ink-500">الكمية</span>
                      <NumericInput
                        className="h-9 w-16 text-center"
                        value={st.qtyText}
                        placeholder="0"
                        onChange={(e) => patchLine(it.sale_item_id, { qtyText: e.target.value })}
                      />
                    </div>
                    <Segmented size="sm" value={st.unit} onChange={(u) => setUnit(it, u)} options={unitOptions} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-ink-500">سعر ال{unitLabel[st.unit]}</span>
                      <NumericInput
                        money
                        className="h-9 w-24"
                        value={st.priceText}
                        placeholder={moneyText(price)}
                        onChange={(e) => patchLine(it.sale_item_id, { priceText: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Segmented
                      size="sm"
                      value={st.condition}
                      onChange={(c) => patchLine(it.sale_item_id, { condition: c })}
                      options={[
                        { value: 'good', label: 'سليم يعود للمخزون' },
                        { value: 'damaged', label: 'تالف (خسارة)' },
                      ]}
                    />
                  </div>
                  {over && qty > 0 ? (
                    <p className="mt-1.5 text-[11px] font-bold text-red-600">
                      الكمية أكبر من المتاح للإرجاع ({it.returnable_units} حبة)
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* الإجمالي والرد */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between border-b border-dashed border-ink-200 pb-3">
            <span className="text-base font-extrabold">إجمالي المرتجع</span>
            <Money value={total} className="text-2xl text-primary-900" />
          </div>

          <Field
            label="المبلغ المردود نقدًا الآن"
            error={!isCash && refundInvalid ? 'يجب أن يكون بين صفر وإجمالي المرتجع' : null}
            hint={
              isCash
                ? 'فاتورة زبون نقدي — يُرد المبلغ نقدًا بالكامل.'
                : 'الباقي غير المردود يُخصم من رصيد العميل (دين أقل).'
            }
          >
            <NumericInput
              money
              className="h-12 text-lg"
              value={isCash ? moneyText(total) : refundText}
              disabled={isCash}
              onChange={(e) => setRefundText(e.target.value)}
            />
            {!isCash ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <QuickBtn label="رد كامل القيمة" onClick={() => setRefundText(moneyText(total))} />
                <QuickBtn label="بدون رد نقدي (خصم من الرصيد)" onClick={() => setRefundText('0')} />
              </div>
            ) : null}
          </Field>

          {refund > 0 ? (
            <Field label="طريقة الرد">
              <Segmented value={refundMethod} onChange={setRefundMethod} options={methods} className="flex-wrap" />
            </Field>
          ) : null}

          <Field label="سبب المرتجع">
            <Select value={reasonSel} onChange={(e) => setReasonSel(e.target.value)}>
              <option value="">اختر السبب (اختياري)...</option>
              {reasonOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="other">أخرى</option>
            </Select>
            {reasonSel === 'other' ? (
              <Input
                className="mt-2"
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="اكتب السبب..."
              />
            ) : null}
          </Field>

          <Field label="ملاحظات (اختياري)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية..." />
          </Field>

          <Button size="lg" className="w-full" onClick={save} loading={submitting} disabled={active.length === 0 || hasOver}>
            <RotateCcw className="size-5" />
            حفظ المرتجع {total > 0 ? `(${formatJOD(total)})` : ''}
          </Button>
        </CardBody>
      </Card>
    </div>
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, ChevronDown, Minus, PauseCircle, Plus, Printer, ReceiptText,
  ShoppingCart, Trash2, TriangleAlert, UserRound, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Money } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ScannerDialog } from '@/components/barcode/scanner-dialog';
import { CustomerPicker } from './customer-picker';
import { PaymentSheet } from './payment-sheet';
import { computeInvoice } from '@/lib/calc/invoice';
import { parseMoney, parseQty, formatJOD } from '@/lib/calc/money';
import { formatQty, unitLabel } from '@/lib/calc/units';
import { fmtRelative } from '@/lib/format/date';
import type { Category, PaymentMethod, UnitKind } from '@/lib/types/db';
import {
  barcodeLookupAction, customerFavoritesAction, posProductsAction,
  type CustomerFavorite, type PosProduct, type QuickCustomer,
} from '@/server/actions/pos';
import {
  createSaleAction, deleteHeldSaleAction, holdSaleAction, listHeldSalesAction,
  type HeldSalePayload, type SaleCreateResult,
} from '@/server/actions/sales';

interface CartLine {
  key: string;
  product_id: string;
  name: string;
  unit: UnitKind;
  units_per_carton: number;
  qty: number;
  unit_price: number;
  discount: number;
  stock_units: number;
}

interface Props {
  categories: Category[];
  allowNegativeStock: boolean;
  defaultMethod: PaymentMethod;
  printerWidth: number;
  autoPrint: boolean;
}

export function PosClient({ categories, allowNegativeStock, defaultMethod, printerWidth, autoPrint }: Props) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [customer, setCustomer] = useState<QuickCustomer | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [heldId, setHeldId] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [quickUnit, setQuickUnit] = useState<UnitKind>('carton');
  const [favorites, setFavorites] = useState<CustomerFavorite[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldList, setHeldList] = useState<{ id: string; label: string | null; created_at: string; payload: HeldSalePayload }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overCredit, setOverCredit] = useState<{ payload: Parameters<typeof createSaleAction>[0]; message: string } | null>(null);
  const [result, setResult] = useState<SaleCreateResult | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- البحث ----------
  const runSearch = useCallback(
    (query: string, catId: string | null, custId: string | null) => {
      setSearching(true);
      posProductsAction({ q: query, category_id: catId, customer_id: custId }).then((res) => {
        if (res.ok) setProducts(res.data);
        setSearching(false);
      });
    },
    [],
  );

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(q, categoryId, customer?.id ?? null), q ? 280 : 0);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryId, customer?.id]);

  // ---------- مفضلة العميل ----------
  useEffect(() => {
    if (!customer) {
      setFavorites([]);
      return;
    }
    customerFavoritesAction(customer.id).then((res) => {
      if (res.ok) setFavorites(res.data.filter((f) => f.is_active));
    });
  }, [customer]);

  // ---------- اختصارات لوحة المفاتيح ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F4' && lines.length > 0) {
        e.preventDefault();
        setPayOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lines.length]);

  // ---------- إضافة سطر ----------
  const priceFor = useCallback((p: PosProduct, unit: UnitKind): number => {
    if (unit === 'carton') return p.special_price_carton ?? p.sale_price_carton;
    return p.special_price_piece ?? p.sale_price_piece;
  }, []);

  const addProduct = useCallback(
    (p: PosProduct, unit: UnitKind, price?: number, qty = 1) => {
      const key = `${p.id}:${unit}`;
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
        }
        return [
          {
            key,
            product_id: p.id,
            name: p.name,
            unit,
            units_per_carton: p.units_per_carton,
            qty,
            unit_price: price ?? priceFor(p, unit),
            discount: 0,
            stock_units: p.stock_units,
          },
          ...prev,
        ];
      });
    },
    [priceFor],
  );

  const handleBarcode = useCallback(
    (code: string): boolean | void => {
      barcodeLookupAction(code, customer?.id ?? null).then((res) => {
        if (!res.ok) {
          toastError('خطأ في قراءة الباركود', res.error.message);
          return;
        }
        if (res.data) {
          addProduct(res.data, quickUnit);
          success(`أُضيف: ${res.data.name}`);
        } else {
          toastError('باركود غير معروف', `لا يوجد صنف بالباركود ${code}. يمكنك إضافته من شاشة الأصناف.`);
        }
      });
    },
    [customer?.id, quickUnit, addProduct, success, toastError],
  );

  // إدخال ماسح USB: أرقام + Enter في حقل البحث
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
    if (products.length > 0) {
      addProduct(products[0], quickUnit);
      setQ('');
    }
  };

  // ---------- تعديل السطور ----------
  const updateLine = (key: string, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const totals = useMemo(
    () =>
      computeInvoice(
        lines.map((l) => ({
          productId: l.product_id,
          name: l.name,
          unit: l.unit,
          unitsPerCarton: l.units_per_carton,
          qty: l.qty,
          unitPrice: l.unit_price,
          discount: l.discount,
        })),
        invoiceDiscount,
      ),
    [lines, invoiceDiscount],
  );

  const itemsCount = lines.reduce((a, l) => a + l.qty, 0);

  const stockIssues = useMemo(() => {
    if (allowNegativeStock) return new Set<string>();
    const needed = new Map<string, number>();
    for (const l of lines) {
      needed.set(l.product_id, (needed.get(l.product_id) ?? 0) + l.qty * (l.unit === 'carton' ? l.units_per_carton : 1));
    }
    const issues = new Set<string>();
    for (const l of lines) {
      if ((needed.get(l.product_id) ?? 0) > l.stock_units) issues.add(l.key);
    }
    return issues;
  }, [lines, allowNegativeStock]);

  // ---------- الحفظ ----------
  const submitSale = async (payload: Parameters<typeof createSaleAction>[0]) => {
    setSubmitting(true);
    const res = await createSaleAction(payload);
    setSubmitting(false);
    if (!res.ok) {
      if (res.error.code === 'OVER_CREDIT_LIMIT') {
        setOverCredit({ payload: { ...payload, allow_over_credit: true }, message: res.error.message });
        return;
      }
      toastError('لم تُحفظ الفاتورة', res.error.message);
      return;
    }
    setPayOpen(false);
    setOverCredit(null);
    setResult(res.data);
    if (autoPrint) {
      window.open(`/print/sale/${res.data.id}?w=${printerWidth}&auto=1`, '_blank', 'noopener,width=450,height=650');
    }
  };

  const completeSale = (paid: number, method: PaymentMethod, notes: string) => {
    submitSale({
      customer_id: customer?.id ?? null,
      items: lines.map((l) => ({
        product_id: l.product_id,
        unit: l.unit,
        qty: l.qty,
        unit_price: l.unit_price,
        discount: l.discount,
      })),
      invoice_discount: invoiceDiscount,
      paid,
      payment_method: method,
      notes: notes || null,
      held_id: heldId,
    });
  };

  const resetAll = () => {
    setLines([]);
    setInvoiceDiscount(0);
    setCustomer(null);
    setHeldId(null);
    setResult(null);
    setQ('');
    router.refresh();
  };

  // ---------- التعليق ----------
  const holdSale = async () => {
    if (lines.length === 0) return;
    const res = await holdSaleAction({
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? null,
      lines: lines.map((l) => ({
        product_id: l.product_id,
        name: l.name,
        unit: l.unit,
        units_per_carton: l.units_per_carton,
        qty: l.qty,
        unit_price: l.unit_price,
        discount: l.discount,
        stock_units: l.stock_units,
      })),
      invoice_discount: invoiceDiscount,
      notes: null,
    });
    if (res.ok) {
      success('عُلّقت الفاتورة — يمكنك الرجوع لها لاحقًا');
      setLines([]);
      setInvoiceDiscount(0);
      setCustomer(null);
      setHeldId(null);
    } else {
      toastError('تعذر تعليق الفاتورة', res.error.message);
    }
  };

  const openHeldList = async () => {
    const res = await listHeldSalesAction();
    if (res.ok) {
      setHeldList(res.data);
      setHeldOpen(true);
    }
  };

  const resumeHeld = (item: { id: string; payload: HeldSalePayload }) => {
    const p = item.payload;
    setLines(
      p.lines.map((l) => ({
        key: `${l.product_id}:${l.unit}`,
        product_id: l.product_id,
        name: l.name,
        unit: l.unit,
        units_per_carton: l.units_per_carton,
        qty: l.qty,
        unit_price: l.unit_price,
        discount: l.discount,
        stock_units: l.stock_units,
      })),
    );
    setInvoiceDiscount(p.invoice_discount);
    setHeldId(item.id);
    if (p.customer_id && p.customer_name) {
      setCustomer({ id: p.customer_id, name: p.customer_name, shop_name: null, phone: null, area: null, balance: 0, credit_limit: null });
    } else {
      setCustomer(null);
    }
    setHeldOpen(false);
  };

  // ====================================================================
  return (
    <div className="lg:flex lg:gap-4">
      {/* ================= يمين: الأصناف ================= */}
      <div className="min-w-0 flex-1 space-y-3">
        {/* العميل + المعلّقة */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPickerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-ink-200 bg-white p-2.5 text-start shadow-card transition-colors hover:border-primary-300"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-800">
              <UserRound className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">
                {customer ? customer.name : 'زبون نقدي'}
              </span>
              <span className="block truncate text-xs text-ink-500">
                {customer
                  ? customer.balance > 0
                    ? `عليه ${formatJOD(customer.balance)}`
                    : (customer.shop_name ?? 'عميل مسجّل')
                  : 'اضغط لاختيار عميل'}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-ink-500" />
          </button>
          {customer ? (
            <button
              onClick={() => setCustomer(null)}
              className="rounded-lg border border-ink-200 bg-white p-2.5 text-ink-500 hover:text-red-600"
              title="إلغاء اختيار العميل"
            >
              <X className="size-4" />
            </button>
          ) : null}
          <Button variant="outline" onClick={openHeldList} className="shrink-0" title="الفواتير المعلّقة">
            <PauseCircle className="size-4" />
            <span className="hidden sm:inline">المعلّقة</span>
          </Button>
        </div>

        {/* البحث والباركود */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="ابحث بالاسم أو امسح الباركود... (F2)"
              className="h-12 w-full rounded-xl border border-ink-300 bg-white px-4 text-sm shadow-card focus:border-primary-500 focus:outline-2 focus:outline-primary-600/20"
              autoComplete="off"
            />
            {searching ? (
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">...</span>
            ) : null}
          </div>
          <Button variant="secondary" size="lg" className="h-12 shrink-0 px-3.5" onClick={() => setScannerOpen(true)} title="مسح بالكاميرا">
            <Camera className="size-5" />
          </Button>
          <Segmented
            value={quickUnit}
            onChange={setQuickUnit}
            options={[
              { value: 'carton', label: 'كرتونة' },
              { value: 'piece', label: 'حبة' },
            ]}
            className="hidden h-12 items-center sm:inline-flex"
          />
        </div>

        {/* الأقسام */}
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <CategoryChip active={categoryId === null} onClick={() => setCategoryId(null)} label="الكل" />
          {categories.map((c) => (
            <CategoryChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} label={c.name} />
          ))}
        </div>

        {/* مفضلة العميل */}
        {customer && favorites.length > 0 ? (
          <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-2.5">
            <p className="mb-1.5 px-1 text-xs font-extrabold text-primary-800">
              الأكثر شراءً لـ{customer.name} — اضغط للإضافة بآخر سعر
            </p>
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
              {favorites.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    const unit = f.last_purchase?.unit ?? 'carton';
                    addProduct(
                      {
                        id: f.id, name: f.name, barcode: f.barcode, category_id: null, brand: null,
                        units_per_carton: f.units_per_carton, stock_units: f.stock_units, min_stock_units: 0,
                        sale_price_carton: f.sale_price_carton, sale_price_piece: f.sale_price_piece,
                        wholesale_price_carton: null, wholesale_price_piece: null,
                        special_price_carton: null, special_price_piece: null,
                      },
                      unit,
                      f.last_purchase?.unit_price,
                    );
                  }}
                  className="shrink-0 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-start shadow-sm transition-colors hover:border-primary-400"
                >
                  <span className="block max-w-36 truncate text-xs font-bold">{f.name}</span>
                  <span className="tnum block text-[10px] text-ink-500" dir="ltr">
                    {f.last_purchase ? `${formatJOD(f.last_purchase.unit_price, { symbol: false })} / ${unitLabel[f.last_purchase.unit]}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* شبكة الأصناف */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const low = p.stock_units <= p.min_stock_units;
            const out = p.stock_units <= 0;
            return (
              <div key={p.id} className="flex flex-col rounded-xl border border-ink-200 bg-white p-2.5 shadow-card">
                <p className="line-clamp-2 min-h-10 text-sm font-bold leading-5">{p.name}</p>
                <p className={`mt-1 text-[11px] font-bold ${out ? 'text-red-600' : low ? 'text-amber-600' : 'text-ink-500'}`}>
                  {out ? 'نفد المخزون' : formatQty(p.stock_units, p.units_per_carton)}
                </p>
                <div className="mt-auto space-y-1 pt-2">
                  <button
                    onClick={() => addProduct(p, 'carton')}
                    disabled={out && !allowNegativeStock}
                    className="flex w-full items-center justify-between rounded-lg bg-primary-700 px-2.5 py-1.5 text-white transition-colors hover:bg-primary-800 disabled:opacity-40"
                  >
                    <span className="text-xs font-bold">كرتونة</span>
                    <span className="tnum text-xs font-extrabold" dir="ltr">
                      {formatJOD(p.special_price_carton ?? p.sale_price_carton, { symbol: false })}
                      {p.special_price_carton != null ? ' ★' : ''}
                    </span>
                  </button>
                  <button
                    onClick={() => addProduct(p, 'piece')}
                    disabled={out && !allowNegativeStock}
                    className="flex w-full items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-primary-800 transition-colors hover:bg-primary-100 disabled:opacity-40"
                  >
                    <span className="text-xs font-bold">حبة</span>
                    <span className="tnum text-xs font-extrabold" dir="ltr">
                      {formatJOD(p.special_price_piece ?? p.sale_price_piece, { symbol: false })}
                      {p.special_price_piece != null ? ' ★' : ''}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {products.length === 0 && !searching ? (
          <div className="rounded-xl border border-dashed border-ink-300 py-10 text-center text-sm text-ink-500">
            لا توجد أصناف مطابقة
            {/^\d{6,14}$/.test(q.trim()) ? (
              <a href={`/products/new?barcode=${q.trim()}`} className="mt-2 block font-bold text-primary-700 hover:underline">
                + إضافة صنف جديد بالباركود {q.trim()}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ================= يسار: السلة (شاشات كبيرة) ================= */}
      <div className="hidden w-[380px] shrink-0 lg:block">
        <div className="sticky top-[72px] rounded-xl border border-ink-200 bg-white shadow-card">
          <CartPanel
            lines={lines}
            totals={totals}
            invoiceDiscount={invoiceDiscount}
            setInvoiceDiscount={setInvoiceDiscount}
            updateLine={updateLine}
            removeLine={removeLine}
            stockIssues={stockIssues}
            onPay={() => setPayOpen(true)}
            onHold={holdSale}
          />
        </div>
      </div>

      {/* ================= شريط السلة السفلي (جوال) ================= */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 pb-1 lg:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-primary-800 px-4 py-3 text-white shadow-pop"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold">
              <ShoppingCart className="size-5" />
              {itemsCount} صنف
            </span>
            <span className="tnum text-base font-extrabold" dir="ltr">{formatJOD(totals.total)}</span>
          </button>
        </div>
      ) : null}

      {/* سلة الجوال */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} title={`السلة (${itemsCount})`}>
        <CartPanel
          lines={lines}
          totals={totals}
          invoiceDiscount={invoiceDiscount}
          setInvoiceDiscount={setInvoiceDiscount}
          updateLine={updateLine}
          removeLine={removeLine}
          stockIssues={stockIssues}
          onPay={() => {
            setCartOpen(false);
            setPayOpen(true);
          }}
          onHold={() => {
            setCartOpen(false);
            holdSale();
          }}
          bare
        />
      </Dialog>

      {/* ================= الحوارات ================= */}
      <CustomerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setCustomer} />
      <ScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={handleBarcode} continuous />
      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={totals.total}
        isCashCustomer={!customer}
        customerName={customer?.name ?? null}
        defaultMethod={defaultMethod}
        submitting={submitting}
        onConfirm={completeSale}
      />

      {/* تجاوز الحد الائتماني */}
      <ConfirmDialog
        open={overCredit !== null}
        onClose={() => setOverCredit(null)}
        onConfirm={() => overCredit && submitSale(overCredit.payload)}
        title="تجاوز الحد الائتماني"
        message={`${overCredit?.message ?? ''} هل تريد المتابعة وحفظ الفاتورة على حساب العميل؟`}
        confirmLabel="متابعة البيع"
        danger
        loading={submitting}
      />

      {/* الفواتير المعلّقة */}
      <Dialog open={heldOpen} onClose={() => setHeldOpen(false)} title="الفواتير المعلّقة">
        {heldList.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">لا توجد فواتير معلّقة</p>
        ) : (
          <div className="space-y-2">
            {heldList.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 p-3">
                <button onClick={() => resumeHeld(h)} className="min-w-0 flex-1 text-start">
                  <p className="truncate text-sm font-bold">{h.label ?? 'فاتورة معلّقة'}</p>
                  <p className="text-xs text-ink-500">
                    {h.payload.lines.length} صنف — {fmtRelative(h.created_at)}
                  </p>
                </button>
                <button
                  onClick={async () => {
                    await deleteHeldSaleAction(h.id);
                    setHeldList((prev) => prev.filter((x) => x.id !== h.id));
                  }}
                  className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600"
                  title="حذف المسودة"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* نجاح البيع */}
      <Dialog open={result !== null} onClose={resetAll} title="تم حفظ الفاتورة ✓">
        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary-50 p-4 text-center">
              <p className="text-sm font-bold text-primary-800">{result.invoice_no}</p>
              <p className="mt-1 text-3xl font-extrabold text-primary-900" dir="ltr">
                {formatJOD(result.total)}
              </p>
              {result.remaining > 0 ? (
                <p className="mt-1 text-sm font-bold text-amber-700">
                  المتبقي على العميل: {formatJOD(result.remaining)}
                </p>
              ) : (
                <p className="mt-1 text-sm font-bold text-emerald-700">مدفوعة بالكامل</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => window.open(`/print/sale/${result.id}?w=${printerWidth}&auto=1`, '_blank', 'noopener,width=450,height=650')}
              >
                <Printer className="size-4" />
                طباعة
              </Button>
              <Button variant="outline" onClick={() => router.push(`/sales/${result.id}`)}>
                <ReceiptText className="size-4" />
                عرض الفاتورة
              </Button>
            </div>
            <Button size="lg" className="w-full" onClick={resetAll}>
              <Plus className="size-5" />
              بيع جديد
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

// ======================================================================
function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
        active ? 'bg-primary-700 text-white shadow-sm' : 'border border-ink-200 bg-white text-ink-700 hover:border-primary-300'
      }`}
    >
      {label}
    </button>
  );
}

function CartPanel({
  lines,
  totals,
  invoiceDiscount,
  setInvoiceDiscount,
  updateLine,
  removeLine,
  stockIssues,
  onPay,
  onHold,
  bare,
}: {
  lines: CartLine[];
  totals: ReturnType<typeof computeInvoice>;
  invoiceDiscount: number;
  setInvoiceDiscount: (n: number) => void;
  updateLine: (key: string, patch: Partial<CartLine>) => void;
  removeLine: (key: string) => void;
  stockIssues: Set<string>;
  onPay: () => void;
  onHold: () => void;
  bare?: boolean;
}) {
  return (
    <div className={bare ? '' : 'flex max-h-[calc(100dvh-120px)] flex-col'}>
      {!bare ? (
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <ShoppingCart className="size-4 text-primary-700" />
            الفاتورة الحالية
          </p>
          {lines.length > 0 ? (
            <button onClick={onHold} className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline">
              <PauseCircle className="size-4" />
              تعليق
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={bare ? 'space-y-2' : 'min-h-0 flex-1 space-y-2 overflow-y-auto p-3'}>
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-500">
            السلة فارغة — أضف أصنافًا بالبحث أو الباركود
          </p>
        ) : (
          lines.map((l) => (
            <CartLineRow
              key={l.key}
              line={l}
              hasIssue={stockIssues.has(l.key)}
              onQty={(qty) => (qty <= 0 ? removeLine(l.key) : updateLine(l.key, { qty }))}
              onPrice={(p) => updateLine(l.key, { unit_price: p })}
              onDiscount={(d) => updateLine(l.key, { discount: d })}
              onUnit={(u) => updateLine(l.key, { unit: u })}
              onRemove={() => removeLine(l.key)}
            />
          ))
        )}
      </div>

      {lines.length > 0 ? (
        <div className={bare ? 'mt-3 space-y-2' : 'space-y-2 border-t border-ink-100 p-3'}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">المجموع</span>
            <Money value={totals.subtotal} />
          </div>
          {totals.lineDiscountTotal > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">خصومات الأصناف</span>
              <span className="tnum font-bold text-amber-700" dir="ltr">−{formatJOD(totals.lineDiscountTotal)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="shrink-0 text-ink-500">خصم الفاتورة</span>
            <NumericInput
              money
              className="h-9 w-28"
              value={invoiceDiscount || ''}
              placeholder="0.000"
              onChange={(e) => setInvoiceDiscount(parseMoney(e.target.value) ?? 0)}
            />
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-ink-200 pt-2">
            <span className="text-base font-extrabold">الإجمالي</span>
            <Money value={totals.total} className="text-xl text-primary-900" />
          </div>
          <Button size="lg" className="w-full" onClick={onPay} disabled={stockIssues.size > 0}>
            الدفع وإتمام البيع (F4)
          </Button>
          {stockIssues.size > 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-600">
              <TriangleAlert className="size-4" />
              كميات تتجاوز المخزون المتاح — عدّلها أو فعّل البيع بالسالب من الإعدادات
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CartLineRow({
  line,
  hasIssue,
  onQty,
  onPrice,
  onDiscount,
  onUnit,
  onRemove,
}: {
  line: CartLine;
  hasIssue: boolean;
  onQty: (qty: number) => void;
  onPrice: (price: number) => void;
  onDiscount: (d: number) => void;
  onUnit: (u: UnitKind) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lineTotal = line.qty * line.unit_price - line.discount;

  return (
    <div className={`rounded-xl border p-2.5 ${hasIssue ? 'border-red-300 bg-red-50/50' : 'border-ink-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => setExpanded(!expanded)} className="min-w-0 flex-1 text-start">
          <p className="truncate text-sm font-bold">{line.name}</p>
          <p className="tnum text-xs text-ink-500" dir="ltr">
            {formatJOD(line.unit_price, { symbol: false })} × {line.qty} {unitLabel[line.unit]}
            {line.discount > 0 ? ` − ${formatJOD(line.discount, { symbol: false })}` : ''}
          </p>
        </button>
        <Money value={lineTotal} className="text-sm" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
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
        <button onClick={onRemove} className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600" aria-label="حذف">
          <Trash2 className="size-4" />
        </button>
      </div>

      {expanded ? (
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-100 pt-2">
          <div>
            <p className="mb-1 text-[11px] font-bold text-ink-500">سعر ال{unitLabel[line.unit]}</p>
            <NumericInput
              money
              className="h-9"
              defaultValue={formatJOD(line.unit_price, { symbol: false })}
              onBlur={(e) => {
                const p = parseMoney(e.target.value);
                if (p != null && p >= 0) onPrice(p);
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold text-ink-500">خصم السطر</p>
            <NumericInput
              money
              className="h-9"
              defaultValue={line.discount ? formatJOD(line.discount, { symbol: false }) : ''}
              placeholder="0.000"
              onBlur={(e) => {
                const d = parseMoney(e.target.value);
                onDiscount(d != null && d >= 0 ? d : 0);
              }}
            />
          </div>
        </div>
      ) : null}
      {hasIssue ? (
        <p className="mt-1.5 text-[11px] font-bold text-red-600">
          المتوفر: {formatQty(line.stock_units, line.units_per_carton)} فقط
        </p>
      ) : null}
    </div>
  );
}

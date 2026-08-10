'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Calculator, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, NumericInput, Select, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ScannerDialog } from '@/components/barcode/scanner-dialog';
import { parseMoney, parseQty, formatJOD, formatPercent, profitPercentOnCost, marginPercent, round3 } from '@/lib/calc/money';
import { derivePiecePrice } from '@/lib/calc/units';
import type { Category } from '@/lib/types/db';
import type { ProductInput } from '@/lib/validation/schemas';
import type { ProductFull } from '@/server/queries/products';
import { createProductAction, updateProductAction } from '@/server/actions/products';

/** نموذج إنشاء/تعديل صنف — يُستخدم في صفحتي new و edit */
export function ProductForm({
  categories,
  product,
  initialBarcode,
  canSeeProfit,
}: {
  categories: Category[];
  product?: ProductFull | null;
  initialBarcode?: string;
  canSeeProfit: boolean;
}) {
  const router = useRouter();
  const { success, error } = useToast();

  const [name, setName] = useState(product?.name ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [notes, setNotes] = useState(product?.notes ?? '');
  const [upc, setUpc] = useState(product ? String(product.units_per_carton) : '');
  const [purchaseCarton, setPurchaseCarton] = useState(product ? String(Number(product.purchase_price_carton)) : '');
  const [saleCarton, setSaleCarton] = useState(product ? String(Number(product.sale_price_carton)) : '');
  const [salePiece, setSalePiece] = useState(product ? String(Number(product.sale_price_piece)) : '');
  const [wholesaleCarton, setWholesaleCarton] = useState(
    product?.wholesale_price_carton != null ? String(Number(product.wholesale_price_carton)) : '',
  );
  const [wholesalePiece, setWholesalePiece] = useState(
    product?.wholesale_price_piece != null ? String(Number(product.wholesale_price_piece)) : '',
  );
  const [minStock, setMinStock] = useState(product ? String(product.min_stock_units) : '0');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // معاينة الربح الحية (داخلي فقط)
  const profitInfo = useMemo(() => {
    if (!canSeeProfit) return null;
    const cost = parseMoney(purchaseCarton) ?? 0;
    const upcNum = parseQty(upc) ?? 0;
    if (cost <= 0) return null;
    const cartonPrice = parseMoney(saleCarton) ?? 0;
    const piecePrice = parseMoney(salePiece) ?? 0;
    const pieceCost = upcNum >= 1 ? derivePiecePrice(cost, upcNum) : 0;
    return {
      carton: {
        profit: round3(cartonPrice - cost),
        onCost: profitPercentOnCost(cost, cartonPrice),
        margin: marginPercent(cost, cartonPrice),
      },
      piece:
        upcNum >= 1
          ? {
              profit: round3(piecePrice - pieceCost),
              onCost: profitPercentOnCost(pieceCost, piecePrice),
              margin: marginPercent(pieceCost, piecePrice),
            }
          : null,
    };
  }, [canSeeProfit, purchaseCarton, saleCarton, salePiece, upc]);

  const fillPieceFromCarton = () => {
    const cartonPrice = parseMoney(saleCarton);
    const upcNum = parseQty(upc);
    if (cartonPrice == null || upcNum == null || upcNum < 1) {
      error('أدخل سعر بيع الكرتونة وعدد الحبات أولًا');
      return;
    }
    setSalePiece(String(derivePiecePrice(cartonPrice, upcNum)));
  };

  const submit = async () => {
    if (!name.trim()) {
      error('اسم الصنف مطلوب');
      return;
    }
    const upcNum = parseQty(upc);
    if (upcNum == null || upcNum < 1) {
      error('عدد الحبات في الكرتونة مطلوب (1 على الأقل)');
      return;
    }
    const saleCartonNum = parseMoney(saleCarton);
    if (saleCartonNum == null) {
      error('سعر بيع الكرتونة مطلوب');
      return;
    }
    const salePieceNum = parseMoney(salePiece);
    if (salePieceNum == null) {
      error('سعر بيع الحبة مطلوب — استخدم زر «احسب من الكرتونة» إن أردت');
      return;
    }

    const input: ProductInput = {
      name: name.trim(),
      barcode: barcode.trim() || null,
      sku: sku.trim() || null,
      category_id: categoryId || null,
      brand: brand.trim() || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
      image_url: product?.image_url ?? null,
      units_per_carton: upcNum,
      purchase_price_carton: parseMoney(purchaseCarton) ?? 0,
      sale_price_carton: saleCartonNum,
      sale_price_piece: salePieceNum,
      wholesale_price_carton: parseMoney(wholesaleCarton),
      wholesale_price_piece: parseMoney(wholesalePiece),
      min_stock_units: parseQty(minStock) ?? 0,
      is_active: isActive,
    };

    setSaving(true);
    const res = product ? await updateProductAction(product.id, input) : await createProductAction(input);
    setSaving(false);
    if (res.ok) {
      success(product ? 'تم حفظ التعديلات' : 'أُضيف الصنف');
      router.push(`/products/${res.data.id}`);
      router.refresh();
    } else {
      error('تعذر الحفظ', res.error.message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="بيانات الصنف" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الصنف" required className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عصير برتقال 1 لتر" autoFocus />
          </Field>

          <Field label="الباركود">
            <div className="flex items-center gap-2">
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                dir="ltr"
                inputMode="numeric"
                className="tnum"
                placeholder="امسح أو اكتب الباركود"
              />
              <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} aria-label="مسح بالكاميرا">
                <Camera className="size-5" />
              </Button>
            </div>
          </Field>

          <Field label="SKU (رمز داخلي)">
            <Input value={sku} onChange={(e) => setSku(e.target.value)} dir="ltr" className="tnum" placeholder="اختياري" />
          </Field>

          <Field label="القسم">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">بدون قسم</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="الشركة / العلامة">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="اختياري" />
          </Field>

          <Field label="الوصف" className="sm:col-span-2">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف مختصر يظهر داخليًا" />
          </Field>

          <Field label="ملاحظات" className="sm:col-span-2">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات داخلية" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="الوحدات والأسعار" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="عدد الحبات في الكرتونة" required hint="المخزون يُحسب دائمًا بالحبة">
            <NumericInput value={upc} onChange={(e) => setUpc(e.target.value)} placeholder="مثال: 12" />
          </Field>

          <Field label="سعر شراء الكرتونة" hint="يُحدَّث تلقائيًا من فواتير الشراء">
            <NumericInput money value={purchaseCarton} onChange={(e) => setPurchaseCarton(e.target.value)} placeholder="0.000" />
          </Field>

          <Field label="سعر بيع الكرتونة" required>
            <NumericInput money value={saleCarton} onChange={(e) => setSaleCarton(e.target.value)} placeholder="0.000" />
          </Field>

          <Field label="سعر بيع الحبة" required>
            <div className="flex items-center gap-2">
              <NumericInput money value={salePiece} onChange={(e) => setSalePiece(e.target.value)} placeholder="0.000" />
              <Button variant="secondary" size="sm" onClick={fillPieceFromCarton} className="shrink-0">
                <Calculator className="size-4" />
                احسب من الكرتونة
              </Button>
            </div>
          </Field>

          <Field label="سعر جملة خاص — كرتونة" hint="اختياري: لعملاء الجملة">
            <NumericInput money value={wholesaleCarton} onChange={(e) => setWholesaleCarton(e.target.value)} placeholder="—" />
          </Field>

          <Field label="سعر جملة خاص — حبة" hint="اختياري">
            <NumericInput money value={wholesalePiece} onChange={(e) => setWholesalePiece(e.target.value)} placeholder="—" />
          </Field>

          {profitInfo ? (
            <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3 text-xs sm:col-span-2">
              <p className="mb-1.5 font-extrabold text-primary-900">معاينة الربح (داخلي — لا يظهر للعميل)</p>
              <div className="space-y-1">
                <ProfitLine label="الكرتونة" data={profitInfo.carton} />
                {profitInfo.piece ? <ProfitLine label="الحبة" data={profitInfo.piece} /> : null}
              </div>
            </div>
          ) : null}

          <Field label="الحد الأدنى للمخزون (بالحبة)" hint="عند بلوغه يظهر الصنف في «مخزون منخفض»">
            <NumericInput value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
          </Field>

          <Field label="الحالة">
            <label className="flex h-11 w-fit cursor-pointer select-none items-center gap-3">
              <span className="relative inline-block h-6 w-11 shrink-0">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="absolute inset-0 rounded-full bg-ink-300 transition-colors peer-checked:bg-primary-600" />
                {/* في RTL: البداية يمين، والتفعيل يحرّك المقبض لليسار */}
                <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-5" />
              </span>
              <span className={`text-sm font-bold ${isActive ? 'text-primary-800' : 'text-ink-500'}`}>
                {isActive ? 'فعال' : 'موقوف'}
              </span>
            </label>
          </Field>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          إلغاء
        </Button>
        <Button onClick={submit} loading={saving}>
          <Save className="size-4" />
          {product ? 'حفظ التعديلات' : 'إضافة الصنف'}
        </Button>
      </div>

      <ScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetect={(code) => {
          setBarcode(code);
          return true;
        }}
      />
    </div>
  );
}

function ProfitLine({
  label,
  data,
}: {
  label: string;
  data: { profit: number; onCost: number; margin: number };
}) {
  const tone = data.profit > 0 ? 'text-emerald-700' : data.profit < 0 ? 'text-red-600' : 'text-ink-500';
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-ink-700">
      <span className="font-bold">{label}:</span>
      <span className={`tnum font-extrabold ${tone}`} dir="ltr">{formatJOD(data.profit)}</span>
      <span className="text-ink-500">
        ({formatPercent(data.onCost)} على التكلفة — هامش {formatPercent(data.margin)})
      </span>
    </p>
  );
}

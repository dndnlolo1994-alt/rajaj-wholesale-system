import { toFils, fromFils, type Fils } from './money';
import { toBaseUnits } from './units';
import type { UnitKind } from '@/lib/types/db';

// حسابات الفاتورة — مرآة مطابقة لمنطق قاعدة البيانات (create_sale).
// المصدر الرسمي للأرقام هو قاعدة البيانات؛ هذه الدوال للمعاينة الفورية
// في الواجهة وللاختبارات.

export interface CartLine {
  productId: string;
  name: string;
  unit: UnitKind;
  unitsPerCarton: number;
  qty: number;
  /** سعر الوحدة المختارة بالدينار */
  unitPrice: number;
  /** خصم السطر بالدينار */
  discount: number;
  /** متوسط تكلفة الحبة (للمعاينة الداخلية فقط) */
  avgUnitCost?: number;
}

export interface ComputedLine {
  qtyUnits: number;
  lineTotal: number;
  discount: number;
  invDiscountShare: number;
  netTotal: number;
  costTotal: number;
  profit: number;
}

export interface InvoiceTotals {
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscount: number;
  total: number;
  costTotal: number;
  profit: number;
  lines: ComputedLine[];
}

/**
 * توزيع خصم الفاتورة على السطور بطريقة أكبر البواقي.
 * يضمن أن مجموع الأنصبة = الخصم بالضبط (بالفلس).
 * مطابق لدالة app.allocate_discount في قاعدة البيانات.
 */
export function allocateDiscount(netsFils: Fils[], discountFils: Fils): Fils[] {
  const n = netsFils.length;
  if (n === 0 || discountFils <= 0) return netsFils.map(() => 0);
  const total = netsFils.reduce((a, b) => a + b, 0);
  if (total <= 0) return netsFils.map(() => 0);

  const floors = netsFils.map((net) => Math.floor((net * discountFils) / total));
  const rems = netsFils.map((net) => (net * discountFils) % total);
  let left = discountFils - floors.reduce((a, b) => a + b, 0);
  const result = [...floors];

  while (left > 0) {
    let maxRem = -1;
    let maxI = 0;
    for (let i = 0; i < n; i++) {
      if (rems[i] > maxRem) {
        maxRem = rems[i];
        maxI = i;
      }
    }
    result[maxI] += 1;
    rems[maxI] = -2;
    left -= 1;
  }
  return result;
}

/** حساب فاتورة كاملة: السطور، الخصومات، الإجمالي، التكلفة والربح */
export function computeInvoice(lines: CartLine[], invoiceDiscount: number): InvoiceTotals {
  const lineFils = lines.map((l) => {
    const priceF = toFils(l.unitPrice);
    const lineF = priceF * l.qty;
    const discF = toFils(l.discount);
    return { lineF, discF, netF: lineF - discF };
  });

  const subtotalF = lineFils.reduce((a, l) => a + l.lineF, 0);
  const lineDiscF = lineFils.reduce((a, l) => a + l.discF, 0);
  const netSumF = subtotalF - lineDiscF;
  const invDiscF = Math.min(Math.max(toFils(invoiceDiscount), 0), netSumF);
  const allocs = allocateDiscount(lineFils.map((l) => l.netF), invDiscF);

  let costTotalF = 0;
  const computed: ComputedLine[] = lines.map((l, i) => {
    const qtyUnits = toBaseUnits(l.qty, l.unit, l.unitsPerCarton);
    const costF = toFils(qtyUnits * (l.avgUnitCost ?? 0));
    costTotalF += costF;
    const netF = lineFils[i].netF - allocs[i];
    return {
      qtyUnits,
      lineTotal: fromFils(lineFils[i].lineF),
      discount: fromFils(lineFils[i].discF),
      invDiscountShare: fromFils(allocs[i]),
      netTotal: fromFils(netF),
      costTotal: fromFils(costF),
      profit: fromFils(netF - costF),
    };
  });

  const totalF = netSumF - invDiscF;
  return {
    subtotal: fromFils(subtotalF),
    lineDiscountTotal: fromFils(lineDiscF),
    invoiceDiscount: fromFils(invDiscF),
    total: fromFils(totalF),
    costTotal: fromFils(costTotalF),
    profit: fromFils(totalF - costTotalF),
    lines: computed,
  };
}

/**
 * متوسط التكلفة المرجّح بعد إضافة كمية جديدة.
 * مطابق لمنطق app.apply_stock_change: الإضافة فقط تغيّر المتوسط،
 * والسحب لا يغيّره. مخزون صفر/سالب → التكلفة الجديدة تصبح هي المتوسط.
 */
export function nextAvgCost(
  currentStockUnits: number,
  currentAvgCost: number,
  addedUnits: number,
  addedUnitCost: number,
): number {
  if (addedUnits <= 0) return currentAvgCost;
  if (currentStockUnits <= 0) return round6(addedUnitCost);
  const newStock = currentStockUnits + addedUnits;
  return round6((currentStockUnits * currentAvgCost + addedUnits * addedUnitCost) / newStock);
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * أثر المرتجع على الربح:
 * سليم (يرجع للمخزون): الربح يتراجع بمقدار (قيمة المرتجع − تكلفته)
 * تالف: الربح يتراجع بكامل قيمة المرتجع (التكلفة خسارة غارقة)
 */
export function returnProfitDelta(items: { lineTotal: number; costTotal: number; restock: boolean }[]): number {
  let totalF = 0;
  let restockedCostF = 0;
  for (const item of items) {
    totalF += toFils(item.lineTotal);
    if (item.restock) restockedCostF += toFils(item.costTotal);
  }
  return fromFils(restockedCostF - totalF);
}

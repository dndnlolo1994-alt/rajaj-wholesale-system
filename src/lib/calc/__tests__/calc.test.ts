import { describe, expect, it } from 'vitest';
import { toFils, fromFils, round3, parseMoney, parseQty, formatJOD, profitPercentOnCost, marginPercent } from '../money';
import { toBaseUnits, splitUnits, formatQty, derivePiecePrice } from '../units';
import { allocateDiscount, computeInvoice, nextAvgCost, returnProfitDelta } from '../invoice';

// اختبارات نواة الحسابات — مرآة منطق قاعدة البيانات

describe('المال (فلس)', () => {
  it('يحول الدينار إلى فلس ذهابًا وإيابًا بدقة', () => {
    expect(toFils(12.5)).toBe(12500);
    expect(toFils('8.4')).toBe(8400);
    expect(toFils(0.1 + 0.2)).toBe(300); // لا أخطاء فاصلة عائمة
    expect(fromFils(12500)).toBe(12.5);
    expect(round3(7.2 / 24)).toBe(0.3);
  });

  it('يقرأ إدخال المستخدم بالأرقام العربية والفواصل', () => {
    expect(parseMoney('١٢٫٥')).toBe(12.5); // الفاصلة العشرية العربية مدعومة
    expect(parseMoney('١٢،5')).toBe(12.5);
    expect(parseMoney('8.400')).toBe(8.4);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
    expect(parseQty('٢٤')).toBe(24);
    expect(parseQty('3.5')).toBeNull();
    expect(parseQty('-2')).toBeNull();
  });

  it('ينسّق الدينار بثلاث منازل', () => {
    expect(formatJOD(12.5)).toBe('12.500 د.أ');
    expect(formatJOD(1234.567)).toBe('1,234.567 د.أ');
    expect(formatJOD(2, { symbol: false })).toBe('2.000');
  });

  it('يحسب نسبة الربح والهامش', () => {
    expect(profitPercentOnCost(8, 10)).toBe(25);
    expect(marginPercent(8, 10)).toBe(20);
    expect(profitPercentOnCost(0, 10)).toBe(0);
  });
});

describe('الوحدات (كرتونة/حبة)', () => {
  it('يحول الكراتين إلى حبات', () => {
    expect(toBaseUnits(2, 'carton', 24)).toBe(48);
    expect(toBaseUnits(5, 'piece', 24)).toBe(5);
  });

  it('يفكك الحبات إلى كراتين + حبات', () => {
    expect(splitUnits(127, 24)).toEqual({ cartons: 5, pieces: 7 });
    expect(splitUnits(-30, 24)).toEqual({ cartons: -1, pieces: -6 });
    expect(formatQty(127, 24)).toBe('5 كرتونة + 7 حبة');
    expect(formatQty(7, 24)).toBe('7 حبة');
    expect(formatQty(48, 24)).toBe('2 كرتونة');
    expect(formatQty(0, 24)).toBe('0');
  });

  it('يشتق سعر الحبة من الكرتونة', () => {
    expect(derivePiecePrice(8.4, 24)).toBe(0.35);
    expect(derivePiecePrice(7.2, 24)).toBe(0.3);
  });
});

describe('توزيع خصم الفاتورة (أكبر البواقي)', () => {
  it('مجموع الأنصبة يساوي الخصم بالضبط دائمًا', () => {
    const nets = [12000, 14500, 9900];
    const alloc = allocateDiscount(nets, 500);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(500);
    expect(alloc).toEqual([165, 199, 136]);
  });

  it('يتعامل مع الحواف', () => {
    expect(allocateDiscount([], 100)).toEqual([]);
    expect(allocateDiscount([1000, 2000], 0)).toEqual([0, 0]);
    expect(allocateDiscount([0, 0], 100)).toEqual([0, 0]);
    // خصم لا يقبل القسمة أبدًا
    const alloc = allocateDiscount([333, 333, 333], 100);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('عشوائي: المجموع مضبوط دائمًا', () => {
    for (let i = 0; i < 200; i++) {
      const n = 1 + (i % 7);
      const nets = Array.from({ length: n }, (_, j) => ((i * 31 + j * 17) % 5000) + 1);
      const disc = i % nets.reduce((a, b) => a + b, 0);
      const alloc = allocateDiscount(nets, disc);
      expect(alloc.reduce((a, b) => a + b, 0)).toBe(Math.max(0, disc));
      alloc.forEach((a) => expect(a).toBeGreaterThanOrEqual(0));
    }
  });
});

describe('حساب الفاتورة الكامل', () => {
  it('مثال المواصفة: كرتونة شراء 8 وبيع 10 → ربح 2', () => {
    const inv = computeInvoice(
      [{ productId: 'a', name: 'شيبس', unit: 'carton', unitsPerCarton: 24, qty: 1, unitPrice: 10, discount: 0, avgUnitCost: 8 / 24 }],
      0,
    );
    expect(inv.total).toBe(10);
    expect(inv.costTotal).toBe(8);
    expect(inv.profit).toBe(2);
  });

  it('خصومات السطور وخصم الفاتورة معًا', () => {
    const inv = computeInvoice(
      [
        { productId: 'a', name: 'أ', unit: 'piece', unitsPerCarton: 24, qty: 24, unitPrice: 0.5, discount: 0, avgUnitCost: 0.3 },
        { productId: 'b', name: 'ب', unit: 'carton', unitsPerCarton: 24, qty: 2, unitPrice: 7.44, discount: 0.38, avgUnitCost: 0.25 },
        { productId: 'c', name: 'ج', unit: 'piece', unitsPerCarton: 12, qty: 6, unitPrice: 1.65, discount: 0, avgUnitCost: 1.3 },
      ],
      0.5,
    );
    expect(inv.subtotal).toBe(36.78);
    expect(inv.lineDiscountTotal).toBe(0.38);
    expect(inv.invoiceDiscount).toBe(0.5);
    expect(inv.total).toBe(35.9);
    // مجموع صافي السطور = الإجمالي بالضبط (التوزيع مضبوط)
    const linesNet = inv.lines.reduce((a, l) => a + toFils(l.netTotal), 0);
    expect(fromFils(linesNet)).toBe(inv.total);
    // مجموع أرباح السطور = ربح الفاتورة بالضبط
    const linesProfit = inv.lines.reduce((a, l) => a + toFils(l.profit), 0);
    expect(fromFils(linesProfit)).toBe(inv.profit);
    // التكلفة: 24×0.3 + 48×0.25 + 6×1.3 = 7.2+12+7.8 = 27
    expect(inv.costTotal).toBe(27);
    expect(inv.profit).toBe(8.9);
  });

  it('الخصم لا يتجاوز صافي الفاتورة', () => {
    const inv = computeInvoice(
      [{ productId: 'a', name: 'أ', unit: 'piece', unitsPerCarton: 1, qty: 2, unitPrice: 1, discount: 0 }],
      99,
    );
    expect(inv.invoiceDiscount).toBe(2);
    expect(inv.total).toBe(0);
  });
});

describe('متوسط التكلفة المرجّح WAC', () => {
  it('مثال المواصفة: شراء بـ8 ثم بـ8.5', () => {
    // 10 كراتين ×24 حبة بتكلفة 8/24 ثم 10 أخرى بتكلفة 8.5/24
    const avg1 = nextAvgCost(0, 0, 240, 8 / 24);
    expect(avg1).toBeCloseTo(0.333333, 5);
    const avg2 = nextAvgCost(240, avg1, 240, 8.5 / 24);
    expect(avg2).toBeCloseTo((240 * (8 / 24) + 240 * (8.5 / 24)) / 480, 6);
  });

  it('السحب لا يغيّر المتوسط، والمخزون الصفري يأخذ التكلفة الجديدة', () => {
    expect(nextAvgCost(100, 0.5, 0, 0.9)).toBe(0.5);
    expect(nextAvgCost(0, 0.5, 50, 0.75)).toBe(0.75);
    expect(nextAvgCost(-10, 0.5, 50, 0.75)).toBe(0.75);
  });

  it('إعادة مخزون مرتجع بتكلفته التاريخية', () => {
    // مخزون 100 بمتوسط 0.35، يرجع 24 بتكلفة تاريخية 0.30
    const avg = nextAvgCost(100, 0.35, 24, 0.3);
    expect(avg).toBeCloseTo((100 * 0.35 + 24 * 0.3) / 124, 6);
  });
});

describe('أثر المرتجع على الربح', () => {
  it('سليم: يخسر هامش الربح فقط — تالف: يخسر كامل القيمة', () => {
    // مرتجع بقيمة 10 تكلفته 7
    expect(returnProfitDelta([{ lineTotal: 10, costTotal: 7, restock: true }])).toBe(-3);
    expect(returnProfitDelta([{ lineTotal: 10, costTotal: 7, restock: false }])).toBe(-10);
    expect(
      returnProfitDelta([
        { lineTotal: 8.2, costTotal: 7.36, restock: true },
        { lineTotal: 3, costTotal: 1.926, restock: false },
      ]),
    ).toBe(fromFils(toFils(7.36) - toFils(8.2) - toFils(3)));
  });
});

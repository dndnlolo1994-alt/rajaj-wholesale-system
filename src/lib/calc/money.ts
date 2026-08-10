// نواة الحسابات المالية — الدينار الأردني بدقة 3 منازل (الفلس)
// كل العمليات الداخلية تتم بالفلس (عدد صحيح) لتجنّب أخطاء الفاصلة العائمة.

/** فلس = جزء من ألف من الدينار (عدد صحيح) */
export type Fils = number;

/** تحويل دينار إلى فلس (تقريب لأقرب فلس) */
export function toFils(jod: number | string | null | undefined): Fils {
  const n = typeof jod === 'string' ? Number(jod) : jod;
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n * 1000);
}

/** تحويل فلس إلى دينار (رقم بثلاث منازل) */
export function fromFils(fils: Fils): number {
  return Math.round(fils) / 1000;
}

/** تقريب مبلغ دينار إلى 3 منازل */
export function round3(jod: number): number {
  return fromFils(toFils(jod));
}

/**
 * قراءة إدخال المستخدم كمبلغ مالي.
 * يقبل الأرقام العربية (٠١٢...) والفاصلة العربية، ويرفض القيم غير الصالحة.
 */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? round3(input) : null;
  }
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[،,٫]/g, '.')
    .replace(/\s/g, '');
  if (normalized === '' || normalized === '.' || normalized === '-') return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return round3(n);
}

/** قراءة إدخال كمية صحيحة (يقبل الأرقام العربية) */
export function parseQty(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') {
    return Number.isInteger(input) && input >= 0 ? input : null;
  }
  const normalized = input.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (!/^\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isSafeInteger(n) ? n : null;
}

const nf3 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** تنسيق مبلغ: 12.500 د.أ */
export function formatJOD(amount: number | string | null | undefined, opts?: { symbol?: boolean }): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(n as number) ? (n as number) : 0;
  const text = nf3.format(round3(safe));
  return opts?.symbol === false ? text : `${text} د.أ`;
}

/** تنسيق مختصر للرسوم البيانية: 1.2K */
export function formatJODCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  if (abs >= 100) return nf0.format(Math.round(amount));
  return String(round3(amount));
}

/** نسبة مئوية بمنزلتين: 23.5% */
export function formatPercent(value: number | null | undefined): string {
  const n = value ?? 0;
  return `${(Math.round(n * 100) / 100).toFixed(1)}%`;
}

/** نسبة الربح على التكلفة (markup) */
export function profitPercentOnCost(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return ((price - cost) / cost) * 100;
}

/** هامش الربح من سعر البيع (margin) */
export function marginPercent(cost: number, price: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

import { join } from 'node:path';
import PDFDocument from 'pdfkit';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

interface BackupPayload {
  exported_at: string;
  rows_count: number;
  tables_count: number;
  tables: Tables;
}

interface ColumnDef {
  key: string;
  label: string;
  width?: number;
}

interface SectionDef {
  title: string;
  columns: ColumnDef[];
}

const FONT_DIR = join(process.cwd(), 'public', 'fonts');
const ARABIC_REGULAR = join(FONT_DIR, 'report-arabic-regular.woff');
const ARABIC_BOLD = join(FONT_DIR, 'report-arabic-bold.woff');
const LATIN_REGULAR = join(FONT_DIR, 'report-latin-regular.woff');
const LATIN_BOLD = join(FONT_DIR, 'report-latin-bold.woff');

const SECTION_DEFS: Record<string, SectionDef> = {
  profiles: { title: 'المستخدمون', columns: cols(['full_name', 'الاسم'], ['role', 'الدور'], ['phone', 'الهاتف'], ['is_active', 'الحالة'], ['created_at', 'تاريخ الإنشاء']) },
  app_settings: { title: 'إعدادات النظام', columns: cols(['key', 'القسم'], ['value', 'القيمة'], ['updated_at', 'آخر تحديث']) },
  counters: { title: 'عدادات المستندات', columns: cols(['key', 'العداد'], ['value', 'القيمة']) },
  categories: { title: 'أقسام الأصناف', columns: cols(['name', 'القسم'], ['sort_order', 'الترتيب'], ['is_active', 'الحالة'], ['created_at', 'تاريخ الإنشاء']) },
  products: { title: 'الأصناف والمخزون', columns: cols(['name', 'الصنف'], ['sku', 'الرمز'], ['barcode', 'الباركود'], ['stock_units', 'المخزون'], ['avg_unit_cost', 'كلفة الوحدة'], ['sale_price_piece', 'سعر الحبة']) },
  customers: { title: 'العملاء', columns: cols(['name', 'العميل'], ['shop_name', 'المحل'], ['phone', 'الهاتف'], ['area', 'المنطقة'], ['balance', 'الرصيد'], ['is_active', 'الحالة']) },
  suppliers: { title: 'الموردون', columns: cols(['name', 'المورد'], ['company_name', 'الشركة'], ['phone', 'الهاتف'], ['area', 'المنطقة'], ['balance', 'الرصيد'], ['is_active', 'الحالة']) },
  customer_prices: { title: 'الأسعار الخاصة للعملاء', columns: cols(['customer_id', 'العميل'], ['product_id', 'الصنف'], ['unit', 'الوحدة'], ['price', 'السعر'], ['updated_at', 'آخر تحديث']) },
  sales: { title: 'فواتير المبيعات', columns: cols(['invoice_no', 'الفاتورة'], ['sale_date', 'التاريخ'], ['customer_id', 'العميل'], ['cash_customer_name', 'اسم نقدي'], ['total', 'الإجمالي'], ['paid', 'المدفوع'], ['remaining', 'الباقي'], ['status', 'الحالة']) },
  sale_items: { title: 'تفاصيل أصناف المبيعات', columns: cols(['sale_id', 'الفاتورة'], ['product_name', 'الصنف'], ['unit', 'الوحدة'], ['qty', 'الكمية'], ['net_total', 'الصافي'], ['profit', 'الربح']) },
  held_sales: { title: 'المبيعات المعلقة', columns: cols(['label', 'الاسم'], ['customer_id', 'العميل'], ['created_by', 'المستخدم'], ['created_at', 'التاريخ']) },
  purchases: { title: 'فواتير المشتريات', columns: cols(['invoice_no', 'الفاتورة'], ['purchase_date', 'التاريخ'], ['supplier_id', 'المورد'], ['total', 'الإجمالي'], ['paid', 'المدفوع'], ['remaining', 'الباقي'], ['status', 'الحالة']) },
  purchase_items: { title: 'تفاصيل أصناف المشتريات', columns: cols(['purchase_id', 'الفاتورة'], ['product_name', 'الصنف'], ['unit', 'الوحدة'], ['qty', 'الكمية'], ['unit_cost', 'الكلفة'], ['line_total', 'الإجمالي']) },
  payments: { title: 'الدفعات', columns: cols(['payment_no', 'السند'], ['payment_date', 'التاريخ'], ['party_type', 'الطرف'], ['customer_id', 'العميل'], ['supplier_id', 'المورد'], ['amount', 'المبلغ'], ['direction', 'الاتجاه']) },
  customer_ledger: { title: 'دفتر العملاء', columns: cols(['customer_id', 'العميل'], ['entry_date', 'التاريخ'], ['entry_type', 'الحركة'], ['debit', 'مدين'], ['credit', 'دائن'], ['balance_after', 'الرصيد']) },
  supplier_ledger: { title: 'دفتر الموردين', columns: cols(['supplier_id', 'المورد'], ['entry_date', 'التاريخ'], ['entry_type', 'الحركة'], ['debit', 'مدين'], ['credit', 'دائن'], ['balance_after', 'الرصيد']) },
  stock_movements: { title: 'حركات المخزون', columns: cols(['created_at', 'التاريخ'], ['product_id', 'الصنف'], ['move_type', 'الحركة'], ['qty_change', 'التغيير'], ['balance_after', 'الرصيد'], ['unit_cost', 'الكلفة']) },
  returns: { title: 'المرتجعات', columns: cols(['return_no', 'المرتجع'], ['return_date', 'التاريخ'], ['customer_id', 'العميل'], ['total', 'الإجمالي'], ['refund_cash', 'المعاد نقدًا'], ['status', 'الحالة']) },
  return_items: { title: 'تفاصيل أصناف المرتجعات', columns: cols(['return_id', 'المرتجع'], ['product_name', 'الصنف'], ['unit', 'الوحدة'], ['qty', 'الكمية'], ['line_total', 'الإجمالي'], ['condition', 'الحالة']) },
  expense_categories: { title: 'تصنيفات المصاريف', columns: cols(['name', 'التصنيف'], ['sort_order', 'الترتيب'], ['is_active', 'الحالة']) },
  expenses: { title: 'المصاريف', columns: cols(['expense_no', 'السند'], ['expense_date', 'التاريخ'], ['category_id', 'التصنيف'], ['amount', 'المبلغ'], ['method', 'الطريقة'], ['status', 'الحالة']) },
  cash_transactions: { title: 'حركات الصندوق', columns: cols(['tx_date', 'التاريخ'], ['tx_type', 'الحركة'], ['direction', 'الاتجاه'], ['amount', 'المبلغ'], ['method', 'الطريقة'], ['notes', 'ملاحظات']) },
  cash_sessions: { title: 'جلسات الصندوق', columns: cols(['session_date', 'التاريخ'], ['opening_balance', 'الافتتاحي'], ['cash_in', 'الداخل'], ['cash_out', 'الخارج'], ['expected_cash', 'المتوقع'], ['difference', 'الفرق'], ['status', 'الحالة']) },
  inventory_counts: { title: 'عمليات الجرد', columns: cols(['count_no', 'الجرد'], ['created_at', 'التاريخ'], ['count_type', 'النوع'], ['items_total', 'الأصناف'], ['total_diff_value', 'قيمة الفرق'], ['status', 'الحالة']) },
  inventory_count_items: { title: 'تفاصيل الجرد', columns: cols(['count_id', 'الجرد'], ['product_name', 'الصنف'], ['expected_units', 'المتوقع'], ['actual_units', 'الفعلي'], ['diff_units', 'الفرق'], ['diff_value', 'قيمة الفرق']) },
  notes: { title: 'الملاحظات والمهام', columns: cols(['note_date', 'التاريخ'], ['content', 'الملاحظة'], ['is_task', 'مهمة'], ['is_done', 'مكتملة'], ['is_pinned', 'مثبتة']) },
  notifications: { title: 'التنبيهات', columns: cols(['created_at', 'التاريخ'], ['severity', 'الأهمية'], ['title', 'العنوان'], ['body', 'التفاصيل'], ['is_read', 'مقروء']) },
  audit_logs: { title: 'سجل التدقيق', columns: cols(['created_at', 'التاريخ'], ['user_name', 'المستخدم'], ['action', 'العملية'], ['entity', 'القسم'], ['entity_id', 'المرجع'], ['ip', 'العنوان الشبكي']) },
  backup_logs: { title: 'سجل النسخ الاحتياطي', columns: cols(['started_at', 'البدء'], ['backup_type', 'النوع'], ['status', 'الحالة'], ['rows_count', 'السجلات'], ['file_name', 'الملف'], ['error', 'الخطأ']) },
};

const ENUM_LABELS: Record<string, string> = {
  owner: 'مالك', manager: 'مدير', sales: 'مبيعات', warehouse: 'مستودع', accountant: 'محاسب',
  completed: 'مكتمل', void: 'ملغى', open: 'مفتوح', closed: 'مغلق', cancelled: 'ملغى',
  cash: 'نقدي', bank_transfer: 'تحويل بنكي', wallet: 'محفظة', cheque: 'شيك', other: 'أخرى',
  customer: 'عميل', supplier: 'مورد', in: 'داخل', out: 'خارج', carton: 'كرتونة', piece: 'حبة',
  good: 'سليم', damaged: 'تالف', daily: 'يومي', monthly: 'شهري', manual: 'يدوي', auto: 'تلقائي', export: 'تصدير',
  info: 'معلومة', warning: 'تنبيه', critical: 'حرج', success: 'ناجح', failed: 'فشل', running: 'جارٍ',
  sale: 'بيع', purchase: 'شراء', payment: 'دفعة', return: 'مرتجع', adjustment: 'تسوية', opening: 'رصيد افتتاحي',
  sale_receipt: 'قبض مبيعات', customer_receipt: 'قبض عميل', supplier_payment: 'دفع مورد', expense: 'مصروف',
  extra_income: 'دخل إضافي', owner_withdrawal: 'سحب شخصي', deposit: 'إيداع', refund: 'استرداد',
  sale_return: 'مرتجع بيع', sale_void: 'إلغاء بيع', purchase_void: 'إلغاء شراء', return_void: 'إلغاء مرتجع',
  count_adjustment: 'تسوية جرد',
};

const MONEY_KEYS = /(amount|total|price|cost|balance|paid|remaining|profit|discount|debit|credit|value|cash)/i;
const DATE_KEYS = /(date|created_at|updated_at|started_at|finished_at|closed_at|completed_at|cancelled_at|voided_at|counted_at)$/i;
const ARABIC_RE = /[\u0600-\u06ff]/;

export async function buildFullReportPdf(payload: BackupPayload, businessName: string): Promise<{ buffer: Buffer; fileName: string }> {
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().slice(0, 10);
  const buffer = await renderPdf(payload, businessName, generatedAt);
  return { buffer, fileName: `rajaei-full-report-${stamp}.pdf` };
}

async function renderPdf(payload: BackupPayload, businessName: string, generatedAt: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 38, bufferPages: true, info: { Title: 'التقرير الكامل - نظام رجائي المصري', Author: businessName } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Arabic', ARABIC_REGULAR);
    doc.registerFont('ArabicBold', ARABIC_BOLD);
    doc.registerFont('Latin', LATIN_REGULAR);
    doc.registerFont('LatinBold', LATIN_BOLD);

    drawCover(doc, payload, businessName, generatedAt);
    drawIndex(doc, payload.tables);

    for (const [table, def] of Object.entries(SECTION_DEFS)) {
      const rows = payload.tables[table] ?? [];
      if (rows.length === 0) continue;
      drawTableSection(doc, table, def, rows, payload.tables);
    }

    addFooters(doc, businessName, generatedAt);
    doc.end();
  });
}

function drawCover(doc: PDFKit.PDFDocument, payload: BackupPayload, businessName: string, generatedAt: Date) {
  const pageW = doc.page.width;
  const contentW = pageW - 76;
  doc.rect(0, 0, pageW, 210).fill('#073f35');
  doc.circle(pageW - 80, 44, 72).fill('#0d5e4f');
  doc.circle(60, 190, 54).fill('#c8a34d');

  arabic(doc, businessName, 38, 54, contentW, 20, '#d9f4ea', true);
  arabic(doc, 'التقرير الإداري والمالي الكامل', 38, 96, contentW, 28, '#ffffff', true);
  arabic(doc, 'نسخة قابلة للتنزيل تشمل ملخص العمل وكل السجلات التشغيلية', 38, 140, contentW, 12, '#c8e6dc');

  const summaryTitleY = 238;
  const metricsStartY = 272;
  arabic(doc, 'ملخص تنفيذي', 38, summaryTitleY, contentW, 18, '#073f35', true);

  const t = payload.tables;
  const activeSales = (t.sales ?? []).filter((r) => r.status !== 'void');
  const activePurchases = (t.purchases ?? []).filter((r) => r.status !== 'void');
  const activeReturns = (t.returns ?? []).filter((r) => r.status !== 'void');
  const activeExpenses = (t.expenses ?? []).filter((r) => r.status !== 'void');
  const metrics = [
    ['إجمالي السجلات', integer(payload.rows_count)],
    ['عدد الأصناف', integer((t.products ?? []).length)],
    ['صافي المبيعات', money(sum(activeSales, 'total') - sum(activeReturns, 'total'))],
    ['إجمالي المشتريات', money(sum(activePurchases, 'total'))],
    ['ديون العملاء', money(sum(t.customers ?? [], 'balance'))],
    ['ديون الموردين', money(sum(t.suppliers ?? [], 'balance'))],
    ['قيمة المخزون', money((t.products ?? []).reduce((n, r) => n + number(r.stock_units) * number(r.avg_unit_cost), 0))],
    ['إجمالي المصاريف', money(sum(activeExpenses, 'amount'))],
  ];

  const cardW = (contentW - 12) / 2;
  const cardH = 61;
  metrics.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 38 + col * (cardW + 12);
    const y = metricsStartY + row * (cardH + 10);
    doc.roundedRect(x, y, cardW, cardH, 10).fillAndStroke(index % 3 === 0 ? '#f0faf6' : '#ffffff', '#d7e5df');
    arabic(doc, label, x + 10, y + 10, cardW - 20, 9, '#667085', true);
    latin(doc, value, x + 10, y + 31, cardW - 20, 15, '#101828', true, 'right');
  });

  const generatedCardY = metricsStartY + 4 * (cardH + 10) + 10;
  doc.roundedRect(38, generatedCardY, contentW, 58, 10).fill('#f7f2e7');
  arabic(doc, 'تاريخ إنشاء التقرير', 50, generatedCardY + 10, contentW - 24, 9, '#8b6b24', true);
  latin(doc, formatDateTime(generatedAt.toISOString()), 50, generatedCardY + 31, contentW - 24, 11, '#493a19', true, 'right');
}

function drawIndex(doc: PDFKit.PDFDocument, tables: Tables) {
  doc.addPage();
  sectionTitle(doc, 'فهرس البيانات', 'عدد السجلات الموجودة في كل قسم وقت إنشاء التقرير');
  const entries = Object.entries(SECTION_DEFS);
  const contentW = doc.page.width - 76;
  const cellW = (contentW - 10) / 2;
  let y = 112;
  entries.forEach(([key, def], index) => {
    const col = index % 2;
    if (index > 0 && col === 0) y += 30;
    if (y > doc.page.height - 70) {
      doc.addPage();
      y = 54;
    }
    const x = 38 + col * (cellW + 10);
    doc.roundedRect(x, y, cellW, 24, 6).fill(index % 4 < 2 ? '#f6f8f7' : '#ffffff');
    arabic(doc, def.title, x + 8, y + 6, cellW - 52, 8, '#344054', true);
    latin(doc, integer((tables[key] ?? []).length), x + cellW - 42, y + 6, 32, 9, '#0d5e4f', true, 'center');
  });
}

function drawTableSection(doc: PDFKit.PDFDocument, table: string, def: SectionDef, rows: Row[], tables: Tables) {
  doc.addPage();
  sectionTitle(doc, def.title, `${rows.length} سجل`);
  let y = 112;
  y = drawTableHeader(doc, def.columns, y);

  rows.forEach((row, index) => {
    if (y > doc.page.height - 62) {
      doc.addPage();
      sectionTitle(doc, def.title, 'تابع');
      y = drawTableHeader(doc, def.columns, 94);
    }
    y = drawTableRow(doc, table, def.columns, row, rows, tables, y, index);
  });
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: ColumnDef[], y: number): number {
  const layout = columnLayout(doc, columns);
  doc.roundedRect(38, y, doc.page.width - 76, 27, 6).fill('#073f35');
  layout.forEach(({ column, x, width }) => arabic(doc, column.label, x + 4, y + 7, width - 8, 7.5, '#ffffff', true));
  return y + 31;
}

function drawTableRow(doc: PDFKit.PDFDocument, table: string, columns: ColumnDef[], row: Row, rows: Row[], tables: Tables, y: number, index: number): number {
  const layout = columnLayout(doc, columns);
  const rowH = 26;
  doc.rect(38, y, doc.page.width - 76, rowH).fill(index % 2 === 0 ? '#f7f9f8' : '#ffffff');
  doc.moveTo(38, y + rowH).lineTo(doc.page.width - 38, y + rowH).strokeColor('#e4ebe8').lineWidth(0.5).stroke();
  layout.forEach(({ column, x, width }) => {
    const value = formatCell(table, column.key, row[column.key], row, rows, tables);
    const isArabic = ARABIC_RE.test(value);
    if (isArabic) arabic(doc, value, x + 4, y + 7, width - 8, 7, '#344054');
    else latin(doc, value, x + 4, y + 7, width - 8, 7, '#344054', false, 'center');
  });
  return y + rowH;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 72).fill('#073f35');
  arabic(doc, title, 68, 22, doc.page.width - 136, 18, '#ffffff', true, 'center');
  arabic(doc, subtitle, 68, 50, doc.page.width - 136, 8, '#bfe2d6', false, 'center');
}

function addFooters(doc: PDFKit.PDFDocument, businessName: string, generatedAt: Date) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 25;
    doc.moveTo(38, y - 8).lineTo(doc.page.width - 38, y - 8).strokeColor('#d7e5df').lineWidth(0.5).stroke();
    arabic(doc, businessName, 38, y, 250, 7, '#667085');
    latin(doc, `${i + 1} / ${range.count}  |  ${generatedAt.toISOString().slice(0, 10)}`, doc.page.width - 230, y, 192, 7, '#667085', false, 'right');
  }
}

function columnLayout(doc: PDFKit.PDFDocument, columns: ColumnDef[]) {
  const contentW = doc.page.width - 76;
  const total = columns.reduce((n, c) => n + (c.width ?? 1), 0);
  let right = doc.page.width - 38;
  return columns.map((column) => {
    const width = contentW * ((column.width ?? 1) / total);
    right -= width;
    return { column, x: right, width };
  });
}

function formatCell(table: string, key: string, value: unknown, row: Row, rows: Row[], tables: Tables): string {
  if (value == null || value === '') return '—';
  const related = relationName(table, key, value, row, rows, tables);
  if (related) return related;
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'number') return MONEY_KEYS.test(key) ? money(value) : integer(value);
  if (typeof value === 'object') return clip(JSON.stringify(value), 72);
  const text = String(value);
  if (ENUM_LABELS[text]) return ENUM_LABELS[text];
  if (DATE_KEYS.test(key)) return formatDateTime(text);
  if (MONEY_KEYS.test(key) && Number.isFinite(Number(text))) return money(Number(text));
  return clip(text, 72);
}

function relationName(table: string, key: string, value: unknown, row: Row, rows: Row[], tables: Tables): string | null {
  const id = String(value);
  const find = (name: string, label: string) => {
    const match = (tables[name] ?? []).find((r) => String(r.id) === id);
    return match ? String(match[label] ?? match.name ?? match.id) : null;
  };
  if (key === 'customer_id') return find('customers', 'name');
  if (key === 'supplier_id') return find('suppliers', 'name');
  if (key === 'product_id') return find('products', 'name');
  if (key === 'category_id') return table === 'expenses' ? find('expense_categories', 'name') : find('categories', 'name');
  if (key === 'created_by' || key === 'updated_by' || key === 'user_id') return find('profiles', 'full_name');
  if (key === 'sale_id') return find('sales', 'invoice_no');
  if (key === 'purchase_id') return find('purchases', 'invoice_no');
  if (key === 'return_id') return find('returns', 'return_no');
  if (key === 'count_id') return find('inventory_counts', 'count_no');
  void row; void rows;
  return null;
}

function arabic(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, size: number, color: string, bold = false, align: 'left' | 'center' | 'right' = 'right') {
  doc.font(bold ? 'ArabicBold' : 'Arabic').fontSize(size).fillColor(color).text(prepareArabic(text), x, y, { width, height: size * 2.1, align, ellipsis: true, lineBreak: false, features: ['rtla'] });
}

function latin(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, size: number, color: string, bold = false, align: 'left' | 'center' | 'right' = 'left') {
  doc.font(bold ? 'LatinBold' : 'Latin').fontSize(size).fillColor(color).text(text, x, y, { width, height: size * 2, align, ellipsis: true, lineBreak: false });
}

function prepareArabic(value: string): string {
  return String(value).replace(/[0-9٠-٩][0-9٠-٩.,:/-]*/g, (run) => Array.from(toArabicDigits(run)).reverse().join(''));
}

function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clip(value, 28);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function cols(...pairs: [string, string][]): ColumnDef[] {
  return pairs.map(([key, label]) => ({ key, label }));
}

function number(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sum(rows: Row[], key: string): number {
  return rows.reduce((n, row) => n + number(row[key]), 0);
}

function money(value: number): string {
  return `${number(value).toFixed(3)} JOD`;
}

function integer(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(number(value));
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

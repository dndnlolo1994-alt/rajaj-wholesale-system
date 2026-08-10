import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { formatJOD } from '@/lib/calc/money';
import { fmtDateTime } from '@/lib/format/date';
import { unitLabel } from '@/lib/calc/units';
import { paymentMethodLabels, type BusinessSettings } from '@/lib/settings-shared';
import type { SaleFull } from '@/server/queries/sales';

const FONT_DIR = join(process.cwd(), 'public', 'fonts');
const ARABIC_REGULAR = join(FONT_DIR, 'report-arabic-regular.woff');
const ARABIC_BOLD = join(FONT_DIR, 'report-arabic-bold.woff');
const LATIN_REGULAR = join(FONT_DIR, 'report-latin-regular.woff');
const LATIN_BOLD = join(FONT_DIR, 'report-latin-bold.woff');

const GREEN = '#073f35';
const GOLD = '#c8a34d';
const INK = '#101828';
const MUTED = '#667085';
const LINE = '#d7e5df';
const SOFT = '#f3faf7';

export async function buildSaleInvoicePdf(
  sale: SaleFull,
  business: BusinessSettings,
): Promise<{ buffer: Buffer; fileName: string }> {
  const buffer = await renderSaleInvoicePdf(sale, business);
  return {
    buffer,
    fileName: `invoice-${sale.invoice_no.replace(/[^\w.-]+/g, '-')}.pdf`,
  };
}

function renderSaleInvoicePdf(sale: SaleFull, business: BusinessSettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
      info: {
        Title: `فاتورة ${sale.invoice_no}`,
        Author: business.business_name,
        Subject: 'فاتورة مبيعات',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Arabic', ARABIC_REGULAR);
    doc.registerFont('ArabicBold', ARABIC_BOLD);
    doc.registerFont('Latin', LATIN_REGULAR);
    doc.registerFont('LatinBold', LATIN_BOLD);

    drawHeader(doc, sale, business);
    let y = 188;
    y = drawMeta(doc, sale, y);
    y = drawItems(doc, sale, y + 18);
    drawTotals(doc, sale, y + 18);
    drawFooter(doc, business);
    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, sale: SaleFull, business: BusinessSettings) {
  const pageW = doc.page.width;
  doc.rect(0, 0, pageW, 142).fill(GREEN);
  doc.circle(pageW - 70, 32, 78).fill('#0d5e4f');
  doc.circle(48, 138, 42).fill(GOLD);

  arabic(doc, business.business_name, 36, 34, pageW - 72, 19, '#ffffff', true, 'right');
  arabic(doc, business.owner_name, 36, 64, pageW - 72, 10, '#d9f4ea', false, 'right');
  if (business.phone || business.address) {
    arabic(doc, [business.phone ? `هاتف: ${business.phone}` : '', business.address].filter(Boolean).join(' — '), 36, 84, pageW - 72, 9, '#c8e6dc', false, 'right');
  }

  doc.roundedRect(36, 104, 220, 54, 12).fill('#ffffff');
  arabic(doc, sale.status === 'void' ? 'فاتورة ملغاة' : 'فاتورة مبيعات', 50, 114, 190, 11, GREEN, true, 'center');
  latin(doc, sale.invoice_no, 50, 136, 190, 12, INK, true, 'center');
}

function drawMeta(doc: PDFKit.PDFDocument, sale: SaleFull, y: number): number {
  const customer = sale.customer?.name ?? 'زبون نقدي';
  const shop = sale.customer?.shop_name ? ` — ${sale.customer.shop_name}` : '';
  const payment = sale.payment_method ? paymentMethodLabels[sale.payment_method] : '—';
  const cards = [
    ['العميل', `${customer}${shop}`],
    ['التاريخ', fmtDateTime(sale.sale_date)],
    ['طريقة الدفع', payment],
    ['الحالة', sale.status === 'void' ? 'ملغاة' : 'مكتملة'],
  ];
  const contentW = doc.page.width - 72;
  const cardW = (contentW - 12) / 2;
  cards.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 36 + col * (cardW + 12);
    const cy = y + row * 52;
    doc.roundedRect(x, cy, cardW, 42, 9).fillAndStroke(i === 0 ? SOFT : '#ffffff', LINE);
    arabic(doc, label, x + 12, cy + 8, cardW - 24, 8, MUTED, true);
    arabic(doc, value, x + 12, cy + 23, cardW - 24, 9, INK);
  });
  return y + 104;
}

function drawItems(doc: PDFKit.PDFDocument, sale: SaleFull, y: number): number {
  sectionTitle(doc, 'الأصناف', y);
  y += 34;
  drawTableHeader(doc, y);
  y += 30;

  sale.items.forEach((item, index) => {
    if (y > doc.page.height - 176) {
      doc.addPage();
      y = 42;
      sectionTitle(doc, 'الأصناف — تابع', y);
      y += 34;
      drawTableHeader(doc, y);
      y += 30;
    }
    const bg = index % 2 === 0 ? '#fbfdfc' : '#ffffff';
    doc.rect(36, y, doc.page.width - 72, 34).fill(bg);
    doc.moveTo(36, y + 34).lineTo(doc.page.width - 36, y + 34).strokeColor('#edf2f0').lineWidth(0.5).stroke();

    arabic(doc, item.product_name, 268, y + 9, 286, 8.5, INK, true);
    arabic(doc, `${item.qty} ${unitLabel[item.unit]}`, 190, y + 9, 62, 8.5, INK, false, 'center');
    latin(doc, money(Number(item.unit_price)), 118, y + 9, 58, 8.5, INK, false, 'right');
    latin(doc, money(Number(item.net_total)), 44, y + 9, 58, 8.5, INK, true, 'right');
    y += 34;
  });
  return y;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.roundedRect(36, y, doc.page.width - 72, 25, 7).fill(GREEN);
  arabic(doc, 'الصنف', 268, y + 7, 286, 8, '#ffffff', true);
  arabic(doc, 'الكمية', 190, y + 7, 62, 8, '#ffffff', true, 'center');
  arabic(doc, 'السعر', 118, y + 7, 58, 8, '#ffffff', true, 'center');
  arabic(doc, 'الإجمالي', 44, y + 7, 58, 8, '#ffffff', true, 'center');
}

function drawTotals(doc: PDFKit.PDFDocument, sale: SaleFull, y: number) {
  if (y > doc.page.height - 150) {
    doc.addPage();
    y = 50;
  }
  const x = 36;
  const w = 250;
  doc.roundedRect(x, y, w, 124, 12).fillAndStroke('#ffffff', LINE);
  const totalDiscount = Number(sale.line_discount_total) + Number(sale.invoice_discount);
  const rows: [string, string, boolean?][] = [
    ['المجموع', money(Number(sale.subtotal))],
    ['الخصم', totalDiscount > 0 ? `-${money(totalDiscount)}` : '0.000 د.أ'],
    ['الإجمالي', money(Number(sale.total)), true],
    ['المدفوع', money(Number(sale.paid))],
    ['المتبقي', money(Number(sale.remaining)), Number(sale.remaining) > 0],
  ];
  rows.forEach(([label, value, strong], i) => {
    const ry = y + 14 + i * 20;
    arabic(doc, label, x + 126, ry, 100, strong ? 9.5 : 8.5, strong ? GREEN : MUTED, Boolean(strong));
    latin(doc, value, x + 14, ry, 100, strong ? 10 : 8.5, strong ? GREEN : INK, Boolean(strong), 'right');
  });
}

function drawFooter(doc: PDFKit.PDFDocument, business: BusinessSettings) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 54;
    doc.moveTo(36, y - 10).lineTo(doc.page.width - 36, y - 10).strokeColor(LINE).lineWidth(0.5).stroke();
    arabic(doc, business.invoice_footer || 'شكراً لتعاملكم معنا', 36, y, doc.page.width - 72, 9, GREEN, true, 'center');
    latin(doc, `${i + 1} / ${range.count}`, 36, y + 20, doc.page.width - 72, 7, MUTED, false, 'center');
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, y: number) {
  doc.roundedRect(36, y, doc.page.width - 72, 24, 8).fill(SOFT);
  arabic(doc, title, 48, y + 6, doc.page.width - 96, 10, GREEN, true);
}

function arabic(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string,
  bold = false,
  align: 'left' | 'center' | 'right' = 'right',
) {
  doc.font(bold ? 'ArabicBold' : 'Arabic').fontSize(size).fillColor(color).text(prepareArabic(text), x, y, {
    width,
    height: size * 2.2,
    align,
    ellipsis: true,
    lineBreak: false,
    features: ['rtla'],
  });
}

function latin(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string,
  bold = false,
  align: 'left' | 'center' | 'right' = 'left',
) {
  doc.font(bold ? 'LatinBold' : 'Latin').fontSize(size).fillColor(color).text(text, x, y, {
    width,
    height: size * 2,
    align,
    ellipsis: true,
    lineBreak: false,
  });
}

function prepareArabic(value: string): string {
  return String(value).replace(/[0-9٠-٩][0-9٠-٩.,:/-]*/g, (run) => Array.from(toArabicDigits(run)).reverse().join(''));
}

function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d);
}

function money(value: number): string {
  return formatJOD(value, { symbol: false }) + ' د.أ';
}

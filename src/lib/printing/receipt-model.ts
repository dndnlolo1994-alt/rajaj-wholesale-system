// نموذج الإيصال الموحّد — مصدر واحد للحقيقة يستهلكه:
// 1) مُصيّر DOM (طباعة المتصفح)   2) مُصيّر Canvas (ESC/POS عبر الجسر)
// بهذا لا يحدث اختلاف بين ما يُعاين وما يُطبع.

import { formatJOD } from '@/lib/calc/money';
import { fmtDateShort, fmtTime } from '@/lib/format/date';
import { unitLabel } from '@/lib/calc/units';
import type { SaleFull } from '@/server/queries/sales';
import type { BusinessSettings } from '@/lib/settings-shared';

export type ReceiptBlock =
  | { type: 'text'; text: string; size?: 'xl' | 'lg' | 'md' | 'sm'; bold?: boolean; align?: 'center' | 'start' | 'end' }
  | { type: 'row'; cols: { text: string; grow?: number; align?: 'start' | 'center' | 'end'; bold?: boolean; sm?: boolean }[] }
  | { type: 'sep'; style?: 'dashed' | 'solid' }
  | { type: 'space' }
  | { type: 'kv'; label: string; value: string; bold?: boolean; lg?: boolean };

export interface ReceiptDoc {
  title: string;
  blocks: ReceiptBlock[];
}

const jod = (n: number | string) => formatJOD(Number(n), { symbol: false });
const saleCustomerName = (sale: SaleFull) => sale.customer?.name ?? sale.cash_customer_name ?? 'زبون نقدي';

export function businessHeader(business: BusinessSettings): ReceiptBlock[] {
  const blocks: ReceiptBlock[] = [
    { type: 'text', text: business.business_name, size: 'lg', bold: true, align: 'center' },
  ];
  if (business.owner_name && business.owner_name.trim() !== business.business_name.trim()) {
    blocks.push({ type: 'text', text: business.owner_name, size: 'sm', align: 'center' });
  }
  if (business.phone) blocks.push({ type: 'text', text: `هاتف: ${business.phone}`, size: 'sm', align: 'center' });
  if (business.address) blocks.push({ type: 'text', text: business.address, size: 'sm', align: 'center' });
  blocks.push({ type: 'sep', style: 'solid' });
  return blocks;
}

/** فاتورة مبيعات حرارية — لا تُظهر أي تكلفة أو ربح */
export function buildSaleReceipt(sale: SaleFull, business: BusinessSettings): ReceiptDoc {
  const blocks: ReceiptBlock[] = [...businessHeader(business)];

  blocks.push({ type: 'text', text: sale.status === 'void' ? 'فاتورة ملغاة' : 'فاتورة مبيعات', size: 'md', bold: true, align: 'center' });
  blocks.push({ type: 'kv', label: 'رقم الفاتورة', value: sale.invoice_no });
  blocks.push({ type: 'kv', label: 'التاريخ', value: `${fmtDateShort(sale.sale_date)} ${fmtTime(sale.sale_date)}` });
  blocks.push({ type: 'kv', label: 'العميل', value: saleCustomerName(sale) });
  if (sale.customer?.shop_name) blocks.push({ type: 'kv', label: 'المحل', value: sale.customer.shop_name });
  if (sale.customer?.phone) blocks.push({ type: 'kv', label: 'الهاتف', value: sale.customer.phone });
  blocks.push({ type: 'sep' });

  blocks.push({
    type: 'row',
    cols: [
      { text: 'الصنف', grow: 3, bold: true, sm: true },
      { text: 'الكمية', grow: 1.4, align: 'center', bold: true, sm: true },
      { text: 'السعر', grow: 1.2, align: 'end', bold: true, sm: true },
      { text: 'الإجمالي', grow: 1.4, align: 'end', bold: true, sm: true },
    ],
  });
  blocks.push({ type: 'sep' });

  for (const item of sale.items) {
    blocks.push({ type: 'text', text: item.product_name, bold: true, size: 'sm' });
    const discount = Number(item.discount) + Number(item.inv_discount_share);
    blocks.push({
      type: 'row',
      cols: [
        { text: `${item.qty} ${unitLabel[item.unit]}`, grow: 1.6, sm: true },
        { text: jod(item.unit_price), grow: 1.2, align: 'center', sm: true },
        { text: discount > 0 ? `خصم ${jod(discount)}` : '', grow: 1.2, align: 'center', sm: true },
        { text: jod(item.net_total), grow: 1.4, align: 'end', bold: true, sm: true },
      ],
    });
  }

  blocks.push({ type: 'sep' });
  blocks.push({ type: 'kv', label: 'المجموع', value: jod(sale.subtotal) });
  const totalDiscount = Number(sale.line_discount_total) + Number(sale.invoice_discount);
  if (totalDiscount > 0) blocks.push({ type: 'kv', label: 'الخصم', value: `- ${jod(totalDiscount)}` });
  blocks.push({ type: 'kv', label: 'الإجمالي', value: `${jod(sale.total)} د.أ`, bold: true, lg: true });
  blocks.push({ type: 'kv', label: 'المدفوع', value: jod(sale.paid) });
  if (Number(sale.remaining) > 0) {
    blocks.push({ type: 'kv', label: 'المتبقي', value: jod(sale.remaining), bold: true });
  }
  if (sale.customer && Number(sale.customer.balance) > 0) {
    blocks.push({ type: 'kv', label: 'إجمالي الرصيد المستحق', value: jod(sale.customer.balance) });
  }
  if (sale.notes) {
    blocks.push({ type: 'sep' });
    blocks.push({ type: 'text', text: `ملاحظات: ${sale.notes}`, size: 'sm' });
  }
  blocks.push({ type: 'sep', style: 'solid' });
  blocks.push({ type: 'text', text: business.invoice_footer || 'شكراً لتعاملكم معنا', align: 'center', bold: true });

  return { title: `فاتورة ${sale.invoice_no}`, blocks };
}

/** نموذج عام لكشف حساب/تقارير حرارية */
export function buildStatementReceipt(params: {
  business: BusinessSettings;
  title: string;
  subtitle?: string;
  meta: { label: string; value: string }[];
  columns: string[];
  rows: string[][];
  totals: { label: string; value: string; bold?: boolean; lg?: boolean }[];
  footer?: string;
}): ReceiptDoc {
  const blocks: ReceiptBlock[] = [...businessHeader(params.business)];
  blocks.push({ type: 'text', text: params.title, size: 'md', bold: true, align: 'center' });
  if (params.subtitle) blocks.push({ type: 'text', text: params.subtitle, size: 'sm', align: 'center' });
  for (const m of params.meta) blocks.push({ type: 'kv', label: m.label, value: m.value });
  blocks.push({ type: 'sep' });
  blocks.push({
    type: 'row',
    cols: params.columns.map((c, i) => ({
      text: c,
      grow: i === 0 ? 2 : 1,
      bold: true,
      sm: true,
      align: i === 0 ? 'start' : 'end',
    })),
  });
  blocks.push({ type: 'sep' });
  for (const row of params.rows) {
    blocks.push({
      type: 'row',
      cols: row.map((c, i) => ({
        text: c,
        grow: i === 0 ? 2 : 1,
        sm: true,
        align: i === 0 ? 'start' : 'end',
      })),
    });
  }
  blocks.push({ type: 'sep' });
  for (const t of params.totals) blocks.push({ type: 'kv', label: t.label, value: t.value, bold: t.bold, lg: t.lg });
  blocks.push({ type: 'sep', style: 'solid' });
  blocks.push({ type: 'text', text: params.footer ?? params.business.invoice_footer ?? 'شكراً لتعاملكم معنا', align: 'center', bold: true });
  return { title: params.title, blocks };
}

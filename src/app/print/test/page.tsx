import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { businessHeader, type ReceiptBlock } from '@/lib/printing/receipt-model';
import { ReceiptView } from '@/components/printing/receipt-view';
import { PrintController } from '@/components/printing/print-controller';
import { fmtDateTime } from '@/lib/format/date';

export const dynamic = 'force-dynamic';

export default async function PrintTestPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string; w?: string }>;
}) {
  await requireProfile();
  const sp = await searchParams;
  const settings = await getSettings();
  const width = sp.w === '58' ? 58 : sp.w === '80' ? 80 : settings.printer.paper_width;
  const printerSettings = { ...settings.printer, paper_width: width as 58 | 80 };

  const blocks: ReceiptBlock[] = [
    ...businessHeader(settings.business),
    { type: 'text', text: 'اختبار طباعة', size: 'lg', bold: true, align: 'center' },
    { type: 'kv', label: 'الوقت', value: fmtDateTime(new Date()) },
    { type: 'kv', label: 'عرض الورق', value: `${width}mm` },
    { type: 'kv', label: 'الطريقة', value: settings.printer.mode === 'bridge' ? 'جسر مباشر' : 'متصفح' },
    { type: 'sep' },
    {
      type: 'row',
      cols: [
        { text: 'الصنف', grow: 3, bold: true, sm: true },
        { text: 'الكمية', grow: 1.4, align: 'center', bold: true, sm: true },
        { text: 'الإجمالي', grow: 1.4, align: 'end', bold: true, sm: true },
      ],
    },
    { type: 'sep' },
    {
      type: 'row',
      cols: [
        { text: 'شيبس كتشب 30غم', grow: 3, sm: true },
        { text: '2 كرتونة', grow: 1.4, align: 'center', sm: true },
        { text: '16.800', grow: 1.4, align: 'end', bold: true, sm: true },
      ],
    },
    {
      type: 'row',
      cols: [
        { text: 'عصير برتقال 250مل', grow: 3, sm: true },
        { text: '5 حبة', grow: 1.4, align: 'center', sm: true },
        { text: '1.750', grow: 1.4, align: 'end', bold: true, sm: true },
      ],
    },
    { type: 'sep' },
    { type: 'kv', label: 'الإجمالي', value: '18.550 د.أ', bold: true, lg: true },
    { type: 'sep', style: 'solid' },
    { type: 'text', text: 'إذا قرأت هذا النص واضحًا فالطابعة مضبوطة ✓', align: 'center', size: 'sm' },
    { type: 'text', text: '1234567890 — ABC — عربي', align: 'center', size: 'sm' },
  ];

  return (
    <div>
      <title>اختبار طباعة</title>
      <PrintController blocks={blocks} settings={printerSettings} auto={sp.auto === '1'} />
      <div className="rounded-lg bg-white p-3 shadow-card print:rounded-none print:p-0 print:shadow-none">
        <ReceiptView blocks={blocks} width={width as 58 | 80} />
      </div>
    </div>
  );
}

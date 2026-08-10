import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getInventoryCount } from '@/server/queries/products';
import { buildStatementReceipt } from '@/lib/printing/receipt-model';
import { ReceiptView } from '@/components/printing/receipt-view';
import { PrintController } from '@/components/printing/print-controller';
import { fmtDateShort, fmtTime } from '@/lib/format/date';
import { formatJOD } from '@/lib/calc/money';

export const dynamic = 'force-dynamic';

const countTypeLabels: Record<string, string> = {
  daily: 'يومي',
  monthly: 'شهري',
  manual: 'يدوي',
};

export default async function PrintCountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; w?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const sp = await searchParams;

  const data = await getInventoryCount(id);
  if (!data) notFound();
  const { count, items } = data;

  const settings = await getSettings();
  const width = sp.w === '58' ? 58 : sp.w === '80' ? 80 : settings.printer.paper_width;
  const printerSettings = { ...settings.printer, paper_width: width as 58 | 80 };

  // البنود المعدودة فقط
  const counted = items.filter((i) => i.actual_units != null);
  const totalDiffUnits = counted.reduce((a, i) => a + (i.diff_units ?? 0), 0);
  const totalDiffValue = counted.reduce((a, i) => a + Number(i.diff_value ?? 0), 0);

  const doc = buildStatementReceipt({
    business: settings.business,
    title: `تقرير جرد ${count.count_no}`,
    meta: [
      { label: 'النوع', value: countTypeLabels[count.count_type] ?? count.count_type },
      { label: 'التاريخ', value: `${fmtDateShort(count.created_at)} ${fmtTime(count.created_at)}` },
      { label: 'المستخدم', value: count.created_by_profile?.full_name ?? '—' },
    ],
    columns: ['الصنف', 'المتوقع', 'الفعلي', 'الفرق'],
    rows: counted.map((i) => [
      i.product_name,
      String(i.expected_units),
      String(i.actual_units ?? 0),
      (i.diff_units ?? 0) > 0 ? `+${i.diff_units}` : String(i.diff_units ?? 0),
    ]),
    totals: [
      { label: 'إجمالي فرق الحبات', value: `${totalDiffUnits > 0 ? '+' : ''}${totalDiffUnits}`, bold: true },
      { label: 'قيمة الفرق', value: `${formatJOD(totalDiffValue, { symbol: false })} د.أ`, bold: true, lg: true },
    ],
  });

  return (
    <div>
      <title>{doc.title}</title>
      <PrintController blocks={doc.blocks} settings={printerSettings} auto={sp.auto === '1'} />
      <div className="rounded-lg bg-white p-3 shadow-card print:rounded-none print:p-0 print:shadow-none">
        <ReceiptView blocks={doc.blocks} width={width as 58 | 80} />
      </div>
    </div>
  );
}
